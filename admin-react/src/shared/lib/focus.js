import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusables(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
}

/* ---------------------------------------------------------------------------
   Pila de capas (trampas de foco y menús abiertos)

   Hay UN solo listener de teclado en `document` y solo la capa superior
   procesa Escape y Tab. Así un ConfirmDialog sobre un Modal cierra solo el
   de arriba, y un Menu abierto dentro de un drawer se queda con Escape sin
   cerrar el drawer. Cada capa declara su `z` para que lo que se abra encima
   (p. ej. un Menu en portal) sepa a qué altura pintarse.
   --------------------------------------------------------------------------- */
export const Z_POPOVER = 50;
export const Z_MODAL = 60;

const layers = [];
let listening = false;

function onDocumentKey(e) {
  if (e.key !== 'Escape' && e.key !== 'Tab') return;
  const top = layers[layers.length - 1];
  top?.onKey?.(e);
}

/** Apila una capa `{ root, z, onKey }`; devuelve la función que la quita. */
export function pushLayer(layer) {
  layers.push(layer);
  if (!listening) {
    document.addEventListener('keydown', onDocumentKey, true);
    listening = true;
  }
  return () => {
    const i = layers.lastIndexOf(layer);
    if (i >= 0) layers.splice(i, 1);
    if (!layers.length && listening) {
      document.removeEventListener('keydown', onDocumentKey, true);
      listening = false;
    }
  };
}

/** Capa superior activa (o null si no hay ninguna). */
export function topLayer() {
  return layers[layers.length - 1] || null;
}

/** z-index para algo que debe quedar por encima de la capa superior actual. */
export function zAboveLayers(min = Z_POPOVER) {
  const top = topLayer();
  return Math.max(min, (top?.z ?? 0) + 1);
}

/**
 * Registra una capa mientras `active`. `onKey(e)` recibe Escape y Tab solo
 * cuando la capa es la superior. Para capas sin trampa (Menu).
 */
export function useLayer(ref, active, { z = Z_POPOVER, onKey } = {}) {
  const keyRef = useRef(onKey);
  useEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    if (!active) return;
    return pushLayer({ root: ref.current, z, onKey: (e) => keyRef.current?.(e) });
  }, [active, ref, z]);
}

/**
 * Atrapa el foco dentro de `ref` mientras `active` sea true, mueve el foco
 * adentro al abrir (a `initialFocusRef`, al primer elemento con
 * `data-autofocus`, o al primer enfocable) y lo devuelve al cerrar.
 * `onEscape` se llama con la tecla Escape, solo si esta es la capa superior.
 */
export function useFocusTrap(ref, active, { onEscape, initialFocusRef, returnFocus = true, z = Z_MODAL } = {}) {
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
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault(); first.focus();
      }
    }
    const popLayer = pushLayer({ root, z, onKey });
    return () => {
      popLayer();
      if (cleanupRaf) cancelAnimationFrame(cleanupRaf);
      const prev = previous.current;
      if (returnFocus && prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocusRef, returnFocus, z]);
}

/* ---------------------------------------------------------------------------
   Bloqueo de scroll del body con contador: el estilo original se guarda con
   el primer bloqueo y se restaura solo al soltar el último, en cualquier
   orden (un ConfirmDialog sobre un Modal, un Lightbox sobre un Drawer…).
   --------------------------------------------------------------------------- */
let scrollLocks = 0;
let scrollSaved = null;

/** Bloquea el scroll; devuelve la función que lo suelta (idempotente). */
export function lockScroll() {
  if (typeof document === 'undefined') return () => {};
  const body = document.body;
  if (scrollLocks === 0) {
    scrollSaved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const barra = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (barra > 0) body.style.paddingRight = `${barra}px`;
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0 && scrollSaved) {
      body.style.overflow = scrollSaved.overflow;
      body.style.paddingRight = scrollSaved.paddingRight;
      scrollSaved = null;
    }
  };
}

/** Bloquea el scroll del body mientras `active` (modales, drawers, menú móvil). */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    return lockScroll();
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
