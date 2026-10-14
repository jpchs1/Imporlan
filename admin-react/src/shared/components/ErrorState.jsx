import { useState } from 'react';
import { cn } from '../lib/utils';
import { CircleAlert, ChevronDown, RefreshCw } from './Icons';
import { Button } from './Button';

/**
 * Estado de error con reintento y detalle técnico plegable.
 *   <ErrorState message="No pudimos cargar tus expedientes" detail={err.message} onRetry={load} />
 * Compatibilidad: `message` y `onRetry` como antes.
 */
export function ErrorState({ title = 'Algo salió mal', message = 'No se pudieron cargar los datos. Vuelve a intentarlo.', detail, onRetry, retryLabel = 'Reintentar', compact = false, className }) {
  const [open, setOpen] = useState(false);
  const detalle = detail instanceof Error ? detail.message : detail;
  return (
    <div role="alert" className={cn('flex flex-col items-center text-center', compact ? 'py-8 px-4' : 'py-14 px-6', className)}>
      <div className={cn('flex items-center justify-center rounded-full bg-danger-bg text-danger', compact ? 'h-9 w-9 mb-3' : 'h-12 w-12 mb-4')}>
        <CircleAlert size={compact ? 18 : 24} />
      </div>
      <h3 className={cn('font-semibold text-ink-900', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      <p className={cn('text-ink-500 mt-1 max-w-md', compact ? 'text-13' : 'text-sm')}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size={compact ? 'sm' : 'md'} icon={RefreshCw} onClick={onRetry} className="mt-5">{retryLabel}</Button>
      )}
      {detalle && (
        <div className="mt-4 w-full max-w-lg">
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900">
            Detalle técnico <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <pre className="mt-2 text-left text-xs text-ink-700 bg-canvas border border-line rounded-md p-3 whitespace-pre-wrap break-words max-h-48 overflow-auto font-mono">{String(detalle)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
