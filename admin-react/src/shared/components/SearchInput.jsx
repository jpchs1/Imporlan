import { forwardRef, useId } from 'react';
import { cn } from '../lib/utils';
import { Search, X } from './Icons';

/**
 * Buscador con ícono, botón limpiar y atajo opcional.
 *   <SearchInput value={q} onChange={setQ} placeholder="Buscar expediente o cliente" />
 *   <SearchInput … shortcut="⌘K" onShortcut={abrirPaleta} />   (admin)
 * `onChange` recibe el string (no el evento).
 */
export const SearchInput = forwardRef(function SearchInput(
  { value = '', onChange, placeholder = 'Buscar…', shortcut, className, inputClassName, size = 'md', id, 'aria-label': ariaLabel, autoFocus, onKeyDown, ...props },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  const h = { sm: 'h-8 text-13', md: 'h-9 text-sm', lg: 'h-10 text-sm' }[size] || 'h-9 text-sm';
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
      <input
        ref={ref}
        id={fid}
        type="search"
        role="searchbox"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel || placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { onChange?.(''); } onKeyDown?.(e); }}
        className={cn(
          'w-full bg-surface text-ink-900 border border-line-strong rounded-md pl-9 transition-colors duration-150 placeholder:text-ink-400',
          'hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          '[&::-webkit-search-cancel-button]:hidden',
          h, value ? 'pr-9' : shortcut ? 'pr-14' : 'pr-3', inputClassName,
        )}
        {...props}
      />
      {value ? (
        <button type="button" onClick={() => onChange?.('')} aria-label="Limpiar búsqueda"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded text-ink-500 hover:text-ink-900 hover:bg-neutral-bg">
          <X size={14} />
        </button>
      ) : shortcut ? (
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center h-5 px-1.5 rounded border border-line bg-canvas text-xs text-ink-500 font-sans pointer-events-none">{shortcut}</kbd>
      ) : null}
    </div>
  );
});
