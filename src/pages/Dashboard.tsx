import { useState, useEffect } from 'react';
import { Clock, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, getDoc, doc, orderBy } from 'firebase/firestore';

export default function Dashboard() {
  const [queues, setQueues] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalTrucks: 0,
    activeQueues: 0,
    completedToday: 0,
    avgWaitTime: 0
  });
  const [isConnected, setIsConnected] = useState(true);
  const [maxWaitTime, setMaxWaitTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
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
    const q = query(
      collection(db, 'queues'),
      where('status', 'in', ['waiting', 'called', 'processing'])
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
          cane_type: truckData.cane_type || 'Unknown',
          driver_name: truckData.driver_name || 'Unknown',
          gate_name: gateName,
          entry_time: qItem.entry_time?.toDate() || new Date(),
          call_time: qItem.call_time?.toDate() || new Date(),
          process_time: qItem.process_time?.toDate() || new Date(),
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
      
      // Update basic analytics
      setAnalytics(prev => ({
        ...prev,
        activeQueues: enrichedQueues.length
      }));
    }, (error) => {
      console.error("Error fetching queues:", error);
      setIsConnected(false);
    });

    // Fetch total trucks and completed today
    const fetchAnalytics = async () => {
      try {
        const trucksSnapshot = await getDocs(collection(db, 'trucks'));
        const totalTrucks = trucksSnapshot.size;

        // Start of today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const completedQuery = query(
          collection(db, 'queues'),
          where('status', '==', 'completed')
        );
        const completedSnapshot = await getDocs(completedQuery);
        let completedToday = 0;
        let totalWaitTime = 0;
        let waitCount = 0;

        completedSnapshot.forEach(d => {
          const data = d.data();
          if (data.exit_time && data.exit_time.toDate() >= startOfToday) {
            completedToday++;
          }
          if (data.entry_time && data.exit_time) {
            const entry = data.entry_time.toDate();
            const exit = data.exit_time.toDate();
            const waitMins = (exit.getTime() - entry.getTime()) / 60000;
            if (waitMins > 0) {
              totalWaitTime += waitMins;
              waitCount++;
            }
          }
        });

        const avgWaitTime = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;

        setAnalytics(prev => ({
          ...prev,
          totalTrucks,
          completedToday,
          avgWaitTime
        }));
      } catch (error) {
        console.error("Error fetching analytics:", error);
      }
    };
    
    fetchAnalytics();

    return () => unsubscribe();
  }, []);

  const waiting = queues.filter(q => q.status === 'waiting');
  const called = queues.filter(q => q.status === 'called');
  const processing = queues.filter(q => q.status === 'processing');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border", isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
          <span className={cn("w-2 h-2 rounded-full mr-2", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")}></span>
          {isConnected ? 'System Live' : 'Offline'}
        </span>
      </div>

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
                    <span className="text-xs font-bold text-gray-500 uppercase" title="Seniority Number">#{q.seniority_number || i + 1}</span>
                    <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                      {q.plate_number}
                      {q.is_double_entry && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded flex items-center" title="Entered multiple times in this round">
                          <AlertCircle className="w-3 h-3 mr-0.5" />
                          Double Entry
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">{q.company} • {q.cane_type}</p>
                  </div>
                  {q.priority === 'high' && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">VIP</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting {formatDistanceToNow(q.entry_time)}
                  </div>
                  <div className="flex items-center text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                    Est. wait: ~{maxWaitTime}m
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
                  Started {formatDistanceToNow(q.process_time)} ago
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
