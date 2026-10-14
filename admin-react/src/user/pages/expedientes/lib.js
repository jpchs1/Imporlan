/**
 * Helpers compartidos por las pantallas de Expedientes. Sin JSX a propósito:
 * texto y reglas que se usan en la lista, el detalle y el ranking.
 */
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';

/** WhatsApp de soporte de Imporlan (el mismo de siempre). */
export const WA_SOPORTE = '56940211459';

/** Valor del query `?filtro=` que reemplaza a la antigua sección /imports. */
export const FILTRO_IMPORTACION = 'importacion';
export const FILTROS = ['todos', 'activos', FILTRO_IMPORTACION, 'completados', 'vencidos', 'cancelados'];

export const CANCELADOS = ['canceled', 'cancelled'];
export const CERRADOS = ['expired', ...CANCELADOS];
export const TERMINALES = ['completed', ...CERRADOS];

/** Vencido o cancelado: ya no avanza. */
export function esCerrado(order) {
  return CERRADOS.includes(order?.status);
}

/** Solo vencidos: un cancelado no «venció», lo cerró alguien. */
export function esVencido(order) {
  return order?.status === 'expired';
}

export function esCancelado(order) {
  return CANCELADOS.includes(order?.status);
}

export function esActivo(order) {
  return !TERMINALES.includes(order?.status);
}

/** Etapa ≥ Compra y no vencido/cancelado: lo que antes era "Mis importaciones". */
export function esImportacion(order) {
  return Number(order?.timeline_step || 1) >= 4 && !esCerrado(order);
}

export function etapaDe(order) {
  const total = ETAPAS_EXPEDIENTE.length;
  return Math.min(total, Math.max(1, Number(order?.timeline_step || 1) || 1));
}

export function tipoExpediente(order) {
  return order?.service_type === 'cotizacion_link' ? 'Cotización por links' : 'Búsqueda';
}

/** Lo que el cliente busca: la lancha objetivo, o el plan si no hay objetivo. */
export function nombreExpediente(order) {
  const o = order || {};
  const armado = [o.make, o.model, o.year].filter(Boolean).join(' ');
  return (o.asset_name || '').trim() || armado || (o.requirement_name || '').trim() || o.plan_name || `Expediente ${o.order_number || ''}`.trim();
}

/** Marketplace de origen, deducido del dominio del anuncio. */
export function fuenteAnuncio(url) {
  if (!url) return '';
  try {
    const host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
    if (/facebook|fbcdn|fb\.com/.test(host)) return 'Facebook';
    if (host.includes('boattrader')) return 'BoatTrader';
    if (host.includes('boats.com')) return 'Boats.com';
    if (host.includes('yachtworld')) return 'YachtWorld';
    return host.replace(/^www\./, '').split('.')[0];
  } catch { return ''; }
}

export function urlAbsoluta(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : 'https://' + url;
}

/**
 * El scraper guarda el título del anuncio en link.title; make/model/year casi
 * nunca vienen. Ignorarlo dejaba todas las tarjetas diciendo "Embarcación".
 */
export function tituloEmbarcacion(link) {
  const l = link || {};
  const armado = [l.make, l.model, l.year].filter(Boolean).join(' ');
  const motor = (l.engine || '').trim();
  return (l.title || '').trim() || armado || motor || 'Embarcación sin identificar';
}

export function estaVendida(link) {
  return link?.link_status === 'sold' || link?.link_status === 'unavailable';
}

export function tienePrecio(link) {
  return Number(link?.value_usa_usd) > 0 || Number(link?.value_chile_clp) > 0;
}

/** Nombre corto de una lancha para una frase ("el Cobalt R30"). */
function nombreCorto(link) {
  if (!link) return '';
  const armado = [link.make, link.model].filter(Boolean).join(' ');
  return armado || (link.title || '').trim();
}

/**
 * Una frase que explica en qué está el expediente. Es lo que el cliente lee
 * antes que cualquier otra cosa del detalle.
 */
export function fraseEtapa(order, primeraLancha) {
  if (!order) return '';
  const status = order.status;
  if (status === 'completed') return 'Tu expediente se completó: todas las opciones fueron revisadas y entregadas. Si necesitas algo más, escríbenos.';
  if (status === 'expired') return 'Este expediente venció. Si quieres retomar la búsqueda, escríbele a tu agente y lo reactivamos.';
  if (status === 'canceled' || status === 'cancelled') return 'Este expediente fue cancelado. Si quieres iniciar una nueva búsqueda, estamos a tu disposición.';

  const lancha = nombreCorto(primeraLancha);
  const la = lancha ? `la ${lancha}` : 'la embarcación elegida';
  switch (etapaDe(order)) {
    case 1:
      return order.service_type === 'cotizacion_link'
        ? 'Estamos leyendo los anuncios que nos mandaste y calculando cuánto cuesta cada lancha puesta en Chile. La cotización queda publicada aquí en aproximadamente 24 horas.'
        : 'Recibimos tu solicitud y estamos preparando la búsqueda. En cuanto tengamos las primeras opciones, aparecen aquí para que las ordenes.';
    case 2:
      return 'Estamos buscando opciones en Estados Unidos. A medida que aparezcan, las sumamos a tu ranking para que las compares y nos digas cuál prefieres.';
    case 3:
      return `Estamos coordinando la inspección de ${la}; te avisamos cuando esté el reporte.`;
    case 4:
      return `Estamos negociando y cerrando la compra de ${la} a tu nombre. Te avisamos de cada pago que corresponda.`;
    case 5:
      return `${lancha ? `La ${lancha}` : 'Tu lancha'} viene en camino: transporte, aduana y entrega en Chile. Puedes seguir el viaje en Seguimiento.`;
    default:
      return '';
  }
}

/** Link de WhatsApp al agente (si tiene teléfono) o a soporte, con el texto de siempre. */
export function whatsappExpediente(order) {
  const texto = encodeURIComponent(`Hola, tengo una consulta sobre expediente #${order?.order_number || ''}`);
  const tel = (order?.agent_phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${tel || WA_SOPORTE}?text=${texto}`;
}

export function esImagen(f) {
  return (f?.category || '') === 'image' || (f?.mime_type || '').startsWith('image/');
}

export function esVideo(f) {
  return (f?.category || '') === 'video' || (f?.mime_type || '').startsWith('video/');
}
