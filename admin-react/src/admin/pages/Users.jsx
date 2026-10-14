import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, getUserDetail, getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../api';
import { fmtCLP, fmtDate, dateValue, downloadCSV, purchaseTypeLabel } from '../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga, fmtNumero } from '../../shared/lib/format';
import { useAuth } from '../../shared/context/AuthContext';
import { useToast } from '../../shared/components/Toast';
import {
  PageHeader, Card, DataTable, Badge, StatusBadge, Button, Modal, Drawer, Input, Select, SearchInput, Tabs,
  ErrorState, EmptyState, DescriptionList, Money, Avatar, Skeleton, useConfirm,
} from '../../shared/components/UI';
import { Download, Plus, Pencil, Trash, Users as UsersIcon, Mail, ShoppingCart } from '../../shared/components/Icons';
import { useCarga } from './operacion/useCarga';

const ROLE_LABEL = { admin: 'Admin', support: 'Soporte', agent: 'Agente' };
const ROLE_TONE = { admin: 'brand', support: 'info', agent: 'neutral' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'agent', status: 'active' };

// Un solo fetch para las dos pestañas: users_api mezcla el equipo con clientes
// derivados de compras, aquí solo van las cuentas del panel.
async function cargarUsuarios() {
  const [c, a] = await Promise.all([getUsers(), getAdminUsers().catch(() => ({ users: [] }))]);
  return {
    clients: c.items || c.users || [],
    admins: (a.items || a.users || []).filter(u => u.source === 'admin'),
  };
}

