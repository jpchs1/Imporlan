import { fmtDateLarga } from '../../../shared/lib/format';

/** Fecha desde 'YYYY-MM-DD HH:MM:SS' o ISO; null si no se puede. */
export function aFecha(v) {
  if (!v) return null;
  const s = String(v);
  let d = new Date(s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s);
  if (isNaN(d)) d = new Date(s);
  return isNaN(d) ? null : d;
}

/** "14:35" */
export function fmtHora(ts) {
  const d = aFecha(ts);
  return d ? d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Para la lista: hora si es hoy, "Ayer", o "12 oct 2026". */
export function fmtCuando(ts) {
  const d = aFecha(ts);
  if (!d) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return fmtHora(ts);
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return fmtDateLarga(d);
}

/** Separador de fecha en el hilo: "Hoy" · "Ayer" · "lunes 12 de octubre". */
export function fmtSeparador(ts) {
  const d = aFecha(ts);
  if (!d) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** El chat guarda `message`/`timestamp`; el widget viejo leía `message_text`/`created_at`. */
export function textoDe(msg) { return msg?.message ?? msg?.message_text ?? ''; }
export function fechaDe(msg) { return msg?.timestamp ?? msg?.created_at ?? null; }

export function nombreConversacion(conv) {
  return conv?.assigned_to_name || 'Equipo Imporlan';
}

/** Mensajes agrupados por día y con el avatar solo en el primer mensaje de cada remitente. */
export function agruparMensajes(messages) {
  const grupos = [];
  let ultimoDia = '';
  let ultimoRemitente = '';
  for (const msg of messages) {
    const d = aFecha(fechaDe(msg));
    const claveDia = d ? d.toDateString() : '';
    if (claveDia !== ultimoDia) {
      grupos.push({ type: 'date', date: fechaDe(msg), key: `d-${grupos.length}` });
      ultimoDia = claveDia;
      ultimoRemitente = '';
    }
    grupos.push({ type: 'msg', msg, showAvatar: msg.sender_role !== ultimoRemitente, key: `m-${msg.id}` });
    ultimoRemitente = msg.sender_role;
  }
  return grupos;
}
