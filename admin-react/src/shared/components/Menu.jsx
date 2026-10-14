import { useState, useRef, useEffect, useId, cloneElement, isValidElement, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useClickOutside } from '../lib/focus';
import { Ellipsis } from './Icons';
import { IconButton } from './Button';

/**
 * Menú desplegable (acciones secundarias, "⋯", menú del usuario).
 *
 *   <Menu
 *     trigger={<Button variant="secondary" iconRight={ChevronDown}>Más</Button>}
 *     items={[
 *       { label: 'Editar', icon: Pencil, onClick: … },
 *       { label: 'Abrir en el sitio', icon: ExternalLink, href: 'https://…' },
 *       { separator: true },
 *       { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: … },
 *     ]}
 *   />
 * Sin `trigger` pinta un IconButton "⋯". `align`: end (por defecto) · start.
 * Teclado: flechas, Home/End, Escape; cierra al hacer clic fuera o al navegar.
 */
export function Menu({ trigger, items = [], align = 'end', label = 'Más acciones', className, onOpenChange, width = 200 }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();
  const list = items.filter(Boolean);

  const toggle = () => setOpen(o => !o);
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  // Posición: se calcula y se escribe directo en el nodo antes del pintado
  // (debajo del disparador; arriba si no cabe).
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !triggerRef.current || !menu) return;
    const r = triggerRef.current.getBoundingClientRect();
    const mh = menu.offsetHeight || 0;
    const mw = menu.offsetWidth || width;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < mh + 8 && r.top > mh + 8 ? r.top - mh - 6 : r.bottom + 6;
    let left = align === 'end' ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = 'visible';
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);

  useClickOutside(menuRef, open, (e) => { if (!triggerRef.current?.contains(e.target)) setOpen(false); });

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
  }, [open]);

  function onKey(e) {
    const els = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') || []);
    const i = els.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.querySelector('button, a, [tabindex]')?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') { setOpen(false); }
  }

  const controls = open ? id : undefined;
  const onTriggerClick = (e) => { e.stopPropagation(); toggle(); };
  // El ref va en el span envolvente (mide lo mismo que el disparador): así no
  // hay que clonar el elemento con un ref.
  const trig = isValidElement(trigger)
    ? cloneElement(trigger, {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': controls,
      onClick: (e) => { trigger.props.onClick?.(e); onTriggerClick(e); },
    })
    : <IconButton icon={Ellipsis} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={controls} onClick={onTriggerClick} />;

  return (
    <>
      <span ref={triggerRef} className={cn('inline-flex', className)}>{trig}</span>
      {open && createPortal(
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKey}
          style={{ position: 'fixed', top: 0, left: 0, minWidth: width, visibility: 'hidden' }}
          className="z-popover bg-surface border border-line rounded-md shadow-pop py-1 ov-pop"
        >
          {list.map((it, i) => it.separator ? (
            <div key={`sep-${i}`} role="separator" className="my-1 border-t border-line" />
          ) : (
            <MenuItem key={it.key || it.label || i} item={it} close={() => { setOpen(false); }} />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function MenuItem({ item, close }) {
  const Icon = item.icon;
  const cls = cn(
    'w-full flex items-center gap-2.5 px-3 h-9 text-sm text-left whitespace-nowrap transition-colors duration-150 outline-none',
    item.tone === 'danger' ? 'text-danger hover:bg-danger-bg focus-visible:bg-danger-bg' : 'text-ink-700 hover:bg-neutral-bg focus-visible:bg-neutral-bg hover:text-ink-900',
    item.disabled && 'opacity-50 cursor-not-allowed',
  );
  const inner = (<>{Icon && <Icon size={16} className="shrink-0" />}<span className="flex-1 truncate">{item.label}</span>{item.shortcut && <kbd className="text-xs text-ink-500 font-sans">{item.shortcut}</kbd>}</>);
  if (item.to && !item.disabled) {
    return <Link role="menuitem" to={item.to} className={cls} onClick={() => { item.onClick?.(); close(); }} tabIndex={-1}>{inner}</Link>;
  }
  if (item.href && !item.disabled) {
    return <a role="menuitem" href={item.href} target={item.target || '_blank'} rel="noopener" className={cls} onClick={() => { item.onClick?.(); close(); }} tabIndex={-1}>{inner}</a>;
  }
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={item.disabled || undefined}
      tabIndex={-1}
      className={cls}
      onClick={(e) => { e.stopPropagation(); if (item.disabled) return; close(); item.onClick?.(e); }}
    >
      {inner}
    </button>
  );
}
