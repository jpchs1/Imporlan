import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { saveQuote, deleteQuote, getPricing } from '../api';
import { Button } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

// Maps each editable field shown to admin to the cot_* template key in
// pricing_config. The QuoteModal pre-fills inputs with those defaults the
// first time a link is cotized; once a quote_data snapshot exists on the
// link, that wins (so admin edits stay sticky).
const USD_FIELDS = [
  { key: 'trailer_usd',                 cot: 'cot_usd_trailer',                 label: 'Trailer (si no trae)' },
  { key: 'inspeccion_usd',              cot: 'cot_usd_inspeccion_lancha',       label: 'Inspección Técnica USA' },
  { key: 'inland_usa_usd',              cot: 'cot_usd_inland_usa',              label: 'Inland USA (bodegaje + puerto)' },
  { key: 'transporte_roro_usd',         cot: 'cot_usd_transporte_roro',         label: 'Transporte Marítimo (RORO)' },
  { key: 'fumigacion_usd',              cot: 'cot_usd_certificado_fumigacion',  label: 'Certificado Fumigación' },
  { key: 'seguro_usd',                  cot: 'cot_usd_seguro',                  label: 'Seguro / Insurance' },
  { key: 'gastos_naviera_usd',          cot: 'cot_usd_gastos_locales_naviera',  label: 'Gastos Locales Naviera' },
  { key: 'congestion_usd',              cot: 'cot_usd_congestion_surcharge',    label: 'Congestion Surcharge' },
  { key: 'thc_usd',                     cot: 'cot_usd_thc',                     label: 'THC' },
  { key: 'baf_usd',                     cot: 'cot_usd_baf',                     label: 'BAF' },
  { key: 'wharfage_usd',                cot: 'cot_usd_wharfage',                label: 'WHARFAGE' },
  { key: 'handling_chile_usd',          cot: 'cot_usd_handling_chile',          label: 'Handling Chile' },
  { key: 'miami_admin_usd',             cot: 'cot_usd_miami_admin_fee',         label: 'Miami Admin FEE' },
  { key: 'escorte_usd',                 cot: 'cot_usd_escorte',                 label: 'Escorte (Port Pass)' },
];

const CLP_FIELDS = [
  { key: 'fee_wire_clp',                cot: 'cot_clp_fee_wire_transfer',       label: 'FEE Wire Transferencia' },
  { key: 'inland_puerto_clp',           cot: 'cot_clp_inland_puerto_santiago',  label: 'Inland Puerto → Santiago' },
  { key: 'chequeo_mecanico_clp',        cot: 'cot_clp_chequeo_mecanico',        label: 'Chequeo Mecánico' },
  { key: 'pulido_clp',                  cot: 'cot_clp_pulido_tratamiento',      label: 'Pulido y Tratamiento' },
  { key: 'entrega_clp',                 cot: 'cot_clp_entrega_traslado',        label: 'Entrega / Traslado' },
  { key: 'aduana_extra_clp',            cot: 'cot_clp_aduana_extra',            label: 'Aduana M$1.2 + IVA' },
  { key: 'autorizaciones_clp',          cot: 'cot_clp_autorizaciones',          label: 'Autorizaciones' },
  { key: 'gastos_puerto_clp',           cot: 'cot_clp_gastos_puerto',           label: 'Gastos de Puerto' },
  { key: 'agencia_aduana_clp',          cot: 'cot_clp_agencia_aduana',          label: 'Agencia de Aduana' },
  { key: 'iva_servicios_linea_clp',     cot: 'cot_clp_iva_servicios_linea',     label: 'IVA Servicios (línea)' },
  { key: 'gastos_despachos_clp',        cot: 'cot_clp_gastos_despachos',        label: 'Gastos de Despachos' },
  { key: 'honorarios_agencia_clp',      cot: 'cot_clp_honorarios_agencia',      label: 'Honorarios Agencia' },
];

function fmtClp(n) {
  if (n === null || n === undefined || isNaN(n)) return '$ 0';
  return '$ ' + Math.round(n).toLocaleString('es-CL');
}
function fmtUsd(n) {
  if (n === null || n === undefined || isNaN(n)) return 'USD 0';
  return 'USD ' + Math.round(n).toLocaleString('en-US');
}
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

