import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/context/AuthContext';
import { ToastProvider, useToast } from '../shared/components/Toast';
import { SESSION_EXPIRED_EVENT } from '../shared/lib/api-client';
import Layout from '../shared/components/Layout';
import NotificationBell from '../shared/components/NotificationBell';
import {
  getUnreadCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getChatUnreadCount,
} from './api';
import { STORAGE_KEYS, BRANDING, navItemsFor, homePathFor } from './config';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Purchases from './pages/Purchases';
import Plans from './pages/Plans';
import Payments from './pages/Payments';
import Orders from './pages/Orders';
import Inspections from './pages/Inspections';
import Leads from './pages/Leads';
import Tracking from './pages/Tracking';
import Config from './pages/Config';
import Security from './pages/Security';
import Marketplace from './pages/Marketplace';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  const location = useLocation();
  // Guardamos a donde iba para devolverlo ahi despues del login: los correos
  // internos enlazan a #/orders y perder ese destino dejaba al admin en el
  // dashboard, lejos del expediente que venia a mirar.
  if (isAuth) return children;
  return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}

// Sólo deja entrar a pantallas permitidas para el rol; si no, a su inicio.
function RoleRoute({ path, children }) {
  const { user } = useAuth();
  const allowed = navItemsFor(user?.role).some(n => n.to === path);
  return allowed ? children : <Navigate to={homePathFor(user?.role)} replace />;
}

// Chats sin leer en el menú lateral (cada 30 s, sólo con la pestaña visible).
function useChatUnread() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (document.hidden) return;
      getChatUnreadCount().then(r => { if (alive) setN(Number(r?.unread_count ?? r?.count ?? 0)); }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return n;
}

// Avisa por qué se volvió al login cuando vence la sesión.
function SessionExpiredNotice() {
  const toast = useToast();
  useEffect(() => {
    const h = () => toast?.('Tu sesión expiró. Vuelve a ingresar.', 'warning');
    window.addEventListener(SESSION_EXPIRED_EVENT, h);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, h);
  }, [toast]);
  return null;
}

function AdminLayout() {
  const { user } = useAuth();
  const chatUnread = useChatUnread();
  return (
    <Layout
      navItems={navItemsFor(user?.role)}
      badges={{ '/chat': chatUnread }}
      branding={BRANDING}
      profilePath="/profile"
      headerExtra={
        <NotificationBell
          getUnreadCount={getUnreadCount}
          getNotifications={getNotifications}
          markRead={markNotificationRead}
          markAllRead={markAllNotificationsRead}
          viewAllPath="/orders"
          viewAllLabel="Ir a Expedientes"
        />
      }
    />
  );
}

function AppRoutes() {
  const { isAuth, user } = useAuth();
  const location = useLocation();
  const from = location.state?.from;
  const home = homePathFor(user?.role);
  const afterLogin = from && from !== '/login' ? from : home;
  const guard = (path, el) => <RoleRoute path={path}>{el}</RoleRoute>;
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to={afterLogin} replace /> : <Login />} />
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={guard('/dashboard', <Dashboard />)} />
        <Route path="/users" element={guard('/users', <Users />)} />
        <Route path="/purchases" element={guard('/purchases', <Purchases />)} />
        <Route path="/plans" element={guard('/plans', <Plans />)} />
        <Route path="/payments" element={guard('/payments', <Payments />)} />
        <Route path="/orders" element={guard('/orders', <Orders />)} />
        <Route path="/inspections" element={guard('/inspections', <Inspections />)} />
        <Route path="/leads" element={guard('/leads', <Leads />)} />
        <Route path="/tracking" element={guard('/tracking', <Tracking />)} />
        <Route path="/marketplace" element={guard('/marketplace', <Marketplace />)} />
        <Route path="/config" element={guard('/config', <Config />)} />
        <Route path="/security" element={guard('/security', <Security />)} />
        <Route path="/chat" element={guard('/chat', <Chat />)} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuth ? home : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider storageKeys={STORAGE_KEYS}>
      <ToastProvider>
        <SessionExpiredNotice />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
