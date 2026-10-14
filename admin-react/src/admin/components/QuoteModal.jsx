import { useState, useEffect, useMemo, useRef } from 'react';
import { saveQuote, deleteQuote, getPricing } from '../api';
import { enviarDesglose } from '../desglose';
import { Modal, Button, Select, NumberInput, Checkbox, Menu, Money, Spinner, useConfirm } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { Trash, Send } from '../../shared/components/Icons';
import { fmtCLP, cn } from '../../shared/lib/utils';
import { fmtUSD } from '../../shared/lib/format';

// Maps each editable field shown to admin to the cot_* template key in
// pricing_config. The QuoteModal pre-fills inputs with those defaults the
// first time a link is cotized; once a quote_data snapshot exists on the
// link, that wins (so admin edits stay sticky).
const USD_FIELDS = [
  { key: 'trailer_usd',                 cot: 'cot_usd_trailer',                 label: 'Trailer (si no trae)' },
  { key: 'inspeccion_usd',              cot: 'cot_usd_inspeccion_lancha',       label: 'Inspección técnica USA' },
  { key: 'inland_usa_usd',              cot: 'cot_usd_inland_usa',              label: 'Inland USA (bodegaje + puerto)' },
  { key: 'transporte_roro_usd',         cot: 'cot_usd_transporte_roro',         label: 'Transporte marítimo (RORO)' },
  { key: 'fumigacion_usd',              cot: 'cot_usd_certificado_fumigacion',  label: 'Certificado de fumigación' },
  { key: 'seguro_usd',                  cot: 'cot_usd_seguro',                  label: 'Seguro' },
  { key: 'gastos_naviera_usd',          cot: 'cot_usd_gastos_locales_naviera',  label: 'Gastos locales naviera' },
  { key: 'congestion_usd',              cot: 'cot_usd_congestion_surcharge',    label: 'Congestion surcharge' },
  { key: 'thc_usd',                     cot: 'cot_usd_thc',                     label: 'THC' },
  { key: 'baf_usd',                     cot: 'cot_usd_baf',                     label: 'BAF' },
  { key: 'wharfage_usd',                cot: 'cot_usd_wharfage',                label: 'Wharfage' },
  { key: 'handling_chile_usd',          cot: 'cot_usd_handling_chile',          label: 'Handling Chile' },
  { key: 'miami_admin_usd',             cot: 'cot_usd_miami_admin_fee',         label: 'Miami admin fee' },
  { key: 'escorte_usd',                 cot: 'cot_usd_escorte',                 label: 'Escorte (Port Pass)' },
];

const CLP_FIELDS = [
  { key: 'fee_wire_clp',                cot: 'cot_clp_fee_wire_transfer',       label: 'Fee wire transfer' },
  { key: 'inland_puerto_clp',           cot: 'cot_clp_inland_puerto_santiago',  label: 'Inland puerto → Santiago' },
  { key: 'chequeo_mecanico_clp',        cot: 'cot_clp_chequeo_mecanico',        label: 'Chequeo mecánico' },
  { key: 'pulido_clp',                  cot: 'cot_clp_pulido_tratamiento',      label: 'Pulido y tratamiento' },
  { key: 'entrega_clp',                 cot: 'cot_clp_entrega_traslado',        label: 'Entrega / traslado' },
  { key: 'aduana_extra_clp',            cot: 'cot_clp_aduana_extra',            label: 'Aduana M$1.2 + IVA' },
  { key: 'autorizaciones_clp',          cot: 'cot_clp_autorizaciones',          label: 'Autorizaciones' },
  { key: 'gastos_puerto_clp',           cot: 'cot_clp_gastos_puerto',           label: 'Gastos de puerto' },
  { key: 'agencia_aduana_clp',          cot: 'cot_clp_agencia_aduana',          label: 'Agencia de aduana' },
  { key: 'iva_servicios_linea_clp',     cot: 'cot_clp_iva_servicios_linea',     label: 'IVA servicios (línea)' },
  { key: 'gastos_despachos_clp',        cot: 'cot_clp_gastos_despachos',        label: 'Gastos de despachos' },
  { key: 'honorarios_agencia_clp',      cot: 'cot_clp_honorarios_agencia',      label: 'Honorarios agencia' },
];

