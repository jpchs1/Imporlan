import { cn } from '../lib/utils';
import { CountBadge } from './StatusBadge';
import { X } from './Icons';

/**
 * Chips de filtro (una fila, scroll horizontal en móvil).
 *   <FilterChips options={[{ id: 'all', label: 'Todos', count: 7 }, { id: 'activos', label: 'Activos', count: 2 }]}
 *                value={filtro} onChange={setFiltro} />
 * `multiple` permite varios activos (`value` es un array). Cada chip lleva
 * aria-pressed. `onClear` muestra un chip "Limpiar" cuando hay algo activo.
 */
export function FilterChips({ options = [], value, onChange, multiple = false, className, 'aria-label': ariaLabel = 'Filtros', onClear, size = 'md' }) {
  const isActive = (id) => multiple ? (Array.isArray(value) && value.includes(id)) : value === id;
  const toggle = (id) => {
    if (!multiple) return onChange?.(id);
    const set = new Set(Array.isArray(value) ? value : []);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange?.([...set]);
  };
  const anyActive = multiple ? (Array.isArray(value) && value.length > 0) : (value !== undefined && value !== null && value !== options[0]?.id);
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 py-0.5', className)}>
      {options.map(o => {
        const active = isActive(o.id);
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm border font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              size === 'sm' ? 'h-7 px-2.5 text-13' : 'h-8 px-3 text-13',
              active ? 'bg-ink-900 text-white border-ink-900' : 'bg-surface text-ink-700 border-line-strong hover:bg-canvas hover:border-ink-400',
            )}
          >
            {Icon && <Icon size={14} />}
            {o.label}
            {o.count !== undefined && <CountBadge value={o.count} tone={active ? 'sidebar' : 'neutral'} />}
          </button>
        );
      })}
      {onClear && anyActive && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 h-8 px-2 text-13 text-ink-500 hover:text-ink-900 shrink-0">
          <X size={14} /> Limpiar
        </button>
      )}
    </div>
  );
}
