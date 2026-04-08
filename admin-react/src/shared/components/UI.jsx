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

export function Table({ columns, data, onRowClick, emptyMsg = 'Sin datos' }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col, i) => (
              <th key={i} className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-12 text-center text-slate-300 text-sm">{emptyMsg}</td></tr>
          ) : data.map((row, i) => (
            <tr
              key={row.id || i}
              style={{ animationDelay: `${i * 20}ms` }}
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
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn('bg-white rounded-2xl shadow-2xl w-full relative z-10 max-h-[90vh] flex flex-col animate-scale-in border border-slate-200/60 my-auto', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
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
  };
  const c = colors[color];
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
