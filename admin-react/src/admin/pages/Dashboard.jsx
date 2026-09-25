import { useState, useEffect, useCallback } from 'react';
import { getDashboard } from '../api';
import { fmtCLP, fmtDate, statusColor, statusLabel, purchaseTypeLabel, paymentMethodLabel } from '../../shared/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Card, StatCard, PageHeader, Spinner, Badge, Table, Button } from '../../shared/components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>{p.value}</p>
      ))}
    </div>
  );
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(() => {
    getDashboard()
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message || 'No se pudo cargar el dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const retry = () => { setLoading(true); setError(null); fetchDashboard(); };

  if (loading) return <Spinner />;
  // Decir que fallo, y no solo que fallo: un "Error cargando dashboard" a secas
  // no distingue una sesion vencida de un servidor caido ni deja reintentar.
  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Resumen general del sistema" />
        <Card className="max-w-lg">
          <h3 className="font-bold text-slate-800 mb-1">No se pudo cargar el dashboard</h3>
          <p className="text-sm text-slate-500 mb-4">{error || 'El servidor no devolvio datos.'}</p>
          <Button variant="secondary" size="sm" onClick={retry}>Reintentar</Button>
        </Card>
      </>
    );
  }

  const statusData = (data.submissions_by_status || []).map(s => ({ name: statusLabel(s.status), value: s.count }));
  const paymentData = (data.payments_by_provider || []).map(p => ({ name: paymentMethodLabel(p.provider), value: p.count }));
  const revenueData = (data.revenue_by_month || []).map(m => ({ name: MONTHS[Number(m.month.slice(5, 7)) - 1] || m.month, value: m.amount }));

  const activityCols = [
    { header: 'Fecha', cell: r => <span className="text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</span> },
    { header: 'Email', cell: r => <span className="font-medium text-slate-700">{r.user_email}</span> },
    { header: 'Tipo', cell: r => <Badge className="bg-indigo-50 text-indigo-600">{purchaseTypeLabel(r.type)}</Badge> },
    { header: 'Detalle', cell: r => <span className="max-w-[200px] truncate block" title={r.description}>{r.description || '-'}</span> },
    { header: 'Monto', cell: r => <span className="font-semibold tabular-nums">{fmtCLP(r.amount)}</span> },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen general del sistema" action={<Button variant="secondary" size="sm" onClick={retry}>Actualizar</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Ingresos del mes" value={fmtCLP(data.revenue_month ?? 0)} color="green" />
        <StatCard label="Ingresos totales" value={fmtCLP(data.total_revenue)} color="blue" />
        <StatCard label="Planes activos" value={data.active_plans ?? 0} color="purple" />
        <StatCard label="Compras pendientes de pago" value={data.pending_submissions} color="yellow" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Clientes" value={data.total_users} color="cyan" />
        <StatCard label="Clientes nuevos (7 días)" value={data.new_users_7d ?? 0} color="indigo" />
        <StatCard label="Compras totales" value={data.total_submissions} color="slate" />
      </div>

      {revenueData.length > 0 && (
        <Card className="card-hover mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Ingresos por mes</h3>
            <span className="text-xs text-slate-400 font-medium">últimos 6 meses · sólo pagos recibidos</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v)} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={v => fmtCLP(v)} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#revGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="card-hover">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Compras por estado</h3>
            <span className="text-xs text-slate-400 font-medium">{statusData.length} estados</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  strokeWidth={0}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="card-hover">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Metodos de pago</h3>
            <span className="text-xs text-slate-400 font-medium">{paymentData.length} metodos</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="card-hover">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Actividad reciente</h3>
          <Badge className="bg-indigo-50 text-indigo-600">{(data.recent_activity || []).length} registros</Badge>
        </div>
        <Table columns={activityCols} data={data.recent_activity || []} pageSize={0} onRowClick={() => navigate('/purchases')} />
      </Card>
    </>
  );
}
