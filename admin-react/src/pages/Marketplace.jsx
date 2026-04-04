import { useState, useEffect, useCallback } from 'react';
import {
  getMarketplaceAdminList, getMarketplaceAdminDetail,
  updateMarketplaceStatus, updateMarketplaceListing, deleteMarketplaceListing
} from '../lib/api';
import { fmtCLP, fmtDate, statusColor } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Input, Select, Spinner, StatCard, Modal, Button, Textarea } from '../components/UI';
import { useToast } from '../components/Toast';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activa' },
  { value: 'sold', label: 'Vendida' },
  { value: 'deleted', label: 'Eliminada' },
];

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
  { value: 'Muy Buena', label: 'Muy Buena' },
  { value: 'Buena', label: 'Buena' },
  { value: 'Regular', label: 'Regular' },
  { value: 'Para Reparacion', label: 'Para Reparacion' },
];

const MONEDA_OPTIONS = [
  { value: 'CLP', label: 'CLP' },
  { value: 'USD', label: 'USD' },
];

export default function Marketplace() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [photoView, setPhotoView] = useState(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    getMarketplaceAdminList()
      .then(res => setItems(res.items || res.listings || []))
      .catch(err => { console.error(err); toast && toast('Error cargando publicaciones', 'error'); })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openDetail = (item) => {
    setDetailLoading(true);
    setSelected(item);
    setEditMode(false);
    getMarketplaceAdminDetail(item.id)
      .then(res => { setSelected(res.listing || res.item || item); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => { setSelected(null); setEditMode(false); setEditData({}); };

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
      toast && toast('Publicacion actualizada');
      setEditMode(false);
      const updated = { ...selected, ...editData };
      setSelected(updated);
      setItems(prev => prev.map(i => i.id === selected.id ? { ...i, ...editData } : i));
    } catch (err) {
      toast && toast(err.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, newStatus, label) => {
    try {
      await updateMarketplaceStatus(id, newStatus);
      toast && toast('Publicacion marcada como ' + label);
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
      if (selected && selected.id === id) setSelected(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      toast && toast(err.message || 'Error al cambiar estado', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMarketplaceListing(id);
      toast && toast('Publicacion eliminada');
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'deleted' } : i));
      if (selected && selected.id === id) closeDetail();
      setConfirmDelete(null);
    } catch (err) {
      toast && toast(err.message || 'Error al eliminar', 'error');
    }
  };

  const active = items.filter(i => i.status === 'active').length;
  const sold = items.filter(i => i.status === 'sold').length;
  const deleted = items.filter(i => i.status === 'deleted').length;
  const types = [...new Set(items.map(i => i.tipo_publicacion || i.listing_type || i.type).filter(Boolean))];
  const statuses = [...new Set(items.map(i => i.status).filter(Boolean))];

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (typeFilter && (i.tipo_publicacion || i.listing_type || i.type) !== typeFilter) return false;
    if (search) {
      const hay = [i.nombre, i.title, i.tipo, i.user_email, i.seller_name, i.ubicacion, i.location]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const fmtPrice = (r) => {
    const price = r.precio || r.price;
    if (!price) return '-';
    const cur = r.moneda || r.currency || 'CLP';
    return cur === 'USD' ? 'US$' + Number(price).toLocaleString() : fmtCLP(price);
  };

  const statusBadge = (status) => {
    const sc = { active: 'bg-emerald-50 text-emerald-700', sold: 'bg-violet-50 text-violet-700', deleted: 'bg-red-50 text-red-600', expired: 'bg-slate-100 text-slate-500' };
    return sc[status] || 'bg-slate-100 text-slate-500';
  };

  const columns = [
    { header: 'ID', cell: r => <span className="font-mono text-xs text-slate-400">#{r.id}</span> },
    { header: 'Publicacion', cell: r => {
      const fotos = r.fotos || [];
      const img = fotos[0] || r.main_photo;
      return (
        <div className="flex items-center gap-3">
          {img ? (
            <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-700 truncate max-w-[220px]">{r.nombre || r.title || '-'}</p>
            <p className="text-xs text-slate-400">{r.tipo || ''} {r.ano || r.year ? '(' + (r.ano || r.year) + ')' : ''}</p>
          </div>
        </div>
      );
    }},
    { header: 'Tipo', cell: r => {
      const tp = r.tipo_publicacion || r.listing_type || r.type || '-';
      return <Badge className={tp === 'arriendo' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}>{tp}</Badge>;
    }},
    { header: 'Vendedor', cell: r => (
      <div>
        <p className="text-sm font-medium">{r.seller_name || r.user_name || '-'}</p>
        <p className="text-xs text-slate-400">{r.user_email || ''}</p>
      </div>
    )},
    { header: 'Precio', cell: r => <span className="font-semibold tabular-nums">{fmtPrice(r)}</span> },
    { header: 'Ubicacion', cell: r => <span className="text-sm">{r.ubicacion || r.location || r.city || '-'}</span> },
    { header: 'Estado', cell: r => <Badge className={statusBadge(r.status)}>{r.status}</Badge> },
    { header: 'Fecha', cell: r => <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span> },
    { header: 'Vistas', cell: r => <span className="tabular-nums text-slate-500">{r.views || 0}</span> },
    { header: 'Acciones', cell: r => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {r.status === 'active' && (
          <button onClick={() => handleStatusChange(r.id, 'sold', 'vendida')}
            className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-500 hover:text-violet-700 transition-colors" title="Marcar vendida">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        )}
        {(r.status === 'sold' || r.status === 'deleted') && (
          <button onClick={() => handleStatusChange(r.id, 'active', 'activa')}
            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors" title="Reactivar">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}
        <button onClick={() => setConfirmDelete(r)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Eliminar">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Marketplace" subtitle={items.length + ' publicaciones totales'} />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={items.length} color="blue" />
        <StatCard label="Activas" value={active} color="green" />
        <StatCard label="Vendidas" value={sold} color="purple" />
        <StatCard label="Eliminadas" value={deleted} color="red" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input placeholder="Buscar por titulo, tipo, vendedor, ubicacion..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[
            { value: '', label: 'Todos los tipos' },
            ...types.map(t => ({ value: t, label: t })),
          ]} className="w-44" />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
            { value: '', label: 'Todos los estados' },
            ...statuses.map(s => ({ value: s, label: s })),
          ]} className="w-44" />
          <Button variant="secondary" size="sm" onClick={loadItems} className="whitespace-nowrap">Refrescar</Button>
        </div>
        <Table columns={columns} data={filtered} onRowClick={openDetail} emptyMsg="Sin publicaciones en el marketplace" />
      </Card>

      {/* Detail / Edit Modal */}
      <Modal open={!!selected} onClose={closeDetail} title={editMode ? 'Editar Publicacion' : 'Detalle de Publicacion'} size="xl">
        {selected && (
          detailLoading ? <Spinner /> : (
            editMode ? (
              <EditForm data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditMode(false)} saving={saving} />
            ) : (
              <DetailView item={selected} onEdit={startEdit} onStatusChange={handleStatusChange} onDelete={() => setConfirmDelete(selected)} onPhotoClick={setPhotoView} />
            )
          )
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirmar eliminacion" size="sm">
        {confirmDelete && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Estas seguro de eliminar la publicacion <strong>#{confirmDelete.id} - {confirmDelete.nombre || confirmDelete.title || ''}</strong>?
            </p>
            <p className="text-xs text-slate-400 mb-6">La publicacion se marcara como eliminada y no sera visible para los usuarios.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(confirmDelete.id)}>Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Photo lightbox */}
      {photoView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setPhotoView(null)}>
          <div className="fixed inset-0 bg-black/80" />
          <img src={photoView} alt="" className="relative z-10 max-w-full max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}
    </>
  );
}

function DetailView({ item, onEdit, onStatusChange, onDelete, onPhotoClick }) {
  const fotos = item.fotos || [];
  const price = item.precio || item.price;
  const cur = item.moneda || item.currency || 'CLP';
  const priceStr = price ? (cur === 'USD' ? 'US$' + Number(price).toLocaleString() : fmtCLP(price)) : '-';
  const statusBadgeCls = { active: 'bg-emerald-50 text-emerald-700', sold: 'bg-violet-50 text-violet-700', deleted: 'bg-red-50 text-red-600' };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{item.nombre || item.title || 'Sin titulo'}</h2>
          <p className="text-sm text-slate-400 mt-0.5">ID #{item.id} - {item.tipo_publicacion || item.listing_type || '-'} - Creada {fmtDate(item.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Button variant="secondary" size="sm" onClick={onEdit}>Editar</Button>
          {item.status === 'active' && (
            <Button variant="accent" size="sm" onClick={() => onStatusChange(item.id, 'sold', 'vendida')}>Marcar Vendida</Button>
          )}
          {(item.status === 'sold' || item.status === 'deleted') && (
            <Button variant="primary" size="sm" onClick={() => onStatusChange(item.id, 'active', 'activa')}>Reactivar</Button>
          )}
          <Button variant="danger" size="sm" onClick={onDelete}>Eliminar</Button>
        </div>
      </div>

      {/* Photos */}
      {fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {fotos.map((f, i) => (
            <img key={i} src={f} alt="" className="w-24 h-24 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
              onClick={() => onPhotoClick(f)} />
          ))}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <InfoField label="Estado" value={<Badge className={statusBadgeCls[item.status] || 'bg-slate-100 text-slate-500'}>{item.status}</Badge>} />
        <InfoField label="Tipo embarcacion" value={item.tipo || '-'} />
        <InfoField label="Ano" value={item.ano || item.year || '-'} />
        <InfoField label="Eslora" value={item.eslora ? item.eslora + ' pies' : '-'} />
        <InfoField label="Horas motor" value={item.horas || '-'} />
        <InfoField label="Condicion" value={item.condicion || '-'} />
        <InfoField label="Estado (condicion)" value={item.estado || '-'} />
        <InfoField label="Precio" value={priceStr} />
        <InfoField label="Ubicacion" value={item.ubicacion || item.location || '-'} />
      </div>

      {/* Description */}
      {(item.descripcion || item.description) && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descripcion</p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{item.descripcion || item.description}</p>
        </div>
      )}

      {/* Seller info */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Vendedor</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoField label="Nombre" value={item.seller_name || item.user_name || '-'} />
          <InfoField label="Email" value={item.user_email || '-'} />
          <InfoField label="Telefono" value={item.user_phone || item.phone || '-'} />
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estadisticas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoField label="Vistas" value={item.views || 0} />
          <InfoField label="Leads" value={item.lead_count || 0} />
          <InfoField label="Creada" value={fmtDate(item.created_at)} />
          <InfoField label="Expira" value={item.expires_at ? fmtDate(item.expires_at) : '-'} />
        </div>
      </div>

      {/* Arriendo periods if applicable */}
      {item.arriendo_periodos && item.arriendo_periodos.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Periodos de Arriendo</p>
          <div className="space-y-2">
            {item.arriendo_periodos.map((p, i) => (
              <div key={i} className="flex items-center gap-4 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{p.nombre || p.name || 'Periodo ' + (i+1)}</span>
                <span className="text-slate-500">{p.precio || p.price ? (cur === 'USD' ? 'US$' + Number(p.precio || p.price).toLocaleString() : fmtCLP(p.precio || p.price)) : '-'}</span>
                {p.duracion && <span className="text-slate-400 text-xs">{p.duracion}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-medium text-slate-700 mt-0.5">{value}</div>
    </div>
  );
}

function EditForm({ data, onChange, onSave, onCancel, saving }) {
  const set = (field, val) => onChange(prev => ({ ...prev, [field]: val }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Nombre / Titulo" value={data.nombre} onChange={e => set('nombre', e.target.value)} />
        <Select label="Tipo publicacion" value={data.tipo_publicacion} onChange={e => set('tipo_publicacion', e.target.value)}
          options={TIPO_PUB_OPTIONS} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Tipo embarcacion" value={data.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Ej: Lancha, Velero..." />
        <Input label="Ano" type="number" value={data.ano} onChange={e => set('ano', e.target.value)} />
        <Input label="Eslora (pies)" value={data.eslora} onChange={e => set('eslora', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Precio" type="number" value={data.precio} onChange={e => set('precio', e.target.value)} />
        <Select label="Moneda" value={data.moneda} onChange={e => set('moneda', e.target.value)} options={MONEDA_OPTIONS} />
        <Input label="Horas motor" type="number" value={data.horas} onChange={e => set('horas', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Ubicacion" value={data.ubicacion} onChange={e => set('ubicacion', e.target.value)} />
        <Select label="Estado" value={data.estado} onChange={e => set('estado', e.target.value)} options={ESTADO_OPTIONS} />
        <Select label="Condicion" value={data.condicion} onChange={e => set('condicion', e.target.value)} options={CONDICION_OPTIONS} />
      </div>

      <Select label="Status de publicacion" value={data.status} onChange={e => set('status', e.target.value)} options={STATUS_OPTIONS} />

      <Textarea label="Descripcion" value={data.descripcion} onChange={e => set('descripcion', e.target.value)} className="col-span-full" />

      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
