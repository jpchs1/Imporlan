/**
 * La inspección técnica dentro de la importación (JP, 21-oct-2026): «es la
 * forma de saber realmente el estado de la embarcación; muchas veces ni el
 * propio dueño está al tanto. Si sale no apto se ahorra un problema a futuro
 * y conviene ver otra opción; si sale positivo avanzamos».
 *
 * Las reglas viven en el servidor (impInspeccionNoApta, impClientePuedeCambiar
 * en api/eleccion_lancha.php). Aquí van las mismas palabras para el asistente,
 * el avance y el estado «no apta», para que todo diga lo mismo.
 *
 * `order.eleccion` trae: inspection (bool), inspection_result ('no_apta' |
 * null), inspection_result_at, inspection_note (lo que el equipo le cuenta al
 * cliente) y refund_requested_at (si pidió la devolución del Pago 1).
 */
import { hitosDe } from './importacion';

/** Por qué inspeccionar, en una línea. */
export const POR_QUE_INSPECCIONAR = 'Es la forma de conocer el estado real de la lancha antes de pagarla: muchas veces ni el dueño conoce algunos detalles.';

/**
 * El camino después de la inspección, según el resultado. Los dos textos
 * largos son los del diagrama del asistente; los cortos, los del avance, y
 * van en minúscula porque siguen a «Apta:» / «No apta:».
 */
export const CAMINO_INSPECCION = {
  apta: {
    id: 'apta',
    label: 'Apta',
    titulo: 'Avanzamos con la compra',
    texto: 'Te llega el Pago 2 y cerramos la compra con el vendedor, a tu nombre.',
    corto: 'avanzamos con la compra y te llega el Pago 2.',
  },
  no_apta: {
    id: 'no_apta',
    label: 'No apta',
    titulo: 'Te ahorraste un problema',
    texto: 'Eliges otra lancha de tu ranking (tu Pago 1 se abona a la nueva) o te lo devolvemos.',
    corto: 'eliges otra lancha (tu Pago 1 se abona) o te lo devolvemos.',
  },
};

/** La inspección recomendó no comprar la lancha elegida. */
export function inspeccionNoApta(eleccion) {
  return !!(eleccion?.inspection && eleccion.inspection_result === 'no_apta');
}

/** Tras el «no apta», el cliente pidió la devolución del Pago 1 en vez de elegir otra. */
export function devolucionPedida(eleccion) {
  return inspeccionNoApta(eleccion) && !!eleccion.refund_requested_at;
}

/**
 * En qué está la inspección de esta elección:
 *   'sin_inspeccion'  eligió sin inspección
 *   'pendiente'       aún no le toca (antes va la disponibilidad)
 *   'en_curso'        es el hito en curso
 *   'aprobada'        el equipo marcó el hito
 *   'no_apta'         el equipo marcó el resultado no apto
 */
export function estadoInspeccion(eleccion) {
  if (!eleccion?.inspection) return 'sin_inspeccion';
  if (inspeccionNoApta(eleccion)) return 'no_apta';
  const hitos = hitosDe(eleccion);
  const h = hitos.find(x => x.id === 'inspeccion');
  if (!h) return 'sin_inspeccion';
  if (h.hecho) return 'aprobada';
  const enCurso = hitos.find(x => !x.hecho);
  return enCurso?.id === 'inspeccion' ? 'en_curso' : 'pendiente';
}

/**
 * Un cobro del Pago 1 que se pagó por otra lancha del mismo expediente (la
 * no apta) y se abonó a la elegida: el cobro lleva el link_id de la anterior.
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
 * El reporte de inspección (inspection_reports_api, user_list) de la lancha
 * elegida, si ya está: se reconoce por el anuncio (`listing_url`) o por el
 * expediente, cuando el reporte lo trae. null si no hay.
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
