/**
 * La inspección técnica dentro de la importación (JP, 21-oct-2026): «es la
 * forma de saber realmente el estado de la embarcación; muchas veces ni el
 * propio dueño está al tanto. Si sale no apto se ahorra un problema a futuro
 * y conviene ver otra opción; si sale positivo avanzamos».
 *
 * Y la quinta vuelta: «Nosotros cumplimos con cargar el reporte, pero el
 * cliente es el que toma la decisión si aprueba o declina la compra. La
 * inspección siempre vendrá en inglés: ¿puede él verlo en español?». El equipo
 * carga el PDF, el servidor lo traduce con IA y el cliente lo lee en el panel,
 * lo descarga en español y decide.
 *
 * Las reglas viven en el servidor (impEtapaInspeccion, impInspeccionNoApta,
 * impClientePuedeCambiar en api/eleccion_lancha.php). Aquí van las mismas
 * palabras para el asistente, el avance y los estados, para que todo diga lo
 * mismo.
 *
 * `order.eleccion` trae: inspection (bool), inspection_stage (null |
 * 'coordinando' | 'reporte_listo' | 'aprobada' | 'declinada'),
 * inspection_decided_by ('cliente' | 'equipo' | null), inspection_report
 * (null | { at, file_id, summary, es_status, es_at }), inspection_result
 * ('no_apta' | null), inspection_result_at, inspection_note (lo que el equipo
 * le cuenta al cliente) y refund_requested_at (si pidió la devolución del
 * Pago 1). `order.declined_link_ids` son las lanchas que ya declinó.
 */
import { hitosDe } from './importacion';

/** Por qué inspeccionar, en una línea. */
export const POR_QUE_INSPECCIONAR = 'Es la forma de conocer el estado real de la lancha antes de pagarla: muchas veces ni el dueño conoce algunos detalles. El reporte te llega en inglés y en español, y la decisión es tuya.';

/**
 * El camino de la inspección: primero el inspector, después el cliente lee
 * el reporte y al final decide. Los textos largos son los del diagrama del
 * asistente; los cortos, los del avance, y van en minúscula porque siguen a
 * «Apruebas:» / «Declinas:».
 */
export const CAMINO_INSPECCION = {
  revisas: {
    id: 'revisas',
    titulo: 'Tú revisas el reporte',
    texto: 'Te llega en inglés y en español. Lo lees con calma y, si tienes dudas, nos escribes.',
    corto: 'te llega en inglés y en español.',
  },
  apta: {
    id: 'apta',
    label: 'Apruebas',
    titulo: 'Seguimos con la compra',
    texto: 'Te llega el Pago 2 y cerramos la compra con el vendedor, a tu nombre.',
    corto: 'seguimos con la compra y te llega el Pago 2.',
  },
  no_apta: {
    id: 'no_apta',
    label: 'Declinas',
    titulo: 'Te ahorraste un problema',
    texto: 'Eliges otra lancha de tu ranking (tu Pago 1 se abona a la nueva) o te lo devolvemos.',
    corto: 'eliges otra lancha (tu Pago 1 se abona) o te lo devolvemos.',
  },
};

/**
 * En qué va la inspección de esta elección, con las palabras del servidor:
 *   null · 'coordinando' · 'reporte_listo' · 'aprobada' · 'declinada'
 * Si el servidor no manda `inspection_stage` (respuesta antigua), se deduce
 * de los campos de la vuelta anterior.
 */
export function etapaInspeccion(eleccion) {
  if (!eleccion?.inspection) return null;
  const st = eleccion.inspection_stage;
  if (['coordinando', 'reporte_listo', 'aprobada', 'declinada'].includes(st)) return st;
  if (eleccion.inspection_result === 'no_apta') return 'declinada';
  if (eleccion.steps?.inspeccion) return 'aprobada';
  return eleccion.inspection_report ? 'reporte_listo' : 'coordinando';
}

/** El cliente no sigue con la lancha elegida tras la inspección (él lo decidió, o el equipo lo registró por él). */
export function inspeccionDeclinada(eleccion) {
  return etapaInspeccion(eleccion) === 'declinada';
}

/** Compatibilidad con la vuelta 4: «no apta» es lo mismo que «declinada». */
export function inspeccionNoApta(eleccion) {
  return inspeccionDeclinada(eleccion);
}

