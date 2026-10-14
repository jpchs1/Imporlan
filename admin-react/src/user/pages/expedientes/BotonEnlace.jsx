import { cn } from '../../../shared/lib/utils';

const VARIANTS = {
  primary: 'bg-brand-600 text-white border-transparent hover:bg-brand-700 shadow-card',
  secondary: 'bg-surface text-ink-700 border-line-strong hover:bg-canvas hover:border-ink-400',
  ghost: 'bg-transparent text-ink-700 border-transparent hover:bg-neutral-bg',
};

const SIZES = {
  sm: 'h-8 px-3 text-13 gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
};

const ICON_SIZE = { sm: 14, md: 16, lg: 18 };

/**
 * Un enlace con la forma de `Button`: para abrir anuncios, WhatsApp, PDF y
 * archivos sin convertir un `<a>` en un `<button>` con window.open.
 * Candidato a promover a `shared/` como `Button href` / `as="a"`.
 */
export default function BotonEnlace({ href, children, variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, external = true, download, className, block = false, ...props }) {
  return (
    <a
      href={href}
      target={external && !download ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      download={download}
      className={cn(
        'inline-flex items-center justify-center font-medium border rounded-md select-none text-center whitespace-nowrap',
        'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        VARIANTS[variant] || VARIANTS.secondary,
        SIZES[size] || SIZES.md,
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={ICON_SIZE[size] || 16} className="shrink-0" />}
      {children}
      {IconRight && <IconRight size={ICON_SIZE[size] || 16} className="shrink-0" />}
    </a>
  );
}
