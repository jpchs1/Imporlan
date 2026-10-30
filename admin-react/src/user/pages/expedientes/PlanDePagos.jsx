import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Money, StatusBadge, Badge } from '../../../shared/components/UI';
import { Check, Receipt, FileSearch } from '../../../shared/components/Icons';
import { BotonEnlace } from '../inicio/BotonEnlace';
import { rutaPagar } from './lib';
import { cuandoLlegaPago, cuadrePagos, pagoEnRevision, pagoEnConciliacion, comprobanteRechazado } from '../../../shared/lib/importacion';
import PaymentOverview from '../../../shared/components/PaymentOverview';
import { inspeccionNoApta, devolucionPedida, pago1AbonadoDeOtra } from '../../../shared/lib/inspeccion';

/**
 * Plan de pagos de la lancha elegida (Pago 1/2/3 con su % y monto) cruzado
 * con los cobros que el equipo ya creó: Pagado (fecha) · Por pagar (botón) ·
 * cuándo llega (cuandoLlegaPago, el mismo hito que lo crea en el servidor). Los cobros del expediente que no
 * calzan con un pago del plan van en «Otros cobros». Recibe el resultado de
 * pagosConCobros(); no calcula nada.
 *
 * Con la lancha declinada tras la inspección el plan queda en pausa: no se
 * ofrece pagar nada (lo pendiente se anula o lo reemplaza el de la lancha que
 * elija) y los pagos que faltan dicen que dependen de esa elección.
 */
export default function PlanDePagos({ pagos, otros, eleccion, total = 0, cobros = [], pagosError = false, className }) {
  const plan = pagos || [];
  const extra = otros || [];
  if (plan.length === 0 && extra.length === 0) return null;
  const pagados = plan.filter(p => p.estado === 'pagado').length;
  const noApta = inspeccionNoApta(eleccion);
  const devolucion = devolucionPedida(eleccion);

  return (
    <section aria-labelledby="plan-de-pagos" id="plan-de-pagos" className={className}>
      {plan.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h3 id="plan-de-pagos" className="text-sm font-semibold text-ink-900">Plan de pagos</h3>
            <p className="text-13 text-ink-500 tabular">{pagados} de {plan.length} {pagados === 1 ? 'pagado' : 'pagados'}</p>
          </div>
          {noApta && (
            <p className="mt-1 text-13 text-ink-500">
              {devolucion
                ? 'Este plan era el de la lancha que declinaste: con la devolución pedida, no se cobra nada más.'
                : 'Este plan es el de la lancha que declinaste. Si eliges otra, el plan pasa a ser el de la nueva y lo que ya pagaste se abona.'}
            </p>
          )}
          {total > 0 && !pagosError && <div className="mt-4"><PaymentOverview total={total} cuadre={cuadrePagos(plan, cobros, total)} /></div>}
          <ol className="payment-plan__cards" aria-label="Pagos del plan">
            {plan.map(p => <FilaPago key={p.n} pago={p} eleccion={eleccion} noApta={noApta} devolucion={devolucion} />)}
          </ol>
        </>
      )}

      {extra.length > 0 && (
        <>
          <h3 className={cn('text-sm font-semibold text-ink-900', plan.length > 0 ? 'mt-5' : '')} id={plan.length > 0 ? undefined : 'plan-de-pagos'}>Otros cobros</h3>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line" aria-label="Otros cobros del expediente">
            {extra.map(r => <FilaCobro key={r.id} cobro={r} enPausa={noApta} />)}
          </ul>
        </>
      )}
    </section>
  );
}

