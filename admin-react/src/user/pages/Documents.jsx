import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyOrders, getMyFiles, getMyReports } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const CATEGORIES = {
  all:      { label: 'Todos',       color: 'slate' },
  document: { label: 'Documentos',  color: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  image:    { label: 'Imagenes',    color: 'violet',  bg: 'bg-violet-50',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700' },
  video:    { label: 'Videos',      color: 'red',     bg: 'bg-red-50',     text: 'text-red-600',     badge: 'bg-red-100 text-red-700' },
  report:   { label: 'Reportes',    color: 'cyan',    bg: 'bg-cyan-50',    text: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700' },
  other:    { label: 'Otros',       color: 'slate',   bg: 'bg-slate-50',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-700' },
};

function StatCard({ label, count, icon, color, active, onClick }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-300' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-300' },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    ring: 'ring-red-300' },
    cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   ring: 'ring-cyan-300' },
    slate:  { bg: 'bg-slate-50',  text: 'text-slate-600',  ring: 'ring-slate-300' },
  };
  const c = colors[color] || colors.slate;
  return (
    <Card
      className={cn('cursor-pointer card-hover', active && `ring-2 ${c.ring}`)}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', c.bg)}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{count}</p>
          <p className="text-xs text-slate-400 font-medium">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function FileCard({ file, onPreview }) {
  const cat = CATEGORIES[file._category] || CATEGORIES.other;
  const isPreviewable = file._category === 'image' || file.mime_type === 'application/pdf' || file._category === 'video';
  const isImage = file._category === 'image';

  return (
    <Card className="card-hover overflow-hidden group p-0">
      {/* Image preview */}
      {isImage && file.download_url && (
        <div
          className="h-36 overflow-hidden cursor-pointer relative bg-slate-100"
          onClick={() => onPreview(file.download_url)}
        >
          <img
            src={file.download_url}
            alt={file.original_name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1 rounded-full">Ver imagen</span>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', cat.bg)}>
            <span className={cn('text-[10px] font-bold', cat.text)}>
              {file._category === 'image' ? 'IMG' : file._category === 'video' ? 'VID' : file._category === 'report' ? 'RPT' : 'DOC'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate" title={file.original_name}>
              {file.original_name}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-400">
              <Badge className={cat.badge}>{cat.label}</Badge>
              {file.file_size_formatted && <span>{file.file_size_formatted}</span>}
              {file.created_at && <span>{fmtDate(file.created_at)}</span>}
            </div>
            {file._orderNumber && (
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                #{file._orderNumber}{file._orderName ? ` - ${file._orderName}` : ''}
              </p>
            )}
            {file.description && (
              <p className="text-[11px] text-slate-400 italic mt-1 truncate">{file.description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          {isPreviewable && file.download_url && (
            <a
              href={file.download_url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition"
            >
              Ver
            </a>
          )}
          {file.download_url && (
            <a
              href={file.download_url}
              download={file.original_name}
              className="flex-1 text-center px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-medium hover:bg-cyan-100 transition border border-cyan-200"
            >
              Descargar
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Documents() {
  const toast = useToast();
  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      // Fetch orders and reports in parallel
      const [ordersRes, reportsRes] = await Promise.all([
        getMyOrders().catch(() => ({ orders: [] })),
        getMyReports().catch(() => ({ reports: [] })),
      ]);

      const orders = ordersRes.success && ordersRes.orders ? ordersRes.orders : [];
      const reports = reportsRes.reports || [];

      // Fetch files for each order in parallel
      const filesPromises = orders.map(async (order) => {
        try {
          const data = await getMyFiles(order.id);
          const files = data.success && data.files ? data.files : [];
          return files.map(f => ({
            ...f,
            _category: f.category || 'other',
            _orderNumber: order.order_number,
            _orderName: order.plan_name || order.asset_name || '',
          }));
        } catch { return []; }
      });

      const filesArrays = await Promise.all(filesPromises);
      const allFiles = filesArrays.flat();

      // Add reports as documents
      const reportDocs = reports.map(r => ({
        id: `report-${r.id}`,
        original_name: `Reporte v${r.version || 1} - ${r.order_number || ''}`,
        mime_type: 'application/pdf',
        file_size_formatted: '',
        created_at: r.created_at,
        download_url: r.download_url || r.view_url || '',
        description: r.plan_type ? `Plan: ${r.plan_type}` : '',
        _category: 'report',
        _orderNumber: r.order_number || '',
        _orderName: r.customer_name || '',
      }));

      setAllDocs([...allFiles, ...reportDocs]);
    } catch (e) {
      toast?.('Error al cargar documentos', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Filtered + searched docs
  const filteredDocs = useMemo(() => {
    let docs = allDocs;
    if (filter !== 'all') {
      docs = docs.filter(d => d._category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      docs = docs.filter(d =>
        (d.original_name || '').toLowerCase().includes(q) ||
        (d._orderNumber || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
    }
    return docs;
  }, [allDocs, filter, search]);

  // Counts
  const counts = useMemo(() => {
    const c = { all: allDocs.length, document: 0, image: 0, video: 0, report: 0, other: 0 };
    allDocs.forEach(d => { if (c[d._category] !== undefined) c[d._category]++; else c.other++; });
    return c;
  }, [allDocs]);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Todos tus archivos, reportes y documentos en un solo lugar"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard
          label="Documentos" count={counts.document} color="blue" active={filter === 'document'}
          onClick={() => setFilter(filter === 'document' ? 'all' : 'document')}
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>}
        />
        <StatCard
          label="Imagenes" count={counts.image} color="violet" active={filter === 'image'}
          onClick={() => setFilter(filter === 'image' ? 'all' : 'image')}
          icon={<svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
        />
        <StatCard
          label="Videos" count={counts.video} color="red" active={filter === 'video'}
          onClick={() => setFilter(filter === 'video' ? 'all' : 'video')}
          icon={<svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
        />
        <StatCard
          label="Reportes" count={counts.report} color="cyan" active={filter === 'report'}
          onClick={() => setFilter(filter === 'report' ? 'all' : 'report')}
          icon={<svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
        />
        <StatCard
          label="Total" count={counts.all} color="slate" active={filter === 'all'}
          onClick={() => setFilter('all')}
          icon={<svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
        />
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition-all bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Documents grid */}
      {filteredDocs.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          <p className="text-slate-500 font-medium">
            {allDocs.length === 0 ? 'No tienes documentos todavia' : 'No se encontraron documentos'}
          </p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {allDocs.length === 0
              ? <>Cuando tu agente suba archivos a tus expedientes, apareceran aqui. Si tienes dudas, contactanos por <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-cyan-600 underline">WhatsApp</a>.</>
              : 'Intenta con otro termino de busqueda o filtro.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map(file => (
            <FileCard key={file.id} file={file} onPreview={setLightbox} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition" onClick={() => setLightbox(null)}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
