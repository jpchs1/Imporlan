import { useState, useEffect, useMemo } from 'react';
import { getMyInspections, getInspectionDetail } from '../api';
import { cn } from '../../shared/lib/utils';
import { fmtDateLarga } from '../../shared/lib/format';
import { useBreadcrumb } from '../../shared/lib/page-meta';
import {
  PageHeader, Card, Badge, StatusBadge, Button, Skeleton, EmptyState, ErrorState, Callout, Accordion, DescriptionList, SearchInput, Lightbox,
} from '../../shared/components/UI';
import { ClipboardCheck, ArrowLeft, Printer, ExternalLink, Play, WhatsAppIcon, User, MapPin, Calendar } from '../../shared/components/Icons';

const WHATSAPP_SOLICITAR = 'https://wa.me/56940211459?text=Hola%2C%20necesito%20una%20inspecci%C3%B3n%20pre-compra';

/**
 * Reporte de muestra. Solo se abre desde el botón "Ver un reporte de ejemplo"
 * del estado vacío y se marca como ejemplo en toda la pantalla; nunca se
 * mezcla con la lista real del cliente.
 */
const DEMO_INSPECTION = {
  id: 'demo-1',
  _demo: true,
  vessel_name: 'Cobalt CS23 Bowrider 2021',
  name: 'Cobalt CS23 Bowrider 2021',
  brand: 'Cobalt',
  model: 'CS23',
  vessel_year: 2021,
  vessel_type: 'Bowrider',
  location: 'Miami, Florida',
  length_ft: '23.25',
  hull_material: 'Fibra de vidrio',
  engine_brand: 'Mercury',
  engine_model: 'MerCruiser 4.5L',
  engine_hours: '120',
  num_engines: '1',
  fuel_type: 'Gasolina',
  marina: 'Miami Beach Marina',
  city: 'Miami',
  country: 'USA',
  inspector_name: 'Carlos Rodríguez M.',
  status: 'completed',
  report_type: 'PREMIUM',
  overall_rating: 8.3,
  overall_summary: 'Embarcación en muy buen estado general. Motor con bajo horaje y buen mantenimiento. Se recomienda revisión de tapicería por desgaste menor.',
  sent_at: '2026-04-07',
  created_at: '2026-04-07',
  recommendations: 'La embarcación se encuentra en muy buen estado general para su año. El motor Mercury MerCruiser presenta un funcionamiento óptimo con solo 120 horas de uso. Se sugiere:\n\n1. Revisar tapicería del asiento del copiloto (desgaste menor)\n2. Aplicar cera protectora al gelcoat del casco\n3. Reemplazar ánodos de zinc en la próxima temporada\n4. Verificar tensión de la correa del alternador\n\nEn general, es una excelente opción de compra con muy buena relación precio-calidad.',
  section_details: {
    hull: { rating: 8.5, fields: { 'Estado del gelcoat': 'Buen estado', 'Línea de flotación': 'Sin osmosis', 'Quilla': 'Sin daños', 'Obra viva': 'Antifouling vigente', 'Cubierta': 'Buen estado general' }, notes: 'Casco en buen estado. Se recomienda aplicar cera protectora.' },
    engine: { rating: 9.0, fields: { 'Arranque': 'Funcionando correctamente', 'Ralentí': 'Estable', 'Aceite': 'Nivel correcto, color normal', 'Filtros': 'Limpios', 'Correas': 'Buen estado', 'Sistema de enfriamiento': 'Funcionando' }, notes: 'Motor en excelente estado. 120 horas de uso.' },
    electrical: { rating: 8.0, fields: { 'Batería': 'Buen estado (12,6 V)', 'Alternador': 'Cargando correctamente', 'Luces de navegación': 'Funcionando todas', 'Panel de instrumentos': 'Operativo', 'Bocina': 'Funcionando' }, notes: 'Sistema eléctrico operativo. Verificar correa del alternador.' },
    interior: { rating: 7.5, fields: { 'Tapicería asientos': 'Desgaste menor copiloto', 'Alfombra': 'Buen estado', 'Consola': 'Sin fisuras', 'Almacenamiento': 'Seco, sin humedad', 'Volante': 'Buen estado' }, notes: 'Interior bien cuidado. Tapicería del copiloto con desgaste menor.' },
    trailer: { rating: 8.0, fields: { 'Estructura': 'Sin oxidación', 'Neumáticos': 'Buen estado', 'Luces': 'Funcionando', 'Winche': 'Operativo', 'Rodillos': 'Buen estado' }, notes: 'Trailer en condiciones adecuadas para transporte.' },
    navigation: { rating: 8.5, fields: { 'GPS/Chartplotter': 'Funcionando', 'Ecosonda': 'Operativa', 'Radio VHF': 'Funcionando', 'Compás': 'Calibrado' }, notes: 'Equipos de navegación operativos y actualizados.' },
    safety: { rating: 9.0, fields: { 'Chalecos salvavidas': '6 unidades, buen estado', 'Extintor': 'Vigente (2025)', 'Bengalas': 'Vigentes', 'Botiquín': 'Completo', 'Aro salvavidas': 'Presente' }, notes: 'Equipamiento de seguridad completo y vigente.' },
    test_drive: { rating: 8.0, fields: { 'Aceleración': 'Respuesta normal', 'Velocidad máxima': '45 nudos', 'Virajes': 'Estables', 'Planeo': 'Rápido (3-4 seg)', 'Vibraciones': 'Ninguna anormal', 'Ruidos': 'Normales' }, notes: 'Prueba en agua satisfactoria. La embarcación responde bien en todas las pruebas.' },
  },
  metrics: { hull: 8.5, engine: 9.0, electrical: 8.0, interior: 7.5, trailer: 8.0, navigation: 8.5, safety: 9.0, test_drive: 8.0 },
  // Dos fotos del Cobalt CS23 que ya estaban en el sitio (solo sección
  // General: son tomas del barco completo).
  photos_general: [
    '/images/rank-cobalt-cs23.jpg',
    '/panel/assets/cobalt-cs23.jpg',
  ],
  videos_test_drive: ['https://www.youtube.com/watch?v=qAuCVrVybIQ'],
};

