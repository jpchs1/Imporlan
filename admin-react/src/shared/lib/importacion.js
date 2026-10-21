/**
 * Elegir la lancha e importar: lo que el panel del cliente y el admin
 * comparten. Las reglas viven en el servidor (api/eleccion_lancha.php); esto
 * es la misma lista de hitos y las cuentas de presentación, para que las dos
 * pantallas digan lo mismo con las mismas palabras.
 *
 * Forma de `order.eleccion` (null si no hay elección):
 *   { link_id, at, by: 'cliente'|'equipo', inspection: bool, note,
 *     steps: { [hito]: 'Y-m-d H:i:s' }, client_can_change: bool }
 * En la lista del cliente trae además `title` e `image_url`.
 */

/**
 * Hitos que marca el equipo, en orden (mismas claves que impHitos()).
 *   label / corto   el hito ya hecho («Compra cerrada»)
 *   enCurso         la frase mientras se hace
 *   enCursoCorto    lo mismo en dos o tres palabras, para un chip
 */
export const HITOS = [
  {
    id: 'disponibilidad',
    label: 'Disponibilidad y precio confirmados con el vendedor',
    corto: 'Disponibilidad confirmada',
    etapa: 3,
    enCurso: 'Tu agente está confirmando con el vendedor que la lancha sigue disponible y el precio final.',
    enCursoCorto: 'Confirmando disponibilidad',
  },
  {
    id: 'inspeccion',
    label: 'Inspección técnica aprobada',
    corto: 'Inspección aprobada',
    etapa: 3,
    soloConInspeccion: true,
    enCurso: 'Estamos coordinando la inspección técnica. Te mandamos el reporte antes de comprar.',
    enCursoCorto: 'Coordinando la inspección',
  },
  {
    id: 'compra',
    label: 'Compra cerrada en Estados Unidos',
    corto: 'Compra cerrada',
    etapa: 4,
    enCurso: 'Estamos cerrando la compra con el vendedor, a tu nombre.',
    enCursoCorto: 'Cerrando la compra',
  },
  {
    id: 'transporte',
    label: 'En camino a Chile',
    corto: 'En camino',
    etapa: 5,
    enCurso: 'Estamos coordinando el transporte de la lancha a Chile.',
    enCursoCorto: 'Coordinando el transporte',
  },
  {
    id: 'aduana',
    label: 'Aduana e internación en Chile',
    corto: 'En aduana',
    etapa: 5,
    enCurso: 'La lancha llega a Chile y pasa por aduana para la internación.',
    enCursoCorto: 'En aduana',
  },
  {
    id: 'entrega',
    label: 'Entregada',
    corto: 'Entregada',
    etapa: 5,
    enCurso: 'Coordinamos contigo la entrega.',
    enCursoCorto: 'Coordinando la entrega',
  },
];

/** Hitos que aplican a esta elección, cada uno con `hecho` (fecha o null). */
export function hitosDe(eleccion) {
  if (!eleccion) return [];
  const steps = eleccion.steps || {};
  return HITOS
    .filter(h => !h.soloConInspeccion || eleccion.inspection)
    .map(h => ({ ...h, hecho: steps[h.id] || null }));
}

/** El primer hito sin hacer (el que está «en curso»), o null si están todos. */
export function hitoEnCurso(eleccion) {
  return hitosDe(eleccion).find(h => !h.hecho) || null;
}

/** La lancha elegida dentro de `order.links`, o null. */
export function linkElegido(order) {
  const id = Number(order?.eleccion?.link_id);
  if (!id) return null;
  return (order?.links || []).find(l => Number(l.id) === id) || null;
}

/**
 * Lo que sigue en la importación, en orden de prioridad: si hay un cobro por
 * pagar es lo primero (le toca al cliente); si no, el hito en curso (lo hace
 * el agente); si no queda nada, está entregada.
 *   { tipo: 'pago', pago }  ·  { tipo: 'hito', hito }  ·  { tipo: 'listo' }
 * `pagos` es el resultado de pagosConCobros (o null si no hay plan).
 */
