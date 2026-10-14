import { statusMeta } from '../../../shared/lib/status';

/** Estados a los que el equipo puede mover una compra (misma lista de antes). */
export const ESTADOS_COMPRA = ['pending', 'paid', 'active', 'expired', 'canceled'].map(value => ({
  value,
  label: statusMeta('compra', value).label,
}));

export const PLAN_AUTO_CLOSE_DAYS = 60;

/** Fecha en que el cierre automático vencerá un plan pagado/activo. */
export function autoCloseDate(p) {
  if (p.type !== 'plan' || !['paid', 'active'].includes(p.status)) return null;
  const base = p.reactivated_at || p.created_at;
  const t = new Date(String(base || '').replace(' ', 'T')).getTime();
  if (isNaN(t)) return null;
  return new Date(t + PLAN_AUTO_CLOSE_DAYS * 86400000);
}

/** Texto para buscar en una compra (correo, nombre, descripción, IDs). */
export function textoBusqueda(c) {
  return `${c.user_email || ''} ${c.description || ''} ${c.plan_name || ''} ${c.purchase_id || ''} ${c.payment_id || ''} ${c.payer_name || ''}`.toLowerCase();
}
