import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSecurityEvents, get2FAStatusMap, disable2FA, getAdminUsers } from '../api';
import { fmtDateTime, dateValue } from '../../shared/lib/utils';
import { PageHeader, Card, DataTable, Badge, StatusBadge, Button, Select, SearchInput, Spinner, StatTile, StatGrid, Tabs, ErrorState, EmptyState, useConfirm } from '../../shared/components/UI';
import { RefreshCw, ShieldCheck, Shield } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

// Etiqueta legible de cada tipo de evento (api/security_alerts.php y los
// nombres que usan los avisos internos). Lo desconocido se humaniza.
const EVENT_LABEL = {
  failed_login: 'Ingreso fallido',
  login_failed: 'Ingreso fallido',
  successful_login: 'Ingreso correcto',
  login_success: 'Ingreso correcto',
  new_device_login: 'Ingreso desde un dispositivo nuevo',
  brute_force_lockout: 'IP bloqueada por intentos',
  login_blocked: 'IP bloqueada por intentos',
  '2fa_failure': 'Código 2FA incorrecto',
  '2fa_enabled': '2FA activado',
  '2fa_disabled': '2FA desactivado',
  password_changed: 'Contraseña cambiada',
  password_reset: 'Contraseña restablecida',
  password_reset_requested: 'Recuperación solicitada',
  session_revoked: 'Sesión revocada',
  logout: 'Cierre de sesión',
  malware_detected: 'Malware detectado',
};