export function queSigue(eleccion, pagos) {
  const porPagar = [...(pagos?.pagos || []).filter(p => p.estado === 'por_pagar'), ...(pagos?.otros || []).filter(r => r.status === 'pending').map(r => ({ n: null, cobro: r, estado: 'por_pagar' }))];
  if (porPagar.length) return { tipo: 'pago', pago: porPagar[0] };
  const hito = hitoEnCurso(eleccion);
  if (hito) return { tipo: 'hito', hito };
  return { tipo: 'listo' };
}

/**
 * Qué incluye la inspección técnica. No tiene precio aparte: va dentro de la
 * operación, que se paga con el plan de pagos (Pago 1 al elegir).
 */
export const INSPECCION_INCLUYE = [
  'Inspección visual de casco, cubierta y estructura',
  'Pruebas de motor (compresión, presión, fugas)',
  'Sistema eléctrico, baterías e instrumentación',
  'Equipamiento de seguridad y navegación',
  'Galería fotográfica completa con fechas y notas',
  'Reporte detallado en PDF entregado en 48 a 72 horas',
];

function json(v) {
  if (typeof v !== 'string') return v || null;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Plan de pagos de la cotización de una lancha: [{ n, pct, clp }].
 * Vacío si la cotización no está publicada (el servidor no manda los números).
 */
export function planDePagos(link) {
  const pay = json(link?.quote_payments);
  if (!pay || !link?.quote_total_clp) return [];
  return [1, 2, 3]
    .filter(n => Number(pay[`p${n}_clp`]) > 0)
    .map(n => ({ n, pct: Number(pay[`p${n}_pct`]) || 0, clp: Math.round(Number(pay[`p${n}_clp`])) }));
}

/**
 * Cobros (solicitudes de pago) de este expediente. El admin los crea con
 * metadata.order_id y metadata.custom_fields.pago = n; los antiguos se
 * reconocen por el título («Pago 1 · …»).
 */
export function cobrosDelExpediente(requests, orderId) {
  return (requests || []).filter(r => String(r?.metadata?.order_id ?? '') === String(orderId));
}

export function numeroDePago(request) {
  const n = Number(request?.metadata?.custom_fields?.pago);
  if (n >= 1 && n <= 3) return n;
  const m = /pago\s*(\d)\b/i.exec(request?.title || '');
  return m ? Number(m[1]) : null;
}

/**
 * Cada pago del plan con su cobro (si ya se creó). `estado`:
 *   'pagado' · 'por_pagar' (hay cobro pendiente) · 'por_cobrar' (aún no se crea)
 * Los cobros del expediente que no calzan con un pago del plan van en `otros`.
 */
export function pagosConCobros(plan, cobros) {
  const usados = new Set();
  const pagos = plan.map(p => {
    const cobro = (cobros || []).find(r => !usados.has(r.id) && numeroDePago(r) === p.n && r.status !== 'cancelled');
    if (cobro) usados.add(cobro.id);
    const estado = !cobro ? 'por_cobrar' : cobro.status === 'paid' ? 'pagado' : 'por_pagar';
    return { ...p, cobro: cobro || null, estado };
  });
  const otros = (cobros || []).filter(r => !usados.has(r.id) && r.status !== 'cancelled');
  return { pagos, otros };
}

/**
 * Precio puesto en Chile que se le muestra al cliente para una lancha:
 * la cotización publicada, si no el negociado, si no el publicado.
 */
export function precioChile(link) {
  if (!link) return null;
  if (Number(link.quote_total_clp) > 0) return { clp: Number(link.quote_total_clp), usd: Number(link.quote_total_usd) || null, fuente: 'cotizacion' };
  if (Number(link.value_chile_negotiated_clp) > 0) return { clp: Number(link.value_chile_negotiated_clp), usd: Number(link.value_to_negotiate_usd) || null, fuente: 'negociado' };
  if (Number(link.value_chile_clp) > 0) return { clp: Number(link.value_chile_clp), usd: Number(link.value_usa_usd) || null, fuente: 'publicado' };
  return null;
}

export const FUENTE_PRECIO = {
  cotizacion: 'Cotización final',
  negociado: 'Precio negociado',
  publicado: 'Precio publicado',
};

/** ¿Se puede elegir esta lancha? (lo mismo que impValidarEleccionCliente). */
export function sePuedeElegir(link) {
  return !!(link && (link.url || '').trim() && !['sold', 'unavailable'].includes(link.link_status));
}

/** Título legible de una lancha del ranking (igual que impTituloLancha en el servidor). */
export function tituloLancha(link) {
  const l = link || {};
  const t = (l.title || '').trim();
  if (t) return t;
  const armado = [l.year, l.make, l.model].filter(Boolean).join(' ');
  return armado || 'Opción sin identificar';
}

/**
 * Etapa (1-5) que impone la elección y sus hitos, la misma cuenta que
 * impEtapaPorEleccion en el servidor: con inspección queda en 3 hasta que
 * se apruebe; sin inspección pasa a 4; viaje, aduana y entrega la llevan a 5.
 * 0 si no hay elección.
 */
export function etapaPorEleccion(eleccion) {
  if (!eleccion) return 0;
  const steps = eleccion.steps || {};
  let etapa = 3;
  if (!eleccion.inspection || steps.inspeccion) etapa = 4;
  for (const h of HITOS) if (steps[h.id] && h.etapa > etapa) etapa = h.etapa;
  return etapa;
}

/**
 * El Pago 1 que se le pide al cliente al elegir: el primer pago del plan de
 * la lancha ({ n, pct, clp }), o null sin cotización publicada. En ese caso
 * no se inventa el %: el Pago 1 le llega cuando la cotización esté lista.
 */
export function pago1De(link) {
  return planDePagos(link)[0] || null;
}

/**
 * El % del Pago 1 que comparten las lanchas con cotización publicada, para
 * hablar del plan antes de que haya elección. null si ninguna tiene plan o
 * si difieren entre sí.
 */
export function pctPago1Comun(links) {
  const pcts = new Set((links || []).map(l => pago1De(l)?.pct).filter(p => p > 0));
  return pcts.size === 1 ? [...pcts][0] : null;
}

/**
 * Archivos que mandó la operación en Estados Unidos (operador_usa.php los
 * guarda con esta descripción). El cliente ve las fotos y los videos; nunca
 * quién los mandó.
 */
export const DESCRIPCION_DESDE_USA = 'Desde Estados Unidos';

export function esDesdeUsa(file) {
  return (file?.description || '').trim() === DESCRIPCION_DESDE_USA;
}

/**
 * El Pago 1 que el servidor crea solo al elegir (impPlanPago1): sólo con la
 * cotización PUBLICADA. En el admin las filas traen el plan aunque esté en
 * análisis, así que aquí se exige `quote_published_at`. { n, pct, clp } o null.
 */
export function pago1AlElegir(link) {
  if (!link?.quote_published_at) return null;
  const plan = planDePagos(link);
  return plan.find(p => p.n === 1) || null;
}

/** Un hito por su id (null si no existe). */
export function hitoPorId(id) {
  return HITOS.find(h => h.id === id) || null;
}

/**
 * Operación en EE. UU. (api/operador_usa.php): los hitos que hace el
 * operador allá. Después de éstos, lo que sigue es en Chile.
 */
export const HITOS_USA = ['disponibilidad', 'inspeccion', 'compra', 'transporte'];

/** Archivos que subió el operador de EE. UU. (uploaded_by y description). */
export const ORIGEN_ARCHIVO_USA = 'operador_usa';
export const DESCRIPCION_ARCHIVO_USA = DESCRIPCION_DESDE_USA;

/**
 * Datos del cliente para la importación (api/eleccion_lancha.php, «Datos del
 * cliente, cédula y Términos»): la cédula queda en expediente_files con este
 * uploaded_by y visible_to_client = 0. El cliente no la ve entre sus archivos
 * y el agente de EE. UU. tampoco; sólo el equipo en Chile.
 */
export const ORIGEN_ARCHIVO_IDENTIDAD = 'cliente_identidad';

export function esCedulaCliente(file) {
  return file?.uploaded_by === ORIGEN_ARCHIVO_IDENTIDAD;
}

/**
 * Orden y etiquetas de los 10 campos del formulario (los mismos que
 * impCamposDatos() en el servidor). La API los manda en `campos`; esto es el
 * respaldo si no vienen, y fija el orden en que se muestran.
 */
export const CAMPOS_DATOS_IMPORTACION = [
  ['nombre', 'Nombre completo'],
  ['rut', 'RUT'],
  ['fecha_nacimiento', 'Fecha de nacimiento'],
  ['nacionalidad', 'Nacionalidad'],
  ['estado_civil', 'Estado civil'],
  ['profesion', 'Profesión u oficio'],
  ['telefono', 'Teléfono'],
  ['direccion', 'Dirección'],
  ['comuna', 'Comuna'],
  ['region', 'Región'],
];

/** [{ clave, etiqueta, valor }] en orden, con las etiquetas que mandó la API si vinieron. */
export function camposDatosImportacion(datos, campos) {
  const d = datos && typeof datos === 'object' ? datos : {};
  return CAMPOS_DATOS_IMPORTACION.map(([clave, etiqueta]) => ({
    clave,
    etiqueta: (campos && campos[clave]) || etiqueta,
    valor: typeof d[clave] === 'string' ? d[clave].trim() : (d[clave] ?? ''),
  }));
}

/**
 * Cuándo llega cada pago del plan (JP, 21-oct-2026), igual que
 * impPagoPorHito() en el servidor: el Pago 1 al elegir, el Pago 2 con la
 * inspección aprobada (sin inspección, con la disponibilidad confirmada) y el
 * Pago 3 con la lancha entregada en el puerto de EE. UU.
 */
export function cuandoLlegaPago(n, eleccion) {
  if (n === 1) return 'Llega al elegir la lancha, apenas esté publicada tu cotización final';
  if (n === 2) return eleccion?.inspection ? 'Llega cuando se apruebe la inspección técnica' : 'Llega cuando el vendedor confirme disponibilidad y precio';
  if (n === 3) return 'Llega cuando la lancha esté en el puerto de EE. UU., lista para viajar a Chile';
  return 'Te lo enviamos cuando corresponda';
}

/** El hito del admin que crea el pago N (para avisar al equipo al marcarlo). */
export function pagoQueGatilla(hitoId, eleccion) {
  if (hitoId === 'inspeccion') return 2;
  if (hitoId === 'disponibilidad' && !eleccion?.inspection) return 2;
  if (hitoId === 'transporte') return 3;
  return 0;
}

/**
 * Inspección no apta (JP, 21-oct-2026): el equipo marcó que la inspección
 * recomienda no comprar la lancha elegida (admin_inspeccion_resultado). El
 * cliente elige otra —su Pago 1 se abona a la nueva— o pide la devolución.
 * `order.eleccion` trae inspection_result ('no_apta' | null),
 * inspection_result_at, inspection_note (la nota del equipo para el cliente)
 * y refund_requested_at.
 */
export function inspeccionNoApta(eleccion) {
  return !!eleccion && eleccion.inspection_result === 'no_apta';
}

/** Con la inspección no apta, el cliente pidió la devolución del Pago 1. */
export function devolucionPedida(eleccion) {
  return inspeccionNoApta(eleccion) && !!eleccion.refund_requested_at;
}
