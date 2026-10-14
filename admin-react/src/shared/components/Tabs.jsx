import { useRef, useId } from 'react';
import { cn } from '../lib/utils';
import { CountBadge } from './StatusBadge';

function useArrowNav(listRef, onChange, tabs) {
  return (e, i) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (keys[e.key]) next = (i + keys[e.key] + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange?.(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
}

/**
 * Pestañas (role="tablist", flechas, contador).
 *   <Tabs tabs={[{ id: 'pend', label: 'Pendientes', count: 2 }, { id: 'pag', label: 'Pagados' }]}
 *         value={tab} onChange={setTab} />
 * El contenido lo pinta la página (`<div role="tabpanel" aria-labelledby=…>` opcional).
 * `variant`: underline (por defecto) · pills.
 */
export function Tabs({ tabs = [], value, onChange, variant = 'underline', className, 'aria-label': ariaLabel = 'Pestañas', size = 'md' }) {
  const listRef = useRef(null);
  const base = useId();
  const onKey = useArrowNav(listRef, onChange, tabs);
  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel}
      className={cn('flex items-center gap-1 overflow-x-auto scrollbar-thin -mb-px', variant === 'underline' && 'border-b border-line', className)}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            id={`${base}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange?.(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 disabled:opacity-50',
              size === 'sm' ? 'text-13 h-8' : 'text-sm h-10',
              variant === 'underline'
                ? cn('px-3 border-b-2 -mb-px', active ? 'border-brand-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900 hover:border-line-strong')
                : cn('px-3 rounded-md h-8', active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-neutral-bg'),
            )}
          >
            {Icon && <Icon size={16} />}
            {t.label}
            {t.count !== undefined && <CountBadge value={t.count} tone={active && variant === 'pills' ? 'sidebar' : 'neutral'} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Control segmentado (grupo de opciones excluyentes, estilo "radio" visual).
 *   <SegmentedControl options={[{ id: 'cards', label: 'Tarjetas', icon: LayoutGrid }, { id: 'table', label: 'Tabla' }]}
 *                     value={view} onChange={setView} />
 */
export function SegmentedControl({ options = [], value, onChange, className, 'aria-label': ariaLabel = 'Vista', size = 'md' }) {
  const listRef = useRef(null);
  const onKey = useArrowNav(listRef, onChange, options);
  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-md bg-neutral-bg border border-line', className)}>
      {options.map((o, i) => {
        const active = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={o.label && !o.hideLabel ? undefined : o.label}
            title={o.hideLabel ? o.label : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(o.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[5px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
              size === 'sm' ? 'h-7 px-2.5 text-13' : 'h-8 px-3 text-13',
              active ? 'bg-surface text-ink-900 shadow-card border border-line' : 'text-ink-700 hover:text-ink-900 border border-transparent',
            )}
          >
            {Icon && <Icon size={16} />}
            {!o.hideLabel && o.label}
          </button>
        );
      })}
    </div>
  );
}
