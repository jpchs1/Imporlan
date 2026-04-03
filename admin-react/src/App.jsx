import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Purchases from './pages/Purchases';
import Plans from './pages/Plans';
import Payments from './pages/Payments';
import Orders from './pages/Orders';
import Inspections from './pages/Inspections';
import Tracking from './pages/Tracking';
import Content from './pages/Content';
import Config from './pages/Config';
import Security from './pages/Security';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuth } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/content" element={<Content />} />
        <Route path="/config" element={<Config />} />
        <Route path="/security" element={<Security />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
