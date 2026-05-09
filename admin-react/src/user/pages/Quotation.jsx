import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { fmtCLP, cn } from '../../shared/lib/utils';
import { Card, Button, Input } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { createWebPayTransaction, createMercadoPagoPreference } from '../api';

const PRICE_PER_LINK = 9900;
const MIN_LINKS = 4;
const MAX_LINKS = 10;

const COUNTRIES = [
  { value: 'Chile', label: 'Chile', flag: '🇨🇱' },
  { value: 'Peru', label: 'Peru', flag: '🇵🇪' },
  { value: 'Colombia', label: 'Colombia', flag: '🇨🇴' },
  { value: 'Mexico', label: 'Mexico', flag: '🇲🇽' },
  { value: 'Argentina', label: 'Argentina', flag: '🇦🇷' },
  { value: 'Otro', label: 'Otro', flag: '🌎' },
];

const PORTALS = [
  { name: 'BoatTrader', host: 'boattrader.com', color: 'text-blue-700 bg-blue-50 ring-blue-200' },
  { name: 'YachtWorld', host: 'yachtworld.com', color: 'text-cyan-700 bg-cyan-50 ring-cyan-200' },
  { name: 'Boats.com', host: 'boats.com', color: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
  { name: 'iNautia', host: 'inautia.com', color: 'text-amber-700 bg-amber-50 ring-amber-200' },
  { name: 'Otros portales', host: '', color: 'text-slate-600 bg-slate-50 ring-slate-200' },
];

const BENEFITS = [
  'Cotizacion completa: precio + impuestos + transporte',
  'Validacion del estado del listing',
  'Comparativa entre las opciones que enviaste',
  'Recomendacion del equipo Imporlan',
  'Respuesta en 48 horas habiles',
];

function isValidUrl(s) {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\/.+/i.test(t) || t.includes('.');
}

export default function Quotation() {
  const toast = useToast();
  const { user } = useAuth();
  const [links, setLinks] = useState(['', '', '', '']);
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

  useEffect(() => {
    if (user && (!form.name || !form.email)) {
      setForm(f => ({
        ...f,
        name: f.name || (user.name?.split(' ')[0] || ''),
        lastName: f.lastName || (user.name?.split(' ').slice(1).join(' ') || ''),
        email: f.email || user.email || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const validLinks = links.filter(l => isValidUrl(l));
  const total = validLinks.length * PRICE_PER_LINK;
  const country = COUNTRIES.find(c => c.value === form.country);

  function addLink() { if (links.length < MAX_LINKS) setLinks([...links, '']); }
  function removeLink(i) { if (links.length > 1) setLinks(links.filter((_, idx) => idx !== i)); }
  function updateLink(i, val) { setLinks(links.map((l, idx) => idx === i ? val : l)); }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function detectPortal(url) {
    const t = (url || '').toLowerCase();
    for (const p of PORTALS) {
      if (p.host && t.includes(p.host)) return p;
    }
    return null;
  }

  async function handlePay(method) {
    if (validLinks.length === 0) { toast?.('Agrega al menos un link valido', 'error'); return; }
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

  const formReady = !!form.name && !!form.email;
  const canPay = validLinks.length > 0 && formReady && accepted && !paying;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Cotizacion express
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cotizador online</h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Pegá los links de las lanchas que te interesan (BoatTrader, YachtWorld, Boats.com, etc.) y te entregamos un informe completo con precio final puerta a puerta.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-5 py-3 text-right min-w-[180px]">
              <p className="text-[10px] text-cyan-300 font-semibold uppercase tracking-[0.2em]">Precio fijo</p>
              <p className="text-3xl font-extrabold leading-none mt-1">{fmtCLP(PRICE_PER_LINK)}</p>
              <p className="text-[11px] text-slate-300 mt-1">por cada link cotizado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits strip */}
      <Card className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-start gap-2 text-[12px] text-slate-600 leading-snug">
              <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Left column: Destino + Contacto */}
        <div className="space-y-5">
          {/* Destino */}
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Destino de la lancha</h2>
                <p className="text-xs text-slate-400 mt-0.5">A donde queres recibirla</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pais destino</label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('country', c.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition',
                        form.country === c.value
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm shadow-cyan-500/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300 hover:text-cyan-700'
                      )}
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Puerto / Lugar de entrega" value={form.port} onChange={e => set('port', e.target.value)} placeholder="Ej: Valparaiso, San Antonio, Vina del Mar" />
            </div>
          </Card>

          {/* Contacto */}
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Datos de contacto</h2>
                  <p className="text-xs text-slate-400 mt-0.5">A donde te enviamos la cotizacion</p>
                </div>
              </div>
              {user?.email && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200 shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                  Identificado
                </span>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre" />
                <Input label="Apellidos" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Tus apellidos" />
              </div>
              <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tu@email.com" />
              <Input label="Telefono" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 XXXX XXXX" />
            </div>
          </Card>
        </div>

        {/* Right column: Links */}
        <div>
          <Card className="h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Links a cotizar</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Pegá la URL de cada listing</p>
                </div>
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                validLinks.length > 0 ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
              )}>
                {validLinks.length} link{validLinks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Portales chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PORTALS.map(p => (
                <span key={p.name} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1', p.color)}>
                  {p.name}
                </span>
              ))}
            </div>

            <div className="space-y-2.5 flex-1">
              {links.map((link, i) => {
                const portal = detectPortal(link);
                const valid = isValidUrl(link);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        Link {i + 1} {i === 0 && <span className="text-rose-500">*</span>}
                        {portal && (
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] ring-1 normal-case tracking-normal', portal.color)}>
                            {portal.name}
                          </span>
                        )}
                      </label>
                      {valid && <span className="text-[11px] font-semibold text-emerald-600">+ {fmtCLP(PRICE_PER_LINK)}</span>}
                    </div>
                    <div className="relative flex gap-1.5">
                      <div className="flex-1 relative">
                        <svg className={cn('w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition', valid ? 'text-emerald-500' : 'text-slate-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {valid ? (
                            <polyline points="20 6 9 17 4 12"/>
                          ) : (
                            <path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                          )}
                        </svg>
                        <input
                          type="url"
                          value={link}
                          onChange={e => updateLink(i, e.target.value)}
                          placeholder="https://www.boattrader.com/boat/..."
                          className={cn(
                            'w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:ring-2 outline-none transition-all bg-white',
                            valid
                              ? 'border-emerald-200 focus:ring-emerald-500/20 focus:border-emerald-400'
                              : 'border-slate-200 focus:ring-cyan-500/20 focus:border-cyan-400'
                          )}
                        />
                      </div>
                      {links.length > 1 && (
                        <button type="button" onClick={() => removeLink(i)} className="px-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Quitar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {links.length < MAX_LINKS && (
              <button onClick={addLink} className="mt-4 w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-cyan-400 hover:text-cyan-600 hover:bg-cyan-50/40 transition flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
                Agregar otro link <span className="text-slate-400 text-[11px]">({links.length}/{MAX_LINKS})</span>
              </button>
            )}

            {links.length === MIN_LINKS && validLinks.length === 0 && (
              <p className="text-[11px] text-slate-400 text-center mt-3">
                Tip: podes agregar hasta {MAX_LINKS} links y solo pagas por los completos.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Total + Pay (sticky-feeling, rich) */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-5 sm:p-6 overflow-hidden shadow-xl">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Total breakdown */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 ring-1 ring-cyan-400/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
              </div>
              <div>
                <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-[0.2em]">Total a pagar</p>
                <p className="text-3xl font-extrabold leading-none mt-1">{fmtCLP(total)}</p>
              </div>
            </div>
            <div className="bg-white/10 ring-1 ring-white/10 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Links validos</span><span className="font-semibold tabular-nums">{validLinks.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Precio por link</span><span className="tabular-nums">{fmtCLP(PRICE_PER_LINK)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Destino</span><span>{country?.flag} {country?.label || form.country}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5"><span className="font-bold">Total</span><span className="font-bold text-cyan-300 tabular-nums">{fmtCLP(total)}</span></div>
            </div>
          </div>

          {/* T&C + Pay buttons */}
          <div className="lg:col-span-2 flex flex-col">
            <label className="flex items-start gap-2 text-xs text-slate-300 mb-3 cursor-pointer p-3 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition">
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-cyan-500 rounded cursor-pointer" />
              <span>
                Acepto los <strong className="text-white font-semibold">terminos y condiciones</strong> para recibir esta cotizacion, y confirmo que he leido la politica de privacidad. Al pagar autorizo a Imporlan a procesar la cotizacion en un plazo de 48 hrs habiles.
              </span>
            </label>

            <div className="flex-1" />

            {/* Validation hints */}
            {!canPay && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {validLinks.length === 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[11px] ring-1 ring-amber-400/20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    Agregá al menos 1 link
                  </span>
                )}
                {!formReady && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[11px] ring-1 ring-amber-400/20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    Completá nombre y email
                  </span>
                )}
                {!accepted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[11px] ring-1 ring-amber-400/20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    Aceptá los terminos
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handlePay('webpay')}
                disabled={!canPay}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition shadow-lg',
                  canPay
                    ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-white/10'
                    : 'bg-white/10 text-white/40 cursor-not-allowed shadow-none'
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                {paying ? 'Procesando...' : 'Pagar con WebPay'}
              </button>
              <button
                onClick={() => handlePay('mercadopago')}
                disabled={!canPay}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm border-2 transition',
                  canPay
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40 hover:bg-cyan-500/25'
                    : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed'
                )}
              >
                {paying ? 'Procesando...' : 'Pagar con MercadoPago'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center sm:text-left">
              Conexion segura · Procesado por Transbank / Mercado Libre · Recibis confirmacion en {form.email || 'tu email'}.
            </p>
          </div>
        </div>
      </div>

      {/* Help footer */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20duda%20sobre%20el%20cotizador" target="_blank" rel="noreferrer" className="group flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200/70 hover:border-emerald-300 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Hablar antes de pagar</p>
            <p className="text-xs text-slate-500">Resolvemos tus dudas por WhatsApp</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
        </a>
        <a href="#/plans" className="group flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200/70 hover:border-cyan-300 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Necesitas mas que cotizar?</p>
            <p className="text-xs text-slate-500">Conoce los planes de busqueda completa</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 group-hover:text-cyan-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
    </div>
  );
}
