import { useState, useEffect } from 'react';
import { getPurchases, updatePurchaseStatus } from '../lib/api';
import { fmtCLP, fmtDate, statusColor } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Select, Input, Spinner } from '../components/UI';

export default function Purchases() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getPurchases();
      setItems(res.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleStatusChange() {
    if (!selected || !newStatus) return;
    try {
      await updatePurchaseStatus(selected.purchase_id, newStatus);
      setSelected(null);
      load();
    } catch (e) { alert(e.message); }
  }

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (search && !(i.user_email + ' ' + i.description + ' ' + i.purchase_id).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { header: 'ID', cell: r => <span className="font-mono text-xs">{(r.purchase_id || '').slice(0, 12)}</span> },
    { header: 'Email', key: 'user_email' },
    { header: 'Tipo', key: 'type' },
    { header: 'Descripcion', cell: r => <span className="max-w-[200px] truncate block">{r.description || r.plan_name || '-'}</span> },
    { header: 'Monto', cell: r => fmtCLP(r.amount_clp) },
    { header: 'Metodo', key: 'payment_method' },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
    { header: 'Fecha', cell: r => fmtDate(r.created_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Compras" subtitle={`${items.length} compras registradas`} />

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Buscar por email, descripcion o ID..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
            { value: '', label: 'Todos los estados' },
            { value: 'pending', label: 'Pendiente' },
            { value: 'paid', label: 'Pagado' },
            { value: 'active', label: 'Activo' },
            { value: 'expired', label: 'Expirado' },
            { value: 'canceled', label: 'Cancelado' },
          ]} className="w-48" />
        </div>
        <Table columns={columns} data={filtered} onRowClick={r => { setSelected(r); setNewStatus(r.status); }} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de compra">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">ID</span><p className="font-mono">{selected.purchase_id}</p></div>
              <div><span className="text-slate-500">Email</span><p>{selected.user_email}</p></div>
              <div><span className="text-slate-500">Tipo</span><p>{selected.type}</p></div>
              <div><span className="text-slate-500">Monto</span><p className="font-semibold">{fmtCLP(selected.amount_clp)}</p></div>
              <div><span className="text-slate-500">Metodo de pago</span><p>{selected.payment_method}</p></div>
              <div><span className="text-slate-500">Fecha</span><p>{fmtDate(selected.created_at)}</p></div>
              {selected.description && <div className="col-span-2"><span className="text-slate-500">Descripcion</span><p>{selected.description}</p></div>}
              {selected.url && <div className="col-span-2"><span className="text-slate-500">URL</span><p className="break-all text-blue-600">{selected.url}</p></div>}
            </div>

            <div className="border-t pt-4">
              <Select label="Cambiar estado" value={newStatus} onChange={e => setNewStatus(e.target.value)} options={[
                { value: 'pending', label: 'Pendiente' },
                { value: 'paid', label: 'Pagado' },
                { value: 'active', label: 'Activo' },
                { value: 'expired', label: 'Expirado' },
                { value: 'canceled', label: 'Cancelado' },
              ]} />
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
                <Button onClick={handleStatusChange} disabled={newStatus === selected.status}>Actualizar estado</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
