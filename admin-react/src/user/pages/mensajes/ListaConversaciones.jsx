import { cn } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Avatar, CountBadge, StatusBadge } from '../../../shared/components/UI';
import { fmtCuando, nombreConversacion } from './formato';

/**
 * Un ítem de la bandeja. Es un botón: el nombre del agente va en el nombre
 * accesible ("Rodrigo Calderón · Expediente IMP-00035").
 */
export function ItemConversacion({ conv, selected = false, onClick, compact = false }) {
  const sinLeer = Number(conv.unread_count || 0);
  const cerrada = conv.status === 'closed';
  const nombre = nombreConversacion(conv);
  const cuando = conv.last_message_time || conv.updated_at;
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick?.(conv)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'relative w-full text-left flex items-start gap-3 px-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
          compact ? 'py-2.5' : 'py-3',
          selected ? 'bg-brand-50' : 'hover:bg-canvas',
        )}
      >
        {selected && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-600" aria-hidden="true" />}
        <Avatar name={nombre} size={compact ? 'md' : 'lg'} className="mt-0.5" />
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('text-sm truncate', sinLeer ? 'font-semibold text-ink-900' : 'font-medium text-ink-900')}>{nombre}</span>
            <time dateTime={cuando || undefined} title={cuando ? fmtDateLarga(cuando, { hora: true }) : undefined} className="text-xs text-ink-500 shrink-0 tabular">
              {fmtCuando(cuando)}
            </time>
          </span>
          {conv.subject && <span className="block text-13 text-ink-500 truncate mt-0.5">{conv.subject}</span>}
          <span className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn('text-13 truncate', sinLeer ? 'text-ink-700' : 'text-ink-500')}>
              {conv.last_message || conv.last_message_text || (cerrada ? 'Conversación cerrada' : 'Sin mensajes todavía')}
            </span>
            {sinLeer > 0
              ? <><CountBadge value={sinLeer} tone="danger" /><span className="sr-only">{sinLeer} sin leer</span></>
              : cerrada ? <StatusBadge kind="conversacion" status="closed" size="sm" /> : null}
          </span>
        </span>
      </button>
    </li>
  );
}

export function ListaConversaciones({ conversations = [], selectedId, onSelect, compact = false, className }) {
  return (
    <ul className={cn('divide-y divide-line', className)} aria-label="Conversaciones">
      {conversations.map(c => (
        <ItemConversacion key={c.id} conv={c} selected={c.id === selectedId} onClick={onSelect} compact={compact} />
      ))}
    </ul>
  );
}
