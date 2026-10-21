import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Money, StatusBadge, Badge } from '../../../shared/components/UI';
import { Check, Receipt } from '../../../shared/components/Icons';
import { BotonEnlace } from '../inicio/BotonEnlace';
import { rutaPagar } from './lib';

/**
 * Plan de pagos de la lancha elegida (Pago 1/2/3 con su % y monto) cruzado
 * con los cobros que el equipo ya creó: Pagado (fecha) · Por pagar (botón) ·
 * «Te lo enviamos cuando corresponda». Los cobros del expediente que no
 * calzan con un pago del plan van en «Otros cobros». Recibe el resultado de
 * pagosConCobros(); no calcula nada.
 */
export default function PlanDePagos({ pagos, otros, className }) {
  const plan = pagos || [];
  const extra = otros || [];
  if (plan.length === 0 && extra.length === 0) return null;
  const pagados = plan.filter(p => p.estado === 'pagado').length;

  return (
    <section aria-labelledby="plan-de-pagos" id="plan-de-pagos" className={className}>
      {plan.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h3 id="plan-de-pagos" className="text-sm font-semibold text-ink-900">Plan de pagos</h3>
            <p className="text-13 text-ink-500 tabular">{pagados} de {plan.length} {pagados === 1 ? 'pagado' : 'pagados'}</p>
          </div>
          <ol className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line" aria-label="Pagos del plan">
            {plan.map(p => <FilaPago key={p.n} pago={p} />)}
          </ol>
        </>
      )}

      {extra.length > 0 && (
        <>
          <h3 className={cn('text-sm font-semibold text-ink-900', plan.length > 0 ? 'mt-5' : '')} id={plan.length > 0 ? undefined : 'plan-de-pagos'}>Otros cobros</h3>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line" aria-label="Otros cobros del expediente">
            {extra.map(r => <FilaCobro key={r.id} cobro={r} />)}
          </ul>
        </>
      )}
    </section>
  );
}

function FilaPago({ pago }) {
  const { n, pct, clp, cobro, estado } = pago;
  const monto = cobro ? Number(cobro.amount_clp) : clp;
  const pagado = estado === 'pagado';
  const porPagar = estado === 'por_pagar';

  let detalle;
  if (pagado) detalle = `Pagado${cobro?.paid_at ? ` el ${fmtDateLarga(cobro.paid_at)}` : ''}`;
  else if (porPagar) detalle = `Solicitado el ${fmtDateLarga(cobro.created_at)}`;
  else detalle = 'Te lo enviamos cuando corresponda';

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', porPagar && 'bg-warning-bg/40', estado === 'por_cobrar' && 'text-ink-500')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-13 font-semibold tabular',
          pagado ? 'bg-success text-white' : porPagar ? 'border-2 border-warning bg-surface text-warning' : 'border border-line-strong bg-surface text-ink-500',
        )}
        aria-hidden="true"
      >
        {pagado ? <Check size={16} strokeWidth={2.5} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', estado === 'por_cobrar' ? 'text-ink-700' : 'text-ink-900')}>
          Pago {n} <span className="font-normal text-ink-500">· {pct}%</span>
        </p>
        <p className="text-13 text-ink-500">{detalle}</p>
      </div>
      <Money clp={monto} usd={cobro?.amount_usd > 0 ? cobro.amount_usd : undefined} align="right" tone={estado === 'por_cobrar' ? 'muted' : undefined} />
      <div className="flex w-full justify-end sm:w-auto">
        {pagado && <StatusBadge kind="pago" status="paid" dot />}
        {porPagar && <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={Receipt}>Pagar</BotonEnlace>}
        {estado === 'por_cobrar' && <Badge tone="neutral">Más adelante</Badge>}
      </div>
    </li>
  );
}

function FilaCobro({ cobro }) {
  const pendiente = cobro.status === 'pending';
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', pendiente && 'bg-warning-bg/40')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{cobro.title}</p>
        <p className="text-13 text-ink-500">
          {cobro.status === 'paid' && cobro.paid_at ? `Pagado el ${fmtDateLarga(cobro.paid_at)}` : `Solicitado el ${fmtDateLarga(cobro.created_at)}`}
        </p>
      </div>
      <Money clp={cobro.amount_clp} usd={cobro.amount_usd > 0 ? cobro.amount_usd : undefined} align="right" />
      <div className="flex w-full justify-end sm:w-auto">
        {pendiente ? (
          <BotonEnlace to={rutaPagar(cobro)} variant="secondary" size="sm" icon={Receipt}>Pagar {fmtCLP(cobro.amount_clp)}</BotonEnlace>
        ) : (
          <StatusBadge kind="pago" status={cobro.status} dot />
        )}
      </div>
    </li>
  );
}
