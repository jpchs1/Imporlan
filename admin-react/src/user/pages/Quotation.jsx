import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { fmtCLP, cn } from '../../shared/lib/utils';
import { Card, Button, IconButton, Input, Select, Checkbox, FormGrid, PageHeader, Badge, Money } from '../../shared/components/UI';
import { Plus, X, Check, Link2, CircleCheck, WebPayIcon, MercadoPagoIcon, WhatsAppIcon, ArrowRight } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { createWebPayTransaction, createMercadoPagoPreference } from '../api';

const PRICE_PER_LINK = 9900;
const MIN_LINKS = 4;
const MAX_LINKS = 10;

/* Los `value` son los que recibe la API (sin tilde); la etiqueta es lo que se lee. */
const COUNTRIES = [
  { value: 'Chile', label: 'Chile' },
  { value: 'Peru', label: 'Perú' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Mexico', label: 'México' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Otro', label: 'Otro país' },
];

const PORTALS = [
  { name: 'BoatTrader', host: 'boattrader.com' },
  { name: 'YachtWorld', host: 'yachtworld.com' },
  { name: 'Boats.com', host: 'boats.com' },
  { name: 'iNautia', host: 'inautia.com' },
];

const BENEFITS = [
  'Precio final puerta a puerta: embarcación, impuestos y transporte',
  'Validación de que el anuncio sigue disponible',
  'Comparativa entre los links que enviaste',
  'Recomendación del equipo de Imporlan',
  'Respuesta en 48 horas hábiles',
];

function isValidUrl(s) {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\/.+/i.test(t) || t.includes('.');
}

function detectPortal(url) {
  const t = (url || '').toLowerCase();
  for (const p of PORTALS) {
    if (p.host && t.includes(p.host)) return p;
  }
  return null;
}

