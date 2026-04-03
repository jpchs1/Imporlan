import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getPricing, updatePricing } from '../lib/api';
import { PageHeader, Card, Button, Input, Spinner } from '../components/UI';

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
      setMsg('Configuracion guardada');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function savePricing() {
    setSaving(true);
    try {
      await updatePricing(pricing);
      setMsg('Precios actualizados');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Configuracion" subtitle="Ajustes del sistema" />

      {msg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{msg}</div>}

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'general' ? 'primary' : 'secondary'} onClick={() => setTab('general')}>General</Button>
        <Button variant={tab === 'pricing' ? 'primary' : 'secondary'} onClick={() => setTab('pricing')}>Precios</Button>
      </div>

      {tab === 'general' && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Configuracion general</h3>
          <div className="space-y-4 max-w-xl">
            <Input label="Nombre del sitio" value={settings.site_name || ''} onChange={e => setSettings({...settings, site_name: e.target.value})} />
            <Input label="Email de contacto" value={settings.contact_email || ''} onChange={e => setSettings({...settings, contact_email: e.target.value})} />
            <Input label="Telefono" value={settings.phone || ''} onChange={e => setSettings({...settings, phone: e.target.value})} />
            <Input label="Direccion" value={settings.address || ''} onChange={e => setSettings({...settings, address: e.target.value})} />
            <Input label="Dolar observado (CLP)" type="number" value={settings.dollar_rate || ''} onChange={e => setSettings({...settings, dollar_rate: e.target.value})} />
            <Input label="WhatsApp" value={settings.whatsapp || ''} onChange={e => setSettings({...settings, whatsapp: e.target.value})} />
            <Button onClick={saveSettings} disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuracion'}</Button>
          </div>
        </Card>
      )}

      {tab === 'pricing' && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Configuracion de precios</h3>
          <div className="space-y-4 max-w-xl">
            <Input label="Comision por busqueda (%)" type="number" value={pricing.search_commission || ''} onChange={e => setPricing({...pricing, search_commission: e.target.value})} />
            <Input label="Tarifa de inspeccion (CLP)" type="number" value={pricing.inspection_fee || ''} onChange={e => setPricing({...pricing, inspection_fee: e.target.value})} />
            <Input label="Tarifa de importacion (%)" type="number" value={pricing.import_fee || ''} onChange={e => setPricing({...pricing, import_fee: e.target.value})} />
            <Input label="IVA (%)" type="number" value={pricing.iva || ''} onChange={e => setPricing({...pricing, iva: e.target.value})} />
            <Button onClick={savePricing} disabled={saving}>{saving ? 'Guardando...' : 'Guardar precios'}</Button>
          </div>
        </Card>
      )}
    </>
  );
}
