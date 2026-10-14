import { Link } from 'react-router-dom';
import { cn } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { StatusBadge, ProcessStepper, Avatar } from '../../../shared/components/UI';
import { ChevronRight } from '../../../shared/components/Icons';
import { nombreExpediente, tipoExpediente, etapaDe, esCerrado } from './lib';

/**
 * Una tarjeta por expediente: número y tipo, qué se busca, la etapa, el
 * agente y cuándo cambió por última vez. Toda la tarjeta es el enlace al
 * detalle (el nombre accesible es "IMP-00035 · Búsqueda <lancha>").
 */
export default function TarjetaExpediente({ order, href }) {
  const nombre = nombreExpediente(order);
  const cerrado = esCerrado(order);
  const etapa = etapaDe(order);
  const cambio = order.ranking_updated_at || order.updated_at || order.created_at;
  const mostrarPlan = order.plan_name && order.plan_name !== nombre;

  return (
    <article className={cn(
      'group relative flex w-full flex-col gap-4 bg-surface rounded-lg border border-line shadow-card p-5 transition-colors duration-150',
      'hover:border-ink-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500',
      cerrado && 'bg-canvas',
    )}>
      <div className="flex items-start justify-between gap-3">
        <Link to={href} className="min-w-0 outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']">
          <span className="block text-13 text-ink-500 tabular">{order.order_number} · {tipoExpediente(order)}</span>
          <span className="mt-0.5 block text-base font-semibold text-ink-900 leading-6 line-clamp-2">{nombre}</span>
        </Link>
        <StatusBadge kind="expediente" status={order.status} dot className="shrink-0" />
      </div>

      {mostrarPlan && <p className="-mt-2 text-13 text-ink-500 truncate">{order.plan_name}</p>}

      {cerrado ? (
        <p className="text-13 text-ink-500 tabular">Se cerró en la etapa {etapa} de {ETAPAS_EXPEDIENTE.length} · {ETAPAS_EXPEDIENTE[etapa - 1]?.label}</p>
      ) : (
        <ProcessStepper compact current={etapa} />
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-13 text-ink-500">
        {order.agent_name ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={order.agent_name} size="xs" />
            <span className="truncate">{order.agent_name}</span>
          </span>
        ) : <span>Sin agente asignado</span>}
        <span className="flex shrink-0 items-center gap-1 tabular" title={fmtDateLarga(cambio, { hora: true })}>
          {fmtRelativo(cambio)}
          <ChevronRight size={14} className="text-ink-400 transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
