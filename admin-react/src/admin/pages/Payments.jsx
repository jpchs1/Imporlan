import { useState, useEffect, useCallback } from 'react';
import { getPurchases } from '../api';
import { fmtCLP, fmtDate, statusColor, statusLabel, paymentMethodLabel, downloadCSV, PAID_STATUSES } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, StatCard, Input, Select, Spinner, Button, ErrorState } from '../../shared/components/UI';

export default function Payments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getPurchases()
      // Pagos = compras con dinero recibido. "Vencido" cuenta: es un plan que se
      // pagó y ya cerró; sacarlo haría bajar los ingresos solos con el tiempo.
      .then(res => setItems((res.items || []).filter(i => PAID_STATUSES.includes(i.status))))
      .catch(e => setError(e.message || 'No se pudieron cargar los pagos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = items.reduce((s, i) => s + (i.amount_clp || 0), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
  const monthRevenue = items.filter(i => (i.sort_time || 0) >= monthStart).reduce((s, i) => s + (i.amount_clp || 0), 0);
  const methods = [...new Set(items.map(i => i.payment_method).filter(Boolean))];

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (methodFilter && i.payment_method !== methodFilter) return false;
    if (q && !`${i.user_email} ${i.payment_id || ''} ${i.purchase_id} ${i.description} ${i.plan_name}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const filteredTotal = filtered.reduce((s, i) => s + (i.amount_clp || 0), 0);

  const columns = [
    { header: 'Fecha', sortValue: r => r.sort_time || 0, cell: r => fmtDate(r.created_at) },
    { header: 'Email', key: 'user_email' },
    { header: 'Descripción', cell: r => r.plan_name || r.description || '-' },
    { header: 'Monto', sortValue: r => r.amount_clp || 0, cell: r => <span className="font-semibold tabular-nums">{fmtCLP(r.amount_clp)}</span> },
    { header: 'Medio', key: 'payment_method', cell: r => <Badge className="bg-blue-50 text-blue-700">{paymentMethodLabel(r.payment_method)}</Badge> },
    { header: 'ID pago', cell: r => <span className="font-mono text-xs" title={r.payment_id || ''}>{(r.payment_id || '-').slice(0, 15)}</span> },
    { header: 'Estado', key: 'status', cell: r => <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge> },
  ];

  function exportCSV() {
    downloadCSV(`pagos-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'Fecha', value: r => r.created_at },
      { header: 'Email', value: r => r.user_email },
      { header: 'Descripción', value: r => r.plan_name || r.description },
      { header: 'Monto CLP', value: r => r.amount_clp },
      { header: 'Medio', value: r => paymentMethodLabel(r.payment_method) },
      { header: 'ID pago', value: r => r.payment_id },
      { header: 'ID compra', value: r => r.purchase_id },
      { header: 'Estado', value: r => statusLabel(r.status) },
    ], filtered);
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Pagos" subtitle="Compras con pago recibido"
        action={items.length > 0 && <Button variant="secondary" onClick={exportCSV}>Exportar CSV</Button>} />

      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Pagos recibidos" value={items.length} color="green" />
            <StatCard label="Ingresos totales" value={fmtCLP(totalRevenue)} color="blue" />
            <StatCard label="Ingresos del mes" value={fmtCLP(monthRevenue)} color="cyan" />
          </div>

          <Card>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input placeholder="Buscar por email, ID de pago o compra..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
              <Select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} options={[
                { value: '', label: 'Todos los medios' },
                ...methods.map(m => ({ value: m, label: paymentMethodLabel(m) })),
              ]} className="w-full sm:w-48" />
            </div>
            {(q || methodFilter) && (
              <p className="text-xs text-slate-500 mb-3">{filtered.length} pagos · {fmtCLP(filteredTotal)}</p>
            )}
            <Table columns={columns} data={filtered} emptyMsg="Sin pagos para mostrar" />
          </Card>
        </>
      )}
    </>
  );
}
