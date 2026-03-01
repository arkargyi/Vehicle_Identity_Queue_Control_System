import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './src/database.js';
import { v4 as uuidv4 } from 'uuid';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const formatted: any = {};
    settings.forEach((s: any) => {
      try {
        formatted[s.key] = JSON.parse(s.value);
      } catch (e) {
        formatted[s.key] = s.value;
      }
    });
    res.json(formatted);
  });

  app.post('/api/settings', (req, res) => {
    const { cane_types, priority_rules } = req.body;
    
    const update = db.transaction(() => {
      if (cane_types) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cane_types', ?)").run(JSON.stringify(cane_types));
      }
      if (priority_rules) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('priority_rules', ?)").run(JSON.stringify(priority_rules));
      }
    });

    try {
      update();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/trucks', (req, res) => {
    const trucks = db.prepare('SELECT * FROM trucks ORDER BY created_at DESC').all();
    res.json(trucks);
  });

  app.post('/api/trucks', (req, res) => {
    const { plate_number, driver_name, company, vehicle_type, cane_type } = req.body;
    const id = uuidv4();
    try {
      db.prepare(`
        INSERT INTO trucks (id, plate_number, driver_name, company, vehicle_type, cane_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, plate_number, driver_name, company, vehicle_type, cane_type);
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post('/api/trucks/bulk', (req, res) => {
    const trucks = req.body.trucks;
    if (!Array.isArray(trucks)) return res.status(400).json({ success: false, message: 'Invalid data format' });

    const insert = db.prepare(`
      INSERT INTO trucks (id, plate_number, driver_name, company, vehicle_type, cane_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((trucksList) => {
      const results = [];
      for (const truck of trucksList) {
        const id = uuidv4();
        try {
          insert.run(id, truck.plate_number, truck.driver_name, truck.company, truck.vehicle_type, truck.cane_type);
          results.push({ id, plate_number: truck.plate_number, success: true });
        } catch (error: any) {
          results.push({ plate_number: truck.plate_number, success: false, message: error.message });
        }
      }
      return results;
    });

    try {
      const results = insertMany(trucks);
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get('/api/trucks/:id', (req, res) => {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id);
    if (truck) res.json(truck);
    else res.status(404).json({ message: 'Truck not found' });
  });

  app.get('/api/queues', (req, res) => {
    const queues = db.prepare(`
      SELECT q.*, t.plate_number, t.driver_name, t.company, t.vehicle_type, t.cane_type, t.is_blacklisted, g.name as gate_name
      FROM queues q
      JOIN trucks t ON q.truck_id = t.id
      LEFT JOIN gates g ON q.gate_id = g.id
      WHERE q.status != 'completed'
      ORDER BY 
        CASE WHEN q.priority = 'high' THEN 1 ELSE 2 END,
        q.entry_time ASC
    `).all();

    // Calculate average processing time in minutes
    const avgProcess = db.prepare(`
      SELECT AVG((julianday(exit_time) - julianday(call_time)) * 24 * 60) as avg_process
      FROM queues WHERE exit_time IS NOT NULL AND call_time IS NOT NULL
    `).get() as any;
    
    // Default to 15 mins if no historical data
    const avgProcessTime = avgProcess.avg_process ? Math.max(5, Math.round(avgProcess.avg_process)) : 15;

    let waitingCount = 0;
    const queuesWithEstimate = queues.map((q: any) => {
      if (q.status === 'waiting') {
        waitingCount++;
        q.estimated_wait_mins = waitingCount * avgProcessTime;
      }
      return q;
    });

    res.json(queuesWithEstimate);
  });

  app.post('/api/queues/entry', (req, res) => {
    let { truck_id, priority = 'normal' } = req.body;
    
    // Check if truck exists
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(truck_id) as any;
    if (!truck) return res.status(404).json({ message: 'Truck not found' });
    if (truck.is_blacklisted) return res.status(403).json({ message: 'Truck is blacklisted' });

    // Check if already in queue
    const existing = db.prepare("SELECT id FROM queues WHERE truck_id = ? AND status != 'completed'").get(truck_id);
    if (existing) return res.status(400).json({ message: 'Truck is already in the queue' });

    // Apply auto-priority rules from settings
    try {
      const settings = db.prepare("SELECT value FROM settings WHERE key = 'priority_rules'").get() as any;
      if (settings) {
        const rules = JSON.parse(settings.value);
        if (rules.high_priority_types && rules.high_priority_types.includes(truck.cane_type)) {
          priority = 'high';
        }
      }
    } catch (e) {
      console.error('Error applying priority rules:', e);
    }

    db.prepare(`
      INSERT INTO queues (truck_id, status, priority, entry_time)
      VALUES (?, 'waiting', ?, CURRENT_TIMESTAMP)
    `).run(truck_id, priority);

    io.emit('queue_updated');
    res.json({ success: true, priority });
  });

  app.post('/api/queues/call', (req, res) => {
    const { queue_id, gate_id } = req.body;
    db.prepare(`
      UPDATE queues 
      SET status = 'called', gate_id = ?, call_time = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(gate_id, queue_id);
    io.emit('queue_updated');
    res.json({ success: true });
  });

  app.post('/api/queues/process', (req, res) => {
    const { queue_id } = req.body;
    db.prepare(`
      UPDATE queues 
      SET status = 'processing', process_time = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(queue_id);
    io.emit('queue_updated');
    res.json({ success: true });
  });

  app.post('/api/queues/exit', (req, res) => {
    const { truck_id } = req.body;
    const queue = db.prepare("SELECT id FROM queues WHERE truck_id = ? AND status != 'completed'").get(truck_id) as any;
    if (!queue) return res.status(404).json({ message: 'Active queue session not found for this truck' });

    db.prepare(`
      UPDATE queues 
      SET status = 'completed', exit_time = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(queue.id);
    io.emit('queue_updated');
    res.json({ success: true });
  });

  app.get('/api/gates', (req, res) => {
    const gates = db.prepare('SELECT * FROM gates').all();
    res.json(gates);
  });

  app.get('/api/analytics', (req, res) => {
    const totalTrucks = db.prepare('SELECT COUNT(*) as count FROM trucks').get() as any;
    const activeQueues = db.prepare("SELECT COUNT(*) as count FROM queues WHERE status != 'completed'").get() as any;
    const completedToday = db.prepare("SELECT COUNT(*) as count FROM queues WHERE status = 'completed' AND date(exit_time) = date('now')").get() as any;
    
    // Average wait time (entry to call) in minutes
    const avgWait = db.prepare(`
      SELECT AVG((julianday(call_time) - julianday(entry_time)) * 24 * 60) as avg_wait
      FROM queues WHERE call_time IS NOT NULL
    `).get() as any;

    res.json({
      totalTrucks: totalTrucks.count,
      activeQueues: activeQueues.count,
      completedToday: completedToday.count,
      avgWaitTime: Math.round(avgWait.avg_wait || 0)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
