import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Truck, Printer, Search, Upload, AlertCircle, CheckCircle, Download, Archive } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import JSZip from 'jszip';
import QRCode from 'qrcode';

export default function Vehicles() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTrucks = async () => {
    try {
      const q = query(collection(db, 'trucks'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const truckData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrucks(truckData);
    } catch (error) {
      console.error("Error fetching trucks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          if (data.length === 0) {
            setError('No data found in CSV.');
            return;
          }

          let successCount = 0;
          for (const row of data) {
            // Map CSV headers to our fields. Adjust these if your CSV headers differ.
            const plate_number = row['Plate Number'] || row['plate_number'] || row['Plate'] || row['plate'];
            const driver_name = row['Driver Name'] || row['driver_name'] || row['Driver'] || row['driver'] || 'Unknown';
            const company = row['Company'] || row['company'] || row['Supplier'] || row['supplier'] || 'Unknown';
            const vehicle_type = row['Vehicle Type'] || row['vehicle_type'] || row['Type'] || row['type'] || 'Trailer';
            const cane_type = row['Cane Type'] || row['cane_type'] || row['Cane'] || row['cane'] || 'Normal';

            if (!plate_number) continue;

            const truckId = uuidv4();
            await setDoc(doc(db, 'trucks', truckId), {
              plate_number,
              driver_name,
              company,
              vehicle_type,
              cane_type,
              is_blacklisted: false,
              created_at: serverTimestamp()
            });
            successCount++;
          }

          setSuccess(`Successfully imported ${successCount} vehicles.`);
          fetchTrucks(); // Refresh list
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
          setError('Error importing vehicles.');
          console.error(err);
        }
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const filteredTrucks = trucks.filter(truck => 
    truck.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintAll = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (filteredTrucks.length === 0) {
      setError('No data to export.');
      return;
    }

    const exportData = filteredTrucks.map(truck => ({
      'Plate Number': truck.plate_number || '',
      'Driver Name': truck.driver_name || '',
      'Company': truck.company || '',
      'Vehicle Type': truck.vehicle_type || '',
      'Cane Type': truck.cane_type || '',
      'Registered Date': truck.created_at?.toDate ? truck.created_at.toDate().toLocaleString() : ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'vehicles_export.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportQRZip = async () => {
    if (filteredTrucks.length === 0) {
      setError('No data to export.');
      return;
    }

    try {
      setSuccess('Generating ZIP file, please wait...');
      const zip = new JSZip();
      const folder = zip.folder("Vehicle_QRCodes");

      if (!folder) throw new Error("Could not create ZIP folder");

      for (const truck of filteredTrucks) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Generate QR code
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, truck.id, { width: 300, margin: 2 });

        // Draw QR code in center
        ctx.drawImage(qrCanvas, 50, 40);

        // Draw text
        ctx.textAlign = 'center';

        // Plate Number
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(truck.plate_number || 'Unknown', 200, 380);

        // Driver Name
        ctx.font = '24px sans-serif';
        ctx.fillText(truck.driver_name || 'Unknown', 200, 425);

        // Company
        ctx.fillStyle = '#666666';
        ctx.font = '20px sans-serif';
        ctx.fillText(truck.company || 'Unknown', 200, 460);

        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");

        const safePlate = (truck.plate_number || 'Unknown').replace(/[^a-z0-9]/gi, '_');
        const safeDriver = (truck.driver_name || 'Unknown').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safePlate}_${safeDriver}.png`;

        folder.file(fileName, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = "Vehicle_QRCodes.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccess('QR Codes exported successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to generate ZIP file.');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading vehicles...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Truck className="mr-3 h-6 w-6 text-indigo-600" />
          Registered Vehicles
        </h2>
        <div className="flex space-x-4">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleExportQRZip}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Archive className="w-4 h-4 mr-2" />
            Export QR (ZIP)
          </button>
          <button
            onClick={handlePrintAll}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print All QR Codes
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center print:hidden">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center print:hidden">
          <CheckCircle className="w-5 h-5 mr-2" />
          {success}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by plate number, driver, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Print View: Grid of QR Codes */}
      <div className="hidden print:block">
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-black">Vehicle QR Code Directory</h1>
          <p className="text-gray-600 mt-2">Generated on {new Date().toLocaleDateString()}</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {filteredTrucks.map(truck => (
            <div key={truck.id} className="flex flex-col items-center justify-center p-6 border-2 border-gray-400 rounded-xl break-inside-avoid mb-6">
              <QRCodeSVG value={truck.id} size={160} />
              <div className="mt-4 text-center w-full">
                <p className="font-bold text-2xl text-black border-b border-gray-200 pb-2 mb-2">{truck.plate_number}</p>
                <p className="text-lg text-gray-800 font-medium">{truck.driver_name}</p>
                <p className="text-sm text-gray-600">{truck.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Screen View: Table of Vehicles */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plate Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR Code</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTrucks.map((truck) => (
                <tr key={truck.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {truck.plate_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {truck.driver_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {truck.company}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {truck.vehicle_type} <br/>
                    <span className="text-xs text-gray-400">{truck.cane_type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="w-12 h-12 bg-gray-50 p-1 border border-gray-200 rounded">
                      <QRCodeSVG value={truck.id} size={40} />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTrucks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No vehicles found
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
