import { cn } from '../lib/utils';
import { Loader } from './Icons';

/**
 * Placeholders de carga. Sin anchos fijos en píxeles: usan porcentajes para
 * no desbordar en móvil (F11).
 *
 *   <Skeleton className="h-4 w-1/2" />
 *   <Skeleton.Text lines={3} />
 *   <Skeleton.Card />                 tarjeta con título y 2 líneas
 *   <Skeleton.TableRows rows={5} cols={4} />
 *   <Skeleton.Stat />                 tile de 88 px
 *   <Skeleton.Detail />               cabecera + 2 columnas
 */
export function Skeleton({ className, style }) {
  return <div className={cn('sk', className)} style={style} aria-hidden="true" />;
}

const WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/4'];

function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn('sk h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : WIDTHS[i % WIDTHS.length])} />
      ))}
    </div>
  );
}

function SkeletonCard({ className, lines = 2 }) {
  return (
    <div className={cn('bg-surface rounded-lg border border-line shadow-card p-(--card-pad) space-y-3', className)} aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div className="sk h-4 w-1/3" />
        <div className="sk h-5 w-16" />
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}

function SkeletonTableRows({ rows = 5, cols = 4, className }) {
  return (
    <div className={cn('divide-y divide-line', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 min-h-(--density-row)">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={cn('sk h-3.5', c === 0 ? 'w-1/4' : c === cols - 1 ? 'w-16 ml-auto' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonStat({ className }) {
  return (
    <div className={cn('bg-surface rounded-lg border border-line shadow-card px-4 h-[88px] flex flex-col justify-center gap-2', className)} aria-hidden="true">
      <div className="sk h-3 w-1/2" />
      <div className="sk h-7 w-1/3" />
      <div className="sk h-3 w-2/5" />
    </div>
  );
}

function SkeletonDetail({ className }) {
  return (
    <div className={cn('space-y-6', className)} aria-hidden="true">
      <div className="space-y-2">
        <div className="sk h-3 w-24" />
        <div className="sk h-7 w-2/3 sm:w-1/3" />
        <div className="sk h-3.5 w-1/2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard className="lg:col-span-2" lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;
Skeleton.TableRows = SkeletonTableRows;
Skeleton.Stat = SkeletonStat;
Skeleton.Detail = SkeletonDetail;

/**
 * Spinner. Por defecto es un bloque centrado ("Cargando…"); `inline` lo hace
 * de 16 px para ponerlo dentro de un texto o botón.
 */
export function Spinner({ size = 'md', label = 'Cargando…', inline = false, className }) {
  const px = { sm: 16, md: 24, lg: 32 }[size] || 24;
  if (inline) {
    return <Loader size={px} className={cn('spin text-ink-500 inline-block align-middle', className)} aria-label={label} role="status" />;
  }
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center py-12 gap-2 text-ink-500', className)}>
      <Loader size={px} className="spin" />
      {label && <span className="text-13">{label}</span>}
    </div>
  );
}
