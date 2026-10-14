import { isValidElement } from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown } from './Icons';
import { fmtNumero } from '../lib/format';

/**
 * Tile de estadística, único para ambos paneles. Alto fijo 88 px.
 *
 *   <StatTile label="Pagos pendientes" value="$13.663.000" hint="2 solicitudes" />
 *   <StatTile label="Ingresos" value="$4.2 M" delta={12.5} deltaLabel="vs. mes anterior" />
 *   <StatTile label="Activos" value={4} onClick={…} active={filtro === 'activos'} />   filtra: aria-pressed
 *
 * `delta` es un número real (porcentaje): positivo ↑ verde, negativo ↓ rojo.
 * `tone` colorea solo el valor (success · warning · danger) cuando el dato lo
 * amerita (p. ej. pagos vencidos); por defecto es neutro.
 */
export function StatTile({ label, value, hint, delta, deltaLabel, icon: Icon, onClick, active = false, tone, loading = false, className, href }) {
  const toneText = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', brand: 'text-brand-700' }[tone] || 'text-ink-900';
  const interactive = !!onClick;
  const Tag = interactive ? 'button' : 'div';
  const body = (
    <>
      <div className="flex items-start justify-between gap-3 min-w-0">
        <p className="eyebrow truncate">{label}</p>
        {Icon && (
          <span className="text-ink-400 shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden="true">
            {isValidElement(Icon) ? Icon : <Icon size={18} />}
          </span>
        )}
      </div>
      {loading ? (
        <div className="sk h-7 w-24 mt-1.5" aria-hidden="true" />
      ) : (
        <p className={cn('text-2xl font-semibold tabular leading-8 mt-0.5 truncate', toneText)}>{typeof value === 'number' ? fmtNumero(value) : value}</p>
      )}
      {(hint || delta !== undefined) && (
        <p className="text-13 text-ink-500 mt-0.5 flex items-center gap-1.5 min-w-0">
          {delta !== undefined && delta !== null && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium tabular', delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-ink-500')}>
              {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : null}
              {delta > 0 ? '+' : ''}{fmtNumero(delta, Math.abs(delta) < 10 ? 1 : 0)}%
            </span>
          )}
          <span className="truncate">{deltaLabel || hint}</span>
        </p>
      )}
    </>
  );
  const base = cn(
    'flex flex-col justify-center text-left bg-surface border rounded-lg shadow-card px-4 h-[88px] min-w-0 w-full',
    interactive && 'cursor-pointer transition-colors duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line',
    className,
  );
  if (href && !interactive) {
    return <a href={href} className={base}>{body}</a>;
  }
  return (
    <Tag className={base} onClick={onClick} type={interactive ? 'button' : undefined} aria-pressed={interactive ? active : undefined}>
      {body}
    </Tag>
  );
}

/** Grilla de tiles: 2 columnas en móvil, `cols` en ≥ lg (por defecto 4). */
export function StatGrid({ children, cols = 4, className }) {
  const lg = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }[cols] || 'lg:grid-cols-4';
  return <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', lg, className)}>{children}</div>;
}
