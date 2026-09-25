import { useState, useEffect, useCallback } from 'react';
import { getUsers, getUserDetail, getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../api';
import { fmtCLP, fmtDate, statusColor, statusLabel, dateValue, downloadCSV, purchaseTypeLabel } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Select, Spinner, ErrorState } from '../../shared/components/UI';

const ROLE_LABEL = { admin: 'Admin', support: 'Soporte', agent: 'Agente' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'agent', status: 'active' };

export default function Users() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, a] = await Promise.all([getUsers(), getAdminUsers().catch(() => ({ users: [] }))]);
      setClients(c.items || c.users || []);
      // users_api mezcla el equipo con clientes derivados de compras: aquí
      // sólo van las cuentas del panel.
      setAdmins((a.items || a.users || []).filter(u => u.source === 'admin'));
    } catch (e) { setError(e.message || 'No se pudieron cargar los usuarios'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleViewClient(row) {
    setDetail({ ...row, loading: true });
    try {
      const d = await getUserDetail(row.email);
      setDetail({ ...row, ...(d.user || d) });
    } catch { setDetail(row); }
  }

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ name: u.name || '', email: u.email || '', password: '', role: u.role || 'agent', status: u.status || 'active' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast?.('Falta el nombre', 'error'); return; }
    if (!editUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast?.('Email inválido', 'error'); return; }
    if ((!editUser || form.password) && form.password.length < 8) { toast?.('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (editUser) await updateAdminUser({ id: editUser.id, ...payload });
      else await createAdminUser(payload);
      toast?.(editUser ? 'Cuenta actualizada' : 'Cuenta creada');
      setShowModal(false);
      loadData();
    } catch (e) { toast?.(e.message || 'Error al guardar', 'error'); }
    setSaving(false);
  }

  async function handleDelete(u) {
    if (u.email === user?.email) { toast?.('No puedes eliminar tu propia cuenta', 'error'); return; }
    if (!confirm(`Eliminar la cuenta de ${u.name || u.email}? Perderá el acceso al panel.`)) return;
    try { await deleteAdminUser(u.id); toast?.('Cuenta eliminada'); loadData(); } catch (e) { toast?.(e.message, 'error'); }
  }

  const q = search.trim().toLowerCase();
  const filtered = (tab === 'clients' ? clients : admins).filter(u =>
    !q || `${u.email} ${u.name || ''} ${u.phone || ''}`.toLowerCase().includes(q)
  );

  const clientCols = [
    { header: 'Email', key: 'email' },
    { header: 'Nombre', key: 'name', cell: r => r.name || '-' },
    { header: 'Compras', sortValue: r => Number(r.total_purchases) || 0, cell: r => r.total_purchases ?? 0 },
    { header: 'Total pagado', sortValue: r => Number(r.total_spent) || 0, cell: r => fmtCLP(r.total_spent) },
    { header: 'Última actividad', sortValue: r => dateValue(r.last_login || r.last_purchase), cell: r => fmtDate(r.last_login || r.last_purchase) },
  ];

  const adminCols = [
    { header: 'Nombre', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Rol', key: 'role', cell: r => <Badge className={r.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-50 text-blue-700'}>{ROLE_LABEL[r.role] || r.role}</Badge> },
    { header: 'Estado', key: 'status', cell: r => <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge> },
    { header: 'Último ingreso', sortValue: r => dateValue(r.last_login), cell: r => fmtDate(r.last_login) },
    { header: 'Acciones', cell: r => isAdmin ? (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Editar</Button>
        {r.email !== user?.email && (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(r); }}>Eliminar</Button>
        )}
      </div>
    ) : <span className="text-xs text-slate-400">Sólo admin</span> },
  ];

  function exportClients() {
    downloadCSV(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'Email', value: r => r.email },
      { header: 'Nombre', value: r => r.name },
      { header: 'Compras', value: r => r.total_purchases },
      { header: 'Total pagado (CLP)', value: r => r.total_spent },
      { header: 'Última actividad', value: r => r.last_login || r.last_purchase },
    ], filtered);
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Usuarios" subtitle={`${clients.length} clientes · ${admins.length} cuentas del equipo`}
        action={tab === 'admins'
          ? (isAdmin && <Button onClick={openCreate}>+ Nueva cuenta</Button>)
          : (clients.length > 0 && <Button variant="secondary" onClick={exportClients}>Exportar CSV</Button>)}
      />

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'clients' ? 'primary' : 'secondary'} aria-pressed={tab === 'clients'} onClick={() => setTab('clients')}>Clientes ({clients.length})</Button>
        <Button variant={tab === 'admins' ? 'primary' : 'secondary'} aria-pressed={tab === 'admins'} onClick={() => setTab('admins')}>Equipo ({admins.length})</Button>
      </div>

      <Card>
        {error ? <ErrorState message={error} onRetry={loadData} /> : (
          <>
            <Input placeholder="Buscar por email, nombre o teléfono..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
            <Table
              columns={tab === 'clients' ? clientCols : adminCols}
              data={filtered}
              onRowClick={tab === 'clients' ? handleViewClient : (isAdmin ? openEdit : undefined)}
              emptyMsg={q ? 'Nadie coincide con la búsqueda' : 'Sin registros'}
            />
          </>
        )}
      </Card>

      {/* Detalle de cliente */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalle de cliente" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><span className="text-sm text-slate-500">Email</span><p className="font-medium break-all">{detail.email}</p></div>
              <div><span className="text-sm text-slate-500">Compras</span><p className="font-medium">{detail.total_purchases ?? 0}</p></div>
              <div><span className="text-sm text-slate-500">Total pagado</span><p className="font-medium">{fmtCLP(detail.total_spent)}</p></div>
              <div><span className="text-sm text-slate-500">Primera compra</span><p className="font-medium">{fmtDate(detail.created_at || detail.first_purchase)}</p></div>
            </div>
            {detail.loading && <Spinner />}
            {Array.isArray(detail.purchases) && detail.purchases.length > 0 && (
              <>
                <h4 className="font-semibold mt-4">Historial de compras</h4>
                <Table pageSize={0} columns={[
                  { header: 'Tipo', cell: r => purchaseTypeLabel(r.type) },
                  { header: 'Descripción', cell: r => r.plan_name || r.description || '-' },
                  { header: 'Monto', sortValue: r => Number(r.amount_clp || r.amount) || 0, cell: r => fmtCLP(r.amount_clp || r.amount) },
                  { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge> },
                  { header: 'Fecha', sortValue: r => dateValue(r.timestamp || r.date), cell: r => fmtDate(r.timestamp || r.date) },
                ]} data={detail.purchases} />
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Cuenta del equipo */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Editar cuenta' : 'Nueva cuenta del equipo'}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required disabled={!!editUser} />
          <Input label={editUser ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña (mínimo 8 caracteres)'} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editUser} />
          <Select label="Rol" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={[
            { value: 'admin', label: 'Admin · acceso total' },
            { value: 'support', label: 'Soporte · operación, sin gestión de cuentas' },
            { value: 'agent', label: 'Agente · expedientes y chat' },
          ]} disabled={editUser?.email === user?.email} />
          <Select label="Estado" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={[
            { value: 'active', label: 'Activo' },
            { value: 'suspended', label: 'Suspendido' },
          ]} disabled={editUser?.email === user?.email} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editUser ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
