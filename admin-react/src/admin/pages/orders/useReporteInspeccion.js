import { useState, useEffect, useCallback, useRef } from 'react';
import { reporteInspeccion } from '../../api';

/** Cada cuánto se pregunta por la traducción mientras sigue pendiente. */
export const SONDEO_TRADUCCION_MS = 15000;

/**
 * El reporte de inspección de un expediente para el visor (GET
 * admin_inspeccion_reporte: original + traducción en bloques) y el estado de
 * la traducción al español, que se sondea cada 15 s mientras siga
 * 'pendiente' (el servidor la hace en segundo plano, de 1 a 5 minutos).
 *
 * `reporte` es `eleccion.inspection_report` del detalle ({at, file_id,
 * summary, es_status, es_at} o null). Cuando cambia (se reemplazó el reporte
 * o el detalle ya trae otro estado) se descarta lo cargado.
 *
 * `onEstado(status)` avisa cuando el sondeo ve que la traducción terminó
 * ('listo' o 'error'): el contenedor relee el detalle para que todo cuadre.
 */
export function useReporteInspeccion(orderId, reporte, { onEstado } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const onEstadoRef = useRef(onEstado);
  useEffect(() => { onEstadoRef.current = onEstado; }, [onEstado]);

  const clave = reporte ? `${reporte.at}|${reporte.file_id}|${reporte.es_status}` : '';
  useEffect(() => { setData(null); setError(null); }, [clave]);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!orderId || !clave) return null;
    if (!silencioso) { setLoading(true); setError(null); }
    try {
      const r = await reporteInspeccion(orderId);
      setData(r);
      if (!silencioso) setError(null);
      return r;
    } catch (e) {
      if (!silencioso) setError(e.message || 'No se pudo cargar el reporte');
      return null;
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [orderId, clave]);

  // El estado más nuevo manda: lo que vio el sondeo si ya terminó; si no, el
  // del detalle; si los dos dicen pendiente, pendiente.
  const deData = data?.es?.status || null;
  const deDetalle = reporte?.es_status || null;
  const esStatus = deData && deData !== 'pendiente' ? deData : deDetalle && deDetalle !== 'pendiente' ? deDetalle : (deData || deDetalle);
  const esAt = (deData && deData !== 'pendiente' ? data?.es?.at : null) || reporte?.es_at || null;

  useEffect(() => {
    if (esStatus !== 'pendiente') return undefined;
    const t = setInterval(async () => {
      const r = await cargar({ silencioso: true });
      const st = r?.es?.status;
      if (st && st !== 'pendiente') onEstadoRef.current?.(st, r);
    }, SONDEO_TRADUCCION_MS);
    return () => clearInterval(t);
  }, [esStatus, cargar]);

  return { data, loading, error, cargar, esStatus, esAt };
}