export default function QuoteModal({ open, link, onClose, onSaved }) {
  const showToast = useToast();
  const [pricing, setPricing] = useState({});
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [q, setQ] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initOnce = useRef(false);

  // Load templates once when modal opens
  useEffect(() => {
    if (!open) { initOnce.current = false; return; }
    if (initOnce.current) return;
    initOnce.current = true;
    setLoadingPricing(true);
    getPricing()
      .then(r => setPricing(r.pricing || {}))
      .catch(e => console.error('pricing fetch failed', e))
      .finally(() => setLoadingPricing(false));
  }, [open]);

  // Build initial q state from link.quote_data (if any) or templates
  useEffect(() => {
    if (!open || loadingPricing) return;
    const cot = (k, fallback) => {
      const v = pricing[k]?.value ?? pricing[k];
      const n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    };
    const saved = link?.quote_data
      ? (typeof link.quote_data === 'string' ? safeParse(link.quote_data) : link.quote_data)
      : null;

    const init = {
      // Generales
      modalidad: saved?.modalidad ?? 'RORO',
      usd_clp_rate: saved?.usd_clp_rate ?? cot('cot_usd_clp_rate', 920),
      valor_lancha_usd: saved?.valor_lancha_usd ?? num(link?.value_usa_usd) ?? 0,
      // Cargos finales
      iva_pct: saved?.iva_pct ?? cot('cot_pct_iva_aduanero', 19),
      lujo_pct: saved?.lujo_pct ?? cot('cot_pct_impuesto_lujo', 2),
      lujo_aplica: saved?.lujo_aplica ?? false,
      fee_imporlan_clp: saved?.fee_imporlan_clp ?? cot('cot_clp_fee_imporlan_default', 3000000),
      // Pagos
      pago_1_pct: saved?.pago_1_pct ?? cot('cot_pago_1_pct', 7),
      pago_2_pct: saved?.pago_2_pct ?? cot('cot_pago_2_pct', 63),
      pago_3_pct: saved?.pago_3_pct ?? cot('cot_pago_3_pct', 30),
    };
    USD_FIELDS.forEach(f => { init[f.key] = saved?.[f.key] ?? cot(f.cot, 0); });
    CLP_FIELDS.forEach(f => { init[f.key] = saved?.[f.key] ?? cot(f.cot, 0); });
    setQ(init);
  }, [open, loadingPricing, pricing, link]);

  // Live calculation — runs every render when q changes.
  const calc = useMemo(() => {
    if (!q) return null;
    const rate = num(q.usd_clp_rate) || 1;
    const lanchaUsd = num(q.valor_lancha_usd);
    const lanchaClp = lanchaUsd * rate;

    let usdLogisticosSum = 0;
    USD_FIELDS.forEach(f => { usdLogisticosSum += num(q[f.key]); });

    let clpLogisticosSum = 0;
    CLP_FIELDS.forEach(f => { clpLogisticosSum += num(q[f.key]); });

    const allInclusivePreFee = (usdLogisticosSum * rate) + clpLogisticosSum;
    const feeImporlan = num(q.fee_imporlan_clp);
    const allInclusiveTotal = allInclusivePreFee + feeImporlan;

    // CIF para IVA = lancha + transporte (el spreadsheet usa esa base, según
    // verificación numérica con el ejemplo 9,200,000 + 7,820,000 = 17,020,000;
    // 17,020,000 × 0.19 = 3,233,800 que coincide con la planilla).
    const transporteClp = num(q.transporte_roro_usd) * rate;
    const cifClp = lanchaClp + transporteClp;
    const ivaClp = cifClp * (num(q.iva_pct) / 100);
    const lujoClp = q.lujo_aplica ? lanchaClp * (num(q.lujo_pct) / 100) : 0;

    const totalClp = lanchaClp + allInclusiveTotal + ivaClp + lujoClp;
    const totalUsd = totalClp / rate;

    const p1Pct = num(q.pago_1_pct);
    const p2Pct = num(q.pago_2_pct);
    const p3Pct = num(q.pago_3_pct);
    const pagos = {
      p1: { pct: p1Pct, clp: totalClp * p1Pct / 100 },
      p2: { pct: p2Pct, clp: totalClp * p2Pct / 100 },
      p3: { pct: p3Pct, clp: totalClp * p3Pct / 100 },
    };
    const pagosSum = pagos.p1.pct + pagos.p2.pct + pagos.p3.pct;
    return {
      lanchaUsd, lanchaClp,
      usdLogisticosSum, clpLogisticosSum,
      allInclusiveTotal, feeImporlan,
      cifClp, ivaClp, lujoClp,
      totalClp, totalUsd,
      pagos, pagosSum,
    };
  }, [q]);

  if (!open) return null;

  function set(k, v) { setQ(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!q || !calc || !link?.id) return;
    setSaving(true);
    try {
      const payments = {
        p1_pct: calc.pagos.p1.pct, p1_clp: Math.round(calc.pagos.p1.clp),
        p2_pct: calc.pagos.p2.pct, p2_clp: Math.round(calc.pagos.p2.clp),
        p3_pct: calc.pagos.p3.pct, p3_clp: Math.round(calc.pagos.p3.clp),
      };
      await saveQuote(link.id, q, calc.totalClp, calc.totalUsd, payments);
      showToast('Cotización guardada. El cliente la verá en 24 hrs.', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast(e.message || 'Error al guardar la cotización', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!link?.id || !link?.quote_calculated_at) return;
    if (!confirm('¿Borrar la cotización guardada de este link?')) return;
    setDeleting(true);
    try {
      await deleteQuote(link.id);
      showToast('Cotización borrada', 'success');
      onSaved?.();
      onClose?.();
    } catch (e) {
      showToast(e.message || 'Error al borrar', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none bg-white';

  const boatTitle = [link?.year, link?.make, link?.model].filter(Boolean).join(' ') || link?.url || 'Link';

  return createPortal(
    <>
      <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="animate-scale-in" style={{ position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: 'min(1100px, calc(100% - 2rem))', maxHeight: '90vh' }}>
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200/60 overflow-hidden" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-indigo-50 to-cyan-50">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Cotización del link</h3>
              <p className="text-xs text-slate-500">{boatTitle}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-white/60">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Body */}
          {(!q || loadingPricing) ? (
            <div className="p-12 text-center text-slate-400 text-sm">Cargando datos del cotizador...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 overflow-hidden">
              {/* LEFT — inputs (admin only) */}
              <div className="lg:col-span-2 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50/30">

                {/* Generales */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Generales</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Modalidad</label>
                      <select className={inputCls} value={q.modalidad} onChange={e => set('modalidad', e.target.value)}>
                        <option value="RORO">RORO</option>
                        <option value="Container">Container</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tipo de cambio</label>
                      <input type="number" className={inputCls} value={q.usd_clp_rate} onChange={e => set('usd_clp_rate', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Valor Lancha (USD)</label>
                      <input type="number" className={inputCls} value={q.valor_lancha_usd} onChange={e => set('valor_lancha_usd', e.target.value)} />
                    </div>
                  </div>
                </section>

                {/* Costos USD */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Costos USD <span className="font-normal normal-case text-slate-400">(suma: {fmtUsd(calc?.usdLogisticosSum)})</span></h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {USD_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">{f.label}</label>
                        <input type="number" className={inputCls} value={q[f.key]} onChange={e => set(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Costos CLP */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Costos CLP <span className="font-normal normal-case text-slate-400">(suma: {fmtClp(calc?.clpLogisticosSum)})</span></h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CLP_FIELDS.map(f => (
                      <div key={f.key}>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">{f.label}</label>
                        <input type="number" className={inputCls} value={q[f.key]} onChange={e => set(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Cargos finales */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Cargos finales</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">FEE Imporlan (CLP)</label>
                      <input type="number" className={inputCls} value={q.fee_imporlan_clp} onChange={e => set('fee_imporlan_clp', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">IVA Aduanero (%)</label>
                      <input type="number" className={inputCls} value={q.iva_pct} onChange={e => set('iva_pct', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lujo (%)</label>
                      <input type="number" className={inputCls} value={q.lujo_pct} onChange={e => set('lujo_pct', e.target.value)} />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="checkbox" checked={!!q.lujo_aplica} onChange={e => set('lujo_aplica', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                        Aplica Lujo
                      </label>
                    </div>
                  </div>
                </section>

                {/* Pagos */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Estructura de pagos <span className={'font-normal normal-case ' + (Math.abs(calc.pagosSum - 100) < 0.01 ? 'text-emerald-600' : 'text-red-500')}>(suma: {calc?.pagosSum?.toFixed(1)}%)</span></h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pago 1 (%)</label>
                      <input type="number" className={inputCls} value={q.pago_1_pct} onChange={e => set('pago_1_pct', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pago 2 (%)</label>
                      <input type="number" className={inputCls} value={q.pago_2_pct} onChange={e => set('pago_2_pct', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Pago 3 (%)</label>
                      <input type="number" className={inputCls} value={q.pago_3_pct} onChange={e => set('pago_3_pct', e.target.value)} />
                    </div>
                  </div>
                </section>

              </div>

              {/* RIGHT — preview cliente */}
              <aside className="lg:col-span-1 overflow-y-auto px-5 py-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Lo que verá el cliente</div>

                <div className="space-y-3 text-sm">
                  <Row label="Valor Lancha" value={fmtClp(calc.lanchaClp)} sub={fmtUsd(calc.lanchaUsd)} />
                  <Row label="Servicio All-Inclusive" value={fmtClp(calc.allInclusiveTotal)} />
                  <Row label="IVA Aduanero" value={fmtClp(calc.ivaClp)} sub={`${num(q.iva_pct)}% sobre CIF`} />
                  {q.lujo_aplica ? (
                    <Row label="Impuesto al Lujo" value={fmtClp(calc.lujoClp)} sub={`${num(q.lujo_pct)}% sobre lancha`} />
                  ) : (
                    <Row label="Impuesto al Lujo" value="N/A" muted />
                  )}
                  <hr className="border-white/10 my-1" />
                  <Row label="TOTAL" value={fmtClp(calc.totalClp)} sub={fmtUsd(calc.totalUsd)} bold large />
                </div>

                <div className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Pagos</div>
                <div className="space-y-1.5 text-xs">
                  <PayRow n={1} pct={calc.pagos.p1.pct} clp={calc.pagos.p1.clp} />
                  <PayRow n={2} pct={calc.pagos.p2.pct} clp={calc.pagos.p2.clp} />
                  <PayRow n={3} pct={calc.pagos.p3.pct} clp={calc.pagos.p3.clp} />
                </div>

                <div className="mt-6 text-[10px] text-slate-400 leading-relaxed">
                  El cliente verá esta cotización <span className="text-amber-300 font-semibold">24 horas después</span> de que la guardes. Mientras tanto se le muestra el badge "Cotización en análisis".
                </div>
              </aside>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
            <div className="text-xs text-slate-400">
              {link?.quote_calculated_at && (
                <>Última: {new Date(link.quote_calculated_at).toLocaleString('es-CL')}</>
              )}
            </div>
            <div className="flex gap-2">
              {link?.quote_calculated_at && (
                <Button variant="ghost" className="text-red-600" onClick={handleDelete} disabled={deleting || saving}>
                  {deleting ? 'Borrando...' : 'Borrar cotización'}
                </Button>
              )}
              <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !calc}>
                {saving ? 'Guardando...' : 'Guardar cotización'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function Row({ label, value, sub, bold, large, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className={'text-slate-300 ' + (bold ? 'font-bold text-white' : '')}>{label}</div>
      <div className="text-right">
        <div className={(large ? 'text-xl ' : 'text-sm ') + (bold ? 'font-bold text-white' : (muted ? 'text-slate-500' : 'text-slate-100 font-semibold'))}>{value}</div>
        {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

function PayRow({ n, pct, clp }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-2 py-1 bg-white/5 rounded-md">
      <div className="text-slate-300">Pago {n} <span className="text-slate-500">({pct}%)</span></div>
      <div className="text-slate-100 font-semibold">{fmtClp(clp)}</div>
    </div>
  );
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
