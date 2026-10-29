import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getFeaturedVessels, getVesselDetail, getVesselPositions, refreshVesselPosition } from '../api';
import { cn } from '../../shared/lib/utils';
import { fmtDateLarga, fmtRelativo } from '../../shared/lib/format';
import {
  Card, Button, PageHeader, StatusBadge, FilterChips, SearchInput, EmptyState, ErrorState, Skeleton, DescriptionList, Callout,
} from '../../shared/components/UI';
import { Ship, RefreshCw, ArrowRight, WhatsAppIcon } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

/* ---------------------------------------------------------------------------
   Mapa (react-leaflet: el mapa se crea una vez; marcadores y ruta son hijos
   que React agrega y quita sin destruir el mapa → adiós `_leaflet_pos`).
   --------------------------------------------------------------------------- */

/** Valor de un token de color (para lo que Leaflet dibuja en canvas/SVG). */
function token(nombre, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v || fallback;
}

function coordenadas(v) {
  const lat = parseFloat(v?.lat);
  const lon = parseFloat(v?.lon ?? v?.lng);
  return (isNaN(lat) || isNaN(lon)) ? null : [lat, lon];
}

function iconoBarco(nombre, seleccionado) {
  const color = seleccionado ? 'bg-brand-600 text-brand-700' : 'bg-ink-900 text-ink-900';
  return L.divIcon({
    className: '',
    iconSize: [140, 36],
    iconAnchor: [70, 7],
    html: `<div class="flex flex-col items-center">
      <span class="block h-3.5 w-3.5 rounded-full border-2 border-white shadow-pop ${color.split(' ')[0]}"></span>
      <span class="mt-0.5 text-xs font-semibold whitespace-nowrap ${color.split(' ')[1]}" style="text-shadow:0 0 3px #fff,0 0 3px #fff">${String(nombre || '').replace(/</g, '&lt;')}</span>
    </div>`,
  });
}

