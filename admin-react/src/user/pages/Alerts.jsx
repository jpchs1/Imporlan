import { useState, useEffect, useCallback, useMemo } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { Card, Button } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} hr${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} dia${days > 1 ? 's' : ''}`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return fmtDate(dateStr);
}

function fullDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return fmtDate(dateStr); }
}

const TYPE_META = {
  report: {
    label: 'Reporte',
    accent: 'violet',
    bg: 'bg-violet-100',
    text: 'text-violet-600',
    chip: 'bg-violet-50 text-violet-700 ring-violet-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  document: {
    label: 'Documento',
    accent: 'cyan',
    bg: 'bg-cyan-100',
    text: 'text-cyan-600',
    chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>,
  },
  payment: {
    label: 'Pago',
    accent: 'amber',
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  },
  message: {
    label: 'Mensaje',
    accent: 'indigo',
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  },
  ranking: {
    label: 'Ranking',
    accent: 'emerald',
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>,
  },
  inspection: {
    label: 'Inspeccion',
    accent: 'teal',
    bg: 'bg-teal-100',
    text: 'text-teal-600',
    chip: 'bg-teal-50 text-teal-700 ring-teal-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
  },
  default: {
    label: 'Notificacion',
    accent: 'slate',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  },
};

function metaFor(type) {
  return TYPE_META[type] || TYPE_META.default;
}

function StatTile({ label, value, color, icon, active, onClick }) {
  const colors = {
    cyan: 'from-cyan-500/15 to-blue-500/10 text-cyan-600',
    rose: 'from-rose-500/15 to-red-500/10 text-rose-600',
    emerald: 'from-emerald-500/15 to-teal-500/10 text-emerald-600',
    violet: 'from-violet-500/15 to-purple-500/10 text-violet-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative bg-white border rounded-2xl p-4 text-left transition hover:shadow-sm hover:-translate-y-0.5',
        active ? 'border-cyan-300 ring-2 ring-cyan-200/60' : 'border-slate-200/70 hover:border-slate-300'
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2', colors[color])}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
    </button>
  );
}

export default function Alerts() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | read | <type>
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getNotifications(50);
      setNotifications(data.notifications || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(id, e) {
    if (e) e.stopPropagation();
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
  const read = notifications.length - unread;

  const typeCounts = useMemo(() => {
    const map = {};
    for (const n of notifications) {
      const t = n.type || 'default';
      map[t] = (map[t] || 0) + 1;
    }
    return map;
  }, [notifications]);

  const visibleTypes = useMemo(() => {
    const order = ['report', 'document', 'payment', 'message', 'ranking', 'inspection'];
    return order.filter(t => typeCounts[t]).concat(Object.keys(typeCounts).filter(t => !order.includes(t) && t !== 'default'));
  }, [typeCounts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notifications.filter(n => {
      if (filter === 'unread' && n.read_at) return false;
      if (filter === 'read' && !n.read_at) return false;
      if (!['all', 'unread', 'read'].includes(filter) && (n.type || 'default') !== filter) return false;
      if (term) {
        const hay = `${n.title || ''} ${n.message || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [notifications, filter, search]);

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className={cn('w-1.5 h-1.5 rounded-full', unread > 0 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400')} />
              {unread > 0 ? `${unread} sin leer` : 'Estas al dia'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alertas</h1>
            <p className="text-sm text-slate-300 mt-1.5">Novedades de tus expedientes, pagos y reportes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setLoading(true); load(); }} className="bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center gap-1.5">
              <svg className={cn('w-4 h-4', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Actualizar
            </Button>
            {unread > 0 && (
              <Button onClick={handleMarkAllRead} className="bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                Marcar todas
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Total"
          value={notifications.length}
          color="cyan"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>}
        />
        <StatTile
          label="Sin leer"
          value={unread}
          color="rose"
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatTile
          label="Leidas"
          value={read}
          color="emerald"
          active={filter === 'read'}
          onClick={() => setFilter('read')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatTile
          label="Reportes"
          value={typeCounts.report || 0}
          color="violet"
          active={filter === 'report'}
          onClick={() => setFilter(filter === 'report' ? 'all' : 'report')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
      </div>

      {/* Toolbar */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en alertas..."
              className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label="Limpiar">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: 'all', label: 'Todas', count: notifications.length },
              { v: 'unread', label: 'Sin leer', count: unread },
              { v: 'read', label: 'Leidas', count: read },
            ].map(t => (
              <button
                key={t.v}
                onClick={() => setFilter(t.v)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
                  filter === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                )}
              >
                {t.label}
                <span className={cn('text-[10px] tabular-nums', filter === t.v ? 'text-white/80' : 'text-slate-400')}>{t.count}</span>
              </button>
            ))}
            {visibleTypes.map(t => {
              const m = metaFor(t);
              const isActive = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(isActive ? 'all' : t)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
                    isActive ? cn(m.chip, 'ring-1 border-transparent') : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? m.text.replace('text-', 'bg-') : 'bg-slate-300')} />
                  {m.label}
                  <span className={cn('text-[10px] tabular-nums', isActive ? '' : 'text-slate-400')}>{typeCounts[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          </div>
          {notifications.length === 0 ? (
            <>
              <p className="text-slate-700 font-semibold">Estas al dia</p>
              <p className="text-sm text-slate-400 mt-1">Cuando haya novedades en tus expedientes, te avisaremos aqui.</p>
            </>
          ) : (
            <>
              <p className="text-slate-700 font-semibold">Sin coincidencias</p>
              <p className="text-sm text-slate-400 mt-1">Probá cambiar el filtro o limpiar la búsqueda.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setFilter('all'); setSearch(''); }}>Limpiar filtros</Button>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const m = metaFor(n.type);
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                onClick={() => { if (isUnread) handleMarkRead(n.id); if (n.link) window.open(n.link, '_blank'); }}
                className={cn(
                  'group relative bg-white border rounded-2xl px-4 py-3.5 transition-all cursor-pointer',
                  isUnread
                    ? 'border-l-4 border-l-cyan-500 border-y border-r border-cyan-100 shadow-sm shadow-cyan-500/5 hover:shadow-md'
                    : 'border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', m.bg, m.text)}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1', m.chip)}>
                            {m.label}
                          </span>
                          {isUnread && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-700 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"/>Nuevo</span>}
                        </div>
                        <p className={cn('text-sm mt-1', isUnread ? 'font-semibold text-slate-800' : 'text-slate-700')}>{n.title}</p>
                        {n.message && <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>}
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap" title={fullDate(n.created_at)}>{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute right-3 bottom-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  {n.link && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-semibold">
                      Abrir
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </span>
                  )}
                  {isUnread && (
                    <button
                      onClick={(e) => handleMarkRead(n.id, e)}
                      className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-100"
                      title="Marcar como leida"
                    >
                      Marcar leida
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <p className="text-center text-[11px] text-slate-400 mt-6">
          {filtered.length} de {notifications.length} alertas mostradas · Las nuevas aparecen automaticamente cada 30 segundos
        </p>
      )}
    </div>
  );
}
