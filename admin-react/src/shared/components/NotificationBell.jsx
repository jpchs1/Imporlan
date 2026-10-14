import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { fmtRelativo, fmtDateLarga } from '../lib/format';
import { useClickOutside } from '../lib/focus';
import { Bell, FileText, CreditCard, MessageCircle, Info, X } from './Icons';
import { IconButton } from './Button';
import { Spinner } from './Skeleton';

const ICON_BY_TYPE = { report: FileText, payment: CreditCard, message: MessageCircle, chat: MessageCircle };

/**
 * Campana de notificaciones (popover). Misma firma que antes:
 * getUnreadCount · getNotifications(limit) · markRead(id) · markAllRead ·
 * viewAllPath · viewAllLabel · pollMs.
 */
export default function NotificationBell({
  getUnreadCount,
  getNotifications,
  markRead,
  markAllRead,
  viewAllPath = '/alerts',
  viewAllLabel = 'Ver todas las notificaciones',
  pollMs = 30000,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastCountRef = useRef(0);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const id = useId();

  const refreshCount = useCallback(async () => {
    if (document.hidden) return;
    try {
      const data = await getUnreadCount();
      const n = Number(data?.unread_count ?? data?.count ?? 0);
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
        } catch { /* el sonido es opcional */ }
      }
      lastCountRef.current = n;
      setCount(n);
    } catch { /* silencioso */ }
  }, [getUnreadCount]);

  useEffect(() => {
    const t0 = setTimeout(refreshCount, 0);
    const t = setInterval(refreshCount, pollMs);
    document.addEventListener('visibilitychange', refreshCount);
    return () => { clearTimeout(t0); clearInterval(t); document.removeEventListener('visibilitychange', refreshCount); };
  }, [refreshCount, pollMs]);

  useClickOutside(wrapRef, open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
      try { await markRead(n.id); } catch { /* silencioso */ }
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      setCount(c => Math.max(0, c - 1));
    }
    if (n.link) {
      // Enlaces a este mismo panel (…/#/ruta) se abren aquí, no en otra pestaña.
      const hash = n.link.indexOf('#/');
      const samePanel = hash >= 0 && n.link.slice(0, hash).replace(/^https?:\/\/[^/]+/, '') === window.location.pathname;
      setOpen(false);
      if (samePanel) navigate(n.link.slice(hash + 1));
      else window.open(n.link, '_blank', 'noopener');
    }
  }

  async function handleMarkAll(e) {
    e.stopPropagation();
    try {
      await markAllRead();
      setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setCount(0);
    } catch { /* silencioso */ }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
        title="Notificaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cn('relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-700 hover:bg-neutral-bg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500', open && 'bg-neutral-bg')}
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-xs font-semibold tabular flex items-center justify-center leading-none ring-2 ring-surface" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-surface rounded-lg shadow-pop border border-line overflow-hidden z-popover ov-pop"
        >
          <div className="px-4 h-12 flex items-center justify-between gap-3 border-b border-line">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-sm font-semibold text-ink-900">Notificaciones</h2>
              <span className="text-xs text-ink-500 tabular">{count > 0 ? `${count} sin leer` : 'Al día'}</span>
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button type="button" onClick={handleMarkAll} className="text-13 font-medium text-brand-600 hover:text-brand-700 px-1.5 h-7 rounded hover:bg-neutral-bg">
                  Marcar todas
                </button>
              )}
              <IconButton icon={X} size="sm" aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} className="lg:hidden" />
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto overscroll-contain">
            {loading ? (
              <Spinner size="sm" label="Cargando…" className="py-8" />
            ) : items.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell size={24} className="mx-auto mb-2 text-ink-400" />
                <p className="text-sm text-ink-500">No tienes notificaciones</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map(n => {
                  const I = ICON_BY_TYPE[n.type] || Info;
                  const unread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleClickItem(n)}
                        className={cn('w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500', unread && 'bg-brand-50/60')}
                      >
                        <span className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0', unread ? 'bg-brand-100 text-brand-700' : 'bg-neutral-bg text-ink-500')}>
                          <I size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-start justify-between gap-3">
                            <span className={cn('text-sm leading-5 block', unread ? 'font-semibold text-ink-900' : 'text-ink-700')}>{n.title}</span>
                            <time dateTime={n.created_at} title={fmtDateLarga(n.created_at, { hora: true })} className="text-xs text-ink-500 shrink-0 mt-0.5 tabular whitespace-nowrap">{fmtRelativo(n.created_at)}</time>
                          </span>
                          {n.message && <span className="block text-13 text-ink-500 mt-0.5 line-clamp-2">{n.message}</span>}
                        </span>
                        {unread && <span className="mt-2 h-2 w-2 rounded-full bg-brand-600 shrink-0" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); navigate(viewAllPath); }}
            className="w-full h-11 px-4 text-center text-13 font-medium text-brand-600 hover:text-brand-700 hover:bg-canvas border-t border-line transition-colors duration-150"
          >
            {viewAllLabel}
          </button>
        </div>
      )}
    </div>
  );
}