/** Hay reporte y el cliente todavía no decide. */
export function reporteListo(eleccion) {
  return etapaInspeccion(eleccion) === 'reporte_listo';
}

/** Quién decidió sobre el reporte: 'cliente' (desde su panel) o 'equipo' (lo registró por él). */
export function decidioInspeccion(eleccion) {
  const by = eleccion?.inspection_decided_by;
  return by === 'equipo' ? 'equipo' : 'cliente';
}

/** El reporte cargado ({ at, file_id, summary, es_status, es_at }) o null. */
export function reporteDe(eleccion) {
  const r = eleccion?.inspection_report;
  return r && typeof r === 'object' ? r : null;
}

/** Tras declinar, el cliente pidió la devolución del Pago 1 en vez de elegir otra. */
export function devolucionPedida(eleccion) {
  return inspeccionDeclinada(eleccion) && !!eleccion.refund_requested_at;
}

/**
 * En qué está la inspección de esta elección, para el chip de «Tu importación»:
 *   'sin_inspeccion'  eligió sin inspección
 *   'pendiente'       aún no le toca (antes va la disponibilidad)
 *   'en_curso'        se está coordinando
 *   'reporte_listo'   hay reporte: el cliente decide
 *   'aprobada'        el cliente aprobó
 *   'declinada'       el cliente no sigue con esta lancha
 */
export function estadoInspeccion(eleccion) {
  const etapa = etapaInspeccion(eleccion);
  if (!etapa) return 'sin_inspeccion';
  if (etapa !== 'coordinando') return etapa;
  const hitos = hitosDe(eleccion);
  const enCurso = hitos.find(x => !x.hecho);
  return enCurso?.id === 'inspeccion' ? 'en_curso' : 'pendiente';
}

/**
 * Las lanchas que el cliente declinó tras la inspección en este expediente:
 * `order.declined_link_ids` más la elegida si la acaba de declinar. No se
 * pueden volver a elegir (el servidor responde 409).
 */
export function lanchasDeclinadas(order) {
  const ids = new Set((Array.isArray(order?.declined_link_ids) ? order.declined_link_ids : []).map(Number).filter(n => n > 0));
  const el = order?.eleccion;
  if (inspeccionDeclinada(el) && Number(el.link_id) > 0) ids.add(Number(el.link_id));
  return [...ids];
}

/**
 * Un cobro del Pago 1 que se pagó por otra lancha del mismo expediente (la
 * declinada) y se abonó a la elegida: el cobro lleva el link_id de la anterior.
 */
export function pago1AbonadoDeOtra(cobro, eleccion) {
  const de = Number(cobro?.metadata?.custom_fields?.link_id);
  const actual = Number(eleccion?.link_id);
  return !!(de && actual && de !== actual && cobro?.status === 'paid');
}

/** Un anuncio sin protocolo, www ni barra final, para comparar URLs. */
function urlLlana(url) {
  return String(url || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
}

/**
 * El reporte de inspección antiguo (inspection_reports_api, user_list) de la
 * lancha elegida, si existe: se reconoce por el anuncio (`listing_url`) o por
 * el expediente. null si no hay. Es el respaldo cuando no hay reporte cargado
 * por el equipo (`inspection_report`).
 */
export function reporteInspeccionDe(inspecciones, link, order) {
  const lista = Array.isArray(inspecciones) ? inspecciones : [];
  const anuncio = urlLlana(link?.url);
  const porAnuncio = anuncio ? lista.find(r => urlLlana(r?.listing_url) === anuncio) : null;
  if (porAnuncio) return porAnuncio;
  const oid = String(order?.id ?? '');
  const num = String(order?.order_number ?? '');
  return lista.find(r => (oid && String(r?.order_id ?? '') === oid) || (num && String(r?.order_number ?? '') === num)) || null;
}

/**
 * Texto con `**negrita**` (como lo manda la traducción) partido en trozos
 * [{ x, strong }], para pintarlo con <strong> y nunca como HTML.
 */
export function trozosNegrita(texto) {
  const partes = String(texto ?? '').split(/\*\*/);
  return partes.map((x, i) => ({ x, strong: i % 2 === 1 })).filter(p => p.x !== '');
}
