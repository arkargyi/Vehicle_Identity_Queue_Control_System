import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Truck, LogIn, LogOut as LogOutIcon, BarChart3, Settings, Users, List, History as HistoryIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'queue_manager', 'normal_user'] },
    { name: 'Register Truck', path: '/register', icon: Truck, roles: ['super_admin', 'admin', 'queue_manager'] },
    { name: 'Vehicles List', path: '/vehicles', icon: List, roles: ['super_admin', 'admin', 'queue_manager'] },
    { name: 'Gate Entry', path: '/entry', icon: LogIn, roles: ['super_admin', 'admin', 'normal_user'] },
    { name: 'Operator Panel', path: '/operator', icon: Settings, roles: ['super_admin', 'admin', 'queue_manager'] },
    { name: 'Gate Exit', path: '/exit', icon: LogOutIcon, roles: ['super_admin', 'admin', 'normal_user'] },
    { name: 'History', path: '/history', icon: HistoryIcon, roles: ['super_admin', 'admin', 'queue_manager'] },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['super_admin', 'admin'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['super_admin', 'admin'] },
    { name: 'User Management', path: '/users', icon: Users, roles: ['super_admin'] },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100 print:block print:bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col shrink-0 print:hidden">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">Vehicle Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Role: {user?.role.replace('_', ' ')}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => item.roles.includes(user?.role || '')).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-indigo-700" : "text-gray-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 print:block">
        <header className="bg-white shadow-sm shrink-0 print:hidden">
          <div className="px-8 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{user?.username}</span>
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                {user?.username.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        <main className="p-8 flex-1 overflow-auto print:p-0 print:overflow-visible print:block">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
