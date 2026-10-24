import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { hitoEnCurso } from '../../../shared/lib/importacion';
import { StatusBadge, ProcessStepper, Avatar, Badge } from '../../../shared/components/UI';
import { ChevronRight, Ship } from '../../../shared/components/Icons';
import { nombreExpediente, tipoExpediente, etapaDe, esCerrado } from './lib';

/**
 * Una tarjeta por expediente: número y tipo, qué se busca, la etapa, el
 * agente y cuándo cambió por última vez. Toda la tarjeta es el enlace al
 * detalle (el nombre accesible es "IMP-00035 · Búsqueda <lancha>").
 * Con una lancha elegida (`order.eleccion`, que en la lista trae título y
 * foto) muestra «Elegiste: …» y el hito en curso como chip.
 */
export default function TarjetaExpediente({ order, href }) {
  const nombre = nombreExpediente(order);
  const [coverError, setCoverError] = useState('');
  const cover = order.eleccion?.image_url || order.image_url;
  const hasCover = cover && coverError !== cover;
  const cerrado = esCerrado(order);
  const etapa = etapaDe(order);
  const cambio = order.ranking_updated_at || order.updated_at || order.created_at;
  const mostrarPlan = order.plan_name && order.plan_name !== nombre;

  return (
    <article className={cn(
      'exp-client-card group relative flex w-full flex-col gap-4 bg-surface rounded-lg border border-line shadow-card p-5 transition-colors duration-150',
      'hover:border-ink-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500',
      cerrado && 'bg-canvas',
    )}>
      <div className="exp-client-card__cover">
        {hasCover ? <img src={cover} alt="" loading="lazy" onError={() => setCoverError(cover)} /> : <Ship size={48} strokeWidth={1} />}
        <div className="exp-client-card__status"><StatusBadge kind="expediente" status={order.status} dot /></div>
      </div>
      <div className="exp-client-card__body">
      <div className="flex items-start justify-between gap-3">
        <Link to={href} className="min-w-0 outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']">
          <span className="exp-card-number tabular">{order.order_number} · {tipoExpediente(order)}</span>
          <span className="exp-card-title block text-base font-semibold text-ink-900 leading-6 line-clamp-2">{nombre}</span>
        </Link>
      </div>

      {mostrarPlan && <p className="-mt-2 text-13 text-ink-500 truncate">{order.plan_name}</p>}

      {order.eleccion && !cerrado && <LanchaElegida eleccion={order.eleccion} />}

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
      </div>
    </article>
  );
}

/** «Elegiste: {lancha}» con mini foto y el hito en curso como chip. */
export function LanchaElegida({ eleccion, className }) {
  const [imgError, setImgError] = useState(false);
  const hito = hitoEnCurso(eleccion);
  const chip = hito ? hito.enCursoCorto : 'Entregada';
  const hayFoto = eleccion.image_url && !imgError;
  return (
    <div className={cn('flex items-center gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2', className)}>
      <span className="flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-neutral-bg text-ink-500">
        {hayFoto ? <img src={eleccion.image_url} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} /> : <Ship size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 text-ink-900"><span className="font-medium">Elegiste:</span> {eleccion.title || 'tu lancha'}</span>
        <Badge tone={hito ? 'brand' : 'success'} size="sm" className="mt-1">{chip}</Badge>
      </span>
    </div>
  );
}
