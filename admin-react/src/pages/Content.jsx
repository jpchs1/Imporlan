import { useState, useEffect } from 'react';
import { getContentPages } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Spinner, Input } from '../components/UI';

export default function Content() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getContentPages()
      .then(res => setPages(res.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = pages.filter(p =>
    !search || (p.title + ' ' + p.slug + ' ' + p.category).toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'Titulo', key: 'title' },
    { header: 'Slug', cell: r => <span className="font-mono text-xs text-slate-500">{r.slug}</span> },
    { header: 'Categoria', cell: r => <Badge className="bg-blue-50 text-blue-700">{r.category || '-'}</Badge> },
    { header: 'Estado', cell: r => <Badge className={r.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{r.published ? 'Publicado' : 'Borrador'}</Badge> },
    { header: 'Actualizado', cell: r => fmtDate(r.updated_at) },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Contenido" subtitle={`${pages.length} paginas`} />
      <Card>
        <Input placeholder="Buscar por titulo, slug o categoria..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
        {pages.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
            </svg>
            <p className="font-medium">Sin contenido registrado</p>
            <p className="text-sm mt-1">Las paginas del sitio se gestionan directamente en los archivos HTML</p>
          </div>
        ) : (
          <Table columns={columns} data={filtered} />
        )}
      </Card>
    </>
  );
}
