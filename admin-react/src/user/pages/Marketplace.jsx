import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketplaceListings, getMyListings, createListing, updateListing, deleteListing, renewListing, markListingSold, uploadListingPhoto } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { fmtUSD, fmtDateLarga } from '../../shared/lib/format';
import { useAuth } from '../../shared/context/AuthContext';
import {
  Card, Badge, StatusBadge, Button, IconButton, Modal, Input, Select, Textarea, FormGrid, PageHeader, Tabs, FilterChips, SearchInput,
  DataTable, EmptyState, ErrorState, Money, Avatar, DescriptionList, Lightbox, useConfirm,
} from '../../shared/components/UI';
import { Plus, Image as ImageIcon, Images, MapPin, Clock, Ruler, WhatsAppIcon, MessageCircle, Pencil, Trash, RefreshCw, CircleCheck, X, Upload } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

const TIPOS = ['Bowrider', 'Pesca', 'Jet Boat', 'Yate', 'Velero', 'Moto de Agua', 'Catamaran', 'Otro'];
const CONDICIONES = ['Excelente', 'Muy Buena', 'Buena', 'Regular', 'Para Reparacion'];
const MAX_FOTOS = 8;
const FORM_VACIO = { nombre: '', tipo: 'Bowrider', ano: '', eslora: '', precio: '', moneda: 'USD', ubicacion: '', estado: 'Usada', condicion: 'Buena', horas: '', descripcion: '', tipo_publicacion: 'venta' };

function parsePhotos(fotos) {
  if (!fotos) return [];
  if (Array.isArray(fotos)) return fotos;
  try { return JSON.parse(fotos); } catch { return []; }
}

function formDe(item) {
  if (!item) return FORM_VACIO;
  return {
    nombre: item.nombre || '',
    tipo: item.tipo || 'Bowrider',
    ano: item.ano || '',
    eslora: item.eslora || '',
    precio: item.precio || '',
    moneda: item.moneda || 'USD',
    ubicacion: item.ubicacion || '',
    estado: item.estado || 'Usada',
    condicion: item.condicion || 'Buena',
    horas: item.horas || '',
    descripcion: item.descripcion || '',
    tipo_publicacion: item.tipo_publicacion || 'venta',
  };
}

/** Precio con moneda explícita (CLP con puntos, USD entero). */
function Precio({ item, size = 'md', align }) {
  const n = Number(item.precio);
  if (!n) return <span className="text-ink-500">Precio a convenir</span>;
  return (item.moneda || 'USD') === 'CLP' ? <Money clp={n} size={size} align={align} /> : <Money usd={n} size={size} align={align} />;
}

function precioTexto(item) {
  const n = Number(item.precio);
  if (!n) return 'precio a convenir';
  return (item.moneda || 'USD') === 'CLP' ? fmtCLP(n) : fmtUSD(n);
}

const TONO_CONDICION = { Excelente: 'success', 'Muy Buena': 'success', Buena: 'neutral', Regular: 'warning', 'Para Reparacion': 'danger' };
function etiquetaCondicion(c) {
  return c === 'Para Reparacion' ? 'Para reparación' : c;
}

/* ---------------------------------------------------------------------------
   Tarjeta del listado (toda la tarjeta es un botón)
   --------------------------------------------------------------------------- */
