import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ArrowLeft } from './Icons';

/**
 * Cabecera de página (reemplaza todos los heros). Una por ruta.
 *
 *   <PageHeader
 *     eyebrow="Expedientes"                 opcional, 12 px mayúsculas
 *     title="IMP-00035 · Cobalt R30"        24/600
 *     description="Una línea de contexto."  14/ink-500
 *     meta={<StatusBadge … />}              chips de estado al lado del título
 *     actions={<><Button variant="secondary">…</Button><Button>…</Button></>}
 *     backTo="/expedientes" backLabel="Expedientes"   enlace "← Expedientes"
 *   />
 *
 * Compatibilidad: `subtitle` ≡ description, `action` ≡ actions.
 * En móvil las acciones pasan a una fila bajo el título.
 */
export function PageHeader({ eyebrow, title, description, subtitle, actions, action, meta, backTo, backLabel = 'Volver', className, children }) {
  const desc = description ?? subtitle;
  const acts = actions ?? action;
  return (
    <header className={cn('mb-6', className)}>
      {backTo && (
        <Link to={backTo} className="inline-flex items-center gap-1 text-13 font-medium text-ink-500 hover:text-ink-900 mb-2 -ml-0.5">
          <ArrowLeft size={14} /> {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold text-ink-900 tracking-tight leading-8">{title}</h1>
            {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
          {desc && <p className="text-sm text-ink-500 mt-1 max-w-3xl">{desc}</p>}
          {children}
        </div>
        {acts && <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">{acts}</div>}
      </div>
    </header>
  );
}
