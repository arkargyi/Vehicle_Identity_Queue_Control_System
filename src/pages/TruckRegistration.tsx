import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, CheckCircle, Upload, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TruckRegistration() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    plate_number: '',
    driver_name: '',
    company: '',
    vehicle_type: 'Trailer',
    cane_type: ''
  });
  const [registeredTruckId, setRegisteredTruckId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [caneTypes, setCaneTypes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.cane_types && data.cane_types.length > 0) {
          setCaneTypes(data.cane_types);
          setFormData(prev => ({ ...prev, cane_type: data.cane_types[0] }));
        }
      })
      .catch(err => console.error('Failed to fetch settings', err));
  }, []);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const plateRegex = /^[A-Z0-9-]{3,15}$/i;
    
    if (!plateRegex.test(formData.plate_number)) {
      errors.plate_number = 'Invalid format. Use 3-15 alphanumeric characters or hyphens.';
    }
    if (formData.driver_name.length > 50) {
      errors.driver_name = 'Driver name must be less than 50 characters.';
    }
    if (formData.company.length > 100) {
      errors.company = 'Company name must be less than 100 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateForm()) return;

    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setRegisteredTruckId(data.id);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to register truck');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header row if exists, assuming format: plate_number,driver_name,company,vehicle_type,cane_type
        const startIndex = lines[0].toLowerCase().includes('plate') ? 1 : 0;
        
        const trucks = lines.slice(startIndex).map(line => {
          const [plate_number, driver_name, company, vehicle_type, cane_type] = line.split(',').map(s => s.trim());
          return {
            plate_number,
            driver_name: driver_name || 'Unknown',
            company: company || 'Unknown',
            vehicle_type: vehicle_type || 'Trailer',
            cane_type: cane_type || 'Normal'
          };
        }).filter(t => t.plate_number);

        if (trucks.length === 0) {
          setError('No valid truck data found in CSV.');
          return;
        }

        const res = await fetch('/api/trucks/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trucks })
        });
        
        const data = await res.json();
        if (data.success) {
          const successCount = data.results.filter((r: any) => r.success).length;
          setSuccess(`Successfully registered ${successCount} out of ${trucks.length} trucks.`);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          setError(data.message || 'Bulk upload failed');
        }
      } catch (err) {
        setError('Error parsing CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handlePrint = () => {
    window.print();
  };

  if (registeredTruckId) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Truck Registered Successfully</h2>
        <p className="text-gray-500 mb-8">Please print or save this QR code for the driver.</p>
        
        <div className="bg-gray-50 p-8 rounded-xl inline-block mb-8 border border-gray-200 print:border-none print:shadow-none">
          <QRCodeSVG value={registeredTruckId} size={200} />
          <p className="mt-4 font-mono text-sm text-gray-600">{formData.plate_number}</p>
        </div>

        <div className="flex justify-center space-x-4 print:hidden">
          <button
            onClick={() => {
              setRegisteredTruckId(null);
              setFormData({ ...formData, plate_number: '', driver_name: '' });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Register Another
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print QR Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Register New Truck</h2>
        {user?.role === 'admin' && (
          <div>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload CSV
            </button>
          </div>
        )}
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number</label>
            <input
              type="text"
              name="plate_number"
              required
              value={formData.plate_number}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${fieldErrors.plate_number ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="e.g. ABC-1234"
            />
            {fieldErrors.plate_number && <p className="mt-1 text-xs text-red-500">{fieldErrors.plate_number}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
            <input
              type="text"
              name="driver_name"
              required
              value={formData.driver_name}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${fieldErrors.driver_name ? 'border-red-300' : 'border-gray-300'}`}
            />
            {fieldErrors.driver_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.driver_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Supplier</label>
            <input
              type="text"
              name="company"
              required
              value={formData.company}
              onChange={handleInputChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${fieldErrors.company ? 'border-red-300' : 'border-gray-300'}`}
            />
            {fieldErrors.company && <p className="mt-1 text-xs text-red-500">{fieldErrors.company}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <select
              name="vehicle_type"
              value={formData.vehicle_type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option>Trailer</option>
              <option>Lorry</option>
              <option>Van</option>
              <option>Pickup</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cane Type</label>
            <select
              name="cane_type"
              value={formData.cane_type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {caneTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            Register Truck & Generate QR
          </button>
        </div>
      </form>
    </div>
  );
}
