import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Atrapa el foco dentro de `ref` mientras `active` sea true, mueve el foco
 * adentro al abrir (a `initialFocusRef`, al primer elemento con
 * `data-autofocus`, o al primer enfocable) y lo devuelve al cerrar.
 * `onEscape` se llama con la tecla Escape.
 */
export function useFocusTrap(ref, active, { onEscape, initialFocusRef, returnFocus = true } = {}) {
  const previous = useRef(null);
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; });

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    previous.current = document.activeElement;
    let cleanupRaf = null;

    const target = initialFocusRef?.current
      || root.querySelector('[data-autofocus]')
      || focusables(root)[0]
      || root;
    if (target && target !== root && typeof target.focus === 'function') {
      // Esperar al pintado para que el foco no "salte" la animación de entrada.
      cleanupRaf = requestAnimationFrame(() => target.focus({ preventScroll: true }));
    } else if (root) {
      root.setAttribute('tabindex', '-1');
      root.focus({ preventScroll: true });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escapeRef.current?.(e);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(root);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (cleanupRaf) cancelAnimationFrame(cleanupRaf);
      const prev = previous.current;
      if (returnFocus && prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocusRef, returnFocus]);
}

/** Bloquea el scroll del body mientras `active` (modales, drawers, menú móvil). */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const barra = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (barra > 0) document.body.style.paddingRight = `${barra}px`;
    return () => {
      document.body.style.overflow = prev;
      document.body.style.paddingRight = prevPad;
    };
  }, [active]);
}

/** Llama a `onOutside` al hacer clic fuera de `ref` (mousedown + touchstart). */
export function useClickOutside(ref, active, onOutside) {
  const cb = useRef(onOutside);
  useEffect(() => { cb.current = onOutside; });
  useEffect(() => {
    if (!active) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) cb.current?.(e);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [ref, active]);
}
