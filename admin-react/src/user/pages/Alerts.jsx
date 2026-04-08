import { useState, useEffect, useCallback } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} hr${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} dia${days > 1 ? 's' : ''}`;
  return fmtDate(dateStr);
}

export default function Alerts() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications(50);
      setNotifications(data.notifications || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      toast?.('Todas marcadas como leidas', 'success');
    } catch { toast?.('Error al marcar', 'error'); }
  }

  const unread = notifications.filter(n => !n.read_at).length;
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle={unread > 0 ? `${unread} sin leer` : 'Todas leidas'}
        action={unread > 0 && <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>Marcar todas como leidas</Button>}
      />

      {notifications.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <p className="text-slate-500 font-medium">No tienes alertas</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card
              key={n.id}
              className={cn('cursor-pointer transition-all py-4', !n.read_at && 'border-l-4 border-l-cyan-500 bg-cyan-50/30')}
              onClick={() => { if (!n.read_at) handleMarkRead(n.id); if (n.link) window.open(n.link, '_blank'); }}
            >
              <div className="flex items-start gap-3">
                <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', n.read_at ? 'bg-slate-200' : 'bg-cyan-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', n.read_at ? 'text-slate-600' : 'font-semibold text-slate-800')}>{n.title}</p>
                    <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.message}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
