import { useState, useEffect } from 'react';
import { getDashboard } from '../lib/api';
import { fmtCLP, fmtDate, statusColor } from '../lib/utils';
import { Card, StatCard, PageHeader, Spinner, Badge, Table } from '../components/UI';
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-slate-500">Error cargando dashboard</p>;

  const statusData = (data.submissions_by_status || []).map(s => ({ name: s.status, value: s.count }));
  const paymentData = (data.payments_by_provider || []).map(p => ({ name: p.provider, value: p.count }));

  const activityCols = [
    { header: 'Email', cell: r => <span className="font-medium text-slate-700">{r.user_email}</span> },
    { header: 'Tipo', cell: r => <Badge className="bg-indigo-50 text-indigo-600">{r.type}</Badge> },
    { header: 'Monto', cell: r => <span className="font-semibold tabular-nums">{fmtCLP(r.amount)}</span> },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen general del sistema" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Usuarios" value={data.total_users} color="blue" />
        <StatCard label="Compras totales" value={data.total_submissions} color="cyan" />
        <StatCard label="Ingresos totales" value={fmtCLP(data.total_revenue)} color="green" />
        <StatCard label="Pendientes" value={data.pending_submissions} color="yellow" />
      </div>

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
        <Table columns={activityCols} data={data.recent_activity || []} />
      </Card>
    </>
  );
}
