import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

export default function GateEntry() {
  const { user } = useAuth();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [truckInfo, setTruckInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [priority, setPriority] = useState('normal');
  const [manualId, setManualId] = useState('');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [selectedCaneType, setSelectedCaneType] = useState('Normal');
  const [caneTypes, setCaneTypes] = useState<string[]>(['Normal', 'Sling', 'Burnt Cane', 'Debt Cane', 'Special Q (A)', 'Special Q (B)', 'Irrigation Cane', 'Other(PZG,Tri-Cycle,OX-Cart)']);
  const [needsOverride, setNeedsOverride] = useState(false);
  const [maxWaitTime, setMaxWaitTime] = useState<number>(0);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Fetch current round
    const fetchRound = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'system'));
      if (docSnap.exists()) {
        setCurrentRound(docSnap.data().current_round || 1);
      }
    };
    fetchRound();

    // Fetch cane types
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

    // Fetch max wait time
    const fetchMaxWaitTime = async () => {
      const q = query(
        collection(db, 'queues'),
        where('status', '==', 'waiting')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          let oldestEntryTime = new Date();
          snapshot.forEach(d => {
            const data = d.data();
            if (data.entry_time) {
              const entryTime = data.entry_time.toDate();
              if (entryTime < oldestEntryTime) {
                oldestEntryTime = entryTime;
              }
            }
          });
          const waitMins = Math.round((new Date().getTime() - oldestEntryTime.getTime()) / 60000);
          setMaxWaitTime(waitMins > 0 ? waitMins : 0);
        } else {
          setMaxWaitTime(0);
        }
      });
      return unsubscribe;
    };
    const unsubscribeWaitTime = fetchMaxWaitTime();
    
    return () => {
      unsubscribeWaitTime.then(unsub => unsub());
    };
  }, []);

  useEffect(() => {
    if (!scannerRef.current && !scanResult) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [scanResult]);

  const onScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanResult(decodedText);
    fetchTruckInfo(decodedText);
  };

  const onScanFailure = (error: any) => {
    // Ignore frequent scan failures
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      onScanSuccess(manualId.trim());
    }
  };

  const fetchTruckInfo = async (id: string) => {
    try {
      const docRef = doc(db, 'trucks', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTruckInfo(data);
        setSelectedCaneType(data.cane_type || 'Normal');

        // Check if truck already entered in current round
        const q = query(
          collection(db, 'queues'),
          where('truck_id', '==', id),
          where('round_id', '==', currentRound)
        );
        const queueSnap = await getDocs(q);
        
        if (!queueSnap.empty) {
          setNeedsOverride(true);
          setError(`Warning: This truck has already entered in Round ${currentRound}.`);
        } else {
          setNeedsOverride(false);
        }

      } else {
        setError('Truck not found in database');
      }
    } catch (err) {
      setError('Failed to fetch truck info');
    }
  };

  const handleEntry = async () => {
    if (needsOverride && user?.role !== 'super_admin') {
      setError('Only Super Admin can override and allow double entry in the same round.');
      return;
    }

    try {
      // Calculate seniority number for this cane type in this round
      const seniorityQuery = query(
        collection(db, 'queues'),
        where('round_id', '==', currentRound),
        where('cane_type', '==', selectedCaneType)
      );
      const senioritySnap = await getDocs(seniorityQuery);
      const seniorityNumber = senioritySnap.size + 1;

      const queueId = uuidv4();
      await setDoc(doc(db, 'queues', queueId), {
        truck_id: scanResult,
        status: 'waiting',
        priority: priority,
        entry_time: serverTimestamp(),
        gate_id: 'entry_gate_1', // Assuming a default gate ID
        round_id: currentRound,
        cane_type: selectedCaneType,
        seniority_number: seniorityNumber,
        is_double_entry: needsOverride
      });

      // Update truck's cane_type and round_entry_limit
      if (scanResult) {
        const truckRef = doc(db, 'trucks', scanResult);
        await setDoc(truckRef, {
          cane_type: selectedCaneType,
          round_entry_limit: currentRound,
          last_entry_time: serverTimestamp()
        }, { merge: true });
      }

      // Add audit log
      await setDoc(doc(collection(db, 'audit_logs')), {
        user_id: user?.id || 'unknown',
        action: 'GATE_ENTRY',
        details: `Truck ${scanResult} entered gate (Round ${currentRound}${needsOverride ? ', Double Entry' : ''})`,
        timestamp: serverTimestamp()
      });

      setSuccess('Truck added to queue successfully');
      setTimeout(() => resetScanner(), 3000);
    } catch (err) {
      setError('Failed to add to queue');
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTruckInfo(null);
    setError('');
    setSuccess('');
    setPriority('normal');
    setNeedsOverride(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <QrCode className="mr-3 h-6 w-6 text-indigo-600" />
          Gate Entry Scan
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        {!scanResult ? (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border-2 border-dashed border-gray-300">
              <div id="reader" className="w-full"></div>
            </div>
            <div className="text-center text-sm text-gray-500">OR</div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Enter Truck ID manually"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Submit
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {truckInfo && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Truck Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Plate Number</p>
                    <p className="font-medium text-gray-900 text-lg">{truckInfo.plate_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Driver</p>
                    <p className="font-medium text-gray-900">{truckInfo.driver_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Company</p>
                    <p className="font-medium text-gray-900">{truckInfo.company}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Vehicle Type</p>
                    <p className="font-medium text-gray-900">{truckInfo.vehicle_type}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cane Type (Current Trip)</label>
                  <select
                    value={selectedCaneType}
                    onChange={(e) => setSelectedCaneType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {caneTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Queue Priority</label>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      Estimated Wait: ~{maxWaitTime}m
                    </span>
                  </div>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        checked={priority === 'normal'}
                        onChange={() => setPriority('normal')}
                      />
                      <span className="ml-2 text-sm text-gray-700">Normal</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        className="text-red-600 focus:ring-red-500 h-4 w-4"
                        checked={priority === 'high'}
                        onChange={() => setPriority('high')}
                      />
                      <span className="ml-2 text-sm text-red-700 font-medium">VIP / Urgent</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={resetScanner}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Scan Again
              </button>
              {needsOverride ? (
                user?.role === 'super_admin' ? (
                  <button
                    onClick={handleEntry}
                    disabled={!truckInfo || !!success}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Override & Allow Double Entry
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 px-4 py-3 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                  >
                    Double Entry Blocked
                  </button>
                )
              ) : (
                <button
                  onClick={handleEntry}
                  disabled={!truckInfo || !!success}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
                >
                  Confirm Entry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
