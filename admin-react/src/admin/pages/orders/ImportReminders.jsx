import { useCallback, useEffect, useRef, useState } from 'react';
import { getImportReminder, sendImportReminder, configureImportReminders } from '../../api';
import { Button, Badge, Callout, Modal, SegmentedControl } from '../../../shared/components/UI';
import { Mail, RefreshCw } from '../../../shared/components/Icons';
import { useToast } from '../../../shared/components/Toast';

export default function ImportReminders({ orderId }) {
  return <ImportRemindersForOrder key={orderId} orderId={orderId} />;
}

function ImportRemindersForOrder({ orderId }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState('client');
  const generation = useRef({ value: 0 });
  const toast = useToast();
  const load = useCallback(async () => {
    const counter = generation.current;
    const ticket = ++counter.value;
    try { const result = await getImportReminder(orderId, audience); if (ticket === counter.value) { setState(result); setError(''); } }
    catch (e) { if (ticket === counter.value) setError(e.message || 'No pudimos consultar los recordatorios'); }
  }, [orderId, audience]);
  useEffect(() => { const counter = generation.current; const t = setTimeout(load, 0); return () => { clearTimeout(t); counter.value++; }; }, [load]);
  async function send() {
    if (!state?.can_send || busy) return;
    setBusy(true);
    try { await sendImportReminder(orderId, audience, state.preview.fingerprint); toast?.('Correo enviado. El intento quedó registrado.', 'success'); await load(); }
    catch (e) { toast?.(e.message || 'No se pudo confirmar el envío', 'error'); await load(); }
    finally { setBusy(false); }
  }
  async function configure() {
    if (!state?.can_configure || busy) return;
    setBusy(true);
    try { const r = await configureImportReminders(!state.settings.enabled, state.settings.template_hash); setState(s => ({ ...s, settings: r.settings })); toast?.(r.settings.enabled ? 'Recordatorios diarios activados para las operaciones activas.' : 'Recordatorios automáticos desactivados.', 'success'); }
    catch (e) { toast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }
  const mail = state?.preview?.mail;
  const delivery = state?.delivery;
  return <section className="rounded-lg border border-line bg-surface p-4 space-y-3" aria-labelledby="import-reminders-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="import-reminders-title" className="text-sm font-semibold text-ink-900">Seguimiento por correo</h4><Badge tone={state?.settings?.enabled ? 'success' : 'neutral'}>{state?.settings?.enabled ? 'Recordatorios diarios activos' : 'Recordatorios automáticos inactivos'}</Badge></div>
    <p className="text-13 text-ink-500">Un aviso por destinatario y expediente al día, sólo mientras tenga algo pendiente. Cliente y revisión interna: desde las 08:30 hasta las 18:00 de Chile. David conserva su seguimiento privado.</p>
    {error && <Callout tone="warning" compact>{error}</Callout>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" icon={Mail} onClick={() => setOpen(true)} disabled={!state}>Ver correo del proceso</Button>
      <Button size="sm" variant="ghost" icon={RefreshCw} onClick={load} disabled={busy}>Actualizar avisos</Button>
      {state?.can_configure && <Button size="sm" variant="secondary" onClick={configure} loading={busy}>{state.settings.enabled ? 'Desactivar recordatorios diarios' : 'Activar recordatorios diarios'}</Button>}
    </div>
    {delivery && <p role="status" className="text-xs text-ink-500">{delivery.status === 'sent' ? 'Correo enviado hoy. No se repetirá automáticamente hoy.' : 'Ya hay un intento registrado hoy. Revisa el resultado antes de repetirlo.'}</p>}
    <Modal open={open} onClose={() => !busy && setOpen(false)} title="Correo del siguiente paso" size="xl" description="Vista previa con el estado actual. Los botones llevan al panel; no aprueban ni pagan automáticamente." footer={<>
      <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cerrar</Button>
      {state?.can_configure && <Button icon={Mail} onClick={send} loading={busy} disabled={!state?.can_send}>Enviar este correo</Button>}
    </>}>
      <div className="space-y-3">
        {state?.can_configure && <SegmentedControl aria-label="Destinatario del aviso" value={audience} onChange={value => { setState(null); setAudience(value); }} options={[{ id: 'client', label: 'Cliente' }, { id: 'owner', label: 'Revisión de Juan Pablo' }]} />}
        {mail ? <>
          <p className="text-13 text-ink-700 break-words"><strong>Para:</strong> {state.preview.plan.to}<br /><strong>Asunto:</strong> {mail.subject}</p>
          {delivery && <Callout compact tone="info">{delivery.status === 'sent' ? 'Este destinatario ya recibió un aviso hoy.' : 'Hay un intento de envío registrado hoy.'}</Callout>}
          <iframe title="Vista previa del correo del proceso" sandbox="" srcDoc={mail.html.replace('cid:imporlan-signature-jp', 'https://www.imporlan.cl/api/email-assets/firma-jp.jpg')} className="w-full h-[560px] rounded-lg border border-line bg-white" />
        </> : <Callout compact tone="info">{state ? 'No hay acciones pendientes para este destinatario. No se envía un recordatorio de tareas ya resueltas.' : 'Consultando el estado del expediente…'}</Callout>}
      </div>
    </Modal>
  </section>;
}
