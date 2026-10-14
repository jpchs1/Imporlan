import { useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { useFocusTrap, useScrollLock } from '../lib/focus';
import { X } from './Icons';
import { IconButton } from './Button';

const WIDTHS = { sm: 'sm:max-w-[400px]', md: 'sm:max-w-[480px]', lg: 'sm:max-w-[640px]', xl: 'sm:max-w-[800px]' };

/**
 * Panel lateral (detalle rápido en el admin: cliente, compra, inspección…).
 * Mantiene la tabla de fondo. Mismo contrato de accesibilidad que Modal.
 *
 *   <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} description="Cliente desde 2024"
 *           width="md" footer={<Button>Guardar</Button>}>…</Drawer>
 * `side`: right (por defecto) · left. En móvil ocupa el ancho completo.
 */
export function Drawer({ open, onClose, title, description, children, footer, width = 'md', side = 'right', closeOnOverlay = true, initialFocusRef, className, bodyClassName, header, 'aria-label': ariaLabel }) {
  const panelRef = useRef(null);
  const id = useId();
  useFocusTrap(panelRef, !!open, { onEscape: () => onClose?.(), initialFocusRef });
  useScrollLock(!!open);
  if (!open) return null;
  return createPortal(
    <div className={cn('fixed inset-0 z-modal flex', side === 'left' ? 'justify-start' : 'justify-end')}>
      <div className="absolute inset-0 bg-ink-900/50 ov-fade" onClick={closeOnOverlay ? onClose : undefined} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-t` : undefined}
        aria-label={!title ? ariaLabel : undefined}
        className={cn(
          'relative flex flex-col bg-surface shadow-modal w-full h-dvh outline-none',
          side === 'left' ? 'ov-slide-left' : 'ov-slide-right',
          WIDTHS[width] || WIDTHS.md, className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line shrink-0">
          <div className="min-w-0 flex-1">
            {title && <h2 id={`${id}-t`} className="text-base font-semibold text-ink-900 leading-6 truncate">{title}</h2>}
            {description && <p className="text-13 text-ink-500 mt-0.5">{description}</p>}
            {header}
          </div>
          <IconButton icon={X} aria-label="Cerrar" onClick={onClose} size="sm" className="-mr-1.5 -mt-1" />
        </div>
        <div className={cn('flex-1 overflow-y-auto px-5 sm:px-6 py-5 overscroll-contain', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 sm:px-6 py-3 border-t border-line bg-canvas shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
