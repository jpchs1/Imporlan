import { useState, useEffect, useCallback } from 'react';
import { getPurchases, updatePurchaseStatus } from '../api';
import { fmtCLP, fmtDate, fmtDateTime, statusColor, statusLabel, purchaseTypeLabel, paymentMethodLabel, downloadCSV } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { PageHeader, Card, Table, Badge, Button, Modal, Select, Input, Spinner, ErrorState } from '../../shared/components/UI';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'paid', label: 'Pagado' },
  { value: 'active', label: 'Activo' },
  { value: 'expired', label: 'Vencido' },
  { value: 'canceled', label: 'Cancelado' },
];

const PLAN_AUTO_CLOSE_DAYS = 60;

// Fecha en que el cierre automático vencerá un plan pagado/activo.
function autoCloseDate(p) {
  if (p.type !== 'plan' || !['paid', 'active'].includes(p.status)) return null;
  const base = p.reactivated_at || p.created_at;
  const t = new Date(String(base || '').replace(' ', 'T')).getTime();
  if (isNaN(t)) return null;
  return new Date(t + PLAN_AUTO_CLOSE_DAYS * 86400000);
}

export default function Purchases() {
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = ['admin', 'support'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPurchases();
      setItems(res.items || []);
    } catch (e) { setError(e.message || 'No se pudieron cargar las compras'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange() {
    if (!selected || !newStatus) return;
    if (!confirm(`Cambiar "${statusLabel(selected.status)}" → "${statusLabel(newStatus)}"?\nTambién actualiza el expediente asociado (salvo que esté completado).`)) return;
    setSaving(true);
    try {
      const r = await updatePurchaseStatus(selected.purchase_id, newStatus);
      toast?.(r?.message || 'Estado actualizado');
      setSelected(null);
      load();
    } catch (e) { toast?.(e.message || 'Error al actualizar', 'error'); }
    setSaving(false);
  }

  const types = [...new Set(items.map(i => i.type).filter(Boolean))];
  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (typeFilter && i.type !== typeFilter) return false;
    if (q && !`${i.user_email} ${i.description} ${i.plan_name} ${i.purchase_id} ${i.payment_id || ''} ${i.payer_name || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const columns = [
    { header: 'Fecha', sortValue: r => r.sort_time || 0, cell: r => fmtDate(r.created_at) },
    { header: 'Email', key: 'user_email' },
    { header: 'Tipo', key: 'type', cell: r => purchaseTypeLabel(r.type) },
    { header: 'Descripción', cell: r => <span className="max-w-[220px] truncate block" title={r.plan_name || r.description}>{r.plan_name || r.description || '-'}</span> },
    { header: 'Monto', sortValue: r => r.amount_clp || 0, cell: r => <span className="font-semibold tabular-nums">{fmtCLP(r.amount_clp)}</span> },
    { header: 'Medio', key: 'payment_method', cell: r => paymentMethodLabel(r.payment_method) },
    { header: 'Estado', key: 'status', cell: r => (
      <div className="flex flex-col gap-0.5">
        <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
        {r.expired_reason?.startsWith('auto_') && <span className="text-[10px] text-slate-400">cierre automático</span>}
      </div>
    ) },
  ];

  function exportCSV() {
    downloadCSV(`compras-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'ID', value: r => r.purchase_id },
      { header: 'Fecha', value: r => r.created_at },
      { header: 'Email', value: r => r.user_email },
      { header: 'Nombre', value: r => r.payer_name },
      { header: 'Tipo', value: r => purchaseTypeLabel(r.type) },
      { header: 'Descripción', value: r => r.plan_name || r.description },
      { header: 'Monto CLP', value: r => r.amount_clp },
      { header: 'Medio', value: r => paymentMethodLabel(r.payment_method) },
      { header: 'ID pago', value: r => r.payment_id },
      { header: 'Estado', value: r => statusLabel(r.status) },
    ], filtered);
  }

  if (loading) return <Spinner />;

  const closeDate = selected ? autoCloseDate(selected) : null;

  return (
    <>
      <PageHeader title="Compras" subtitle={`${items.length} compras registradas`}
        action={items.length > 0 && <Button variant="secondary" onClick={exportCSV}>Exportar CSV</Button>} />

      <Card>
        {error ? <ErrorState message={error} onRetry={load} /> : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input placeholder="Buscar por email, nombre, descripción o ID..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
              <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[
                { value: '', label: 'Todos los tipos' },
                ...types.map(t => ({ value: t, label: purchaseTypeLabel(t) })),
              ]} className="w-full sm:w-44" />
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
                { value: '', label: 'Todos los estados' }, ...STATUS_OPTIONS,
              ]} className="w-full sm:w-44" />
            </div>
            <Table columns={columns} data={filtered} onRowClick={r => { setSelected(r); setNewStatus(r.status); }}
              emptyMsg={q || statusFilter || typeFilter ? 'Ninguna compra coincide con los filtros' : 'Sin compras registradas'} />
          </>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalle de compra">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">ID</span><p className="font-mono break-all">{selected.purchase_id}</p></div>
              <div><span className="text-slate-500">Email</span><p className="break-all">{selected.user_email}</p></div>
              {selected.payer_name && <div><span className="text-slate-500">Nombre</span><p>{selected.payer_name}</p></div>}
              {selected.payer_phone && <div><span className="text-slate-500">Teléfono</span><p>{selected.payer_phone}</p></div>}
              <div><span className="text-slate-500">Tipo</span><p>{purchaseTypeLabel(selected.type)}</p></div>
              <div><span className="text-slate-500">Monto</span><p className="font-semibold">{fmtCLP(selected.amount_clp)}</p></div>
              <div><span className="text-slate-500">Medio de pago</span><p>{paymentMethodLabel(selected.payment_method)}</p></div>
              <div><span className="text-slate-500">Fecha</span><p>{fmtDateTime(selected.created_at)}</p></div>
              {selected.payment_id && <div><span className="text-slate-500">ID de pago</span><p className="font-mono break-all">{selected.payment_id}</p></div>}
              {selected.order_id && <div><span className="text-slate-500">Orden</span><p className="font-mono break-all">{selected.order_id}</p></div>}
              {(selected.plan_name || selected.description) && <div className="sm:col-span-2"><span className="text-slate-500">Descripción</span><p>{selected.plan_name || selected.description}</p></div>}
              {selected.url && <div className="sm:col-span-2"><span className="text-slate-500">URL</span><a href={selected.url} target="_blank" rel="noreferrer" className="block break-all text-indigo-600 hover:underline">{selected.url}</a></div>}
            </div>

            {closeDate && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                Se cierra automáticamente el <b>{closeDate.toLocaleDateString('es-CL')}</b> ({PLAN_AUTO_CLOSE_DAYS} días desde {selected.reactivated_at ? 'la reactivación' : 'la compra'}).
              </div>
            )}
            {selected.status === 'expired' && selected.expired_at && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                Vencido el {fmtDateTime(selected.expired_at)}{selected.expired_reason?.startsWith('auto_') ? ' por cierre automático' : ''}.
                Si lo reactivas, el plazo de {PLAN_AUTO_CLOSE_DAYS} días corre desde hoy.
              </div>
            )}

            {canEdit ? (
              <div className="border-t pt-4">
                <Select label="Cambiar estado" value={newStatus} onChange={e => setNewStatus(e.target.value)} options={STATUS_OPTIONS} />
                <div className="flex gap-3 justify-end mt-4">
                  <Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
                  <Button onClick={handleStatusChange} disabled={saving || newStatus === selected.status}>{saving ? 'Guardando...' : 'Actualizar estado'}</Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end border-t pt-4"><Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button></div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
