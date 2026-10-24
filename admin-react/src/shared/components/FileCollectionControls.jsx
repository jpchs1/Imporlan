import { SearchInput } from './SearchInput';
import { Select } from './Field';
import { FilterChips } from './FilterChips';
import { Button } from './Button';
import { categoriaArchivo, seleccionarArchivos } from '../lib/file-collection';

const categories = [
  { id: 'image', label: 'Fotos' }, { id: 'video', label: 'Videos' },
  { id: 'document', label: 'Documentos' }, { id: 'other', label: 'Otros' },
];
const orderOptions = [
  { value: 'newest', label: 'Más recientes' }, { value: 'oldest', label: 'Más antiguos' },
  { value: 'name', label: 'Nombre: A–Z' },
];

/** Common discovery controls for authorized files in both panels. */
export function FileCollectionControls({ files, query, onQuery, category, onCategory, sort, onSort, onClear, count, loading, children }) {
  const matches = seleccionarArchivos(files, { query });
  const filters = [{ id: 'all', label: 'Todos', count: matches.length },
    ...categories.map(item => ({ ...item, count: matches.filter(file => categoriaArchivo(file) === item.id).length }))
      .filter(item => item.id !== 'other' || item.count > 0 || category === 'other')];
  const filtered = !!query.trim() || category !== 'all';
  return <div className="exp-collection-controls p-4 border-b border-line space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchInput value={query} onChange={onQuery} aria-label="Buscar archivos" placeholder="Buscar por nombre o descripción" className="flex-1 min-w-0" />
      <Select value={sort} onChange={e => onSort(e.target.value)} options={orderOptions} aria-label="Ordenar archivos" className="sm:w-44" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <FilterChips options={filters} value={category} onChange={onCategory} aria-label="Filtrar archivos por tipo" className="max-w-full" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" aria-live="polite" className="text-xs text-ink-500">{loading ? 'Actualizando archivos…' : `${count} de ${files.length} archivo${files.length === 1 ? '' : 's'}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        {filtered && <Button variant="ghost" size="sm" onClick={onClear} aria-label="Limpiar filtros de archivos">Limpiar filtros</Button>}
        {children}
      </div>
    </div>
  </div>;
}
