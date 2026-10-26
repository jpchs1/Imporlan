import { fmtDate } from '../../../shared/lib/utils';
import { tituloLancha, planDePagos, pagosConCobros, queSigue } from '../../../shared/lib/importacion';
import { inspeccionNoApta, devolucionPedida } from '../../../shared/lib/inspeccion';
import { estadoCotizacion } from '../../components/quote-state';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { Button, StatusBadge } from '../../../shared/components/UI';
import { ArrowUpRight, Calendar, Check, ChevronLeft, ChevronRight, Compass, FileText, Images, Layers, Ship, User } from '../../../shared/components/Icons';
import { irASeccionExpediente } from '../../../shared/lib/expediente-navigation';

export function ResumenExpediente({ detail, links, elegida, archivos, equipoChile, importacion }) {
  const opciones = links.filter(l => (l.url || '').trim());
  const cotizadas = opciones.filter(l => estadoCotizacion(l).vigente).length;
  const siguienteImportacion = queSigue(detail.eleccion, pagosConCobros(planDePagos(elegida), importacion.cobros || []));
  const hito = siguienteImportacion.hito;
  let avance = { label: hito?.enCursoCorto || 'Revisar la operación', text: hito ? `Próximo hito: ${hito.label}. Revisa el avance y la documentación de la operación.` : 'Consulta los avances y la documentación de la embarcación elegida.', target: 'importacion', action: 'Ir a la operación' };
  if (equipoChile && detail.eleccion) {
    if (importacion.cargandoCobros) avance = { label: 'Consultando pagos', text: 'Estamos actualizando los cobros antes de indicar el siguiente paso.', target: 'importacion', action: 'Ver operación' };
    else if (importacion.cobrosError) avance = { label: 'Revisar estado de pagos', text: 'No se pudo confirmar el estado de los cobros. Reintenta la consulta en la operación.', target: 'importacion', action: 'Revisar pagos' };
    else if (siguienteImportacion.tipo === 'pago') avance = { label: siguienteImportacion.pago.n ? `Pago ${siguienteImportacion.pago.n} pendiente` : 'Cobro pendiente', text: 'Revisa el cobro y coordina su pago antes de continuar con el siguiente hito.', target: 'importacion', action: 'Revisar pago' };
    else if (!estadoCotizacion(elegida).vigente) avance = { label: 'Revisar la cotización', text: 'Completa la cotización de la embarcación elegida para mantener al día el total y su plan de pagos.', target: 'ranking', action: 'Revisar cotización' };
  }
  const cerrado = ['completed', 'expired', 'canceled', 'cancelled'].includes(detail.status);
  const siguiente = cerrado
    ? { label: 'Expediente finalizado', text: 'Consulta las opciones y la documentación de esta operación.', target: 'archivos', action: 'Ver documentación' }
    : inspeccionNoApta(detail.eleccion)
      ? { label: devolucionPedida(detail.eleccion) ? 'Revisar solicitud de devolución' : 'Revisar inspección no apta', text: equipoChile ? 'Revisa el resultado de la inspección y coordina con el cliente cómo continuar.' : 'Revisa el resultado de la inspección y los avances de la operación.', target: 'importacion', action: 'Revisar la operación' }
    : detail.eleccion
      ? avance
      : opciones.length
        ? { label: equipoChile && cotizadas < opciones.length ? 'Preparar cotizaciones' : 'Revisar las opciones', text: equipoChile ? `${cotizadas} de ${opciones.length} embarcaciones cotizadas. Compara las opciones y prepara el siguiente paso con el cliente.` : 'Revisa las fichas y mantén al día los avances de la operación.', target: 'ranking', action: 'Revisar embarcaciones' }
        : { label: 'Agregar las primeras opciones', text: 'Incorpora los anuncios para comenzar a trabajar en este expediente.', target: 'ranking', action: 'Ir a las opciones' };
  const count = category => archivos.loading || archivos.error ? '—' : archivos.files.filter(f => category.includes(f.category)).length;
  return <section className="exp-header admin-exp-overview">
    <div className="admin-exp-overview__main">
      <div className="admin-exp-overview__eyebrow"><span>Expediente</span><span className="tabular">{detail.order_number}</span><StatusBadge kind="expediente" status={detail.status} dot /></div>
      <h1>{detail.customer_name || detail.order_number}</h1>
      <p className="admin-exp-overview__description">{elegida ? tituloLancha(elegida) : detail.asset_name || detail.requirement_name || 'Búsqueda e importación de embarcaciones'}</p>
      <div className="admin-exp-overview__meta">
        <span><Layers size={14} />{detail.plan_name || 'Plan por definir'}</span>
        <span><User size={14} />{detail.agent_name || 'Agente sin asignar'}</span>
        <span><Calendar size={14} />{fmtDate(detail.purchase_date || detail.created_at)}</span>
      </div>
    </div>
    <aside className="admin-exp-next" aria-label="Siguiente paso del expediente">
      <span className="admin-exp-next__label"><Compass size={14} /> Siguiente paso</span>
      <h2>{siguiente.label}</h2>
      <p>{siguiente.text}</p>
      <Button size="sm" variant="secondary" iconRight={ArrowUpRight} onClick={() => irASeccionExpediente(siguiente.target)}>{siguiente.action}</Button>
    </aside>
    <div className="admin-exp-overview__stats" role="group" aria-label="Resumen del expediente">
      {[{ icon: Ship, label: 'Embarcaciones', value: opciones.length }, { icon: FileText, label: 'Documentos', value: count(['document']) }, { icon: Images, label: 'Fotos y videos', value: count(['image', 'video']) }].map(item => { const Icon = item.icon; return <div key={item.label}><Icon size={17} /><span>{item.label}</span><strong className="tabular">{item.value}</strong></div>; })}
      <div className="admin-exp-overview__visibility"><span className={detail.visible_to_client == 1 ? 'is-visible' : ''} />{detail.visible_to_client == 1 ? 'Visible para el cliente' : 'Oculto para el cliente'}</div>
    </div>
  </section>;
}

