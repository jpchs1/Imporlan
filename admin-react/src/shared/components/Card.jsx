import { Children, isValidElement } from 'react';
import { cn } from '../lib/utils';

const PAD = {
  md: 'p-(--card-pad)',
  sm: 'p-4',
  none: '',
};

function CardHeader({ title, description, actions, children, className, as: tag = 'h2' }) {
  const Tag = tag;
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-(--card-pad) pt-5 pb-4 border-b border-line', className)}>
      <div className="min-w-0 flex-1">
        {title && <Tag className="text-base font-semibold text-ink-900 leading-6 truncate">{title}</Tag>}
        {description && <p className="text-13 text-ink-500 mt-0.5">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

function CardBody({ children, className, padding = 'md' }) {
  return <div className={cn(padding === 'none' ? '' : 'px-(--card-pad) py-5', className)}>{children}</div>;
}

function CardFooter({ children, className, align = 'end' }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 px-(--card-pad) py-3 border-t border-line bg-canvas rounded-b-lg',
      align === 'end' && 'justify-end', align === 'between' && 'justify-between', className)}>
      {children}
    </div>
  );
}

/**
 * Tarjeta: surface + borde line + shadow-card, radio 12. Padding 24 (16 en
 * móvil) vía `--card-pad`; `padding="none"` para tablas.
 *
 * Con secciones, el padding lo ponen ellas:
 *   <Card>
 *     <Card.Header title="Ranking" description="…" actions={<Button/>} />
 *     <Card.Body>…</Card.Body>
 *     <Card.Footer>…</Card.Footer>
 *   </Card>
 */
export function Card({ children, className, padding, as: tag = 'div', ...props }) {
  const Tag = tag;
  const conSecciones = padding === undefined && Children.toArray(children).some(c => isValidElement(c) && (c.type === CardHeader || c.type === CardBody || c.type === CardFooter));
  const pad = padding ?? (conSecciones ? 'none' : 'md');
  return (
    <Tag className={cn('bg-surface rounded-lg border border-line shadow-card', PAD[pad] ?? PAD.md, className)} {...props}>
      {children}
    </Tag>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

/** Título de sección dentro de una página (fuera de cards). */
export function SectionTitle({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-3', className)}>
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description && <p className="text-13 text-ink-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Par etiqueta/valor para fichas (ej. datos del expediente). */
export function DescriptionList({ items = [], cols = 2, className, dense = false }) {
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols] || 'sm:grid-cols-2';
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6', dense ? 'gap-y-2' : 'gap-y-4', grid, className)}>
      {items.map((it, i) => (
        <div key={it.key || i} className={cn(it.full && 'sm:col-span-full', 'min-w-0')}>
          <dt className="eyebrow">{it.label}</dt>
          <dd className={cn('mt-1 text-sm text-ink-900 break-words', it.mono && 'font-mono text-13')}>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
