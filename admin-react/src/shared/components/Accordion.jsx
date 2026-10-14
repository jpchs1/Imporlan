import { useState, useId } from 'react';
import { cn } from '../lib/utils';
import { ChevronDown } from './Icons';

/**
 * Acordeón simple (secciones plegables: FAQ, secciones de una inspección).
 *   <Accordion>
 *     <Accordion.Item title="Motor" meta={<Badge tone="success">9/10</Badge>} defaultOpen>…</Accordion.Item>
 *     <Accordion.Item title="Casco">…</Accordion.Item>
 *   </Accordion>
 */
export function Accordion({ children, className, flush = false }) {
  return <div className={cn(flush ? 'divide-y divide-line' : 'bg-surface border border-line rounded-lg divide-y divide-line shadow-card', className)}>{children}</div>;
}

function Item({ title, meta, children, defaultOpen = false, open: openProp, onToggle, className }) {
  const [openState, setOpen] = useState(defaultOpen);
  const open = openProp ?? openState;
  const id = useId();
  return (
    <div className={className}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-p`}
          id={`${id}-b`}
          onClick={() => { onToggle?.(!open); if (openProp === undefined) setOpen(o => !o); }}
          className="w-full flex items-center gap-3 px-(--card-pad) py-3.5 text-left text-sm font-medium text-ink-900 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
        >
          <span className="flex-1 min-w-0 truncate">{title}</span>
          {meta && <span className="shrink-0 flex items-center gap-2">{meta}</span>}
          <ChevronDown size={16} className={cn('text-ink-500 shrink-0 transition-transform duration-150', open && 'rotate-180')} />
        </button>
      </h3>
      {open && (
        <div id={`${id}-p`} role="region" aria-labelledby={`${id}-b`} className="px-(--card-pad) pb-4 text-sm text-ink-700">
          {children}
        </div>
      )}
    </div>
  );
}

Accordion.Item = Item;