export function AvanceExpediente({ detail, onTimelineStep, etapaEleccion }) {
  const actual = Math.min(ETAPAS_EXPEDIENTE.length, Math.max(1, Number(detail.timeline_step) || 1));
  return <section id="etapa" className="exp-section admin-exp-progress" aria-labelledby="admin-exp-progress-title">
    <div className="admin-exp-progress__heading">
      <div><span className="admin-exp-kicker">Estado de la operación</span><h2 id="admin-exp-progress-title">Avance de la operación</h2></div>
      <div className="admin-exp-progress__controls">
        <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Retroceder etapa" title="Retroceder etapa" disabled={actual <= 1} onClick={() => onTimelineStep(-1)} />
        <span className="tabular">{String(actual).padStart(2, '0')} <span>/ 05</span></span>
        <Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Avanzar etapa" title="Avanzar etapa" disabled={actual >= 5} onClick={() => onTimelineStep(1)} />
      </div>
    </div>
    <ol className="admin-exp-progress__steps" aria-label="Etapas de la operación">
      {ETAPAS_EXPEDIENTE.map(etapa => <li key={etapa.num} className={etapa.num === actual ? 'is-current' : etapa.num < actual ? 'is-done' : ''} aria-current={etapa.num === actual ? 'step' : undefined}>
        <span className="admin-exp-progress__number" aria-hidden="true">{etapa.num < actual ? <Check size={13} /> : String(etapa.num).padStart(2, '0')}</span>
        <span>{etapa.label}</span>
      </li>)}
    </ol>
    {detail.eleccion && etapaEleccion > 0 && etapaEleccion !== actual && <p className="admin-exp-progress__note">La etapa de la elección es {ETAPAS_EXPEDIENTE[etapaEleccion - 1]?.label}. Los hitos de importación actualizan el avance automáticamente.</p>}
  </section>;
}