function ListingCard({ item, onClick }) {
  const photos = parsePhotos(item.fotos);
  const cover = photos[0] || null;
  const specs = [item.tipo, item.ano].filter(Boolean).join(' · ');
  return (
    <Card as="article" padding="none" className="overflow-hidden">
      <button type="button" onClick={() => onClick(item)} aria-label={`Ver ${item.nombre}`}
        className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 rounded-lg">
        <div className="relative aspect-[4/3] bg-neutral-bg overflow-hidden rounded-t-lg">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-700">
              <ImageIcon size={28} />
              <span className="text-xs">Sin fotos</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <StatusBadge kind="publicacion" status={item.tipo_publicacion || 'venta'} className="shadow-card" />
            {item.estado === 'Nueva' && <Badge tone="brand" className="shadow-card">Nueva</Badge>}
          </div>
          {photos.length > 1 && (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-sm bg-ink-900/70 text-white text-xs px-1.5 h-6">
              <Images size={14} /> {photos.length}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-base font-semibold text-ink-900 truncate group-hover:text-brand-700 transition-colors">{item.nombre}</h3>
          {specs && <p className="text-13 text-ink-500">{specs}</p>}
          <div className="mt-2"><Precio item={item} size="lg" /></div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-13 text-ink-500">
            {item.eslora && <span className="inline-flex items-center gap-1"><Ruler size={14} /> {item.eslora}</span>}
            {item.horas && <span className="inline-flex items-center gap-1"><Clock size={14} /> {item.horas} h</span>}
            {item.ubicacion && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={14} className="shrink-0" /> <span className="truncate">{item.ubicacion}</span></span>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={item.user_name || 'Vendedor'} size="sm" />
              <span className="text-13 text-ink-500 truncate">{item.user_name || 'Vendedor'}</span>
            </div>
            {item.condicion && <Badge tone={TONO_CONDICION[item.condicion] || 'neutral'}>{etiquetaCondicion(item.condicion)}</Badge>}
          </div>
        </div>
      </button>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Detalle
   --------------------------------------------------------------------------- */
function DetailModal({ item, open, onClose }) {
  const navigate = useNavigate();
  const [foto, setFoto] = useState(null);
  if (!item) return null;
  const photos = parsePhotos(item.fotos);
  const datos = [
    item.tipo && { label: 'Tipo', value: item.tipo },
    item.ano && { label: 'Año', value: item.ano },
    item.eslora && { label: 'Eslora', value: item.eslora },
    item.horas && { label: 'Horas de motor', value: item.horas },
    item.ubicacion && { label: 'Ubicación', value: item.ubicacion },
    item.condicion && { label: 'Condición', value: etiquetaCondicion(item.condicion) },
    item.estado && { label: 'Estado', value: item.estado },
  ].filter(Boolean);
  const wa = `https://wa.me/56940211459?text=${encodeURIComponent(`Hola, me interesa: ${item.nombre} (${precioTexto(item)})`)}`;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={item.nombre}
        description={[item.tipo, item.ano, item.ubicacion].filter(Boolean).join(' · ')}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" icon={MessageCircle} onClick={() => { onClose(); navigate('/messages'); }}>Escribir por el panel</Button>
            <Button icon={WhatsAppIcon} onClick={() => window.open(wa, '_blank', 'noopener')}>Consultar por WhatsApp</Button>
          </>
        )}
      >
        {photos.length > 0 && (
          <div className="mb-5">
            <button type="button" onClick={() => setFoto(0)} aria-label="Ver foto 1 ampliada" className="block w-full aspect-[16/10] rounded-lg overflow-hidden bg-neutral-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              <img src={photos[0]} alt="" className="w-full h-full object-cover" />
            </button>
            {photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {photos.slice(1, 5).map((p, i) => (
                  <button key={`${p}-${i}`} type="button" onClick={() => setFoto(i + 1)} aria-label={`Ver foto ${i + 2} ampliada`} className="aspect-[4/3] rounded-md overflow-hidden bg-neutral-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                    <img src={p} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <Precio item={item} size="xl" />
          <StatusBadge kind="publicacion" status={item.tipo_publicacion || 'venta'} />
        </div>

        <DescriptionList items={datos} cols={3} dense className="mb-5" />

        {item.descripcion && (
          <div className="rounded-lg bg-canvas border border-line p-4 text-sm text-ink-700 whitespace-pre-wrap mb-5">{item.descripcion}</div>
        )}

        <div className="flex items-center gap-3 pt-4 border-t border-line">
          <Avatar name={item.user_name || 'Vendedor'} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-900 m-0">{item.user_name || 'Vendedor'}</p>
            <p className="text-13 text-ink-500 m-0">Publicado el {fmtDateLarga(item.created_at)}</p>
          </div>
        </div>
      </Modal>
      <Lightbox
        open={foto !== null}
        items={photos.map((src, i) => ({ src, alt: `${item.nombre} · foto ${i + 1}` }))}
        index={foto ?? 0}
        onIndexChange={setFoto}
        onClose={() => setFoto(null)}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Publicar / editar
   --------------------------------------------------------------------------- */
function PublishModal({ open, onClose, editItem, onSuccess }) {
  const toast = useToast();
  const { user } = useAuth();
  // El estado parte del ítem a editar; la página monta el modal con `key`
  // por publicación, así cada apertura empieza limpia sin efectos.
  const fileRef = useRef(null);
  const [form, setForm] = useState(() => formDe(editItem));
  const [photos, setPhotos] = useState(() => parsePhotos(editItem?.fotos));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errores, setErrores] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleUploadPhoto(files) {
    if (photos.length + files.length > MAX_FOTOS) { toast?.(`Máximo ${MAX_FOTOS} fotos`, 'error'); return; }
    setUploading(true);
    for (const file of files) {
      try {
        const data = await uploadListingPhoto(editItem?.id || 'new', file);
        if (data.success && data.url) setPhotos(p => [...p, data.url]);
        else toast?.(data.error || 'No se pudo subir la foto', 'error');
      } catch {
        toast?.('No se pudo subir la foto', 'error');
      }
    }
    setUploading(false);
  }

  function removePhoto(idx) { setPhotos(p => p.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    if (!form.nombre.trim()) { setErrores({ nombre: 'Escribe el nombre o modelo de la embarcación.' }); return; }
    setErrores({});
    setSaving(true);
    const email = user?.email || user?.user_email || '';
    const name = user?.name || '';
    const payload = { ...form, fotos: photos, user_email: email, user_name: name };
    try {
      const data = editItem ? await updateListing({ ...payload, id: editItem.id }) : await createListing(payload);
      if (data.success) {
        toast?.(editItem ? 'Publicación actualizada' : 'Publicación creada', 'success');
        onSuccess();
        onClose();
      } else {
        toast?.(data.error || 'No se pudo guardar', 'error');
      }
    } catch {
      toast?.('No se pudo guardar. Revisa tu conexión.', 'error');
    }
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editItem ? 'Editar publicación' : 'Publicar embarcación'}
      description="Los datos se muestran a toda la comunidad Imporlan."
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving}>{editItem ? 'Guardar cambios' : 'Publicar'}</Button>
        </>
      )}
    >
      <div className="space-y-5">
        <FormGrid cols={2}>
          <Select label="Tipo de publicación" value={form.tipo_publicacion} onChange={e => set('tipo_publicacion', e.target.value)} options={[{ value: 'venta', label: 'Venta' }, { value: 'arriendo', label: 'Arriendo' }]} />
          <Input label="Nombre o modelo" required value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Sea Ray 250 SLX" error={errores.nombre} />
          <Select label="Tipo" value={form.tipo} onChange={e => set('tipo', e.target.value)} options={TIPOS.map(t => ({ value: t, label: t }))} />
          <Input label="Año" type="number" inputMode="numeric" value={form.ano} onChange={e => set('ano', e.target.value)} placeholder="2023" />
          <Input label="Precio" type="number" inputMode="numeric" value={form.precio} onChange={e => set('precio', e.target.value)} placeholder="50000" />
          <Select label="Moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)} options={[{ value: 'USD', label: 'USD' }, { value: 'CLP', label: 'CLP' }]} />
          <Input label="Eslora" value={form.eslora} onChange={e => set('eslora', e.target.value)} placeholder="25 pies" />
          <Input label="Horas de motor" type="number" inputMode="numeric" value={form.horas} onChange={e => set('horas', e.target.value)} placeholder="150" />
          <Input label="Ubicación" value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Viña del Mar, Valparaíso" />
          <Select label="Estado" value={form.estado} onChange={e => set('estado', e.target.value)} options={[{ value: 'Nueva', label: 'Nueva' }, { value: 'Usada', label: 'Usada' }]} />
          <Select label="Condición" value={form.condicion} onChange={e => set('condicion', e.target.value)} options={CONDICIONES.map(c => ({ value: c, label: etiquetaCondicion(c) }))} />
        </FormGrid>

        <Textarea label="Descripción" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Motor, mantenciones, equipamiento incluido…" rows={4} maxLength={2000} showCount />

        <div>
          <p className="text-13 font-medium text-ink-700 mb-1.5">Fotos <span className="text-ink-500 font-normal tabular">({photos.length}/{MAX_FOTOS})</span></p>
          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2 mb-3 m-0 p-0 list-none">
              {photos.map((url, i) => (
                <li key={`${url}-${i}`} className="relative w-24 h-18 rounded-md overflow-hidden border border-line bg-neutral-bg">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <IconButton icon={X} size="sm" variant="secondary" aria-label={`Quitar foto ${i + 1}`} onClick={() => removePhoto(i)} className="absolute top-1 right-1 h-6 w-6" />
                  {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-ink-900/70 text-white text-xs text-center py-0.5">Portada</span>}
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_FOTOS && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>Agregar fotos</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="Elegir fotos"
                onChange={e => { if (e.target.files?.length) handleUploadPhoto(Array.from(e.target.files)); e.target.value = ''; }} />
              <p className="text-xs text-ink-500 m-0">JPG, PNG o WebP. La primera es la portada.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */
export default function Marketplace() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('browse');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListingsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPub, setFilterPub] = useState('all'); // all | venta | arriendo

  // Trae las dos listas; el estado lo escribe quien llama (efecto o botón).
  const cargar = useCallback(() => Promise.all([
    getMarketplaceListings().catch(() => ({ listings: [] })),
    getMyListings().catch(() => ({ listings: [] })),
  ]).then(([allRes, myRes]) => ({
    todas: allRes.listings || allRes.data || [],
    mias: myRes.listings || myRes.data || [],
  })), []);

  useEffect(() => {
    let vivo = true;
    cargar()
      .then(({ todas, mias }) => { if (vivo) { setListings(todas); setMyListingsState(mias); } })
      .catch(e => { if (vivo) setError(e); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [cargar]);

  // Tras crear, editar, vender o eliminar: se vuelve a pedir sin skeleton.
  const load = useCallback(() => cargar()
    .then(({ todas, mias }) => { setListings(todas); setMyListingsState(mias); })
    .catch(() => {}), [cargar]);

  function recargar() {
    setLoading(true);
    setError(null);
    cargar()
      .then(({ todas, mias }) => { setListings(todas); setMyListingsState(mias); })
      .catch(setError)
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return listings.filter(item => {
      if (term && !(`${item.nombre} ${item.tipo} ${item.ubicacion}`.toLowerCase().includes(term))) return false;
      if (filterType && item.tipo !== filterType) return false;
      if (filterPub === 'venta' && item.tipo_publicacion === 'arriendo') return false;
      if (filterPub === 'arriendo' && item.tipo_publicacion !== 'arriendo') return false;
      return true;
    });
  }, [listings, search, filterType, filterPub]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === 'price_asc') return (a.precio || 0) - (b.precio || 0);
    if (sort === 'price_desc') return (b.precio || 0) - (a.precio || 0);
    if (sort === 'year') return (b.ano || 0) - (a.ano || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  }), [filtered, sort]);

  const conteoPub = useMemo(() => ({
    all: listings.length,
    venta: listings.filter(l => l.tipo_publicacion !== 'arriendo').length,
    arriendo: listings.filter(l => l.tipo_publicacion === 'arriendo').length,
  }), [listings]);

  function abrirPublicar(item = null) { setEditItem(item); setShowPublish(true); }

  async function handleDelete(item) {
    const ok = await confirm({ title: `¿Eliminar "${item.nombre}"?`, description: 'La publicación deja de verse en el Marketplace. No se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      const data = await deleteListing(item.id);
      if (data.success) { toast?.('Publicación eliminada', 'success'); load(); }
      else toast?.(data.error || 'No se pudo eliminar', 'error');
    } catch { toast?.('No se pudo eliminar. Revisa tu conexión.', 'error'); }
  }

  async function handleRenew(item) {
    try {
      const data = await renewListing(item.id);
      if (data.success) { toast?.('Publicación renovada por 30 días', 'success'); load(); }
      else toast?.(data.error || 'No se pudo renovar', 'error');
    } catch { toast?.('No se pudo renovar. Revisa tu conexión.', 'error'); }
  }

  async function handleMarkSold(item) {
    const ok = await confirm({ title: `¿Marcar "${item.nombre}" como vendida?`, description: 'La publicación pasa a Vendida y deja de aparecer en Comprar. Puedes renovarla después si cambias de idea.', confirmLabel: 'Marcar como vendida' });
    if (!ok) return;
    try {
      const data = await markListingSold(item.id);
      if (data.success) { toast?.('Marcada como vendida', 'success'); load(); }
      else toast?.(data.error || 'No se pudo marcar', 'error');
    } catch { toast?.('No se pudo marcar. Revisa tu conexión.', 'error'); }
  }

  function clearFilters() { setSearch(''); setFilterType(''); setFilterPub('all'); setSort('recent'); }
  const filtersActive = !!search || !!filterType || filterPub !== 'all' || sort !== 'recent';

  const columnasMias = [
    {
      key: 'nombre', header: 'Embarcación',
      cell: item => {
        const photos = parsePhotos(item.fotos);
        return (
          <div className="flex items-center gap-3 min-w-0">
            {photos[0] ? <img src={photos[0]} alt="" className="h-10 w-14 rounded-md object-cover bg-neutral-bg shrink-0" /> : <span className="h-10 w-14 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><ImageIcon size={16} /></span>}
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate m-0">{item.nombre}</p>
              <p className="text-13 text-ink-500 m-0">{[item.tipo, item.ano, item.eslora].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        );
      },
      sortValue: item => item.nombre || '',
    },
    { key: 'precio', header: 'Precio', align: 'right', width: 150, cell: item => <Precio item={item} align="right" />, sortValue: item => Number(item.precio) || 0 },
    { key: 'status', header: 'Estado', width: 130, cell: item => <StatusBadge kind="publicacion" status={item.status} dot />, sortValue: item => item.status || '' },
    { key: 'tipo_publicacion', header: 'Modalidad', width: 130, priority: 2, cell: item => <StatusBadge kind="publicacion" status={item.tipo_publicacion || 'venta'} />, sortValue: item => item.tipo_publicacion || '' },
    { key: 'created_at', header: 'Publicada', width: 120, priority: 2, cell: item => <span className="tabular">{fmtDate(item.created_at)}</span>, sortValue: item => new Date(item.created_at || 0).getTime() },
  ];

  const accionesMias = (item) => [
    { label: 'Ver como comprador', icon: Images, onClick: () => setDetailItem(item) },
    item.status === 'active' && { label: 'Editar', icon: Pencil, onClick: () => abrirPublicar(item) },
    item.status === 'active' && { label: 'Marcar como vendida', icon: CircleCheck, onClick: () => handleMarkSold(item) },
    (item.status === 'sold' || item.status === 'expired') && { label: 'Renovar 30 días', icon: RefreshCw, onClick: () => handleRenew(item) },
    item.status !== 'deleted' && { separator: true },
    item.status !== 'deleted' && { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDelete(item) },
  ];

  return (
    <div className="pb-12">
      <PageHeader
        title="Marketplace"
        description="Compra, vende o arrienda embarcaciones entre la comunidad Imporlan."
        actions={<Button icon={Plus} onClick={() => abrirPublicar(null)}>Publicar embarcación</Button>}
      />

      <Tabs
        className="mb-5"
        aria-label="Secciones del Marketplace"
        tabs={[{ id: 'browse', label: 'Comprar', count: listings.length }, { id: 'mine', label: 'Mis publicaciones', count: myListings.length }]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <Card padding="none"><ErrorState message="No pudimos cargar el Marketplace." detail={error} onRetry={recargar} /></Card>
      ) : tab === 'browse' ? (
        <>
          <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips
              aria-label="Modalidad"
              options={[{ id: 'all', label: 'Todas', count: conteoPub.all }, { id: 'venta', label: 'En venta', count: conteoPub.venta }, { id: 'arriendo', label: 'En arriendo', count: conteoPub.arriendo }]}
              value={filterPub}
              onChange={setFilterPub}
            />
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar marca, modelo o lugar" className="sm:w-64" />
              <Select aria-label="Tipo de embarcación" value={filterType} onChange={e => setFilterType(e.target.value)} options={[{ value: '', label: 'Todos los tipos' }, ...TIPOS.map(t => ({ value: t, label: t }))]} className="sm:w-44" />
              <Select aria-label="Ordenar por" value={sort} onChange={e => setSort(e.target.value)} options={[{ value: 'recent', label: 'Más recientes' }, { value: 'price_asc', label: 'Menor precio' }, { value: 'price_desc', label: 'Mayor precio' }, { value: 'year', label: 'Año más nuevo' }]} className="sm:w-44" />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
              {[1, 2, 3].map(i => <div key={i} className="sk rounded-lg h-80" />)}
            </div>
          ) : sorted.length === 0 ? (
            <Card padding="none">
              {filtersActive ? (
                <EmptyState compact title="Sin coincidencias" description="Prueba con otra palabra o limpia los filtros." primaryAction={<Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button>} />
              ) : (
                <EmptyState icon={Images} title="Todavía no hay publicaciones" description="Sé la primera persona en publicar una embarcación en la comunidad." primaryAction={<Button icon={Plus} onClick={() => abrirPublicar(null)}>Publicar embarcación</Button>} />
              )}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.map(item => <ListingCard key={item.id} item={item} onClick={setDetailItem} />)}
              </div>
              <p className="text-13 text-ink-500 mt-4 tabular">{filtersActive ? `${sorted.length} de ${listings.length} publicaciones` : `${listings.length} publicación${listings.length === 1 ? '' : 'es'}`}</p>
            </>
          )}
        </>
      ) : (
        <Card padding="none">
          <DataTable
            columns={columnasMias}
            data={myListings}
            rowKey={item => item.id}
            onRowClick={setDetailItem}
            rowActions={accionesMias}
            loading={loading}
            aria-label="Mis publicaciones"
            emptyState={(
              <EmptyState icon={Images} title="No tienes publicaciones" description="Publica tu embarcación para venderla o arrendarla a la comunidad Imporlan." primaryAction={<Button icon={Plus} onClick={() => abrirPublicar(null)}>Publicar embarcación</Button>} />
            )}
            mobileCard={item => {
              const photos = parsePhotos(item.fotos);
              return (
                <div className="flex items-start gap-3 min-w-0">
                  {photos[0] ? <img src={photos[0]} alt="" className="h-14 w-20 rounded-md object-cover bg-neutral-bg shrink-0" /> : <span className="h-14 w-20 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0"><ImageIcon size={18} /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900 truncate m-0">{item.nombre}</p>
                    <p className="text-13 text-ink-500 m-0">{[item.tipo, item.ano].filter(Boolean).join(' · ')}</p>
                    <div className={cn('flex flex-wrap items-center gap-2 mt-1.5')}>
                      <Precio item={item} size="sm" />
                      <StatusBadge kind="publicacion" status={item.status} size="sm" dot />
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </Card>
      )}

      <DetailModal item={detailItem} open={!!detailItem} onClose={() => setDetailItem(null)} />
      <PublishModal key={showPublish ? (editItem?.id || 'nueva') : 'cerrado'} open={showPublish} onClose={() => { setShowPublish(false); setEditItem(null); }} editItem={editItem} onSuccess={load} />
    </div>
  );
}
