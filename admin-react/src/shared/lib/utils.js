import { statusMeta, TONE_CLASSES } from './status';

export function fmtCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount || 0);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Clases de color para un estado (compatibilidad con las páginas que las
 * pegan en `Badge className`). Delegan en status.js: mismo tono en todo el
 * sistema. Para código nuevo usar `<StatusBadge kind status />`.
 */
export function statusColor(status, kind = 'auto') {
  return TONE_CLASSES[statusMeta(kind, status).tone] || TONE_CLASSES.neutral;
}

/**
 * Nombre del estado en castellano. Delegado en status.js (`statusMeta`), que es
 * la única tabla de estados del sistema. `kind` es opcional ('expediente',
 * 'pago', 'barco', …); sin él se busca en todas las tablas.
 */
export function statusLabel(status, kind = 'auto') {
  return statusMeta(kind, status).label;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Descarga un CSV (con BOM para que Excel respete los acentos) a partir de
 * filas y columnas `{ header, value(row) }`. Neutraliza fórmulas de Excel.
 */
export function downloadCSV(filename, columns, rows) {
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map(c => esc(c.header)).join(',')]
    .concat(rows.map(r => columns.map(c => esc(c.value(r))).join(',')));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fecha comparable (ms) desde 'YYYY-MM-DD HH:MM:SS' o 'd M Y'; 0 si no se puede. */
export function dateValue(str) {
  if (!str) return 0;
  const t = new Date(String(str).replace(' ', 'T')).getTime();
  if (!isNaN(t)) return t;
  const t2 = Date.parse(str);
  return isNaN(t2) ? 0 : t2;
}

/** Decodifica entidades HTML (el chat guarda los mensajes escapados). */
export function decodeHtml(s) {
  if (!s) return '';
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

/** Tipo de compra legible. */
export function purchaseTypeLabel(type) {
  return { plan: 'Plan', link: 'Cotización link', cotizacion: 'Cotización', pago_directo: 'Pago directo' }[type] || type || '-';
}

/**
 * Medio de pago legible.
 *
 * El panel del cliente mostraba la clave de la base con los guiones cambiados
 * por espacios: "mercadopago", "transferencia bancaria". El cliente leía el
 * nombre interno de un sistema, no el de la empresa por la que acaba de pagar.
 *
 * La clave se normaliza porque llega escrita de varias formas según quién la
 * grabe, y lo que no reconocemos se muestra legible — nunca con guiones bajos.
 */
export function paymentMethodLabel(m) {
  const clave = (m || '').toString().toLowerCase().trim();
  const map = {
    webpay: 'WebPay', transbank: 'WebPay',
    mercadopago: 'Mercado Pago', mercado_pago: 'Mercado Pago',
    paypal: 'PayPal',
    transferencia_bancaria: 'Transferencia', transferencia: 'Transferencia',
    bank_transfer: 'Transferencia',
    efectivo: 'Efectivo', manual: 'Registrado por Imporlan',
  };
  if (map[clave]) return map[clave];
  return clave ? clave.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : '-';
}

/** Estados de compra que representan dinero efectivamente recibido. */
export const PAID_STATUSES = ['paid', 'active', 'completed', 'expired'];
