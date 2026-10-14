/**
 * Estados → { label, tone }. Único lugar donde una clave de la base se vuelve
 * texto para una persona. Nunca se muestra una clave cruda en pantalla.
 *
 *   statusMeta('pago', 'pending')  → { label: 'Pendiente', tone: 'warning', key: 'pending' }
 *   statusMeta('barco', 'active')  → { label: 'En tránsito', tone: 'info', key: 'active' }
 *
 * Tonos posibles: success · warning · danger · info · neutral · brand.
 */

const T = (label, tone) => ({ label, tone });

export const STATUS = {
  expediente: {
    new: T('Nuevo', 'info'),
    pending: T('Pendiente', 'warning'),
    pending_admin_fill: T('En revisión', 'warning'),
    in_progress: T('En proceso', 'info'),
    active: T('Activo', 'success'),
    completed: T('Completado', 'success'),
    expired: T('Vencido', 'neutral'),
    canceled: T('Cancelado', 'danger'),
    cancelled: T('Cancelado', 'danger'),
    suspended: T('Suspendido', 'danger'),
    paid: T('Pagado', 'success'),
  },
  pago: {
    pending: T('Pendiente', 'warning'),
    paid: T('Pagado', 'success'),
    approved: T('Pagado', 'success'),
    completed: T('Pagado', 'success'),
    canceled: T('Cancelado', 'danger'),
    cancelled: T('Cancelado', 'danger'),
    rejected: T('Rechazado', 'danger'),
    failed: T('Rechazado', 'danger'),
    expired: T('Vencido', 'neutral'),
    refunded: T('Reembolsado', 'neutral'),
    in_process: T('En proceso', 'info'),
  },
  compra: {
    pending: T('Pendiente', 'warning'),
    paid: T('Pagada', 'success'),
    active: T('Activa', 'success'),
    completed: T('Completada', 'success'),
    expired: T('Vencida', 'neutral'),
    canceled: T('Cancelada', 'danger'),
    cancelled: T('Cancelada', 'danger'),
    suspended: T('Suspendida', 'danger'),
    refunded: T('Reembolsada', 'neutral'),
  },
  barco: {
    active: T('En tránsito', 'info'),
    in_transit: T('En tránsito', 'info'),
    sailing: T('En tránsito', 'info'),
    arrived: T('Arribado', 'success'),
    delivered: T('Entregado', 'success'),
    scheduled: T('Programado', 'neutral'),
    pending: T('Programado', 'neutral'),
    delayed: T('Atrasado', 'warning'),
    inactive: T('Inactivo', 'neutral'),
  },
  publicacion: {
    active: T('Activa', 'success'),
    venta: T('En venta', 'info'),
    sale: T('En venta', 'info'),
    arriendo: T('En arriendo', 'info'),
    rent: T('En arriendo', 'info'),
    pending: T('En revisión', 'warning'),
    paused: T('Pausada', 'neutral'),
    sold: T('Vendida', 'neutral'),
    vendida: T('Vendida', 'neutral'),
    rented: T('Arrendada', 'neutral'),
    expired: T('Vencida', 'neutral'),
    deleted: T('Eliminada', 'danger'),
    rejected: T('Rechazada', 'danger'),
  },
  conversacion: {
    open: T('Abierta', 'success'),
    active: T('Abierta', 'success'),
    pending: T('Sin asignar', 'warning'),
    unassigned: T('Sin asignar', 'warning'),
    assigned: T('Asignada', 'info'),
    closed: T('Cerrada', 'neutral'),
    archived: T('Archivada', 'neutral'),
  },
  evento: {
    info: T('Información', 'info'),
    low: T('Baja', 'neutral'),
    medium: T('Media', 'warning'),
    warning: T('Advertencia', 'warning'),
    high: T('Alta', 'danger'),
    critical: T('Crítico', 'danger'),
    error: T('Error', 'danger'),
    success: T('Correcto', 'success'),
  },
  plan: {
    active: T('Activo', 'success'),
    pending: T('Pendiente', 'warning'),
    paid: T('Pagado', 'success'),
    expired: T('Vencido', 'neutral'),
    canceled: T('Cancelado', 'danger'),
    cancelled: T('Cancelado', 'danger'),
  },
  inspeccion: {
    scheduled: T('Programada', 'neutral'),
    pending: T('Pendiente', 'warning'),
    in_progress: T('En curso', 'info'),
    completed: T('Completada', 'success'),
    canceled: T('Cancelada', 'danger'),
    cancelled: T('Cancelada', 'danger'),
  },
  cola: {
    queued: T('En cola', 'warning'),
    processing: T('Leyendo', 'info'),
    done: T('Ficha completa', 'success'),
    error: T('Error', 'danger'),
  },
};

const ORDEN_BUSQUEDA = ['expediente', 'pago', 'compra', 'barco', 'publicacion', 'conversacion', 'evento', 'plan', 'inspeccion', 'cola'];

function normalizar(status) {
  return (status === null || status === undefined) ? '' : String(status).trim().toLowerCase();
}

/** Clave desconocida → texto legible ("pending_review" → "Pending review"). */
function humanizar(key) {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

/**
 * Metadatos de un estado. `kind` es una de las claves de STATUS; con 'auto'
 * (o un kind desconocido) se busca en todas, en orden.
 */
export function statusMeta(kind, status) {
  const key = normalizar(status);
  if (!key) return { label: '—', tone: 'neutral', key };
  const kinds = kind && STATUS[kind] ? [kind] : ORDEN_BUSQUEDA;
  for (const k of kinds) {
    const hit = STATUS[k][key];
    if (hit) return { ...hit, key };
  }
  return { label: humanizar(key), tone: 'neutral', key };
}

/** Solo la etiqueta. */
export function statusLabelFor(kind, status) {
  return statusMeta(kind, status).label;
}

/** Solo el tono (para badges o colores). */
export function statusTone(kind, status) {
  return statusMeta(kind, status).tone;
}

/** Clases por tono (bg / texto / borde), en tokens. */
export const TONE_CLASSES = {
  success: 'bg-success-bg text-success border-success-line',
  warning: 'bg-warning-bg text-warning border-warning-line',
  danger: 'bg-danger-bg text-danger border-danger-line',
  info: 'bg-info-bg text-info border-info-line',
  neutral: 'bg-neutral-bg text-neutral border-neutral-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
};

/** Color de punto por tono (para badges con punto, stepper, etc.). */
export const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-ink-400',
  brand: 'bg-brand-600',
};

/** Etiquetas de las 5 etapas del expediente (ProcessStepper). */
export const ETAPAS_EXPEDIENTE = [
  { num: 1, label: 'Plan o cotización', description: 'Definimos qué buscas y cómo lo vamos a traer.' },
  { num: 2, label: 'Búsqueda', description: 'Buscamos y comparamos embarcaciones en Estados Unidos.' },
  { num: 3, label: 'Inspección', description: 'Un inspector revisa la embarcación elegida y te manda el reporte.' },
  { num: 4, label: 'Compra', description: 'Negociamos y cerramos la compra a tu nombre.' },
  { num: 5, label: 'Logística', description: 'Transporte, aduana y entrega en Chile.' },
];
