import { useState, useEffect, useCallback } from 'react';
import { getSecurityEvents, get2FAStatusMap, disable2FA, getAdminUsers } from '../api';
import { fmtDateTime, statusColor, dateValue } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, Button, Input, Select, Spinner, StatCard, ErrorState } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const SEVERITY_LABEL = { info: 'Info', warning: 'Advertencia', critical: 'Crítica' };
const ROLE_LABEL = { admin: 'Admin', support: 'Soporte', agent: 'Agente' };

export default function Security() {
  const toast = useToast();
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [tfa, setTfa] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [e, u] = await Promise.all([
        getSecurityEvents('limit=100'),
        getAdminUsers().catch(() => ({ users: [] })),
      ]);
      setEvents(e.events || e.items || []);
      // users_api devuelve el equipo junto con clientes derivados de compras:
      // aquí sólo interesan las cuentas del panel.
      const team = (u.items || u.users || []).filter(x => x.source === 'admin' || (!x.source && x.role !== 'user'));
      setUsers(team);
      if (team.length) {
        const st = await get2FAStatusMap(team.map(x => x.email)).catch(() => ({ status: {} }));
        setTfa(st.status || {});
      }
    } catch (e) { setError(e.message || 'No se pudieron cargar los eventos'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handle2FADisable(email) {
    if (!confirm(`Desactivar el 2FA de ${email}? Deberá configurarlo de nuevo en su próximo ingreso.`)) return;
    try {
      await disable2FA(email);
      toast?.('2FA desactivado');
      setTfa(t => ({ ...t, [email.toLowerCase()]: false }));
    } catch (e) { toast?.(e.message, 'error'); }
  }

  const criticals = events.filter(e => e.severity === 'critical').length;
  const warnings = events.filter(e => e.severity === 'warning').length;
  const todayStr = new Date().toDateString();
  const today = events.filter(e => new Date(String(e.created_at).replace(' ', 'T')).toDateString() === todayStr).length;

  const q = search.trim().toLowerCase();
  const filteredEvents = events.filter(e => {
    if (severityFilter && e.severity !== severityFilter) return false;
    if (q && !`${e.event_type} ${e.email} ${e.details} ${e.ip_address}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const eventCols = [
    { header: 'Tipo', key: 'event_type', cell: r => <Badge className={statusColor(r.severity)}>{r.event_type}</Badge> },
    { header: 'Severidad', key: 'severity', cell: r => <Badge className={statusColor(r.severity)}>{SEVERITY_LABEL[r.severity] || r.severity}</Badge> },
    { header: 'Email', key: 'email' },
    { header: 'IP', key: 'ip_address', cell: r => <span className="font-mono text-xs">{r.ip_address}</span> },
    { header: 'Detalles', cell: r => <span className="max-w-[260px] truncate block text-xs" title={r.details}>{r.details}</span> },
    { header: 'Fecha', sortValue: r => dateValue(r.created_at), cell: r => fmtDateTime(r.created_at) },
  ];

  const has2FA = (u) => !!tfa[(u.email || '').toLowerCase()];
  const userCols = [
    { header: 'Nombre', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Rol', key: 'role', cell: r => <Badge className="bg-blue-50 text-blue-700">{ROLE_LABEL[r.role] || r.role}</Badge> },
    { header: '2FA', sortValue: r => (has2FA(r) ? 1 : 0), cell: r => <Badge className={has2FA(r) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>{has2FA(r) ? 'Activo' : 'Inactivo'}</Badge> },
    { header: 'Acciones', cell: r => has2FA(r) ? (
      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handle2FADisable(r.email)}>Desactivar 2FA</Button>
    ) : <span className="text-xs text-slate-400">-</span> },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Seguridad" subtitle="Eventos de seguridad y gestión 2FA" action={<Button variant="secondary" onClick={load}>Actualizar</Button>} />

      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Eventos hoy" value={today} color="blue" />
            <StatCard label="Alertas críticas" value={criticals} color="red" />
            <StatCard label="Advertencias" value={warnings} color="yellow" />
          </div>

          <div className="flex gap-2 mb-4">
            <Button variant={tab === 'events' ? 'primary' : 'secondary'} aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Eventos ({events.length})</Button>
            <Button variant={tab === '2fa' ? 'primary' : 'secondary'} aria-pressed={tab === '2fa'} onClick={() => setTab('2fa')}>Gestión 2FA</Button>
          </div>

          {tab === 'events' && (
            <Card>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Input placeholder="Buscar por tipo, email, IP o detalle..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
                <Select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} options={[
                  { value: '', label: 'Todas las severidades' },
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Advertencia' },
                  { value: 'critical', label: 'Crítica' },
                ]} className="w-full sm:w-48" />
              </div>
              <Table columns={eventCols} data={filteredEvents} emptyMsg="Sin eventos de seguridad" />
              <p className="text-xs text-slate-400 mt-3">Se muestran los últimos 100 eventos.</p>
            </Card>
          )}

          {tab === '2fa' && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Cuentas del equipo · estado 2FA</h3>
              <Table columns={userCols} data={users} emptyMsg="Sin cuentas del equipo" />
            </Card>
          )}
        </>
      )}
    </>
  );
}
