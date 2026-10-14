import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const VISTA_INICIAL = { centro: [-20, -75], zoom: 3 };

function coordenadas(positions) {
  return (positions || [])
    .map(p => [parseFloat(p.lat), parseFloat(p.lon ?? p.lng)])
    .filter(([a, b]) => isFinite(a) && isFinite(b));
}

/** Color de un token del sistema (Leaflet necesita el valor, no la variable). */
function token(nombre, fallback) {
  const v = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() : '';
  return v || fallback;
}

function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Mapa de posiciones de una embarcación. El mapa (Leaflet, desde
 * node_modules) se crea una sola vez; al cambiar `positions` o `vessel` solo
 * se redibuja la capa de marcadores. Así no hay parpadeo ni errores de
 * `_leaflet_pos` al desmontar.
 *
 *   <MapaBarco positions={pos} vessel={barco} className="h-[420px]" />
 */
export function MapaBarco({ positions, vessel, className = 'h-[420px]' }) {
  const ref = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: false })
      .setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom);
    // Atribución sin el enlace "Leaflet" (texto plano: axe no lo marca como enlace sin subrayar).
    L.control.attribution({ prefix: false }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 18 }).addTo(map);
    capa.current = L.layerGroup().addTo(map);
    mapa.current = map;
    return () => { map.remove(); mapa.current = null; capa.current = null; };
  }, []);

  useEffect(() => {
    const map = mapa.current;
    const grupo = capa.current;
    if (!map || !grupo) return;
    grupo.clearLayers();
    const coords = coordenadas(positions);
    if (!coords.length) {
      map.setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom);
      return;
    }
    const marca = token('--color-brand-600', '#0e7490');
    const gris = token('--color-ink-500', '#64748b');
    const superficie = token('--color-surface', '#ffffff');
    if (coords.length > 1) {
      L.polyline(coords, { color: marca, weight: 2, opacity: 0.8, dashArray: '6 4' }).addTo(grupo);
    }
    const [ultima, ...anteriores] = coords;
    anteriores.forEach(c => {
      L.circleMarker(c, { radius: 3, color: gris, fillColor: gris, fillOpacity: 0.7, weight: 1 }).addTo(grupo);
    });
    const icono = L.divIcon({
      html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${marca};border:3px solid ${superficie};box-shadow:0 1px 3px rgba(15,23,42,.35)"></span>`,
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
    });
    L.marker(ultima, { icon: icono, title: vessel?.display_name || vessel?.name || 'Posición actual' })
      .bindPopup(`<b>${escapar(vessel?.display_name || vessel?.name || 'Posición actual')}</b><br>Lat ${ultima[0].toFixed(4)} · Lon ${ultima[1].toFixed(4)}`)
      .addTo(grupo);
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords).pad(0.15));
    else map.setView(ultima, 6);
    // El contenedor puede haber cambiado de tamaño mientras no se veía.
    setTimeout(() => map.invalidateSize(), 0);
  }, [positions, vessel]);

  return <div ref={ref} className={`w-full rounded-lg border border-line overflow-hidden ${className}`} role="region" aria-label="Mapa de posiciones" />;
}
