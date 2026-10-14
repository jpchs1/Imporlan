/**
 * Formatos de la casa (ver README del kit, "Microcopy").
 *
 *   fmtUSD(13182)          → "USD 13.182"
 *   fmtNumero(1234567.8)   → "1.234.568"
 *   fmtDateLarga(d)        → "12 oct 2026"      (texto corrido)
 *   fmtRelativo(d)         → "hace 2 h"         (listas de actividad; poner la
 *                                                fecha completa en `title`)
 * `fmtCLP` y `fmtDate` (12-10-2026, tablas) viven en utils.js.
 */

const nf0 = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export function fmtNumero(n, decimales = 0) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  if (decimales === 0) return nf0.format(v);
  return new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

/** "USD 13.182" — siempre entero, separador de miles con punto, sin "$". */
export function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return `USD ${nf0.format(Math.round(v))}`;
}

/* ---------------------------------------------------------------------------
   MoneyInput: lo que se escribe y lo que se muestra.
   CLP es entero. USD acepta hasta 2 decimales (coma o punto al escribir) y se
   muestra con formato es-CL: 1250.5 → "1.250,50"; 1250 → "1.250".
   --------------------------------------------------------------------------- */
const nf2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Texto escrito en un MoneyInput → { texto (limpio, con coma), valor (number|null) }. */
export function parseMoneyInput(text, currency = 'CLP') {
  const s = String(text ?? '');
  if (currency !== 'USD') {
    const digits = s.replace(/[^\d]/g, '');
    return { texto: digits, valor: digits === '' ? null : Number(digits) };
  }
  // Separador decimal: si hay coma y punto, el último que aparece; los demás
  // son miles ("1.250,50" → 1250.50; "87.50" → 87.5; "87,5" → 87.5).
  const iComa = s.lastIndexOf(','), iPunto = s.lastIndexOf('.');
  const sep = iComa < 0 && iPunto < 0 ? -1 : Math.max(iComa, iPunto);
  const entero = (sep < 0 ? s : s.slice(0, sep)).replace(/[^\d]/g, '');
  const dec = sep < 0 ? null : s.slice(sep + 1).replace(/[^\d]/g, '').slice(0, 2);
  const texto = dec === null ? entero : `${entero},${dec}`;
  if (entero === '' && !dec) return { texto, valor: null };
  return { texto, valor: Math.round(Number(`${entero || '0'}.${dec || '0'}`) * 100) / 100 };
}

/** Valor numérico → texto para mostrar sin foco ("12.523.000" · "1.250,50"). */
export function fmtMoneyInput(value, currency = 'CLP') {
  if (value === null || value === undefined || value === '') return '';
  const v = Number(value);
  if (!isFinite(v)) return '';
  if (currency !== 'USD') return nf0.format(Math.round(v));
  const entero = Math.abs(v - Math.round(v)) < 1e-9;
  return entero ? nf0.format(v) : nf2.format(v);
}

/** Valor numérico → texto para editar con foco ("12523000" · "1250,5"). */
export function rawMoneyInput(value, currency = 'CLP') {
  if (value === null || value === undefined || value === '') return '';
  const v = Number(value);
  if (!isFinite(v)) return '';
  if (currency !== 'USD') return String(Math.round(v));
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

/** "12 oct 2026" (o "12 oct 2026, 14:35" con `hora`). */
export function fmtDateLarga(dateStr, { hora = false } = {}) {
  const d = aFecha(dateStr);
  if (!d) return dateStr ? String(dateStr) : '—';
  const base = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/ de /g, ' ');
  if (!hora) return base;
  return `${base}, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** "hace 5 min" · "hace 2 h" · "ayer" · "hace 3 días" · "12 oct 2026". */
export function fmtRelativo(dateStr, ahora = Date.now()) {
  const d = aFecha(dateStr);
  if (!d) return '';
  const diff = ahora - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.round(hrs / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return fmtDateLarga(d);
}

/** Tamaño de archivo legible: "1,2 MB". */
export function fmtBytes(bytes) {
  const b = Number(bytes);
  if (!isFinite(b) || b < 0) return '—';
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${fmtNumero(kb, kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${fmtNumero(mb, mb < 10 ? 1 : 0)} MB`;
  return `${fmtNumero(mb / 1024, 1)} GB`;
}

/** Iniciales (máx. 2) para avatares: "Alberto Lathrop Vicuña" → "AL". */
export function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '·';
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

function aFecha(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v);
  let d = new Date(s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s);
  if (isNaN(d)) d = new Date(s);
  return isNaN(d) ? null : d;
}
