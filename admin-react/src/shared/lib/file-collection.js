import { dateValue } from './utils';

export function normalizarBusqueda(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

export function categoriaArchivo(file) {
  if (file?.category) return file.category;
  const mime = file?.mime_type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || /word|excel|sheet|presentation|text/.test(mime)) return 'document';
  return 'other';
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Returns original objects in a new array: a filtered photo must still map
 * to the correct original file in the lightbox, without changing saved data. */
export function seleccionarArchivos(files, { query = '', category = 'all', sort = 'newest' } = {}) {
  const term = normalizarBusqueda(query);
  return files.map((file, index) => ({ file, index }))
    .filter(({ file }) => (category === 'all' || categoriaArchivo(file) === category)
      && (!term || normalizarBusqueda(`${file.original_name || ''} ${file.description || ''} ${file.mime_type || ''}`).includes(term)))
    .sort((a, b) => {
      if (sort === 'name') return collator.compare(a.file.original_name || '', b.file.original_name || '') || a.index - b.index;
      const first = dateValue(a.file.created_at), second = dateValue(b.file.created_at);
      if (!first || !second) return first ? -1 : second ? 1 : a.index - b.index;
      return (sort === 'oldest' ? first - second : second - first) || a.index - b.index;
    }).map(({ file }) => file);
}
