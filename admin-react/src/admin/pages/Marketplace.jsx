import { useState, useRef, useMemo } from 'react';
import {
  getMarketplaceAdminList, getMarketplaceAdminDetail,
  updateMarketplaceStatus, updateMarketplaceListing, deleteMarketplaceListing,
} from '../api';
import { fmtDate } from '../../shared/lib/utils';
import { fmtDateLarga, fmtNumero } from '../../shared/lib/format';
import { statusMeta } from '../../shared/lib/status';
import {
  PageHeader, Card, DataTable, StatusBadge, Badge, SearchInput, Select, StatTile, StatGrid, Drawer, Button, Input, Textarea,
  Money, ErrorState, EmptyState, DescriptionList, Skeleton, Lightbox, FormGrid, useConfirm,
} from '../../shared/components/UI';
import { RefreshCw, Pencil, Trash, Store, Image as ImageIcon, CircleCheck, RotateCw } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useCarga } from './operacion/useCarga';

const STATUS_OPTIONS = ['active', 'sold', 'deleted'].map(value => ({ value, label: statusMeta('publicacion', value).label }));
const TIPO_PUB_OPTIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'arriendo', label: 'Arriendo' },
];
const ESTADO_OPTIONS = [
  { value: 'Nueva', label: 'Nueva' },
  { value: 'Usada', label: 'Usada' },
];
const CONDICION_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'Excelente', label: 'Excelente' },
  { value: 'Muy Buena', label: 'Muy buena' },
  { value: 'Buena', label: 'Buena' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Para Reparacion', label: 'Para reparación' },
];
const MONEDA_OPTIONS = [
  { value: 'CLP', label: 'CLP' },
  { value: 'USD', label: 'USD' },
];

const tipoPub = (r) => r.tipo_publicacion || r.listing_type || r.type || '';
const titulo = (r) => r.nombre || r.title || 'Sin título';
const condicionLabel = (v) => CONDICION_OPTIONS.find(o => o.value === v)?.label || v || '—';

function Precio({ item, size, align }) {
  const price = item.precio || item.price;
  if (!price) return <span className="text-ink-500">—</span>;
  const cur = item.moneda || item.currency || 'CLP';
  return cur === 'USD' ? <Money usd={price} size={size} align={align} /> : <Money clp={price} size={size} align={align} />;
}

function Miniatura({ src, alt = '' }) {
  if (!src) {
    return <span className="h-10 w-10 rounded-md bg-neutral-bg text-ink-400 inline-flex items-center justify-center shrink-0" aria-hidden="true"><ImageIcon size={18} /></span>;
  }
  return <img src={src} alt={alt} className="h-10 w-10 rounded-md object-cover border border-line shrink-0" />;
}

