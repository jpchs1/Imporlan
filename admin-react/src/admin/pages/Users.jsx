import { useState, useEffect } from 'react';
import { getUsers, getUserDetail, getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../api';
import { fmtCLP, fmtDate, statusColor } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Select, Spinner } from '../../shared/components/UI';

export default function Users() {
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent', status: 'active' });
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([getUsers(), getAdminUsers().catch(() => ({ items: [] }))]);
      setClients(c.items || []);
      setAdmins(a.items || a.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleViewClient(row) {
    try {
      const d = await getUserDetail(row.email);
      setDetail(d);
    } catch { setDetail(row); }
  }

  function openCreate() {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'agent', status: 'active' });
    setShowModal(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, status: u.status });
    setShowModal(true);
  }

  async function handleSave() {
    try {
      if (editUser) {
        await updateAdminUser({ id: editUser.id, ...form });
      } else {
        await createAdminUser(form);
      }
      setShowModal(false);
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este usuario?')) return;
    try { await deleteAdminUser(id); loadData(); } catch (e) { alert(e.message); }
  }

  const filtered = (tab === 'clients' ? clients : admins).filter(u =>
    !search || (u.email + ' ' + u.name).toLowerCase().includes(search.toLowerCase())
  );

  const clientCols = [
    { header: 'Email', key: 'email' },
    { header: 'Compras', key: 'total_purchases' },
    { header: 'Total gastado', cell: r => fmtCLP(r.total_spent) },
    { header: 'Ultima actividad', cell: r => fmtDate(r.last_login) },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
  ];

  const adminCols = [
    { header: 'Nombre', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Rol', cell: r => <Badge className={statusColor(r.role === 'admin' ? 'active' : 'info')}>{r.role}</Badge> },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
    { header: 'Acciones', cell: r => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Editar</Button>
        <Button size="sm" variant="ghost" className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>Eliminar</Button>
      </div>
    )},
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Usuarios" subtitle={`${clients.length} clientes, ${admins.length} administradores`}
        action={tab === 'admins' && <Button onClick={openCreate}>+ Nuevo admin</Button>}
      />

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'clients' ? 'primary' : 'secondary'} onClick={() => setTab('clients')}>Clientes ({clients.length})</Button>
        <Button variant={tab === 'admins' ? 'primary' : 'secondary'} onClick={() => setTab('admins')}>Administradores ({admins.length})</Button>
      </div>

      <Card>
        <Input placeholder="Buscar por email o nombre..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
        <Table
          columns={tab === 'clients' ? clientCols : adminCols}
          data={filtered}
          onRowClick={tab === 'clients' ? handleViewClient : undefined}
        />
      </Card>

      {/* Client detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalle de usuario" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-sm text-slate-500">Email</span><p className="font-medium">{detail.email}</p></div>
              <div><span className="text-sm text-slate-500">Total compras</span><p className="font-medium">{detail.total_purchases}</p></div>
              <div><span className="text-sm text-slate-500">Total gastado</span><p className="font-medium">{fmtCLP(detail.total_spent)}</p></div>
              <div><span className="text-sm text-slate-500">Registro</span><p className="font-medium">{fmtDate(detail.created_at)}</p></div>
            </div>
            {detail.purchases && (
              <>
                <h4 className="font-semibold mt-4">Historial de compras</h4>
                <Table columns={[
                  { header: 'Descripcion', key: 'description' },
                  { header: 'Monto', cell: r => fmtCLP(r.amount_clp || r.amount) },
                  { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
                  { header: 'Fecha', cell: r => fmtDate(r.timestamp || r.date) },
                ]} data={detail.purchases} />
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Admin user form */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Editar administrador' : 'Nuevo administrador'}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editUser} />
          <Input label={editUser ? 'Nueva contrasena (dejar vacio para mantener)' : 'Contrasena'} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editUser} />
          <Select label="Rol" value={form.role} onChange={e => setForm({...form, role: e.target.value})} options={[
            { value: 'admin', label: 'Admin' },
            { value: 'support', label: 'Soporte' },
            { value: 'agent', label: 'Agente' },
          ]} />
          <Select label="Estado" value={form.status} onChange={e => setForm({...form, status: e.target.value})} options={[
            { value: 'active', label: 'Activo' },
            { value: 'suspended', label: 'Suspendido' },
          ]} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editUser ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
