import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import ChatWidget from './components/ChatWidget';
import PostPaymentPopup from './components/PostPaymentPopup';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
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
