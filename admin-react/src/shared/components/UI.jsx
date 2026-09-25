import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

export function Card({ children, className, ...props }) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 transition-all duration-300', className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide', className)}>
      {children}
    </span>
  );
}

export function Button({ children, variant = 'primary', size = 'md', className, ...props }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 shadow-md shadow-red-500/20',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
    accent: 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-700 hover:to-cyan-600 shadow-md shadow-cyan-500/20',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-sm' };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props}>{children}</button>;
}

export function Input({ label, className, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}
      <input className={cn("w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:shadow-sm outline-none transition-all duration-200 bg-white placeholder:text-slate-300", props.disabled && "bg-slate-50 text-slate-400 cursor-not-allowed")} {...props} />
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("bg-slate-100 rounded-xl animate-pulse", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function Select({ label, options, className, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}
      <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:shadow-sm outline-none bg-white transition-all duration-200 cursor-pointer" {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Textarea({ label, className, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}
      <textarea className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:shadow-sm outline-none transition-all duration-200 resize-y bg-white placeholder:text-slate-300" rows={3} {...props} />
    </div>
  );
}

/**
 * Tabla con orden por columna y paginación opcionales.
 * - Una columna es ordenable si trae `sortValue(row)` o `key`.
 * - `pageSize` (por defecto 50) pagina en el cliente; 0 la desactiva.
 */
export function Table({ columns, data, onRowClick, emptyMsg = 'Sin datos', pageSize = 50 }) {
  const [sort, setSort] = useState({ col: null, dir: 'desc' });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (sort.col === null) return data;
    const col = columns[sort.col];
    const get = col?.sortValue || (col?.key ? (r => r[col.key]) : null);
    if (!get) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = get(a), vb = get(b);
      const na = va === null || va === undefined || va === '';
      const nb = vb === null || vb === undefined || vb === '';
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      const cmp = (typeof va === 'number' && typeof vb === 'number')
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, columns, sort]);

  const pages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize > 0 ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  function toggleSort(i) {
    const col = columns[i];
    if (!col.sortValue && !col.key) return;
    setSort(s => (s.col === i ? { col: i, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: i, dir: 'desc' }));
    setPage(0);
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col, i) => {
              const sortable = !!(col.sortValue || col.key);
              const active = sort.col === i;
              return (
                <th
                  key={i}
                  onClick={sortable ? () => toggleSort(i) : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none',
                    active ? 'text-indigo-600' : 'text-slate-400',
                    sortable && 'cursor-pointer hover:text-slate-600'
                  )}
                >
                  {col.header}{active && <span className="ml-1">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-12 text-center text-slate-300 text-sm">{emptyMsg}</td></tr>
          ) : visible.map((row, i) => (
            <tr
              key={row.id || i}
              style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}
              className={cn(
                'border-b border-slate-50 hover:bg-indigo-50/40 transition-all duration-150 animate-fade-in',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, j) => (
                <td key={j} className="py-3.5 px-3 text-slate-600">{col.cell ? col.cell(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-4 text-xs text-slate-500">
          <span>{current * pageSize + 1}–{Math.min((current + 1) * pageSize, sorted.length)} de {sorted.length}</span>
          <div className="flex gap-2">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Anterior</button>
            <span className="px-2 py-1.5">Página {current + 1} de {pages}</span>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Estado de error con botón de reintento, para pantallas cuyo fetch falló. */
export function ErrorState({ message = 'No se pudieron cargar los datos', onRetry }) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      </div>
      <p className="font-medium text-slate-700">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Reintentar</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  // Escape cierra y el fondo no hace scroll mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: '28rem', md: '32rem', lg: '42rem', xl: '56rem' };
  return createPortal(
    <>
      <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, width: `min(${widths[size] || '32rem'}, calc(100% - 2rem))`, maxHeight: '85vh' }}>
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in border border-slate-200/60" style={{ maxHeight: '85vh' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
            <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </>,
    document.body
  );
}

export function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative">
        <div className="w-10 h-10 border-[3px] border-slate-100 rounded-full" />
        <div className="w-10 h-10 border-[3px] border-transparent border-t-indigo-500 rounded-full animate-spin absolute inset-0" />
      </div>
      <span className="text-xs text-slate-400 font-medium">Cargando...</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1 font-medium">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon, color = 'blue', trend }) {
  const colors = {
    blue: { bg: 'bg-indigo-50', text: 'text-indigo-600', gradient: 'from-indigo-500 to-indigo-600' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', gradient: 'from-cyan-500 to-cyan-600' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-emerald-600' },
    yellow: { bg: 'bg-amber-50', text: 'text-amber-600', gradient: 'from-amber-500 to-amber-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600', gradient: 'from-red-500 to-red-600' },
    purple: { bg: 'bg-violet-50', text: 'text-violet-600', gradient: 'from-violet-500 to-violet-600' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', gradient: 'from-indigo-400 to-indigo-600' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', gradient: 'from-slate-500 to-slate-600' },
  };
  const c = colors[color] || colors.blue;
  return (
    <Card className="card-hover relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.gradient} opacity-[0.04] rounded-full -translate-y-8 translate-x-8 group-hover:opacity-[0.08] transition-opacity`} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
          {trend && <p className={cn('text-xs font-semibold', trend > 0 ? 'text-emerald-500' : 'text-red-500')}>{trend > 0 ? '+' : ''}{trend}%</p>}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', c.bg)}>
          {icon || (
            <svg className={cn('w-5 h-5', c.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          )}
        </div>
      </div>
    </Card>
  );
}
