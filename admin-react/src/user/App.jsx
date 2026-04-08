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
import Inspections from './pages/Inspections';
import Imports from './pages/Imports';
import Plans from './pages/Plans';
import Quotation from './pages/Quotation';
import Alerts from './pages/Alerts';
import Support from './pages/Support';
import Deckeva from './pages/Deckeva';

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
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/expedientes" element={<Expedientes />} />
        <Route path="/imports" element={<Imports />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/quotation" element={<Quotation />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/deckeva" element={<Deckeva />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/support" element={<Support />} />
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
