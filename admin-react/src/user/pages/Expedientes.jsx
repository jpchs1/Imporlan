import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyOrders, getMyOrderDetail, saveRanking, notifyRanking, getMyFiles } from '../api';
import { fmtDate, statusColor, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { PageHeader, Card, Badge, Button, Spinner, Modal } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import Timeline from '../../shared/components/Timeline';

// --- List View ---

function OrderCard({ order, onClick }) {
  const svcLabel = order.service_type === 'cotizacion_link' ? 'Cotizacion' : 'Busqueda';
  return (
    <Card
      className="card-hover cursor-pointer group"
      onClick={() => onClick(order.id)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-400 font-medium">Expediente</p>
          <p className="text-base font-bold text-slate-800">#{order.order_number}</p>
        </div>
        <Badge className={statusColor(order.status)}>
          {(order.status || '').replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-slate-500">
        {order.plan_name && (
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <span>{order.plan_name}</span>
          </div>
        )}
        {order.asset_name && (
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <span>{order.asset_name}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span>{fmtDate(order.created_at)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-medium uppercase">{svcLabel}</span>
        <span className="text-xs font-semibold text-cyan-600 group-hover:text-cyan-700 flex items-center gap-1">
          Ver detalle
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </Card>
  );
}

// --- Vessel Card ---

function VesselCard({ link, index, dragHandlers }) {
  const [imgError, setImgError] = useState(false);
  const isSold = link.link_status === 'sold' || link.link_status === 'unavailable';

  function fmtUsd(v) {
    if (!v || isNaN(v)) return '';
    return parseFloat(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
  }
  function fmtClp(v) {
    if (!v || isNaN(v)) return '';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
  }

  function openUrl() {
    if (link.url) window.open(link.url.startsWith('http') ? link.url : 'https://' + link.url, '_blank');
  }

  function copyUrl() {
    if (link.url) navigator.clipboard.writeText(link.url).catch(() => {});
  }

  const title = [link.make, link.model, link.year].filter(Boolean).join(' ') || 'Embarcacion';

  return (
    <div
      draggable
      className={cn(
        'flex gap-4 p-4 bg-white border border-slate-200 rounded-xl transition-all group',
        isSold && 'opacity-60 grayscale',
        'hover:shadow-md hover:border-slate-300'
      )}
      {...dragHandlers}
    >
      {/* Drag handle */}
      <div className="flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing shrink-0 opacity-30 group-hover:opacity-60">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
      </div>

      {/* Number */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
        {index + 1}
      </div>

      {/* Image */}
      <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
        {link.image_url && !imgError ? (
          <img src={link.image_url} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-800 text-sm truncate">{title}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
              {link.location && <span>{link.location}</span>}
              {link.hours && <span>{link.hours} hrs</span>}
              {link.engine && <span>{link.engine}</span>}
            </div>
          </div>
          {isSold && (
            <Badge className="bg-red-100 text-red-700 shrink-0">
              {link.link_status === 'sold' ? 'Vendido' : 'No disponible'}
            </Badge>
          )}
        </div>

        {/* Prices */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {link.value_usa_usd > 0 && (
            <span className="text-xs font-semibold text-emerald-600">{fmtUsd(link.value_usa_usd)} USD</span>
          )}
          {link.value_chile_clp > 0 && (
            <span className="text-xs font-semibold text-blue-600">{fmtClp(link.value_chile_clp)}</span>
          )}
          {link.value_to_negotiate_usd > 0 && (
            <span className="text-xs text-slate-400">Neg: {fmtUsd(link.value_to_negotiate_usd)}</span>
          )}
        </div>

        {/* Actions + Comments */}
        <div className="flex items-center gap-2 mt-2">
          {link.url && (
            <>
              <button onClick={openUrl} className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-600 text-[11px] font-medium hover:bg-cyan-100 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Abrir
              </button>
              <button onClick={copyUrl} className="px-2 py-1 rounded-lg bg-slate-50 text-slate-500 text-[11px] font-medium hover:bg-slate-100 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copiar
              </button>
            </>
          )}
          {link.comments && (
            <span className="text-[11px] text-slate-400 italic truncate max-w-[200px]" title={link.comments}>
              {link.comments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Detail View ---

function OrderDetail({ orderId, onBack }) {
  const toast = useToast();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const dragSrc = useRef(null);
  const pollRef = useRef(null);
  const lastRankingTs = useRef(null);

  const loadDetail = useCallback(async () => {
    try {
      const data = await getMyOrderDetail(orderId);
      if (data.success && data.order) {
        setOrder(data.order);
        setLinks(data.order.links || []);
        lastRankingTs.current = data.order.ranking_updated_at || null;
      }
    } catch (e) {
      toast?.('Error al cargar expediente', 'error');
    }
    setLoading(false);
  }, [orderId, toast]);

  const loadFiles = useCallback(async () => {
    try {
      const data = await getMyFiles(orderId);
      if (data.success && data.files) setFiles(data.files);
    } catch (e) { /* silent */ }
  }, [orderId]);

  useEffect(() => {
    loadDetail();
    loadFiles();
  }, [loadDetail, loadFiles]);

  // Polling for admin ranking updates (30s)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getMyOrderDetail(orderId);
        if (data.success && data.order) {
          const newTs = data.order.ranking_updated_at;
          if (newTs && newTs !== lastRankingTs.current) {
            lastRankingTs.current = newTs;
            setOrder(data.order);
            setLinks(data.order.links || []);
            const who = data.order.ranking_author_role === 'admin' ? 'el equipo Imporlan' : data.order.ranking_author_name;
            toast?.(`Ranking actualizado por ${who}`, 'success');
          }
        }
      } catch (e) { /* silent */ }
    }, 30000);
    return () => clearInterval(pollRef.current);
  }, [orderId, toast]);

  // Drag & Drop handlers
  function handleDragStart(idx) {
    return (e) => {
      dragSrc.current = idx;
      e.dataTransfer.effectAllowed = 'move';
    };
  }

  function handleDragOver(idx) {
    return (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };
  }

  function handleDrop(idx) {
    return (e) => {
      e.preventDefault();
      if (dragSrc.current === null || dragSrc.current === idx) return;
      const newLinks = [...links];
      const [moved] = newLinks.splice(dragSrc.current, 1);
      newLinks.splice(idx, 0, moved);
      setLinks(newLinks);
      dragSrc.current = null;
      // Auto-save
      doSaveRanking(newLinks);
    };
  }

  function handleDragEnd() {
    dragSrc.current = null;
  }

  async function doSaveRanking(currentLinks) {
    setSaving(true);
    try {
      const linkIds = currentLinks.map(l => l.id);
      const data = await saveRanking(orderId, linkIds);
      if (data.success) {
        toast?.('Ranking guardado', 'success');
        if (data.ranking_author_name) {
          lastRankingTs.current = new Date().toISOString();
        }
      } else {
        toast?.(data.error || 'Error al guardar ranking', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion', 'error');
    }
    setSaving(false);
  }

  async function handleNotify() {
    setNotifying(true);
    try {
      // Save first, then notify
      const linkIds = links.map(l => l.id);
      await saveRanking(orderId, linkIds);
      const data = await notifyRanking(orderId);
      if (data.success) {
        toast?.(data.message || 'Notificacion enviada al agente', 'success');
      } else {
        toast?.(data.error || 'Error al notificar', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion', 'error');
    }
    setNotifying(false);
  }

  if (loading) return <Spinner />;
  if (!order) return <div className="text-center py-12 text-slate-400">Expediente no encontrado</div>;

  const title = [order.make, order.model, order.year].filter(Boolean).join(' ') || order.asset_name || `Expediente #${order.order_number}`;
  const activeLinks = links.filter(l => l.url);
  const imageFiles = files.filter(f => (f.category || '').startsWith('image') || (f.mime_type || '').startsWith('image/'));
  const docFiles = files.filter(f => !((f.category || '').startsWith('image') || (f.mime_type || '').startsWith('image/')));

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
        Volver a expedientes
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">#{order.order_number}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{title}</p>
        </div>
        <Badge className={cn(statusColor(order.status), 'text-xs')}>{(order.status || '').replace(/_/g, ' ')}</Badge>
      </div>

      {/* Timeline */}
      <Timeline step={order.timeline_step || 1} />

      {/* Info grid */}
      <Card className="mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {order.plan_name && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Plan</p>
              <p className="text-slate-700 font-medium">{order.plan_name}</p>
            </div>
          )}
          {order.service_type && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Tipo</p>
              <p className="text-slate-700 font-medium">{order.service_type === 'cotizacion_link' ? 'Cotizacion' : 'Busqueda'}</p>
            </div>
          )}
          {order.agent_name && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Agente</p>
              <p className="text-slate-700 font-medium">{order.agent_name}</p>
              {order.agent_phone && <p className="text-xs text-slate-400">{order.agent_phone}</p>}
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Creado</p>
            <p className="text-slate-700 font-medium">{fmtDate(order.created_at)}</p>
          </div>
        </div>
      </Card>

      {/* Ranking section */}
      {activeLinks.length > 0 && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                Ranking de Embarcaciones
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Arrastra las tarjetas para ordenar tu preferencia. {activeLinks.length} embarcacion{activeLinks.length !== 1 ? 'es' : ''}.
              </p>
            </div>
            <div className="flex gap-2">
              {saving && <span className="text-xs text-slate-400 flex items-center gap-1"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando...</span>}
              <Button
                variant="accent"
                size="sm"
                onClick={handleNotify}
                disabled={notifying}
                className="flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {notifying ? 'Notificando...' : 'Notificar Cambio'}
              </Button>
            </div>
          </div>

          {/* Ranking info */}
          {order.ranking_author_name && (
            <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Ultimo cambio por <span className="font-semibold text-slate-700">{order.ranking_author_name}</span>
              ({order.ranking_author_role === 'admin' ? 'Equipo Imporlan' : 'Tu'})
              {order.ranking_updated_at && <> el {fmtDate(order.ranking_updated_at)}</>}
            </div>
          )}

          {/* Vessel cards */}
          <div className="space-y-2">
            {activeLinks.map((link, i) => (
              <VesselCard
                key={link.id}
                link={link}
                index={i}
                dragHandlers={{
                  onDragStart: handleDragStart(i),
                  onDragOver: handleDragOver(i),
                  onDrop: handleDrop(i),
                  onDragEnd: handleDragEnd,
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* No links message */}
      {activeLinks.length === 0 && (
        <Card className="mb-5 text-center py-12">
          <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <p className="text-slate-500 font-medium">Tu agente esta buscando opciones</p>
          <p className="text-sm text-slate-400 mt-1">Cuando encuentre embarcaciones, apareceran aqui para que las priorices.</p>
        </Card>
      )}

      {/* Files section */}
      {files.length > 0 && (
        <Card className="mb-5">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Documentos ({files.length})
          </h2>

          {/* Image gallery */}
          {imageFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {imageFiles.map(f => (
                <div
                  key={f.id}
                  className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:shadow-md transition group"
                  onClick={() => setLightbox(f.download_url)}
                >
                  <img src={f.download_url} alt={f.original_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ))}
            </div>
          )}

          {/* Document list */}
          {docFiles.length > 0 && (
            <div className="space-y-2">
              {docFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">DOC</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{f.original_name}</p>
                    <p className="text-xs text-slate-400">{f.file_size_formatted || ''} {f.description ? `· ${f.description}` : ''}</p>
                  </div>
                  <a href={f.download_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-white transition">
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition" onClick={() => setLightbox(null)}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function Expedientes() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await getMyOrders();
      setOrders(data.success && data.orders ? data.orders : []);
    } catch (e) {
      toast?.('Error al cargar expedientes', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Detail view
  if (selectedId) {
    return (
      <OrderDetail
        orderId={selectedId}
        onBack={() => { setSelectedId(null); loadOrders(); }}
      />
    );
  }

  // List view
  return (
    <div>
      <PageHeader
        title="Mis Expedientes"
        subtitle={`${orders.length} expediente${orders.length !== 1 ? 's' : ''}`}
      />

      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
          <p className="text-slate-500 font-medium">No tienes expedientes activos</p>
          <p className="text-sm text-slate-400 mt-1">Cuando contrates un plan o cotizacion, aparecera aqui.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onClick={setSelectedId} />
          ))}
        </div>
      )}
    </div>
  );
}
