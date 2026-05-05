import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getPricing, updatePricing } from '../api';
import { PageHeader, Card, Button, Input, Spinner } from '../../shared/components/UI';

// Cotizador config schema — drives the editable form for the importation cost
// calculator. Keys match the cot_* entries seeded by api/settings_api.php in
// cotizadorSeedDefaults(). Section + label are display-only.
const COTIZADOR_SECTIONS = [
  {
    title: 'Tipo de cambio, pagos y delay cliente',
    fields: [
      { key: 'cot_usd_clp_rate', label: 'Tipo de cambio USD → CLP' },
      { key: 'cot_client_delay_hours', label: 'Horas de delay antes de mostrar al cliente' },
      { key: 'cot_pago_1_pct', label: 'Pago 1 (%)' },
      { key: 'cot_pago_2_pct', label: 'Pago 2 (%)' },
      { key: 'cot_pago_3_pct', label: 'Pago 3 (%)' },
    ],
  },
  {
    title: 'Cargos y porcentajes',
    fields: [
      { key: 'cot_pct_iva_aduanero', label: 'IVA Aduanero (%)' },
      { key: 'cot_pct_impuesto_lujo', label: 'Impuesto al Lujo (%)' },
      { key: 'cot_clp_fee_imporlan_default', label: 'FEE Imporlan default (CLP)' },
    ],
  },
  {
    title: 'Costos en USD (defaults — editables por cotización)',
    fields: [
      { key: 'cot_usd_trailer', label: 'Trailer (si no trae)' },
      { key: 'cot_usd_inspeccion_lancha', label: 'Inspección Técnica USA' },
      { key: 'cot_usd_inland_usa', label: 'Inland USA (bodegaje + entrega puerto)' },
      { key: 'cot_usd_transporte_roro', label: 'Transporte Marítimo (RORO)' },
      { key: 'cot_usd_certificado_fumigacion', label: 'Certificado de Fumigación' },
      { key: 'cot_usd_seguro', label: 'Seguro / Insurance' },
      { key: 'cot_usd_gastos_locales_naviera', label: 'Gastos Locales Naviera' },
      { key: 'cot_usd_congestion_surcharge', label: 'Congestion Surcharge' },
      { key: 'cot_usd_thc', label: 'THC' },
      { key: 'cot_usd_baf', label: 'BAF (Impuesto)' },
      { key: 'cot_usd_wharfage', label: 'WHARFAGE' },
      { key: 'cot_usd_handling_chile', label: 'Handling Chile' },
      { key: 'cot_usd_miami_admin_fee', label: 'Miami Admin FEE' },
      { key: 'cot_usd_escorte', label: 'Escorte (Port Pass)' },
    ],
  },
  {
    title: 'Costos en CLP (defaults — editables por cotización)',
    fields: [
      { key: 'cot_clp_fee_wire_transfer', label: 'FEE Wire Transferencia' },
      { key: 'cot_clp_inland_puerto_santiago', label: 'Inland Puerto → Santiago' },
      { key: 'cot_clp_chequeo_mecanico', label: 'Chequeo Mecánico Chile' },
      { key: 'cot_clp_pulido_tratamiento', label: 'Pulido y Tratamiento Chile' },
      { key: 'cot_clp_entrega_traslado', label: 'Entrega / Traslado' },
      { key: 'cot_clp_aduana_extra', label: 'Aduana (M$1.2 + IVA)' },
      { key: 'cot_clp_autorizaciones', label: 'Autorizaciones' },
      { key: 'cot_clp_gastos_puerto', label: 'Gastos de Puerto' },
      { key: 'cot_clp_agencia_aduana', label: 'Agencia de Aduana' },
      { key: 'cot_clp_iva_servicios_linea', label: 'IVA Servicios (línea)' },
      { key: 'cot_clp_gastos_despachos', label: 'Gastos de Despachos' },
      { key: 'cot_clp_honorarios_agencia', label: 'Honorarios Agencia' },
    ],
  },
];

