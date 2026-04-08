import { useState } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { submitSupportRequest } from '../api';
import { PageHeader, Card, Button, Input, Select, Textarea } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const SUBJECTS = [
  { value: '', label: 'Selecciona un asunto' },
  { value: 'Consulta general', label: 'Consulta general' },
  { value: 'Estado de importacion', label: 'Estado de importacion' },
  { value: 'Cotizacion', label: 'Cotizacion' },
  { value: 'Documentos', label: 'Documentos' },
  { value: 'Pagos y facturacion', label: 'Pagos y facturacion' },
  { value: 'Problema tecnico', label: 'Problema tecnico' },
  { value: 'Otro', label: 'Otro' },
];

const FAQS = [
  { q: 'Cuanto demora una importacion?', a: 'El tiempo promedio de una importacion completa es de 45 a 90 dias dependiendo del origen, tipo de embarcacion y tramites aduaneros. Te mantendremos informado en cada etapa del proceso.' },
  { q: 'Que incluye el servicio puerta a puerta?', a: 'Nuestro servicio incluye: inspeccion pre-compra, compra de la embarcacion, transporte maritimo, seguros, tramites aduaneros, internacion y entrega en el destino que indiques.' },
  { q: 'Como funciona la inspeccion pre-compra?', a: 'Coordinamos con inspectores certificados en el pais de origen. Revisan el estado mecanico, estructural y estetico de la embarcacion, entregandote un informe detallado con fotos y video antes de concretar la compra.' },
  { q: 'Que documentos necesito para importar?', a: 'Necesitas: cedula de identidad vigente, titulo de la embarcacion (Bill of Sale), factura comercial y documentos de exportacion del pais de origen. Nosotros nos encargamos de toda la tramitacion.' },
  { q: 'Puedo hacer seguimiento de mi importacion?', a: 'Si, desde tu WebPanel puedes ver el estado en tiempo real de tu importacion, incluyendo ubicacion del envio, documentos asociados y proximos pasos. Tambien recibiras notificaciones automaticas en cada cambio de estado.' },
];

export default function Support() {
  const toast = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: '', subject: '', message: '', operation: '' });
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
      <PageHeader title="Centro de Soporte" subtitle="Estamos aqui para ayudarte con tu importacion" />

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

      {/* SLA Info */}
      <div className="mb-6 px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <p className="text-sm font-semibold text-blue-800">Tiempo de Respuesta (SLA)</p>
            <p className="text-xs text-blue-600 mt-1">El tiempo de respuesta y trabajo para tu requerimiento es de hasta 48 horas por lo general. En algunos periodos de alta demanda, puede llegar a ser de hasta 72 hrs segun la cantidad de requerimientos en curso.</p>
            <div className="flex gap-4 mt-2 text-xs">
              <a href="mailto:contacto@imporlan.cl" className="text-blue-700 underline">contacto@imporlan.cl</a>
              <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-emerald-700 underline">WhatsApp</a>
            </div>
          </div>
        </div>
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
              <Input label="N° Operacion (opcional)" value={form.operation} onChange={e => set('operation', e.target.value)} placeholder="IMP-XXXX" />
              <Select label="Tema *" value={form.subject} onChange={e => set('subject', e.target.value)} options={SUBJECTS} />
              <div>
                <Textarea label="Mensaje *" value={form.message} onChange={e => { if (e.target.value.length <= 2000) set('message', e.target.value); }} placeholder="Describe tu consulta..." />
                <p className="text-[11px] text-slate-400 text-right mt-1">{form.message.length} / 2000</p>
              </div>
              <Button variant="accent" type="submit" disabled={sending} className="w-full">{sending ? 'Enviando...' : 'Enviar'}</Button>
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>Conexion segura</span>
                <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Respuesta en 48 hrs</span>
              </div>
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
