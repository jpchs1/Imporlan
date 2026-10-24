import { useState, useEffect, useCallback } from 'react';
import { getExpedienteFiles } from '../api';

/**
 * Archivos de un expediente, pedidos una sola vez por pantalla y compartidos
 * entre la sección Archivos y el bloque «Operación en EE. UU.» (que muestra
 * los de cada actualización por id). `recargar()` tras subir, borrar o
 * compartir (compartir hace visibles los documentos de esa actualización).
 */
export function useExpedienteFiles(orderId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getExpedienteFiles(orderId);
      if (!data.success || !Array.isArray(data.files)) throw new Error(data.error || 'No se pudieron cargar los archivos.');
      setFiles(data.files);
    } catch (e) { setError(e.message || 'Error al cargar archivos.'); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    return () => clearTimeout(t);
  }, [recargar]);

  return { files, loading, error, recargar };
}

export { categoriaArchivo } from '../../shared/lib/file-collection';
