import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { cn } from '../../shared/lib/utils';
import { submitSupportRequest } from '../api';
import { Card, Button, Input, Select, Textarea } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const SUBJECTS = [
  { value: 'Consulta general', label: 'Consulta general', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { value: 'Estado de importacion', label: 'Estado de importacion', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { value: 'Cotizacion', label: 'Cotizacion / Plan', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { value: 'Documentos', label: 'Documentos', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { value: 'Pagos y facturacion', label: 'Pagos y facturacion', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { value: 'Inspeccion', label: 'Inspeccion tecnica', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { value: 'Problema tecnico', label: 'Problema tecnico (panel)', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { value: 'Sugerencia', label: 'Sugerencia o feedback', icon: 'M5 13l4 4L19 7' },
  { value: 'Otro', label: 'Otro', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const FAQS = [
  { cat: 'Servicio', q: 'Cuanto demora una importacion?', a: 'El tiempo promedio de una importacion completa es de 45 a 90 dias dependiendo del origen, tipo de embarcacion y tramites aduaneros. Te mantendremos informado en cada etapa del proceso desde el panel.' },
  { cat: 'Servicio', q: 'Que incluye el servicio puerta a puerta?', a: 'Inspeccion pre-compra, compra de la embarcacion, transporte maritimo, seguros, tramites aduaneros, internacion y entrega en el destino que indiques.' },
  { cat: 'Inspeccion', q: 'Como funciona la inspeccion pre-compra?', a: 'Coordinamos con inspectores certificados en el pais de origen. Revisan el estado mecanico, estructural y estetico de la embarcacion, entregandote un informe detallado con fotos y video antes de concretar la compra.' },
  { cat: 'Documentos', q: 'Que documentos necesito para importar?', a: 'Cedula de identidad vigente, titulo de la embarcacion (Bill of Sale), factura comercial y documentos de exportacion del pais de origen. Nosotros nos encargamos de toda la tramitacion.' },
  { cat: 'Seguimiento', q: 'Puedo hacer seguimiento de mi importacion?', a: 'Si. En "Mis Productos Contratados" y "Seguimiento" ves el estado en tiempo real, ubicacion del envio, documentos asociados y proximos pasos. Tambien recibis notificaciones automaticas en cada cambio.' },
  { cat: 'Pagos', q: 'Que medios de pago aceptan?', a: 'WebPay (Transbank), MercadoPago, PayPal y transferencia bancaria. Todas las opciones estan disponibles desde la seccion Pagos del panel cuando recibes una solicitud de pago.' },
];

const CATS = ['Todas', ...Array.from(new Set(FAQS.map(f => f.cat)))];

function ChannelCard({ icon, title, value, sub, href, cta, copyable, accent = 'cyan', online }) {
  const [copied, setCopied] = useState(false);
  const colors = {
    cyan: { bg: 'from-cyan-500/15 to-blue-500/10', text: 'text-cyan-600', ring: 'hover:ring-cyan-300/50', dot: 'bg-cyan-500' },
    emerald: { bg: 'from-emerald-500/15 to-teal-500/10', text: 'text-emerald-600', ring: 'hover:ring-emerald-300/50', dot: 'bg-emerald-500' },
    violet: { bg: 'from-violet-500/15 to-purple-500/10', text: 'text-violet-600', ring: 'hover:ring-violet-300/50', dot: 'bg-violet-500' },
  };
  const c = colors[accent];
  const Wrapper = href ? 'a' : 'div';
  const wrapperProps = href ? { href, target: href.startsWith('http') ? '_blank' : undefined, rel: href.startsWith('http') ? 'noreferrer' : undefined } : {};

  function doCopy(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'group relative bg-white rounded-2xl border border-slate-200/70 p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ring-1 ring-transparent',
        c.ring,
        href && 'cursor-pointer block'
      )}
    >
      <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', c.bg)}>
        <svg className={cn('w-5 h-5', c.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        {online && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            online
          </span>
        )}
      </div>
      <p className={cn('text-base font-semibold mt-0.5 truncate', c.text)}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
      {copyable && (
        <button onClick={doCopy} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition opacity-0 group-hover:opacity-100" title={copied ? 'Copiado' : 'Copiar'}>
          {copied ? (
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          )}
        </button>
      )}
      {cta && (
        <p className={cn('text-xs font-semibold mt-3 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all', c.text)}>
          {cta}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
        </p>
      )}
    </Wrapper>
  );
}

export default function Support() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    subject: '',
    message: '',
    operation: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCat, setFaqCat] = useState('Todas');

  useEffect(() => {
    if (user && (!form.name || !form.email)) {
      setForm(f => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const filteredFaqs = useMemo(() => {
    const t = faqSearch.trim().toLowerCase();
    return FAQS.filter(f => {
      if (faqCat !== 'Todas' && f.cat !== faqCat) return false;
      if (t && !(f.q.toLowerCase().includes(t) || f.a.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [faqSearch, faqCat]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject) { toast?.('Elegi un tema', 'error'); return; }
    if (!form.message.trim()) { toast?.('Escribi tu consulta', 'error'); return; }
    setSending(true);
    try {
      await submitSupportRequest(form);
      setSent(true);
      toast?.('Solicitud enviada correctamente', 'success');
    } catch (e) { toast?.(e.message || 'Error al enviar', 'error'); }
    setSending(false);
  }

  const charCount = form.message.length;
  const charPct = Math.min(100, (charCount / 2000) * 100);
  const charNear = charCount > 1600;
  const charOver = charCount > 1900;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold ring-1 ring-emerald-400/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Soporte disponible
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centro de Soporte</h1>
            <p className="text-sm text-slate-300 mt-1.5">Estamos aqui para ayudarte con tu importacion</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="https://wa.me/56940211459?text=Hola%2C%20necesito%20ayuda%20con%20mi%20cuenta" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              WhatsApp
            </a>
            <a href="mailto:contacto@imporlan.cl" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Email
            </a>
          </div>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <ChannelCard
          accent="cyan"
          icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          title="Email"
          value="contacto@imporlan.cl"
          sub="Respuesta en 48 hrs habiles"
          href="mailto:contacto@imporlan.cl"
          cta="Enviar email"
          copyable
        />
        <ChannelCard
          accent="emerald"
          icon="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
          title="WhatsApp"
          value="+56 9 4021 1459"
          sub="Clientes con plan activo"
          href="https://wa.me/56940211459"
          cta="Abrir chat"
          copyable
          online
        />
        <ChannelCard
          accent="violet"
          icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          title="Horario"
          value="Lun a Vie · 09 a 18 hrs"
          sub="Sab y Dom 10 a 14 hrs"
        />
      </div>

      {/* SLA pill */}
      <div className="mb-6 px-4 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div className="flex-1 min-w-0 text-xs sm:text-sm">
          <p className="font-semibold text-blue-800">Tiempo de respuesta (SLA)</p>
          <p className="text-blue-700/80 mt-0.5 leading-relaxed">Generalmente respondemos en <strong className="font-semibold text-blue-800">hasta 48 horas habiles</strong>. En periodos de alta demanda puede llegar a 72 hrs. Para algo urgente, escribinos por WhatsApp.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-slate-800">Enviar solicitud</h2>
                <p className="text-xs text-slate-400 mt-0.5">Te respondemos al email registrado</p>
              </div>
              {user?.email && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                  Identificado
                </span>
              )}
            </div>

            {sent ? (
              <div className="text-center py-10">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full bg-emerald-200/40 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <p className="font-bold text-slate-800 text-lg">Solicitud enviada</p>
                <p className="text-sm text-slate-500 mt-1">Te respondemos a <strong>{form.email}</strong> dentro de 48 hrs habiles.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  <Button variant="secondary" size="sm" onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '', operation: '' })); }}>
                    Nueva solicitud
                  </Button>
                  <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    Tambien por WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nombre" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Tu nombre" />
                  <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tu@email.com" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Telefono (opcional)" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 ..." />
                  <Input label="N. Operacion (opcional)" value={form.operation} onChange={e => set('operation', e.target.value)} placeholder="IMP-XXXX" />
                </div>

                {/* Subject pills */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Tema *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECTS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => set('subject', s.value)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition',
                          form.subject === s.value
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm shadow-cyan-500/20'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300 hover:text-cyan-700'
                        )}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                        </svg>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Textarea
                    label="Mensaje *"
                    value={form.message}
                    onChange={e => { if (e.target.value.length <= 2000) set('message', e.target.value); }}
                    placeholder="Cuentanos en detalle como podemos ayudarte..."
                    rows={5}
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full transition-all', charOver ? 'bg-red-500' : charNear ? 'bg-amber-500' : 'bg-cyan-500')}
                        style={{ width: `${charPct}%` }}
                      />
                    </div>
                    <span className={cn('text-[11px] font-medium tabular-nums', charOver ? 'text-red-500' : charNear ? 'text-amber-600' : 'text-slate-400')}>
                      {charCount} / 2000
                    </span>
                  </div>
                </div>

                <Button variant="accent" type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2">
                  {sending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      Enviar consulta
                    </>
                  )}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    Conexion segura
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Respuesta en 48 hrs
                  </span>
                  <span className="flex items-center gap-1.5">
                    Urgente?
                    <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 font-semibold">WhatsApp</a>
                  </span>
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* FAQ */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <div className="mb-4">
              <h2 className="font-bold text-slate-800">Preguntas frecuentes</h2>
              <p className="text-xs text-slate-400 mt-0.5">Quizas ya tenemos la respuesta</p>
            </div>

            <div className="relative mb-3">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Buscar en preguntas..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {CATS.map(c => (
                <button
                  key={c}
                  onClick={() => setFaqCat(c)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium border transition',
                    faqCat === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto -mx-1 px-1">
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  No encontramos resultados
                </div>
              ) : filteredFaqs.map((faq, i) => {
                const idx = `${faq.cat}-${i}`;
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className={cn('border rounded-xl overflow-hidden transition-all', isOpen ? 'border-cyan-200 bg-cyan-50/30 shadow-sm' : 'border-slate-100')}>
                    <button onClick={() => setOpenFaq(isOpen ? null : idx)} className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50/70 transition">
                      <div className="flex-1 min-w-0">
                        <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{faq.cat}</span>
                        <span className="block text-sm font-medium text-slate-700 mt-0.5">{faq.q}</span>
                      </div>
                      <svg className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 text-sm text-slate-600 leading-relaxed">{faq.a}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">No encontraste lo que buscabas?</p>
              <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Escribinos por WhatsApp →
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
