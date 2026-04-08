import { useState, useEffect, useRef, useCallback } from 'react';
import { getFeaturedVessels, getVesselDetail, getVesselPositions, refreshVesselPosition } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { Card, Badge, Button, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  arrived: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
};

// --- Leaflet loader (idempotent) ---
function useLeaflet() {
  const [loaded, setLoaded] = useState(!!window.L);
  useEffect(() => {
    if (window.L) { setLoaded(true); return; }
    // Avoid duplicate loads
    if (document.querySelector('script[src*="leaflet@1.9.4"]')) {
      const check = setInterval(() => { if (window.L) { setLoaded(true); clearInterval(check); } }, 100);
      return () => clearInterval(check);
    }
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

// --- Map Component ---
function VesselMap({ vessels, positions, selectedId, onSelectVessel }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;

    // Clean up
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    markersRef.current = [];

    const map = L.map(mapRef.current).setView([-15, -70], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapInstance.current = map;

    // Plot all vessel markers
    const bounds = [];
    (vessels || []).forEach(v => {
      if (!v.lat || !v.lon) return;
      const lat = parseFloat(v.lat);
      const lon = parseFloat(v.lon);
      if (isNaN(lat) || isNaN(lon)) return;
      bounds.push([lat, lon]);

      const isSelected = v.id === selectedId;
      const color = isSelected ? '#0891b2' : '#0f172a';
      const icon = L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="background:${color};width:12px;height:12px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
          <span style="font-size:10px;font-weight:600;color:${color};white-space:nowrap;margin-top:2px;text-shadow:0 0 3px white,0 0 3px white">${v.display_name || ''}</span>
        </div>`,
        className: '', iconSize: [120, 36], iconAnchor: [60, 6],
      });

      const marker = L.marker([lat, lon], { icon })
        .bindPopup(`<b>${v.display_name || 'Barco'}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}${v.speed ? `<br>Velocidad: ${v.speed} kn` : ''}`)
        .addTo(map);
      marker.on('click', () => onSelectVessel(v.id));
      markersRef.current.push(marker);
    });

    // Plot route for selected vessel
    if (positions?.length > 1) {
      const coords = positions.map(p => [parseFloat(p.lat), parseFloat(p.lon || p.lng)]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
      if (coords.length > 1) {
        L.polyline(coords, { color: '#6366f1', weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map);
        coords.slice(1).forEach(c => {
          L.circleMarker(c, { radius: 3, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.6, weight: 1 }).addTo(map);
        });
        coords.forEach(c => { if (!bounds.some(b => b[0] === c[0] && b[1] === c[1])) bounds.push(c); });
      }
    }

    // Fit bounds
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.15));
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 6);
    }

    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [vessels, positions, selectedId, onSelectVessel]);

  return <div ref={mapRef} className="h-full min-h-[400px] rounded-xl border border-slate-200" style={{ zIndex: 1 }} />;
}

// --- Vessel Card ---
function VesselCard({ vessel, selected, onClick }) {
  return (
    <div
      onClick={() => onClick(vessel.id)}
      className={cn(
        'p-3 rounded-xl border cursor-pointer transition-all',
        selected
          ? 'border-cyan-300 bg-cyan-50/50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-semibold text-sm text-slate-800 truncate">{vessel.display_name || 'Sin nombre'}</p>
        <Badge className={STATUS_COLORS[vessel.status] || STATUS_COLORS.inactive}>
          {vessel.status || 'N/A'}
        </Badge>
      </div>
      {vessel.client_name && (
        <p className="text-[11px] text-cyan-600 font-medium">{vessel.client_name}</p>
      )}
      {vessel.shipping_line && (
        <p className="text-[11px] text-slate-400">{vessel.shipping_line}</p>
      )}
      {(vessel.origin_label || vessel.destination_label) && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
          {vessel.origin_label && <span className="truncate">{vessel.origin_label}</span>}
          {vessel.origin_label && vessel.destination_label && (
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          )}
          {vessel.destination_label && <span className="truncate font-medium">{vessel.destination_label}</span>}
        </div>
      )}
      {vessel.speed && (
        <p className="text-[11px] text-slate-400 mt-1">{vessel.speed} kn</p>
      )}
    </div>
  );
}

// --- Detail Panel ---
function VesselDetailPanel({ vessel, onRefresh, refreshing }) {
  if (!vessel) return null;

  const eta = vessel.eta_manual || vessel.pos_eta;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-800 text-lg">{vessel.display_name}</h3>
        {vessel.shipping_line && <p className="text-sm text-slate-400">{vessel.shipping_line}</p>}
      </div>

      {/* Info section */}
      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">Informacion</p>
        <div className="space-y-1.5 text-sm">
          {vessel.client_name && <div className="flex justify-between"><span className="text-slate-400 text-xs">Cliente</span><span className="text-slate-700 font-medium text-xs">{vessel.client_name}</span></div>}
          {vessel.shipping_line && <div className="flex justify-between"><span className="text-slate-400 text-xs">Naviera</span><span className="text-slate-700 text-xs">{vessel.shipping_line}</span></div>}
          {vessel.imo && <div className="flex justify-between"><span className="text-slate-400 text-xs">IMO</span><span className="text-slate-700 font-mono text-xs">{vessel.imo}</span></div>}
          {vessel.mmsi && <div className="flex justify-between"><span className="text-slate-400 text-xs">MMSI</span><span className="text-slate-700 font-mono text-xs">{vessel.mmsi}</span></div>}
          {vessel.origin_label && <div className="flex justify-between"><span className="text-slate-400 text-xs">Origen</span><span className="text-slate-700 text-xs">{vessel.origin_label}</span></div>}
          {vessel.destination_label && <div className="flex justify-between"><span className="text-slate-400 text-xs">Destino</span><span className="text-slate-700 font-medium text-xs">{vessel.destination_label}</span></div>}
          {eta && <div className="flex justify-between"><span className="text-slate-400 text-xs">ETA</span><span className="text-slate-700 text-xs">{fmtDate(eta)}</span></div>}
          <div className="flex justify-between"><span className="text-slate-400 text-xs">Estado</span><Badge className={cn(STATUS_COLORS[vessel.status] || STATUS_COLORS.inactive, 'text-[10px]')}>{vessel.status || 'N/A'}</Badge></div>
        </div>
      </div>

      {(vessel.lat && vessel.lon) && (
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Posicion Actual</p>
          <p className="text-sm text-slate-700 font-mono">
            {parseFloat(vessel.lat).toFixed(4)}, {parseFloat(vessel.lon).toFixed(4)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            {vessel.speed && <span>Velocidad: {vessel.speed} kn</span>}
            {vessel.course && <span>Rumbo: {parseFloat(vessel.course).toFixed(0)}°</span>}
          </div>
          {vessel.last_position_update && (
            <p className="text-[11px] text-slate-400 mt-1">Actualizado: {fmtDate(vessel.last_position_update)}</p>
          )}
        </div>
      )}

      {vessel.client_name && (
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Cliente</p>
          <p className="text-sm text-slate-700">{vessel.client_name}</p>
        </div>
      )}

      <Button
        variant="accent"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="w-full flex items-center justify-center gap-1.5"
      >
        <svg className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        {refreshing ? 'Actualizando...' : 'Actualizar Posicion'}
      </Button>
    </div>
  );
}

// --- Main Page ---
export default function Tracking() {
  const toast = useToast();
  const leafletLoaded = useLeaflet();
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [positions, setPositions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadVessels = useCallback(async () => {
    try {
      const data = await getFeaturedVessels();
      const list = data.success && data.vessels ? data.vessels : (Array.isArray(data) ? data : []);
      setVessels(list);
      setSelectedId(prev => (prev || (list.length > 0 ? list[0].id : null)));
    } catch (e) {
      toast?.('Error al cargar seguimiento', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadVessels(); }, [loadVessels]);

  // Load detail + positions when selection changes
  useEffect(() => {
    if (!selectedId) { setDetail(null); setPositions([]); return; }
    let cancelled = false;

    async function load() {
      try {
        const [detailRes, posRes] = await Promise.all([
          getVesselDetail(selectedId).catch(() => null),
          getVesselPositions(selectedId).catch(() => ({ positions: [] })),
        ]);
        if (cancelled) return;
        if (detailRes?.success && detailRes.vessel) {
          setDetail(detailRes.vessel);
        } else {
          // Fallback to vessel from list
          setDetail(vessels.find(v => v.id === selectedId) || null);
        }
        setPositions(posRes.positions || posRes.data || []);
      } catch (e) {
        if (!cancelled) setDetail(vessels.find(v => v.id === selectedId) || null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedId, vessels]);

  const handleSelectVessel = useCallback((id) => {
    setSelectedId(id);
  }, []);

  async function handleRefresh() {
    if (!selectedId) return;
    setRefreshing(true);
    try {
      const data = await refreshVesselPosition(selectedId);
      if (data.success) {
        toast?.('Posicion actualizada', 'success');
        // Reload everything
        const [detailRes, posRes] = await Promise.all([
          getVesselDetail(selectedId).catch(() => null),
          getVesselPositions(selectedId).catch(() => ({ positions: [] })),
          getFeaturedVessels().then(d => {
            const list = d.success && d.vessels ? d.vessels : (Array.isArray(d) ? d : []);
            setVessels(list);
          }).catch(() => {}),
        ]);
        if (detailRes?.success && detailRes.vessel) setDetail(detailRes.vessel);
        setPositions(posRes?.positions || posRes?.data || []);
      } else {
        toast?.(data.error || data.message || 'No se pudo actualizar', 'warning');
      }
    } catch (e) {
      toast?.('Error al actualizar posicion', 'error');
    }
    setRefreshing(false);
  }

  if (loading || !leafletLoaded) return <Spinner />;

  if (vessels.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Seguimiento</h1>
          <p className="text-sm text-slate-400 mt-1">Rastrea tus envios en tiempo real</p>
        </div>
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <p className="text-lg font-bold text-slate-700">No hay envios en seguimiento</p>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">Cuando tu importacion este en camino, podras ver la ubicacion en tiempo real de tu embarcacion aqui.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Seguimiento</h1>
        <p className="text-sm text-slate-400 mt-1">{vessels.length} envio{vessels.length !== 1 ? 's' : ''} activo{vessels.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        {/* Left: vessel list */}
        <div className="lg:col-span-3 overflow-y-auto space-y-2">
          {vessels.map(v => (
            <VesselCard
              key={v.id}
              vessel={v}
              selected={v.id === selectedId}
              onClick={handleSelectVessel}
            />
          ))}
        </div>

        {/* Center: map */}
        <div className="lg:col-span-6">
          <VesselMap
            vessels={vessels}
            positions={positions}
            selectedId={selectedId}
            onSelectVessel={handleSelectVessel}
          />
        </div>

        {/* Right: detail */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            {detail ? (
              <VesselDetailPanel
                vessel={detail}
                onRefresh={handleRefresh}
                refreshing={refreshing}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-slate-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                <p className="text-sm text-slate-400">Selecciona un envio</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