// Clave de `statusMeta` (lib/status.js): va sin tilde a propósito.
const KIND_ESTADO = 'inspeccion';
const METRICS = ['hull', 'engine', 'electrical', 'interior', 'trailer', 'navigation', 'safety', 'test_drive'];
const METRIC_LABELS = { hull: 'Casco', engine: 'Motor', electrical: 'Eléctrica', interior: 'Interior', trailer: 'Trailer', navigation: 'Navegación', safety: 'Seguridad', test_drive: 'Prueba en agua' };

/** Tono semántico de una nota sobre 10. */
function tonoNota(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return 'neutral';
  if (v >= 7) return 'success';
  if (v >= 5) return 'warning';
  return 'danger';
}
const TONO_BG = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-ink-400' };
const TONO_TEXT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-ink-500' };

function fmtNota(n) {
  const v = Number(n);
  return isFinite(v) ? v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}

function nombreEmbarcacion(r) {
  return [r.brand, r.model, r.vessel_year || r.year].filter(Boolean).join(' ') || r.vessel_name || r.name || 'Inspección';
}

/** Nota grande (círculo) con color semántico. */
function Nota({ value, size = 'md' }) {
  const tono = tonoNota(value);
  const dims = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-base';
  return (
    <span role="img" className={cn('inline-flex items-center justify-center rounded-full font-semibold tabular shrink-0 text-white', dims, TONO_BG[tono])} aria-label={`Nota ${fmtNota(value)} de 10`}>
      {fmtNota(value)}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Lista
   --------------------------------------------------------------------------- */
function InspectionCard({ report, onClick }) {
  const r = report;
  return (
    <Card as="button" type="button" onClick={() => onClick(report)}
      className="w-full text-left transition-colors duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
      <div className="flex items-start gap-4">
        {r.overall_rating ? <Nota value={r.overall_rating} /> : <span className="h-11 w-11 rounded-full bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><ClipboardCheck size={20} /></span>}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold text-ink-900">{nombreEmbarcacion(r)}</h3>
            <StatusBadge kind={KIND_ESTADO} status={r.status} />
            {r._demo && <Badge tone="warning">Ejemplo</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-13 text-ink-500">
            {(r.sent_at || r.created_at) && <span className="inline-flex items-center gap-1"><Calendar size={14} /> {fmtDateLarga(r.sent_at || r.created_at)}</span>}
            {r.inspector_name && <span className="inline-flex items-center gap-1"><User size={14} /> {r.inspector_name}</span>}
            {r.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {r.location}</span>}
          </div>
          {r.overall_summary && <p className="text-sm text-ink-700 mt-2 line-clamp-2">{r.overall_summary}</p>}
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Detalle
   --------------------------------------------------------------------------- */

/** Título real del video (oEmbed de YouTube); si no se puede, un pie genérico. */
function useTituloVideo(url) {
  const [titulo, setTitulo] = useState(null);
  useEffect(() => {
    let cancel = false;
    if (!url || !/youtube\.com|youtu\.be/.test(url)) return undefined;
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancel && d?.title) setTitulo(d.title); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [url]);
  return titulo;
}

function VideoCard({ url, index }) {
  const titulo = useTituloVideo(url);
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const pie = titulo || `Video ${index + 1} de la prueba en agua`;
  if (!yt) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-line hover:bg-canvas transition-colors">
        <span className="h-9 w-9 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><Play size={18} /></span>
        <span className="text-sm text-ink-900 truncate">{pie}</span>
        <ExternalLink size={16} className="ml-auto text-ink-500 shrink-0" />
      </a>
    );
  }
  const id = yt[1];
  return (
    <figure className="m-0">
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer" aria-label={`Ver en YouTube: ${pie}`}
        className="group block relative aspect-video rounded-lg overflow-hidden bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
        <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-14 w-14 rounded-full bg-surface text-ink-900 flex items-center justify-center shadow-pop"><Play size={24} /></span>
        </span>
      </a>
      <figcaption className="mt-2 text-13 text-ink-500 flex items-center gap-1.5"><ExternalLink size={14} /> {pie} · YouTube</figcaption>
    </figure>
  );
}

function tonoValor(value) {
  if (/malo|dañad|danad|no funciona|roto|oxid|desgaste|fisura|ray/i.test(value)) return 'warning';
  if (/excelente|buen estado|funcionando|correcto|operativ|complet|vigente|estable|limpi|normal|sin /i.test(value)) return 'success';
  return 'neutral';
}

function InspectionDetail({ report, onBack }) {
  // El ejemplo ya viene completo; el real se pide a la API.
  const [detail, setDetail] = useState(report._demo ? report : null);
  const [loading, setLoading] = useState(!report._demo);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (report._demo) return undefined;
    let cancel = false;
    getInspectionDetail(report.id)
      .then(data => { if (!cancel) setDetail(data.report || data); })
      .catch(() => { if (!cancel) setDetail(report); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [report]);

  const d = detail || report;
  const titulo = nombreEmbarcacion(d);
  useBreadcrumb([d._demo ? 'Reporte de ejemplo' : titulo]);

  const metrics = d.metrics || {};
  const photoSections = useMemo(() => [
    { key: 'general', label: 'General', photos: d.photos_general || [] },
    { key: 'hull', label: 'Casco', photos: d.photos_hull || [] },
    { key: 'engine', label: 'Motor', photos: d.photos_engine || [] },
    { key: 'electrical', label: 'Eléctrica', photos: d.photos_electrical || [] },
    { key: 'interior', label: 'Interior', photos: d.photos_interior || [] },
    { key: 'trailer', label: 'Trailer', photos: d.photos_trailer || [] },
    { key: 'navigation', label: 'Navegación', photos: d.photos_navigation || [] },
    { key: 'safety', label: 'Seguridad', photos: d.photos_safety || [] },
    { key: 'test_drive', label: 'Prueba en agua', photos: d.photos_test_drive || [] },
  ].filter(s => s.photos.length > 0), [d]);
  const fotos = useMemo(() => photoSections.flatMap(s => s.photos.map((src, i) => ({ src, alt: `${s.label} ${i + 1}`, caption: `${s.label} · foto ${i + 1} de ${s.photos.length}` }))), [photoSections]);
  const videos = d.videos_test_drive || [];

  const descripcion = [d.vessel_type, d.year || d.vessel_year, (d.size || (d.length_ft && `${d.length_ft} pies`)), d.location].filter(Boolean).join(' · ');

  const datos = [
    d.brand && { label: 'Marca', value: d.brand },
    d.model && { label: 'Modelo', value: d.model },
    (d.year || d.vessel_year) && { label: 'Año', value: d.year || d.vessel_year },
    d.vessel_type && { label: 'Tipo', value: d.vessel_type },
    (d.size || d.length_ft) && { label: 'Eslora', value: d.size || `${d.length_ft} pies` },
    d.hull_material && { label: 'Material del casco', value: d.hull_material },
    (d.engine_brand || d.engine_model) && { label: 'Motor', value: [d.engine_brand, d.engine_model].filter(Boolean).join(' ') },
    d.engine_hours && { label: 'Horas de motor', value: d.engine_hours },
    d.num_engines && { label: 'Motores', value: d.num_engines },
    d.fuel_type && { label: 'Combustible', value: d.fuel_type },
    d.location && { label: 'Ubicación', value: d.location },
    d.marina && { label: 'Marina', value: d.marina },
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="pb-12">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2 mb-3">Inspecciones</Button>
        <Skeleton.Detail />
      </div>
    );
  }

  return (
    <div className="pb-12">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2 mb-3">Inspecciones</Button>

      {d._demo && (
        <Callout tone="warning" title="Esto es un reporte de ejemplo" className="mb-5">
          Los datos son ilustrativos y no corresponden a ninguna embarcación tuya. Así se ve una inspección real cuando la solicitas.
        </Callout>
      )}

      <PageHeader
        eyebrow={d._demo ? 'Ejemplo' : 'Inspección'}
        title={titulo}
        description={descripcion}
        meta={<><StatusBadge kind={KIND_ESTADO} status={d.status} />{d.report_type && <Badge tone="neutral">{String(d.report_type).charAt(0) + String(d.report_type).slice(1).toLowerCase()}</Badge>}</>}
        actions={(
          <>
            {d.listing_url && <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(d.listing_url, '_blank', 'noopener')}>Ver anuncio</Button>}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
          </>
        )}
      />

      {d.overall_rating && (
        <Card className="mb-4">
          <div className="flex items-start gap-5">
            <Nota value={d.overall_rating} size="lg" />
            <div className="min-w-0">
              <p className="eyebrow">Calificación general</p>
              <p className="text-xl font-semibold text-ink-900 tabular mt-0.5">{fmtNota(d.overall_rating)} <span className="text-sm font-normal text-ink-500">de 10</span></p>
              {d.overall_summary && <p className="text-sm text-ink-700 mt-2">{d.overall_summary}</p>}
              <p className="text-13 text-ink-500 mt-2">
                {d.inspector_name && <>Inspector: {d.inspector_name}</>}
                {d.inspector_name && (d.sent_at || d.created_at) && ' · '}
                {(d.sent_at || d.created_at) && <>Reporte del {fmtDateLarga(d.sent_at || d.created_at)}</>}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {datos.length > 0 && (
          <Card className="lg:col-span-3">
            <Card.Header title="Datos de la embarcación" />
            <Card.Body><DescriptionList items={datos} cols={3} dense /></Card.Body>
          </Card>
        )}
        {Object.keys(metrics).length > 0 && (
          <Card className={cn(datos.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5')}>
            <Card.Header title="Evaluación por área" description="Nota de 1 a 10 por sistema revisado" />
            <Card.Body>
              <ul className="space-y-2.5 m-0 p-0 list-none">
                {METRICS.map(k => metrics[k] != null && (
                  <li key={k} className="flex items-center gap-3">
                    <span className="text-13 text-ink-700 w-28 shrink-0">{METRIC_LABELS[k]}</span>
                    <span className="flex-1 h-2 rounded-full bg-neutral-bg overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Number(metrics[k])} aria-label={METRIC_LABELS[k]}>
                      <span className={cn('block h-full rounded-full', TONO_BG[tonoNota(metrics[k])])} style={{ width: `${Math.min(100, (Number(metrics[k]) / 10) * 100)}%` }} />
                    </span>
                    <span className={cn('text-13 font-semibold tabular w-8 text-right', TONO_TEXT[tonoNota(metrics[k])])}>{fmtNota(metrics[k])}</span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        )}
      </div>

      {d.section_details && (
        <Card className="mb-4">
          <Card.Header title="Detalle por sección" description="Lo que revisó el inspector en cada sistema" />
          <Accordion flush>
            {METRICS.map(key => {
              const sec = d.section_details[key];
              if (!sec) return null;
              return (
                <Accordion.Item key={key} title={METRIC_LABELS[key]} meta={<Badge tone={tonoNota(sec.rating)}>{fmtNota(sec.rating)} / 10</Badge>}>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 m-0">
                    {Object.entries(sec.fields || {}).map(([field, value]) => (
                      <div key={field} className="flex items-center justify-between gap-3 py-1.5 border-b border-line">
                        <dt className="text-13 text-ink-500">{field}</dt>
                        <dd className="m-0 text-right"><Badge tone={tonoValor(String(value))}>{value}</Badge></dd>
                      </div>
                    ))}
                  </dl>
                  {sec.notes && <Callout tone="neutral" compact className="mt-3">{sec.notes}</Callout>}
                </Accordion.Item>
              );
            })}
          </Accordion>
        </Card>
      )}

      {d.recommendations && (
        <Card className="mb-4">
          <Card.Header title="Recomendaciones del inspector" />
          <Card.Body><p className="text-sm text-ink-700 whitespace-pre-wrap m-0">{d.recommendations}</p></Card.Body>
        </Card>
      )}

      {photoSections.length > 0 && (
        <Card className="mb-4">
          <Card.Header title={`Fotos (${fotos.length})`} />
          <Card.Body className="space-y-5">
            {photoSections.map(section => {
              const offset = fotos.findIndex(f => f.src === section.photos[0] && f.alt === `${section.label} 1`);
              return (
                <div key={section.key}>
                  <p className="eyebrow mb-2">{section.label} · {section.photos.length}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {section.photos.map((url, i) => (
                      <button key={`${url}-${i}`} type="button" onClick={() => setLightbox(offset + i)} aria-label={`Ver foto ${i + 1} de ${section.label}`}
                        className="aspect-[4/3] rounded-md overflow-hidden bg-neutral-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card.Body>
        </Card>
      )}

      {videos.length > 0 && (
        <Card className="mb-4">
          <Card.Header title={`Videos de la prueba en agua (${videos.length})`} />
          <Card.Body className="space-y-4">
            {videos.map((url, i) => <VideoCard key={`${url}-${i}`} url={url} index={i} />)}
          </Card.Body>
        </Card>
      )}

      <p className="text-center text-13 text-ink-500">
        Reporte del {fmtDateLarga(d.sent_at || d.created_at)} · Imporlan
      </p>

      <Lightbox open={lightbox !== null} items={fotos} index={lightbox ?? 0} onIndexChange={setLightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */
export default function Inspections() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const listar = () => getMyInspections().then(data => data.reports || data.items || []);

  useEffect(() => {
    let vivo = true;
    getMyInspections()
      .then(data => { if (vivo) setReports(data.reports || data.items || []); })
      .catch(e => { if (vivo) setError(e); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);

  function recargar() {
    setLoading(true);
    setError(null);
    listar().then(setReports).catch(setError).finally(() => setLoading(false));
  }

  const term = search.trim().toLowerCase();
  const filtered = reports.filter(r => {
    if (!term) return true;
    const hay = `${r.vessel_name || ''} ${r.brand || ''} ${r.model || ''} ${r.location || ''} ${r.inspector_name || ''}`.toLowerCase();
    return hay.includes(term);
  });

  if (selected) return <InspectionDetail report={selected} onBack={() => setSelected(null)} />;

  const solicitar = <Button variant="secondary" icon={WhatsAppIcon} onClick={() => window.open(WHATSAPP_SOLICITAR, '_blank', 'noopener')}>Solicitar inspección</Button>;

  return (
    <div className="pb-12">
      <PageHeader
        title="Inspecciones"
        description="Reportes técnicos previos a la compra: estructura, motor, sistemas, fotos y video de la prueba en agua."
        actions={solicitar}
      />

      {error ? (
        <Card padding="none"><ErrorState message="No pudimos cargar tus inspecciones." detail={error} onRetry={recargar} /></Card>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton.Card lines={2} />
          <Skeleton.Card lines={2} />
        </div>
      ) : reports.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={ClipboardCheck}
            title="Aún no tienes inspecciones"
            description="Cuando solicites una, el reporte aparecerá aquí con las notas por sistema, las fotos, el video y las recomendaciones del inspector."
            primaryAction={<Button icon={WhatsAppIcon} onClick={() => window.open(WHATSAPP_SOLICITAR, '_blank', 'noopener')}>Solicitar inspección</Button>}
            secondaryAction={<Button variant="ghost" onClick={() => setSelected(DEMO_INSPECTION)}>Ver un reporte de ejemplo</Button>}
          />
        </Card>
      ) : (
        <>
          {reports.length > 1 && (
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar embarcación, marca o inspector" className="mb-4 sm:max-w-sm" />
          )}
          {filtered.length === 0 ? (
            <Card padding="none">
              <EmptyState compact title="Sin coincidencias" description="Prueba con otra palabra." primaryAction={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Limpiar búsqueda</Button>} />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => <InspectionCard key={r.id} report={r} onClick={setSelected} />)}
            </div>
          )}
          <p className="text-13 text-ink-500 mt-6">
            ¿Necesitas otra inspección? Coordinamos inspectores en Estados Unidos y en Chile; escríbenos por WhatsApp.
          </p>
        </>
      )}
    </div>
  );
}
