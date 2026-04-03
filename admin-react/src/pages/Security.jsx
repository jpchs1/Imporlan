import { useState, useEffect } from 'react';
import { getSecurityEvents, get2FAStatus, disable2FA, getAdminUsers } from '../lib/api';
import { fmtDateTime, statusColor } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Button, Input, Select, Spinner, StatCard } from '../components/UI';

export default function Security() {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [e, u] = await Promise.all([
        getSecurityEvents(),
        getAdminUsers().catch(() => ({ items: [] })),
      ]);
      setEvents(e.items || e.events || []);
      setUsers(u.items || u.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handle2FADisable(email) {
    if (!confirm(`Desactivar 2FA para ${email}?`)) return;
    try { await disable2FA(email); alert('2FA desactivado'); } catch (e) { alert(e.message); }
  }

  const criticals = events.filter(e => e.severity === 'critical').length;
  const warnings = events.filter(e => e.severity === 'warning').length;
  const today = events.filter(e => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const filteredEvents = events.filter(e => {
    if (severityFilter && e.severity !== severityFilter) return false;
    if (search && !(e.event_type + ' ' + e.email + ' ' + e.details + ' ' + e.ip_address).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const eventCols = [
    { header: 'Tipo', cell: r => <Badge className={statusColor(r.severity)}>{r.event_type}</Badge> },
    { header: 'Severidad', cell: r => <Badge className={statusColor(r.severity)}>{r.severity}</Badge> },
    { header: 'Email', key: 'email' },
    { header: 'IP', cell: r => <span className="font-mono text-xs">{r.ip_address}</span> },
    { header: 'Detalles', cell: r => <span className="max-w-[200px] truncate block text-xs">{r.details}</span> },
    { header: 'Fecha', cell: r => fmtDateTime(r.created_at) },
  ];

  const userCols = [
    { header: 'Nombre', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Rol', cell: r => <Badge className="bg-blue-50 text-blue-700">{r.role}</Badge> },
    { header: '2FA', cell: r => <Badge className={r.two_factor_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>{r.two_factor_enabled ? 'Activo' : 'Inactivo'}</Badge> },
    { header: 'Acciones', cell: r => r.two_factor_enabled ? (
      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handle2FADisable(r.email)}>Desactivar 2FA</Button>
    ) : <span className="text-xs text-slate-400">-</span> },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Seguridad" subtitle="Eventos de seguridad y gestion 2FA" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Eventos hoy" value={today} color="blue" />
        <StatCard label="Alertas criticas" value={criticals} color="red" />
        <StatCard label="Advertencias" value={warnings} color="yellow" />
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'events' ? 'primary' : 'secondary'} onClick={() => setTab('events')}>Eventos ({events.length})</Button>
        <Button variant={tab === '2fa' ? 'primary' : 'secondary'} onClick={() => setTab('2fa')}>Gestion 2FA</Button>
      </div>

      {tab === 'events' && (
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Input placeholder="Buscar por tipo, email o IP..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            <Select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} options={[
              { value: '', label: 'Todas las severidades' },
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]} className="w-48" />
          </div>
          <Table columns={eventCols} data={filteredEvents} emptyMsg="Sin eventos de seguridad" />
        </Card>
      )}

      {tab === '2fa' && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Usuarios administradores - Estado 2FA</h3>
          <Table columns={userCols} data={users} emptyMsg="Sin usuarios administradores" />
        </Card>
      )}
    </>
  );
}
