import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyOrders, getMyOrderDetail, saveRanking, notifyRanking, getMyFiles, getMyPurchases, getMyReports } from '../api';
import { fmtDate, fmtCLP, statusColor, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { PageHeader, Card, Badge, Button, Spinner, Modal } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import Timeline from '../../shared/components/Timeline';

function relativeTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < 60_000) return 'hace unos segundos';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} hr${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} dia${d > 1 ? 's' : ''}`;
  return fmtDate(ts);
}

function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]).join('').toUpperCase();
}

function avatarColor(seed) {
  const palette = [
    'from-cyan-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-700',
  ];
  let hash = 0;
  for (let i = 0; i < (seed || '').length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

const STATUS_BANNERS = {
  new: {
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
    title: 'Expediente Nuevo',
    message: 'Tu expediente ha sido creado y esta siendo revisado por nuestro equipo. Pronto comenzaremos a trabajar en tu busqueda.',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  pending_admin_fill: {
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
    title: 'Pendiente de Revision',
    message: 'Tu expediente esta pendiente de revision. Nuestro equipo esta preparando tu busqueda personalizada.',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  in_progress: {
    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
    title: 'En Proceso - Monitoreo Continuo',
    message: 'Tu expediente esta en proceso con monitoreo continuo. Nuestro equipo esta buscando activamente las mejores opciones para ti y se iran agregando nuevas alternativas a medida que las encontremos.',
    iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2',
  },
  completed: {
    color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
    title: 'Expediente Completado',
    message: 'Tu expediente ha sido completado exitosamente. Todas las opciones han sido revisadas y entregadas. Si necesitas algo mas, no dudes en contactarnos.',
    iconPath: 'M5 13l4 4L19 7',
  },
  expired: {
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', iconColor: 'text-red-600',
    title: 'Expediente Vencido',
    message: 'Tu expediente ha vencido. Si deseas reactivar tu busqueda, contactanos y con gusto te ayudaremos.',
    iconPath: 'M6 18L18 6M6 6l12 12',
  },
  canceled: {
    color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', iconBg: 'bg-slate-100', iconColor: 'text-slate-500',
    title: 'Expediente Cancelado',
    message: 'Tu expediente ha sido cancelado. Si tienes alguna consulta o deseas iniciar una nueva busqueda, estamos a tu disposicion.',
    iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

function StatusBanner({ status }) {
  const cfg = STATUS_BANNERS[status];
  if (!cfg) return null;
  return (
    <div className={cn('mb-5 rounded-2xl border p-4 flex items-start gap-3', cfg.bg, cfg.border)}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.iconBg)}>
        <svg className={cn('w-5 h-5', cfg.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', cfg.color)}>{cfg.title}</p>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cfg.message}</p>
      </div>
    </div>
  );
}

const INSPECTION_PRICES = [
  { range: 'Hasta 25 ft', price: 'USD 850' },
  { range: '26 a 30 ft', price: 'USD 1.200' },
  { range: '31 ft o mas', price: 'USD 1.800' },
];

const INSPECTION_INCLUDES = [
  'Inspeccion visual de casco, cubierta y estructura',
  'Pruebas de motor (compresion, presion, fugas)',
  'Sistema electrico, baterias e instrumentacion',
  'Equipamiento de seguridad y navegacion',
  'Galeria fotografica completa con fechas y notas',
  'Reporte detallado en PDF entregado en 48-72 hrs',
];

function InspectionModal({ link, orderNumber, open, onClose }) {
  if (!open || !link) return null;
  const title = [link.make, link.model, link.year].filter(Boolean).join(' ') || 'la embarcacion';
  const wapText = encodeURIComponent(
    `Hola, quiero solicitar una inspeccion tecnica para ${title}` +
    (orderNumber ? ` del expediente #${orderNumber}` : '') +
    (link.url ? `.\nLink: ${link.url}` : '') + '\nGracias.'
  );
  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white flex items-center gap-3 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold">Solicitar Inspeccion Tecnica</p>
            <p className="text-xs text-white/80 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Que incluye</p>
            <ul className="space-y-1.5">
              {INSPECTION_INCLUDES.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Costos referenciales (USD)</p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {INSPECTION_PRICES.map((p) => (
                    <tr key={p.range}>
                      <td className="px-3 py-2 text-slate-600">{p.range}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{p.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">El costo final puede variar segun ubicacion del barco y eslora exacta. Te confirmamos por WhatsApp antes de coordinar.</p>
          </div>
          <a
            href={`https://wa.me/56940211459?text=${wapText}`}
            target="_blank"
            rel="noreferrer"
            className="block w-full text-center px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:scale-[1.01] transition"
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Enviar solicitud por WhatsApp
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

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

function VesselCard({ link, index, dragHandlers, isFirst, isLast, onMoveUp, onMoveDown, onRequestInspection, onPreviewImage }) {
  const [imgError, setImgError] = useState(false);
  const [imgRetry, setImgRetry] = useState(0);
  const [copied, setCopied] = useState(false);
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
    if (!link.url) return;
    navigator.clipboard.writeText(link.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  function handleImgError() {
    if (imgRetry < 1) {
      setImgRetry(r => r + 1);
    } else {
      setImgError(true);
    }
  }

  const title = [link.make, link.model, link.year].filter(Boolean).join(' ') || 'Embarcacion';
  const hasOverlayInfo = link.year || link.location || link.hours || link.engine || link.value_usa_usd > 0;

  return (
    <div
      draggable={!!dragHandlers}
      className={cn(
        'flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-slate-200 rounded-xl transition-all group relative',
        isSold && 'opacity-60 grayscale',
        'hover:shadow-md hover:border-slate-300'
      )}
      {...dragHandlers}
    >
      {/* Drag handle (desktop) + up/down (mobile) */}
      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst || !onMoveUp}
          className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent flex items-center justify-center"
          aria-label="Subir"
          title="Subir en ranking"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <span className="hidden sm:flex cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-60" title="Arrastra para reordenar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </span>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast || !onMoveDown}
          className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent flex items-center justify-center"
          aria-label="Bajar"
          title="Bajar en ranking"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {/* Number */}
      <div className={cn('shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm self-start',
        index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
        index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-600' :
        'bg-gradient-to-br from-cyan-500 to-cyan-600'
      )}>
        {index + 1}
      </div>

      {/* Image with hover overlay */}
      <div className="shrink-0 w-20 sm:w-28 h-16 sm:h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 relative cursor-pointer" onClick={() => link.image_url && !imgError && onPreviewImage?.(link.image_url)}>
        {link.image_url && !imgError ? (
          <>
            <img key={imgRetry} src={link.image_url + (imgRetry ? `?r=${imgRetry}` : '')} alt="" className="w-full h-full object-cover" onError={handleImgError} loading="lazy" />
            {hasOverlayInfo && (
              <div className="absolute inset-0 bg-black/70 text-white text-[10px] leading-tight p-1.5 opacity-0 group-hover:opacity-100 transition flex flex-col justify-center items-center text-center">
                {link.year && <span className="font-bold text-cyan-300">{link.year}</span>}
                {link.location && <span className="truncate w-full">{link.location}</span>}
                {link.value_usa_usd > 0 && <span className="text-emerald-300 font-semibold mt-0.5">{fmtUsd(link.value_usa_usd)}</span>}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{title}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
              {link.location && <span className="truncate max-w-[180px]">{link.location}</span>}
              {link.hours && <span>{link.hours} hrs</span>}
              {link.engine && <span className="truncate max-w-[120px]">{link.engine}</span>}
            </div>
          </div>
          {isSold && (
            <Badge className="bg-red-100 text-red-700 shrink-0">
              {link.link_status === 'sold' ? 'Vendido' : 'No disponible'}
            </Badge>
          )}
        </div>

        {/* Prices */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {link.value_usa_usd > 0 && (
            <span className="text-xs font-semibold text-emerald-600">{fmtUsd(link.value_usa_usd)} USA</span>
          )}
          {link.value_to_negotiate_usd > 0 && (
            <span className="text-xs text-emerald-500">Neg: {fmtUsd(link.value_to_negotiate_usd)}</span>
          )}
          {link.value_chile_clp > 0 && (
            <span className="text-xs font-semibold text-blue-600">{fmtClp(link.value_chile_clp)} CLP</span>
          )}
          {link.value_chile_negotiated_clp > 0 && (
            <span className="text-xs text-blue-500">Neg: {fmtClp(link.value_chile_negotiated_clp)}</span>
          )}
        </div>

        {/* Selection order */}
        {link.selection_order && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center" title={`Seleccion #${link.selection_order}`}>{link.selection_order}</span>
        )}

        {/* Actions + Comments */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {link.url && (
            <>
              <button onClick={openUrl} className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-[11px] font-semibold hover:bg-cyan-100 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Abrir
              </button>
              <button
                onClick={copyUrl}
                className={cn(
                  'px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1',
                  copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                )}
                title="Copiar link"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copiar
                  </>
                )}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(link.url)}`} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition flex items-center gap-1" title="Compartir por WhatsApp">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                Compartir
              </a>
            </>
          )}
          {!isSold && onRequestInspection && (
            <button onClick={() => onRequestInspection(link)} className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-semibold hover:bg-violet-100 transition flex items-center gap-1" title="Solicitar inspeccion tecnica">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              Inspeccion
            </button>
          )}
          {link.comments && (
            <span className="text-[11px] text-slate-500 italic truncate max-w-[120px] sm:max-w-[200px] basis-full sm:basis-auto" title={link.comments}>
              "{link.comments}"
            </span>
          )}
        </div>

        <QuoteSummary link={link} />
      </div>
    </div>
  );
}

/**
 * Client-facing summary of the cotización. Shows the analysing badge while
 * inside the 24h delay window (admin marked the link as cotizado but the
 * server is hiding the numbers until the delay expires), or the itemized
 * summary once published. Backend (cotizadorApplyClientVisibility) is the
 * source of truth — this component is purely presentational.
 */
function QuoteSummary({ link }) {
  if (!link) return null;
  function fmtClp(v) {
    if (!v || isNaN(v)) return '$ 0';
    return '$ ' + Math.round(v).toLocaleString('es-CL');
  }
  function fmtUsd(v) {
    if (!v || isNaN(v)) return '';
    return 'USD ' + Math.round(v).toLocaleString('en-US');
  }

  if (link.quote_pending) {
    return (
      <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="text-[11px] font-semibold text-amber-700">Cotización en análisis</span>
        <span className="text-[10px] text-amber-600/80">Listo en aprox. 24 hrs</span>
      </div>
    );
  }

  if (!link.quote_total_clp) return null;

  let qd = link.quote_data;
  if (typeof qd === 'string') { try { qd = JSON.parse(qd); } catch { qd = null; } }
  let pay = link.quote_payments;
  if (typeof pay === 'string') { try { pay = JSON.parse(pay); } catch { pay = null; } }

  const lanchaUsd = qd?.valor_lancha_usd;
  const rate = qd?.usd_clp_rate || 1;
  const lanchaClp = lanchaUsd ? lanchaUsd * rate : null;
  const ivaPct = qd?.iva_pct;
  const lujoAplica = qd?.lujo_aplica;
  const lujoPct = qd?.lujo_pct;
  // Client-side derived: All-Inclusive shown to client = Total - Lancha - IVA - Lujo
  const totalClp = parseFloat(link.quote_total_clp);
  const ivaClp = lanchaClp && qd?.transporte_roro_usd != null
    ? (lanchaClp + parseFloat(qd.transporte_roro_usd) * rate) * (parseFloat(ivaPct) / 100)
    : 0;
  const lujoClp = lujoAplica && lanchaClp ? lanchaClp * (parseFloat(lujoPct) / 100) : 0;
  const allInclusive = totalClp - (lanchaClp || 0) - ivaClp - lujoClp;

  return (
    <div className="mt-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Cotización</div>
      <div className="space-y-1 text-xs">
        {lanchaClp != null && (
          <Row label="Valor lancha" value={fmtClp(lanchaClp)} sub={fmtUsd(lanchaUsd)} />
        )}
        <Row label="Servicio All-Inclusive" value={fmtClp(allInclusive)} />
        <Row label="IVA Aduanero" value={fmtClp(ivaClp)} />
        {lujoAplica ? (
          <Row label="Impuesto al Lujo" value={fmtClp(lujoClp)} />
        ) : (
          <Row label="Impuesto al Lujo" value="N/A" muted />
        )}
        <hr className="border-white/10 my-1" />
        <Row label="TOTAL" value={fmtClp(totalClp)} sub={fmtUsd(link.quote_total_usd)} bold />
      </div>
      {pay && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map(n => pay[`p${n}_clp`] != null && (
            <div key={n} className="px-2 py-1.5 bg-white/5 rounded-md text-center">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Pago {n} ({pay[`p${n}_pct`]}%)</div>
              <div className="text-[11px] text-slate-100 font-semibold">{fmtClp(pay[`p${n}_clp`])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function Row({ label, value, sub, bold, muted }) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <div className={'text-slate-300 ' + (bold ? 'font-bold text-white' : '')}>{label}</div>
        <div className="text-right">
          <div className={(bold ? 'text-base font-bold text-white' : (muted ? 'text-slate-500' : 'text-slate-100 font-semibold'))}>{value}</div>
          {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
        </div>
      </div>
    );
  }
}

// --- Detail View ---

function OrderDetail({ orderId, onBack }) {
  const toast = useToast();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { url, list, index } or string
  const [search, setSearch] = useState('');
  const [filterPhoto, setFilterPhoto] = useState(false);
  const [filterPriced, setFilterPriced] = useState(false);
  const [hideSold, setHideSold] = useState(false);
  const [sortBy, setSortBy] = useState('rank');
  const [viewMode, setViewMode] = useState('cards');
  const [inspectionLink, setInspectionLink] = useState(null);
  const [loadError, setLoadError] = useState('');
  const dragSrc = useRef(null);
  const pollRef = useRef(null);
  const lastRankingTs = useRef(null);

  const loadDetail = useCallback(async () => {
    setLoadError('');
    try {
      const data = await getMyOrderDetail(orderId);
      const ord = data?.order || data?.data || null;
      if (ord) {
        setOrder(ord);
        setLinks(ord.links || []);
        lastRankingTs.current = ord.ranking_updated_at || null;
      } else if (data?.error) {
        setLoadError(String(data.error));
      } else {
        setLoadError('No se pudo cargar el expediente');
      }
    } catch (e) {
      console.error('[OrderDetail] loadDetail failed:', e);
      setLoadError(e?.message || 'Error al cargar expediente');
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

  const loadReports = useCallback(async () => {
    try {
      const data = await getMyReports();
      const all = data?.reports || [];
      const matchById = (r) => String(r.order_id || r.expediente_id || '') === String(orderId);
      const matchByNumber = (r) => order?.order_number && (r.order_number === order.order_number || r.expediente_number === order.order_number);
      const filtered = all.filter(r => matchById(r) || matchByNumber(r));
      setReports(filtered.length > 0 ? filtered : []);
    } catch { /* silent */ }
  }, [orderId, order?.order_number]);

  useEffect(() => {
    loadDetail();
    loadFiles();
  }, [loadDetail, loadFiles]);

  useEffect(() => {
    if (order) loadReports();
  }, [order, loadReports]);

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

  function handleMoveUp(realIdx) {
    if (realIdx <= 0) return;
    const next = [...links];
    [next[realIdx - 1], next[realIdx]] = [next[realIdx], next[realIdx - 1]];
    setLinks(next);
    doSaveRanking(next);
  }

  function handleMoveDown(realIdx) {
    if (realIdx >= links.length - 1) return;
    const next = [...links];
    [next[realIdx], next[realIdx + 1]] = [next[realIdx + 1], next[realIdx]];
    setLinks(next);
    doSaveRanking(next);
  }

  function handleRequestInspection(link) {
    setInspectionLink(link);
  }

  function handlePrint() {
    if (typeof window !== 'undefined') window.print();
  }

  function openLightboxAt(url) {
    const list = files.filter(f => (f.category || '') === 'image' || (f.mime_type || '').startsWith('image/')).map(f => f.download_url);
    const idx = list.indexOf(url);
    setLightbox(idx >= 0 ? { list, index: idx } : { list: [url], index: 0 });
  }

  function lightboxNav(dir) {
    setLightbox(lb => {
      if (!lb || !lb.list || lb.list.length === 0) return lb;
      const next = (lb.index + dir + lb.list.length) % lb.list.length;
      return { ...lb, index: next };
    });
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e) {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') lightboxNav(1);
      else if (e.key === 'ArrowLeft') lightboxNav(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
      <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
    </div>
  );
  if (!order) return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
      <Card className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <p className="text-slate-700 font-semibold">No pudimos cargar este expediente</p>
        {loadError && <p className="text-xs text-red-500 mt-1">{loadError}</p>}
        <p className="text-xs text-slate-400 mt-3">Cuenta: <span className="font-mono text-slate-600">{user?.email || '-'}</span></p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setLoading(true); loadDetail(); }}>Reintentar</Button>
      </Card>
    </div>
  );

  const title = [order.make, order.model, order.year].filter(Boolean).join(' ') || order.asset_name || `Expediente #${order.order_number}`;
  const activeLinks = links.filter(l => l.url);
  const imageFiles = files.filter(f => (f.category || '') === 'image' || (f.mime_type || '').startsWith('image/'));
  const videoFiles = files.filter(f => (f.category || '') === 'video' || (f.mime_type || '').startsWith('video/'));
  const docFiles = files.filter(f => !['image', 'video'].includes(f.category) && !(f.mime_type || '').startsWith('image/') && !(f.mime_type || '').startsWith('video/'));
  const fileNote = files.find(f => f.description)?.description;

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
        Volver a expedientes
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 mb-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">#{order.order_number}</h1>
            <p className="text-sm text-slate-300 mt-0.5">{title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn(statusColor(order.status), 'text-xs')}>{(order.status || '').replace(/_/g, ' ')}</Badge>
            <button
              onClick={handlePrint}
              className="print:hidden px-3 py-1.5 rounded-lg bg-white/10 text-slate-100 text-xs font-medium hover:bg-white/20 transition flex items-center gap-1"
              title="Imprimir o guardar como PDF"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
              Imprimir
            </button>
            <a href={`https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20expediente%20%23${order.order_number}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Soporte
            </a>
          </div>
        </div>
        {/* Stats bar */}
        {activeLinks.length > 0 && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/10 text-xs">
            <span className="text-slate-400">{activeLinks.length} embarcacion{activeLinks.length !== 1 ? 'es' : ''}</span>
            <span className="text-slate-400">{activeLinks.filter(l => l.image_url).length} con foto</span>
            <span className="text-slate-400">{activeLinks.filter(l => l.value_usa_usd > 0 || l.value_chile_clp > 0).length} con precio</span>
          </div>
        )}
      </div>

      {/* Status Banner */}
      <StatusBanner status={order.status} />

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
            <div className="col-span-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Agente asignado</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={cn('w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm bg-gradient-to-br', avatarColor(order.agent_name))}>
                  {avatarInitials(order.agent_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-slate-700 font-semibold text-sm truncate">{order.agent_name}</p>
                  {order.agent_phone && (
                    <a href={`https://wa.me/${order.agent_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                      {order.agent_phone}
                    </a>
                  )}
                </div>
              </div>
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
            <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>
                Ultimo cambio por <span className="font-semibold text-slate-700">{order.ranking_author_name}</span> ({order.ranking_author_role === 'admin' ? 'Equipo Imporlan' : 'Tu'})
              </span>
              {order.ranking_updated_at && <span className="text-slate-400">- {relativeTime(order.ranking_updated_at)}</span>}
            </div>
          )}

          {/* Toolbar: search + filters + sort + view */}
          <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
            <div className="relative flex-1 min-w-[180px]">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar marca, modelo, ubicacion..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none bg-white"
              title="Ordenar"
            >
              <option value="rank">Mi Ranking</option>
              <option value="price_asc">Precio menor</option>
              <option value="price_desc">Precio mayor</option>
              <option value="year_desc">Mas nuevas</option>
              <option value="year_asc">Mas antiguas</option>
            </select>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              <button
                onClick={() => setViewMode('cards')}
                className={cn('px-2.5 py-1.5 rounded-md transition flex items-center gap-1', viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-500')}
                title="Tarjetas"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn('px-2.5 py-1.5 rounded-md transition flex items-center gap-1', viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500')}
                title="Tabla"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5 print:hidden">
            <button onClick={() => setFilterPhoto(v => !v)} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition', filterPhoto ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>Con foto</button>
            <button onClick={() => setFilterPriced(v => !v)} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition', filterPriced ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>Con precio</button>
            <button onClick={() => setHideSold(v => !v)} className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition', hideSold ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>Solo disponibles</button>
            {(search || filterPhoto || filterPriced || hideSold || sortBy !== 'rank') && (
              <button onClick={() => { setSearch(''); setFilterPhoto(false); setFilterPriced(false); setHideSold(false); setSortBy('rank'); }} className="px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-400 hover:text-slate-700">
                Limpiar filtros
              </button>
            )}
          </div>

          {(() => {
            const term = search.trim().toLowerCase();
            let displayed = activeLinks.filter(l => {
              if (filterPhoto && !l.image_url) return false;
              if (filterPriced && !(l.value_usa_usd > 0 || l.value_chile_clp > 0)) return false;
              if (hideSold && (l.link_status === 'sold' || l.link_status === 'unavailable')) return false;
              if (term) {
                const hay = [l.make, l.model, l.year, l.location, l.engine, l.comments].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(term)) return false;
              }
              return true;
            });
            if (sortBy === 'price_asc') displayed = [...displayed].sort((a, b) => (a.value_usa_usd || a.value_chile_clp || Infinity) - (b.value_usa_usd || b.value_chile_clp || Infinity));
            else if (sortBy === 'price_desc') displayed = [...displayed].sort((a, b) => (b.value_usa_usd || b.value_chile_clp || 0) - (a.value_usa_usd || a.value_chile_clp || 0));
            else if (sortBy === 'year_desc') displayed = [...displayed].sort((a, b) => (b.year || 0) - (a.year || 0));
            else if (sortBy === 'year_asc') displayed = [...displayed].sort((a, b) => (a.year || Infinity) - (b.year || Infinity));

            if (displayed.length === 0) {
              return (
                <div className="text-center py-10 text-sm text-slate-400">
                  Ninguna embarcacion coincide con los filtros.
                </div>
              );
            }

            const isRankView = sortBy === 'rank' && viewMode === 'cards';

            if (viewMode === 'table') {
              return (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold w-10">#</th>
                        <th className="text-left px-3 py-2 font-semibold">Embarcacion</th>
                        <th className="text-left px-3 py-2 font-semibold">Ubicacion</th>
                        <th className="text-right px-3 py-2 font-semibold">USD</th>
                        <th className="text-right px-3 py-2 font-semibold">CLP</th>
                        <th className="text-right px-3 py-2 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayed.map((l, i) => {
                        const realIdx = activeLinks.findIndex(x => x.id === l.id);
                        const isSold = l.link_status === 'sold' || l.link_status === 'unavailable';
                        const ttl = [l.make, l.model, l.year].filter(Boolean).join(' ') || 'Embarcacion';
                        return (
                          <tr key={l.id} className={cn('hover:bg-slate-50', isSold && 'opacity-60')}>
                            <td className="px-3 py-2 font-bold text-slate-700">{realIdx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-800 truncate max-w-[260px]">{ttl}</div>
                              {l.engine && <div className="text-[11px] text-slate-400 truncate">{l.engine}</div>}
                            </td>
                            <td className="px-3 py-2 text-slate-500">{l.location || '-'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{l.value_usa_usd > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(l.value_usa_usd) : '-'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{l.value_chile_clp > 0 ? fmtCLP(l.value_chile_clp) : '-'}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {l.url && (
                                  <a href={l.url.startsWith('http') ? l.url : 'https://' + l.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-cyan-600 hover:bg-cyan-50" title="Abrir">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  </a>
                                )}
                                {!isSold && (
                                  <button onClick={() => setInspectionLink(l)} className="p-1.5 rounded-md text-violet-600 hover:bg-violet-50" title="Inspeccion">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {displayed.map((link) => {
                  const realIdx = activeLinks.findIndex(x => x.id === link.id);
                  return (
                    <VesselCard
                      key={link.id}
                      link={link}
                      index={realIdx}
                      dragHandlers={isRankView ? {
                        onDragStart: handleDragStart(realIdx),
                        onDragOver: handleDragOver(realIdx),
                        onDrop: handleDrop(realIdx),
                        onDragEnd: handleDragEnd,
                      } : undefined}
                      isFirst={realIdx === 0}
                      isLast={realIdx === activeLinks.length - 1}
                      onMoveUp={isRankView ? () => handleMoveUp(realIdx) : undefined}
                      onMoveDown={isRankView ? () => handleMoveDown(realIdx) : undefined}
                      onRequestInspection={handleRequestInspection}
                      onPreviewImage={(url) => setLightbox({ list: [url], index: 0 })}
                    />
                  );
                })}
              </div>
            );
          })()}
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

      {/* Reports section */}
      {reports.length > 0 && (
        <Card className="mb-5">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Mis Reportes ({reports.length})
          </h2>
          <div className="space-y-2">
            {reports.map(r => {
              const planLabel = r.plan_type || r.plan_name || 'Reporte';
              const version = r.version ? `v${r.version}` : null;
              const viewUrl = r.view_url || (r.id && r.access_token ? `/api/reports_api.php?action=view_report&report_id=${r.id}&token=${encodeURIComponent(r.access_token)}` : null);
              const pdfUrl = r.pdf_url || (r.id && r.access_token ? `/api/reports_api.php?action=download_pdf&report_id=${r.id}&token=${encodeURIComponent(r.access_token)}` : null);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{planLabel.toUpperCase()}{version ? ` ${version}` : ''}</p>
                    <p className="text-[11px] text-slate-400">{r.created_at ? fmtDate(r.created_at) : ''}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {viewUrl && (
                      <a href={viewUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-semibold hover:bg-violet-200 transition flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Ver
                      </a>
                    )}
                    {pdfUrl && (
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Files section */}
      {files.length > 0 && (
        <Card className="mb-5">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Documentos ({files.length})
          </h2>

          {/* Team note */}
          {fileNote && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex gap-2 text-xs text-emerald-700">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>{fileNote}</span>
            </div>
          )}

          {/* Image gallery */}
          {imageFiles.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Imagenes ({imageFiles.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {imageFiles.map(f => (
                  <div key={f.id} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:shadow-md transition group relative" onClick={() => openLightboxAt(f.download_url)}>
                    <img src={f.download_url} alt={f.original_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                      <p className="text-[10px] text-white truncate">{f.original_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {videoFiles.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Videos ({videoFiles.length})</p>
              <div className="space-y-2">
                {videoFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-bold">VID</span></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.original_name}</p>
                      <p className="text-xs text-slate-400">{f.file_size_formatted || ''}</p>
                    </div>
                    <a href={f.download_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-100 transition">Ver</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document list */}
          {docFiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Documentos ({docFiles.length})</p>
              <div className="space-y-2">
                {docFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-bold">DOC</span></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.original_name}</p>
                      <p className="text-xs text-slate-400">{f.file_size_formatted || ''} {f.description ? `· ${f.description}` : ''}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <a href={f.download_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-white transition">Ver</a>
                      <a href={f.download_url} download className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-[11px] font-medium hover:bg-blue-100 transition">Descargar</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Lightbox */}
      {lightbox && lightbox.list && lightbox.list.length > 0 && (
        <div className="fixed inset-0 z-[10001] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.list[lightbox.index]} alt="" className="max-w-full max-h-[88vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          {lightbox.list.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
                onClick={(e) => { e.stopPropagation(); lightboxNav(-1); }}
                aria-label="Anterior"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
                onClick={(e) => { e.stopPropagation(); lightboxNav(1); }}
                aria-label="Siguiente"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                {lightbox.index + 1} / {lightbox.list.length}
              </div>
            </>
          )}
        </div>
      )}

      <InspectionModal link={inspectionLink} orderNumber={order.order_number} open={!!inspectionLink} onClose={() => setInspectionLink(null)} />
    </div>
  );
}

// --- Main Page ---

export default function Expedientes() {
  const toast = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('expedientes');
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    setLoadError('');
    try {
      const [ordersRes, purchasesRes] = await Promise.allSettled([
        getMyOrders(),
        getMyPurchases(),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const r = ordersRes.value || {};
        const list = r.orders || r.data || (Array.isArray(r) ? r : []);
        setOrders(Array.isArray(list) ? list : []);
        if (r.error) setLoadError(String(r.error));
      } else {
        const msg = ordersRes.reason?.message || 'Error al cargar expedientes';
        console.error('[Expedientes] getMyOrders failed:', ordersRes.reason);
        setLoadError(msg);
        setOrders([]);
      }

      if (purchasesRes.status === 'fulfilled') {
        const r = purchasesRes.value || {};
        setPlans(r.plans || r.data?.plans || []);
      } else {
        console.error('[Expedientes] getMyPurchases failed:', purchasesRes.reason);
        setPlans([]);
      }
    } catch (e) {
      console.error('[Expedientes] loadData unexpected:', e);
      toast?.('Error al cargar expedientes', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  if (selectedId) {
    return <OrderDetail orderId={selectedId} onBack={() => { setSelectedId(null); loadData(); }} />;
  }

  return (
    <div>
      <PageHeader title="Mis Productos Contratados" subtitle="Expedientes y planes de busqueda" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('expedientes')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', tab === 'expedientes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Expedientes {orders.length > 0 && <span className="ml-1.5 text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full">{orders.length}</span>}
        </button>
        <button onClick={() => setTab('planes')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition', tab === 'planes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Planes {plans.length > 0 && <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{plans.length}</span>}
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'expedientes' ? (
        orders.length === 0 ? (
          <Card className="text-center py-12">
            {loadError ? (
              <>
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <p className="text-slate-700 font-semibold">No pudimos cargar tus expedientes</p>
                <p className="text-xs text-red-500 mt-1">{loadError}</p>
                <p className="text-xs text-slate-400 mt-3">Cuenta consultada: <span className="font-mono text-slate-600">{user?.email || '-'}</span></p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setLoading(true); loadData(); }}>Reintentar</Button>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                <p className="text-slate-700 font-semibold">Aun no hay expedientes para esta cuenta</p>
                <p className="text-sm text-slate-500 mt-1">Cuando contrates un plan o cotizacion aparecera aqui.</p>
                <p className="text-[11px] text-slate-400 mt-3">Cuenta: <span className="font-mono text-slate-500">{user?.email || '-'}</span></p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={() => { setLoading(true); loadData(); }}>Recargar</Button>
                  <a href="https://wa.me/56940211459?text=Hola%2C%20no%20veo%20mis%20expedientes%20en%20el%20panel" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    Hablar con soporte
                  </a>
                </div>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(order => <OrderCard key={order.id} order={order} onClick={setSelectedId} />)}
          </div>
        )
      ) : (
        plans.length === 0 ? (
          <Card className="text-center py-16">
            <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <p className="text-slate-500 font-medium">No tienes planes contratados</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p, i) => (
              <Card key={i} className={cn('relative overflow-hidden', p.status === 'active' && 'border-cyan-200')}>
                {p.status === 'active' && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-500" />}
                <div className="flex items-start justify-between mb-3">
                  <p className="font-bold text-slate-800">{p.planName || p.plan_name || 'Plan'}</p>
                  <Badge className={p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{p.status === 'active' ? 'Activo' : p.status}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-slate-500">
                  {p.startDate && <div className="flex justify-between"><span>Inicio</span><span className="text-slate-700">{fmtDate(p.startDate)}</span></div>}
                  {p.endDate && <div className="flex justify-between"><span>Vence</span><span className="text-slate-700">{fmtDate(p.endDate)}</span></div>}
                  {p.days && <div className="flex justify-between"><span>Duracion</span><span className="text-slate-700">{p.days} dias</span></div>}
                  {p.price && <div className="flex justify-between"><span>Precio</span><span className="font-bold text-slate-800">{fmtCLP(p.price)}</span></div>}
                  {p.payment_method && <div className="flex justify-between"><span>Metodo</span><span className="text-slate-700 capitalize">{p.payment_method}</span></div>}
                </div>
                {p.proposalsTotal > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Propuestas</span><span>{p.proposalsReceived || 0}/{p.proposalsTotal}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(((p.proposalsReceived || 0) / p.proposalsTotal) * 100, 100)}%` }} /></div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
