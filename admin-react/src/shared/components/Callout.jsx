import { cn } from '../lib/utils';
import { Info, CircleCheck, TriangleAlert, CircleAlert, X } from './Icons';
import { TONE_CLASSES } from '../lib/status';
import { IconButton } from './Button';

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, neutral: Info, brand: Info };

/**
 * Aviso en línea (banner discreto dentro del flujo).
 *   <Callout tone="warning" title="Tienes 2 pagos pendientes" action={<Button size="sm">Pagar</Button>}>
 *     Suman $13.663.000.
 *   </Callout>
 * `tone`: info (por defecto) · success · warning · danger · neutral.
 */
export function Callout({ tone = 'info', title, children, icon: Icon, action, onClose, className, compact = false }) {
  const I = Icon || ICONS[tone] || Info;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border', compact ? 'px-3 py-2.5' : 'px-4 py-3', TONE_CLASSES[tone] || TONE_CLASSES.info, className)}>
      <I size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('text-ink-700', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && <IconButton icon={X} size="sm" aria-label="Cerrar aviso" onClick={onClose} className="-mr-1 -mt-1 text-current" />}
    </div>
  );
}