export default function Config() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({});
  const [pricing, setPricing] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getSettings(), getPricing().catch(() => ({}))]);
      setSettings(s.settings || s || {});
      setPricing(p.pricing || p || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await updateSettings(settings);
      setMsg('Configuración guardada');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert(e.message); }
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
      setMsg('Configuración guardada');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert(e.message || 'Error al guardar'); }
    setSaving(false);
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

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Configuración" subtitle="Ajustes del sistema" />

      {msg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{msg}</div>}

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button variant={tab === 'general' ? 'primary' : 'secondary'} onClick={() => setTab('general')}>General</Button>
        <Button variant={tab === 'pricing' ? 'primary' : 'secondary'} onClick={() => setTab('pricing')}>Precios</Button>
        <Button variant={tab === 'cotizador' ? 'primary' : 'secondary'} onClick={() => setTab('cotizador')}>Cotizador</Button>
      </div>

      {tab === 'general' && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Configuración general</h3>
          <div className="space-y-4 max-w-xl">
            <Input label="Nombre del sitio" value={settings.site_name || ''} onChange={e => setSettings({...settings, site_name: e.target.value})} />
            <Input label="Email de contacto" value={settings.contact_email || ''} onChange={e => setSettings({...settings, contact_email: e.target.value})} />
            <Input label="Teléfono" value={settings.phone || ''} onChange={e => setSettings({...settings, phone: e.target.value})} />
            <Input label="Dirección" value={settings.address || ''} onChange={e => setSettings({...settings, address: e.target.value})} />
            <Input label="Dólar observado (CLP)" type="number" value={settings.dollar_rate || ''} onChange={e => setSettings({...settings, dollar_rate: e.target.value})} />
            <Input label="WhatsApp" value={settings.whatsapp || ''} onChange={e => setSettings({...settings, whatsapp: e.target.value})} />
            <Button onClick={saveSettings} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
          </div>
        </Card>
      )}

      {tab === 'pricing' && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Precios y comisiones (legacy)</h3>
          <p className="text-xs text-slate-400 mb-4">Estos cuatro valores son del sistema antiguo. Para el cotizador completo usa la pestaña <strong>Cotizador</strong>.</p>
          <div className="space-y-4 max-w-xl">
            <Input label="Comisión por búsqueda (%)" type="number" value={getCotValue('search_commission')} onChange={e => setCotField('search_commission', e.target.value)} />
            <Input label="Tarifa de inspección (CLP)" type="number" value={getCotValue('inspection_fee')} onChange={e => setCotField('inspection_fee', e.target.value)} />
            <Input label="Tarifa de importación (%)" type="number" value={getCotValue('import_fee')} onChange={e => setCotField('import_fee', e.target.value)} />
            <Input label="IVA (%)" type="number" value={getCotValue('iva')} onChange={e => setCotField('iva', e.target.value)} />
            <Button onClick={savePricing} disabled={saving}>{saving ? 'Guardando...' : 'Guardar precios'}</Button>
          </div>
        </Card>
      )}

      {tab === 'cotizador' && (
        <div className="space-y-4">
          <div className="text-sm text-slate-500 leading-relaxed">
            Estos son los valores plantilla que usa el cotizador. Cada cotización por link toma estos defaults y permite override por embarcación (modalidad RORO/contenedor, tarifas variables, etc.). Los porcentajes son sobre <span className="font-medium text-slate-700">CIF</span> (lancha + transporte) para IVA y sobre <span className="font-medium text-slate-700">valor lancha</span> para Lujo.
          </div>

          {COTIZADOR_SECTIONS.map(section => (
            <Card key={section.title}>
              <h3 className="font-semibold text-slate-700 mb-4 text-sm">{section.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.fields.map(f => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type="number"
                    value={getCotValue(f.key)}
                    onChange={e => setCotField(f.key, e.target.value)}
                  />
                ))}
              </div>
            </Card>
          ))}

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button onClick={savePricing} disabled={saving} className="shadow-xl">
              {saving ? 'Guardando...' : 'Guardar cotizador'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
