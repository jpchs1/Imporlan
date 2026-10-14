import { cn } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Check } from '../../../shared/components/Icons';
import { IconButton } from '../../../shared/components/UI';
import { tipoNotificacion } from './notificaciones';

/**
 * Fila de una notificación (Inicio y Alertas). Un botón para abrirla y, si
 * está sin leer, un botón aparte para marcarla leída (no se anidan botones).
 */
export function FilaNotificacion({ n, onOpen, onMarkRead, compact = false }) {
  const { icon: Icon } = tipoNotificacion(n.type);
  const sinLeer = !n.read_at;
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        onClick={() => onOpen?.(n)}
        className={cn(
          'flex-1 min-w-0 flex items-start gap-3 text-left px-(--card-pad) transition-colors duration-150 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
          compact ? 'py-3' : 'py-3.5',
        )}
      >
        <span className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', sinLeer ? 'bg-brand-100 text-brand-700' : 'bg-neutral-bg text-ink-500')} aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-start justify-between gap-3">
            <span className={cn('text-sm leading-5 block', sinLeer ? 'font-semibold text-ink-900' : 'text-ink-700')}>
              {n.title}
              {sinLeer && <span className="sr-only"> (sin leer)</span>}
            </span>
            <time dateTime={n.created_at} title={fmtDateLarga(n.created_at, { hora: true })} className="text-xs text-ink-500 shrink-0 mt-0.5 tabular whitespace-nowrap">
              {fmtRelativo(n.created_at)}
            </time>
          </span>
          {n.message && <span className={cn('block text-13 text-ink-500 mt-0.5', compact ? 'line-clamp-1' : 'line-clamp-2')}>{n.message}</span>}
        </span>
        {sinLeer && <span className="mt-2 h-2 w-2 rounded-full bg-brand-600 shrink-0" aria-hidden="true" />}
      </button>
      {sinLeer && onMarkRead && (
        <div className="flex items-center pr-3">
          <IconButton icon={Check} size="sm" aria-label="Marcar como leída" onClick={() => onMarkRead(n)} />
        </div>
      )}
    </li>
  );
}
