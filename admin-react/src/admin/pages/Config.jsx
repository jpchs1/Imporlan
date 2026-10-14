import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSettings, updateSettings, getPricing, updatePricing } from '../api';
import { PageHeader, Card, Button, Input, MoneyInput, NumberInput, FormGrid, Tabs, Spinner, ErrorState } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

// Esquema del cotizador: cada clave es una entrada cot_* que siembra
// api/settings_api.php (cotizadorSeedDefaults()). `type` solo decide qué
// control se pinta: clp / usd (MoneyInput con miles), pct / hours / rate
// (NumberInput con unidad). El valor se guarda como texto, igual que antes.
const COTIZADOR_SECTIONS = [
  {
    id: 'base',
    title: 'Tipo de cambio y pagos',
    description: 'Cómo se convierte a pesos y en cuántas cuotas se divide la cotización.',
    fields: [
      { key: 'cot_usd_clp_rate', label: 'Tipo de cambio', type: 'rate', hint: 'Pesos por cada dólar' },
      { key: 'cot_client_delay_hours', label: 'Espera antes de mostrar al cliente', type: 'hours' },
      { key: 'cot_pago_1_pct', label: 'Pago 1', type: 'pct' },
      { key: 'cot_pago_2_pct', label: 'Pago 2', type: 'pct' },
      { key: 'cot_pago_3_pct', label: 'Pago 3', type: 'pct' },
    ],
  },
  {
    id: 'cargos',
    title: 'Impuestos y comisión',
    description: 'El IVA se calcula sobre el CIF (lancha + transporte); el impuesto al lujo, sobre el valor de la lancha.',
    fields: [
      { key: 'cot_pct_iva_aduanero', label: 'IVA aduanero', type: 'pct' },
      { key: 'cot_pct_impuesto_lujo', label: 'Impuesto al lujo', type: 'pct' },
      { key: 'cot_clp_fee_imporlan_default', label: 'Fee Imporlan por defecto', type: 'clp' },
    ],
  },
  {
    id: 'usd',
    title: 'Costos en USD',
    description: 'Valores por defecto en Estados Unidos; se pueden ajustar en cada cotización.',
    fields: [
      { key: 'cot_usd_trailer', label: 'Trailer (si no trae)', type: 'usd' },
      { key: 'cot_usd_inspeccion_lancha', label: 'Inspección técnica en USA', type: 'usd' },
      { key: 'cot_usd_inland_usa', label: 'Inland USA (bodegaje y entrega a puerto)', type: 'usd' },
      { key: 'cot_usd_transporte_roro', label: 'Transporte marítimo (RORO)', type: 'usd' },
      { key: 'cot_usd_certificado_fumigacion', label: 'Certificado de fumigación', type: 'usd' },
      { key: 'cot_usd_seguro', label: 'Seguro', type: 'usd' },
      { key: 'cot_usd_gastos_locales_naviera', label: 'Gastos locales naviera', type: 'usd' },
      { key: 'cot_usd_congestion_surcharge', label: 'Congestion surcharge', type: 'usd' },
      { key: 'cot_usd_thc', label: 'THC', type: 'usd' },
      { key: 'cot_usd_baf', label: 'BAF', type: 'usd' },
      { key: 'cot_usd_wharfage', label: 'Wharfage', type: 'usd' },
      { key: 'cot_usd_handling_chile', label: 'Handling Chile', type: 'usd' },
      { key: 'cot_usd_miami_admin_fee', label: 'Miami admin fee', type: 'usd' },
      { key: 'cot_usd_escorte', label: 'Escolta (Port Pass)', type: 'usd' },
    ],
  },
  {
    id: 'clp',
    title: 'Costos en CLP',
    description: 'Valores por defecto en Chile; se pueden ajustar en cada cotización.',
    fields: [
      { key: 'cot_clp_fee_wire_transfer', label: 'Fee transferencia internacional', type: 'clp' },
      { key: 'cot_clp_inland_puerto_santiago', label: 'Inland puerto → Santiago', type: 'clp' },
      { key: 'cot_clp_chequeo_mecanico', label: 'Chequeo mecánico en Chile', type: 'clp' },
      { key: 'cot_clp_pulido_tratamiento', label: 'Pulido y tratamiento', type: 'clp' },
      { key: 'cot_clp_entrega_traslado', label: 'Entrega y traslado', type: 'clp' },
      { key: 'cot_clp_aduana_extra', label: 'Aduana (M$1.2 + IVA)', type: 'clp' },
      { key: 'cot_clp_autorizaciones', label: 'Autorizaciones', type: 'clp' },
      { key: 'cot_clp_gastos_puerto', label: 'Gastos de puerto', type: 'clp' },
      { key: 'cot_clp_agencia_aduana', label: 'Agencia de aduana', type: 'clp' },
      { key: 'cot_clp_iva_servicios_linea', label: 'IVA servicios (línea)', type: 'clp' },
      { key: 'cot_clp_gastos_despachos', label: 'Gastos de despacho', type: 'clp' },
      { key: 'cot_clp_honorarios_agencia', label: 'Honorarios de agencia', type: 'clp' },
    ],
  },
];

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'cotizador', label: 'Cotizador' },
];