function eventLabel(type) {
  if (!type) return '—';
  if (EVENT_LABEL[type]) return EVENT_LABEL[type];
  const s = String(type).replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ROLE_LABEL = { admin: 'Administrador', support: 'Soporte', agent: 'Agente' };

const SEVERITIES = [
  { value: '', label: 'Todas las severidades' },
  { value: 'info', label: 'Información' },
  { value: 'warning', label: 'Advertencia' },
  { value: 'critical', label: 'Crítico' },
];

export default function Security() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [tfa, setTfa] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [e, u] = await Promise.all([
          getSecurityEvents('limit=100'),
          getAdminUsers().catch(() => ({ users: [] })),
        ]);
        if (!alive) return;
        setEvents(e.events || e.items || []);
        // users_api devuelve el equipo junto con clientes derivados de compras:
        // aquí sólo interesan las cuentas del panel.
        const team = (u.items || u.users || []).filter(x => x.source === 'admin' || (!x.source && x.role !== 'user'));
        setUsers(team);
        if (team.length) {
          const st = await get2FAStatusMap(team.map(x => x.email)).catch(() => ({ status: {} }));
          if (alive) setTfa(st.status || {});
        }
        setError('');
      } catch (e) {
        if (alive) setError(e.message || 'No se pudieron cargar los eventos');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  const load = useCallback(() => { setLoading(true); setTick(t => t + 1); }, []);

  async function handle2FADisable(u) {
    const ok = await confirm({
      title: '¿Desactivar la verificación en dos pasos?',
      description: `${u.name || u.email} tendrá que configurarla de nuevo en su próximo ingreso.`,
      detail: [u.email],
      tone: 'danger',
      confirmLabel: 'Desactivar 2FA',
    });
    if (!ok) return;
    try {
      await disable2FA(u.email);
      toast?.('2FA desactivado', 'success');
      setTfa(t => ({ ...t, [u.email.toLowerCase()]: false }));
    } catch (e) { toast?.(e.message || 'No se pudo desactivar', 'error'); }
  }

  const criticals = events.filter(e => e.severity === 'critical').length;
  const warnings = events.filter(e => e.severity === 'warning').length;
  const todayStr = new Date().toDateString();
  const today = events.filter(e => new Date(String(e.created_at).replace(' ', 'T')).toDateString() === todayStr).length;

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (severityFilter && e.severity !== severityFilter) return false;
      if (q && !`${e.event_type} ${eventLabel(e.event_type)} ${e.email} ${e.details} ${e.ip_address}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, severityFilter]);

  const eventCols = [
    { key: 'event_type', header: 'Evento', cell: r => <span className="font-medium text-ink-900">{eventLabel(r.event_type)}</span> },
    { key: 'severity', header: 'Severidad', cell: r => <StatusBadge kind="evento" status={r.severity} dot />, width: 130 },
    { key: 'email', header: 'Cuenta', cell: r => r.email || <span className="text-ink-400">—</span> },
    { key: 'ip_address', header: 'IP', mono: true, priority: 2 },
    { key: 'details', header: 'Detalle', priority: 2, cell: r => <span className="block max-w-[320px] truncate" title={r.details}>{r.details}</span> },
    { key: 'created_at', header: 'Fecha', sortValue: r => dateValue(r.created_at), cell: r => <span className="whitespace-nowrap tabular">{fmtDateTime(r.created_at)}</span>, width: 150 },
  ];

  const has2FA = (u) => !!tfa[(u.email || '').toLowerCase()];
  const userCols = [
    { key: 'name', header: 'Nombre', cell: r => <span className="font-medium text-ink-900">{r.name || '—'}</span> },
    { key: 'email', header: 'Correo' },
    { key: 'role', header: 'Rol', cell: r => <Badge tone="info">{ROLE_LABEL[r.role] || r.role}</Badge>, priority: 2 },
    { key: '2fa', header: 'Verificación en dos pasos', sortValue: r => (has2FA(r) ? 1 : 0), cell: r => (
      has2FA(r) ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="neutral" dot>Inactiva</Badge>
    ) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Seguridad"
        description="Ingresos al panel, alertas y verificación en dos pasos del equipo."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={load}>Actualizar</Button>}
      />

      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : (
        <>
          <StatGrid cols={3} className="mb-6">
            <StatTile label="Eventos de hoy" value={today} hint="Últimas 24 horas" />
            <StatTile label="Alertas críticas" value={criticals} tone={criticals ? 'danger' : undefined} hint="Últimos 100 eventos" />
            <StatTile label="Advertencias" value={warnings} tone={warnings ? 'warning' : undefined} hint="Últimos 100 eventos" />
          </StatGrid>

          <Tabs
            tabs={[
              { id: 'events', label: 'Eventos', count: events.length },
              { id: '2fa', label: 'Verificación en dos pasos', count: users.length },
            ]}
            value={tab}
            onChange={setTab}
            className="mb-4"
            aria-label="Secciones de seguridad"
          />

          {tab === 'events' && (
            <Card padding="none" role="tabpanel">
              <div className="flex flex-col sm:flex-row gap-3 px-(--card-pad) py-3 border-b border-line">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar por evento, cuenta, IP o detalle" className="flex-1" />
                <Select aria-label="Filtrar por severidad" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} options={SEVERITIES} className="w-full sm:w-56" />
              </div>
              <DataTable
                columns={eventCols}
                data={filteredEvents}
                rowKey={r => r.id ?? `${r.event_type}-${r.created_at}-${r.ip_address}`}
                pageSize={25}
                aria-label="Eventos de seguridad"
                emptyState={<EmptyState compact icon={ShieldCheck} title="Sin eventos de seguridad" description={search || severityFilter ? 'Prueba con otro filtro.' : 'Aquí aparecen los ingresos, los intentos fallidos y las alertas.'} />}
                mobileCard={r => (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{eventLabel(r.event_type)}</p>
                      <p className="text-13 text-ink-500 truncate">{r.email || '—'} · <span className="font-mono">{r.ip_address}</span></p>
                      {r.details && <p className="text-13 text-ink-700 mt-1">{r.details}</p>}
                      <p className="text-xs text-ink-500 mt-1 tabular">{fmtDateTime(r.created_at)}</p>
                    </div>
                    <StatusBadge kind="evento" status={r.severity} dot />
                  </div>
                )}
              />
              <p className="px-(--card-pad) py-3 text-xs text-ink-500 border-t border-line">Se muestran los últimos 100 eventos.</p>
            </Card>
          )}

          {tab === '2fa' && (
            <Card padding="none" role="tabpanel">
              <Card.Header title="Cuentas del equipo" description="Quién tiene activada la verificación en dos pasos. Cada persona la activa desde su cuenta." />
              <DataTable
                columns={userCols}
                data={users}
                rowKey={r => r.id ?? r.email}
                aria-label="Verificación en dos pasos del equipo"
                emptyMsg="Sin cuentas del equipo"
                rowActions={r => (has2FA(r) ? [{ label: 'Desactivar 2FA', icon: Shield, tone: 'danger', onClick: () => handle2FADisable(r) }] : [])}
                mobileCard={r => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 truncate">{r.name || r.email}</p>
                      <p className="text-13 text-ink-500 truncate">{r.email} · {ROLE_LABEL[r.role] || r.role}</p>
                    </div>
                    {has2FA(r) ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="neutral" dot>Inactiva</Badge>}
                  </div>
                )}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}
