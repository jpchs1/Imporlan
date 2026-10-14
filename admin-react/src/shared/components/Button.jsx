import { forwardRef } from 'react';
import { cn } from '../lib/utils';
import { Loader } from './Icons';

const VARIANTS = {
  primary: 'bg-brand-600 text-white border-transparent hover:bg-brand-700 shadow-card',
  secondary: 'bg-surface text-ink-700 border-line-strong hover:bg-canvas hover:border-ink-400',
  ghost: 'bg-transparent text-ink-700 border-transparent hover:bg-neutral-bg',
  danger: 'bg-danger text-white border-transparent hover:bg-danger-strong',
  'danger-ghost': 'bg-transparent text-danger border-transparent hover:bg-danger-bg',
  link: 'bg-transparent text-brand-600 border-transparent hover:underline px-0 h-auto',
  /* compatibilidad: el cian del panel viejo es ahora el primario */
  accent: 'bg-brand-600 text-white border-transparent hover:bg-brand-700 shadow-card',
};

const SIZES = {
  sm: 'h-8 px-3 text-13 gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-10 px-4 text-sm gap-2 rounded-md',
};

const ICON_SIZE = { sm: 14, md: 16, lg: 18 };

/**
 * Botón. `variant`: primary · secondary · ghost · danger · danger-ghost · link.
 * `size`: sm (32) · md (36) · lg (40). `loading` mantiene el ancho y pone
 * aria-busy. `icon` / `iconRight` reciben un componente de Icons.
 */
export const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', className, loading = false, disabled, icon: Icon, iconRight: IconRight, type = 'button', block = false, ...props },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center font-medium border select-none text-center',
        'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.primary,
        variant === 'link' ? (size === 'sm' ? 'text-13' : 'text-sm') : (SIZES[size] || SIZES.md),
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <Loader size={ICON_SIZE[size] || 16} className="spin" />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-[inherit]', loading && 'invisible')}>
        {Icon && <Icon size={ICON_SIZE[size] || 16} className="shrink-0" />}
        {children}
        {IconRight && <IconRight size={ICON_SIZE[size] || 16} className="shrink-0" />}
      </span>
    </button>
  );
});

const ICON_BTN_SIZES = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' };

/**
 * Botón de solo ícono. `aria-label` es obligatorio (es el nombre accesible y
 * el tooltip). `variant`: ghost (por defecto) · secondary · danger-ghost.
 */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, 'aria-label': ariaLabel, label, size = 'md', variant = 'ghost', className, loading = false, disabled, type = 'button', title, ...props },
  ref,
) {
  const name = ariaLabel || label;
  if (import.meta.env?.DEV && !name) console.warn('IconButton sin aria-label');
  return (
    <button
      ref={ref}
      type={type}
      aria-label={name}
      title={title ?? name}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md border shrink-0',
        'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.ghost,
        ICON_BTN_SIZES[size] || ICON_BTN_SIZES.md,
        className,
      )}
      {...props}
    >
      {loading ? <Loader size={ICON_SIZE[size] || 16} className="spin" /> : Icon ? <Icon size={ICON_SIZE[size] || 16} /> : null}
    </button>
  );
});

/** Fila de botones con separación estándar; `align`: start · end · between. */
export function ButtonGroup({ children, align = 'start', className, wrap = true }) {
  return (
    <div className={cn('flex items-center gap-2', wrap && 'flex-wrap', align === 'end' && 'justify-end', align === 'between' && 'justify-between', className)}>
      {children}
    </div>
  );
}
