import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtUSD, fmtDateLarga } from '../../../shared/lib/format';
import { Clock } from '../../../shared/components/Icons';

/**
 * Resumen de la cotización para el cliente. Mientras dura la ventana de 24 h
 * (el admin la marcó como cotizada pero el servidor esconde los números)
 * muestra "en análisis"; publicada, muestra el desglose y los tres pagos.
 * El backend (cotizadorApplyClientVisibility) es la fuente de verdad: esto es
 * solo presentación. El cálculo de All-Inclusive / IVA / Lujo se copia tal
 * cual del panel anterior.
 */
export default function ResumenCotizacion({ link, className }) {
  if (!link) return null;

  if (link.quote_pending) {
    return (
      <div role="status" className={cn('flex items-start gap-2 rounded-sm border border-warning-line bg-warning-bg px-2.5 py-1.5 text-13', className)}>
        <Clock size={14} className="mt-0.5 shrink-0 text-warning" />
        <p><span className="font-medium text-warning">Cotización en análisis</span><span className="text-ink-700"> · lista en aproximadamente 24 horas</span></p>
      </div>
    );
  }

  if (!link.quote_total_clp) return null;

  let qd = link.quote_data;
  if (typeof qd === 'string') { try { qd = JSON.parse(qd); } catch { qd = null; } }
  let pay = link.quote_payments;
  if (typeof pay === 'string') { try { pay = JSON.parse(pay); } catch { pay = null; } }

  const lanchaUsd = qd?.valor_lancha_usd;
  const rate = qd?.usd_clp_rate || 1;
  const lanchaClp = lanchaUsd ? lanchaUsd * rate : null;
  const ivaPct = qd?.iva_pct;
  const lujoAplica = qd?.lujo_aplica;
  const lujoPct = qd?.lujo_pct;
  // Client-side derived: All-Inclusive shown to client = Total - Lancha - IVA - Lujo
  const totalClp = parseFloat(link.quote_total_clp);
  const ivaClp = lanchaClp && qd?.transporte_roro_usd != null
    ? (lanchaClp + parseFloat(qd.transporte_roro_usd) * rate) * (parseFloat(ivaPct) / 100)
    : 0;
  const lujoClp = lujoAplica && lanchaClp ? lanchaClp * (parseFloat(lujoPct) / 100) : 0;
  const allInclusive = totalClp - (lanchaClp || 0) - ivaClp - lujoClp;

  const pagos = pay ? [1, 2, 3].filter(n => pay[`p${n}_clp`] != null) : [];

  return (
    <div className={cn('overflow-hidden rounded-md border border-line', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line bg-canvas px-3.5 py-2">
        <h5 className="text-13 font-semibold text-ink-900">Cotización puesta en Chile</h5>
        {link.quote_published_at && <span className="text-xs text-ink-500 tabular">Publicada {fmtDateLarga(link.quote_published_at)}</span>}
      </div>

      <dl className="divide-y divide-line px-3.5">
        {lanchaClp != null && <Fila label="Valor de la lancha" clp={lanchaClp} usd={lanchaUsd} />}
        <Fila label="Servicio all inclusive" clp={allInclusive} />
        <Fila label="IVA aduanero" clp={ivaClp} />
        {lujoAplica ? <Fila label="Impuesto al lujo" clp={lujoClp} /> : <Fila label="Impuesto al lujo" texto="No aplica" muted />}
        <Fila label="Total" clp={totalClp} usd={link.quote_total_usd} total />
      </dl>

      {pagos.length > 0 && (
        <div className="border-t border-line bg-canvas">
          <p className="eyebrow px-3.5 pt-2.5">Forma de pago</p>
          <div className="flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
            {pagos.map(n => (
              <div key={n} className="flex flex-1 items-baseline justify-between gap-3 px-3.5 py-2 sm:flex-col sm:gap-0.5">
                <span className="text-xs text-ink-500">Pago {n} · {pay[`p${n}_pct`]}%</span>
                <span className="text-13 font-semibold text-ink-900 tabular">{fmtCLP(pay[`p${n}_clp`])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ label, clp, usd, texto, total, muted }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', total ? 'py-2.5' : 'py-1.5')}>
      <dt className={cn('text-13', total ? 'font-semibold text-ink-900' : 'text-ink-500')}>{label}</dt>
      <dd className="text-right tabular">
        {texto ? (
          <span className={cn('text-13', muted ? 'text-ink-500' : 'text-ink-900')}>{texto}</span>
        ) : (
          <>
            <span className={cn('block', total ? 'text-base font-bold text-ink-900' : 'text-13 font-medium text-ink-900')}>{fmtCLP(clp)}</span>
            {usd ? <span className="block text-xs text-ink-500">≈ {fmtUSD(usd)}</span> : null}
          </>
        )}
      </dd>
    </div>
  );
}
