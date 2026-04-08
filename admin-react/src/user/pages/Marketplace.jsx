import { useState, useEffect, useCallback, useRef } from 'react';
import { getMarketplaceListings, getMyListings, createListing, updateListing, deleteListing, renewListing, markListingSold, uploadListingPhoto } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Badge, Button, Modal, Input, Select, Textarea, Spinner, PageHeader } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const TIPOS = ['Bowrider', 'Pesca', 'Jet Boat', 'Yate', 'Velero', 'Moto de Agua', 'Catamaran', 'Otro'];
const CONDICIONES = ['Excelente', 'Muy Buena', 'Buena', 'Regular', 'Para Reparacion'];
const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  sold: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  deleted: 'bg-slate-100 text-slate-500',
};

function parsePhotos(fotos) {
  if (!fotos) return [];
  if (Array.isArray(fotos)) return fotos;
  try { return JSON.parse(fotos); } catch { return []; }
}

function fmtPrice(price, currency) {
  if (!price || isNaN(price)) return '-';
  if (currency === 'CLP') return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

// --- Browse Card ---
function ListingCard({ item, onClick }) {
  const photos = parsePhotos(item.fotos);
  const cover = photos[0] || null;

  return (
    <Card className="p-0 overflow-hidden card-hover cursor-pointer group" onClick={() => onClick(item)}>
      {/* Image */}
      <div className="h-44 bg-slate-100 relative overflow-hidden">
        {cover ? (
          <img src={cover} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow">EN VENTA</span>
          {item.estado === 'Nueva' && <span className="px-2 py-0.5 rounded-full bg-teal-500 text-white text-[10px] font-bold shadow">NUEVA</span>}
        </div>
        {photos.length > 1 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">{photos.length} fotos</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-slate-800 text-sm truncate">{item.nombre}</p>
          {item.ano && <span className="text-xs text-slate-400 shrink-0">{item.ano}</span>}
        </div>
        {item.tipo && <p className="text-xs text-slate-400 mb-2">{item.tipo}</p>}

        <p className="text-lg font-bold text-slate-900">{fmtPrice(item.precio, item.moneda)}</p>

        <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-400">
          {item.eslora && <span>{item.eslora}</span>}
          {item.ubicacion && <span>{item.ubicacion}</span>}
          {item.condicion && <Badge className="bg-slate-100 text-slate-600 text-[10px]">{item.condicion}</Badge>}
        </div>
      </div>
    </Card>
  );
}

// --- My Listing Card ---
function MyListingCard({ item, onEdit, onDelete, onRenew, onMarkSold }) {
  const st = STATUS_COLORS[item.status] || STATUS_COLORS.active;
  const photos = parsePhotos(item.fotos);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
          {photos[0] ? (
            <img src={photos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm text-slate-800 truncate">{item.nombre}</p>
            <Badge className={st}>{item.status}</Badge>
          </div>
          <p className="text-sm font-bold text-slate-700">{fmtPrice(item.precio, item.moneda)}</p>
          <p className="text-[11px] text-slate-400">{fmtDate(item.created_at)}{item.tipo ? ` · ${item.tipo}` : ''}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {item.status === 'active' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => onMarkSold(item.id)}>Vendido</Button>
            </>
          )}
          {(item.status === 'sold' || item.status === 'expired') && (
            <Button variant="ghost" size="sm" onClick={() => onRenew(item.id)}>Renovar</Button>
          )}
          {item.status !== 'deleted' && (
            <Button variant="ghost" size="sm" className="!text-red-500" onClick={() => onDelete(item.id, item.nombre)}>Eliminar</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// --- Detail Modal ---
function DetailModal({ item, open, onClose }) {
  if (!item) return null;
  const photos = parsePhotos(item.fotos);

  return (
    <Modal open={open} onClose={onClose} title={item.nombre} size="lg">
      {/* Photos */}
      {photos.length > 0 && (
        <div className="mb-4">
          <img src={photos[0]} alt="" className="w-full h-64 object-cover rounded-xl mb-2" />
          {photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.slice(1, 5).map((p, i) => (
                <img key={i} src={p} alt="" className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => window.open(p, '_blank')} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-2xl font-bold text-slate-900 mb-1">{fmtPrice(item.precio, item.moneda)}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 text-sm">
        {item.tipo && <InfoCell label="Tipo" value={item.tipo} />}
        {item.ano && <InfoCell label="Ano" value={item.ano} />}
        {item.eslora && <InfoCell label="Eslora" value={item.eslora} />}
        {item.horas && <InfoCell label="Horas Motor" value={item.horas} />}
        {item.ubicacion && <InfoCell label="Ubicacion" value={item.ubicacion} />}
        {item.condicion && <InfoCell label="Condicion" value={item.condicion} />}
        {item.estado && <InfoCell label="Estado" value={item.estado} />}
      </div>

      {item.descripcion && (
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap">{item.descripcion}</div>
      )}

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-400">
        <span>Publicado: {fmtDate(item.created_at)}</span>
        {item.user_name && <span>· {item.user_name}</span>}
      </div>
    </Modal>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase">{label}</p>
      <p className="text-slate-700 font-medium">{value}</p>
    </div>
  );
}

// --- Publish/Edit Form Modal ---
function PublishModal({ open, onClose, editItem, onSuccess }) {
  const toast = useToast();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ nombre: '', tipo: 'Bowrider', ano: '', eslora: '', precio: '', moneda: 'USD', ubicacion: '', estado: 'Usada', condicion: 'Buena', horas: '', descripcion: '' });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({
        nombre: editItem.nombre || '',
        tipo: editItem.tipo || 'Bowrider',
        ano: editItem.ano || '',
        eslora: editItem.eslora || '',
        precio: editItem.precio || '',
        moneda: editItem.moneda || 'USD',
        ubicacion: editItem.ubicacion || '',
        estado: editItem.estado || 'Usada',
        condicion: editItem.condicion || 'Buena',
        horas: editItem.horas || '',
        descripcion: editItem.descripcion || '',
      });
      const existingPhotos = parsePhotos(editItem.fotos);
      setPhotos(existingPhotos);
    } else {
      setForm({ nombre: '', tipo: 'Bowrider', ano: '', eslora: '', precio: '', moneda: 'USD', ubicacion: '', estado: 'Usada', condicion: 'Buena', horas: '', descripcion: '' });
      setPhotos([]);
    }
  }, [editItem, open]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleUploadPhoto(files) {
    if (photos.length + files.length > 8) { toast?.('Maximo 8 fotos', 'error'); return; }
    setUploading(true);
    for (const file of files) {
      try {
        const data = await uploadListingPhoto(editItem?.id || 'new', file);
        if (data.success && data.url) {
          setPhotos(p => [...p, data.url]);
        } else {
          toast?.(data.error || 'Error al subir foto', 'error');
        }
      } catch (e) {
        toast?.('Error al subir foto', 'error');
      }
    }
    setUploading(false);
  }

  function removePhoto(idx) {
    setPhotos(p => p.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!form.nombre.trim()) { toast?.('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    const email = user?.email || user?.user_email || '';
    const name = user?.name || '';
    const payload = {
      ...form,
      fotos: photos,
      user_email: email,
      user_name: name,
    };
    try {
      let data;
      if (editItem) {
        data = await updateListing({ ...payload, id: editItem.id });
      } else {
        data = await createListing(payload);
      }
      if (data.success) {
        toast?.(editItem ? 'Publicacion actualizada' : 'Publicacion creada', 'success');
        onSuccess();
        onClose();
      } else {
        toast?.(data.error || 'Error al guardar', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion', 'error');
    }
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={editItem ? 'Editar Publicacion' : 'Publicar Embarcacion'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre / Modelo *" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Sea Ray 250 SLX" />
          <Select label="Tipo" value={form.tipo} onChange={e => set('tipo', e.target.value)} options={TIPOS.map(t => ({ value: t, label: t }))} />
          <Input label="Ano" type="number" value={form.ano} onChange={e => set('ano', e.target.value)} placeholder="2023" />
          <Input label="Eslora" value={form.eslora} onChange={e => set('eslora', e.target.value)} placeholder="25 ft" />
          <Input label="Precio" type="number" value={form.precio} onChange={e => set('precio', e.target.value)} placeholder="50000" />
          <Select label="Moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)} options={[{ value: 'USD', label: 'USD' }, { value: 'CLP', label: 'CLP' }]} />
          <Input label="Ubicacion" value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Vina del Mar, Chile" />
          <Select label="Estado" value={form.estado} onChange={e => set('estado', e.target.value)} options={[{ value: 'Nueva', label: 'Nueva' }, { value: 'Usada', label: 'Usada' }]} />
          <Select label="Condicion" value={form.condicion} onChange={e => set('condicion', e.target.value)} options={CONDICIONES.map(c => ({ value: c, label: c }))} />
          <Input label="Horas Motor" type="number" value={form.horas} onChange={e => set('horas', e.target.value)} placeholder="150" />
        </div>

        <Textarea label="Descripcion" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Describe tu embarcacion..." />

        {/* Photos */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fotos ({photos.length}/8)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {photos.map((url, i) => (
              <div key={i} className="relative w-20 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center">x</button>
                {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center">Portada</span>}
              </div>
            ))}
            {photos.length < 8 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-cyan-400 flex items-center justify-center text-slate-400 hover:text-cyan-500 transition"
              >
                {uploading ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { if (e.target.files.length) handleUploadPhoto(Array.from(e.target.files)); e.target.value = ''; }} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : (editItem ? 'Guardar' : 'Publicar')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Main Page ---
export default function Marketplace() {
  const toast = useToast();
  const [tab, setTab] = useState('browse');
  const [listings, setListings] = useState([]);
  const [myListings, setMyListingsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sort, setSort] = useState('recent');

  const load = useCallback(async () => {
    try {
      const [allRes, myRes] = await Promise.all([
        getMarketplaceListings().catch(() => ({ listings: [] })),
        getMyListings().catch(() => ({ listings: [] })),
      ]);
      setListings(allRes.listings || allRes.data || []);
      setMyListingsState(myRes.listings || myRes.data || []);
    } catch (e) {
      toast?.('Error al cargar marketplace', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...listings].sort((a, b) => {
    if (sort === 'price_asc') return (a.precio || 0) - (b.precio || 0);
    if (sort === 'price_desc') return (b.precio || 0) - (a.precio || 0);
    if (sort === 'year') return (b.ano || 0) - (a.ano || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  async function handleDelete(id, nombre) {
    if (!confirm(`Eliminar "${nombre}"?`)) return;
    try {
      const data = await deleteListing(id);
      if (data.success) { toast?.('Publicacion eliminada', 'success'); load(); }
      else toast?.(data.error || 'Error', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  async function handleRenew(id) {
    try {
      const data = await renewListing(id);
      if (data.success) { toast?.('Publicacion renovada por 30 dias', 'success'); load(); }
      else toast?.(data.error || 'Error', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  async function handleMarkSold(id) {
    if (!confirm('Marcar como vendido?')) return;
    try {
      const data = await markListingSold(id);
      if (data.success) { toast?.('Marcado como vendido', 'success'); load(); }
      else toast?.(data.error || 'Error', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Marketplace"
        subtitle={tab === 'browse' ? `${listings.length} publicaciones activas` : `${myListings.length} publicaciones tuyas`}
        action={
          <Button variant="accent" size="sm" onClick={() => { setEditItem(null); setShowPublish(true); }} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
            Publicar
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('browse')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', tab === 'browse' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Comprar
        </button>
        <button onClick={() => setTab('mine')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', tab === 'mine' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Mis Publicaciones
          {myListings.length > 0 && <span className="ml-1.5 text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">{myListings.length}</span>}
        </button>
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <>
          <div className="mb-4">
            <Select
              value={sort}
              onChange={e => setSort(e.target.value)}
              options={[
                { value: 'recent', label: 'Mas Recientes' },
                { value: 'price_asc', label: 'Menor Precio' },
                { value: 'price_desc', label: 'Mayor Precio' },
                { value: 'year', label: 'Ano Descendente' },
              ]}
              className="w-48"
            />
          </div>

          {sorted.length === 0 ? (
            <Card className="text-center py-16">
              <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
              <p className="text-slate-500 font-medium">No hay publicaciones activas</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map(item => (
                <ListingCard key={item.id} item={item} onClick={setDetailItem} />
              ))}
            </div>
          )}
        </>
      )}

      {/* My listings tab */}
      {tab === 'mine' && (
        myListings.length === 0 ? (
          <Card className="text-center py-16">
            <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 4v16m8-8H4"/></svg>
            <p className="text-slate-500 font-medium">No tienes publicaciones</p>
            <p className="text-sm text-slate-400 mt-1">Publica tu primera embarcacion.</p>
            <Button variant="accent" size="sm" className="mt-4" onClick={() => { setEditItem(null); setShowPublish(true); }}>
              Publicar Embarcacion
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {myListings.map(item => (
              <MyListingCard
                key={item.id}
                item={item}
                onEdit={(it) => { setEditItem(it); setShowPublish(true); }}
                onDelete={handleDelete}
                onRenew={handleRenew}
                onMarkSold={handleMarkSold}
              />
            ))}
          </div>
        )
      )}

      {/* Detail modal */}
      <DetailModal item={detailItem} open={!!detailItem} onClose={() => setDetailItem(null)} />

      {/* Publish/Edit modal */}
      <PublishModal
        open={showPublish}
        onClose={() => { setShowPublish(false); setEditItem(null); }}
        editItem={editItem}
        onSuccess={load}
      />
    </div>
  );
}
