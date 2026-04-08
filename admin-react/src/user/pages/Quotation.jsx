import { useState } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { fmtCLP } from '../../shared/lib/utils';
import { Card, Button, Input, Textarea } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { createWebPayTransaction, createMercadoPagoPreference } from '../api';

const PRICE_PER_LINK = 9900;
const COUNTRIES = [
  { value: 'Chile', label: 'Chile' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Otro', label: 'Otro' },
];

export default function Quotation() {
  const toast = useToast();
  const { user } = useAuth();
  const [links, setLinks] = useState(['']);
  const [form, setForm] = useState({
    name: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || user?.user_email || '',
    phone: '',
    country: 'Chile',
    port: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [paying, setPaying] = useState(false);

  const validLinks = links.filter(l => l.trim());
  const total = validLinks.length * PRICE_PER_LINK;

  function addLink() { if (links.length < 10) setLinks([...links, '']); }
  function removeLink(i) { if (links.length > 1) setLinks(links.filter((_, idx) => idx !== i)); }
  function updateLink(i, val) { setLinks(links.map((l, idx) => idx === i ? val : l)); }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handlePay(method) {
    if (validLinks.length === 0) { toast?.('Agrega al menos un link', 'error'); return; }
    if (!form.name || !form.email) { toast?.('Completa tus datos de contacto', 'error'); return; }
    if (!accepted) { toast?.('Acepta los terminos y condiciones', 'error'); return; }

    setPaying(true);
    const desc = `Cotizacion por ${validLinks.length} link${validLinks.length > 1 ? 's' : ''}`;
    const fullName = `${form.name} ${form.lastName}`.trim();

    try {
      if (method === 'webpay') {
        const data = await createWebPayTransaction({
          amount: total,
          session_id: `cot_${Date.now()}`,
          buy_order: `COT-${Date.now()}`,
          user_email: form.email,
          payer_name: fullName,
          payer_phone: form.phone,
          country: form.country,
          plan_name: 'Cotizacion por Links',
          description: desc,
          type: 'cotizacion_link',
          return_url: window.location.href,
        });
        if (data.success && data.url && data.token) {
          const f = document.createElement('form');
          f.method = 'POST'; f.action = data.url;
          const inp = document.createElement('input');
          inp.type = 'hidden'; inp.name = 'token_ws'; inp.value = data.token;
          f.appendChild(inp); document.body.appendChild(f); f.submit();
          return;
        } else { toast?.('Error al crear transaccion', 'error'); }
      } else if (method === 'mercadopago') {
        const data = await createMercadoPagoPreference({
          amount: total,
          description: desc,
          plan_name: 'Cotizacion por Links',
          payer_email: form.email,
          payer_name: fullName,
          payer_phone: form.phone,
          country: form.country,
        });
        if (data.success && data.init_point) {
          window.location.href = data.init_point;
          return;
        } else { toast?.('Error al crear preferencia', 'error'); }
      }
    } catch (e) { toast?.(e.message || 'Error al procesar pago', 'error'); }
    setPaying(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-900 to-slate-900 rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Cotizador Online</h1>
          <p className="text-sm text-cyan-200/70">Ingresa los links de las lanchas que te interesan y obtendras una cotizacion</p>
        </div>
      </div>

      {/* Price banner */}
      <div className="bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /></svg>
          <span className="text-sm font-medium text-cyan-800">Precio por cotizacion de link: cada link tiene un costo fijo</span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-cyan-700">{fmtCLP(PRICE_PER_LINK)}</span>
          <span className="text-xs text-cyan-500 block">por cada link</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: Destination + Contact */}
        <div className="space-y-5">
          <Card>
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              Destino de la Lancha
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pais destino</label>
                <select value={form.country} onChange={e => set('country', e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white">
                  {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <Input label="Puerto / Lugar de entrega" value={form.port} onChange={e => set('port', e.target.value)} placeholder="Ej: Valparaiso, San Antonio, Vina del Mar" />
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              Datos de Contacto
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre" />
                <Input label="Apellidos" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Tus apellidos" />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tu@email.com" />
              <Input label="Telefono" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 XXXX XXXX" />
            </div>
          </Card>
        </div>

        {/* Right: Links */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.878l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                Links de Lanchas a Cotizar
              </h2>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-100 text-cyan-700 text-xs font-bold">{validLinks.length} link{validLinks.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Ingresa links de BoatTrader, YachtWorld, Boats.com u otros portales nauticos</p>

            <div className="space-y-3">
              {links.map((link, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <svg className="w-3 h-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
                      Link {i + 1} {i === 0 && '*'}
                    </label>
                    {link.trim() && <span className="text-xs font-semibold text-emerald-600">+ {fmtCLP(PRICE_PER_LINK)}</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={e => updateLink(i, e.target.value)}
                      placeholder="https://www.boattrader.com/boat/..."
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition-all bg-white"
                    />
                    {links.length > 1 && (
                      <button type="button" onClick={() => removeLink(i)} className="px-2 text-slate-400 hover:text-red-500 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {links.length < 10 && (
              <button onClick={addLink} className="mt-4 w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-cyan-400 hover:text-cyan-600 transition flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg>
                Agregar otro link
              </button>
            )}
          </Card>
        </div>
      </div>

      {/* Total + Pay */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
          </div>
          <div>
            <p className="text-sm text-slate-400">Total a Pagar</p>
            <p className="text-2xl font-bold">{fmtCLP(total)}</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-sm mb-4">
          <div className="flex justify-between"><span className="text-slate-400">Links ingresados</span><span className="font-semibold">{validLinks.length}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Precio por link</span><span>{fmtCLP(PRICE_PER_LINK)}</span></div>
          <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5"><span className="font-bold">Total</span><span className="font-bold text-cyan-400">{fmtCLP(total)}</span></div>
        </div>

        <label className="flex items-start gap-2 text-xs text-slate-400 mb-4 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-cyan-500 rounded cursor-pointer" />
          <span>Acepto los terminos y condiciones para recibir esta cotizacion, y confirmo que he leido la politica de privacidad.</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="accent"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => handlePay('webpay')}
            disabled={paying || total === 0 || !accepted}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            {paying ? 'Procesando...' : 'Pagar con WebPay'}
          </Button>
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2 !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
            onClick={() => handlePay('mercadopago')}
            disabled={paying || total === 0 || !accepted}
          >
            {paying ? 'Procesando...' : 'Pagar con MercadoPago'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
