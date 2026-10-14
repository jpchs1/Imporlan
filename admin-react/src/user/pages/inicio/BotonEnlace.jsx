import { Link } from 'react-router-dom';
import { cn } from '../../../shared/lib/utils';

/**
 * Enlace con aspecto de botón del kit. `Button` pinta un <button>; cuando el
 * destino es una URL (WhatsApp, correo, deckeva.cl) o una ruta del panel, lo
 * correcto es un <a> / <Link>: se abre con Ctrl+clic, lo lee bien un lector de
 * pantalla y no hace falta `window.open`.
 *
 *   <BotonEnlace href="https://wa.me/…" icon={WhatsAppIcon} variant="secondary">WhatsApp</BotonEnlace>
 *   <BotonEnlace to="/payments" size="sm">Pagar</BotonEnlace>
 *
 * Candidato a `shared/` (Button as="a").
 */
const VARIANTS = {
  primary: 'bg-brand-600 text-white border-transparent hover:bg-brand-700 shadow-card',
  secondary: 'bg-surface text-ink-700 border-line-strong hover:bg-canvas hover:border-ink-400',
  ghost: 'bg-transparent text-ink-700 border-transparent hover:bg-neutral-bg',
  link: 'bg-transparent text-brand-600 border-transparent hover:underline px-0 h-auto',
};
const SIZES = {
  sm: 'h-8 px-3 text-13 gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-10 px-4 text-sm gap-2 rounded-md',
};
const ICON_SIZE = { sm: 14, md: 16, lg: 18 };

export function BotonEnlace({ href, to, children, variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, block = false, className, external, ...props }) {
  const cls = cn(
    'inline-flex items-center justify-center font-medium border select-none text-center no-underline',
    'transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    VARIANTS[variant] || VARIANTS.secondary,
    variant === 'link' ? (size === 'sm' ? 'text-13' : 'text-sm') : (SIZES[size] || SIZES.md),
    block && 'w-full',
    className,
  );
  const inner = (
    <>
      {Icon && <Icon size={ICON_SIZE[size] || 16} className="shrink-0" />}
      {children}
      {IconRight && <IconRight size={ICON_SIZE[size] || 16} className="shrink-0" />}
    </>
  );
  if (to) return <Link to={to} className={cls} {...props}>{inner}</Link>;
  const esExterno = external ?? /^https?:/i.test(href || '');
  return (
    <a href={href} className={cls} target={esExterno ? '_blank' : undefined} rel={esExterno ? 'noopener noreferrer' : undefined} {...props}>
      {inner}
    </a>
  );
}
