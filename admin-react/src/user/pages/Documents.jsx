import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyOrders, getMyFiles, getMyReports } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { Card, Badge, Button } from '../../shared/components/UI';
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
  const [sort, setSort] = useState('recent');
  const [lightbox, setLightbox] = useState(null); // { list: string[], index: number } | null

  const loadDocuments = useCallback(async () => {
    try {
      const [ordersRes, reportsRes] = await Promise.all([
        getMyOrders().catch(() => ({ orders: [] })),
        getMyReports().catch(() => ({ reports: [] })),
      ]);

      const orders = ordersRes?.orders || ordersRes?.data || [];
      const reports = reportsRes?.reports || [];

      const filesPromises = orders.map(async (order) => {
        try {
          const data = await getMyFiles(order.id);
          const files = data?.files || data?.data || [];
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
    } catch {
      toast?.('Error al cargar documentos', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Filtered + searched + sorted docs
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
    const out = [...docs];
    out.sort((a, b) => {
      if (sort === 'name') return (a.original_name || '').localeCompare(b.original_name || '');
      if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      // recent (default)
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return out;
  }, [allDocs, filter, search, sort]);

  const counts = useMemo(() => {
    const c = { all: allDocs.length, document: 0, image: 0, video: 0, report: 0, other: 0 };
    allDocs.forEach(d => { if (c[d._category] !== undefined) c[d._category]++; else c.other++; });
    return c;
  }, [allDocs]);

  // Build a list of image URLs from the currently filtered docs to power
  // the lightbox prev/next navigation
  const filteredImages = useMemo(
    () => filteredDocs.filter(d => d._category === 'image' && d.download_url).map(d => d.download_url),
    [filteredDocs]
  );

  function openLightboxAt(url) {
    const list = filteredImages.length > 0 ? filteredImages : [url];
    const idx = list.indexOf(url);
    setLightbox({ list, index: idx >= 0 ? idx : 0 });
  }

  function lightboxNav(dir) {
    setLightbox(lb => {
      if (!lb || !lb.list || lb.list.length === 0) return lb;
      const next = (lb.index + dir + lb.list.length) % lb.list.length;
      return { ...lb, index: next };
    });
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e) {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') lightboxNav(1);
      else if (e.key === 'ArrowLeft') lightboxNav(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const filtersActive = filter !== 'all' || !!search.trim() || sort !== 'recent';

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {counts.all > 0 ? `${counts.all} archivo${counts.all > 1 ? 's' : ''} disponible${counts.all > 1 ? 's' : ''}` : 'Aun sin archivos'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Documentos</h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Todos tus archivos, reportes, fotos y videos en un solo lugar. Lo que tu agente suba a cualquier expediente aparece automaticamente aqui.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setLoading(true); loadDocuments(); }} className="bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center gap-1.5">
              <svg className={cn('w-4 h-4', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Stat tiles - clickeables como filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
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

      {/* Toolbar */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[220px] relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, expediente, descripcion..."
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label="Limpiar">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white w-44"
              title="Ordenar"
            >
              <option value="recent">Mas recientes</option>
              <option value="oldest">Mas antiguos</option>
              <option value="name">Por nombre A-Z</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {[
              { v: 'all', label: 'Todos', count: counts.all },
              { v: 'document', label: 'Documentos', count: counts.document },
              { v: 'image', label: 'Imagenes', count: counts.image },
              { v: 'video', label: 'Videos', count: counts.video },
              { v: 'report', label: 'Reportes', count: counts.report },
            ].map(t => (
              <button
                key={t.v}
                onClick={() => setFilter(t.v)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
                  filter === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                )}
              >
                {t.label}
                <span className={cn('text-[10px] tabular-nums', filter === t.v ? 'text-white/80' : 'text-slate-400')}>{t.count}</span>
              </button>
            ))}
            {filtersActive && (
              <button
                onClick={() => { setFilter('all'); setSearch(''); setSort('recent'); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-400 hover:text-slate-700"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
                Limpiar
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-400">
              Mostrando <strong className="text-slate-700 tabular-nums">{filteredDocs.length}</strong> de {counts.all}
            </span>
          </div>
        </div>
      </Card>

      {/* Documents grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </div>
          <p className="text-slate-700 font-semibold">
            {allDocs.length === 0 ? 'No tenes documentos todavia' : 'Sin coincidencias'}
          </p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            {allDocs.length === 0
              ? 'Cuando tu agente suba archivos a tus expedientes apareceran aqui automaticamente.'
              : 'Probá ajustar los filtros o limpiar la busqueda.'}
          </p>
          {allDocs.length === 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 mt-6 max-w-md mx-auto">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <svg className="w-6 h-6 text-blue-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  <p className="text-[11px] font-semibold text-blue-700">PDFs y docs</p>
                  <p className="text-[10px] text-blue-500">Contratos, facturas</p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <svg className="w-6 h-6 text-violet-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <p className="text-[11px] font-semibold text-violet-700">Imagenes</p>
                  <p className="text-[10px] text-violet-500">Fotos de inspecciones</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <svg className="w-6 h-6 text-red-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  <p className="text-[11px] font-semibold text-red-700">Videos</p>
                  <p className="text-[10px] text-red-500">Test drives, recorridos</p>
                </div>
              </div>
              <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                Contactar Soporte
              </a>
            </>
          ) : (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setFilter('all'); setSearch(''); setSort('recent'); }}>
              Limpiar filtros
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map(file => (
            <FileCard key={file.id} file={file} onPreview={openLightboxAt} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && lightbox.list && lightbox.list.length > 0 && (
        <div className="fixed inset-0 z-[10001] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img
            src={lightbox.list[lightbox.index]}
            alt=""
            className="max-w-full max-h-[88vh] rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          {lightbox.list.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
                onClick={(e) => { e.stopPropagation(); lightboxNav(-1); }}
                aria-label="Anterior"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
                onClick={(e) => { e.stopPropagation(); lightboxNav(1); }}
                aria-label="Siguiente"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                {lightbox.index + 1} / {lightbox.list.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
