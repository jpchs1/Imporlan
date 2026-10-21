/**
 * Datos del cliente para la importación (JP, 21-oct-2026): el formulario que
 * se pide al elegir la lancha, con la cédula por ambos lados y los Términos.
 * Las reglas mandan en el servidor (impValidarDatos en api/eleccion_lancha.php);
 * aquí están las mismas para avisar antes de enviar y para formatear el RUT
 * mientras se escribe. Lo que el servidor manda (`campos`, `estados_civiles`,
 * `terminos.url`) tiene prioridad sobre estas listas, que son el respaldo.
 */

/** Los 10 campos, en el orden del formulario. `ancho: 'full'` ocupa las dos columnas. */
export const CAMPOS_DATOS = [
  { id: 'nombre', label: 'Nombre completo', ancho: 'full', autoComplete: 'name', max: 120 },
  { id: 'rut', label: 'RUT', max: 12 },
  { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', autoComplete: 'bday', max: 10 },
  { id: 'nacionalidad', label: 'Nacionalidad', max: 60 },
  { id: 'estado_civil', label: 'Estado civil', max: 30 },
  { id: 'profesion', label: 'Profesión u oficio', autoComplete: 'organization-title', max: 80 },
  { id: 'telefono', label: 'Teléfono', autoComplete: 'tel', max: 30 },
  { id: 'direccion', label: 'Dirección', ancho: 'full', autoComplete: 'street-address', max: 160 },
  { id: 'comuna', label: 'Comuna', autoComplete: 'address-level2', max: 60 },
  { id: 'region', label: 'Región', autoComplete: 'address-level1', max: 60 },
];

export const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Conviviente civil', 'Separado/a'];

/** Las 16 regiones, de norte a sur, con el nombre corto que usa todo el mundo. */
export const REGIONES_CHILE = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
  'Metropolitana de Santiago', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía',
  'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
];

/** Términos vigentes: respaldo si el servidor no los manda (la versión la manda siempre). */
export const TERMINOS_URL = 'https://www.imporlan.cl/terminos-y-condiciones/';

/** Lo que se acepta como cédula y su peso máximo (lo mismo que impRevisarCedula). */
export const CEDULA_ACEPTA = 'image/*,application/pdf';
export const CEDULA_MAX_BYTES = 10 * 1024 * 1024;
const CEDULA_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/** Sólo dígitos y K, en mayúscula. */
export function rutLimpio(rut) {
  return String(rut || '').toUpperCase().replace(/[^0-9K]/g, '');
}

/** RUT chileno válido (módulo 11), como impRutValido. */
export function rutValido(rut) {
  const r = rutLimpio(rut);
  if (r.length < 2) return false;
  const dv = r.slice(-1);
  const num = r.slice(0, -1);
  if (!/^\d+$/.test(num) || Number(num) < 1000000) return false;
  let s = 0;
  let m = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    s += Number(num[i]) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const esp = 11 - (s % 11);
  const dvEsperado = esp === 11 ? '0' : esp === 10 ? 'K' : String(esp);
  return dvEsperado === dv;
}

/**
 * Formatea mientras se escribe: el último carácter es el dígito verificador.
 * «123456789» → «12.345.678-9»; «1234» → «123-4»; «1» → «1».
 */
export function rutFormato(rut) {
  const r = rutLimpio(rut).slice(0, 9);
  if (r.length < 2) return r;
  const num = r.slice(0, -1).replace(/K/g, '');
  const dv = r.slice(-1);
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

/** Edad en años cumplidos a la fecha de hoy, o null si la fecha no es válida. */
export function edadDe(fechaISO, hoy = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO || '')) return null;
  const d = new Date(fechaISO + 'T00:00:00');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fechaISO) return null;
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return edad;
}

/**
 * Una fecha sola («2026-06-19») como fecha local, para formatearla sin que
 * el huso la corra un día («2026-06-19» a secas se lee como UTC).
 */
export function fechaLocal(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso}T00:00:00` : iso;
}

/** Fecha ISO de hace `anos` años: el `max`/`min` del campo de nacimiento. */
export function fechaHaceAnos(anos, hoy = new Date()) {
  const d = new Date(hoy.getTime());
  d.setFullYear(d.getFullYear() - anos);
  return d.toISOString().slice(0, 10);
}

/**
 * Valida los 10 campos como el servidor. Devuelve { campo: mensaje } vacío si
 * todo está bien. `estados` es la lista que mandó el servidor (o el respaldo).
 */
export function validarDatos(datos, estados = ESTADOS_CIVILES) {
  const errores = {};
  const d = datos || {};
  for (const c of CAMPOS_DATOS) {
    if (!String(d[c.id] ?? '').trim()) errores[c.id] = `Falta: ${c.label.toLowerCase()}`;
  }
  if (!errores.rut && !rutValido(d.rut)) errores.rut = 'El RUT no es válido: revisa el dígito verificador';
  if (!errores.fecha_nacimiento) {
    const edad = edadDe(String(d.fecha_nacimiento).trim());
    if (edad === null || edad < 18 || edad > 110) errores.fecha_nacimiento = 'Revisa la fecha de nacimiento: debes ser mayor de edad';
  }
  if (!errores.estado_civil && !(estados || []).includes(d.estado_civil)) errores.estado_civil = 'Elige tu estado civil';
  if (!errores.telefono && String(d.telefono).replace(/\D/g, '').length < 8) errores.telefono = 'Revisa el teléfono: faltan dígitos';
  // A nombre de otra persona o empresa (opcional; por defecto, del cliente).
  if (d.titular_tipo === 'otro') {
    if (!String(d.titular_nombre ?? '').trim()) errores.titular_nombre = 'Falta el nombre o la razón social';
    if (!String(d.titular_rut ?? '').trim()) errores.titular_rut = 'Falta el RUT';
    else if (!rutValido(d.titular_rut)) errores.titular_rut = 'El RUT no es válido: revisa el dígito verificador';
  }
  return errores;
}

/** Revisa una cara de la cédula antes de enviarla. Devuelve el mensaje de error o ''. */
export function errorArchivoCedula(file, cara) {
  if (!file) return '';
  if (file.size > CEDULA_MAX_BYTES) return `La foto del ${cara} pesa más de 10 MB. Prueba con una más liviana.`;
  const tipo = String(file.type || '').toLowerCase();
  const nombre = String(file.name || '').toLowerCase();
  const esHeic = /\.(heic|heif)$/.test(nombre);
  if (tipo && !CEDULA_MIMES.includes(tipo) && !esHeic) return `El ${cara} debe ser una foto (JPG, PNG, WEBP o HEIC) o un PDF.`;
  return '';
}

export function esPdf(fileOInfo) {
  return String(fileOInfo?.type || fileOInfo?.mime_type || '').toLowerCase() === 'application/pdf';
}

/**
 * ¿Le faltan al cliente los datos de importación? Sólo con una lancha elegida
 * y cuando el servidor ya manda `datos_importacion` (si no viene, no se pide).
 */
export function faltanDatosImportacion(order) {
  return !!(order?.eleccion && order?.datos_importacion && order.datos_importacion.completo === false);
}

/** Orden en que se recorren los errores para enfocar el primero. */
export const ORDEN_ERRORES = [...CAMPOS_DATOS.map(c => c.id), 'titular_nombre', 'titular_rut', 'ci_frente', 'ci_reverso', 'terminos'];
