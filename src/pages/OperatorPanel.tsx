import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Play, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

export default function OperatorPanel() {
  const [queues, setQueues] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>('');

  const fetchData = async () => {
    const [qRes, gRes] = await Promise.all([
      fetch('/api/queues'),
      fetch('/api/gates')
    ]);
    setQueues(await qRes.json());
    
    const allGates = await gRes.json();
    const loadingGates = allGates.filter((g: any) => g.type === 'loading');
    setGates(loadingGates);
    if (loadingGates.length > 0 && !selectedGate) {
      setSelectedGate(loadingGates[0].id.toString());
    }
  };

  useEffect(() => {
    fetchData();
    const socket = io();
    socket.on('queue_updated', fetchData);
    return () => { socket.disconnect(); };
  }, []);

  const handleCall = async (queueId: number) => {
    if (!selectedGate) return alert('Please select a gate first');
    await fetch('/api/queues/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, gate_id: parseInt(selectedGate) })
    });
  };

  const handleProcess = async (queueId: number) => {
    await fetch('/api/queues/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId })
    });
  };

  const waiting = queues.filter(q => q.status === 'waiting');
  const called = queues.filter(q => q.status === 'called');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Call Next Truck */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Call Next Truck</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Gate/Dock</label>
          <select
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {gates.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {waiting.map((q, i) => (
            <div key={q.id} className={cn("p-4 rounded-lg border flex items-center justify-between", q.priority === 'high' ? "border-red-200 bg-red-50" : "border-gray-200 bg-white")}>
              <div>
                <div className="flex items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase mr-2">#{i + 1}</span>
                  <h4 className="font-bold text-lg text-gray-900">{q.plate_number}</h4>
                  {q.priority === 'high' && (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold rounded">VIP</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{q.company} • {q.cane_type}</p>
                <div className="mt-1 text-xs text-gray-500 flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting {formatDistanceToNow(new Date(q.entry_time))}
                  </div>
                  <div className="flex items-center text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                    Est. wait: ~{q.estimated_wait_mins}m
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleCall(q.id)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Call
              </button>
            </div>
          ))}
          {waiting.length === 0 && (
            <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-lg">
              No trucks waiting in queue
            </div>
          )}
        </div>
      </div>

      {/* Active Operations */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Active Operations</h2>
        
        <div className="space-y-4">
          {called.map(q => (
            <div key={q.id} className="p-4 rounded-lg border border-indigo-200 bg-indigo-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-lg text-indigo-900">{q.plate_number}</h4>
                <p className="text-sm text-indigo-700">Assigned to: <span className="font-bold">{q.gate_name}</span></p>
                <div className="mt-1 text-xs text-indigo-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Called {formatDistanceToNow(new Date(q.call_time))} ago
                </div>
              </div>
              <button
                onClick={() => handleProcess(q.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center whitespace-nowrap"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Processing
              </button>
            </div>
          ))}
          {called.length === 0 && (
            <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-lg">
              No trucks currently called to gates
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
