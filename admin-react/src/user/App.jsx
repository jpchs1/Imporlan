import { useState, useEffect, useCallback, lazy, Suspense, Component } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/context/AuthContext';
import { ToastProvider } from '../shared/components/Toast';
import Layout from '../shared/components/Layout';
import NotificationBell from '../shared/components/NotificationBell';
import {
  getUnreadCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getMyConversations,
  getMyPaymentRequests,
} from './api';
import { STORAGE_KEYS, BRANDING, NAV_ITEMS, NAV_GROUPS } from './config';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
const Expedientes = lazy(() => import('./pages/Expedientes'));
const Documents = lazy(() => import('./pages/Documents'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Messages = lazy(() => import('./pages/Messages'));
const Payments = lazy(() => import('./pages/Payments'));
const Profile = lazy(() => import('./pages/Profile'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Inspections = lazy(() => import('./pages/Inspections'));
const Imports = lazy(() => import('./pages/Imports'));
const Plans = lazy(() => import('./pages/Plans'));
const Quotation = lazy(() => import('./pages/Quotation'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Support = lazy(() => import('./pages/Support'));
const Deckeva = lazy(() => import('./pages/Deckeva'));
import ChatWidget from './components/ChatWidget';
import { Skeleton, ErrorState } from '../shared/components/UI';
// Cada pantalla se descarga cuando se abre, no todas al entrar: el panel
// arranca con Inicio y lo demás llega en trozos chicos y cacheables.
function Cargando() {
  return <div className="p-6"><Skeleton.Detail /></div>;
}
// Si una pantalla no alcanza a descargarse (red mala, o un deploy justo en
// ese momento), en vez de quedar en blanco se ofrece recargar.
class FalloDeCarga extends Component {
  constructor(props) { super(props); this.state = { fallo: false }; }
  static getDerivedStateFromError() { return { fallo: true }; }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="p-6">
        <ErrorState
          title="No pudimos abrir esta sección"
          message="Puede ser la conexión. Recarga la página para intentarlo de nuevo."
          onRetry={() => window.location.reload()}
          retryLabel="Recargar"
        />
      </div>
    );
  }
}
const conCarga = (el) => <FalloDeCarga><Suspense fallback={<Cargando />}>{el}</Suspense></FalloDeCarga>;

import PostPaymentPopup from './components/PostPaymentPopup';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  const location = useLocation();
  // Igual que en el panel admin: recordamos el destino para no perderlo cuando
  // la sesion vence a mitad de camino o el cliente llega desde un correo.
  if (isAuth) return children;
  return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
}

function UserLayout() {
  const { isAuth } = useAuth();
  const [badges, setBadges] = useState({});

  const refreshBadges = useCallback(async () => {
    if (!isAuth) return;
    const next = {};
    const [convsRes, alertsRes, paysRes] = await Promise.allSettled([
      getMyConversations(),
      getUnreadCount(),
      getMyPaymentRequests('all'),
    ]);
    if (convsRes.status === 'fulfilled') {
      const list = convsRes.value?.conversations || [];
      const unread = list.reduce((s, c) => s + Number(c.unread_count || 0), 0);
      if (unread > 0) next['/messages'] = unread;
    }
    if (alertsRes.status === 'fulfilled') {
      const n = Number(alertsRes.value?.unread_count || 0);
      if (n > 0) next['/alerts'] = n;
    }
    if (paysRes.status === 'fulfilled') {
      const list = paysRes.value?.requests || paysRes.value?.items || [];
      const pending = list.filter(r => r.status === 'pending').length;
      if (pending > 0) next['/payments'] = pending;
    }
    setBadges(next);
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBadges();
    const id = setInterval(refreshBadges, 30000);
    return () => clearInterval(id);
  }, [isAuth, refreshBadges]);

  return (
    <>
      <Layout
        navItems={NAV_ITEMS}
        navGroups={NAV_GROUPS}
        branding={BRANDING}
        profilePath="/profile"
        badges={badges}
        headerExtra={
          <NotificationBell
            getUnreadCount={getUnreadCount}
            getNotifications={getNotifications}
            markRead={markNotificationRead}
            markAllRead={markAllNotificationsRead}
            viewAllPath="/alerts"
          />
        }
      />
      <ChatWidget />
      <PostPaymentPopup />
    </>
  );
}

function AppRoutes() {
  const { isAuth } = useAuth();
  const location = useLocation();
  const from = location.state?.from;
  const afterLogin = from && from !== '/login' ? from : '/dashboard';
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to={afterLogin} replace /> : <Login />} />
      <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tracking" element={conCarga(<Tracking />)} />
        <Route path="/expedientes" element={conCarga(<Expedientes />)} />
        <Route path="/imports" element={conCarga(<Imports />)} />
        <Route path="/documents" element={conCarga(<Documents />)} />
        <Route path="/inspections" element={conCarga(<Inspections />)} />
        <Route path="/quotation" element={conCarga(<Quotation />)} />
        <Route path="/marketplace" element={conCarga(<Marketplace />)} />
        <Route path="/plans" element={conCarga(<Plans />)} />
        <Route path="/deckeva" element={conCarga(<Deckeva />)} />
        <Route path="/payments" element={conCarga(<Payments />)} />
        <Route path="/messages" element={conCarga(<Messages />)} />
        <Route path="/alerts" element={conCarga(<Alerts />)} />
        <Route path="/support" element={conCarga(<Support />)} />
        <Route path="/profile" element={conCarga(<Profile />)} />
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
