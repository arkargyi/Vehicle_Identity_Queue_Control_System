import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TruckRegistration from './pages/TruckRegistration';
import GateEntry from './pages/GateEntry';
import OperatorPanel from './pages/OperatorPanel';
import GateExit from './pages/GateExit';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="register" element={
              <ProtectedRoute allowedRoles={['admin', 'operator']}>
                <TruckRegistration />
              </ProtectedRoute>
            } />
            <Route path="entry" element={
              <ProtectedRoute allowedRoles={['admin', 'security']}>
                <GateEntry />
              </ProtectedRoute>
            } />
            <Route path="operator" element={
              <ProtectedRoute allowedRoles={['admin', 'operator']}>
                <OperatorPanel />
              </ProtectedRoute>
            } />
            <Route path="exit" element={
              <ProtectedRoute allowedRoles={['admin', 'security']}>
                <GateExit />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute allowedRoles={['admin', 'viewer']}>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