export default function Marketplace() {
  const toast = useToast();
  const confirm = useConfirm();
  const { datos, cargando, error, recargar, refrescar, setDatos } = useCarga(getMarketplaceAdminList, { mensaje: 'No se pudieron cargar las publicaciones' });
  const items = useMemo(() => datos?.items || datos?.listings || [], [datos]);
  const setItems = (fn) => setDatos(d => {
    const lista = d?.items || d?.listings || [];
    const nueva = fn(lista);
    return d?.listings && !d?.items ? { ...d, listings: nueva } : { ...(d || {}), items: nueva };
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(null);

  // Cada apertura tiene su número: si se cerró el panel o se abrió otra
  // publicación antes de que llegue el detalle, esa respuesta se descarta.
  const detailReq = useRef(0);
  const openDetail = (item) => {
    const n = ++detailReq.current;
    setDetailLoading(true);
    setSelected(item);
    setEditMode(false);
    getMarketplaceAdminDetail(item.id)
      .then(res => { if (detailReq.current === n) setSelected(res.listing || res.item || item); })
      .catch(() => {})
      .finally(() => { if (detailReq.current === n) setDetailLoading(false); });
  };

  const closeDetail = () => { detailReq.current++; setSelected(null); setEditMode(false); setEditData({}); };

  const startEdit = () => {
    setEditData({
      nombre: selected.nombre || selected.title || '',
      tipo_publicacion: selected.tipo_publicacion || selected.listing_type || 'venta',
      tipo: selected.tipo || '',
      ano: selected.ano || selected.year || '',
      eslora: selected.eslora || '',
      precio: selected.precio || selected.price || '',
      moneda: selected.moneda || selected.currency || 'CLP',
      ubicacion: selected.ubicacion || selected.location || '',
      descripcion: selected.descripcion || selected.description || '',
      estado: selected.estado || 'Usada',
      condicion: selected.condicion || '',
      horas: selected.horas || '',
      status: selected.status || 'active',
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateMarketplaceListing({ id: selected.id, ...editData });
      toast?.('Publicación actualizada', 'success');
      setEditMode(false);
      setSelected({ ...selected, ...editData });
      setItems(prev => prev.map(i => i.id === selected.id ? { ...i, ...editData } : i));
    } catch (err) {
      toast?.(err.message || 'No se pudo guardar la publicación', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, newStatus, label) => {
    try {
      await updateMarketplaceStatus(id, newStatus);
      toast?.(`Publicación marcada como ${label}`, 'success');
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
      if (selected && selected.id === id) setSelected(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      toast?.(err.message || 'No se pudo cambiar el estado', 'error');
    }
  };

  const askDelete = async (item) => {
    const ok = await confirm({
      title: '¿Eliminar la publicación?',
      description: `#${item.id} · ${titulo(item)}`,
      detail: 'Se marca como eliminada y deja de verse en el marketplace. El vendedor no recibe aviso.',
      tone: 'danger',
      confirmLabel: 'Eliminar publicación',
    });
    if (!ok) return;
    try {
      await deleteMarketplaceListing(item.id);
      toast?.('Publicación eliminada', 'success');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'deleted' } : i));
      if (selected && selected.id === item.id) closeDetail();
    } catch (err) {
      toast?.(err.message || 'No se pudo eliminar la publicación', 'error');
    }
  };

  const cuenta = (st) => items.filter(i => !st || i.status === st).length;
  const types = [...new Set(items.map(tipoPub).filter(Boolean))];
  const statuses = [...new Set(items.map(i => i.status).filter(Boolean))];

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (typeFilter && tipoPub(i) !== typeFilter) return false;
    if (search) {
      const hay = [i.nombre, i.title, i.tipo, i.user_email, i.seller_name, i.user_name, i.ubicacion, i.location].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const accionesFila = (r) => [
    r.status === 'active' ? { label: 'Marcar vendida', icon: CircleCheck, onClick: () => handleStatusChange(r.id, 'sold', 'vendida') } : null,
    ['sold', 'deleted', 'expired'].includes(r.status) ? { label: 'Reactivar', icon: RotateCw, onClick: () => handleStatusChange(r.id, 'active', 'activa') } : null,
    { label: 'Ver y editar', icon: Pencil, onClick: () => openDetail(r) },
    r.status !== 'deleted' ? { separator: true } : null,
    r.status !== 'deleted' ? { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => askDelete(r) } : null,
  ];

  const columns = [
    { key: 'pub', header: 'Publicación', sortValue: r => titulo(r), cell: r => (
      <div className="flex items-center gap-3 min-w-0">
        <Miniatura src={(r.fotos || [])[0] || r.main_photo} />
        <div className="min-w-0 max-w-[220px]">
          <p className="font-medium text-ink-900 truncate" title={titulo(r)}>{titulo(r)}</p>
          <p className="text-xs text-ink-500 truncate">{[r.tipo, r.ano || r.year].filter(Boolean).join(' · ') || `#${r.id}`}</p>
        </div>
      </div>
    ) },
    { key: 'tipo_pub', header: 'Tipo', width: 110, priority: 2, cell: r => tipoPub(r) ? <StatusBadge kind="publicacion" status={tipoPub(r)} /> : '—' },
    { key: 'vendedor', header: 'Vendedor', priority: 2, cell: r => (
      <div className="min-w-0 max-w-[170px]">
        <p className="truncate text-ink-900">{r.seller_name || r.user_name || '—'}</p>
        <p className="text-xs text-ink-500 truncate" title={r.user_email || ''}>{r.user_email || ''}</p>
      </div>
    ) },
    { key: 'precio', header: 'Precio', align: 'right', width: 130, sortValue: r => Number(r.precio || r.price) || 0, cell: r => <Precio item={r} align="right" /> },
    { key: 'ubicacion', header: 'Ubicación', priority: 3, cell: r => <span className="block max-w-[150px] truncate" title={r.ubicacion || r.location || ''}>{r.ubicacion || r.location || r.city || '—'}</span> },
    { key: 'status', header: 'Estado', width: 120, sortValue: r => r.status, cell: r => (
      <div className="flex flex-col items-start gap-0.5">
        <StatusBadge kind="publicacion" status={r.status} />
        <span className="text-xs text-ink-500 whitespace-nowrap">{fmtDate(r.created_at)}</span>
      </div>
    ) },
  ];

  const hayFiltro = !!(search || statusFilter || typeFilter);
  const fotos = selected?.fotos || [];

  return (
    <>
      <PageHeader
        title="Marketplace"
        description={cargando ? 'Cargando publicaciones…' : `${fmtNumero(items.length)} ${items.length === 1 ? 'publicación' : 'publicaciones'} de clientes`}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={refrescar}>Actualizar</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar las publicaciones" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <>
          <StatGrid cols={4} className="mb-6">
            <StatTile label="Todas" value={items.length} loading={cargando} onClick={() => setStatusFilter('')} active={statusFilter === ''} />
            <StatTile label="Activas" value={cuenta('active')} loading={cargando} onClick={() => setStatusFilter('active')} active={statusFilter === 'active'} />
            <StatTile label="Vendidas" value={cuenta('sold')} loading={cargando} onClick={() => setStatusFilter('sold')} active={statusFilter === 'sold'} />
            <StatTile label="Eliminadas" value={cuenta('deleted')} loading={cargando} onClick={() => setStatusFilter('deleted')} active={statusFilter === 'deleted'} />
          </StatGrid>

          <Card padding="none">
            <div className="px-(--card-pad) pt-4 pb-3 border-b border-line flex flex-col sm:flex-row gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por título, tipo, vendedor o ubicación" className="flex-1" />
              <Select aria-label="Tipo de publicación" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[
                { value: '', label: 'Venta y arriendo' },
                ...types.map(t => ({ value: t, label: statusMeta('publicacion', t).label })),
              ]} className="w-full sm:w-44" />
              <Select aria-label="Estado de la publicación" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
                { value: '', label: 'Todos los estados' },
                ...statuses.map(s => ({ value: s, label: statusMeta('publicacion', s).label })),
              ]} className="w-full sm:w-44" />
            </div>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={r => r.id}
              loading={cargando}
              onRowClick={openDetail}
              rowActions={accionesFila}
              pageSize={25}
              aria-label="Publicaciones del marketplace"
              emptyState={<EmptyState compact icon={Store} title={hayFiltro ? 'Ninguna publicación coincide' : 'Sin publicaciones en el marketplace'} description={hayFiltro ? 'Prueba con otro texto o quita los filtros.' : 'Las publicaciones de los clientes aparecen aquí para revisarlas.'} />}
              mobileCard={r => (
                <div className="flex items-center gap-3">
                  <Miniatura src={(r.fotos || [])[0] || r.main_photo} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900 truncate">{titulo(r)}</p>
                    <p className="text-13 text-ink-500 truncate">{r.seller_name || r.user_name || r.user_email || '—'}</p>
                    <div className="flex items-center gap-2 mt-1"><Precio item={r} size="sm" /><StatusBadge kind="publicacion" status={r.status} size="sm" /></div>
                  </div>
                </div>
              )}
            />
          </Card>
        </>
      )}

      <Drawer
        open={!!selected}
        onClose={closeDetail}
        title={selected ? (editMode ? 'Editar publicación' : titulo(selected)) : ''}
        description={selected ? `#${selected.id} · ${tipoPub(selected) ? statusMeta('publicacion', tipoPub(selected)).label : 'Publicación'} · publicada el ${fmtDateLarga(selected.created_at)}` : ''}
        width="lg"
        footer={selected && !detailLoading && (editMode ? (
          <>
            <Button variant="secondary" onClick={() => setEditMode(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} loading={saving}>Guardar cambios</Button>
          </>
        ) : (
          <>
            {selected.status !== 'deleted' && <Button variant="danger-ghost" icon={Trash} onClick={() => askDelete(selected)} className="mr-auto">Eliminar</Button>}
            <Button variant="secondary" icon={Pencil} onClick={startEdit}>Editar</Button>
            {selected.status === 'active' && <Button icon={CircleCheck} onClick={() => handleStatusChange(selected.id, 'sold', 'vendida')}>Marcar vendida</Button>}
            {['sold', 'deleted', 'expired'].includes(selected.status) && <Button icon={RotateCw} onClick={() => handleStatusChange(selected.id, 'active', 'activa')}>Reactivar</Button>}
          </>
        ))}
      >
        {selected && (detailLoading ? (
          <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton.Text lines={4} /></div>
        ) : editMode ? (
          <EditForm data={editData} onChange={setEditData} onSubmit={saveEdit} />
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <Precio item={selected} size="xl" />
              <StatusBadge kind="publicacion" status={selected.status} dot />
            </div>

            {fotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map((f, i) => (
                  <button key={i} type="button" onClick={() => setPhotoIndex(i)} aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                    className="aspect-[4/3] rounded-md overflow-hidden border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                    <img src={f} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <DescriptionList cols={3} dense items={[
              { label: 'Tipo', value: selected.tipo || '—' },
              { label: 'Año', value: selected.ano || selected.year || '—' },
              { label: 'Eslora', value: selected.eslora ? (/\D/.test(String(selected.eslora)) ? selected.eslora : `${selected.eslora} pies`) : '—' },
              { label: 'Horas de motor', value: selected.horas ? fmtNumero(selected.horas) : '—' },
              { label: 'Condición', value: condicionLabel(selected.condicion) },
              { label: 'Nueva o usada', value: selected.estado || '—' },
              { label: 'Ubicación', value: selected.ubicacion || selected.location || '—', full: true },
            ]} />

            {(selected.descripcion || selected.description) && (
              <section>
                <h3 className="text-sm font-semibold text-ink-900 mb-2 pb-2 border-b border-line">Descripción</h3>
                <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{selected.descripcion || selected.description}</p>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-ink-900 mb-3 pb-2 border-b border-line">Vendedor</h3>
              <DescriptionList cols={3} dense items={[
                { label: 'Nombre', value: selected.seller_name || selected.user_name || '—' },
                { label: 'Correo', value: selected.user_email ? <a href={`mailto:${selected.user_email}`} className="text-brand-600 hover:underline break-all">{selected.user_email}</a> : '—' },
                { label: 'Teléfono', value: selected.user_phone || selected.phone || '—' },
              ]} />
            </section>

            <section>
              <h3 className="text-sm font-semibold text-ink-900 mb-3 pb-2 border-b border-line">Vigencia</h3>
              <DescriptionList cols={3} dense items={[
                { label: 'Publicada', value: fmtDateLarga(selected.created_at) },
                { label: 'Vence', value: selected.expires_at ? fmtDateLarga(selected.expires_at) : '—' },
              ]} />
            </section>

            {selected.arriendo_periodos?.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-ink-900 mb-3 pb-2 border-b border-line">Períodos de arriendo</h3>
                <ul className="divide-y divide-line border border-line rounded-lg">
                  {selected.arriendo_periodos.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                      <span className="font-medium text-ink-900">{p.nombre || p.name || `Período ${i + 1}`}{p.duracion && <span className="ml-2 text-xs font-normal text-ink-500">{p.duracion}</span>}</span>
                      <Precio item={{ precio: p.precio || p.price, moneda: selected.moneda || selected.currency || 'CLP' }} size="sm" align="right" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ))}
      </Drawer>

      <Lightbox
        open={photoIndex !== null}
        items={fotos.map((src, i) => ({ src, alt: `${selected ? titulo(selected) : 'Foto'} · ${i + 1}` }))}
        index={photoIndex ?? 0}
        onIndexChange={setPhotoIndex}
        onClose={() => setPhotoIndex(null)}
      />
    </>
  );
}

function EditForm({ data, onChange, onSubmit }) {
  const set = (field, val) => onChange(prev => ({ ...prev, [field]: val }));
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <Input label="Título" value={data.nombre} onChange={e => set('nombre', e.target.value)} required />
      <FormGrid cols={2}>
        <Select label="Tipo de publicación" value={data.tipo_publicacion} onChange={e => set('tipo_publicacion', e.target.value)} options={TIPO_PUB_OPTIONS} />
        <Select label="Estado de la publicación" value={data.status} onChange={e => set('status', e.target.value)} options={STATUS_OPTIONS} />
      </FormGrid>
      <FormGrid cols={3}>
        <Input label="Tipo de embarcación" value={data.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Lancha, velero…" />
        <Input label="Año" type="number" inputMode="numeric" value={data.ano} onChange={e => set('ano', e.target.value)} />
        <Input label="Eslora" value={data.eslora} onChange={e => set('eslora', e.target.value)} suffix="pies" />
      </FormGrid>
      <FormGrid cols={3}>
        <Input label="Precio" type="number" inputMode="numeric" value={data.precio} onChange={e => set('precio', e.target.value)} />
        <Select label="Moneda" value={data.moneda} onChange={e => set('moneda', e.target.value)} options={MONEDA_OPTIONS} />
        <Input label="Horas de motor" type="number" inputMode="numeric" value={data.horas} onChange={e => set('horas', e.target.value)} />
      </FormGrid>
      <FormGrid cols={3}>
        <Input label="Ubicación" value={data.ubicacion} onChange={e => set('ubicacion', e.target.value)} />
        <Select label="Nueva o usada" value={data.estado} onChange={e => set('estado', e.target.value)} options={ESTADO_OPTIONS} />
        <Select label="Condición" value={data.condicion} onChange={e => set('condicion', e.target.value)} options={CONDICION_OPTIONS} />
      </FormGrid>
      <Textarea label="Descripción" value={data.descripcion} onChange={e => set('descripcion', e.target.value)} rows={5} />
    </form>
  );
}
