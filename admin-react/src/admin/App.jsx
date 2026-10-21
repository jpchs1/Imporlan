import { useEffect, useState, lazy, Suspense, Component } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../shared/context/AuthContext';
import { ToastProvider, useToast } from '../shared/components/Toast';
import { SESSION_EXPIRED_EVENT } from '../shared/lib/api-client';
import Layout from '../shared/components/Layout';
import NotificationBell from '../shared/components/NotificationBell';
import { IconButton, Skeleton, ErrorState } from '../shared/components/UI';
import { Search } from '../shared/components/Icons';
import CommandPalette, { CommandPaletteTrigger, useCommandPalette, ATAJO } from './components/CommandPalette';
import {
  getUnreadCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getChatUnreadCount,
} from './api';
import { STORAGE_KEYS, BRANDING, navItemsFor, homePathFor } from './config';
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

import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Plans = lazy(() => import('./pages/Plans'));
const Payments = lazy(() => import('./pages/Payments'));
const Orders = lazy(() => import('./pages/Orders'));
const Inspections = lazy(() => import('./pages/Inspections'));
const Leads = lazy(() => import('./pages/Leads'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Config = lazy(() => import('./pages/Config'));
const Security = lazy(() => import('./pages/Security'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));

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
function useChatUnread(activo = true) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    let alive = true;
    const tick = () => {
      if (document.hidden) return;
      getChatUnreadCount().then(r => { if (alive) setN(Number(r?.unread_count ?? r?.count ?? 0)); }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [activo]);
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
  // El agente (operación en EE. UU.) no tiene chat: no habla con clientes.
  const chatUnread = useChatUnread(user?.role !== 'agent');
  const navItems = navItemsFor(user?.role);
  // Paleta de comandos (⌘K / Ctrl K): buscador en el topbar en escritorio,
  // ícono en móvil; solo navega a las secciones que el rol puede ver.
  const paleta = useCommandPalette();
  return (
    <>
      <Layout
        navItems={navItems}
        badges={{ '/chat': chatUnread }}
        branding={BRANDING}
        profilePath="/profile"
        search={<CommandPaletteTrigger onClick={paleta.show} />}
        headerExtra={
          <>
            <IconButton icon={Search} aria-label={`Buscar (${ATAJO})`} onClick={paleta.show} className="md:hidden" />
            <NotificationBell
              getUnreadCount={getUnreadCount}
              getNotifications={getNotifications}
              markRead={markNotificationRead}
              markAllRead={markAllNotificationsRead}
              viewAllPath="/orders"
              viewAllLabel="Ir a Expedientes"
            />
          </>
        }
      />
      <CommandPalette open={paleta.open} onClose={paleta.hide} sections={navItems} />
    </>
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
        <Route path="/dashboard" element={guard('/dashboard', conCarga(<Dashboard />))} />
        <Route path="/users" element={guard('/users', conCarga(<Users />))} />
        <Route path="/purchases" element={guard('/purchases', conCarga(<Purchases />))} />
        <Route path="/plans" element={guard('/plans', conCarga(<Plans />))} />
        <Route path="/payments" element={guard('/payments', conCarga(<Payments />))} />
        <Route path="/orders" element={guard('/orders', conCarga(<Orders />))} />
        <Route path="/inspections" element={guard('/inspections', conCarga(<Inspections />))} />
        <Route path="/leads" element={guard('/leads', conCarga(<Leads />))} />
        <Route path="/tracking" element={guard('/tracking', conCarga(<Tracking />))} />
        <Route path="/marketplace" element={guard('/marketplace', conCarga(<Marketplace />))} />
        <Route path="/config" element={guard('/config', conCarga(<Config />))} />
        <Route path="/security" element={guard('/security', conCarga(<Security />))} />
        <Route path="/chat" element={guard('/chat', conCarga(<Chat />))} />
        <Route path="/profile" element={conCarga(<Profile />)} />
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
