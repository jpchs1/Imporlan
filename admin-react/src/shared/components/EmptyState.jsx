import { cn } from '../lib/utils';
import { Inbox } from './Icons';

/**
 * Estado vacío.
 *   <EmptyState icon={Ship} title="Aún no tienes expedientes"
 *     description="Cuando contrates un plan o cotices links, aparecerán aquí."
 *     primaryAction={<Button>Cotizar links</Button>} secondaryAction={<Button variant="ghost">Ver planes</Button>} />
 * `compact` para dentro de cards o tablas (menos alto, ícono de 20).
 */
export function EmptyState({ icon, title, description, primaryAction, secondaryAction, compact = false, className, children }) {
  const Icon = icon || Inbox;
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-8 px-4' : 'py-14 px-6', className)}>
      <div className={cn('flex items-center justify-center rounded-full bg-neutral-bg text-ink-500', compact ? 'h-9 w-9 mb-3' : 'h-12 w-12 mb-4')}>
        <Icon size={compact ? 18 : 24} />
      </div>
      <h3 className={cn('font-semibold text-ink-900', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      {description && <p className={cn('text-ink-500 mt-1 max-w-md', compact ? 'text-13' : 'text-sm')}>{description}</p>}
      {children}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
