import { useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { useFocusTrap, useScrollLock } from '../lib/focus';
import { X } from './Icons';
import { IconButton } from './Button';

const WIDTHS = { sm: 'sm:max-w-[28rem]', md: 'sm:max-w-[32rem]', lg: 'sm:max-w-[42rem]', xl: 'sm:max-w-[56rem]', full: 'sm:max-w-[calc(100vw-3rem)]' };

/**
 * Modal accesible: role="dialog", foco atrapado y devuelto, Escape, scroll
 * interno con cabecera y pie fijos. En móvil ocupa toda la pantalla (hoja).
 *
 *   <Modal open={open} onClose={cerrar} title="Cambiar estado" description="…"
 *          size="md" footer={<><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button>Guardar</Button></>}>
 *     …
 *   </Modal>
 * Tamaños: sm 448 · md 512 · lg 672 · xl 896 · full.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnOverlay = true, initialFocusRef, hideClose = false, className, bodyClassName, 'aria-label': ariaLabel }) {
  const panelRef = useRef(null);
  const id = useId();
  useFocusTrap(panelRef, !!open, { onEscape: () => onClose?.(), initialFocusRef });
  useScrollLock(!!open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end sm:items-center sm:justify-center sm:p-6">
      <div className="absolute inset-0 bg-ink-900/60 ov-fade" onClick={closeOnOverlay ? onClose : undefined} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-t` : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? `${id}-d` : undefined}
        className={cn(
          'relative flex flex-col bg-surface shadow-modal w-full outline-none',
          'h-dvh sm:h-auto sm:max-h-[85vh] sm:rounded-xl ov-up sm:ov-pop',
          WIDTHS[size] || WIDTHS.md, className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line shrink-0">
            <div className="min-w-0">
              {title && <h2 id={`${id}-t`} className="text-base font-semibold text-ink-900 leading-6">{title}</h2>}
              {description && <p id={`${id}-d`} className="text-13 text-ink-500 mt-0.5">{description}</p>}
            </div>
            {!hideClose && <IconButton icon={X} aria-label="Cerrar" onClick={onClose} size="sm" className="-mr-1.5 -mt-1" />}
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto px-5 sm:px-6 py-5 overscroll-contain', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 sm:px-6 py-3 border-t border-line bg-canvas sm:rounded-b-xl shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