function Paso({ n, title, description, meta }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-7 w-7 rounded-full bg-brand-600 text-white text-13 font-semibold flex items-center justify-center shrink-0 tabular" aria-hidden="true">{n}</span>
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-ink-900 leading-7">{title}</h2>
        {description && <p className="text-13 text-ink-500">{description}</p>}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
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
  });
  const [accepted, setAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [touched, setTouched] = useState({});

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
  function touch(k) { setTouched(t => ({ ...t, [k]: true })); }

  async function handlePay(method) {
    if (validLinks.length === 0) { toast?.({ type: 'error', title: 'Agrega al menos un link válido' }); return; }
    if (!form.name || !form.email) { toast?.({ type: 'error', title: 'Completa tu nombre y correo' }); return; }
    if (!accepted) { toast?.({ type: 'error', title: 'Acepta los términos y condiciones' }); return; }

    setPaying(true);
    const desc = `Cotización por ${validLinks.length} link${validLinks.length > 1 ? 's' : ''}`;
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
          plan_name: 'Cotización por Links',
          description: desc,
          type: 'cotizacion_link',
          boat_links: validLinks,
          return_url: window.location.href,
        });
        if (data.success && data.url && data.token) {
          const f = document.createElement('form');
          f.method = 'POST'; f.action = data.url;
          const inp = document.createElement('input');
          inp.type = 'hidden'; inp.name = 'token_ws'; inp.value = data.token;
          f.appendChild(inp); document.body.appendChild(f); f.submit();
          return;
        } else { toast?.({ type: 'error', title: 'No pudimos iniciar el pago con WebPay', description: 'Vuelve a intentarlo o paga con Mercado Pago.' }); }
      } else if (method === 'mercadopago') {
        const data = await createMercadoPagoPreference({
          amount: total,
          description: desc,
          plan_name: 'Cotización por Links',
          payer_email: form.email,
          payer_name: fullName,
          payer_phone: form.phone,
          country: form.country,
          type: 'cotizacion_link',
          boat_links: validLinks,
        });
        if (data.success && data.init_point) {
          window.location.href = data.init_point;
          return;
        } else { toast?.({ type: 'error', title: 'No pudimos iniciar el pago con Mercado Pago', description: 'Vuelve a intentarlo o paga con WebPay.' }); }
      }
    } catch (e) { toast?.({ type: 'error', title: 'No se pudo procesar el pago', description: e?.message }); }
    setPaying(false);
  }

  const formReady = !!form.name && !!form.email;
  const canPay = validLinks.length > 0 && formReady && accepted && !paying;
  const pendientes = [
    validLinks.length === 0 && 'Agrega al menos un link',
    !formReady && 'Completa tu nombre y correo',
    !accepted && 'Acepta los términos y condiciones',
  ].filter(Boolean);

  const resumen = (
    <Card>
      <p className="eyebrow">Resumen</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Links válidos</dt><dd className="tabular text-ink-900">{validLinks.length}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Precio por link</dt><dd className="tabular text-ink-900">{fmtCLP(PRICE_PER_LINK)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Destino</dt><dd className="text-ink-900">{country?.label || form.country}</dd></div>
      </dl>
      <div className="flex items-end justify-between gap-3 mt-4 pt-4 border-t border-line">
        <span className="text-sm font-semibold text-ink-900">Total</span>
        <Money clp={total} size="xl" align="right" />
      </div>

      <div className="mt-5 space-y-2">
        <Button block icon={WebPayIcon} onClick={() => handlePay('webpay')} disabled={!canPay} loading={paying}>Pagar con WebPay</Button>
        <Button block variant="secondary" icon={MercadoPagoIcon} onClick={() => handlePay('mercadopago')} disabled={!canPay} loading={paying}>Pagar con Mercado Pago</Button>
      </div>

      {pendientes.length > 0 ? (
        <ul className="mt-3 space-y-1 text-13 text-ink-500" aria-label="Falta para pagar">
          {pendientes.map(p => <li key={p} className="flex items-start gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning mt-[7px] shrink-0" aria-hidden="true" />{p}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-13 text-ink-500">Pago seguro con Transbank o Mercado Pago. Te confirmamos a {form.email}.</p>
      )}

      <div className="mt-5 pt-4 border-t border-line">
        <p className="text-13 font-medium text-ink-900 mb-2">Qué incluye</p>
        <ul className="space-y-1.5">
          {BENEFITS.map(b => (
            <li key={b} className="flex items-start gap-2 text-13 text-ink-700">
              <CircleCheck size={16} className="text-success shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 pt-4 border-t border-line flex flex-col gap-2">
        <a href="https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20duda%20antes%20de%20cotizar%20mis%20links" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-13 font-medium text-brand-600 hover:underline">
          <WhatsAppIcon size={16} /> ¿Dudas? Escríbenos por WhatsApp
        </a>
        <a href="#/plans" className="inline-flex items-center gap-1.5 text-13 font-medium text-brand-600 hover:underline">
          <ArrowRight size={16} /> ¿Quieres que busquemos por ti? Ver planes
        </a>
      </div>
    </Card>
  );

  return (
    <div className="pb-12">
      <PageHeader
        title="Cotizar links"
        description="Pega los links de las lanchas que te interesan y te entregamos el precio final puerta a puerta."
        meta={<Badge tone="brand">{fmtCLP(PRICE_PER_LINK)} por link</Badge>}
      />

      {/*
        El resumen se queda a la vista mientras el formulario hace scroll. El
        `sticky` va en la columna de la grilla (no en la Card): con
        `self-start` la columna mide lo que mide el resumen y su contenedor
        es la grilla entera, tan alta como el formulario; si el sticky fuera en
        la Card, su contenedor sería la columna, del mismo alto que ella, y no
        tendría dónde moverse.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6 min-w-0">
          {/* Paso 1 · Links */}
          <Card as="section" aria-labelledby="paso-links">
            <Paso
              n={1}
              title={<span id="paso-links">Links a cotizar</span>}
              description={`Anuncios de ${PORTALS.map(p => p.name).join(', ')} u otros portales. Pagas solo por los links completos.`}
              meta={<Badge tone={validLinks.length > 0 ? 'success' : 'neutral'}>{validLinks.length} de {links.length}</Badge>}
            />
            <div className="mt-5 space-y-3">
              {links.map((link, i) => {
                const portal = detectPortal(link);
                const valid = isValidUrl(link);
                const invalido = link.trim() !== '' && !valid;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <Input
                      type="url"
                      className="flex-1 min-w-0"
                      label={(
                        <span className="inline-flex items-center gap-2">
                          Link {i + 1}
                          {portal && <Badge size="sm" tone="info">{portal.name}</Badge>}
                          {valid && !portal && <Badge size="sm" tone="success">+ {fmtCLP(PRICE_PER_LINK)}</Badge>}
                          {valid && portal && <span className="text-xs font-normal text-success tabular">+ {fmtCLP(PRICE_PER_LINK)}</span>}
                        </span>
                      )}
                      required={i === 0}
                      value={link}
                      onChange={e => updateLink(i, e.target.value)}
                      placeholder="https://www.boattrader.com/boat/…"
                      prefix={valid ? <Check size={16} className="text-success" /> : <Link2 size={16} />}
                      error={invalido ? 'Pega el link completo, empezando por https://' : undefined}
                      autoComplete="off"
                      inputMode="url"
                    />
                    {links.length > 1 && (
                      <IconButton icon={X} aria-label={`Quitar link ${i + 1}`} onClick={() => removeLink(i)} className="mt-6" />
                    )}
                  </div>
                );
              })}
            </div>
            {links.length < MAX_LINKS && (
              <Button variant="secondary" icon={Plus} onClick={addLink} className="mt-4">
                Agregar otro link <span className="text-ink-500 font-normal">({links.length}/{MAX_LINKS})</span>
              </Button>
            )}
            {links.length === MIN_LINKS && validLinks.length === 0 && (
              <p className="text-13 text-ink-500 mt-3">Puedes cotizar hasta {MAX_LINKS} links; los que dejes vacíos no se cobran.</p>
            )}
          </Card>

          {/* Paso 2 · Datos */}
          <Card as="section" aria-labelledby="paso-datos">
            <Paso
              n={2}
              title={<span id="paso-datos">Tus datos</span>}
              description="A dónde te enviamos la cotización y a qué país llega la lancha."
              meta={user?.email ? <Badge tone="success" dot>Sesión iniciada</Badge> : null}
            />
            <div className="mt-5 space-y-4">
              <FormGrid cols={2}>
                <Input
                  label="Nombre" required value={form.name} autoComplete="given-name"
                  onChange={e => set('name', e.target.value)} onBlur={() => touch('name')}
                  error={touched.name && !form.name ? 'Escribe tu nombre' : undefined}
                />
                <Input label="Apellidos" value={form.lastName} autoComplete="family-name" onChange={e => set('lastName', e.target.value)} />
              </FormGrid>
              <FormGrid cols={2}>
                <Input
                  label="Correo" type="email" required value={form.email} autoComplete="email"
                  onChange={e => set('email', e.target.value)} onBlur={() => touch('email')}
                  error={touched.email && !form.email ? 'Necesitamos tu correo para enviarte la cotización' : undefined}
                />
                <Input label="Teléfono" type="tel" value={form.phone} autoComplete="tel" onChange={e => set('phone', e.target.value)} placeholder="+56 9 1234 5678" hint="Opcional, por si necesitamos aclarar algo." />
              </FormGrid>
              <FormGrid cols={2}>
                <Select label="País de destino" value={form.country} onChange={e => set('country', e.target.value)} options={COUNTRIES} />
              </FormGrid>
              <div className={cn('rounded-lg border px-4 py-3', accepted ? 'border-line bg-surface' : 'border-line bg-canvas')}>
                <Checkbox
                  checked={accepted}
                  onChange={e => setAccepted(e.target.checked)}
                  label={<>Acepto los <strong className="font-medium text-ink-900">términos y condiciones</strong> y la política de privacidad de Imporlan.</>}
                  hint="Al pagar, Imporlan prepara la cotización en un plazo de 48 horas hábiles."
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+16px)] lg:self-start">{resumen}</div>
      </div>
    </div>
  );
}
