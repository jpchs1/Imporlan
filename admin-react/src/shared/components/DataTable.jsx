import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, EllipsisVertical } from './Icons';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { Menu } from './Menu';
import { IconButton } from './Button';

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };
const PRIORITY = { 1: '', 2: 'hidden lg:table-cell', 3: 'hidden xl:table-cell' };

function useScrollShadow() {
  const ref = useRef(null);
  const [shadow, setShadow] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
    setShadow(s => (s.left === left && s.right === right ? s : { left, right }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); window.removeEventListener('resize', update); };
  }, [update]);
  return [ref, shadow];
}

/**
 * Tabla de datos.
 *
 * columns: [{ key, header, cell(row), sortValue(row), align, width, priority, mono, className }]
 *   - ordenable si trae `sortValue` o `key`
 *   - priority: 1 siempre visible · 2 se oculta < lg · 3 se oculta < xl
 * data, rowKey(row) · onRowClick(row) (fila accesible: Tab + Enter)
 * rowActions(row) → [{ label, icon, onClick, tone: 'danger', disabled }]  (menú ⋯)
 * emptyState (nodo) o emptyMsg · loading (+ loadingRows) · pageSize (0 = sin paginar)
 * mobileCard(row) → tarjeta en < md (si no, scroll horizontal con sombra)
 * bleed: la tabla sangra hasta el borde de la Card con padding (alias Table)
 *
 * Paginación y orden en el servidor:
 *   - `onPageChange(p)`: la tabla deja de recortar `data` (el servidor manda la
 *     página) y avisa el cambio. Con `page` la página es controlada (0-based);
 *     sin `page`, la tabla igual lleva el indicador por su cuenta. `total` es
 *     el total de filas para calcular las páginas.
 *   - `onSortChange({ col, dir, key })`: la tabla no ordena. Con `sort`
 *     ({ col: índice | key, dir }) el orden es controlado y alterna al volver a
 *     hacer clic en la misma columna; sin `sort`, lo lleva por su cuenta.
 */
