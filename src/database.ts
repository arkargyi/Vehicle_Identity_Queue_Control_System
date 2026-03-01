import Database from 'better-sqlite3';

const db = new Database('queue_system.db', { verbose: console.log });

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL -- admin, security, operator, viewer
  );

  CREATE TABLE IF NOT EXISTS trucks (
    id TEXT PRIMARY KEY, -- Unique Truck ID (UUID or generated)
    plate_number TEXT UNIQUE NOT NULL,
    driver_name TEXT NOT NULL,
    company TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    cane_type TEXT NOT NULL,
    is_blacklisted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL -- entry, loading, exit
  );

  CREATE TABLE IF NOT EXISTS queues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truck_id TEXT NOT NULL,
    status TEXT NOT NULL, -- waiting, called, processing, completed
    priority TEXT DEFAULT 'normal', -- normal, high
    gate_id INTEGER,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    call_time DATETIME,
    process_time DATETIME,
    exit_time DATETIME,
    FOREIGN KEY (truck_id) REFERENCES trucks(id),
    FOREIGN KEY (gate_id) REFERENCES gates(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Insert default data if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (settingsCount.count === 0) {
  const defaultCaneTypes = JSON.stringify([
    'Normal', 'Q', 'Special Q(A)', 'Special Q(B)', 
    'Burnt Cane', '(Tri Cycle;PZG;OX)', 'Debt Cane'
  ]);
  const defaultPriorityRules = JSON.stringify({
    high_priority_types: ['Burnt Cane', 'Special Q(A)']
  });

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('cane_types', defaultCaneTypes);
  insertSetting.run('priority_rules', defaultPriorityRules);
}

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
  insertUser.run('admin', 'admin123', 'admin');
  insertUser.run('security', 'sec123', 'security');
  insertUser.run('operator', 'op123', 'operator');
  insertUser.run('viewer', 'view123', 'viewer');
}

const gateCount = db.prepare('SELECT COUNT(*) as count FROM gates').get() as { count: number };
if (gateCount.count === 0) {
  const insertGate = db.prepare('INSERT INTO gates (name, type) VALUES (?, ?)');
  insertGate.run('Main Entry Gate', 'entry');
  insertGate.run('Loading Dock A', 'loading');
  insertGate.run('Loading Dock B', 'loading');
  insertGate.run('Main Exit Gate', 'exit');
}

export default db;
