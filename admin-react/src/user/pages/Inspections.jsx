import { useState, useEffect, useMemo } from 'react';
import { getMyInspections, getInspectionDetail } from '../api';
import { cn } from '../../shared/lib/utils';
import { fmtDateLarga, fmtUSD } from '../../shared/lib/format';
import { useBreadcrumb } from '../../shared/lib/page-meta';
import {
  PageHeader, Card, Badge, StatusBadge, Button, Skeleton, EmptyState, ErrorState, Callout, Accordion, DescriptionList, SearchInput, Lightbox,
} from '../../shared/components/UI';
import { ClipboardCheck, ArrowLeft, Printer, ExternalLink, Play, WhatsAppIcon, User, MapPin, Calendar } from '../../shared/components/Icons';

const WHATSAPP_SOLICITAR = 'https://wa.me/56940211459?text=Hola%2C%20necesito%20una%20inspecci%C3%B3n%20pre-compra';

/* ---------------------------------------------------------------------------
   Forma real de la API (api/inspection_reports_api.php)

   user_list   → { success, inspections: [{ id, report_type, status, vessel_type,
                 brand, model, vessel_year, length_ft, hull_material, country,
                 state_region, city, overall_rating, price_usd, inspector_name,
                 created_at, sent_at }] }        (sólo status = 'sent')
   user_detail → { success, inspection: { …lo mismo, engine_*, fuel_type,
                 marina, listing_url, overall_summary, recommendations,
                 section_<área>: { rating, <campo_snake>: 'valor', …, notes },
                 photos_<área>: [url], videos_test_drive: [url] } }

   Las áreas son hull, engine, electrical, interior, trailer, navigation,
   safety, test_drive y documentation. Los campos de cada sección los escribe
   el inspector en snake_case (`linea_de_agua`, `presion_aceite`): aquí se
   traducen a etiquetas; los que no están en la tabla se humanizan.
   --------------------------------------------------------------------------- */
const AREAS = ['hull', 'engine', 'electrical', 'interior', 'trailer', 'navigation', 'safety', 'test_drive', 'documentation'];
const AREA_LABELS = {
  hull: 'Casco',
  engine: 'Motor',
  electrical: 'Eléctrica',
  interior: 'Interior',
  trailer: 'Trailer',
  navigation: 'Navegación',
  safety: 'Seguridad',
  test_drive: 'Prueba en agua',
  documentation: 'Documentación',
};
const AREAS_FOTOS = ['general', ...AREAS];
const CAMPO_LABELS = {
  estado_general: 'Estado general',
  gelcoat: 'Gelcoat',
  linea_de_agua: 'Línea de agua',
  linea_de_flotacion: 'Línea de flotación',
  quilla: 'Quilla',
  proa: 'Proa',
  popa: 'Popa',
  obra_viva: 'Obra viva',
  cubierta: 'Cubierta',
  herrajes_exteriores: 'Herrajes exteriores',
  arranque: 'Arranque',
  ralenti: 'Ralentí',
  aceleracion: 'Aceleración',
  temperatura: 'Temperatura',
  aceite: 'Aceite',
  filtros: 'Filtros',
  correas: 'Correas',
  presion_aceite: 'Presión de aceite',
  sistema_enfriamiento: 'Sistema de enfriamiento',
  correas_y_mangueras: 'Correas y mangueras',
  bateria: 'Batería',
  baterias: 'Baterías',
  alternador: 'Alternador',
  cableado: 'Cableado',
  luces_navegacion: 'Luces de navegación',
  panel_instrumentos: 'Panel de instrumentos',
  bomba_achique: 'Bomba de achique',
  bocina: 'Bocina',
  tapiceria: 'Tapicería',
  tapiceria_asientos: 'Tapicería de asientos',
  alfombra_piso: 'Alfombra y piso',
  consola: 'Consola',
  almacenamiento: 'Almacenamiento',
  limpieza_general: 'Limpieza general',
  volante: 'Volante',
  estructura: 'Estructura',
  rodillos: 'Rodillos',
  neumaticos: 'Neumáticos',
  luces: 'Luces',
  luces_trailer: 'Luces del trailer',
  winche: 'Winche',
  gps_chartplotter: 'GPS / Chartplotter',
  fishfinder: 'Ecosonda',
  ecosonda: 'Ecosonda',
  radio_vhf: 'Radio VHF',
  compas: 'Compás',
  chalecos_salvavidas: 'Chalecos salvavidas',
  extintor: 'Extintor',
  bengalas: 'Bengalas',
  botiquin: 'Botiquín',
  aro_salvavidas: 'Aro salvavidas',
  arranque_en_agua: 'Arranque en agua',
  maniobrabilidad: 'Maniobrabilidad',
  velocidad_maxima: 'Velocidad máxima',
  virajes: 'Virajes',
  planeo: 'Planeo',
  vibraciones: 'Vibraciones',
  ruidos: 'Ruidos',
  ruido_motor: 'Ruido del motor',
  comportamiento_olas: 'Comportamiento en olas',
  titulo_propiedad: 'Título de propiedad',
  registro: 'Registro',
  seguro_vigente: 'Seguro vigente',
  historial_mantenimiento: 'Historial de mantención',
};
const PAISES = { usa: 'Estados Unidos', us: 'Estados Unidos', eeuu: 'Estados Unidos', chile: 'Chile', cl: 'Chile' };
const TIPOS_REPORTE = { basica: 'Básica', estandar: 'Estándar', premium: 'Premium' };

