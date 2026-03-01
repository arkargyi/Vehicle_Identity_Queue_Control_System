import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Truck, Clock, CheckCircle } from 'lucide-react';

export default function Analytics() {
  const [analytics, setAnalytics] = useState<any>({});
  const [trucks, setTrucks] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [aRes, tRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/trucks')
      ]);
      setAnalytics(await aRes.json());
      setTrucks(await tRes.json());
    };
    fetchData();
  }, []);

  const chartData = [
    { name: 'Mon', completed: 12 },
    { name: 'Tue', completed: 19 },
    { name: 'Wed', completed: 15 },
    { name: 'Thu', completed: 22 },
    { name: 'Fri', completed: 28 },
    { name: 'Sat', completed: 10 },
    { name: 'Sun', completed: 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Registered Trucks</p>
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
              <p className="text-sm font-medium text-gray-500">Avg Wait Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.avgWaitTime || 0}m</p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Weekly Throughput</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="completed" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Registrations</h3>
          <div className="overflow-auto h-80">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trucks.slice(0, 10).map((truck) => (
                  <tr key={truck.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{truck.plate_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{truck.company}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{truck.vehicle_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
