import { useState, useMemo } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtUSD, fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, SearchInput, Select, SegmentedControl, FilterChips, DataTable, EmptyState, Spinner, Badge } from '../../../shared/components/UI';
import { Send, LayoutGrid, List, ExternalLink, ClipboardCheck, Search } from '../../../shared/components/Icons';
import TarjetaEmbarcacion from './TarjetaEmbarcacion';
import { tituloEmbarcacion, estaVendida, tienePrecio, urlAbsoluta } from './lib';

const ORDEN = [
  { value: 'rank', label: 'Mi ranking' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'year_desc', label: 'Más nuevas primero' },
  { value: 'year_asc', label: 'Más antiguas primero' },
];

const VISTAS = [
  { id: 'cards', label: 'Tarjetas', icon: LayoutGrid, hideLabel: true },
  { id: 'table', label: 'Tabla', icon: List, hideLabel: true },
];

/**
 * El ranking del cliente: lista de TarjetaEmbarcacion (reordenable) o tabla.
 * La lógica de guardar/notificar/arrastrar viene del detalle; aquí solo se
 * filtra, ordena y pinta.
 */
export default function RankingEmbarcaciones({ order, links, saving, notifying, onNotify, dnd, onMoveUp, onMoveDown, onRequestInspection, onPreviewImage }) {
  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState([]);
  const [sortBy, setSortBy] = useState('rank');
  const [viewMode, setViewMode] = useState('cards');

  const displayed = useMemo(() => {
    const term = search.trim().toLowerCase();
    let out = links.filter(l => {
      if (filtros.includes('foto') && !l.image_url) return false;
      if (filtros.includes('precio') && !tienePrecio(l)) return false;
      if (filtros.includes('disponibles') && estaVendida(l)) return false;
      if (term) {
        const hay = [l.title, l.make, l.model, l.year, l.location, l.engine, l.comments].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    if (sortBy === 'price_asc') out = [...out].sort((a, b) => (a.value_usa_usd || a.value_chile_clp || Infinity) - (b.value_usa_usd || b.value_chile_clp || Infinity));
    else if (sortBy === 'price_desc') out = [...out].sort((a, b) => (b.value_usa_usd || b.value_chile_clp || 0) - (a.value_usa_usd || a.value_chile_clp || 0));
    else if (sortBy === 'year_desc') out = [...out].sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sortBy === 'year_asc') out = [...out].sort((a, b) => (a.year || Infinity) - (b.year || Infinity));
    return out;
  }, [links, search, filtros, sortBy]);

  const hayFiltro = search.trim() !== '' || filtros.length > 0 || sortBy !== 'rank';
  const limpiar = () => { setSearch(''); setFiltros([]); setSortBy('rank'); };
  const isRankView = sortBy === 'rank' && viewMode === 'cards';
  const n = links.length;

  const quien = order.ranking_author_role === 'admin' ? 'el equipo Imporlan' : (order.ranking_author_name ? 'ti' : '');
  const ultimoCambio = order.ranking_author_name
    ? `Último cambio por ${quien === 'ti' ? 'ti' : quien}${order.ranking_updated_at ? ` · ${fmtRelativo(order.ranking_updated_at)}` : ''}`
    : null;

  const columnas = [
    { key: 'rank', header: 'N°', width: 56, align: 'center', cell: r => <span className="font-semibold text-ink-900 tabular">{links.indexOf(r) + 1}</span>, sortValue: r => links.indexOf(r) },
    {
      key: 'title', header: 'Embarcación', sortValue: r => tituloEmbarcacion(r),
      cell: r => (
        <div className="min-w-0">
          <p className={cn('font-medium', estaVendida(r) ? 'text-ink-500' : 'text-ink-900')}>{tituloEmbarcacion(r)} {estaVendida(r) && <Badge tone="neutral" size="sm" className="ml-1">{r.link_status === 'sold' ? 'Vendida' : 'No disponible'}</Badge>}</p>
          {r.engine && r.engine !== tituloEmbarcacion(r) && <p className="text-13 text-ink-500 truncate">{r.engine}</p>}
        </div>
      ),
    },
    { key: 'location', header: 'Ubicación', priority: 2, cell: r => r.location || '—' },
    { key: 'value_usa_usd', header: 'En EE. UU.', align: 'right', cell: r => <span className="tabular">{Number(r.value_usa_usd) > 0 ? fmtUSD(r.value_usa_usd) : '—'}</span>, sortValue: r => Number(r.value_usa_usd) || null },
    { key: 'value_chile_clp', header: 'Puesto en Chile', align: 'right', cell: r => <span className="tabular font-medium text-ink-900">{Number(r.value_chile_clp) > 0 ? fmtCLP(r.value_chile_clp) : '—'}</span>, sortValue: r => Number(r.value_chile_clp) || null },
  ];

  return (
    <Card>
      <Card.Header
        title="Ranking de embarcaciones"
        description={ultimoCambio || 'Las opciones que encontró tu agente, en el orden que tú prefieras.'}
      >
        {order.ranking_updated_at && <span className="sr-only">{fmtDateLarga(order.ranking_updated_at, { hora: true })}</span>}
      </Card.Header>

      <Card.Body className="space-y-3" padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-13 text-ink-500">
            Arrastra o usa las flechas para ordenar tu preferencia; el orden se guarda solo. {n} {n === 1 ? 'embarcación' : 'embarcaciones'}.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {saving && <span className="inline-flex items-center gap-1.5 text-13 text-ink-500" role="status"><Spinner inline size="sm" label="Guardando" /> Guardando…</span>}
            <Button size="sm" icon={Send} onClick={onNotify} loading={notifying} disabled={n === 0}>Avisar a mi agente</Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar marca, modelo o ubicación" size="sm" className="md:flex-1" />
          <div className="flex items-center gap-2">
            <Select aria-label="Ordenar embarcaciones" size="sm" value={sortBy} onChange={e => setSortBy(e.target.value)} options={ORDEN} className="flex-1 md:w-52" />
            <SegmentedControl options={VISTAS} value={viewMode} onChange={setViewMode} size="sm" aria-label="Vista del ranking" />
          </div>
        </div>
        <FilterChips
          multiple
          size="sm"
          aria-label="Filtrar embarcaciones"
          options={[
            { id: 'foto', label: 'Con foto', count: links.filter(l => l.image_url).length },
            { id: 'precio', label: 'Con precio', count: links.filter(tienePrecio).length },
            { id: 'disponibles', label: 'Solo disponibles', count: links.filter(l => !estaVendida(l)).length },
          ]}
          value={filtros}
          onChange={setFiltros}
          onClear={hayFiltro ? limpiar : undefined}
        />
        {!isRankView && displayed.length > 0 && (
          <p className="text-13 text-ink-500">Para reordenar tu ranking vuelve a la vista de tarjetas con el orden «Mi ranking».</p>
        )}
      </Card.Body>

      {displayed.length === 0 ? (
        <EmptyState compact icon={Search} title="Ninguna embarcación coincide con los filtros" primaryAction={<Button variant="secondary" size="sm" onClick={limpiar}>Limpiar filtros</Button>} />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columnas}
          data={displayed}
          rowKey={r => r.id}
          pageSize={0}
          aria-label="Embarcaciones del ranking"
          rowActions={r => [
            r.url && { label: 'Ver anuncio', icon: ExternalLink, href: urlAbsoluta(r.url) },
            !estaVendida(r) && onRequestInspection && { label: 'Solicitar inspección técnica', icon: ClipboardCheck, onClick: () => onRequestInspection(r) },
          ]}
          mobileCard={r => (
            <div className="flex items-start gap-3">
              <span className="font-semibold text-ink-900 tabular">{links.indexOf(r) + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900">{tituloEmbarcacion(r)}</p>
                <p className="text-13 text-ink-500">{[r.location, Number(r.value_usa_usd) > 0 && fmtUSD(r.value_usa_usd), Number(r.value_chile_clp) > 0 && fmtCLP(r.value_chile_clp)].filter(Boolean).join(' · ') || 'Sin precio aún'}</p>
              </div>
            </div>
          )}
        />
      ) : (
        <ol className="m-0 list-none space-y-3 px-(--card-pad) pb-5" aria-label="Embarcaciones en tu ranking">
          {displayed.map(link => {
            const realIdx = links.findIndex(x => x.id === link.id);
            return (
              <li key={link.id}>
                <TarjetaEmbarcacion
                  link={link}
                  index={realIdx}
                  total={links.length}
                  dragHandlers={isRankView ? dnd(realIdx) : undefined}
                  onMoveUp={isRankView ? () => onMoveUp(realIdx) : undefined}
                  onMoveDown={isRankView ? () => onMoveDown(realIdx) : undefined}
                  onRequestInspection={onRequestInspection}
                  onPreviewImage={onPreviewImage}
                />
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
