import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

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
  return new Date(dateStr).toLocaleDateString('es-CL');
}

export default function NotificationBell({
  getUnreadCount,
  getNotifications,
  markRead,
  markAllRead,
  viewAllPath = '/alerts',
  pollMs = 30000,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastCountRef = useRef(0);
  const wrapRef = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      const n = Number(data?.unread_count || 0);
      if (n > lastCountRef.current && lastCountRef.current > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
          o.start(); o.stop(ctx.currentTime + 0.3);
        } catch { /* sound optional */ }
      }
      lastCountRef.current = n;
      setCount(n);
    } catch { /* silent */ }
  }, [getUnreadCount]);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, pollMs);
    return () => clearInterval(id);
  }, [refreshCount, pollMs]);

  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await getNotifications(20);
      setItems(data?.notifications || []);
    } catch { setItems([]); }
    setLoading(false);
  }

  async function handleClickItem(n) {
    if (!n.read_at) {
      try { await markRead(n.id); } catch { /* silent */ }
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      setCount(c => Math.max(0, c - 1));
    }
    if (n.link) window.open(n.link, '_blank');
  }

  async function handleMarkAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setCount(0);
    } catch { /* silent */ }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title="Notificaciones"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-50 animate-fade-in">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-[11px] text-slate-400">{count > 0 ? `${count} sin leer` : 'Todas leidas'}</p>
            </div>
            {count > 0 && (
              <button onClick={handleMarkAll} className="text-[11px] text-cyan-300 hover:text-cyan-200 font-medium">
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <svg className="w-10 h-10 mx-auto mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <p className="text-sm text-slate-500">No tienes notificaciones</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map(n => (
                  <li
                    key={n.id}
                    onClick={() => handleClickItem(n)}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors',
                      n.read_at ? 'hover:bg-slate-50' : 'bg-cyan-50/40 border-l-4 border-l-cyan-500 hover:bg-cyan-50/70'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        n.type === 'report' ? 'bg-violet-100' : 'bg-cyan-100'
                      )}>
                        {n.type === 'report' ? (
                          <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-[13px] leading-snug', n.read_at ? 'text-slate-600' : 'font-semibold text-slate-800')}>{n.title}</p>
                          <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                        {n.message && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); navigate(viewAllPath); }}
            className="w-full px-4 py-2.5 text-center text-xs font-semibold text-cyan-600 hover:text-cyan-700 hover:bg-slate-50 border-t border-slate-100 transition-colors"
          >
            Ver todas las notificaciones
          </button>
        </div>
      )}
    </div>
  );
}
