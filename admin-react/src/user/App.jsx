import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/context/AuthContext';
import { ToastProvider } from '../shared/components/Toast';
import Layout from '../shared/components/Layout';
import { STORAGE_KEYS, BRANDING, NAV_ITEMS } from './config';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expedientes from './pages/Expedientes';
import Documents from './pages/Documents';
import Tracking from './pages/Tracking';
import Messages from './pages/Messages';
import Payments from './pages/Payments';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

function UserLayout() {
  return <Layout navItems={NAV_ITEMS} branding={BRANDING} />;
}

function AppRoutes() {
  const { isAuth } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/expedientes" element={<Expedientes />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider storageKeys={STORAGE_KEYS}>
      <ToastProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