const UNIT = { pct: '%', hours: 'h', rate: 'CLP' };

/** Un campo del cotizador según su tipo. El valor viaja siempre como texto. */
function CampoCotizador({ field, value, onChange }) {
  if (field.type === 'clp' || field.type === 'usd') {
    const n = value === '' || value === null || value === undefined ? null : Number(value);
    return (
      <MoneyInput
        label={field.label}
        hint={field.hint}
        currency={field.type === 'usd' ? 'USD' : 'CLP'}
        value={Number.isFinite(n) ? n : null}
        onChange={v => onChange(v === null ? '' : String(v))}
      />
    );
  }
  return (
    <NumberInput
      label={field.label}
      hint={field.hint}
      unit={UNIT[field.type] || ''}
      step="any"
      min="0"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export default function Config() {
  const toast = useToast();
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({});
  const [pricing, setPricing] = useState({});
  const [base, setBase] = useState({ settings: '{}', pricing: '{}' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, p] = await Promise.all([getSettings(), getPricing().catch(() => ({}))]);
        if (!alive) return;
        const st = s.settings || s || {};
        const pr = p.pricing || p || {};
        setSettings(st);
        setPricing(pr);
        setBase({ settings: JSON.stringify(st), pricing: JSON.stringify(pr) });
        setError('');
      } catch (e) {
        if (alive) setError(e.message || 'No se pudo cargar la configuración');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  const reload = useCallback(() => { setLoading(true); setTick(t => t + 1); }, []);

  const dirtySettings = useMemo(() => JSON.stringify(settings) !== base.settings, [settings, base.settings]);
  const dirtyPricing = useMemo(() => JSON.stringify(pricing) !== base.pricing, [pricing, base.pricing]);
  const dirty = tab === 'general' ? dirtySettings : dirtyPricing;

  async function saveSettings() {
    setSaving(true);
    try {
      await updateSettings(settings);
      setBase(b => ({ ...b, settings: JSON.stringify(settings) }));
      toast?.('Configuración guardada', 'success');
    } catch (e) { toast?.({ type: 'error', title: 'No se pudo guardar', description: e.message }); }
    setSaving(false);
  }

  async function savePricing() {
    setSaving(true);
    try {
      // Backend expects { configs: { key: value, ... } }. Flatten the
      // {key: {value, description, id}} shape we get back from getPricing.
      const configs = {};
      for (const [k, v] of Object.entries(pricing)) {
        configs[k] = v && typeof v === 'object' && 'value' in v ? v.value : v;
      }
      await updatePricing({ configs });
      setBase(b => ({ ...b, pricing: JSON.stringify(pricing) }));
      toast?.('Cotizador guardado', 'success');
    } catch (e) { toast?.({ type: 'error', title: 'No se pudo guardar', description: e.message || 'Error al guardar' }); }
    setSaving(false);
  }

  function descartar() {
    if (tab === 'general') setSettings(JSON.parse(base.settings));
    else setPricing(JSON.parse(base.pricing));
  }

  function setCotField(key, value) {
    setPricing(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), value },
    }));
  }

  function getCotValue(key) {
    return pricing[key]?.value ?? '';
  }

  const setS = (k) => (e) => setSettings(s => ({ ...s, [k]: e.target.value }));

  if (loading) return <Spinner />;
  if (error) return (<><PageHeader title="Configuración" /><Card><ErrorState message={error} onRetry={reload} /></Card></>);

  return (
    <form onSubmit={e => { e.preventDefault(); if (tab === 'general') saveSettings(); else savePricing(); }} className="flex flex-col min-h-full">
      <PageHeader title="Configuración" description="Datos de contacto del sitio y valores base del cotizador." />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" aria-label="Secciones de configuración" />

      {tab === 'general' && (
        <div role="tabpanel" className="space-y-4">
          <Card>
            <Card.Header title="Datos del sitio" description="Aparecen en el sitio web, en los correos y en el panel del cliente." />
            <Card.Body>
              <FormGrid cols={2}>
                <Input label="Nombre del sitio" value={settings.site_name || ''} onChange={setS('site_name')} />
                <Input label="Correo de contacto" type="email" autoComplete="off" value={settings.contact_email || ''} onChange={setS('contact_email')} />
                <Input label="Teléfono" type="tel" value={settings.phone || ''} onChange={setS('phone')} />
                <Input label="WhatsApp" type="tel" hint="Con código de país, sin espacios: +56912345678" value={settings.whatsapp || ''} onChange={setS('whatsapp')} />
                <Input label="Dirección" className="sm:col-span-2" value={settings.address || ''} onChange={setS('address')} />
              </FormGrid>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header title="Dólar observado" description="Valor de referencia para mostrar montos en pesos en el sitio." />
            <Card.Body>
              <FormGrid cols={2}>
                <NumberInput label="Dólar observado" unit="CLP" step="any" min="0" value={settings.dollar_rate ?? ''} onChange={setS('dollar_rate')} />
              </FormGrid>
            </Card.Body>
          </Card>
        </div>
      )}

      {tab === 'cotizador' && (
        <div role="tabpanel" className="space-y-4">
          <p className="text-sm text-ink-500 max-w-3xl">
            Valores plantilla del cotizador. Cada cotización por link parte de estos valores y permite ajustarlos por embarcación (RORO o contenedor, tarifas variables, etc.).
          </p>
          {COTIZADOR_SECTIONS.map(section => (
            <Card key={section.id}>
              <Card.Header title={section.title} description={section.description} />
              <Card.Body>
                <FormGrid cols={2} className="lg:grid-cols-3">
                  {section.fields.map(f => (
                    <CampoCotizador key={f.key} field={f} value={getCotValue(f.key)} onChange={v => setCotField(f.key, v)} />
                  ))}
                </FormGrid>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Barra de guardado: al pie del contenido, pegada abajo mientras se
          hace scroll, con fondo propio (no flota sobre las tarjetas). */}
      <div className="sticky bottom-0 mt-6 -mx-(--page-gutter) px-(--page-gutter) py-3 bg-surface/95 backdrop-blur border-t border-line flex flex-wrap items-center gap-3">
        <p className="text-13 text-ink-500 flex-1 min-w-[12rem]" aria-live="polite">
          {dirty ? 'Tienes cambios sin guardar.' : 'Todo guardado.'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={descartar} disabled={!dirty || saving}>Descartar</Button>
          <Button type="submit" loading={saving} disabled={!dirty}>{tab === 'general' ? 'Guardar configuración' : 'Guardar cotizador'}</Button>
        </div>
      </div>
    </form>
  );
}
