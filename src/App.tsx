import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import TruckRegistration from './pages/TruckRegistration';
import GateEntry from './pages/GateEntry';
import OperatorPanel from './pages/OperatorPanel';
import GateExit from './pages/GateExit';
import Analytics from './pages/Analytics';
import History from './pages/History';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Vehicles from './pages/Vehicles';
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
          <Route path="/signup" element={<SignUp />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="register" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'queue_manager']}>
                <TruckRegistration />
              </ProtectedRoute>
            } />
            <Route path="vehicles" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'queue_manager']}>
                <Vehicles />
              </ProtectedRoute>
            } />
            <Route path="entry" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'normal_user']}>
                <GateEntry />
              </ProtectedRoute>
            } />
            <Route path="operator" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'queue_manager']}>
                <OperatorPanel />
              </ProtectedRoute>
            } />
            <Route path="exit" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'normal_user']}>
                <GateExit />
              </ProtectedRoute>
            } />
            <Route path="history" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin', 'queue_manager']}>
                <History />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="users" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
