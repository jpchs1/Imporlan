import { useRef, useState, useId } from 'react';
import { cn, aceptaArchivo } from '../lib/utils';
import { Upload, Loader } from './Icons';

/**
 * Zona para subir archivos (clic o arrastrar).
 *   <Dropzone onFiles={(files) => subir(files)} accept=".pdf,image/*" multiple
 *             label="Arrastra los archivos o haz clic para elegirlos" hint="PDF o imágenes, hasta 20 MB" />
 * `onFiles` recibe un array de File. `loading` bloquea y muestra el spinner.
 *
 * La zona de arrastre no es interactiva para el lector de pantalla: lo
 * interactivo es un <button> real ("Elegir archivo") que abre el <input
 * type="file"> oculto (nada de role=button con un input adentro: axe
 * `nested-interactive`). Con el mouse, hacer clic en cualquier parte de la
 * zona también abre el selector.
 *
 * `accept` se aplica también a lo que se arrastra (el navegador solo filtra el
 * selector de archivos): lo que no calza no llega a `onFiles`, se avisa con
 * `onReject(files)` y, salvo `showRejected={false}`, se muestra un mensaje.
 */
export function Dropzone({ onFiles, onReject, accept, multiple = false, label, buttonLabel, hint, disabled = false, loading = false, className, compact = false, showRejected = true }) {
  const input = useRef(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [rechazados, setRechazados] = useState([]);
  const blocked = disabled || loading;
  const texto = label || (multiple ? 'Arrastra los archivos aquí' : 'Arrastra un archivo aquí');
  const textoBoton = buttonLabel || (multiple ? 'Elegir archivos' : 'Elegir archivo');

  function handle(list) {
    const files = Array.from(list || []).filter(Boolean);
    if (!files.length) return;
    const ok = files.filter(f => aceptaArchivo(f, accept));
    const malos = files.filter(f => !aceptaArchivo(f, accept));
    setRechazados(malos);
    if (malos.length) onReject?.(malos);
    if (!ok.length) return;
    onFiles?.(multiple ? ok : ok.slice(0, 1));
  }
  const abrir = () => { if (!blocked) input.current?.click(); };

  const avisoId = `${id}-r`;
  const hintId = `${id}-h`;
  const describedBy = [hint ? hintId : null, showRejected && rechazados.length ? avisoId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      {/* El input vive fuera del botón: así el botón es el único control. */}
      <input ref={input} id={`${id}-f`} type="file" accept={accept} multiple={multiple} disabled={blocked} className="hidden" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
      <div
        onClick={abrir}
        onDragOver={(e) => { e.preventDefault(); if (!blocked) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!blocked) handle(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center justify-center text-center rounded-lg border border-dashed transition-colors duration-150 select-none',
          compact ? 'px-4 py-4 gap-1' : 'px-6 py-8 gap-2',
          over ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-canvas hover:border-ink-400',
          blocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          className,
        )}
      >
        <span className={cn('flex items-center justify-center rounded-full bg-surface border border-line text-ink-500', compact ? 'h-8 w-8' : 'h-10 w-10')} aria-hidden="true">
          {loading ? <Loader size={18} className="spin" /> : <Upload size={18} />}
        </span>
        <p className="text-sm font-medium text-ink-900">{loading ? 'Subiendo…' : texto}</p>
        {hint && <p id={hintId} className="text-xs text-ink-500">{hint}</p>}
        <button
          type="button"
          disabled={blocked}
          aria-describedby={describedBy}
          onClick={(e) => { e.stopPropagation(); abrir(); }}
          className={cn(
            'mt-1 inline-flex items-center justify-center h-8 px-3 rounded-md text-13 font-medium bg-surface text-ink-700 border border-line-strong',
            'hover:bg-canvas hover:text-ink-900 transition-colors duration-150 disabled:cursor-not-allowed',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          )}
        >
          {textoBoton}
        </button>
      </div>
      {showRejected && rechazados.length > 0 && (
        <p id={avisoId} role="alert" className="mt-1.5 text-xs text-danger">
          {rechazados.length === 1 ? 'No se admite este archivo' : `No se admiten ${rechazados.length} archivos`}
          {': '}
          {rechazados.map(f => f.name).join(', ')}
          {hint ? ` (${hint}).` : '.'}
        </p>
      )}
    </div>
  );
}