export default function Users() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { datos, cargando, error, recargar, refrescar } = useCarga(cargarUsuarios, { mensaje: 'No se pudieron cargar los usuarios' });
  const clients = useMemo(() => datos?.clients || [], [datos]);
  const admins = useMemo(() => datos?.admins || [], [datos]);

  const [tab, setTab] = useState('clients');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const handleViewClient = useCallback(async (row) => {
    setDetail({ ...row, loading: true });
    try {
      const d = await getUserDetail(row.email);
      setDetail({ ...row, ...(d.user || d), loading: false });
    } catch { setDetail({ ...row, loading: false }); }
  }, []);

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ name: u.name || '', email: u.email || '', password: '', role: u.role || 'agent', status: u.status || 'active' });
    setErrors({});
    setShowModal(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Falta el nombre';
    if (!editUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Escribe un correo válido';
    if ((!editUser || form.password) && form.password.length < 8) errs.password = 'La contraseña debe tener al menos 8 caracteres';
    setErrors(errs);
    if (Object.keys(errs).length) { toast?.(Object.values(errs)[0], 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (editUser) await updateAdminUser({ id: editUser.id, ...payload });
      else await createAdminUser(payload);
      toast?.(editUser ? 'Cuenta actualizada' : 'Cuenta creada', 'success');
      setShowModal(false);
      refrescar();
    } catch (e) { toast?.(e.message || 'No se pudo guardar la cuenta', 'error'); }
    setSaving(false);
  }

  async function handleDelete(u) {
    if (u.email === user?.email) { toast?.('No puedes eliminar tu propia cuenta', 'error'); return; }
    const ok = await confirm({
      title: `¿Eliminar la cuenta de ${u.name || u.email}?`,
      description: 'Perderá el acceso al panel. Esta acción no se puede deshacer.',
      tone: 'danger',
      confirmLabel: 'Eliminar cuenta',
    });
    if (!ok) return;
    try { await deleteAdminUser(u.id); toast?.('Cuenta eliminada', 'success'); refrescar(); } catch (e) { toast?.(e.message || 'No se pudo eliminar la cuenta', 'error'); }
  }

  const q = search.trim().toLowerCase();
  const filtered = (tab === 'clients' ? clients : admins).filter(u =>
    !q || `${u.email} ${u.name || ''} ${u.phone || ''}`.toLowerCase().includes(q)
  );

  const clientCols = [
    { key: 'name', header: 'Cliente', sortValue: r => r.name || r.email, cell: r => (
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={r.name || r.email} size="sm" />
        <div className="min-w-0">
          <p className="font-medium text-ink-900 truncate max-w-[220px]" title={r.name || ''}>{r.name || '—'}</p>
          <p className="text-xs text-ink-500 truncate max-w-[220px]" title={r.email}>{r.email}</p>
        </div>
      </div>
    ) },
    { key: 'phone', header: 'Teléfono', priority: 3, cell: r => r.phone || '—' },
    { key: 'total_purchases', header: 'Compras', align: 'right', width: 100, sortValue: r => Number(r.total_purchases) || 0, cell: r => fmtNumero(r.total_purchases ?? 0) },
    { key: 'total_spent', header: 'Total pagado', align: 'right', width: 140, sortValue: r => Number(r.total_spent) || 0, cell: r => <Money clp={r.total_spent} align="right" /> },
    { key: 'last', header: 'Última actividad', priority: 2, width: 150, sortValue: r => dateValue(r.last_login || r.last_purchase), cell: r => <span className="text-ink-500" title={fmtDateLarga(r.last_login || r.last_purchase, { hora: true })}>{fmtRelativo(r.last_login || r.last_purchase) || '—'}</span> },
  ];

  const adminCols = [
    { key: 'name', header: 'Cuenta', sortValue: r => r.name || r.email, cell: r => (
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={r.name || r.email} size="sm" />
        <div className="min-w-0">
          <p className="font-medium text-ink-900 truncate max-w-[220px]">{r.name || '—'}{r.email === user?.email && <span className="ml-2 text-xs font-normal text-ink-500">(tú)</span>}</p>
          <p className="text-xs text-ink-500 truncate max-w-[220px]" title={r.email}>{r.email}</p>
        </div>
      </div>
    ) },
    { key: 'role', header: 'Rol', width: 110, cell: r => <Badge tone={ROLE_TONE[r.role] || 'neutral'}>{ROLE_LABEL[r.role] || r.role}</Badge> },
    { key: 'status', header: 'Estado', width: 120, cell: r => <StatusBadge kind="expediente" status={r.status} dot /> },
    { key: 'last_login', header: 'Último ingreso', priority: 2, width: 150, sortValue: r => dateValue(r.last_login), cell: r => <span className="text-ink-500" title={fmtDateLarga(r.last_login, { hora: true })}>{fmtRelativo(r.last_login) || '—'}</span> },
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

  const esMiCuenta = editUser?.email === user?.email;

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={cargando ? 'Cargando usuarios…' : `${fmtNumero(clients.length)} clientes · ${fmtNumero(admins.length)} cuentas del equipo`}
        actions={tab === 'admins'
          ? (isAdmin && <Button icon={Plus} onClick={openCreate}>Nueva cuenta</Button>)
          : (clients.length > 0 && <Button variant="secondary" icon={Download} onClick={exportClients}>Exportar CSV</Button>)}
      />

      <Tabs
        aria-label="Tipo de usuario"
        tabs={[
          { id: 'clients', label: 'Clientes', count: clients.length },
          { id: 'admins', label: 'Equipo', count: admins.length },
        ]}
        value={tab}
        onChange={(t) => { setTab(t); setSearch(''); }}
        className="mb-4"
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar los usuarios" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <Card padding="none">
          <div className="px-(--card-pad) pt-4 pb-3 border-b border-line">
            <SearchInput value={search} onChange={setSearch} placeholder={tab === 'clients' ? 'Buscar por correo, nombre o teléfono' : 'Buscar por nombre o correo'} className="max-w-md" />
          </div>
          {tab === 'clients' ? (
            <DataTable
              columns={clientCols}
              data={filtered}
              rowKey={r => r.email}
              loading={cargando}
              onRowClick={handleViewClient}
              pageSize={25}
              aria-label="Clientes"
              emptyState={<EmptyState compact icon={UsersIcon} title={q ? 'Nadie coincide con la búsqueda' : 'Aún no hay clientes'} description={q ? 'Prueba con otro texto.' : 'Los clientes aparecen cuando compran un plan o cotizan links.'} />}
              mobileCard={r => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.name || r.email} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900 truncate">{r.name || r.email}</p>
                    <p className="text-13 text-ink-500 truncate">{r.email}</p>
                    <p className="text-xs text-ink-500 mt-1">{fmtNumero(r.total_purchases ?? 0)} {Number(r.total_purchases) === 1 ? 'compra' : 'compras'} · {fmtCLP(r.total_spent)}</p>
                  </div>
                </div>
              )}
            />
          ) : (
            <DataTable
              columns={adminCols}
              data={filtered}
              rowKey={r => r.id ?? r.email}
              loading={cargando}
              onRowClick={isAdmin ? openEdit : undefined}
              pageSize={25}
              aria-label="Equipo"
              rowActions={isAdmin ? (r) => [
                { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
                r.email !== user?.email ? { separator: true } : null,
                r.email !== user?.email ? { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDelete(r) } : null,
              ] : undefined}
              emptyState={<EmptyState compact icon={UsersIcon} title={q ? 'Nadie coincide con la búsqueda' : 'Sin cuentas del equipo'} />}
              mobileCard={r => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.name || r.email} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900 truncate">{r.name || r.email}</p>
                    <p className="text-13 text-ink-500 truncate">{r.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge tone={ROLE_TONE[r.role] || 'neutral'} size="sm">{ROLE_LABEL[r.role] || r.role}</Badge>
                      <StatusBadge kind="expediente" status={r.status} size="sm" />
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </Card>
      )}

      {/* Detalle de cliente */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || detail?.email}
        description={detail?.name ? detail.email : undefined}
        width="lg"
        footer={detail && (
          <>
            <Button variant="secondary" icon={Mail} onClick={() => { window.location.href = `mailto:${detail.email}`; }}>Escribir correo</Button>
            <Button icon={ShoppingCart} onClick={() => navigate(`/purchases?q=${encodeURIComponent(detail.email)}`)}>Ver sus compras</Button>
          </>
        )}
      >
        {detail && (
          <div className="space-y-6">
            <DescriptionList cols={3} items={[
              { label: 'Compras', value: fmtNumero(detail.total_purchases ?? 0) },
              { label: 'Total pagado', value: <Money clp={detail.total_spent} /> },
              { label: 'Teléfono', value: detail.phone || '—' },
              { label: 'Cliente desde', value: fmtDateLarga(detail.created_at || detail.first_purchase) },
              { label: 'Último ingreso', value: detail.last_login ? fmtDateLarga(detail.last_login, { hora: true }) : '—' },
              { label: 'Última compra', value: detail.last_purchase ? fmtDateLarga(detail.last_purchase) : '—' },
            ]} />

            <div>
              <h3 className="text-sm font-semibold text-ink-900 mb-2">Historial de compras</h3>
              {detail.loading ? (
                <Skeleton.TableRows rows={3} cols={4} />
              ) : Array.isArray(detail.purchases) && detail.purchases.length > 0 ? (
                <div className="border border-line rounded-lg overflow-hidden">
                  <DataTable dense pageSize={0} aria-label="Compras del cliente" columns={[
                    { key: 'date', header: 'Fecha', width: 100, sortValue: r => dateValue(r.timestamp || r.date), cell: r => <span className="text-ink-500 whitespace-nowrap">{fmtDate(r.timestamp || r.date)}</span> },
                    { key: 'desc', header: 'Detalle', cell: r => (
                      <div className="min-w-0">
                        <p className="truncate max-w-[220px]" title={r.plan_name || r.description || ''}>{r.plan_name || r.description || purchaseTypeLabel(r.type)}</p>
                        {r.order_id && <Link to={`/orders?new=${encodeURIComponent(r.order_id)}`} className="text-xs text-brand-600 hover:underline">{r.order_id}</Link>}
                      </div>
                    ) },
                    { key: 'amount', header: 'Monto', align: 'right', width: 110, sortValue: r => Number(r.amount_clp || r.amount) || 0, cell: r => <Money clp={r.amount_clp || r.amount} align="right" /> },
                    { key: 'status', header: 'Estado', width: 110, cell: r => <StatusBadge kind="compra" status={r.status} size="sm" /> },
                  ]} data={detail.purchases} rowKey={(r) => `${r.timestamp || r.date}-${r.plan_name || r.description}-${r.amount_clp || r.amount}`}
                  mobileCard={r => (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink-900 truncate">{r.plan_name || r.description || purchaseTypeLabel(r.type)}</p>
                        <p className="text-xs text-ink-500">{fmtDate(r.timestamp || r.date)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1"><Money clp={r.amount_clp || r.amount} align="right" size="sm" /><StatusBadge kind="compra" status={r.status} size="sm" /></div>
                    </div>
                  )} />
                </div>
              ) : (
                <EmptyState compact icon={ShoppingCart} title="Sin compras registradas" />
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Cuenta del equipo */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editUser ? 'Editar cuenta' : 'Nueva cuenta del equipo'}
        description={editUser ? editUser.email : 'Recibirá acceso al panel con el rol que elijas.'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editUser ? 'Guardar cambios' : 'Crear cuenta'}</Button>
          </>
        )}
      >
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required error={errors.name} autoComplete="name" />
          <Input label="Correo" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required disabled={!!editUser} error={errors.email} autoComplete="email" />
          <Input
            label={editUser ? 'Nueva contraseña' : 'Contraseña'}
            hint={editUser ? 'Déjala vacía para mantener la actual.' : 'Mínimo 8 caracteres.'}
            type="password" autoComplete="new-password"
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            required={!editUser} error={errors.password}
          />
          <Select label="Rol" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={[
            { value: 'admin', label: 'Admin · acceso total' },
            { value: 'support', label: 'Soporte · operación, sin gestión de cuentas' },
            { value: 'agent', label: 'Agente · expedientes y chat' },
          ]} disabled={esMiCuenta} hint={esMiCuenta ? 'Tu propio rol no se puede cambiar desde aquí.' : undefined} />
          <Select label="Estado" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={[
            { value: 'active', label: 'Activa' },
            { value: 'suspended', label: 'Suspendida' },
          ]} disabled={esMiCuenta} />
        </form>
      </Modal>
    </>
  );
}
