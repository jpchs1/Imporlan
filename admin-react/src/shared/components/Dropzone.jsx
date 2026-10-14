import { useRef, useState, useId } from 'react';
import { cn } from '../lib/utils';
import { Upload, Loader } from './Icons';

/**
 * Zona para subir archivos (clic o arrastrar).
 *   <Dropzone onFiles={(files) => subir(files)} accept=".pdf,image/*" multiple
 *             label="Arrastra los archivos o haz clic para elegirlos" hint="PDF o imágenes, hasta 20 MB" />
 * `onFiles` recibe un array de File. `loading` bloquea y muestra el spinner.
 */
export function Dropzone({ onFiles, accept, multiple = false, label = 'Arrastra un archivo o haz clic para elegirlo', hint, disabled = false, loading = false, className, compact = false }) {
  const input = useRef(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const blocked = disabled || loading;

  function handle(list) {
    const files = Array.from(list || []).filter(Boolean);
    if (!files.length) return;
    onFiles?.(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked || undefined}
      aria-describedby={hint ? `${id}-h` : undefined}
      onClick={() => !blocked && input.current?.click()}
      onKeyDown={(e) => { if (!blocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); if (!blocked) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!blocked) handle(e.dataTransfer.files); }}
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-dashed transition-colors duration-150 cursor-pointer select-none',
        compact ? 'px-4 py-4 gap-1' : 'px-6 py-8 gap-2',
        over ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-canvas hover:border-ink-400',
        blocked && 'opacity-60 cursor-not-allowed',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
    >
      <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" tabIndex={-1} aria-label={label}
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
      <span className={cn('flex items-center justify-center rounded-full bg-surface border border-line text-ink-500', compact ? 'h-8 w-8' : 'h-10 w-10')}>
        {loading ? <Loader size={18} className="spin" /> : <Upload size={18} />}
      </span>
      <p className="text-sm font-medium text-ink-900">{loading ? 'Subiendo…' : label}</p>
      {hint && <p id={`${id}-h`} className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
