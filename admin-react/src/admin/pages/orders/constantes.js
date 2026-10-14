/** Opciones compartidas por la lista, el formulario y el modal de estado. */

export const STATUS_OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'pending_admin_fill', label: 'En revisión' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'expired', label: 'Vencido' },
  { value: 'canceled', label: 'Cancelado' },
];

export const SERVICE_TYPES = [
  { value: 'plan_busqueda', label: 'Plan de búsqueda' },
  { value: 'cotizacion_link', label: 'Cotización por link' },
];

export const ORIGENES = [
  { value: 'web', label: 'Web' },
  { value: 'admin', label: 'Admin' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export const FILTROS_VACIOS = { status: '', service_type: '', agent: '', from_date: '', to_date: '', search: '' };

export const AGENTE_POR_DEFECTO = 'Rodrigo Calderon';

export function serviceTypeLabel(v) {
  return SERVICE_TYPES.find(s => s.value === v)?.label || v || '—';
}
