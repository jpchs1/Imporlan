import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import TuImportacion from '/src/user/pages/expedientes/TuImportacion.jsx';
import SeccionImportacion from '/src/admin/pages/orders/SeccionImportacion.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import '/src/index.css';
import '/src/shared/styles/expedientes.css';
const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'client';
const scenario = params.get('scenario') || 'due';
const noop = () => {};
const quote = { p1_clp: 1260000, p2_clp: 11340000, p3_clp: 5400000, p1_pct: 7, p2_pct: 63, p3_pct: 30 };
const boat = { id: 101, title: 'MasterCraft X26 · 2018', year: 2018, make: 'MasterCraft', model: 'X26', image_url: '/__boat.webp', url: 'https://example.test/boat/101', quote_total_clp: 18000000, quote_total_usd: 19565, quote_published_at: '2026-10-21 12:00:00', quote_payments: quote };
if (mode === 'agent') { delete boat.quote_total_clp;delete boat.quote_total_usd;delete boat.quote_payments; }
const eleccion = { link_id: 101, title: boat.title, at: '2026-10-21 12:00:00', by: 'cliente', inspection: scenario !== 'without', inspection_stage: 'aprobada', inspection_client_ok_at: '2026-10-25 12:00:00', steps: { disponibilidad: '2026-10-22 12:00:00', inspeccion: '2026-10-25 12:00:00' } };
if (scenario === 'without') { delete eleccion.steps.inspeccion;eleccion.inspection_stage = 'sin_inspeccion'; }
if (['history','price','report','declined'].includes(scenario)) {
  delete eleccion.steps.inspeccion;
  eleccion.inspection_report = { file_id: 26, es_status: 'listo', at: '2026-10-24 12:00:00' };
  if (['history','price'].includes(scenario)) eleccion.inspection_waiting_price = true;
  if (scenario === 'report') { eleccion.inspection_stage = 'reporte_listo';delete eleccion.inspection_client_ok_at; }
  if (scenario === 'declined') { eleccion.inspection_result = 'no_apta';eleccion.inspection_stage = 'declinada'; }
}
if (scenario === 'closed') eleccion.steps = { ...eleccion.steps, compra:'2026-10-26',transporte:'2026-10-27',aduana:'2026-10-28',entrega:'2026-10-29' };
const receipt = { id:'rc_demo',original_name:'comprobante-ejemplo.pdf',currency:'CLP',declared_amount_clp:11340000,reference:'DEMO-REF-2',status:'pending',download_url:'/__proof.pdf' };
const request = (n, status) => ({ id:`demo-p${n}`,title:`Pago ${n} · IMP-DEMO`,amount_clp:quote[`p${n}_clp`],status,created_at:'2026-10-25 12:00:00',paid_at:status === 'paid' ? '2026-10-25 12:00:00' : null,payment_method:status === 'paid' ? 'transferencia_bancaria' : null,metadata:{order_id:900,custom_fields:{pago:n}} });
const requests = [request(1,scenario === 'history' ? 'pending' : 'paid')];
if (!['history','price','report','declined'].includes(scenario)) requests.push(request(2,scenario === 'closed' ? 'paid' : 'pending'));
if (scenario === 'closed') requests.push(request(3,'paid'));
if (scenario === 'review') Object.assign(requests[1], { receipts:[receipt],receipt_received_at:'2026-10-26 12:00:00',receipt_status:'pending' });
if (scenario === 'rejected') Object.assign(requests[1], { receipts:[{...receipt,status:'rejected',review_note:'El archivo no muestra la referencia bancaria.'}],receipt_received_at:'2026-10-26 12:00:00',receipt_status:'rejected' });
window.fixtureRequests = requests;
window.processActions = [];
const order = { id:900,order_number:'IMP-DEMO',customer_name:'Sofía Carrasco',customer_email:'sofia@example.test',status:scenario === 'closed' ? 'completed' : 'in_progress',agent_name:'Equipo Imporlan',eleccion,links:[boat] };
const action = label => () => window.processActions.push(label);
createRoot(document.getElementById('root')).render(<MemoryRouter><ToastProvider><main className="exp-workspace" style={{maxWidth:1160,margin:'0 auto',padding:'28px 16px 60px'}}>
  <div style={{marginBottom:24}}><p className="import-kicker">IMP-DEMO · Vista de prueba</p><h1 className="text-2xl font-semibold text-ink-900 mt-1">{mode === 'admin' || mode === 'agent' ? 'Centro de operación' : 'Mi compra e importación'}</h1><p className="text-sm text-ink-500 mt-2">{mode === 'admin' || mode === 'agent' ? 'Sofía Carrasco · MasterCraft X26' : 'Consulta el avance, tus próximos pasos y los pagos de tu lancha.'}</p></div>
  {mode === 'client' ? <TuImportacion order={order} link={boat} eleccion={eleccion} requests={requests} files={[]} novedades={[]} onLeerReporte={action('read-report')} onAprobar={action('approve')} onDeclinar={action('decline')} onElegirOtra={noop} onPedirDevolucion={noop} /> : <SeccionImportacion detail={order} links={[boat]} importacion={{puedeCobrar:mode !== 'agent',datosCliente:false,operacionUsa:false,cobros:mode === 'agent' ? [] : requests,onHito:action('hito'),onInspeccionResultado:action('inspection'),onEstadoCobro:action('payment'),onRecargar:noop,onReintentarCobros:noop,onQuitar:noop,onCrearCobro:noop}} onMarcarElegida={noop} />}
</main></ToastProvider></MemoryRouter>);
