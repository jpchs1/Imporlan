import { useState, useEffect, useMemo, useRef } from 'react';
import { saveQuote, deleteQuote, getPricing } from '../api';
import { enviarDesglose } from '../desglose';
import { Modal, Button, Select, NumberInput, MoneyInput, Switch, Menu, Tabs, Spinner, useConfirm } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { Trash, Send, Receipt, Ship, DollarSign, Wallet, Percent, Eye, Clock, ChevronDown, ShieldCheck, Check, Info } from '../../shared/components/Icons';
import { fmtCLP, cn } from '../../shared/lib/utils';
import { fmtUSD } from '../../shared/lib/format';
import './quote-modal.css';

// Maps each editable field shown to admin to the cot_* template key in
// pricing_config. The QuoteModal pre-fills inputs with those defaults the
// first time a link is cotized; saved costs take priority afterwards.
// The purchase basis always comes from the current negotiated USA price.
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

const USD_PRINCIPALES = ['trailer_usd', 'inspeccion_usd', 'inland_usa_usd', 'transporte_roro_usd', 'fumigacion_usd', 'seguro_usd'];
const CLP_PRINCIPALES = ['fee_wire_clp', 'inland_puerto_clp', 'chequeo_mecanico_clp', 'pulido_clp', 'entrega_clp'];
const QUOTE_TABS = [
  { id: 'usd', label: 'Costos en USD', icon: DollarSign },
  { id: 'clp', label: 'Costos en CLP', icon: Wallet },
  { id: 'pagos', label: 'Impuestos y pagos', icon: Percent },
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
  const [tab, setTab] = useState('usd');
  const initOnce = useRef(false);
  const previewRef = useRef(null);

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
      // La negociación vigente del expediente manda sobre una cotización
      // anterior. El publicado se muestra sólo como referencia, nunca de base.
      valor_negociado_usd: num(link?.value_to_negotiate_usd) > 0 ? num(link.value_to_negotiate_usd) : null,
      valor_lancha_usd: num(link?.value_to_negotiate_usd),
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
  function setNegociado(v) {
    setQ(prev => ({ ...prev, valor_negociado_usd: v, valor_lancha_usd: num(v) }));
  }

  async function handleSave(publishNow = false) {
    if (!q || !calc || !link?.id || num(q.valor_negociado_usd) <= 0) return;
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
  const baseDefinida = num(q?.valor_negociado_usd) > 0;
  const snapshot = typeof link?.quote_data === 'string' ? safeParse(link.quote_data) : link?.quote_data;
  const baseCambio = baseDefinida && snapshot && Math.round(num(snapshot.valor_lancha_usd) * 100) !== Math.round(num(q.valor_lancha_usd) * 100);

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
      title={<span className="quote-heading"><Receipt size={22} />Cotizador de importación</span>}
      description={<span className="quote-context">{boatTitle}{link?.location && <span> · {link.location}</span>}</span>}
      size="full"
      className="quote-dialog"
      headerClassName="quote-dialog-header"
      bodyClassName="quote-dialog-body"
      footerClassName="quote-dialog-footer"
      footer={(
        <div className="quote-footer">
          <div className="quote-footer-info">
            <Clock size={17} />
            <div>
              <p>El cliente la verá en 24 horas</p>
              <span title={meta}>{meta || 'Puedes publicarla antes con «Publicar ahora».'}</span>
            </div>
            {extras.length > 0 && <div className="quote-more-actions"><Menu items={extras} label="Más acciones de la cotización" /></div>}
          </div>
          <div className="quote-footer-actions">
            <Button variant="ghost" size="lg" onClick={onClose} disabled={ocupado} className="quote-cancel">Cancelar</Button>
            <Button variant="secondary" size="lg" icon={Send} onClick={() => handleSave(true)} disabled={ocupado || !calc || !baseDefinida} title="Publica al cliente sin esperar las 24 horas y le envía un correo" className="quote-publish">Publicar ahora</Button>
            <Button size="lg" icon={Check} onClick={() => handleSave(false)} loading={saving} disabled={deleting || sendingBreakdown || !calc || !baseDefinida} className="quote-save">Guardar cotización</Button>
          </div>
        </div>
      )}
    >
      {(!q || loadingPricing) ? (
        <div className="quote-loading"><Spinner label="Cargando los datos del cotizador…" /></div>
      ) : (
        <>
        <div className="quote-mobile-total">
          <div><span>Total puesto en Chile</span><strong>{baseDefinida ? fmtCLP(calc.totalClp) : 'Por calcular'}</strong></div>
          <Button variant="ghost" size="sm" onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver resumen</Button>
        </div>
        <div className="quote-workspace">
          <div className="quote-editor">
            <section className="quote-card" aria-labelledby="quote-purchase-title">
              <SectionHeading icon={Ship} id="quote-purchase-title" title="Datos de la compra" description="El punto de partida de esta importación." />
              <div className="quote-purchase-fields">
                <Select label="Modalidad de envío" size="lg" value={q.modalidad} onChange={e => set('modalidad', e.target.value)} options={[{ value: 'RORO', label: 'RORO' }, { value: 'Container', label: 'Contenedor' }, { value: 'Otro', label: 'Otra modalidad' }]} />
                <NumberInput label="Tipo de cambio" hint="Pesos chilenos por 1 USD" size="lg" unit="CLP" step="0.01" value={q.usd_clp_rate} onChange={e => set('usd_clp_rate', e.target.value)} />
                <div className="quote-published-price"><span>Valor publicado · USA</span><strong>{fmtUSD(num(link?.value_usa_usd))}</strong><small>Referencia del anuncio</small></div>
              </div>
              <div className="quote-negotiated-price">
                <MoneyInput label="Valor negociado · USA" hint="Base de compra para todos los cálculos" placeholder="Ingresa el valor acordado" required size="lg" currency="USD" value={q.valor_negociado_usd} onChange={setNegociado} />
                <div><span className="quote-base-badge">Base del cálculo</span><p>{baseDefinida ? 'El total, los impuestos y los pagos se calculan sobre este valor negociado.' : 'Ingresa el precio acordado con el vendedor para calcular el total de la importación.'}</p></div>
              </div>
              {baseCambio && <p className="quote-base-warning"><Info size={16} />La cotización guardada usaba otra base. Revisa el nuevo total antes de guardar o publicar.</p>}
            </section>

            <div className="quote-costs">
              <Tabs tabs={QUOTE_TABS} value={tab} onChange={setTab} variant="pills" className="quote-tabs" aria-label="Ajustes de la cotización" />
              <div role="tabpanel" aria-label={QUOTE_TABS.find(t => t.id === tab)?.label} className="quote-tab-panel">
                {tab === 'usd' && (
                  <CostSection
                    title="Logística internacional" description="Preparación, transporte y seguro de la embarcación."
                    icon={Ship} currency="USD" fields={USD_FIELDS} principalKeys={USD_PRINCIPALES}
                    extraTitle="Cargos de naviera y puerto" extraDescription="Tarifas y recargos complementarios en dólares."
                    subtotal={calc.usdLogisticosSum} q={q} onChange={set}
                  />
                )}
                {tab === 'clp' && (
                  <CostSection
                    title="Llegada y entrega en Chile" description="Costos locales, trámites y preparación para la entrega."
                    icon={Wallet} currency="CLP" fields={CLP_FIELDS} principalKeys={CLP_PRINCIPALES}
                    extraTitle="Aduana y gastos adicionales" extraDescription="Autorizaciones, servicios y gestión portuaria."
                    subtotal={calc.clpLogisticosSum} q={q} onChange={set}
                  />
                )}
                {tab === 'pagos' && (
                  <div className="quote-tax-sections">
                    <section className="quote-card" aria-labelledby="quote-tax-title">
                      <SectionHeading icon={ShieldCheck} id="quote-tax-title" title="Impuestos y gestión" description="Ajusta los cargos que completan el valor final." />
                      <div className="quote-field-grid">
                        <MoneyInput label="Fee Imporlan" hint="Gestión interna de esta operación" size="lg" currency="CLP" value={q.fee_imporlan_clp} onChange={v => set('fee_imporlan_clp', v)} />
                        <NumberInput label="IVA aduanero" hint={baseDefinida ? `Base CIF: ${fmtCLP(calc.cifClp)}` : 'Falta el valor negociado para calcular el CIF'} size="lg" unit="%" value={q.iva_pct} step="0.1" onChange={e => set('iva_pct', e.target.value)} />
                      </div>
                      <div className="quote-luxury">
                        <Switch label="Aplicar impuesto al lujo" hint="Actívalo cuando corresponda a esta embarcación." checked={!!q.lujo_aplica} onChange={v => set('lujo_aplica', v)} />
                        <NumberInput label="Tasa de lujo" size="lg" unit="%" value={q.lujo_pct} step="0.1" disabled={!q.lujo_aplica} onChange={e => set('lujo_pct', e.target.value)} />
                      </div>
                    </section>
                    <section className="quote-card" aria-labelledby="quote-payments-title">
                      <SectionHeading icon={Percent} id="quote-payments-title" title="Distribución de los pagos" description="Los tres porcentajes deben sumar 100 %." />
                      <div className="quote-payment-fields">
                        {[1, 2, 3].map(n => <NumberInput key={n} size="lg" label={`Pago ${n}`} unit="%" step="0.1" value={q[`pago_${n}_pct`]} onChange={e => set(`pago_${n}_pct`, e.target.value)} />)}
                      </div>
                      <p className={cn('quote-payment-check', pagosOk ? 'quote-payment-check--ok' : 'quote-payment-check--error')} role={pagosOk ? undefined : 'alert'}>
                        {pagosOk ? <Check size={16} /> : <Info size={16} />}
                        {pagosOk ? 'Distribución completa' : 'Revisa la distribución de los pagos'}
                        <strong>{calc.pagosSum.toFixed(1)} % de 100 %</strong>
                      </p>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside ref={previewRef} className="quote-preview" aria-label="Vista del cliente">
            <div className="quote-preview-heading"><Eye size={17} /><h3>Vista del cliente</h3><span>Vista previa</span></div>
            <section className="quote-total-card" aria-label="Total de la importación">
              <p>Total puesto en Chile</p>
              <output className="quote-total" aria-label="Total en pesos chilenos" aria-live="polite" aria-atomic="true">{baseDefinida ? fmtCLP(calc.totalClp) : 'Por calcular'}</output>
              <span className="quote-total-usd">{baseDefinida ? `Aprox. ${fmtUSD(calc.totalUsd)}` : 'Falta el valor negociado en USA'}</span>
              <div className="quote-total-meta"><Ship size={15} />{q.modalidad === 'Container' ? 'Contenedor' : q.modalidad} <span>·</span> 1 USD = {fmtCLP(num(q.usd_clp_rate))}</div>
            </section>

            <section className="quote-breakdown" aria-labelledby="quote-breakdown-title">
              <h4 id="quote-breakdown-title">Composición del precio</h4>
              <dl>
                <PriceRow label="Valor de compra negociado" sub={baseDefinida ? fmtUSD(calc.lanchaUsd) : 'Pendiente de negociación'} value={baseDefinida ? fmtCLP(calc.lanchaClp) : '—'} />
                <PriceRow label="Servicio All-Inclusive" value={fmtCLP(calc.allInclusiveTotal)} />
                <PriceRow label="IVA aduanero" sub={`${num(q.iva_pct)} % sobre CIF`} value={baseDefinida ? fmtCLP(calc.ivaClp) : '—'} />
                <PriceRow label="Impuesto al lujo" sub={q.lujo_aplica ? `${num(q.lujo_pct)} % sobre la lancha` : null} value={q.lujo_aplica ? (baseDefinida ? fmtCLP(calc.lujoClp) : '—') : 'No aplica'} muted={!q.lujo_aplica} />
              </dl>
            </section>

            <section className="quote-payment-preview" aria-labelledby="quote-plan-title">
              <div className="quote-plan-heading"><h4 id="quote-plan-title">Plan de pagos</h4><span className={cn('quote-plan-badge', !pagosOk && 'quote-plan-badge--warning')}>{pagosOk ? '3 pagos' : 'Revisar'}</span></div>
              <ol>
                {[1, 2, 3].map(n => <li key={n}><span className="quote-payment-number">{n}</span><span className="quote-payment-name">Pago {n}<small>{calc.pagos[`p${n}`].pct} % del total</small></span><strong>{baseDefinida ? fmtCLP(calc.pagos[`p${n}`].clp) : '—'}</strong></li>)}
              </ol>
            </section>
            <p className="quote-publication-note"><Clock size={16} /><span>Al guardar, el cliente verá la cotización <strong>en 24 horas</strong>. Para publicarla y enviar el correo al momento, elige «Publicar ahora».</span></p>
          </aside>
        </div>
        </>
      )}
    </Modal>
  );
}

function SectionHeading({ icon, id, title, description, children }) {
  const Icon = icon;
  return <div className="quote-section-heading"><span className="quote-section-icon"><Icon size={19} /></span><div><h3 id={id}>{title}</h3>{description && <p>{description}</p>}</div>{children}</div>;
}

function CostSection({ title, description, icon, currency, fields, principalKeys, extraTitle, extraDescription, subtotal, q, onChange }) {
  const principales = fields.filter(f => principalKeys.includes(f.key));
  const extras = fields.filter(f => !principalKeys.includes(f.key));
  const fmt = currency === 'USD' ? fmtUSD : fmtCLP;
  const extraTotal = extras.reduce((sum, f) => sum + num(q[f.key]), 0);
  const input = f => <MoneyInput key={f.key} size="lg" label={f.label} currency={currency} value={q[f.key]} onChange={v => onChange(f.key, v)} />;
  return (
    <section className="quote-card quote-cost-card">
      <SectionHeading icon={icon} title={title} description={description} />
      <div className="quote-field-grid">{principales.map(input)}</div>
      <details className="quote-extra-costs">
        <summary><span><strong>{extraTitle}</strong><small>{extras.length} conceptos · {fmt(extraTotal)}</small></span><ChevronDown size={18} /></summary>
        <div><p>{extraDescription}</p><div className="quote-field-grid">{extras.map(input)}</div></div>
      </details>
      <div className="quote-cost-subtotal"><span>Subtotal en {currency}</span><strong>{fmt(subtotal)}</strong></div>
    </section>
  );
}

function PriceRow({ label, sub, value, muted }) {
  return <div className="quote-price-row"><dt>{label}{sub && <small>{sub}</small>}</dt><dd className={muted ? 'quote-price-muted' : undefined}>{value}</dd></div>;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
