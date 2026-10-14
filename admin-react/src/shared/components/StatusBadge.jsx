import { cn } from '../lib/utils';
import { statusMeta, TONE_CLASSES, TONE_DOT } from '../lib/status';

/**
 * Badge genérica: 12 px, radio 6, bg/line/text semánticos.
 *   <Badge tone="success" dot>Pagado</Badge>
 * `tone`: neutral (por defecto) · success · warning · danger · info · brand.
 * Compatibilidad: `className` con clases de color (statusColor) sigue funcionando.
 */
export function Badge({ children, tone, dot = false, size = 'md', className, title }) {
  const hasCustomColor = className && /\b(bg-|text-)/.test(className);
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap align-middle',
        size === 'sm' ? 'px-1.5 h-5 text-xs' : 'px-2 h-6 text-xs',
        !hasCustomColor && (TONE_CLASSES[tone] || TONE_CLASSES.neutral),
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', TONE_DOT[tone] || TONE_DOT.neutral)} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Estado de la base → etiqueta legible con tono. Nunca muestra la clave cruda.
 *   <StatusBadge kind="expediente" status={order.status} />
 *   <StatusBadge kind="pago" status="pending" dot />
 * `kind`: expediente · pago · compra · barco · publicacion · conversacion ·
 * evento · plan · inspeccion · cola (o 'auto').
 */
export function StatusBadge({ kind = 'auto', status, dot = false, size, className, label }) {
  const meta = statusMeta(kind, status);
  return (
    <Badge tone={meta.tone} dot={dot} size={size} className={className}>
      {label || meta.label}
    </Badge>
  );
}

/** Contador pequeño (sidebar, tabs). `tone="danger"` solo para mensajes sin leer. */
export function CountBadge({ value, tone = 'neutral', max = 99, className }) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  return (
    <span className={cn(
      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold tabular leading-none',
      tone === 'danger' ? 'bg-danger text-white' : tone === 'brand' ? 'bg-brand-600 text-white' : tone === 'sidebar' ? 'bg-white/10 text-sidebar-ink' : 'bg-neutral-bg text-neutral',
      className,
    )}>
      {n > max ? `${max}+` : n}
    </span>
  );
}
