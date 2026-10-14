import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Carga de datos de una pantalla del admin: `datos`, `cargando`, `error` y
 * `recargar()`. El `fetcher` debe ser estable (función de módulo o useCallback).
 *
 *   const { datos, cargando, error, recargar } = useCarga(getPurchases);
 *
 * La primera carga no toca el estado antes del `await` (ya nace cargando);
 * `recargar` sí marca cargando para que la tabla muestre el skeleton.
 * Si se dispara dos veces seguidas, solo cuenta la última respuesta.
 */
export function useCarga(fetcher, { inicial = null, mensaje = 'No se pudieron cargar los datos' } = {}) {
  const [datos, setDatos] = useState(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const req = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++req.current;
    try {
      const d = await fetcher();
      if (req.current !== n) return;
      setDatos(d);
      setError('');
    } catch (e) {
      if (req.current !== n) return;
      setError(e?.message || mensaje);
    } finally {
      if (req.current === n) setCargando(false);
    }
  }, [fetcher, mensaje]);

  const recargar = useCallback(() => {
    setCargando(true);
    setError('');
    cargar();
  }, [cargar]);

  /** Vuelve a pedir los datos sin skeleton (la tabla se queda como está). */
  const refrescar = cargar;

  useEffect(() => { cargar(); }, [cargar]);

  return { datos, cargando, error, recargar, refrescar, setDatos };
}
