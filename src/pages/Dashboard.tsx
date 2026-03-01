import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Clock, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [queues, setQueues] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});

  const fetchData = async () => {
    const [qRes, aRes] = await Promise.all([
      fetch('/api/queues'),
      fetch('/api/analytics')
    ]);
    setQueues(await qRes.json());
    setAnalytics(await aRes.json());
  };

  useEffect(() => {
    fetchData();
    const socket = io();
    socket.on('queue_updated', fetchData);
    return () => { socket.disconnect(); };
  }, []);

  const waiting = queues.filter(q => q.status === 'waiting');
  const called = queues.filter(q => q.status === 'called');
  const processing = queues.filter(q => q.status === 'processing');

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Trucks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.totalTrucks || 0}</p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active in Queue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.activeQueues || 0}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-50 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.completedToday || 0}</p>
            </div>
            <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Wait Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.avgWaitTime || 0}m</p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Queue Boards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl">
            <h3 className="font-semibold text-gray-800 flex items-center">
              <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
              Waiting ({waiting.length})
            </h3>
          </div>
          <div className="p-4 flex-1 overflow-auto space-y-3">
            {waiting.map((q, i) => (
              <div key={q.id} className={cn("p-4 rounded-lg border", q.priority === 'high' ? "border-red-200 bg-red-50" : "border-gray-200 bg-white")}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">#{i + 1}</span>
                    <h4 className="font-bold text-lg text-gray-900">{q.plate_number}</h4>
                    <p className="text-sm text-gray-600">{q.company} • {q.cane_type}</p>
                  </div>
                  {q.priority === 'high' && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">VIP</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting {formatDistanceToNow(new Date(q.entry_time))}
                  </div>
                  <div className="flex items-center text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                    Est. wait: ~{q.estimated_wait_mins}m
                  </div>
                </div>
              </div>
            ))}
            {waiting.length === 0 && (
              <div className="text-center text-gray-500 py-8">No trucks waiting</div>
            )}
          </div>
        </div>

        {/* Called */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="p-4 border-b bg-indigo-50 rounded-t-xl">
            <h3 className="font-semibold text-indigo-800 flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
              Called to Gate ({called.length})
            </h3>
          </div>
          <div className="p-4 flex-1 overflow-auto space-y-3">
            {called.map(q => (
              <div key={q.id} className="p-4 rounded-lg border border-indigo-200 bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-xl text-indigo-900">{q.plate_number}</h4>
                    <p className="text-sm text-gray-600">{q.driver_name}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-indigo-50 rounded border border-indigo-100">
                  <p className="text-sm font-medium text-indigo-800 text-center">
                    Proceed to: <span className="font-bold text-lg block">{q.gate_name}</span>
                  </p>
                </div>
              </div>
            ))}
            {called.length === 0 && (
              <div className="text-center text-gray-500 py-8">No trucks called</div>
            )}
          </div>
        </div>

        {/* Processing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <div className="p-4 border-b bg-green-50 rounded-t-xl">
            <h3 className="font-semibold text-green-800 flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              Processing ({processing.length})
            </h3>
          </div>
          <div className="p-4 flex-1 overflow-auto space-y-3">
            {processing.map(q => (
              <div key={q.id} className="p-4 rounded-lg border border-green-200 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">{q.plate_number}</h4>
                    <p className="text-sm text-gray-600">{q.gate_name}</p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded flex items-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1"></div>
                    Active
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Started {formatDistanceToNow(new Date(q.process_time))} ago
                </div>
              </div>
            ))}
            {processing.length === 0 && (
              <div className="text-center text-gray-500 py-8">No trucks processing</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
