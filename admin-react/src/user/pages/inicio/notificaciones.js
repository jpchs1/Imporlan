import { FileText, File, CreditCard, MessageCircle, ListChecks, ClipboardCheck, Bell } from '../../../shared/components/Icons';

/** Tipos de notificación que manda `notifications_api.php`. */
export const TIPOS_NOTIFICACION = {
  payment: { label: 'Pago', icon: CreditCard },
  message: { label: 'Mensaje', icon: MessageCircle },
  chat: { label: 'Mensaje', icon: MessageCircle },
  document: { label: 'Documento', icon: File },
  report: { label: 'Reporte', icon: FileText },
  ranking: { label: 'Ranking', icon: ListChecks },
  inspection: { label: 'Inspección', icon: ClipboardCheck },
};

export function tipoNotificacion(type) {
  return TIPOS_NOTIFICACION[type] || { label: 'Aviso', icon: Bell };
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
