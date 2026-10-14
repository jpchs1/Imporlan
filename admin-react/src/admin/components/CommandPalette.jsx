import { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getOrders, getUsers, getPurchases } from '../api';
import { cn, fmtCLP } from '../../shared/lib/utils';
import { useFocusTrap, useScrollLock } from '../../shared/lib/focus';
import { StatusBadge } from '../../shared/components/UI';
import { Search, FolderOpen, Users, ShoppingCart, CornerDownLeft, Loader, ArrowRight } from '../../shared/components/Icons';

/* ---------------------------------------------------------------------------
   Datos: carga perezosa al abrir, caché de 60 s compartida entre aperturas.
   Solo lectura: getOrders / getUsers / getPurchases de admin/api.js.
   --------------------------------------------------------------------------- */
const CACHE_MS = 60_000;
const cache = { at: 0, key: '', data: null, promise: null };

async function cargarDatos(permisos) {
  const key = ['orders', 'users', 'purchases'].filter(k => permisos[k]).join(',');
  const fresco = cache.data && cache.key === key && Date.now() - cache.at < CACHE_MS;
  if (fresco) return cache.data;
  if (cache.promise && cache.key === key) return cache.promise;
  cache.key = key;
  cache.promise = (async () => {
    const [o, u, p] = await Promise.all([
      permisos.orders ? getOrders().catch(() => null) : null,
      permisos.users ? getUsers().catch(() => null) : null,
      permisos.purchases ? getPurchases().catch(() => null) : null,
    ]);
    const data = {
      orders: o ? (o.orders || o.items || []) : [],
      users: u ? (u.items || u.users || []) : [],
      purchases: p ? (p.items || p.purchases || []) : [],
    };
    cache.data = data;
    cache.at = Date.now();
    cache.promise = null;
    return data;
  })();
  return cache.promise;
}

/* ---------------------------------------------------------------------------
   Búsqueda: sin tildes ni mayúsculas; cada palabra debe aparecer.
   --------------------------------------------------------------------------- */
function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function coincide(texto, palabras) {
  const t = normalizar(texto);
  return palabras.every(p => t.includes(p));
}

const MAX = { secciones: 8, orders: 7, users: 6, purchases: 6 };

function construirResultados({ q, secciones, data, permisos }) {
  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  const grupos = [];

  const secs = palabras.length
    ? secciones.filter(s => coincide(s.label, palabras))
    : secciones;
  if (secs.length) {
    grupos.push({
      id: 'secciones',
      label: palabras.length ? 'Secciones' : 'Ir a',
      items: secs.slice(0, MAX.secciones).map(s => ({
        id: `sec-${s.to}`,
        icon: s.icon || ArrowRight,
        title: s.label,
        to: s.to,
        kind: 'seccion',
      })),
    });
  }

  if (!palabras.length || !data) return grupos;

  if (permisos.orders) {
    const hits = data.orders.filter(o => coincide(
      `${o.order_number} ${o.customer_name} ${o.customer_email} ${o.asset_name} ${o.plan_name} ${o.requirement_name}`,
      palabras,
    )).slice(0, MAX.orders);
    if (hits.length) {
      grupos.push({
        id: 'orders',
        label: 'Expedientes',
        items: hits.map(o => ({
          id: `ord-${o.id ?? o.order_number}`,
          icon: FolderOpen,
          title: o.order_number || `Expediente ${o.id}`,
          subtitle: [o.customer_name, o.asset_name || o.plan_name].filter(Boolean).join(' · '),
          meta: <StatusBadge kind="expediente" status={o.status} size="sm" />,
          to: o.id ? `/orders?id=${encodeURIComponent(o.id)}` : `/orders?new=${encodeURIComponent(o.order_number || '')}`,
          kind: 'expediente',
        })),
      });
    }
  }

  if (permisos.users) {
    const hits = data.users.filter(u => coincide(`${u.name} ${u.email} ${u.phone}`, palabras)).slice(0, MAX.users);
    if (hits.length) {
      grupos.push({
        id: 'users',
        label: 'Clientes',
        items: hits.map(u => ({
          id: `usr-${u.email}`,
          icon: Users,
          title: u.name || u.email,
          subtitle: u.name ? u.email : (u.phone || ''),
          to: `/users?email=${encodeURIComponent(u.email || '')}`,
          kind: 'cliente',
        })),
      });
    }
  }

  if (permisos.purchases) {
    const hits = data.purchases.filter(p => coincide(
      `${p.purchase_id} ${p.payer_name} ${p.user_email} ${p.description} ${p.plan_name} ${p.payment_id} ${p.order_id}`,
      palabras,
    )).slice(0, MAX.purchases);
    if (hits.length) {
      grupos.push({
        id: 'purchases',
        label: 'Compras',
        items: hits.map(p => ({
          id: `pur-${p.purchase_id}`,
          icon: ShoppingCart,
          title: p.purchase_id,
          subtitle: [p.payer_name || p.user_email, p.description || p.plan_name].filter(Boolean).join(' · '),
          meta: (
            <span className="flex items-center gap-2">
              <span className="text-13 text-ink-700 tabular">{fmtCLP(p.amount_clp)}</span>
              <StatusBadge kind="compra" status={p.status} size="sm" />
            </span>
          ),
          to: `/purchases?id=${encodeURIComponent(p.purchase_id || '')}`,
          kind: 'compra',
        })),
      });
    }
  }

  return grupos;
}

