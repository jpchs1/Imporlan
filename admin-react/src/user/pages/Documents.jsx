import { FileImage } from '../../shared/components/FileImage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyOrders, getMyFiles, getMyReports } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { fmtBytes } from '../../shared/lib/format';
import {
  Card, Button, Badge, PageHeader, DataTable, FilterChips, SearchInput, EmptyState, ErrorState, Lightbox,
} from '../../shared/components/UI';
import { FileText, Image as ImageIcon, Video, FileCheck, File, RefreshCw, Eye, Download, ExternalLink } from '../../shared/components/Icons';

// Una fila por archivo: lo que sube el agente a cada expediente y los
// reportes comparativos. `_category` viene de la API (`category`) o es
// 'report' para los reportes.
const CATEGORIAS = {
  document: { label: 'Documentos', icon: FileText, tone: 'info' },
  image: { label: 'Imágenes', icon: ImageIcon, tone: 'brand' },
  video: { label: 'Videos', icon: Video, tone: 'neutral' },
  report: { label: 'Reportes', icon: FileCheck, tone: 'success' },
  other: { label: 'Otros', icon: File, tone: 'neutral' },
};
const ORDEN_FILTROS = ['all', 'document', 'image', 'video', 'report'];

function categoriaDe(doc) {
  return CATEGORIAS[doc._category] || CATEGORIAS.other;
}

function tamanoDe(doc) {
  if (doc.file_size) return fmtBytes(doc.file_size);
  return doc.file_size_formatted || '—';
}

function esPrevisualizable(doc) {
  return doc._category === 'image' || doc._category === 'video' || doc.mime_type === 'application/pdf' || doc._category === 'report';
}

/**
 * El archivo se sirve `inline` (api/expediente_files_api.php, `download`):
 * sin el atributo `download` el navegador lo abre en vez de guardarlo. El
 * atributo sólo vale en el mismo origen; un enlace externo (reportes
 * alojados fuera) se abre en otra pestaña, que es lo único que se puede.
 */
function esMismoOrigen(url) {
  try { return new URL(url, window.location.href).origin === window.location.origin; } catch { return false; }
}

