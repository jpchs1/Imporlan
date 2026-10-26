import { useState, useMemo, useId } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtUSD, fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, SearchInput, Select, SegmentedControl, FilterChips, DataTable, EmptyState, Spinner, Badge } from '../../../shared/components/UI';
import { Send, LayoutGrid, List, ExternalLink, ClipboardCheck, Search, Check, ChevronDown } from '../../../shared/components/Icons';
import TarjetaEmbarcacion from './TarjetaEmbarcacion';
import { normalizarBusqueda } from '../../../shared/lib/file-collection';
import { precioUsa, precioChile, tituloEmbarcacion, estaVendida, tienePrecio, urlAbsoluta } from './lib';

const ORDEN = [
  { value: 'rank', label: 'Mi ranking' },
  { value: 'price_asc', label: 'Chile (CLP): menor a mayor' },
  { value: 'price_desc', label: 'Chile (CLP): mayor a menor' },
  { value: 'usa_asc', label: 'EE. UU. (USD): menor a mayor' },
  { value: 'usa_desc', label: 'EE. UU. (USD): mayor a menor' },
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
 *
 * Elegir: `puedeElegir(link)` decide qué tarjetas llevan el botón y
 * `onElegir(link)` abre el asistente; `onElegirConInspeccion(link)` es lo
 * mismo desde el menú, con la inspección preseleccionada. Con una lancha ya
 * elegida (`eleccion`), la tarjeta queda marcada «Tu elección» y el resto
 * ofrece «Cambiar a esta lancha» si todavía se puede. `noAptaId` es la lancha
 * que la inspección recomendó no comprar: se ve marcada y no se puede volver
 * a elegir (el servidor sólo la frena si dejó de estar disponible).
 *
 * Plegable: con `colapsable`, el cuerpo se muestra solo cuando `abierto`
 * (es la vista «Otras opciones (n)» de un expediente con elección).
 */
export default function RankingEmbarcaciones({ ref, order, links, saving, notifying, onNotify, dnd, onMoveUp, onMoveDown, onElegirConInspeccion, onPreviewImage, onElegir, puedeElegir, eleccion, noAptaId = null, titulo, descripcion, colapsable = false, abierto = true, onToggle }) {
  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState([]);
  const [sortBy, setSortBy] = useState('rank');
  const [viewMode, setViewMode] = useState('cards');
  const cuerpoId = useId();

  const displayed = useMemo(() => {
    const term = normalizarBusqueda(search);
    let out = links.filter(l => {
      if (filtros.includes('foto') && !l.image_url) return false;
      if (filtros.includes('precio') && !tienePrecio(l)) return false;
      if (filtros.includes('disponibles') && estaVendida(l)) return false;
      if (term) {
        const hay = normalizarBusqueda([l.title, l.make, l.model, l.year, l.location, l.engine, l.comments].filter(Boolean).join(' '));
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    // Los precios desconocidos siempre van al final; jamás mezclar USD y CLP.
    const comparePrice = (getPrice, direction) => (a, b) => {
      const av = getPrice(a), bv = getPrice(b);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return direction * (av - bv);
    };
    if (sortBy === 'price_asc') out = [...out].sort(comparePrice(precioChile, 1));
    else if (sortBy === 'price_desc') out = [...out].sort(comparePrice(precioChile, -1));
    else if (sortBy === 'usa_asc') out = [...out].sort(comparePrice(precioUsa, 1));
    else if (sortBy === 'usa_desc') out = [...out].sort(comparePrice(precioUsa, -1));
    else if (sortBy === 'year_desc') out = [...out].sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sortBy === 'year_asc') out = [...out].sort((a, b) => (a.year || Infinity) - (b.year || Infinity));
    return out;
  }, [links, search, filtros, sortBy]);

  const hayFiltro = search.trim() !== '' || filtros.length > 0 || sortBy !== 'rank';
  const limpiar = () => { setSearch(''); setFiltros([]); setSortBy('rank'); };
  const isRankView = sortBy === 'rank' && viewMode === 'cards' && !hayFiltro && !saving && !notifying;
  const n = links.length;
  const idElegida = Number(eleccion?.link_id) || null;
  const idNoApta = Number(noAptaId) || null;
  const esElegida = (l) => idElegida !== null && Number(l.id) === idElegida;
  const esNoApta = (l) => idNoApta !== null && Number(l.id) === idNoApta;
  const elegible = (l) => !!(onElegir && puedeElegir?.(l)) && !esNoApta(l);
  const hayElegibles = links.some(elegible);

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
          <p className={cn('font-medium', estaVendida(r) ? 'text-ink-500' : 'text-ink-900')}>
            {tituloEmbarcacion(r)}
            {estaVendida(r) && <Badge tone="neutral" size="sm" className="ml-1">{r.link_status === 'sold' ? 'Vendida' : 'No disponible'}</Badge>}
            {esElegida(r) && !esNoApta(r) && <Badge tone="brand" size="sm" dot className="ml-1">Tu elección</Badge>}
            {esNoApta(r) && <Badge tone="warning" size="sm" dot className="ml-1">No apta según inspección</Badge>}
          </p>
          {r.engine && r.engine !== tituloEmbarcacion(r) && <p className="text-13 text-ink-500 truncate">{r.engine}</p>}
        </div>
      ),
    },
    { key: 'location', header: 'Ubicación', priority: 2, cell: r => r.location || '—' },
    { key: 'value_usa_usd', header: 'Compra en EE. UU.', align: 'right', cell: r => <span className="tabular">{precioUsa(r) !== null ? fmtUSD(precioUsa(r)) : '—'}</span>, sortValue: precioUsa },
    { key: 'value_chile_clp', header: 'Puesto en Chile', align: 'right', cell: r => <span className="tabular font-medium text-ink-900">{r.quote_pending ? 'En análisis' : precioChile(r) !== null ? fmtCLP(precioChile(r)) : '—'}</span>, sortValue: precioChile },
  ];

  const textoAyuda = hayElegibles
    ? `Arrastra o usa las flechas para ordenar tu preferencia; el orden se guarda solo. Cuando lo tengas claro, elige con cuál avanzar. ${n} ${n === 1 ? 'embarcación' : 'embarcaciones'}.`
    : `Arrastra o usa las flechas para ordenar tu preferencia; el orden se guarda solo. ${n} ${n === 1 ? 'embarcación' : 'embarcaciones'}.`;

  return (
    <Card ref={ref} className="exp-section scroll-mt-20">
      <Card.Header
        title={titulo || 'Ranking de embarcaciones'}
        description={descripcion || ultimoCambio || 'Las opciones que encontró tu agente, en el orden que tú prefieras.'}
        actions={colapsable ? (
          <Button
            variant="secondary"
            size="sm"
            iconRight={ChevronDown}
            aria-expanded={abierto}
            aria-controls={cuerpoId}
            onClick={() => onToggle?.(!abierto)}
            className={abierto ? '[&_svg:last-child]:rotate-180' : undefined}
          >
            {abierto ? 'Ocultar' : 'Mostrar'}
          </Button>
        ) : undefined}
      >
        {order.ranking_updated_at && <span className="sr-only">{fmtDateLarga(order.ranking_updated_at, { hora: true })}</span>}
      </Card.Header>

      {(!colapsable || abierto) && (
        <div id={cuerpoId}>
          <Card.Body className="space-y-3" padding="md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-13 text-ink-500">{textoAyuda}</p>
              <div className="flex shrink-0 items-center gap-3">
                {saving && <span className="inline-flex items-center gap-1.5 text-13 text-ink-500" role="status"><Spinner inline size="sm" label="Guardando" /> Guardando…</span>}
                <Button size="sm" variant="secondary" icon={Send} onClick={onNotify} loading={notifying} disabled={n === 0 || saving}>Avisar a mi agente</Button>
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
              <p className="text-13 text-ink-500">Para reordenar tu ranking usa las tarjetas, el orden «Mi ranking» y limpia los filtros. Espera a que termine el guardado si está en curso.</p>
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
                elegible(r) && !esElegida(r) && { label: idElegida ? 'Cambiar a esta lancha' : 'Elegir esta lancha', icon: Check, onClick: () => onElegir(r) },
                elegible(r) && !esElegida(r) && onElegirConInspeccion && { label: 'Elegir con inspección técnica', icon: ClipboardCheck, onClick: () => onElegirConInspeccion(r) },
                r.url && { label: 'Ver anuncio', icon: ExternalLink, href: urlAbsoluta(r.url) },
              ]}
              mobileCard={r => (
                <div className="flex items-start gap-3">
                  <span className="font-semibold text-ink-900 tabular">{links.indexOf(r) + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{tituloEmbarcacion(r)} {esElegida(r) && !esNoApta(r) && <Badge tone="brand" size="sm" dot className="ml-1">Tu elección</Badge>}{esNoApta(r) && <Badge tone="warning" size="sm" dot className="ml-1">No apta según inspección</Badge>}</p>
                    <p className="text-13 text-ink-500">{[r.location, precioUsa(r) !== null && fmtUSD(precioUsa(r)), r.quote_pending ? 'Cotización en análisis' : precioChile(r) !== null && fmtCLP(precioChile(r))].filter(Boolean).join(' · ') || 'Sin precio aún'}</p>
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
                      onElegirConInspeccion={elegible(link) ? onElegirConInspeccion : undefined}
                      onPreviewImage={onPreviewImage}
                      onElegir={elegible(link) ? onElegir : undefined}
                      elegida={esElegida(link)}
                      noApta={esNoApta(link)}
                      modoCambio={!!idElegida}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </Card>
  );
}