export function DataTable({
  columns = [], data = [], rowKey, onRowClick, rowActions,
  emptyMsg = 'Sin datos', emptyState, loading = false, loadingRows = 5,
  pageSize = 50, page: pageProp, onPageChange, sort: sortProp, onSortChange, total,
  mobileCard, stickyHeader = true, bleed = false, className, 'aria-label': ariaLabel, caption,
  rowClassName, footer, dense,
}) {
  const [sortState, setSortState] = useState(sortProp || { col: null, dir: 'desc' });
  const [pageState, setPageState] = useState(0);
  const sort = sortProp || sortState;
  const page = pageProp ?? pageState;
  const [scrollRef, shadow] = useScrollShadow();

  const sorted = useMemo(() => {
    if (sort.col === null || sort.col === undefined || onSortChange) return data;
    const col = typeof sort.col === 'number' ? columns[sort.col] : columns.find(c => c.key === sort.col);
    const get = col?.sortValue || (col?.key ? (r => r[col.key]) : null);
    if (!get) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = get(a), vb = get(b);
      const na = va === null || va === undefined || va === '';
      const nb = vb === null || vb === undefined || vb === '';
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      const cmp = (typeof va === 'number' && typeof vb === 'number')
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, columns, sort, onSortChange]);

  const count = total ?? sorted.length;
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(count / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize > 0 && !onPageChange ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  // Sin `page` el estado interno se actualiza siempre (aunque haya
  // onPageChange): así el indicador "Página 2 de 5" no se queda pegado.
  function setPage(p) {
    if (pageProp === undefined || pageProp === null) setPageState(p);
    onPageChange?.(p);
  }
  // Activa si el orden apunta a esta columna por índice o por `key`.
  const isSortCol = (col, i) => sort.col === i || (col.key !== undefined && col.key !== null && sort.col === col.key);
  function toggleSort(i) {
    const col = columns[i];
    if (!col.sortValue && !col.key) return;
    const next = isSortCol(col, i) ? { col: i, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { col: i, dir: 'desc' };
    if (onSortChange) onSortChange({ ...next, key: col.key }); else setSortState(next);
    setPage(0);
  }

  const hasActions = typeof rowActions === 'function';
  const keyOf = (row, i) => (rowKey ? rowKey(row) : (row.id ?? i));
  const clickable = typeof onRowClick === 'function';

  const onRowKey = (e, row) => {
    if (!clickable) return;
    if (e.target !== e.currentTarget) return; // no robar Enter de botones dentro de la fila
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
  };

  const thCls = 'px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap select-none bg-canvas border-b border-line';
  const tdCls = cn('px-4 text-body text-ink-700 align-middle border-b border-line', dense ? 'py-2' : 'py-2.5');

  const empty = !loading && visible.length === 0;

  const tabla = (
    <div
      ref={scrollRef}
      className={cn('overflow-x-auto scrollbar-thin', mobileCard && 'hidden md:block')}
    >
      <table className="w-full border-collapse" aria-label={ariaLabel}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className={cn(stickyHeader && 'sticky top-0 z-[1]')}>
          <tr>
            {columns.map((col, i) => {
              const sortable = !!(col.sortValue || col.key);
              const active = isSortCol(col, i);
              return (
                <th
                  key={col.key || i}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : (sortable ? 'none' : undefined)}
                  className={cn(thCls, ALIGN[col.align] || ALIGN.left, PRIORITY[col.priority] || '', col.headerClassName)}
                >
                  {sortable ? (
                    <button type="button" onClick={() => toggleSort(i)}
                      className={cn('inline-flex items-center gap-1 rounded hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500', active && 'text-ink-900', col.align === 'right' && 'flex-row-reverse')}>
                      {col.header}
                      {active ? (sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} className="text-ink-400" />}
                    </button>
                  ) : col.header}
                </th>
              );
            })}
            {hasActions && <th scope="col" className={cn(thCls, 'w-12')}><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, r) => (
              <tr key={`sk-${r}`} className="h-(--density-row)">
                {columns.map((col, c) => (
                  <td key={c} className={cn(tdCls, PRIORITY[col.priority] || '')}><Skeleton className={cn('h-3.5', c === 0 ? 'w-3/4' : 'w-1/2')} /></td>
                ))}
                {hasActions && <td className={tdCls} />}
              </tr>
            ))
          ) : empty ? (
            <tr>
              <td colSpan={columns.length + (hasActions ? 1 : 0)} className="p-0">
                {emptyState || <EmptyState compact title={emptyMsg} />}
              </td>
            </tr>
          ) : visible.map((row, i) => (
            <tr
              key={keyOf(row, i)}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? (e) => { if (e.defaultPrevented) return; onRowClick(row); } : undefined}
              onKeyDown={clickable ? (e) => onRowKey(e, row) : undefined}
              className={cn(
                'h-(--density-row) transition-colors duration-150',
                clickable && 'cursor-pointer hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
                typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
              )}
            >
              {columns.map((col, j) => (
                <td key={col.key || j} className={cn(tdCls, ALIGN[col.align] || ALIGN.left, PRIORITY[col.priority] || '', col.mono && 'font-mono text-13', col.className)}>
                  {col.cell ? col.cell(row) : row[col.key]}
                </td>
              ))}
              {hasActions && (
                <td className={cn(tdCls, 'text-right')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <RowMenu items={rowActions(row)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={cn(bleed && '-mx-(--card-pad)', className)}>
      <div className="dt-scroll" data-shadow-left={shadow.left} data-shadow-right={shadow.right}>
        {tabla}
      </div>
      {mobileCard && (
        <div className="md:hidden divide-y divide-line">
          {loading ? (
            Array.from({ length: Math.min(loadingRows, 3) }).map((_, r) => (
              <div key={`skm-${r}`} className="px-(--card-pad) py-3"><Skeleton.Text lines={2} /></div>
            ))
          ) : empty ? (emptyState || <EmptyState compact title={emptyMsg} />) : visible.map((row, i) => (
            <div
              key={keyOf(row, i)}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onRowClick(row) : undefined}
              onKeyDown={clickable ? (e) => onRowKey(e, row) : undefined}
              className={cn('px-(--card-pad) py-3 flex items-start gap-3', clickable && 'cursor-pointer hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500')}
            >
              <div className="flex-1 min-w-0">{mobileCard(row)}</div>
              {hasActions && <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><RowMenu items={rowActions(row)} /></div>}
            </div>
          ))}
        </div>
      )}
      {(pages > 1 || footer) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-(--card-pad) py-3 text-13 text-ink-500 border-t border-line">
          <span className="tabular">{footer || `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, count)} de ${count}`}</span>
          {pages > 1 && (
            <nav aria-label="Paginación" className="flex items-center gap-1">
              <IconButton icon={ChevronLeft} size="sm" variant="secondary" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} />
              <span className="px-2 tabular">Página {current + 1} de {pages}</span>
              <IconButton icon={ChevronRight} size="sm" variant="secondary" aria-label="Página siguiente" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

function RowMenu({ items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return <Menu items={list} label="Más acciones" trigger={<IconButton icon={EllipsisVertical} size="sm" aria-label="Más acciones" />} />;
}
