import { useState, useEffect, useRef, useCallback } from 'react';
import { getOrders, getOrderDetail, updateOrder, createOrder, deleteOrder as apiDeleteOrder, addOrderLink, deleteOrderLink, updateOrderLinks, reorderOrderLinks, changeOrderStatus, sendClientUpdate, notifyRanking, uploadLinkImage } from '../lib/api';
import { fmtDate, statusColor } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Textarea, Spinner } from '../components/UI';
import { useToast } from '../components/Toast';
import Timeline from '../components/Timeline';
import LinkRow from '../components/LinkRow';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending_admin_fill', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'expired', label: 'Vencido' },
  { value: 'canceled', label: 'Cancelado' },
];

const SERVICE_TYPES = [
  { value: '', label: 'Tipo Servicio' },
  { value: 'plan_busqueda', label: 'Plan Busqueda' },
  { value: 'cotizacion_link', label: 'Cotizacion Link' },
];

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | detail
  const [detail, setDetail] = useState(null);
  const [links, setLinks] = useState([]);
  const [unsaved, setUnsaved] = useState(false);
  const [sortDir, setSortDir] = useState('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Filters
  const [filters, setFilters] = useState({ status: '', service_type: '', agent: '', from_date: '', to_date: '', search: '' });

  // Form fields for detail
  const [form, setForm] = useState({});

  // Create form
  const [createForm, setCreateForm] = useState({
    customer_email: '', customer_name: '', customer_phone: '', service_type: 'plan_busqueda',
    plan_name: '', asset_name: '', type_zone: '', agent_name: 'Rodrigo Calderon',
  });

  // Drag state
  const dragIdx = useRef(null);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await getOrders(filters);
      setOrders(res.orders || res.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function openDetail(orderId) {
    setLoading(true);
    try {
      const o = await getOrderDetail(orderId);
      const order = o.order || o;
      setDetail(order);
      setLinks(JSON.parse(JSON.stringify(order.links || [])));
      setForm({
        customer_phone: order.customer_phone || '',
        service_type: order.service_type || 'plan_busqueda',
        origin: order.origin || 'web',
        plan_name: order.plan_name || '',
        asset_name: order.asset_name || '',
        type_zone: order.type_zone || '',
        requirement_name: order.requirement_name || '',
        agent_name: order.agent_name || '',
        agent_phone: order.agent_phone || '',
        admin_notes: order.admin_notes || '',
        visible_to_client: order.visible_to_client == 1,
      });
      setUnsaved(false);
      setView('detail');
    } catch (e) { toast?.('Error cargando expediente', 'error'); }
    setLoading(false);
  }

  function goBack() { setView('list'); setDetail(null); loadOrders(); }

  // ---- SAVE ALL ----
  async function handleSaveAll() {
    if (!detail) return;
    setSaving(true);
    try {
      await updateOrder({ id: detail.id, ...form, visible_to_client: form.visible_to_client ? 1 : 0 });
      await updateOrderLinks(detail.id, links);
      setUnsaved(false);
      toast?.('Expediente guardado correctamente');
      const o = await getOrderDetail(detail.id);
      const order = o.order || o;
      setDetail(order);
      setLinks(JSON.parse(JSON.stringify(order.links || [])));
    } catch (e) { toast?.(e.message || 'Error guardando', 'error'); }
    setSaving(false);
  }

  // ---- STATUS CHANGE ----
  async function handleStatusChange() {
    if (!detail || !newStatus) return;
    try {
      await changeOrderStatus({ id: detail.id, status: newStatus });
      toast?.('Estado actualizado');
      setShowStatusModal(false);
      const o = await getOrderDetail(detail.id);
      setDetail(o.order || o);
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- SEND CLIENT UPDATE ----
  async function handleSendClient() {
    try {
      await sendClientUpdate(detail.id);
      toast?.('Notificacion enviada al cliente');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- NOTIFY RANKING ----
  async function handleNotifyRanking() {
    try {
      await notifyRanking(detail.id, user?.name || 'Admin');
      toast?.('Ranking notificado al usuario');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- TIMELINE ----
  async function handleTimelineStep(dir) {
    const step = (detail.timeline_step || 1) + dir;
    if (step < 1 || step > 5) return;
    try {
      await updateOrder({ id: detail.id, timeline_step: step });
      setDetail({ ...detail, timeline_step: step });
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- ADD LINK ----
  async function handleAddLink() {
    try {
      const res = await addOrderLink(detail.id);
      const o = await getOrderDetail(detail.id);
      const order = o.order || o;
      setDetail(order);
      setLinks(JSON.parse(JSON.stringify(order.links || [])));
      toast?.('Fila agregada');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- DELETE LINK ----
  async function handleDeleteLink(linkId) {
    if (!confirm('Eliminar este link?')) return;
    try {
      await deleteOrderLink(detail.id, linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast?.('Link eliminado');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- UPDATE LINK FIELD ----
  function handleLinkUpdate(linkId, field, value) {
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: value } : l));
    setUnsaved(true);
  }

  // ---- IMAGE UPLOAD ----
  async function handleImageUpload(linkId, file) {
    try {
      const res = await uploadLinkImage(detail.id, linkId, file);
      if (res.url || res.image_url) {
        const url = res.url || res.image_url;
        setLinks(prev => prev.map(l => l.id === linkId ? { ...l, image_url: url } : l));
        toast?.('Imagen subida');
      }
    } catch (e) { toast?.('Error subiendo imagen', 'error'); }
  }

  // ---- DRAG & DROP ----
  function onDragStart(e, idx) {
    dragIdx.current = idx;
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function onDrop(e, dropIdx) {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const newLinks = [...links];
    const [moved] = newLinks.splice(fromIdx, 1);
    newLinks.splice(dropIdx, 0, moved);
    setLinks(newLinks);
    setUnsaved(true);
    // Save reorder
    const ids = newLinks.map(l => l.id).filter(Boolean);
    reorderOrderLinks(detail.id, ids, user?.name || 'Admin').catch(() => {});
  }
  function onDragEnd(e) { e.currentTarget.style.opacity = '1'; dragIdx.current = null; }

  // ---- CREATE ORDER ----
  async function handleCreate() {
    try {
      await createOrder(createForm);
      setShowCreate(false);
      setCreateForm({ customer_email:'', customer_name:'', customer_phone:'', service_type:'plan_busqueda', plan_name:'', asset_name:'', type_zone:'', agent_name:'Rodrigo Calderon' });
      toast?.('Expediente creado');
      loadOrders();
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- DELETE ORDER ----
  async function handleDeleteOrder() {
    if (!confirm('Eliminar este expediente permanentemente?')) return;
    try {
      await apiDeleteOrder(detail.id);
      toast?.('Expediente eliminado');
      goBack();
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- SORT ----
  const sorted = [...orders].sort((a, b) => {
    const da = new Date(a.purchase_date || a.created_at || 0).getTime();
    const db = new Date(b.purchase_date || b.created_at || 0).getTime();
    return sortDir === 'desc' ? db - da : da - db;
  });

  // ============ LIST VIEW ============
  if (view === 'list') {
    if (loading) return <Spinner />;
    return (
      <>
        <PageHeader title="Expedientes" subtitle={`${orders.length} expedientes`} action={<Button onClick={() => setShowCreate(true)}>+ Nuevo Expediente</Button>} />

        {/* Filters */}
        <Card className="mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <Select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} options={STATUS_OPTIONS} />
            <Select value={filters.service_type} onChange={e => setFilters({...filters, service_type: e.target.value})} options={SERVICE_TYPES} />
            <Input value={filters.agent} onChange={e => setFilters({...filters, agent: e.target.value})} placeholder="Agente..." />
            <Input type="date" value={filters.from_date} onChange={e => setFilters({...filters, from_date: e.target.value})} />
            <Input type="date" value={filters.to_date} onChange={e => setFilters({...filters, to_date: e.target.value})} />
            <Input value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="Buscar cliente..." />
            <Button onClick={loadOrders} variant="accent">Filtrar</Button>
          </div>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pedido N°</th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Plan</th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-600" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                    Fecha {sortDir === 'desc' ? '▼' : '▲'}
                  </th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Agente</th>
                  <th className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-300">No se encontraron expedientes</td></tr>
                ) : sorted.map(o => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition cursor-pointer" onClick={() => openDetail(o.id)}>
                    <td className="py-3 px-3"><span className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-bold">{o.order_number}</span></td>
                    <td className="py-3 px-3"><div className="font-medium text-slate-700">{o.customer_name}</div><div className="text-xs text-slate-400">{o.customer_email}</div></td>
                    <td className="py-3 px-3 text-slate-600">{o.plan_name || '-'}</td>
                    <td className="py-3 px-3"><Badge className={statusColor(o.status)}>{STATUS_OPTIONS.find(s=>s.value===o.status)?.label || o.status}</Badge></td>
                    <td className="py-3 px-3 text-slate-500 text-xs">{fmtDate(o.purchase_date || o.created_at)}</td>
                    <td className="py-3 px-3 text-slate-600">{o.agent_name || '-'}</td>
                    <td className="py-3 px-3"><Button size="sm" onClick={e => { e.stopPropagation(); openDetail(o.id); }}>Editar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create modal */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Expediente">
          <div className="space-y-4">
            <Input label="Email cliente *" value={createForm.customer_email} onChange={e => setCreateForm({...createForm, customer_email: e.target.value})} placeholder="cliente@email.com" />
            <Input label="Nombre cliente *" value={createForm.customer_name} onChange={e => setCreateForm({...createForm, customer_name: e.target.value})} placeholder="Nombre completo" />
            <Input label="Telefono" value={createForm.customer_phone} onChange={e => setCreateForm({...createForm, customer_phone: e.target.value})} placeholder="+56 9 1234 5678" />
            <Select label="Tipo servicio" value={createForm.service_type} onChange={e => setCreateForm({...createForm, service_type: e.target.value})} options={[{value:'plan_busqueda',label:'Plan Busqueda'},{value:'cotizacion_link',label:'Cotizacion Link'}]} />
            <Input label="Plan" value={createForm.plan_name} onChange={e => setCreateForm({...createForm, plan_name: e.target.value})} placeholder="Plan Fragata, etc." />
            <Input label="Embarcacion/Objetivo" value={createForm.asset_name} onChange={e => setCreateForm({...createForm, asset_name: e.target.value})} />
            <Input label="Zona/Tipo" value={createForm.type_zone} onChange={e => setCreateForm({...createForm, type_zone: e.target.value})} placeholder="Costa Este USA" />
            <Input label="Agente" value={createForm.agent_name} onChange={e => setCreateForm({...createForm, agent_name: e.target.value})} />
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Crear Expediente</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // ============ DETAIL VIEW ============
  if (loading || !detail) return <Spinner />;

  return (
    <div className="animate-fade-in">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Button variant="secondary" onClick={goBack} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg> Volver
        </Button>
        {unsaved && <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold flex items-center gap-1.5 border border-amber-200 animate-fade-in">⚠ Cambios sin guardar</span>}
        <div className="flex-1" />
        <Button onClick={handleSaveAll} disabled={saving} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {saving ? 'Guardando...' : 'Guardar Todo'}
        </Button>
        <Button variant="accent" onClick={() => { setNewStatus(detail.status); setShowStatusModal(true); }} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Cambiar Estado
        </Button>
        <Button variant="secondary" onClick={handleSendClient} className="flex items-center gap-1.5 !bg-blue-50 !text-blue-700 hover:!bg-blue-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Actualizar Cliente
        </Button>
        <Button variant="danger" onClick={handleDeleteOrder} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Eliminar
        </Button>
      </div>

      {/* Order info card */}
      <Card className="mb-5">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 -m-6 mb-6 px-7 py-5 rounded-t-2xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h2 className="text-white text-lg font-bold">Expediente {detail.order_number}</h2>
          </div>
          <Badge className={statusColor(detail.status) + ' text-sm'}>{STATUS_OPTIONS.find(s=>s.value===detail.status)?.label || detail.status}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cliente" value={detail.customer_name || ''} disabled />
          <Input label="Email" value={detail.customer_email || ''} disabled />
          <Input label="Email secundario" value={detail.secondary_email || ''} disabled placeholder="Sin email secundario" />
          <Input label="Telefono cliente" value={form.customer_phone} onChange={e => { setForm({...form, customer_phone: e.target.value}); setUnsaved(true); }} />
          <Select label="Tipo servicio" value={form.service_type} onChange={e => { setForm({...form, service_type: e.target.value}); setUnsaved(true); }} options={[{value:'plan_busqueda',label:'Plan Busqueda'},{value:'cotizacion_link',label:'Cotizacion Link'}]} />
          <Select label="Origen" value={form.origin} onChange={e => { setForm({...form, origin: e.target.value}); setUnsaved(true); }} options={[{value:'web',label:'Web'},{value:'admin',label:'Admin'},{value:'whatsapp',label:'WhatsApp'}]} />
          <div>
            <Input label="Plan" value={form.plan_name} onChange={e => { setForm({...form, plan_name: e.target.value}); setUnsaved(true); }} />
            {(form.plan_name || '').toLowerCase().includes('almirante')
              ? <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700">Reporte IA incluido</span>
              : <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">Reporte IA: +$15.000 CLP</span>
            }
          </div>
          <Input label="Embarcacion/Objetivo" value={form.asset_name} onChange={e => { setForm({...form, asset_name: e.target.value}); setUnsaved(true); }} />
          <Input label="Tipo/Zona" value={form.type_zone} onChange={e => { setForm({...form, type_zone: e.target.value}); setUnsaved(true); }} />
          <Input label="Requerimiento" value={form.requirement_name} onChange={e => { setForm({...form, requirement_name: e.target.value}); setUnsaved(true); }} />
          <Input label="Agente" value={form.agent_name} onChange={e => { setForm({...form, agent_name: e.target.value}); setUnsaved(true); }} />
          <Input label="Telefono agente" value={form.agent_phone} onChange={e => { setForm({...form, agent_phone: e.target.value}); setUnsaved(true); }} />
          <div className="md:col-span-2">
            <Textarea label="Notas admin (internas)" value={form.admin_notes} onChange={e => { setForm({...form, admin_notes: e.target.value}); setUnsaved(true); }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.visible_to_client} onChange={e => { setForm({...form, visible_to_client: e.target.checked}); setUnsaved(true); }} className="w-4 h-4 accent-cyan-600 rounded cursor-pointer" />
            Visible para cliente
          </label>
        </div>
      </Card>

      {/* Timeline */}
      <Timeline step={detail.timeline_step || 1} onPrev={() => handleTimelineStep(-1)} onNext={() => handleTimelineStep(1)} />

      {/* Links ranking table */}
      <Card className="mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Ranking de Opciones en USA</h3>
              <p className="text-xs text-slate-400">Arrastra las filas para reordenar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleNotifyRanking} className="flex items-center gap-1.5 !bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> Notificar Ranking
            </Button>
            <Button variant="secondary" onClick={handleAddLink} className="flex items-center gap-1.5 !border-cyan-300 !text-cyan-700 hover:!bg-cyan-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Fila
            </Button>
          </div>
        </div>

        {/* Ranking info bar */}
        {detail.ranking_author_name ? (
          <div className="px-4 py-2.5 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span className="text-emerald-800 font-medium">Ranking armado por <strong>{detail.ranking_author_name}</strong> ({detail.ranking_author_role === 'admin' ? 'Agente/Admin' : 'Usuario'}) {detail.ranking_updated_at ? `- ${fmtDate(detail.ranking_updated_at)}` : ''}</span>
          </div>
        ) : (
          <div className="px-4 py-2.5 mb-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span className="text-amber-800 font-medium">Aun no se ha armado un ranking. Arrastra las filas para ordenar las opciones.</span>
          </div>
        )}

        {/* Links table */}
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full border-collapse" style={{minWidth:1600}}>
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100">
                {['','#','Imagen','Marca','Modelo','Año','Link Opcion (USA)','Ubicacion','Horas','Motor','Valor USA (USD)','Negociar (USD)','Chile (CLP)','Negociado (CLP)','N° Sel','Comentarios','Acc.'].map((h,i) => (
                  <th key={i} className="py-2.5 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr><td colSpan={17} className="py-12 text-center text-slate-300 text-sm">No hay links. Agrega uno con el boton de arriba.</td></tr>
              ) : links.map((lk, idx) => (
                <LinkRow
                  key={lk.id || idx}
                  link={lk}
                  idx={idx}
                  onUpdate={handleLinkUpdate}
                  onDelete={handleDeleteLink}
                  onImageUpload={handleImageUpload}
                  dragHandlers={{
                    onDragStart: e => onDragStart(e, idx),
                    onDragOver,
                    onDrop: e => onDrop(e, idx),
                    onDragEnd,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Change status modal */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Cambiar estado" size="sm">
        <Select label="Nuevo estado" value={newStatus} onChange={e => setNewStatus(e.target.value)} options={STATUS_OPTIONS.filter(s => s.value)} />
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
          <Button onClick={handleStatusChange} disabled={newStatus === detail?.status}>Aplicar</Button>
        </div>
      </Modal>
    </div>
  );
}