/* ---------------------------------------------------------------------------
   Atajo: ⌘K en Mac, Ctrl K en el resto.
   --------------------------------------------------------------------------- */
// eslint-disable-next-line react-refresh/only-export-components
export function esMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

// eslint-disable-next-line react-refresh/only-export-components
export const ATAJO = esMac() ? '⌘K' : 'Ctrl K';

/** Hook: estado abierto/cerrado + atajo global de teclado. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  return { open, show, hide };
}

/**
 * Botón del topbar con aspecto de buscador (se enchufa en `search` del Layout).
 *   <CommandPaletteTrigger onClick={show} />
 */
export function CommandPaletteTrigger({ onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-keyshortcuts={esMac() ? 'Meta+K' : 'Control+K'}
      className={cn(
        'w-full h-9 flex items-center gap-2 pl-3 pr-2 rounded-md border border-line-strong bg-surface text-sm text-ink-500',
        'hover:border-ink-400 hover:text-ink-700 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
    >
      <Search size={16} className="shrink-0" />
      <span className="flex-1 text-left truncate">Buscar o ir a…</span>
      <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-line bg-canvas text-xs text-ink-500 font-sans">{ATAJO}</kbd>
    </button>
  );
}

/* ---------------------------------------------------------------------------
   La paleta
   --------------------------------------------------------------------------- */
/**
 * Paleta de comandos del admin (⌘K / Ctrl K).
 *   <CommandPalette open={open} onClose={hide} sections={navItemsFor(user.role)} />
 * Busca expedientes (número, cliente, correo), clientes (nombre, correo) y
 * compras (ID, pagador) sobre los datos del admin, y navega a cualquier
 * sección permitida para el rol. Teclado completo; role="combobox".
 */
export default function CommandPalette({ open, onClose, sections = [] }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);

  const permisos = useMemo(() => ({
    orders: sections.some(s => s.to === '/orders'),
    users: sections.some(s => s.to === '/users'),
    purchases: sections.some(s => s.to === '/purchases'),
  }), [sections]);

  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocusRef: inputRef });
  useScrollLock(open);

  // Carga perezosa: solo cuando se abre y hay algo que buscar.
  useEffect(() => {
    if (!open) return;
    if (!permisos.orders && !permisos.users && !permisos.purchases) return;
    let alive = true;
    const t = setTimeout(() => { if (alive) setCargando(true); }, 0);
    cargarDatos(permisos).then(d => {
      if (!alive) return;
      setData(d);
      setCargando(false);
    });
    return () => { alive = false; clearTimeout(t); };
  }, [open, permisos]);

  // Al cerrar se limpia la búsqueda para la próxima apertura.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => { setQ(''); setActivo(0); }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const grupos = useMemo(() => construirResultados({ q, secciones: sections, data, permisos }), [q, sections, data, permisos]);
  const planos = useMemo(() => grupos.flatMap(g => g.items), [grupos]);
  const idx = Math.min(activo, Math.max(0, planos.length - 1));
  const activoId = planos[idx] ? `${id}-opt-${planos[idx].id}` : undefined;

  useEffect(() => {
    const el = listRef.current?.querySelector(`[id="${activoId}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activoId]);

  const ir = useCallback((item) => {
    if (!item) return;
    onClose?.();
    navigate(item.to);
  }, [navigate, onClose]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => (planos.length ? (i + 1) % planos.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => (planos.length ? (i - 1 + planos.length) % planos.length : 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setActivo(Math.max(0, planos.length - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); ir(planos[idx]); }
  }

  if (!open) return null;

  const listboxId = `${id}-list`;
  const hayBusqueda = q.trim().length > 0;
  const sinResultados = hayBusqueda && !cargando && planos.length === 0;
  const puedeBuscarDatos = permisos.orders || permisos.users || permisos.purchases;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end sm:items-start sm:justify-center sm:pt-[12vh] sm:px-6">
      <div className="absolute inset-0 bg-ink-900/60 ov-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar o ir a"
        className="relative flex flex-col w-full bg-surface shadow-modal outline-none h-dvh sm:h-auto sm:max-h-[70vh] sm:max-w-[40rem] sm:rounded-xl ov-up sm:ov-pop"
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line shrink-0">
          {cargando ? <Loader size={18} className="text-ink-500 spin shrink-0" aria-hidden="true" /> : <Search size={18} className="text-ink-500 shrink-0" aria-hidden="true" />}
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activoId}
            aria-autocomplete="list"
            aria-label="Buscar expediente, cliente, compra o sección"
            autoComplete="off"
            spellCheck={false}
            placeholder={puedeBuscarDatos ? 'Expediente, cliente, compra o sección…' : 'Ir a una sección…'}
            value={q}
            onChange={e => { setQ(e.target.value); setActivo(0); }}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-0 h-full bg-transparent text-base sm:text-sm text-ink-900 placeholder:text-ink-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center h-6 px-1.5 rounded border border-line bg-canvas text-xs text-ink-500 font-sans">esc</kbd>
          <button type="button" onClick={onClose} className="sm:hidden text-sm font-medium text-brand-600 px-1">Cerrar</button>
        </div>

        <div ref={listRef} id={listboxId} role="listbox" aria-label="Resultados" className="flex-1 overflow-y-auto overscroll-contain py-2 scrollbar-thin">
          {grupos.map(g => (
            <div key={g.id} role="group" aria-labelledby={`${id}-g-${g.id}`} className="px-2 pb-1">
              <p id={`${id}-g-${g.id}`} className="eyebrow px-2 pt-2 pb-1">{g.label}</p>
              {g.items.map(item => {
                const i = planos.indexOf(item);
                const sel = i === idx;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    id={`${id}-opt-${item.id}`}
                    role="option"
                    aria-selected={sel}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => ir(item)}
                    className={cn(
                      'flex items-center gap-3 px-2 h-11 sm:h-10 rounded-md cursor-pointer text-sm',
                      sel ? 'bg-brand-50 text-ink-900' : 'text-ink-700',
                    )}
                  >
                    <span className={cn('h-7 w-7 rounded-md flex items-center justify-center shrink-0', sel ? 'bg-brand-100 text-brand-700' : 'bg-neutral-bg text-ink-500')} aria-hidden="true">
                      {Icon && <Icon size={16} />}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="font-medium truncate sm:shrink-0">{item.title}</span>
                      {item.subtitle && <span className="text-13 text-ink-500 truncate">{item.subtitle}</span>}
                    </span>
                    {item.meta && <span className="shrink-0 hidden sm:flex">{item.meta}</span>}
                    {sel && <CornerDownLeft size={14} className="text-ink-400 shrink-0 hidden sm:block" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}

          {sinResultados && (
            <p className="px-4 py-8 text-center text-sm text-ink-500">
              Sin resultados para «{q.trim()}».
              {puedeSugerir(permisos)}
            </p>
          )}
          {hayBusqueda && cargando && planos.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-500" aria-live="polite">Cargando expedientes, clientes y compras…</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-4 h-10 border-t border-line bg-canvas rounded-b-xl text-xs text-ink-500 shrink-0">
          <span><kbd className="font-sans">↑↓</kbd> moverse</span>
          <span><kbd className="font-sans">↵</kbd> abrir</span>
          <span><kbd className="font-sans">esc</kbd> cerrar</span>
          <span className="ml-auto tabular" aria-live="polite">{hayBusqueda ? `${planos.length} resultado${planos.length === 1 ? '' : 's'}` : ATAJO}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function puedeSugerir(permisos) {
  const partes = [];
  if (permisos.orders) partes.push('un número de expediente (IMP-00035)');
  if (permisos.users) partes.push('el correo de un cliente');
  if (permisos.purchases) partes.push('el ID de una compra');
  if (!partes.length) return null;
  return <span className="block mt-1 text-13">Prueba con {partes.join(', ')} o el nombre de una sección.</span>;
}
