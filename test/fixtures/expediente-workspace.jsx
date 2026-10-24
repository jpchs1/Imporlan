import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AdminDetail from '/src/admin/pages/orders/DetalleExpediente.jsx';
import AdminList from '/src/admin/pages/orders/ListaExpedientes.jsx';
import CustomerDetail from '/src/user/pages/expedientes/DetalleExpediente.jsx';
import CustomerList from '/src/user/pages/expedientes/ListaExpedientes.jsx';
import { FILTROS_VACIOS } from '/src/admin/pages/orders/constantes.js';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import '/src/index.css';

// All records are fictional. No production customer/session is used.
const mode = new URLSearchParams(location.search).get('mode') || 'admin-detail';
const agent = mode === 'agent-detail';
const admin = mode.startsWith('admin') || agent;
const links = [101, 102].map((id, i) => ({ id, order_id: 35, row_index: i, url: 'https://example.test/boat/' + id, title: i ? 'Cobalt R5 · 2019' : 'MasterCraft X26 · 2018', make: i ? 'Cobalt' : 'MasterCraft', model: i ? 'R5' : 'X26', year: i ? 2019 : 2018, location: 'Florida, EE. UU.', image_url: '/__boat.webp', link_status: 'available', value_usa_usd: 85000, value_chile_clp: 120000000 }));
const order = {
  id: 35, order_number: 'IMP-DEMO', customer_name: agent ? 'Sofía' : 'Sofía Carrasco', customer_email: agent ? '' : 'sofia@example.test', customer_phone: '', secondary_email: '',
  status: 'in_progress', timeline_step: 3, asset_name: 'MasterCraft X26', plan_name: 'Plan Almirante', origin: 'web', service_type: 'plan_busqueda', type_zone: 'Costa Este, EE. UU.', requirement_name: 'Embarcación familiar para disfrutar en el lago', agent_name: 'Equipo Imporlan', agent_phone: '', admin_notes: '', visible_to_client: 1,
  purchase_date: '2026-10-20 12:00:00', created_at: '2026-10-20 12:00:00', updated_at: '2026-10-23 12:00:00',
  chosen_link_id: 101, chosen_at: '2026-10-21 12:00:00', links,
  eleccion: { link_id: 101, title: 'MasterCraft X26 · 2018', image_url: '/__boat.webp', at: '2026-10-21 12:00:00', by: 'cliente', inspection: true, client_can_change: true, steps: { disponibilidad: '2026-10-22 12:00:00' } },
  novedades: [{ id: 1, text: 'Ya recibimos las fotografías de la embarcación. El equipo está revisando la documentación de la inspección.', at: '2026-10-23 12:00:00', file_ids: [1, 2] }],
};
window.fixtureOrder = order;

function App() {
  const [form, setForm] = useState({ ...order });
  const [unsaved, setUnsaved] = useState(false);
  const [filters, setFilters] = useState(FILTROS_VACIOS);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ customer_name: '', customer_email: '', customer_phone: '', asset_name: '', type_zone: '', agent_name: '', plan_name: '', service_type: 'plan_busqueda' });
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [filter, setFilter] = useState('todos');
  const noop = () => {};
  const list = [order, { ...order, id: 36, order_number: 'IMP-DEMO-2', customer_name: 'Martín Silva', customer_email: 'martin@example.test', status: 'pending_admin_fill', chosen_link_id: null, eleccion: null, timeline_step: 2, asset_name: 'Búsqueda de embarcación familiar' }, { ...order, id: 37, order_number: 'IMP-DEMO-3', customer_name: 'Valentina Rojas', status: 'completed', eleccion: null, chosen_link_id: null, timeline_step: 5 }];
  window.fixtureOrders = mode === 'customer-list' ? [...list, { ...order, id: 38, order_number: 'IMP-DEMO-4', status: 'in_progress', timeline_step: 4, eleccion: null, chosen_link_id: null, asset_name: 'Compra activa' }] : list;
  return <MemoryRouter><ToastProvider>
    <div className="workspace-demo-shell">
      <aside className="workspace-demo-sidebar"><strong>Imporlan</strong><small>{admin ? 'Administración' : 'Mi panel'}</small><p>Inicio</p><p className="active">Expedientes</p><p>Pagos</p><p>Documentos</p><p>Seguimiento</p></aside>
      <div className="workspace-demo-topbar"><span>Imporlan <span className="text-ink-400 px-2">/</span> Expedientes</span><span className="text-ink-500 text-xs">Vista de prueba</span></div>
      <main className="workspace-demo-main">
        {mode === 'admin-list' ? <AdminList orders={list.filter(o => (!filters.search || o.customer_name.toLowerCase().includes(filters.search.toLowerCase())) && (!filters.status || o.status === filters.status))} conteos={{ '': 3, pending_admin_fill: 1, in_progress: 1, completed: 1 }} loading={false} filters={filters} setFilters={setFilters} onOpen={noop} showCreate={showCreate} setShowCreate={setShowCreate} createForm={createForm} setCreateForm={setCreateForm} onCreate={noop} />
          : mode === 'customer-list' ? <CustomerList filtro={filter} onFiltro={setFilter} hrefDetalle={id => '/expedientes/' + id} />
            : !admin ? <CustomerDetail orderId={35} />
              : <AdminDetail detail={order} links={links} form={form} setForm={setForm} setUnsaved={setUnsaved} unsaved={unsaved} loading={false} saving={false}
                importacion={{ puedeCobrar: !agent, cobros: [], cargandoCobros: false, datosCliente: false, onHito: noop, onInspeccionResultado: noop, onCrearCobro: noop, onEstadoCobro: noop, onQuitar: noop, onElegir: noop }}
                dragHandlers={{ onDragStart: noop, onDragOver: noop, onDrop: noop, onDragEnd: noop }}
                onBack={noop} onSaveAll={() => { window.savedForm = form; setUnsaved(false); }} onSendClient={noop} onNotifyRanking={noop} onRescrape={noop} onDeleteOrder={noop} onTimelineStep={noop}
                onAddLink={noop} onDeleteEmptyLinks={noop} onLinkUpdate={noop} onDeleteLink={noop} onImageUpload={noop} onScrapeResult={noop} onEncolado={noop} onEncolarUrl={noop}
                onCotizar={noop} onEnviarDesglose={noop} onCerrarAvisoScraper={noop} onCloseCotizar={noop} onBreakdownSent={noop} onQuoteSaved={noop}
                showStatusModal={statusModal} setShowStatusModal={setStatusModal} newStatus={newStatus} setNewStatus={setNewStatus} onStatusChange={noop} />}
      </main>
    </div>
  </ToastProvider></MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<App />);