function etiquetaCampo(clave) {
  if (CAMPO_LABELS[clave]) return CAMPO_LABELS[clave];
  const t = String(clave).replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function nombrePais(c) {
  if (!c) return '';
  return PAISES[String(c).toLowerCase()] || String(c).toUpperCase();
}

function tipoReporte(t) {
  if (!t) return '';
  const k = String(t).toLowerCase();
  return TIPOS_REPORTE[k] || (k.charAt(0).toUpperCase() + k.slice(1));
}

function urlDe(p) {
  return typeof p === 'string' ? p : p?.url || '';
}

/**
 * Deja una inspección (de la lista o del detalle) lista para pintar:
 * secciones con etiquetas, notas por área, ubicación en una línea.
 */
function normalizar(raw) {
  if (!raw || raw._normalizada) return raw;
  const d = { ...raw, _normalizada: true };

  const secciones = {};
  const metrics = {};
  for (const area of AREAS) {
    const s = raw[`section_${area}`];
    if (!s || typeof s !== 'object') continue;
    const { rating, notes, ...resto } = s;
    const fields = {};
    for (const [k, v] of Object.entries(resto)) {
      if (v === null || v === undefined || v === '') continue;
      fields[etiquetaCampo(k)] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    const nota = Number(rating);
    const tieneNota = isFinite(nota) && nota > 0;
    if (!Object.keys(fields).length && !notes && !tieneNota) continue;
    secciones[area] = { rating: tieneNota ? nota : null, fields, notes: notes || '' };
    if (tieneNota) metrics[area] = nota;
  }
  d.secciones = secciones;
  d.metrics = metrics;

  d.fotos = AREAS_FOTOS
    .map(area => ({ key: area, label: area === 'general' ? 'General' : AREA_LABELS[area], photos: (Array.isArray(raw[`photos_${area}`]) ? raw[`photos_${area}`] : []).map(urlDe).filter(Boolean) }))
    .filter(s => s.photos.length > 0);
  d.videos = (Array.isArray(raw.videos_test_drive) ? raw.videos_test_drive : []).map(urlDe).filter(Boolean);

  d.ubicacion = raw.location || [raw.city, raw.state_region, nombrePais(raw.country)].filter(Boolean).join(', ');
  d.fecha = raw.sent_at || raw.created_at || null;
  const nota = Number(raw.overall_rating);
  d.nota = isFinite(nota) && nota > 0 ? nota : null;
  return d;
}

/**
 * Reporte de muestra, con la misma forma que manda la API. Solo se abre desde
 * el botón «Ver un reporte de ejemplo» del estado vacío y se marca como
 * ejemplo en toda la pantalla; nunca se mezcla con la lista real del cliente.
 */
const DEMO_INSPECTION = {
  id: 'demo-1',
  _demo: true,
  report_type: 'premium',
  status: 'sent',
  vessel_type: 'Bowrider',
  brand: 'Cobalt',
  model: 'CS23',
  vessel_year: 2021,
  length_ft: '23.25',
  hull_material: 'Fibra de vidrio',
  engine_brand: 'Mercury',
  engine_model: 'MerCruiser 4.5L',
  engine_hours: '120',
  num_engines: 1,
  fuel_type: 'Gasolina',
  country: 'usa',
  state_region: 'Florida',
  city: 'Miami',
  marina: 'Miami Beach Marina',
  inspector_name: 'Carlos Rodríguez M.',
  overall_rating: 8.3,
  overall_summary: 'Embarcación en muy buen estado general. Motor con bajo horaje y buen mantenimiento. Se recomienda revisión de tapicería por desgaste menor.',
  recommendations: 'La embarcación se encuentra en muy buen estado general para su año. El motor Mercury MerCruiser presenta un funcionamiento óptimo con solo 120 horas de uso. Se sugiere:\n\n1. Revisar tapicería del asiento del copiloto (desgaste menor)\n2. Aplicar cera protectora al gelcoat del casco\n3. Reemplazar ánodos de zinc en la próxima temporada\n4. Verificar tensión de la correa del alternador\n\nEn general, es una excelente opción de compra con muy buena relación precio-calidad.',
  price_usd: 64900,
  sent_at: '2026-04-07',
  created_at: '2026-04-07',
  section_hull: { rating: '8.5', gelcoat: 'Buen estado', linea_de_flotacion: 'Sin osmosis', quilla: 'Sin daños', obra_viva: 'Antifouling vigente', cubierta: 'Buen estado general', notes: 'Casco en buen estado. Se recomienda aplicar cera protectora.' },
  section_engine: { rating: '9.0', arranque: 'Funcionando correctamente', ralenti: 'Estable', aceite: 'Nivel correcto, color normal', filtros: 'Limpios', correas: 'Buen estado', sistema_enfriamiento: 'Funcionando', notes: 'Motor en excelente estado. 120 horas de uso.' },
  section_electrical: { rating: '8.0', bateria: 'Buen estado (12,6 V)', alternador: 'Cargando correctamente', luces_navegacion: 'Funcionando todas', panel_instrumentos: 'Operativo', bocina: 'Funcionando', notes: 'Sistema eléctrico operativo. Verificar correa del alternador.' },
  section_interior: { rating: '7.5', tapiceria_asientos: 'Desgaste menor copiloto', alfombra_piso: 'Buen estado', consola: 'Sin fisuras', almacenamiento: 'Seco, sin humedad', volante: 'Buen estado', notes: 'Interior bien cuidado. Tapicería del copiloto con desgaste menor.' },
  section_trailer: { rating: '8.0', estructura: 'Sin oxidación', neumaticos: 'Buen estado', luces: 'Funcionando', winche: 'Operativo', rodillos: 'Buen estado', notes: 'Trailer en condiciones adecuadas para transporte.' },
  section_navigation: { rating: '8.5', gps_chartplotter: 'Funcionando', ecosonda: 'Operativa', radio_vhf: 'Funcionando', compas: 'Calibrado', notes: 'Equipos de navegación operativos y actualizados.' },
  section_safety: { rating: '9.0', chalecos_salvavidas: '6 unidades, buen estado', extintor: 'Vigente (2025)', bengalas: 'Vigentes', botiquin: 'Completo', aro_salvavidas: 'Presente', notes: 'Equipamiento de seguridad completo y vigente.' },
  section_test_drive: { rating: '8.0', aceleracion: 'Respuesta normal', velocidad_maxima: '45 nudos', virajes: 'Estables', planeo: 'Rápido (3-4 seg)', vibraciones: 'Ninguna anormal', ruidos: 'Normales', notes: 'Prueba en agua satisfactoria. La embarcación responde bien en todas las pruebas.' },
  section_documentation: { rating: '8.0', titulo_propiedad: 'Sí', registro: 'Sí', seguro_vigente: 'Sí', historial_mantenimiento: 'Parcial', notes: 'Documentación en orden. Historial de mantención de los últimos 2 años.' },
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

function fmtPies(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return '';
  return `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} pies`;
}

function nombreEmbarcacion(r) {
  return [r.brand, r.model, r.vessel_year || r.year].filter(Boolean).join(' ') || r.vessel_name || r.name || 'Inspección';
}

/**
 * La API sólo le entrega al cliente reportes ya enviados (`status = 'sent'`),
 * un estado que `statusMeta('inspeccion')` no conoce; aquí se dice
 * «Entregada». Los demás pasan por el kit.
 */
function EstadoInspeccion({ status }) {
  if (String(status).toLowerCase() === 'sent') return <Badge tone="success">Entregada</Badge>;
  return <StatusBadge kind={KIND_ESTADO} status={status} />;
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
  const detalles = [fmtPies(r.length_ft), r.hull_material, Number(r.price_usd) > 0 && `Precio publicado ${fmtUSD(r.price_usd)}`].filter(Boolean);
  return (
    <Card as="button" type="button" onClick={() => onClick(report)}
      className="w-full text-left transition-colors duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
      <div className="flex items-start gap-4">
        {r.nota ? <Nota value={r.nota} /> : <span className="h-11 w-11 rounded-full bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><ClipboardCheck size={20} /></span>}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold text-ink-900">{nombreEmbarcacion(r)}</h3>
            <EstadoInspeccion status={r.status} />
            {r.report_type && <Badge tone="neutral">{tipoReporte(r.report_type)}</Badge>}
            {r._demo && <Badge tone="warning">Ejemplo</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-13 text-ink-500">
            {r.fecha && <span className="inline-flex items-center gap-1"><Calendar size={14} /> {fmtDateLarga(r.fecha)}</span>}
            {r.inspector_name && <span className="inline-flex items-center gap-1"><User size={14} /> {r.inspector_name}</span>}
            {r.ubicacion && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {r.ubicacion}</span>}
          </div>
          {detalles.length > 0 && <p className="text-13 text-ink-500 mt-1">{detalles.join(' · ')}</p>}
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
    // Video subido por el inspector (`upload_media` → /api/inspection_media/…).
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
      return (
        <figure className="m-0">
          <video controls preload="metadata" src={url} className="w-full rounded-lg bg-ink-900 aspect-video" aria-label={pie}>
            <a href={url} target="_blank" rel="noreferrer">{pie}</a>
          </video>
          <figcaption className="mt-2 text-13 text-ink-500">{pie}</figcaption>
        </figure>
      );
    }
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

/** Mismas palabras que usa el inspector en el formulario del admin. */
function tonoValor(value) {
  if (/malo|dañad|danad|no funciona|roto|requiere reemplazo|excesiv|severa|fisura|^no$/i.test(value)) return 'danger';
  if (/regular|desgaste|parcial|d[eé]bil|oxid|ray|moderad/i.test(value)) return 'warning';
  if (/excelente|buen estado|funcionando|correcto|operativ|complet|vigente|estable|limpi|normal|calibrad|^s[ií]$|sin /i.test(value)) return 'success';
  return 'neutral';
}

function InspectionDetail({ report, onBack }) {
  // El ejemplo ya viene completo; el real se pide a la API.
  const [detail, setDetail] = useState(report._demo ? report : null);
  const [loading, setLoading] = useState(!report._demo);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (report._demo) return undefined;
    let cancel = false;
    getInspectionDetail(report.id)
      .then(data => {
        if (cancel) return;
        // `user_detail` → { success, inspection }. El detalle trae todas las
        // columnas, así que reemplaza a la fila de la lista.
        const insp = data?.inspection || data?.report;
        if (!insp) throw new Error(data?.error || data?.detail || 'No pudimos abrir el reporte');
        setDetail(normalizar(insp));
      })
      .catch(e => { if (!cancel) setError(e); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [report, intento]);

  const reintentar = () => { setLoading(true); setError(null); setIntento(n => n + 1); };

  const d = detail || report;
  const titulo = nombreEmbarcacion(d);
  useBreadcrumb([d._demo ? 'Reporte de ejemplo' : titulo]);

  const metrics = d.metrics || {};
  const secciones = d.secciones || {};
  const fotos = useMemo(() => (d.fotos || []).flatMap(s => s.photos.map((src, i) => ({ src, alt: `${s.label} ${i + 1}`, caption: `${s.label} · foto ${i + 1} de ${s.photos.length}` }))), [d.fotos]);
  const photoSections = d.fotos || [];
  const videos = d.videos || [];

  const descripcion = [d.vessel_type, d.year || d.vessel_year, fmtPies(d.length_ft) || d.size, d.ubicacion].filter(Boolean).join(' · ');

  const datos = [
    d.brand && { label: 'Marca', value: d.brand },
    d.model && { label: 'Modelo', value: d.model },
    (d.year || d.vessel_year) && { label: 'Año', value: d.year || d.vessel_year },
    d.vessel_type && { label: 'Tipo', value: d.vessel_type },
    (fmtPies(d.length_ft) || d.size) && { label: 'Eslora', value: fmtPies(d.length_ft) || d.size },
    d.hull_material && { label: 'Material del casco', value: d.hull_material },
    (d.engine_brand || d.engine_model) && { label: 'Motor', value: [d.engine_brand, d.engine_model].filter(Boolean).join(' ') },
    d.engine_hours && { label: 'Horas de motor', value: d.engine_hours },
    Number(d.num_engines) > 0 && { label: 'Motores', value: d.num_engines },
    d.fuel_type && { label: 'Combustible', value: d.fuel_type },
    d.ubicacion && { label: 'Ubicación', value: d.ubicacion },
    d.marina && { label: 'Marina', value: d.marina },
    Number(d.price_usd) > 0 && { label: 'Precio publicado', value: fmtUSD(d.price_usd) },
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="pb-12">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2 mb-3">Inspecciones</Button>
        <Skeleton.Detail />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-12">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2 mb-3">Inspecciones</Button>
        <Card padding="none"><ErrorState message="No pudimos abrir el reporte." detail={error} onRetry={reintentar} /></Card>
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
        meta={<><EstadoInspeccion status={d.status} />{d.report_type && <Badge tone="neutral">{tipoReporte(d.report_type)}</Badge>}</>}
        actions={(
          <>
            {d.listing_url && <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(d.listing_url, '_blank', 'noopener')}>Ver anuncio</Button>}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
          </>
        )}
      />

      {d.nota && (
        <Card className="mb-4">
          <div className="flex items-start gap-5">
            <Nota value={d.nota} size="lg" />
            <div className="min-w-0">
              <p className="eyebrow">Calificación general</p>
              <p className="text-xl font-semibold text-ink-900 tabular mt-0.5">{fmtNota(d.nota)} <span className="text-sm font-normal text-ink-500">de 10</span></p>
              {d.overall_summary && <p className="text-sm text-ink-700 mt-2">{d.overall_summary}</p>}
              <p className="text-13 text-ink-500 mt-2">
                {d.inspector_name && <>Inspector: {d.inspector_name}</>}
                {d.inspector_name && d.fecha && ' · '}
                {d.fecha && <>Reporte del {fmtDateLarga(d.fecha)}</>}
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
                {AREAS.map(k => metrics[k] != null && (
                  <li key={k} className="flex items-center gap-3">
                    <span className="text-13 text-ink-700 w-28 shrink-0">{AREA_LABELS[k]}</span>
                    <span className="flex-1 h-2 rounded-full bg-neutral-bg overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Number(metrics[k])} aria-label={AREA_LABELS[k]}>
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

      {Object.keys(secciones).length > 0 && (
        <Card className="mb-4">
          <Card.Header title="Detalle por sección" description="Lo que revisó el inspector en cada sistema" />
          <Accordion flush>
            {AREAS.map(key => {
              const sec = secciones[key];
              if (!sec) return null;
              return (
                <Accordion.Item key={key} title={AREA_LABELS[key]} meta={sec.rating != null && <Badge tone={tonoNota(sec.rating)}>{fmtNota(sec.rating)} / 10</Badge>}>
                  {Object.keys(sec.fields).length > 0 && (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 m-0">
                      {Object.entries(sec.fields).map(([field, value]) => (
                        <div key={field} className="flex items-center justify-between gap-3 py-1.5 border-b border-line">
                          <dt className="text-13 text-ink-500">{field}</dt>
                          <dd className="m-0 text-right"><Badge tone={tonoValor(String(value))}>{value}</Badge></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {sec.notes && <Callout tone="neutral" compact className={cn(Object.keys(sec.fields).length > 0 && 'mt-3')}>{sec.notes}</Callout>}
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

      {d.fecha && (
        <p className="text-center text-13 text-ink-500">
          Reporte del {fmtDateLarga(d.fecha)} · Imporlan
        </p>
      )}

      <Lightbox open={lightbox !== null} items={fotos} index={lightbox ?? 0} onIndexChange={setLightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */

// `getMyInspections` (user/api.js) atrapa el error de red y devuelve
// `{ reports: [] }` sin `success`; el servidor manda `success: true` y la lista
// en `inspections`. Sin la marca no es «no tienes inspecciones», es un error.
function listaDe(data) {
  if (data?.success !== true) throw new Error(data?.error || data?.detail || 'No pudimos cargar tus inspecciones');
  const lista = data.inspections || data.reports || data.items || [];
  return lista.map(normalizar);
}

export default function Inspections() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    getMyInspections()
      .then(data => { const lista = listaDe(data); if (vivo) setReports(lista); })
      .catch(e => { if (vivo) setError(e); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [intento]);

  const recargar = () => { setLoading(true); setError(null); setIntento(n => n + 1); };

  const term = search.trim().toLowerCase();
  const filtered = reports.filter(r => {
    if (!term) return true;
    const hay = `${nombreEmbarcacion(r)} ${r.ubicacion || ''} ${r.inspector_name || ''} ${r.vessel_type || ''}`.toLowerCase();
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
            secondaryAction={<Button variant="ghost" onClick={() => setSelected(normalizar(DEMO_INSPECTION))}>Ver un reporte de ejemplo</Button>}
          />
        </Card>
      ) : (
        <>
          {reports.length > 1 && (
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar embarcación, lugar o inspector" className="mb-4 sm:max-w-sm" />
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
