import { useState, useEffect } from 'react';
import { getPurchases } from '../api';
import { fmtCLP, fmtDate, statusColor } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, StatCard, Input, Select, Spinner } from '../../shared/components/UI';

export default function Payments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  useEffect(() => {
    getPurchases()
      .then(res => setItems((res.items || []).filter(i => i.status === 'paid' || i.status === 'active' || i.status === 'completed' || i.payment_id)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalPaid = items.filter(i => ['paid', 'active', 'completed'].includes(i.status));
  const totalRevenue = totalPaid.reduce((s, i) => s + (i.amount_clp || 0), 0);
  const methods = [...new Set(items.map(i => i.payment_method).filter(Boolean))];

  const filtered = items.filter(i => {
    if (methodFilter && i.payment_method !== methodFilter) return false;
    if (search && !(i.user_email + ' ' + i.payment_id + ' ' + i.description).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { header: 'Email', key: 'user_email' },
    { header: 'Descripcion', cell: r => r.description || r.plan_name || '-' },
    { header: 'Monto', cell: r => <span className="font-semibold">{fmtCLP(r.amount_clp)}</span> },
    { header: 'Metodo', cell: r => <Badge className="bg-blue-50 text-blue-700">{r.payment_method || '-'}</Badge> },
    { header: 'ID Pago', cell: r => <span className="font-mono text-xs">{(r.payment_id || '-').slice(0, 15)}</span> },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
    { header: 'Fecha', cell: r => fmtDate(r.created_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Pagos" subtitle="Historial de pagos procesados" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pagos completados" value={totalPaid.length} color="green" />
        <StatCard label="Ingresos totales" value={fmtCLP(totalRevenue)} color="blue" />
        <StatCard label="Metodos de pago" value={methods.length} color="cyan" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Buscar por email, ID de pago..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} options={[
            { value: '', label: 'Todos los metodos' },
            ...methods.map(m => ({ value: m, label: m })),
          ]} className="w-48" />
        </div>
        <Table columns={columns} data={filtered} />
      </Card>
    </>
  );
}
