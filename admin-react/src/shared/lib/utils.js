export function fmtCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount || 0);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusColor(status) {
  const map = {
    active: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    pending_admin_fill: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
    canceled: 'bg-red-100 text-red-800',
    critical: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

/**
 * Nombre del estado en castellano. Sin esto la insignia mostraba la clave cruda
 * de la base ("in_progress" con los guiones cambiados por espacios), que es
 * jerga interna en ingles justo en la parte mas visible del expediente.
 */
export function statusLabel(status) {
  const map = {
    new: 'Nuevo',
    active: 'Activo',
    paid: 'Pagado',
    completed: 'Completado',
    in_progress: 'En proceso',
    pending: 'Pendiente',
    pending_admin_fill: 'En revisión',
    suspended: 'Suspendido',
    expired: 'Vencido',
    canceled: 'Cancelado',
  };
  return map[status] || (status || '').replace(/_/g, ' ');
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
