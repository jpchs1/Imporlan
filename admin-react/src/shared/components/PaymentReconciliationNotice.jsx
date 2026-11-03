import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from '../lib/api-client';
import { Button, Callout } from './UI';
import { useConfirm } from './ConfirmDialog';

export default function PaymentReconciliationNotice({ request }) {
  const api=useMemo(()=>createApiClient({token:'token',user:'user'}),[]);
  const confirm=useConfirm();
  const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    try{const r=await api.request(`${api.API_BASE}/payment_requests_api.php?action=reconciliation_notice&request_id=${encodeURIComponent(request.id)}`);setState(r);setError('');}
    catch(e){setError(e.message || 'No pudimos consultar los avisos de cuadre.');}
  },[api,request.id]);
  useEffect(()=>{const t=setTimeout(load,0);return()=>clearTimeout(t);},[load,request]);
  const deliveries=state?.deliveries || [];
  const failed=deliveries.some(x=>x.status==='failed');
  const retry=failed;
  async function send(){
    if(busy)return;
    if(!(await confirm({title:retry?'¿Reintentar los avisos fallidos?':'¿Enviar el cuadre de esta cuota?',description:retry?'Comprueba la entrega anterior antes de reintentar. Sólo se intentarán los destinatarios cuyo envío falló; los confirmados no se repiten.':'El cliente y el admin reciben los montos. El coordinador recibe un aviso operativo sin valores ni datos de contacto del cliente.',confirmLabel:retry?'Reintentar fallidos':'Enviar cuadre'})))return;
    setBusy(true);
    try{await api.request(`${api.API_BASE}/payment_requests_api.php?action=reconciliation_notice`,{method:'POST',body:JSON.stringify({request_id:request.id,retry}),timeoutMs:90000});setError('');}
    catch(e){setError(e.message || 'No se pudo confirmar el envío.');}
    finally{await load();setBusy(false);}
  }
  const labels={client:'Cliente',owner:'Admin',coordinator:'Coordinador'};
  return <section className="rounded-lg border border-line bg-canvas p-3 space-y-2" aria-label="Avisos de cuadre de esta cuota">
    <h4 className="text-sm font-semibold text-ink-900">Cuadre de ingresos · notificaciones</h4>
    <p className="text-xs text-ink-500">Al cubrir el total se avisa a cliente y admin con valores, y al coordinador sin montos. Los respaldos pendientes y la autorización de compra se revisan por separado.</p>
    {error && <Callout compact tone="warning">{error}</Callout>}
    {deliveries.length>0 && <ul className="space-y-1 text-xs text-ink-700">{deliveries.map(d=><li key={d.audience}>{labels[d.audience]}: {d.status==='sent'?'Enviado':d.status==='covered'?'Autorización ya enviada':d.status==='failed'?'No confirmado · requiere revisión':'En verificación · no reenviar todavía'}</li>)}</ul>}
    {state?.can_send && state.eligible && (failed || deliveries.length<3) && <Button size="sm" variant="secondary" onClick={send} disabled={busy}>{busy ? 'Enviando…' : retry ? 'Reintentar avisos fallidos' : 'Enviar cuadre'}</Button>}
  </section>;
}
