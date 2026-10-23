import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { useFocusTrap, useScrollLock } from '../lib/focus';
import { X, ChevronLeft, ChevronRight, Download } from './Icons';
import { IconButton } from './Button';
import { FileImage } from './FileImage';

/**
 * Visor de imágenes único. `items`: [{ src, alt, caption, downloadUrl }].
 *   <Lightbox open={i !== null} items={fotos} index={i} onIndexChange={setI} onClose={() => setI(null)} />
 * Teclado: ← → cambian, Escape cierra. Contador "2 / 6".
 */
export function Lightbox({ open, items = [], index = 0, onIndexChange, onClose }) {
  const ref = useRef(null);
  // Controlado si hay onIndexChange (la página guarda el índice); si no,
  // lleva el índice por su cuenta a partir de `index`.
  const controlled = typeof onIndexChange === 'function';
  const [internal, setInternal] = useState(index);
  const i = controlled ? index : internal;
  useFocusTrap(ref, !!open, { onEscape: () => onClose?.() });
  useScrollLock(!!open);

  const total = items.length;
  const go = (d) => {
    if (!total) return;
    const n = (i + d + total) % total;
    if (controlled) onIndexChange(n); else setInternal(n);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open || !total) return null;
  const it = items[Math.min(i, total - 1)];
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={it.alt || `Imagen ${i + 1} de ${total}`} className="fixed inset-0 z-modal bg-ink-900/95 flex flex-col ov-fade outline-none">
      <div className="flex items-center justify-between gap-3 px-4 h-14 text-white shrink-0">
        <span className="text-sm tabular text-white/80">{i + 1} / {total}</span>
        <div className="flex items-center gap-1">
          {it.downloadUrl && <a href={it.downloadUrl} download className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white" aria-label="Descargar"><Download size={18} /></a>}
          <IconButton icon={X} aria-label="Cerrar" onClick={onClose} className="text-white/80 hover:bg-white/10 hover:text-white border-transparent" />
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-14 pb-4" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <FileImage src={it.src} mimeType={it.mimeType} originalName={it.originalName || it.alt} alt={it.alt || ''} className="max-h-full max-w-full object-contain rounded-md select-none" />
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Imagen anterior" className={cn('absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center')}><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Imagen siguiente" className={cn('absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center')}><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      {it.caption && <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-13 text-white/80 shrink-0">{it.caption}</p>}
    </div>,
    document.body,
  );
}