// Spreadsheet defaults (Planilla de Costos Importación Imporlan 2026, Servicio
// FULL example). Used as a fallback when pricing_config doesn't have a value
// for a given key — admin edits made via the Cotizador config tab still win
// because they're persisted in pricing_config and read first.
const SPREADSHEET_DEFAULTS = {
  cot_usd_clp_rate: 920,
  cot_usd_trailer: 0,
  cot_usd_inspeccion_lancha: 850,
  cot_usd_inland_usa: 2100,
  cot_usd_transporte_roro: 8500,
  cot_usd_certificado_fumigacion: 400,
  cot_usd_seguro: 320,
  cot_usd_gastos_locales_naviera: 450,
  cot_usd_congestion_surcharge: 0,
  cot_usd_thc: 160,
  cot_usd_baf: 615,
  cot_usd_wharfage: 252,
  cot_usd_handling_chile: 150,
  cot_usd_miami_admin_fee: 150,
  cot_usd_escorte: 0,
  cot_clp_fee_wire_transfer: 240000,
  cot_clp_inland_puerto_santiago: 349000,
  cot_clp_chequeo_mecanico: 209000,
  cot_clp_pulido_tratamiento: 186400,
  cot_clp_entrega_traslado: 0,
  cot_clp_aduana_extra: 220018,
  cot_clp_autorizaciones: 80000,
  cot_clp_gastos_puerto: 400000,
  cot_clp_agencia_aduana: 280000,
  cot_clp_iva_servicios_linea: 100107,
  cot_clp_gastos_despachos: 47924,
  cot_clp_honorarios_agencia: 71951,
  cot_pct_iva_aduanero: 19,
  cot_pct_impuesto_lujo: 2,
  cot_clp_fee_imporlan_default: 3000000,
  cot_pago_1_pct: 7,
  cot_pago_2_pct: 63,
  cot_pago_3_pct: 30,
};

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

