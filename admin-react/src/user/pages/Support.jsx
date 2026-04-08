import { useState } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { submitSupportRequest } from '../api';
import { PageHeader, Card, Button, Input, Select, Textarea } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const SUBJECTS = [
  { value: '', label: 'Selecciona un tema...' },
  { value: 'Consulta general', label: 'Consulta general' },
  { value: 'Problema con mi cuenta', label: 'Problema con mi cuenta' },
  { value: 'Consulta sobre importacion', label: 'Consulta sobre importacion' },
  { value: 'Problema con un pago', label: 'Problema con un pago' },
  { value: 'Seguimiento de pedido', label: 'Seguimiento de pedido' },
  { value: 'Problema tecnico', label: 'Problema tecnico' },
  { value: 'Solicitud de cotizacion', label: 'Solicitud de cotizacion' },
  { value: 'Sugerencia o comentario', label: 'Sugerencia o comentario' },
  { value: 'Otro', label: 'Otro' },
];

const FAQS = [
  { q: 'Como funciona el proceso de importacion?', a: 'Imporlan se encarga de todo el proceso: busqueda, inspeccion, compra, logistica y entrega en Chile. Tu solo eliges la embarcacion.' },
  { q: 'Que incluye la pre-inspeccion?', a: 'Un inspector certificado revisa casco, motor, sistema electrico, interior, trailer, navegacion y seguridad. Recibes un reporte detallado con fotos y recomendaciones.' },
  { q: 'Que documentos necesito?', a: 'Solo necesitas tu cedula de identidad o pasaporte. Nosotros nos encargamos de toda la documentacion aduanera y de importacion.' },
  { q: 'Como puedo hacer seguimiento de mi envio?', a: 'En la seccion "Seguimiento" de tu panel puedes ver la ubicacion en tiempo real de tu embarcacion durante el transporte maritimo.' },
  { q: 'Cuanto demora una importacion?', a: 'El tiempo promedio es de 30-60 dias desde la compra hasta la entrega en Chile, dependiendo del origen y la logistica.' },
];

export default function Support() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject || !form.message.trim()) { toast?.('Completa todos los campos requeridos', 'error'); return; }
    setSending(true);
    try {
      await submitSupportRequest(form);
      setSent(true);
      toast?.('Solicitud enviada correctamente', 'success');
    } catch (e) { toast?.(e.message || 'Error al enviar', 'error'); }
    setSending(false);
  }

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Centro de ayuda y contacto" />

      {/* Contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093L2.25 6.75" /></svg>
          </div>
          <p className="font-semibold text-slate-800 text-sm">Email</p>
          <a href="mailto:contacto@imporlan.cl" className="text-xs text-cyan-600 hover:text-cyan-700">contacto@imporlan.cl</a>
          <p className="text-[11px] text-slate-400 mt-1">Respuesta en 48 hrs</p>
        </Card>
        <Card className="text-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
          </div>
          <p className="font-semibold text-slate-800 text-sm">WhatsApp</p>
          <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-700">+56 9 4021 1459</a>
          <p className="text-[11px] text-slate-400 mt-1">Clientes con plan activo</p>
        </Card>
        <Card className="text-center">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="font-semibold text-slate-800 text-sm">Horario</p>
          <p className="text-xs text-slate-600">Lun-Vie 09:00-18:00</p>
          <p className="text-[11px] text-slate-400 mt-1">Sab-Dom 10:00-14:00</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <h2 className="font-bold text-slate-800 mb-4">Enviar Solicitud</h2>
          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="font-semibold text-slate-800">Solicitud Enviada</p>
              <p className="text-sm text-slate-400 mt-1">Te responderemos a la brevedad.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setSent(false); setForm(f => ({ ...f, subject: '', message: '' })); }}>Nueva solicitud</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nombre" value={form.name} onChange={e => set('name', e.target.value)} />
                <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <Input label="Telefono (opcional)" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+56 9 ..." />
              <Select label="Tema *" value={form.subject} onChange={e => set('subject', e.target.value)} options={SUBJECTS} />
              <Textarea label="Mensaje *" value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe tu consulta..." />
              <Button variant="accent" type="submit" disabled={sending} className="w-full">{sending ? 'Enviando...' : 'Enviar'}</Button>
            </form>
          )}
        </Card>

        {/* FAQ */}
        <Card>
          <h2 className="font-bold text-slate-800 mb-4">Preguntas Frecuentes</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition">
                  <span className="text-sm font-medium text-slate-700">{faq.q}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {openFaq === i && <div className="px-4 pb-3 text-sm text-slate-500">{faq.a}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
