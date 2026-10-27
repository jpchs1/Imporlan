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
        <p><span className="font-medium text-warning">Cotización en análisis</span><span className="text-ink-700"> · {link.quote_available_at ? `disponible desde ${fmtDateLarga(link.quote_available_at, { hora: true })}` : 'te avisaremos cuando esté lista'}</span></p>
      </div>
    );
  }

  const totalClp = Number(link.quote_total_clp);
  if (!Number.isFinite(totalClp) || totalClp <= 0) return null;

  let qd = link.quote_data;
  if (typeof qd === 'string') { try { qd = JSON.parse(qd); } catch { qd = null; } }
  let pay = link.quote_payments;
  if (typeof pay === 'string') { try { pay = JSON.parse(pay); } catch { pay = null; } }

  const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const lanchaUsd = number(qd?.valor_lancha_usd);
  const rate = number(qd?.usd_clp_rate);
  const lanchaClp = lanchaUsd > 0 && rate > 0 ? lanchaUsd * rate : null;
  const ivaPct = number(qd?.iva_pct);
  const lujoAplica = qd?.lujo_aplica === true || Number(qd?.lujo_aplica) === 1;
  const lujoPct = number(qd?.lujo_pct);
  const transporte = number(qd?.transporte_roro_usd);
  const ivaClp = lanchaClp !== null && transporte !== null && ivaPct !== null
    ? (lanchaClp + transporte * rate) * ivaPct / 100 : null;
  const lujoClp = lujoAplica && lanchaClp !== null && lujoPct !== null ? lanchaClp * lujoPct / 100 : 0;
  const allInclusive = lanchaClp !== null && ivaClp !== null ? totalClp - lanchaClp - ivaClp - lujoClp : null;
  const detalleValido = allInclusive !== null && allInclusive >= 0 && ivaClp >= 0 && (!lujoAplica || lujoPct !== null);
  const pagos = pay ? [1, 2, 3].filter(n => number(pay[`p${n}_clp`]) > 0 && number(pay[`p${n}_pct`]) > 0) : [];
  const hitos = { 1: 'Al elegir tu lancha', 2: 'Tras confirmar disponibilidad o aprobar la inspección', 3: 'En camino a Chile' };

  return (
    <div className={cn('overflow-hidden rounded-md border border-line', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line bg-canvas px-3.5 py-2">
        <h5 className="text-13 font-semibold text-ink-900">Cotización puesta en Chile</h5>
        {link.quote_published_at && <span className="text-xs text-ink-500 tabular">Publicada {fmtDateLarga(link.quote_published_at)}</span>}
      </div>

      <dl className="divide-y divide-line px-3.5">
        {detalleValido && <>
        {lanchaClp != null && <Fila label="Valor de la lancha" clp={lanchaClp} usd={lanchaUsd} />}
        <Fila label="Servicio all inclusive" clp={allInclusive} />
        <Fila label="IVA aduanero" clp={ivaClp} />
        {lujoAplica ? <Fila label="Impuesto al lujo" clp={lujoClp} /> : <Fila label="Impuesto al lujo" texto="No aplica" muted />}
        </>}
        <Fila label="Total" clp={totalClp} usd={link.quote_total_usd} total />
      </dl>

      {!detalleValido && <p className="px-3.5 pb-2 text-xs text-ink-500">El detalle de esta cotización está pendiente de actualización por tu agente.</p>}

      {pagos.length > 0 && (
        <div className="border-t border-line bg-canvas">
          <p className="eyebrow px-3.5 pt-2.5">Forma de pago</p>
          <div className="flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
            {pagos.map(n => (
              <div key={n} className="flex flex-1 items-baseline justify-between gap-3 px-3.5 py-2 sm:flex-col sm:gap-0.5">
                <span className="text-xs text-ink-500">Pago {n} · {pay[`p${n}_pct`]}%</span>
                <span className="text-13 font-semibold text-ink-900 tabular">{fmtCLP(pay[`p${n}_clp`])}</span>
                <span className="text-xs text-ink-500 max-w-56">{hitos[n]}</span>
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
