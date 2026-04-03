import { useState, useEffect } from 'react';
import { getDashboard } from '../lib/api';
import { fmtCLP } from '../lib/utils';
import { Card, StatCard, PageHeader, Spinner, Badge, Table } from '../components/UI';
import { statusColor } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
    { header: 'Email', key: 'user_email' },
    { header: 'Tipo', key: 'type' },
    { header: 'Monto', cell: r => fmtCLP(r.amount) },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen general del sistema" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Usuarios" value={data.total_users} color="blue" />
        <StatCard label="Compras totales" value={data.total_submissions} color="cyan" />
        <StatCard label="Ingresos totales" value={fmtCLP(data.total_revenue)} color="green" />
        <StatCard label="Pendientes" value={data.pending_submissions} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Compras por estado</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Metodos de pago</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">Actividad reciente</h3>
        <Table columns={activityCols} data={data.recent_activity || []} />
      </Card>
    </>
  );
}
