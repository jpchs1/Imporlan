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

  const recargar = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = await getExpedienteFiles(orderId);
      setFiles(data.success && data.files ? data.files : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const t = setTimeout(recargar, 0);
    return () => clearTimeout(t);
  }, [recargar]);

  return { files, loading, recargar };
}

/** Categoría de un archivo por su MIME (la misma que calcula el servidor). */
export function categoriaArchivo(f) {
  if (f?.category) return f.category;
  const mime = f?.mime_type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('excel') || mime.includes('sheet') || mime.includes('presentation') || mime.includes('text')) return 'document';
  return 'other';
}
