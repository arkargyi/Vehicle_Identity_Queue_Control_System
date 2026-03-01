import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, AlertCircle, CheckCircle } from 'lucide-react';

export default function GateExit() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [truckInfo, setTruckInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!scannerRef.current && !scanResult) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader-exit",
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

  const handleExit = async () => {
    try {
      const res = await fetch('/api/queues/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truck_id: scanResult })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Truck exited successfully. Queue session closed.');
        setTimeout(() => resetScanner(), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to process exit');
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTruckInfo(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <QrCode className="mr-3 h-6 w-6 text-indigo-600" />
          Gate Exit Scan
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
            <div id="reader-exit" className="w-full"></div>
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
                onClick={handleExit}
                disabled={!truckInfo || !!success}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
