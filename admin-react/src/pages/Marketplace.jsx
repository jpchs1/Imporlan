import { useState, useEffect } from 'react';
import { getMarketplaceListings } from '../lib/api';
import { fmtCLP, fmtDate, statusColor } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Input, Select, Spinner, StatCard } from '../components/UI';

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    getMarketplaceListings()
      .then(res => setItems(res.items || res.listings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = items.filter(i => i.status === 'active' || i.status === 'published').length;
  const sold = items.filter(i => i.status === 'sold').length;
  const types = [...new Set(items.map(i => i.listing_type || i.type).filter(Boolean))];
  const statuses = [...new Set(items.map(i => i.status).filter(Boolean))];

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (typeFilter && (i.listing_type || i.type) !== typeFilter) return false;
    if (search && !(
      (i.title || '') + ' ' + (i.brand || '') + ' ' + (i.model || '') + ' ' + (i.user_email || '') + ' ' + (i.seller_name || '')
    ).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { header: 'ID', cell: r => <span className="font-mono text-xs text-slate-400">#{r.id}</span> },
    { header: 'Titulo', cell: r => (
      <div className="flex items-center gap-3">
        {r.main_photo && (
          <img src={r.main_photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
        )}
        <div className="min-w-0">
          <p className="font-medium text-slate-700 truncate max-w-[200px]">{r.title || `${r.brand || ''} ${r.model || ''}`.trim() || '-'}</p>
          <p className="text-xs text-slate-400">{r.brand} {r.model} {r.year ? `(${r.year})` : ''}</p>
        </div>
      </div>
    )},
    { header: 'Tipo', cell: r => <Badge className="bg-indigo-50 text-indigo-600">{r.listing_type || r.type || '-'}</Badge> },
    { header: 'Vendedor', cell: r => (
      <div>
        <p className="text-sm">{r.seller_name || r.user_name || '-'}</p>
        <p className="text-xs text-slate-400">{r.user_email || ''}</p>
      </div>
    )},
    { header: 'Precio', cell: r => (
      <span className="font-semibold tabular-nums">
        {r.price ? (r.currency === 'USD' ? `US$${Number(r.price).toLocaleString()}` : fmtCLP(r.price)) : '-'}
      </span>
    )},
    { header: 'Ubicacion', cell: r => r.location || r.city || '-' },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status}</Badge> },
    { header: 'Publicado', cell: r => fmtDate(r.created_at) },
    { header: 'Vistas', cell: r => <span className="tabular-nums text-slate-500">{r.views || 0}</span> },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Marketplace" subtitle={`${items.length} publicaciones`} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total publicaciones" value={items.length} color="blue" />
        <StatCard label="Activas" value={active} color="green" />
        <StatCard label="Vendidas" value={sold} color="purple" />
        <StatCard label="Total vistas" value={items.reduce((s, i) => s + (i.views || 0), 0)} color="cyan" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Buscar por titulo, marca, modelo o vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[
            { value: '', label: 'Todos los tipos' },
            ...types.map(t => ({ value: t, label: t })),
          ]} className="w-44" />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
            { value: '', label: 'Todos los estados' },
            ...statuses.map(s => ({ value: s, label: s })),
          ]} className="w-44" />
        </div>
        <Table columns={columns} data={filtered} emptyMsg="Sin publicaciones en el marketplace" />
      </Card>
    </>
  );
}
