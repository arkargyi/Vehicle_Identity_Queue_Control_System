import { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function OperatorPanel() {
  const { user } = useAuth();
  const [queues, setQueues] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>('');
  const [isConnected, setIsConnected] = useState(true);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [averageWaitTime, setAverageWaitTime] = useState<number>(0);
  const [maxWaitTime, setMaxWaitTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterCaneType, setFilterCaneType] = useState<string>('All');
  const [caneTypes, setCaneTypes] = useState<string[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'config'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.cane_types && data.cane_types.length > 0) {
            setCaneTypes(data.cane_types);
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCompletedQueues = async () => {
      const q = query(
        collection(db, 'queues'),
        where('status', '==', 'completed')
      );
      const snapshot = await getDocs(q);
      let totalWaitTime = 0;
      let count = 0;
      snapshot.forEach(d => {
        const data = d.data();
        if (data.entry_time && data.exit_time) {
          const entry = data.entry_time.toDate();
          const exit = data.exit_time.toDate();
          const waitMins = (exit.getTime() - entry.getTime()) / 60000;
          if (waitMins > 0) {
            totalWaitTime += waitMins;
            count++;
          }
        }
      });
      if (count > 0) {
        setAverageWaitTime(Math.round(totalWaitTime / count));
      }
    };
    fetchCompletedQueues();
  }, []);

  useEffect(() => {
    if (queues.length > 0) {
      const waitingTrucks = queues.filter(q => q.status === 'waiting');
      if (waitingTrucks.length > 0) {
        const oldest = waitingTrucks.reduce((prev, current) => {
          return (prev.entry_time < current.entry_time) ? prev : current;
        });
        const waitMins = Math.round((new Date().getTime() - oldest.entry_time.getTime()) / 60000);
        setMaxWaitTime(waitMins > 0 ? waitMins : 0);
      } else {
        setMaxWaitTime(0);
      }
    }
  }, [queues, currentTime]);

  useEffect(() => {
    // Fetch current round
    const unsubscribeRound = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentRound(docSnap.data().current_round || 1);
      } else {
        // Initialize if not exists
        setDoc(doc(db, 'settings', 'system'), { current_round: 1, updated_at: serverTimestamp() });
      }
    });

    const fetchGates = async () => {
      const defaultGates = [
        { id: 'weight_scale_1', name: 'Weight Scale 1', type: 'loading' },
        { id: 'weight_scale_2', name: 'Weight Scale 2', type: 'loading' }
      ];
      setGates(defaultGates);
      setSelectedGate(defaultGates[0].id);
    };
    fetchGates();

    const q = query(
      collection(db, 'queues'),
      where('status', 'in', ['waiting', 'called'])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      setIsConnected(true);
      const queueData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Fetch truck details for each queue
      const enrichedQueues = await Promise.all(queueData.map(async (qItem: any) => {
        let truckData: any = {};
        if (qItem.truck_id) {
          const truckDoc = await getDoc(doc(db, 'trucks', qItem.truck_id));
          if (truckDoc.exists()) {
            truckData = truckDoc.data();
          }
        }
        
        let gateName = '';
        if (qItem.gate_id) {
          const gateDoc = await getDoc(doc(db, 'gates', qItem.gate_id));
          if (gateDoc.exists()) {
            gateName = gateDoc.data().name;
          }
        }

        return {
          ...qItem,
          plate_number: truckData.plate_number || 'Unknown',
          company: truckData.company || 'Unknown',
          cane_type: qItem.cane_type || truckData.cane_type || 'Unknown', // Use queue cane_type if available
          gate_name: gateName,
          entry_time: qItem.entry_time?.toDate() || new Date(),
          call_time: qItem.call_time?.toDate() || new Date(),
          estimated_wait_mins: 15 // Placeholder
        };
      }));

      // Sort by priority (high first) then entry time
      enrichedQueues.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return a.entry_time.getTime() - b.entry_time.getTime();
      });

      setQueues(enrichedQueues);
    }, (error) => {
      console.error("Error fetching queues:", error);
      setIsConnected(false);
    });

    return () => {
      unsubscribe();
      unsubscribeRound();
    };
  }, []);

  const handleStartNewRound = async () => {
    if (!window.confirm(`Are you sure you want to start Round ${currentRound + 1}? This will reset the entry limits for all trucks.`)) return;
    
    setIsStartingRound(true);
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        current_round: currentRound + 1,
        round_started_at: serverTimestamp(),
        round_started_by: user?.id || 'unknown'
      });
    } catch (error) {
      console.error("Error starting new round:", error);
      alert("Failed to start new round.");
    } finally {
      setIsStartingRound(false);
    }
  };

  const handleCall = async (queueId: string) => {
    if (!selectedGate) return alert('Please select a gate first');
    const qItem = queues.find(q => q.id === queueId);
    try {
      await updateDoc(doc(db, 'queues', queueId), {
        status: 'called',
        gate_id: selectedGate,
        call_time: serverTimestamp(),
        cane_type: qItem?.cane_type || 'Unknown',
        round_id: currentRound
      });
    } catch (error) {
      console.error("Error calling truck:", error);
    }
  };

  const handleProcess = async (queueId: string) => {
    try {
      await updateDoc(doc(db, 'queues', queueId), {
        status: 'processing',
        process_time: serverTimestamp()
      });
    } catch (error) {
      console.error("Error processing truck:", error);
    }
  };

  const waiting = queues.filter(q => q.status === 'waiting' && (filterCaneType === 'All' || q.cane_type === filterCaneType));
  const called = queues.filter(q => q.status === 'called');

  return (
    <div className="space-y-8">
      {/* Round Management */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Current Round: {currentRound}</h2>
          <p className="text-sm text-gray-500 mt-1">Trucks can only enter once per round unless overridden by Super Admin.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
              <span className="text-indigo-600 font-medium block text-xs uppercase">Avg Wait</span>
              <span className="text-indigo-900 font-bold text-lg">{averageWaitTime}m</span>
            </div>
            <div className="bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
              <span className="text-orange-600 font-medium block text-xs uppercase">Max Wait</span>
              <span className="text-orange-900 font-bold text-lg">{maxWaitTime}m</span>
            </div>
          </div>
          {['super_admin', 'admin', 'queue_manager'].includes(user?.role || '') && (
            <button
              onClick={handleStartNewRound}
              disabled={isStartingRound}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 h-full"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isStartingRound && "animate-spin")} />
              Start Round {currentRound + 1}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Call Next Truck */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Call Next Truck</h2>
          <div className="flex items-center space-x-2">
            <span className={cn("inline-flex items-center px-2 py-1 rounded text-xs font-medium", isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
              <span className={cn("w-2 h-2 rounded-full mr-1", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")}></span>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
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
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Cane Type</label>
            <select
              value={filterCaneType}
              onChange={(e) => setFilterCaneType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="All">All Cane Types</option>
              {caneTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {waiting.map((q, i) => (
            <div key={q.id} className={cn("p-4 rounded-lg border flex items-center justify-between", q.priority === 'high' ? "border-red-200 bg-red-50" : "border-gray-200 bg-white")}>
              <div>
                <div className="flex items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase mr-2" title="Seniority Number">#{q.seniority_number || i + 1}</span>
                  <h4 className="font-bold text-lg text-gray-900">{q.plate_number}</h4>
                  {q.priority === 'high' && (
                    <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold rounded">VIP</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{q.company} • <span className="font-semibold text-indigo-600">{q.cane_type}</span></p>
                <div className="mt-1 text-xs text-gray-500 flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting {formatDistanceToNow(q.entry_time)}
                  </div>
                  <div className="flex items-center text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded ml-4">
                    Est. wait: ~{maxWaitTime}m
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
                  Called {formatDistanceToNow(q.call_time)} ago
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
    </div>
  );
}
