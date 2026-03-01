import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, AlertCircle, CheckCircle } from 'lucide-react';

export default function GateEntry() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [truckInfo, setTruckInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [priority, setPriority] = useState('normal');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

  const fetchTruckInfo = async (id: string) => {
    try {
      const res = await fetch(`/api/trucks/${id}`);
      if (res.ok) {
        setTruckInfo(await res.json());
      } else {
        setError('Truck not found in database');
      }
    } catch (err) {
      setError('Failed to fetch truck info');
    }
  };

  const handleEntry = async () => {
    try {
      const res = await fetch('/api/queues/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truck_id: scanResult, priority })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Truck added to queue successfully');
        setTimeout(() => resetScanner(), 3000);
      } else {
        setError(data.message);
      }
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
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-gray-300">
            <div id="reader" className="w-full"></div>
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
                    <p className="text-gray-500">Cane Type</p>
                    <p className="font-medium text-gray-900">{truckInfo.cane_type}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Queue Priority</label>
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
              <button
                onClick={handleEntry}
                disabled={!truckInfo || !!success}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
              >
                Confirm Entry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
