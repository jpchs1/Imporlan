import { useState, useEffect, useCallback, useRef } from 'react';
import { getExpedienteFiles } from '../api';

/**
 * Archivos de un expediente, pedidos una sola vez por pantalla y compartidos
 * entre la sección Archivos y el bloque «Operación en EE. UU.» (que muestra
 * los de cada actualización por id). `recargar()` tras subir, borrar o
 * compartir (compartir hace visibles los documentos de esa actualización).
 */
export function useExpedienteFiles(orderId) {
  const [state, setState] = useState({ orderId, files: [], loading: true, error: '' });
  const activeOrder = useRef(orderId);
  const generation = useRef(0);
  const mounted = useRef(true);
  activeOrder.current = orderId;

  const recargar = useCallback(async () => {
    const request = ++generation.current;
    const current = () => mounted.current && activeOrder.current === orderId && request === generation.current;
    if (!orderId) return;
    setState(prev => ({ orderId, files: prev.orderId === orderId ? prev.files : [], loading: true, error: '' }));
    try {
      const data = await getExpedienteFiles(orderId);
      if (!data.success || !Array.isArray(data.files)) throw new Error(data.error || 'No se pudieron cargar los archivos.');
      if (current()) setState({ orderId, files: data.files, loading: false, error: '' });
    } catch (e) {
      if (current()) setState(prev => ({ ...prev, loading: false, error: e.message || 'Error al cargar archivos.' }));
    }
  }, [orderId]);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(recargar, 0);
    return () => { clearTimeout(t); mounted.current = false; };
  }, [recargar]);

  const visible = state.orderId === orderId ? state : { files: [], loading: !!orderId, error: '' };
  return { files: visible.files, loading: visible.loading, error: visible.error, recargar };
}

export { categoriaArchivo } from '../../shared/lib/file-collection';
