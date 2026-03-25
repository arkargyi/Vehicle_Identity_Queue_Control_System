import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { History as HistoryIcon, Download, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';

export default function History() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'queues'), orderBy('entry_time', 'desc'));
        const snapshot = await getDocs(q);
        const queueData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const enrichedHistory = await Promise.all(queueData.map(async (qItem: any) => {
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
            driver_name: truckData.driver_name || 'Unknown',
            gate_name: gateName,
            entry_time: qItem.entry_time?.toDate() || null,
            exit_time: qItem.exit_time?.toDate() || null,
          };
        }));

        setHistory(enrichedHistory);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const exportData = history.map(item => ({
      'Plate Number': item.plate_number,
      'Driver Name': item.driver_name,
      'Company': item.company,
      'Cane Type': item.cane_type || 'Unknown',
      'Seniority': item.seniority_number || 'N/A',
      'Status': item.status,
      'Priority': item.priority,
      'Round': item.round_id || 'N/A',
      'Double Entry': item.is_double_entry ? 'Yes' : 'No',
      'Gate': item.gate_name || 'N/A',
      'Entry Time': item.entry_time ? format(item.entry_time, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      'Exit Time': item.exit_time ? format(item.exit_time, 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'queue_history_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading history...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <HistoryIcon className="mr-3 h-6 w-6 text-indigo-600" />
          Queue History
        </h2>
        <button
          onClick={handleExportCSV}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plate Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cane Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seniority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{item.plate_number}</span>
                      {item.is_double_entry && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded flex items-center" title="Entered multiple times in this round">
                          <AlertCircle className="w-3 h-3 mr-0.5" />
                          Double Entry
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.company}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.cane_type || 'Unknown'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.seniority_number || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.round_id || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${item.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        item.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' : 
                        item.status === 'called' ? 'bg-indigo-100 text-indigo-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.entry_time ? format(item.entry_time, 'MMM d, yyyy HH:mm') : 'N/A'}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No history found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