function descargar(doc) {
  if (!doc.download_url) return;
  if (!esMismoOrigen(doc.download_url)) { window.open(doc.download_url, '_blank', 'noopener'); return; }
  const a = document.createElement('a');
  a.href = doc.download_url;
  a.download = doc.original_name || '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Celda principal: ícono (o miniatura si es foto), nombre completo y
 * descripción. En la tarjeta móvil (`completa`) el nombre no se trunca y
 * debajo va el tipo, la fecha y el tamaño. El nombre es un botón sólo cuando
 * hay algo que abrir (`onOpen`): una fila sin enlace no promete nada.
 */
function CeldaArchivo({ doc, completa = false, onOpen }) {
  const cat = categoriaDe(doc);
  const Icon = cat.icon;
  const esFoto = doc._category === 'image' && doc.download_url;
  const abrible = !!doc.download_url && !!onOpen;
  const nombreCls = cn('text-sm font-medium text-ink-900', completa ? 'break-all' : 'truncate');
  return (
    <div className="flex items-start gap-3 min-w-0">
      {esFoto ? (
        <FileImage src={doc.download_url} mimeType={doc.mime_type} originalName={doc.original_name} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover bg-neutral-bg shrink-0" />
      ) : (
        <span className="h-10 w-10 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><Icon size={18} /></span>
      )}
      <div className="min-w-0">
        {abrible ? (
          <button
            type="button"
            onClick={() => onOpen(doc)}
            title={doc.original_name}
            className={cn(nombreCls, 'block max-w-full text-left hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 rounded-sm')}
          >
            {doc.original_name}
          </button>
        ) : (
          <p className={nombreCls} title={doc.original_name}>
            {doc.original_name}
            {!doc.download_url && <span className="sr-only"> (sin enlace de descarga)</span>}
          </p>
        )}
        {doc.description && <p className={cn('text-13 text-ink-500', completa ? '' : 'truncate')} title={doc.description}>{doc.description}</p>}
        {completa && (
          <p className="text-xs text-ink-500 mt-1 tabular">
            {cat.label} · {fmtDate(doc.created_at)}{doc.file_size || doc.file_size_formatted ? ` · ${tamanoDe(doc)}` : ''}{doc._orderNumber ? ` · #${doc._orderNumber}` : ''}{!doc.download_url ? ' · Sin enlace de descarga' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Documents() {
  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null); // índice dentro de `imagenes` | null

  // Trae los documentos sin tocar el estado; quien llama decide qué hacer
  // con el resultado (el efecto de montaje y el botón Actualizar).
  const cargarDocumentos = useCallback(async () => {
    {
      const [ordersRes, reportsRes] = await Promise.all([
        getMyOrders().catch(() => ({ orders: [] })),
        getMyReports().catch(() => ({ reports: [] })),
      ]);

      const orders = ordersRes?.orders || ordersRes?.data || [];
      const reports = reportsRes?.reports || [];

      // Los archivos de todos los expedientes se piden en paralelo.
      const filesArrays = await Promise.all(orders.map(async (order) => {
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
      }));

      const reportDocs = reports.map(r => ({
        id: `report-${r.id}`,
        original_name: `Reporte v${r.version || 1} · ${r.order_number || ''}.pdf`,
        mime_type: 'application/pdf',
        file_size: null,
        file_size_formatted: '',
        created_at: r.created_at,
        download_url: r.pdf_url || r.download_url || r.view_url || '',
        description: r.plan_type ? `Plan ${r.plan_type}` : '',
        _category: 'report',
        _orderNumber: r.order_number || '',
        _orderName: r.customer_name || '',
      }));

      const docs = [...filesArrays.flat(), ...reportDocs];
      docs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return docs;
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    cargarDocumentos()
      .then(docs => { if (vivo) setAllDocs(docs); })
      .catch(e => { if (vivo) setError(e); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [cargarDocumentos]);

  function recargar() {
    setLoading(true);
    setError(null);
    cargarDocumentos().then(setAllDocs).catch(setError).finally(() => setLoading(false));
  }

  const counts = useMemo(() => {
    const c = { all: allDocs.length, document: 0, image: 0, video: 0, report: 0, other: 0 };
    allDocs.forEach(d => { if (c[d._category] !== undefined) c[d._category]++; else c.other++; });
    return c;
  }, [allDocs]);

  const filteredDocs = useMemo(() => {
    let docs = allDocs;
    if (filter !== 'all') docs = docs.filter(d => d._category === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      docs = docs.filter(d =>
        (d.original_name || '').toLowerCase().includes(q)
        || (d._orderNumber || '').toLowerCase().includes(q)
        || (d.description || '').toLowerCase().includes(q));
    }
    return docs;
  }, [allDocs, filter, search]);

  // Las fotos del listado filtrado alimentan el visor (← → navegan entre ellas).
  const imagenes = useMemo(
    () => filteredDocs.filter(d => d._category === 'image' && d.download_url),
    [filteredDocs],
  );
  const itemsLightbox = useMemo(
    () => imagenes.map(d => ({ src: d.download_url, alt: d.original_name, caption: [d.original_name, d._orderNumber && `#${d._orderNumber}`].filter(Boolean).join(' · '), downloadUrl: d.download_url })),
    [imagenes],
  );

  function abrir(doc) {
    if (!doc.download_url) return;
    if (doc._category === 'image') {
      const i = imagenes.findIndex(d => d.id === doc.id);
      setLightbox(i >= 0 ? i : 0);
      return;
    }
    window.open(doc.download_url, '_blank', 'noopener');
  }

  const filtersActive = filter !== 'all' || !!search.trim();
  function limpiar() { setFilter('all'); setSearch(''); }

  const chips = ORDEN_FILTROS.map(id => ({ id, label: id === 'all' ? 'Todos' : CATEGORIAS[id].label, count: counts[id] }));

  const columns = [
    { key: 'original_name', header: 'Archivo', cell: d => <CeldaArchivo doc={d} onOpen={abrir} />, sortValue: d => d.original_name || '' },
    { key: 'tipo', header: 'Tipo', width: 120, priority: 2, cell: d => <Badge tone={categoriaDe(d).tone}>{categoriaDe(d).label}</Badge>, sortValue: d => categoriaDe(d).label },
    { key: 'expediente', header: 'Expediente', width: 150, priority: 2, cell: d => d._orderNumber ? <span className="text-ink-900">#{d._orderNumber}</span> : <span className="text-ink-500">—</span>, sortValue: d => d._orderNumber || '' },
    { key: 'created_at', header: 'Fecha', width: 130, cell: d => <span className="tabular whitespace-nowrap">{fmtDate(d.created_at)}</span>, sortValue: d => new Date(d.created_at || 0).getTime() },
    { key: 'tamano', header: 'Tamaño', width: 100, align: 'right', priority: 3, cell: d => <span className="tabular text-ink-500">{tamanoDe(d)}</span>, sortValue: d => Number(d.file_size) || 0 },
  ];

  // Sin enlace no hay acciones: el menú queda vacío y la fila, quieta.
  const acciones = (d) => [
    d.download_url && esPrevisualizable(d) && { label: d._category === 'image' ? 'Ver' : 'Abrir', icon: d._category === 'image' ? Eye : ExternalLink, onClick: () => abrir(d) },
    d.download_url && { label: 'Descargar', icon: Download, onClick: () => descargar(d) },
  ];

  const vacio = allDocs.length === 0
    ? (
      <EmptyState
        icon={FileText}
        title="Aún no tienes documentos"
        description="Cuando tu agente suba archivos, fotos o reportes a tus expedientes, aparecerán aquí."
      />
    ) : (
      <EmptyState
        compact
        title="Sin coincidencias"
        description="Prueba con otra palabra o limpia los filtros."
        primaryAction={<Button variant="secondary" size="sm" onClick={limpiar}>Limpiar filtros</Button>}
      />
    );

  return (
    <div className="pb-12">
      <PageHeader
        title="Documentos"
        description="Archivos, fotos, videos y reportes de tus expedientes, en un solo lugar."
        actions={<Button variant="secondary" icon={RefreshCw} loading={loading && allDocs.length > 0} onClick={recargar}>Actualizar</Button>}
      />

      {error ? (
        <Card padding="none">
          <ErrorState message="No pudimos cargar tus documentos." detail={error} onRetry={recargar} />
        </Card>
      ) : (
        <Card padding="none">
          <div className="flex flex-col gap-3 px-(--card-pad) pt-4 pb-3 border-b border-line sm:flex-row sm:items-center sm:justify-between">
            <FilterChips options={chips} value={filter} onChange={setFilter} aria-label="Tipo de archivo" />
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o expediente" className="sm:w-72" />
          </div>
          <DataTable
            columns={columns}
            data={filteredDocs}
            rowKey={d => d.id}
            rowActions={acciones}
            loading={loading}
            loadingRows={6}
            emptyState={vacio}
            aria-label="Documentos"
            pageSize={25}
            mobileCard={d => <CeldaArchivo doc={d} completa onOpen={abrir} />}
          />
          {!loading && filteredDocs.length > 0 && (
            <p className="px-(--card-pad) py-2.5 text-13 text-ink-500 border-t border-line tabular">
              {filtersActive ? `${filteredDocs.length} de ${counts.all} archivos` : `${counts.all} archivo${counts.all === 1 ? '' : 's'}`}
            </p>
          )}
        </Card>
      )}

      <Lightbox
        open={lightbox !== null}
        items={itemsLightbox}
        index={lightbox ?? 0}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