function FilaPago({ pago, eleccion, noApta, devolucion }) {
  const { n, pct, clp, cobro, estado } = pago;
  const monto = cobro ? Number(cobro.amount_clp) : clp;
  const pagado = estado === 'pagado';
  const revision = pagoEnRevision(cobro);
  const reemplazo = comprobanteRechazado(cobro);
  const conciliacion = pagoEnConciliacion(pago, eleccion);
  const porPagar = estado === 'por_pagar' && !noApta && !revision && !reemplazo && !conciliacion;
  const enPausa = estado === 'por_pagar' && noApta;
  const propositos = { 1: 'Selección e inspección', 2: 'Compra de tu lancha', 3: 'Envío a Chile' };
  let detalle;
  if (pagado) {
    let nota = '';
    if (noApta && n === 1) nota = devolucion ? ' · en devolución' : ' · se abona a la lancha que elijas';
    else if (pago1AbonadoDeOtra(cobro, eleccion)) nota = ' · abonado desde tu elección anterior';
    detalle = `Pagado${cobro?.paid_at ? ` el ${fmtDateLarga(cobro.paid_at)}` : ''}${nota}`;
  } else if (enPausa) detalle = devolucion ? 'Anulado: no sigues con esta lancha' : 'En pausa hasta que elijas otra lancha';
  else if (revision) detalle = 'Comprobante recibido. Estamos verificando el ingreso; no vuelvas a transferir.';
  else if (reemplazo) detalle = 'Revisa la observación del equipo y adjunta el comprobante corregido.';
  else if (conciliacion) detalle = 'El equipo revisa el registro de este pago antes de solicitar otra transferencia.';
  else if (porPagar) detalle = 'Si realizas una transferencia, adjunta aquí el comprobante.';
  else if (noApta) detalle = devolucion ? 'No corresponde' : 'Depende de la lancha que elijas';
  else detalle = cuandoLlegaPago(n, eleccion);
  return <li className={cn('payment-plan__card', pagado && 'is-paid', porPagar && 'is-due')}>
    <div className="payment-plan__top"><span className="payment-plan__number" aria-hidden="true">{pagado ? <Check size={16} /> : n}</span><span>{pct}% del total</span></div>
    <h4 className="payment-plan__title">Pago {n}</h4><p className="payment-plan__purpose">{propositos[n]}</p>
    <div className="payment-plan__amount"><Money clp={monto} usd={cobro?.amount_usd > 0 ? cobro.amount_usd : undefined} size="lg" tone={estado === 'por_cobrar' ? 'muted' : undefined} /></div>
    <div className="payment-plan__status">
      {pagado ? <StatusBadge kind="pago" status="paid" dot /> : enPausa ? <Badge tone="neutral">{devolucion ? 'Anulado' : 'En pausa'}</Badge> : revision ? <Badge tone="info" dot>En revisión</Badge> : reemplazo ? <Badge tone="warning">Reemplazar comprobante</Badge> : conciliacion ? <Badge tone="info">En conciliación</Badge> : porPagar ? <Badge tone="brand" dot>Disponible para pagar</Badge> : <Badge tone="neutral">{noApta ? (devolucion ? 'No corresponde' : 'Según la lancha') : 'Próxima etapa'}</Badge>}
      <p>{detalle}</p>
      {porPagar && <BotonEnlace to={rutaPagar(cobro)} variant="primary" size="sm" icon={Receipt}>Realizar Pago {n}</BotonEnlace>}
      {reemplazo && !noApta && <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={FileSearch}>Reemplazar comprobante</BotonEnlace>}
      {revision && !noApta && <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={FileSearch}>Ver comprobante</BotonEnlace>}
      {pagado && <BotonEnlace to="/payments" variant="secondary" size="sm" icon={Receipt}>Ver registro y comprobantes</BotonEnlace>}
    </div>
  </li>;
}

function FilaCobro({ cobro, enPausa = false }) {
  const pendiente = cobro.status === 'pending';
  const revision = pagoEnRevision(cobro);
  const reemplazo = comprobanteRechazado(cobro);
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', pendiente && !enPausa && 'bg-warning-bg/40')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{cobro.title}</p>
        <p className="text-13 text-ink-500">
          {cobro.status === 'paid' && cobro.paid_at ? `Pagado el ${fmtDateLarga(cobro.paid_at)}` : `Solicitado el ${fmtDateLarga(cobro.created_at)}`}
        </p>
      </div>
      <Money clp={cobro.amount_clp} usd={cobro.amount_usd > 0 ? cobro.amount_usd : undefined} align="right" />
      <div className="flex w-full justify-end sm:w-auto">
        {(revision || reemplazo) && !enPausa ? <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={FileSearch}>{reemplazo ? 'Reemplazar comprobante' : 'Comprobante en revisión'}</BotonEnlace> : pendiente && !enPausa ? (
          <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={Receipt}>Pagar {fmtCLP(cobro.amount_clp)}</BotonEnlace>
        ) : pendiente ? (
          <Badge tone="neutral">En pausa</Badge>
        ) : (
          <StatusBadge kind="pago" status={cobro.status} dot />
        )}
      </div>
    </li>
  );
}
