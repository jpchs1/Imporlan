import { FileText, File, CreditCard, MessageCircle, ListChecks, ClipboardCheck, Bell } from '../../../shared/components/Icons';

/**
 * Tipos de notificación que escribe el servidor en la tabla `notifications`:
 *   payment · message / chat (api/chat_api.php) · document · report
 *   (api/reports_api.php) · ranking · inspection (api/inspection_reports_api.php)
 *   · expediente_files (api/expediente_files_api.php: archivos que el agente
 *   sube a un expediente).
 */
export const TIPOS_NOTIFICACION = {
  payment: { label: 'Pago', icon: CreditCard, filtro: 'payment' },
  message: { label: 'Mensaje', icon: MessageCircle, filtro: 'message' },
  chat: { label: 'Mensaje', icon: MessageCircle, filtro: 'message' },
  document: { label: 'Documento', icon: File, filtro: 'document' },
  expediente_files: { label: 'Documento', icon: File, filtro: 'document' },
  report: { label: 'Reporte', icon: FileText, filtro: 'report' },
  ranking: { label: 'Ranking', icon: ListChecks, filtro: 'ranking' },
  inspection: { label: 'Inspección', icon: ClipboardCheck, filtro: 'inspection' },
};

export function tipoNotificacion(type) {
  return TIPOS_NOTIFICACION[type] || { label: 'Aviso', icon: Bell, filtro: 'otro' };
}

/** Familia a la que pertenece un tipo (chat → message, expediente_files → document). */
export function familiaDe(type) {
  return tipoNotificacion(type).filtro;
}

/** Una notificación cuenta como «documento nuevo» en Inicio. */
export function esDocumento(n) {
  return familiaDe(n.type) === 'document' || familiaDe(n.type) === 'report';
}

/**
 * Rutas del panel viejo (`/panel/#myproducts`, sin barra) que todavía manda
 * el servidor en algunos enlaces; se traducen a la ruta actual.
 */
const RUTAS_VIEJAS = {
  myproducts: '/expedientes',
  expedientes: '/expedientes',
  documents: '/documents',
  documentos: '/documents',
  payments: '/payments',
  pagos: '/payments',
  messages: '/messages',
  mensajes: '/messages',
  inspections: '/inspections',
  alerts: '/alerts',
};

/**
 * Ruta interna a la que lleva una notificación, o null si su enlace es
 * externo. Los archivos de expediente (`expediente_files`) van siempre a
 * Documentos, que es donde el cliente los ve, aunque el servidor enlace al
 * panel viejo.
 */
export function rutaDe(n) {
  if (n?.type === 'expediente_files') return '/documents';
  const link = n?.link || '';
  if (!link) return null;
  const hash = link.indexOf('#');
  if (hash < 0) return null;
  const base = link.slice(0, hash).replace(/^https?:\/\/[^/]+/, '');
  const mismoPanel = base === '' || base === window.location.pathname;
  if (!mismoPanel) return null;
  const resto = link.slice(hash + 1);
  if (resto.startsWith('/')) return resto;
  return RUTAS_VIEJAS[resto.replace(/^\/+/, '').split(/[?/]/)[0]] || null;
}

/**
 * Abre el enlace de una notificación: si apunta a este mismo panel
 * (…/panel/#/ruta) navega adentro; si no, abre otra pestaña. Misma regla que
 * la campana (`NotificationBell`).
 */
export function irAlEnlace(link, navigate) {
  if (!link) return;
  const hash = link.indexOf('#/');
  const mismoPanel = hash >= 0 && link.slice(0, hash).replace(/^https?:\/\/[^/]+/, '') === window.location.pathname;
  if (mismoPanel) navigate(link.slice(hash + 1));
  else window.open(link, '_blank', 'noopener');
}

/** Abre una notificación completa (tipo + enlace), con las reglas de `rutaDe`. */
export function abrirNotificacion(n, navigate) {
  const ruta = rutaDe(n);
  if (ruta) { navigate(ruta); return; }
  irAlEnlace(n?.link, navigate);
}