export default function QuoteModal({ open, link, onClose, onSaved, onBreakdownSent }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [pricing, setPricing] = useState({});
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [q, setQ] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingBreakdown, setSendingBreakdown] = useState(false);
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
      const raw = pricing[k]?.value ?? pricing[k];
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
      // Fall back to the spreadsheet default if the pricing_config row is
      // missing or unparseable. Admin edits in the Cotizador tab still win
      // because they persist in pricing_config and are checked first.
      if (k in SPREADSHEET_DEFAULTS) return SPREADSHEET_DEFAULTS[k];
      return fallback;
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

  async function handleSave(publishNow = false) {
    if (!q || !calc || !link?.id) return;
    if (publishNow && !(await confirm({
      title: '¿Publicar la cotización ahora?',
      description: 'Esto publica la cotización al cliente AHORA (sin esperar las 24 horas) y le envía un correo.',
      tone: 'warning',
      confirmLabel: 'Publicar y enviar',
    }))) return;
    setSaving(true);
    try {
      const payments = {
        p1_pct: calc.pagos.p1.pct, p1_clp: Math.round(calc.pagos.p1.clp),
        p2_pct: calc.pagos.p2.pct, p2_clp: Math.round(calc.pagos.p2.clp),
        p3_pct: calc.pagos.p3.pct, p3_clp: Math.round(calc.pagos.p3.clp),
      };
      const res = await saveQuote(link.id, q, calc.totalClp, calc.totalUsd, payments, publishNow);
      if (publishNow) {
        showToast(res?.emailed ? 'Cotización enviada al cliente' : 'Cotización publicada (sin correo)', 'success');
      } else {
        showToast('Cotización guardada. El cliente la verá en 24 horas.', 'success');
      }
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
    if (!(await confirm({ title: '¿Borrar la cotización guardada de este link?', description: 'El cliente deja de verla. No se puede deshacer.', tone: 'danger', confirmLabel: 'Borrar cotización' }))) return;
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

  // «Enviar desglose» (ver ../desglose.js): el mismo envío que el botón de la fila.
  async function handleBreakdown() {
    if (!link?.id) return;
    setSendingBreakdown(true);
    try {
      const enviado = await enviarDesglose(link.id);
      if (!enviado) return;
      showToast(`Desglose enviado a ${enviado.email}`, 'success');
      onBreakdownSent?.(link.id, enviado.sentAt);
      onClose?.();
    } catch (e) {
      showToast(e.message || 'Error al enviar el desglose', 'error');
    } finally {
      setSendingBreakdown(false);
    }
  }

  const boatTitle = [link?.year, link?.make, link?.model].filter(Boolean).join(' ') || link?.url || 'Link';
  const ocupado = saving || deleting || sendingBreakdown;
  const pagosOk = calc ? Math.abs(calc.pagosSum - 100) < 0.01 : true;

  const extras = [
    link?.quote_published_at ? { label: sendingBreakdown ? 'Enviando desglose…' : (link.quote_breakdown_sent_at ? 'Reenviar desglose' : 'Enviar desglose'), icon: Send, onClick: handleBreakdown, disabled: ocupado } : null,
    link?.quote_calculated_at && link?.quote_published_at ? { separator: true } : null,
    link?.quote_calculated_at ? { label: deleting ? 'Borrando…' : 'Borrar cotización', icon: Trash, tone: 'danger', onClick: handleDelete, disabled: ocupado } : null,
  ].filter(Boolean);

  const meta = [
    link?.quote_calculated_at ? `Última: ${new Date(link.quote_calculated_at).toLocaleString('es-CL')}` : null,
    link?.quote_breakdown_sent_at ? `Desglose enviado: ${new Date(link.quote_breakdown_sent_at).toLocaleString('es-CL')}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Modal
      open={open}
      onClose={ocupado ? undefined : onClose}
      title="Cotización del link"
      description={boatTitle}
      size="xl"
      bodyClassName="p-0"
      footer={(
        <div className="flex flex-wrap items-center gap-2 w-full">
          <span className="hidden sm:block text-xs text-ink-500 tabular flex-1 min-w-0 truncate" title={meta}>{meta}</span>
          {extras.length > 0 && <Menu items={extras} label="Más acciones de la cotización" />}
          <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(true)} disabled={ocupado || !calc} title="Publica al cliente sin esperar las 24 horas y le envía un correo">Guardar y enviar ahora</Button>
          <Button onClick={() => handleSave(false)} loading={saving} disabled={deleting || sendingBreakdown || !calc}>Guardar (24 h)</Button>
        </div>
      )}
    >
      {(!q || loadingPricing) ? (
        <Spinner label="Cargando los datos del cotizador…" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Izquierda: lo que edita el admin */}
          <div className="px-5 sm:px-6 py-5 space-y-6 min-w-0">
            <Seccion titulo="Generales">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select label="Modalidad" value={q.modalidad} onChange={e => set('modalidad', e.target.value)} options={[{ value: 'RORO', label: 'RORO' }, { value: 'Container', label: 'Container' }, { value: 'Otro', label: 'Otro' }]} />
                <NumberInput label="Tipo de cambio (CLP por USD)" unit="CLP" value={q.usd_clp_rate} onChange={e => set('usd_clp_rate', e.target.value)} />
                <NumberInput label="Valor de la lancha" unit="USD" value={q.valor_lancha_usd} onChange={e => set('valor_lancha_usd', e.target.value)} />
              </div>
            </Seccion>

            <Seccion titulo="Costos en USD" subtotal={fmtUSD(calc?.usdLogisticosSum)}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {USD_FIELDS.map(f => (
                  <NumberInput key={f.key} size="sm" label={f.label} unit="USD" value={q[f.key]} onChange={e => set(f.key, e.target.value)} />
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Costos en CLP" subtotal={fmtCLP(calc?.clpLogisticosSum)}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CLP_FIELDS.map(f => (
                  <NumberInput key={f.key} size="sm" label={f.label} unit="CLP" value={q[f.key]} onChange={e => set(f.key, e.target.value)} />
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Cargos finales" subtotal={fmtCLP(calc.feeImporlan + calc.ivaClp + calc.lujoClp)}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <NumberInput size="sm" label="Fee Imporlan" unit="CLP" value={q.fee_imporlan_clp} onChange={e => set('fee_imporlan_clp', e.target.value)} />
                <NumberInput size="sm" label="IVA aduanero" unit="%" value={q.iva_pct} onChange={e => set('iva_pct', e.target.value)} />
                <NumberInput size="sm" label="Impuesto al lujo" unit="%" value={q.lujo_pct} onChange={e => set('lujo_pct', e.target.value)} />
                <Checkbox label="Aplica lujo" className="pb-1.5" checked={!!q.lujo_aplica} onChange={e => set('lujo_aplica', e.target.checked)} />
              </div>
            </Seccion>

            <Seccion
              titulo="Estructura de pagos"
              subtotal={<span className={cn(pagosOk ? 'text-success' : 'text-danger')}>{calc?.pagosSum?.toFixed(1)}%</span>}
              aviso={!pagosOk ? 'Los tres pagos deben sumar 100 %.' : null}
            >
              <div className="grid grid-cols-3 gap-3">
                <NumberInput size="sm" label="Pago 1" unit="%" value={q.pago_1_pct} onChange={e => set('pago_1_pct', e.target.value)} />
                <NumberInput size="sm" label="Pago 2" unit="%" value={q.pago_2_pct} onChange={e => set('pago_2_pct', e.target.value)} />
                <NumberInput size="sm" label="Pago 3" unit="%" value={q.pago_3_pct} onChange={e => set('pago_3_pct', e.target.value)} />
              </div>
            </Seccion>
          </div>

          {/* Derecha: lo que verá el cliente */}
          <aside className="bg-canvas border-t lg:border-t-0 lg:border-l border-line px-5 sm:px-6 py-5 lg:sticky lg:top-0 self-start" aria-label="Lo que verá el cliente">
            <p className="eyebrow mb-3">Lo que verá el cliente</p>
            <dl className="space-y-2.5">
              <Row label="Valor de la lancha"><Money clp={calc.lanchaClp} usd={calc.lanchaUsd} align="right" /></Row>
              <Row label="Servicio All-Inclusive"><Money clp={calc.allInclusiveTotal} align="right" /></Row>
              <Row label="IVA aduanero" sub={`${num(q.iva_pct)} % sobre CIF`}><Money clp={calc.ivaClp} align="right" /></Row>
              {q.lujo_aplica
                ? <Row label="Impuesto al lujo" sub={`${num(q.lujo_pct)} % sobre la lancha`}><Money clp={calc.lujoClp} align="right" /></Row>
                : <Row label="Impuesto al lujo"><span className="text-13 text-ink-500">No aplica</span></Row>}
              <div className="mt-3 pt-3 border-t border-line-strong flex items-start justify-between gap-3">
                <dt className="text-sm font-semibold text-ink-900 pt-1">Total</dt>
                <dd><Money clp={calc.totalClp} usd={calc.totalUsd} size="lg" align="right" /></dd>
              </div>
            </dl>

            <p className="eyebrow mt-5 mb-2">Pagos</p>
            <table className="w-full text-13 tabular">
              <tbody className="divide-y divide-line">
                <PayRow n={1} pct={calc.pagos.p1.pct} clp={calc.pagos.p1.clp} />
                <PayRow n={2} pct={calc.pagos.p2.pct} clp={calc.pagos.p2.clp} />
                <PayRow n={3} pct={calc.pagos.p3.pct} clp={calc.pagos.p3.clp} />
              </tbody>
            </table>

            <p className="mt-5 text-xs text-ink-500 leading-relaxed">
              El cliente verá esta cotización <strong className="text-ink-700">24 horas después</strong> de que la guardes. Mientras tanto, en su panel aparece «Cotización en análisis».
            </p>
          </aside>
        </div>
      )}
    </Modal>
  );
}

function Seccion({ titulo, subtotal, aviso, children }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="eyebrow">{titulo}</h3>
        {subtotal !== undefined && <span className="text-13 font-semibold text-ink-900 tabular">{subtotal}</span>}
      </div>
      {children}
      {aviso && <p className="mt-2 text-xs text-danger" role="alert">{aviso}</p>}
    </section>
  );
}

function Row({ label, sub, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-sm text-ink-700">
        {label}
        {sub && <span className="block text-xs text-ink-500">{sub}</span>}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function PayRow({ n, pct, clp }) {
  return (
    <tr>
      <td className="py-1.5 text-ink-700">Pago {n} <span className="text-ink-500">({pct} %)</span></td>
      <td className="py-1.5 text-right font-semibold text-ink-900">{fmtCLP(clp)}</td>
    </tr>
  );
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
