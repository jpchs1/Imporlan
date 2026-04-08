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
    <div onClick={() => onClick(item)} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Image */}
      <div className="h-40 sm:h-56 bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
        {cover ? (
          <img src={cover} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span className="text-[10px] text-slate-300 font-medium">Sin imagen</span>
          </div>
        )}
        {/* Gradient overlay at bottom */}
        {cover && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />}
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {item.tipo_publicacion === 'arriendo' ? (
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold shadow-lg shadow-amber-500/30">EN ARRIENDO</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-bold shadow-lg shadow-emerald-500/30">EN VENTA</span>
          )}
          {item.estado === 'Nueva' && <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 text-white text-[10px] font-bold shadow-lg shadow-cyan-500/30">NUEVA</span>}
        </div>
        {photos.length > 1 && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            {photos.length}
          </span>
        )}
        {/* Price on image */}
        {cover && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            {(item.moneda || 'USD') === 'CLP' ? (
              <svg className="w-5 h-3.5 rounded-sm shrink-0 shadow" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><rect width="640" height="240" y="240" fill="#d52b1e"/><rect width="213" height="240" fill="#0039a6"/><circle cx="107" cy="120" r="48" fill="#fff"/></svg>
            ) : (
              <svg className="w-5 h-3.5 rounded-sm shrink-0 shadow" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><g fill="#b22234">{[0,2,4,6,8,10,12].map(i=><rect key={i} y={i*37} width="640" height="37"/>)}</g><rect width="256" height="259" fill="#3c3b6e"/></svg>
            )}
            <span className="text-xl font-extrabold text-white drop-shadow-lg">{fmtPrice(item.precio, item.moneda)}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{item.nombre}</p>
            <p className="text-xs text-slate-400">{[item.tipo, item.ano].filter(Boolean).join(' · ')}</p>
          </div>
        </div>

        {/* Price (when no cover image) */}
        {!cover && (
          <div className="flex items-center gap-2 mb-2">
            <p className="text-lg font-bold text-blue-700">{fmtPrice(item.precio, item.moneda)}</p>
            <span className="text-xs text-slate-400 font-medium">{item.moneda || 'USD'}</span>
          </div>
        )}

        {/* Specs */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
          {item.eslora && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M3 12h18M3 18h18"/></svg>{item.eslora}</span>}
          {item.horas && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>{item.horas} hrs</span>}
          {item.ubicacion && <span className="flex items-center gap-1"><svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>{item.ubicacion}</span>}
        </div>

        {/* Condition badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.condicion && <Badge className={cn('text-[10px] uppercase font-bold', item.condicion === 'Excelente' || item.condicion === 'Muy Buena' ? 'bg-emerald-100 text-emerald-700' : item.condicion === 'Regular' ? 'bg-amber-100 text-amber-700' : item.condicion === 'Para Reparacion' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}>{item.condicion}</Badge>}
          {item.estado && <Badge className="bg-slate-100 text-slate-500 text-[10px] uppercase">{item.estado}</Badge>}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">{(item.user_name || 'U')[0].toUpperCase()}</div>
            <span className="text-[11px] text-slate-400 truncate max-w-[100px]">{item.user_name || 'Vendedor'}</span>
          </div>
          <span className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[11px] font-bold shadow-md shadow-cyan-500/20 group-hover:shadow-lg group-hover:shadow-cyan-500/30 transition-shadow">
            Ver Detalles
          </span>
        </div>
      </div>
    </div>
  );
}

// --- My Listing Card ---
function MyListingCard({ item, onEdit, onDelete, onRenew, onMarkSold }) {
  const st = STATUS_COLORS[item.status] || STATUS_COLORS.active;
  const photos = parsePhotos(item.fotos);

  return (
    <Card className="p-0 overflow-hidden card-hover">
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="sm:w-48 h-32 sm:h-auto bg-slate-100 overflow-hidden shrink-0 relative">
          {photos[0] ? (
            <img src={photos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center min-h-[120px]">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge className={cn(st, 'shadow-sm')}>{item.status === 'active' ? 'Activa' : item.status === 'sold' ? 'Vendida' : item.status === 'expired' ? 'Expirada' : item.status}</Badge>
          </div>
          {photos.length > 1 && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">{photos.length} fotos</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <p className="font-bold text-slate-800">{item.nombre}</p>
                <p className="text-xs text-slate-400">{item.tipo}{item.ano ? ` · ${item.ano}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg font-bold text-blue-700">{fmtPrice(item.precio, item.moneda)}</p>
              <span className="text-xs text-slate-400">{item.moneda || 'USD'}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
              {item.eslora && <span>{item.eslora}</span>}
              {item.horas && <span>{item.horas} hrs</span>}
              {item.ubicacion && <span>{item.ubicacion}</span>}
              <span>{fmtDate(item.created_at)}</span>
            </div>
            {item.condicion && (
              <div className="flex gap-1.5 mt-2">
                <Badge className={cn('text-[10px]', item.condicion === 'Excelente' || item.condicion === 'Muy Buena' ? 'bg-emerald-100 text-emerald-700' : item.condicion === 'Regular' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{item.condicion}</Badge>
                {item.estado && <Badge className="bg-slate-100 text-slate-500 text-[10px]">{item.estado}</Badge>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            {item.status === 'active' && (
              <>
                <button onClick={() => onEdit(item)} className="px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 transition flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Editar
                </button>
                <button onClick={() => onMarkSold(item.id)} className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Marcar Vendido
                </button>
              </>
            )}
            {(item.status === 'sold' || item.status === 'expired') && (
              <button onClick={() => onRenew(item.id)} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Renovar (+30 dias)
              </button>
            )}
            {item.status !== 'deleted' && (
              <button onClick={() => onDelete(item.id, item.nombre)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Eliminar
              </button>
            )}
          </div>
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
        <div className="mb-5 -mx-6 -mt-6">
          <div className="relative">
            <img src={photos[0]} alt="" className="w-full h-72 object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <p className="text-2xl font-extrabold text-white drop-shadow-lg">{fmtPrice(item.precio, item.moneda)}</p>
              <p className="text-xs text-white/70">{item.moneda || 'USD'}</p>
            </div>
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 px-5 mt-2">
              {photos.slice(1, 5).map((p, i) => (
                <img key={i} src={p} alt="" className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition" onClick={() => window.open(p, '_blank')} />
              ))}
            </div>
          )}
        </div>
      )}

      {photos.length === 0 && <p className="text-2xl font-bold text-slate-900 mb-1">{fmtPrice(item.precio, item.moneda)}</p>}

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

      {/* Seller info */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{(item.user_name || 'V')[0].toUpperCase()}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">{item.user_name || 'Vendedor'}</p>
          <p className="text-xs text-slate-400">Publicado: {fmtDate(item.created_at)}</p>
        </div>
      </div>

      {/* Contact actions */}
      <div className="flex gap-3 mt-4">
        <a href={`https://wa.me/56940211459?text=${encodeURIComponent(`Hola, me interesa: ${item.nombre} (${fmtPrice(item.precio, item.moneda)})`)}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold text-center hover:bg-emerald-600 transition flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          WhatsApp
        </a>
        <button onClick={() => { onClose(); window.location.hash = '#/messages'; }} className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-semibold text-center hover:bg-cyan-600 transition flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          Chatear
        </button>
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
  const [form, setForm] = useState({ nombre: '', tipo: 'Bowrider', ano: '', eslora: '', precio: '', moneda: 'USD', ubicacion: '', estado: 'Usada', condicion: 'Buena', horas: '', descripcion: '', tipo_publicacion: 'venta' });
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
        tipo_publicacion: editItem.tipo_publicacion || 'venta',
      });
      const existingPhotos = parsePhotos(editItem.fotos);
      setPhotos(existingPhotos);
    } else {
      setForm({ nombre: '', tipo: 'Bowrider', ano: '', eslora: '', precio: '', moneda: 'USD', ubicacion: '', estado: 'Usada', condicion: 'Buena', horas: '', descripcion: '', tipo_publicacion: 'venta' });
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
        {/* Tipo publicacion */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de Publicacion</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => set('tipo_publicacion', 'venta')} className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2', form.tipo_publicacion === 'venta' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
              Venta
            </button>
            <button type="button" onClick={() => set('tipo_publicacion', 'arriendo')} className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2', form.tipo_publicacion === 'arriendo' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
              Arriendo
            </button>
          </div>
        </div>
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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

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

  const filtered = listings.filter(item => {
    if (search && !(`${item.nombre} ${item.tipo} ${item.ubicacion}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterType && item.tipo !== filterType) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
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
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar embarcaciones..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white" />
            </div>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} options={[{ value: '', label: 'Todos los tipos' }, ...TIPOS.map(t => ({ value: t, label: t }))]} className="w-44" />
            <Select value={sort} onChange={e => setSort(e.target.value)} options={[{ value: 'recent', label: 'Mas Recientes' }, { value: 'price_asc', label: 'Menor Precio' }, { value: 'price_desc', label: 'Mayor Precio' }, { value: 'year', label: 'Ano Descendente' }]} className="w-44" />
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
