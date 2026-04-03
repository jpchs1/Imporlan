import { useState, useEffect } from 'react';
import { getInspections } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Input, Spinner } from '../components/UI';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getInspections()
      .then(res => setItems(res.items || res.leads || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i =>
    !search || (i.full_name + ' ' + i.email + ' ' + i.brand + ' ' + i.model + ' ' + i.vessel_type).toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'ID', cell: r => <span className="font-mono text-xs">#{r.id}</span> },
    { header: 'Nombre', key: 'full_name' },
    { header: 'Email', key: 'email' },
    { header: 'Telefono', key: 'phone' },
    { header: 'Pais', cell: r => <Badge className="bg-blue-50 text-blue-700">{r.country === 'cl' ? 'Chile' : r.country === 'us' ? 'USA' : r.country}</Badge> },
    { header: 'Embarcacion', cell: r => `${r.vessel_type || ''} ${r.brand || ''} ${r.model || ''}`.trim() || '-' },
    { header: 'Eslora', cell: r => r.length_value ? `${r.length_value} ${r.length_unit || 'pies'}` : '-' },
    { header: 'Precio pub.', cell: r => r.published_price ? `${r.price_currency || ''} ${r.published_price}` : '-' },
    { header: 'Fecha', cell: r => fmtDate(r.created_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Inspecciones" subtitle={`${items.length} solicitudes de inspeccion`} />
      <Card>
        <Input placeholder="Buscar por nombre, email, marca o modelo..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="font-medium">Sin solicitudes de inspeccion</p>
            <p className="text-sm mt-1">Las solicitudes apareceran aqui cuando los usuarios las envien desde el sitio</p>
          </div>
        ) : (
          <Table columns={columns} data={filtered} />
        )}
      </Card>
    </>
  );
}
