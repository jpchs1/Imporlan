import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { submitSupportRequest } from '../api';
import { Card, Button, Input, Select, Textarea, FormGrid, PageHeader, Callout, Accordion } from '../../shared/components/UI';
import { WhatsAppIcon, Mail, Clock, Send, CircleCheck } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { BotonEnlace } from './inicio/BotonEnlace';
import { WA_AYUDA as WA, WHATSAPP_IMPORLAN } from './inicio/whatsapp';

/* Los valores (`value`) viajan tal cual en el payload de `submitSupportRequest`: no se cambian. */
const TEMAS = [
  { value: 'Consulta general', label: 'Consulta general' },
  { value: 'Estado de importación', label: 'Estado de mi importación' },
  { value: 'Cotización', label: 'Cotización o plan' },
  { value: 'Documentos', label: 'Documentos' },
  { value: 'Pagos y facturación', label: 'Pagos y facturación' },
  { value: 'Inspección', label: 'Inspección técnica' },
  { value: 'Problema técnico', label: 'Problema técnico con el panel' },
  { value: 'Sugerencia', label: 'Sugerencia' },
  { value: 'Otro', label: 'Otro' },
];

/* Una sola FAQ para todo el panel (antes había otra en Planes). */
const FAQS = [
  { cat: 'Servicio', q: '¿Cuánto demora una importación?', a: 'Una importación completa toma entre 45 y 90 días según el origen, el tipo de embarcación y los trámites aduaneros. Te vamos informando en cada etapa desde el panel.' },
  { cat: 'Servicio', q: '¿Qué incluye el servicio puerta a puerta?', a: 'Inspección previa a la compra, compra de la embarcación, transporte marítimo, seguros, trámites aduaneros, internación y entrega en el destino que indiques.' },
  { cat: 'Planes', q: '¿Qué pasa si no encuentro la embarcación ideal?', a: 'Te ofrecemos opciones adicionales sin costo extra. Si de todas formas no encuentras nada, puedes extender tu plan con descuento.' },
  { cat: 'Planes', q: '¿Puedo cambiar de plan después de contratar?', a: 'Sí. Si quieres pasar a un plan superior, te descontamos lo que ya pagaste. Háblalo con tu agente.' },
  { cat: 'Planes', q: '¿Cuándo empieza a contar el plazo del plan?', a: 'Desde el día en que confirmas el pago. Te avisamos por correo y queda visible en este panel.' },
  { cat: 'Búsqueda', q: '¿En qué países buscan embarcaciones?', a: 'Principalmente en Estados Unidos y Chile, los dos mercados con mejor relación precio-calidad para Sudamérica. También evaluamos Europa si lo pides.' },
  { cat: 'Inspección', q: '¿Cómo funciona la inspección previa a la compra?', a: 'Coordinamos inspectores certificados en el país de origen. Revisan el estado mecánico, estructural y estético de la embarcación y te entregan un informe con fotos y video antes de cerrar la compra.' },
  { cat: 'Documentos', q: '¿Qué documentos necesito para importar?', a: 'Cédula de identidad vigente, título de la embarcación (Bill of Sale), factura comercial y documentos de exportación del país de origen. Nosotros nos encargamos de toda la tramitación.' },
  { cat: 'Seguimiento', q: '¿Puedo hacer seguimiento de mi importación?', a: 'Sí. En Expedientes ves la etapa en que va cada uno, y en Seguimiento la posición del barco que trae tu embarcación. Además te avisamos por correo en cada cambio.' },
  { cat: 'Pagos', q: '¿Qué medios de pago aceptan?', a: 'WebPay, Mercado Pago, PayPal y transferencia bancaria. Los eliges en la sección Pagos cuando recibes una solicitud de pago.' },
];

