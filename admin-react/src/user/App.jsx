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
        {/* Placeholder routes - pages to be built in future phases */}
        <Route path="/expedientes" element={<Expedientes />} />
        <Route path="/marketplace" element={<ComingSoon label="Marketplace" />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/messages" element={<ComingSoon label="Mensajes" />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/payments" element={<ComingSoon label="Pagos" />} />
        <Route path="/profile" element={<ComingSoon label="Mi Perfil" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-slate-700">{label}</h2>
      <p className="text-sm text-slate-400 mt-1">Esta seccion estara disponible pronto.</p>
    </div>
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
