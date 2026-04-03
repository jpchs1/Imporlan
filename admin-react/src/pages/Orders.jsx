import { useState, useEffect } from 'react';
import { getOrders, getOrderDetail, updateOrder, createOrder, deleteOrder, addOrderLink, deleteOrderLink, changeOrderStatus } from '../lib/api';
import { fmtDate, fmtCLP, statusColor } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Select, Textarea, Spinner } from '../components/UI';

const ORDER_STATUSES = [
  { value: 'pending_payment', label: 'Pendiente pago' },
  { value: 'pending_admin_fill', label: 'Pendiente admin' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'links_ready', label: 'Links listos' },
  { value: 'completed', label: 'Completado' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'expired', label: 'Expirado' },
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ user_email: '', plan_name: '', description: '', status: 'pending_admin_fill' });
  const [newLink, setNewLink] = useState({ url: '', title: '', price: '' });
  const [changeStatus, setChangeStatus] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getOrders();
      setOrders(res.items || res.orders || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function viewDetail(row) {
    try {
      const d = await getOrderDetail(row.id);
      setDetail(d);
      setChangeStatus(d.status || row.status);
    } catch { setDetail(row); setChangeStatus(row.status); }
  }

  async function handleCreate() {
    try {
      await createOrder(createForm);
      setShowCreate(false);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleAddLink() {
    if (!newLink.url || !detail) return;
    try {
      await addOrderLink({ order_id: detail.id, ...newLink, price: Number(newLink.price) || 0 });
      const d = await getOrderDetail(detail.id);
      setDetail(d);
      setNewLink({ url: '', title: '', price: '' });
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteLink(linkId) {
    if (!confirm('Eliminar este link?')) return;
    try {
      await deleteOrderLink({ order_id: detail.id, link_id: linkId });
      const d = await getOrderDetail(detail.id);
      setDetail(d);
    } catch (e) { alert(e.message); }
  }

  async function handleChangeStatus() {
    try {
      await changeOrderStatus({ id: detail.id, status: changeStatus });
      const d = await getOrderDetail(detail.id);
      setDetail(d);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteOrder(id) {
    if (!confirm('Eliminar este expediente?')) return;
    try { await deleteOrder(id); setDetail(null); load(); } catch (e) { alert(e.message); }
  }

  const filtered = orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search && !(o.user_email + ' ' + o.plan_name + ' ' + (o.id || '')).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { header: 'ID', cell: r => <span className="font-mono text-xs">#{r.id}</span> },
    { header: 'Email', key: 'user_email' },
    { header: 'Plan', key: 'plan_name' },
    { header: 'Links', cell: r => r.links_count ?? (r.links || []).length },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
    { header: 'Fecha', cell: r => fmtDate(r.created_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Expedientes" subtitle={`${orders.length} expedientes`} action={<Button onClick={() => setShowCreate(true)}>+ Nuevo expediente</Button>} />

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Buscar por email, plan o ID..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{ value: '', label: 'Todos' }, ...ORDER_STATUSES]} className="w-48" />
        </div>
        <Table columns={columns} data={filtered} onRowClick={viewDetail} />
      </Card>

      {/* Order detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Expediente #${detail?.id || ''}`} size="xl">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><span className="text-slate-500">Email</span><p className="font-medium">{detail.user_email}</p></div>
              <div><span className="text-slate-500">Plan</span><p>{detail.plan_name}</p></div>
              <div><span className="text-slate-500">Estado</span><p><Badge className={statusColor(detail.status)}>{detail.status}</Badge></p></div>
              <div><span className="text-slate-500">Creado</span><p>{fmtDate(detail.created_at)}</p></div>
              {detail.description && <div className="col-span-2"><span className="text-slate-500">Descripcion</span><p>{detail.description}</p></div>}
            </div>

            {/* Status change */}
            <div className="flex gap-3 items-end border-t pt-4">
              <Select label="Cambiar estado" value={changeStatus} onChange={e => setChangeStatus(e.target.value)} options={ORDER_STATUSES} className="flex-1" />
              <Button onClick={handleChangeStatus} disabled={changeStatus === detail.status}>Aplicar</Button>
            </div>

            {/* Links */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Links ({(detail.links || []).length})</h4>
              {(detail.links || []).length > 0 && (
                <div className="space-y-2 mb-4">
                  {detail.links.map((link, i) => (
                    <div key={link.id || i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{link.title || link.url}</p>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate block">{link.url}</a>
                      </div>
                      {link.price > 0 && <span className="text-sm font-semibold">{fmtCLP(link.price)}</span>}
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDeleteLink(link.id)}>X</Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <Input label="URL" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} placeholder="https://..." className="flex-1" />
                <Input label="Titulo" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} className="w-40" />
                <Input label="Precio" type="number" value={newLink.price} onChange={e => setNewLink({...newLink, price: e.target.value})} className="w-28" />
                <Button onClick={handleAddLink} disabled={!newLink.url}>Agregar</Button>
              </div>
            </div>

            <div className="flex justify-between border-t pt-4">
              <Button variant="danger" onClick={() => handleDeleteOrder(detail.id)}>Eliminar expediente</Button>
              <Button variant="secondary" onClick={() => setDetail(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create order */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo expediente">
        <div className="space-y-4">
          <Input label="Email del cliente" type="email" value={createForm.user_email} onChange={e => setCreateForm({...createForm, user_email: e.target.value})} required />
          <Input label="Nombre del plan" value={createForm.plan_name} onChange={e => setCreateForm({...createForm, plan_name: e.target.value})} />
          <Textarea label="Descripcion" value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} />
          <Select label="Estado inicial" value={createForm.status} onChange={e => setCreateForm({...createForm, status: e.target.value})} options={ORDER_STATUSES} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Crear</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