/** Algo@algo.tld, sin espacios: lo mismo que exige el navegador para `type="email"`, más el punto del dominio. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ContenidoCanal({ icon, label, value, sub }) {
  const Icon = icon;
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span className="h-9 w-9 rounded-md bg-neutral-bg text-ink-700 flex items-center justify-center shrink-0" aria-hidden="true"><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span className="block text-sm font-medium text-ink-900 truncate">{value}</span>
        <span className="block text-13 text-ink-500 truncate">{sub}</span>
      </span>
    </span>
  );
}

/** Un canal de contacto: enlace (WhatsApp, correo) o solo informativo (horario). */
function Canal({ href, ...props }) {
  const cls = 'block bg-surface border border-line rounded-lg shadow-card px-4 py-3 min-w-0';
  if (!href) return <div className={cls}><ContenidoCanal {...props} /></div>;
  const externo = /^https?:/.test(href);
  return (
    <a href={href} target={externo ? '_blank' : undefined} rel={externo ? 'noopener noreferrer' : undefined}
      className={`${cls} hover:border-ink-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}>
      <ContenidoCanal {...props} />
    </a>
  );
}

export default function Support() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '', operation: '' });
  const [errores, setErrores] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user && (!form.name || !form.email)) {
      setForm(f => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (errores[k]) setErrores(e => ({ ...e, [k]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nuevos = {};
    if (!form.name.trim()) nuevos.name = 'Escribe tu nombre.';
    // El formulario es `noValidate` (los errores van en cada campo, con el
    // kit), así que el formato del correo se revisa aquí.
    if (!form.email.trim()) nuevos.email = 'Escribe tu correo.';
    else if (!CORREO_VALIDO.test(form.email.trim())) nuevos.email = 'Escribe un correo válido, como nombre@correo.cl.';
    if (!form.subject) nuevos.subject = 'Elige un tema.';
    if (!form.message.trim()) nuevos.message = 'Cuéntanos en qué te ayudamos.';
    if (Object.keys(nuevos).length) { setErrores(nuevos); return; }
    setSending(true);
    try {
      await submitSupportRequest(form);
      setSent(true);
      toast?.('Consulta enviada', 'success');
    } catch (err) {
      toast?.({ type: 'error', title: 'No pudimos enviar tu consulta', description: err?.message || 'Vuelve a intentarlo o escríbenos por WhatsApp.' });
    }
    setSending(false);
  }

  return (
    <div className="pb-4">
      <PageHeader
        title="Ayuda"
        description="Escríbenos y te respondemos en horario hábil, normalmente dentro de 48 horas (hasta 72 en períodos de alta demanda)."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Canal icon={WhatsAppIcon} label="WhatsApp" value={WHATSAPP_IMPORLAN} sub="Para urgencias" href={WA} />
        <Canal icon={Mail} label="Correo" value="contacto@imporlan.cl" sub="Respuesta en 48 horas hábiles" href="mailto:contacto@imporlan.cl" />
        <Canal icon={Clock} label="Horario" value="Lunes a viernes, 9:00 a 18:00" sub="Sábado y domingo, 10:00 a 14:00" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <Card className="lg:col-span-3">
          <Card.Header title="Enviar una consulta" description="Te respondemos al correo de tu cuenta." />
          {sent ? (
            <Card.Body>
              <Callout tone="success" icon={CircleCheck} title="Consulta enviada">
                Te respondemos a <strong className="font-medium">{form.email}</strong> dentro de 48 horas hábiles.
              </Callout>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '', operation: '' })); }}>Enviar otra consulta</Button>
                <BotonEnlace href={WA} variant="ghost" icon={WhatsAppIcon}>También por WhatsApp</BotonEnlace>
              </div>
            </Card.Body>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <Card.Body className="space-y-4">
                <FormGrid cols={2}>
                  <Input label="Nombre" value={form.name} onChange={e => set('name', e.target.value)} autoComplete="name" required error={errores.name} />
                  <Input label="Correo" type="email" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" required error={errores.email} />
                </FormGrid>
                <FormGrid cols={2}>
                  <Input label="Teléfono" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 1234 5678" autoComplete="tel" hint="Opcional" />
                  <Input label="N.º de expediente" value={form.operation} onChange={e => set('operation', e.target.value)} placeholder="IMP-00035" hint="Opcional, si tu consulta es sobre uno" />
                </FormGrid>
                <Select label="Tema" value={form.subject} onChange={e => set('subject', e.target.value)} options={TEMAS} placeholder="Elige un tema" required error={errores.subject} />
                <Textarea label="Mensaje" value={form.message} onChange={e => set('message', e.target.value)} placeholder="Cuéntanos en detalle en qué te ayudamos." rows={6} maxLength={2000} showCount required error={errores.message} />
              </Card.Body>
              <Card.Footer align="between">
                <p className="text-13 text-ink-500">
                  ¿Es urgente? <a href={WA} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:text-brand-700">Escríbenos por WhatsApp</a>.
                </p>
                <Button type="submit" icon={Send} loading={sending}>Enviar consulta</Button>
              </Card.Footer>
            </form>
          )}
        </Card>

        <Card className="lg:col-span-2" padding="none">
          <Card.Header title="Preguntas frecuentes" description="Quizás ya tenemos la respuesta." />
          <Accordion flush>
            {FAQS.map((f, i) => (
              <Accordion.Item key={i} title={<span className="whitespace-normal">{f.q}</span>}>
                {f.a}
              </Accordion.Item>
            ))}
          </Accordion>
          <Card.Footer align="between">
            <p className="text-13 text-ink-500">¿No encontraste lo que buscabas?</p>
            <BotonEnlace href={WA} size="sm" icon={WhatsAppIcon}>Escríbenos</BotonEnlace>
          </Card.Footer>
        </Card>
      </div>
    </div>
  );
}
