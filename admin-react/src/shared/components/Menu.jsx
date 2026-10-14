import { useState, useRef, useEffect, useId, cloneElement, isValidElement, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useClickOutside, useLayer, zAboveLayers, Z_POPOVER } from '../lib/focus';
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
 *
 * Se monta en un portal en `body`, pero se registra en la pila de capas de
 * `lib/focus.js`: si se abre dentro de un Modal/Drawer/menú móvil (capa con
 * foco atrapado) se pinta POR ENCIMA de esa capa y, mientras está abierto, es
 * él quien recibe Escape y Tab (la trampa de abajo no se entera). Al cerrarse
 * devuelve el foco al disparador, que sí está dentro de la trampa.
 */
export function Menu({ trigger, items = [], align = 'end', label = 'Más acciones', className, onOpenChange, width = 200 }) {
  const [open, setOpen] = useState(false);
  const [z, setZ] = useState(Z_POPOVER);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const id = useId();
  const list = items.filter(Boolean);

  const toggle = () => {
    // La altura se decide al abrir: por encima de la capa activa en ese momento.
    if (!open) setZ(zAboveLayers());
    setOpen(!open);
  };
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  const focusTrigger = () => {
    const el = triggerRef.current?.querySelector('button, a, [tabindex]');
    if (el && document.contains(el)) el.focus({ preventScroll: true });
  };
  const closeAndRestore = () => { setOpen(false); focusTrigger(); };

  // Capa: solo cuando el menú es la capa superior recibe Escape y Tab.
  useLayer(menuRef, open, {
    z,
    onKey: (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAndRestore(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeAndRestore(); }
    },
  });

  // Posición: se calcula y se escribe directo en el nodo antes del pintado
  // (debajo del disparador; arriba si no cabe).
  const colocar = useCallback(() => {
    const menu = menuRef.current;
    const trig = triggerRef.current;
    if (!menu || !trig) return;
    const r = trig.getBoundingClientRect();
    const mh = menu.offsetHeight || 0;
    const mw = menu.offsetWidth || width;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < mh + 8 && r.top > mh + 8 ? r.top - mh - 6 : r.bottom + 6;
    let left = align === 'end' ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = 'visible';
  }, [align, width]);
  useLayoutEffect(() => { if (open) colocar(); }, [open, colocar]);

  // Scroll y resize: el menú se REPOSICIONA siguiendo al disparador en vez de
  // cerrarse (antes, cualquier `scroll` lo cerraba: el scroll suave que hace
  // el navegador para mostrar el botón, o un trackpad que aún se desliza,
  // cerraban el "⋯" recién abierto). Solo se cierra si el disparador salió de
  // la vista.
  useEffect(() => {
    if (!open) return;
    let raf = null;
    const seguir = (e) => {
      if (e?.type === 'scroll' && menuRef.current?.contains(e.target)) return; // scroll interno del menú
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const trig = triggerRef.current;
        if (!trig) return;
        const r = trig.getBoundingClientRect();
        const fuera = r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth;
        if (fuera) setOpen(false); else colocar();
      });
    };
    window.addEventListener('resize', seguir);
    window.addEventListener('scroll', seguir, true);
    return () => {
      window.removeEventListener('resize', seguir);
      window.removeEventListener('scroll', seguir, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, colocar]);

  useClickOutside(menuRef, open, (e) => { if (!triggerRef.current?.contains(e.target)) setOpen(false); });

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
  }, [open]);

  function onKey(e) {
    const els = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') || []);
    const i = els.indexOf(document.activeElement);
    // Escape y Tab los atiende la capa (ver useLayer arriba).
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
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
          style={{ position: 'fixed', top: 0, left: 0, minWidth: width, visibility: 'hidden', zIndex: z }}
          className="bg-surface border border-line rounded-md shadow-pop py-1 ov-pop"
        >
          {list.map((it, i) => it.separator ? (
            <div key={`sep-${i}`} role="separator" className="my-1 border-t border-line" />
          ) : (
            <MenuItem key={it.key || it.label || i} item={it} close={closeAndRestore} />
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