/** Ajusta el encuadre cuando cambian los puntos (una sola vez por cambio). */
function Encuadre({ puntos }) {
  const map = useMap();
  // Se compara por valor (la lista se recrea en cada render con los mismos puntos).
  const clave = puntos.map(p => p.join(',')).join('|');
  useEffect(() => {
    const pts = clave ? clave.split('|').map(s => s.split(',').map(Number)) : [];
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 6);
    else map.fitBounds(L.latLngBounds(pts).pad(0.15));
  }, [map, clave]);
  useEffect(() => {
    // El contenedor puede cambiar de tamaño después de montar (columnas,
    // barra inferior móvil): se recalcula.
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapaBarcos({ vessels, positions, selectedId, onSelectVessel }) {
  const ruta = useMemo(() => (positions || []).map(coordenadas).filter(Boolean), [positions]);
  const marcados = useMemo(() => (vessels || []).map(v => ({ v, c: coordenadas(v) })).filter(x => x.c), [vessels]);
  const puntos = useMemo(() => {
    const out = marcados.map(x => x.c);
    ruta.forEach(c => { if (!out.some(b => b[0] === c[0] && b[1] === c[1])) out.push(c); });
    return out;
  }, [marcados, ruta]);
  const colorRuta = token('--color-brand-600', '#0e7490');
  const colorPunto = token('--color-ink-400', '#94a3b8');

  return (
    <MapContainer center={[-15, -70]} zoom={3} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {ruta.length > 1 && (
        <>
          <Polyline positions={ruta} pathOptions={{ color: colorRuta, weight: 3, opacity: 0.8, dashArray: '8 4' }} />
          {ruta.slice(1).map((c, i) => (
            <CircleMarker key={`${c[0]}-${c[1]}-${i}`} center={c} radius={3} pathOptions={{ color: colorPunto, fillColor: colorPunto, fillOpacity: 0.7, weight: 1 }} />
          ))}
        </>
      )}
      {marcados.map(({ v, c }) => (
        <Marker key={v.id} position={c} icon={iconoBarco(v.display_name, v.id === selectedId)} eventHandlers={{ click: () => onSelectVessel(v.id) }}>
          <Popup>
            <strong>{v.display_name || 'Barco'}</strong><br />
            {c[0].toFixed(4)}, {c[1].toFixed(4)}{v.speed ? ` · ${v.speed} nudos` : ''}
          </Popup>
        </Marker>
      ))}
      <Encuadre puntos={puntos} />
    </MapContainer>
  );
}

/* ---------------------------------------------------------------------------
   Lista y detalle
   --------------------------------------------------------------------------- */
function FilaBarco({ vessel, selected, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(vessel.id)}
        aria-pressed={selected}
        className={cn(
          'w-full text-left px-(--card-pad) py-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
          selected ? 'bg-brand-50' : 'hover:bg-canvas',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-ink-900 truncate" title={vessel.display_name}>{vessel.display_name || 'Sin nombre'}</p>
          <StatusBadge kind="barco" status={vessel.status} size="sm" />
        </div>
        {(vessel.origin_label || vessel.destination_label) && (
          <p className="flex items-center gap-1.5 mt-1 text-13 text-ink-500 min-w-0">
            {vessel.origin_label && <span className="truncate">{vessel.origin_label}</span>}
            {vessel.origin_label && vessel.destination_label && <ArrowRight size={14} className="shrink-0" />}
            {vessel.destination_label && <span className="truncate text-ink-700">{vessel.destination_label}</span>}
          </p>
        )}
        {vessel.shipping_line && <p className="text-xs text-ink-500 mt-0.5">{vessel.shipping_line}</p>}
      </button>
    </li>
  );
}

function DetalleBarco({ vessel, onRefresh, refreshing }) {
  const eta = vessel.eta_manual || vessel.pos_eta;
  const pos = coordenadas(vessel);
  const items = [
    vessel.shipping_line && { label: 'Naviera', value: vessel.shipping_line },
    vessel.origin_label && { label: 'Origen', value: vessel.origin_label },
    vessel.destination_label && { label: 'Destino', value: vessel.destination_label },
    eta && { label: 'Llegada estimada', value: fmtDateLarga(eta) },
    vessel.imo && { label: 'IMO', value: vessel.imo, mono: true },
    vessel.mmsi && { label: 'MMSI', value: vessel.mmsi, mono: true },
    pos && { label: 'Posición', value: <span className="whitespace-nowrap">{pos[0].toFixed(4)}, {pos[1].toFixed(4)}</span>, mono: true },
    vessel.speed && { label: 'Velocidad', value: `${vessel.speed} nudos` },
    vessel.course && { label: 'Rumbo', value: `${parseFloat(vessel.course).toFixed(0)}°` },
    vessel.last_position_update && { label: 'Última posición', value: <span title={fmtDateLarga(vessel.last_position_update, { hora: true })}>{fmtRelativo(vessel.last_position_update)}</span> },
  ].filter(Boolean);

  return (
    <Card>
      <Card.Header title={vessel.display_name} description={vessel.client_name ? `Embarcación de ${vessel.client_name}` : undefined} actions={<StatusBadge kind="barco" status={vessel.status} dot />} />
      <Card.Body>
        <DescriptionList items={items} cols={2} dense />
      </Card.Body>
      <Card.Footer align="between">
        <p className="text-xs text-ink-500 m-0">Los datos vienen del sistema AIS de la naviera.</p>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>Actualizar posición</Button>
      </Card.Footer>
    </Card>
  );
}

const ACTIVOS = ['active', 'en route', 'in_transit', 'sailing'];
const ARRIBADOS = ['arrived', 'completed', 'delivered'];
function grupoDe(v) {
  const s = String(v.status || '').toLowerCase();
  if (ACTIVOS.includes(s)) return 'active';
  if (ARRIBADOS.includes(s)) return 'arrived';
  return 'other';
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */
export default function Tracking() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const barcoDelExpediente = params.get('barco') || '';
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [positions, setPositions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | arrived | other

  const listaDe = (data) => (data.success && data.vessels ? data.vessels : (Array.isArray(data) ? data : []));

  useEffect(() => {
    let vivo = true;
    getFeaturedVessels()
      .then(data => {
        if (!vivo) return;
        const list = listaDe(data);
        setVessels(list);
        setSelectedId(prev => barcoDelExpediente ? list.find(v => String(v.id) === barcoDelExpediente)?.id || null : prev || list[0]?.id || null);
      })
      .catch(e => { if (vivo) setError(e); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [barcoDelExpediente]);

  function recargar() {
    setLoading(true);
    setError(null);
    getFeaturedVessels()
      .then(data => {
        const list = listaDe(data);
        setVessels(list);
        setSelectedId(prev => barcoDelExpediente ? list.find(v => String(v.id) === barcoDelExpediente)?.id || null : prev || list[0]?.id || null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }

  // Detalle + ruta del barco seleccionado. El detalle que se pinta es solo
  // el que corresponde a la selección actual (ver `detalleActual`).
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const [detailRes, posRes] = await Promise.all([
          getVesselDetail(selectedId).catch(() => null),
          getVesselPositions(selectedId).catch(() => ({ positions: [] })),
        ]);
        if (cancelled) return;
        if (detailRes?.success && detailRes.vessel) setDetail(detailRes.vessel);
        else setDetail(vessels.find(v => v.id === selectedId) || null);
        setPositions(posRes.positions || posRes.data || []);
      } catch {
        if (!cancelled) setDetail(vessels.find(v => v.id === selectedId) || null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedId, vessels]);

  const handleSelectVessel = useCallback((id) => { setSelectedId(id); }, []);
  const detalleActual = detail && selectedId && String(detail.id) === String(selectedId) ? detail : null;
  const rutaActual = detalleActual ? positions : [];

  async function handleRefresh() {
    if (!selectedId) return;
    setRefreshing(true);
    try {
      const data = await refreshVesselPosition(selectedId);
      if (data.success) {
        toast?.('Posición actualizada', 'success');
        const [detailRes, posRes] = await Promise.all([
          getVesselDetail(selectedId).catch(() => null),
          getVesselPositions(selectedId).catch(() => ({ positions: [] })),
          getFeaturedVessels().then(d => { setVessels(listaDe(d)); }).catch(() => {}),
        ]);
        if (detailRes?.success && detailRes.vessel) setDetail(detailRes.vessel);
        setPositions(posRes?.positions || posRes?.data || []);
      } else {
        toast?.(data.error || data.message || 'No se pudo actualizar', 'warning');
      }
    } catch {
      toast?.('No se pudo actualizar la posición', 'error');
    }
    setRefreshing(false);
  }

  const conteo = useMemo(() => {
    const c = { all: vessels.length, active: 0, arrived: 0, other: 0 };
    vessels.forEach(v => { c[grupoDe(v)]++; });
    return c;
  }, [vessels]);

  const filteredVessels = useMemo(() => {
    const t = search.trim().toLowerCase();
    return vessels.filter(v => {
      if (filter !== 'all' && grupoDe(v) !== filter) return false;
      if (!t) return true;
      const hay = `${v.display_name || ''} ${v.name || v.vessel_name || ''} ${v.client_name || ''} ${v.shipping_line || ''} ${v.origin_label || ''} ${v.destination_label || ''} ${v.imo || ''} ${v.mmsi || ''}`.toLowerCase();
      return hay.includes(t);
    });
  }, [vessels, filter, search]);

  const chips = [
    { id: 'all', label: 'Todos', count: conteo.all },
    { id: 'active', label: 'En tránsito', count: conteo.active },
    { id: 'arrived', label: 'Arribados', count: conteo.arrived },
    { id: 'other', label: 'Programados', count: conteo.other },
  ];

  return (
    <div className="pb-12">
      <PageHeader
        title="Seguimiento"
        description="Dónde va el barco que trae tu embarcación: ruta, velocidad y fecha estimada de llegada."
      />

      {!loading && !error && barcoDelExpediente && !vessels.some(v => String(v.id) === barcoDelExpediente) && <Callout tone="info" title="El seguimiento de este expediente todavía no está disponible" className="mb-4">El equipo debe confirmar el barco asociado a tu envío. Te avisamos cuando puedas consultar la ruta de tu embarcación.</Callout>}

      {error ? (
        <Card padding="none"><ErrorState message="No pudimos cargar el seguimiento." detail={error} onRetry={recargar} /></Card>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 sk rounded-lg min-h-[360px] lg:min-h-[560px]" aria-hidden="true" />
          <div className="lg:col-span-4 space-y-3"><Skeleton.Card /><Skeleton.Card /><Skeleton.Card /></div>
        </div>
      ) : vessels.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Ship}
            title="No hay envíos en seguimiento"
            description="Cuando tu embarcación esté embarcada rumbo a Chile, verás aquí el barco que la trae y su posición."
            primaryAction={<Button onClick={() => navigate('/expedientes')}>Ver expedientes</Button>}
            secondaryAction={<Button variant="ghost" icon={WhatsAppIcon} onClick={() => window.open('https://wa.me/56940211459?text=Hola%2C%20no%20veo%20el%20seguimiento%20de%20mi%20env%C3%ADo', '_blank', 'noopener')}>Hablar con tu agente</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Mapa */}
          <div className="lg:col-span-8 relative rounded-lg overflow-hidden border border-line shadow-card bg-neutral-bg min-h-[360px] lg:min-h-[560px] h-[50vh] lg:h-[calc(100dvh-var(--topbar-h)-9rem)]">
            <MapaBarcos vessels={filteredVessels} positions={rutaActual} selectedId={selectedId} onSelectVessel={handleSelectVessel} />
            <div className="absolute top-3 right-3 z-[2] bg-surface/95 border border-line rounded-md px-3 py-1.5 text-xs text-ink-700 flex items-center gap-3 shadow-card pointer-events-none" aria-hidden="true">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-600 border border-white" /> Seleccionado</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-900 border border-white" /> Otros barcos</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand-600" /> Ruta recorrida</span>
            </div>
          </div>

          {/* Lista + detalle */}
          <div className="lg:col-span-4 space-y-4">
            <Card padding="none">
              <div className="px-(--card-pad) pt-4 pb-3 border-b border-line space-y-3">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar barco, naviera o puerto" size="sm" />
                <FilterChips options={chips} value={filter} onChange={setFilter} size="sm" aria-label="Estado del envío" />
              </div>
              {filteredVessels.length === 0 ? (
                <EmptyState compact title="Sin coincidencias" primaryAction={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>Limpiar filtros</Button>} />
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line max-h-[360px] overflow-y-auto scrollbar-thin" aria-label="Barcos en seguimiento">
                  {filteredVessels.map(v => (
                    <FilaBarco key={v.id} vessel={v} selected={v.id === selectedId} onClick={handleSelectVessel} />
                  ))}
                </ul>
              )}
            </Card>

            {detalleActual ? (
              <DetalleBarco vessel={detalleActual} onRefresh={handleRefresh} refreshing={refreshing} />
            ) : (
              <Card padding="none">
                <EmptyState compact icon={Ship} title="Elige un barco" description="Selecciona uno de la lista para ver su detalle y su posición." />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
