// Lee y envía correo de contacto@imporlan.cl. Lo corre .github/workflows/correo.yml.
//
// El agente de Claude en la nube no llega a mail.imporlan.cl (su contenedor
// sólo sale por HTTPS/443; los puertos 993 y 465 están cortados). El runner de
// GitHub sí tiene red, así que el agente dispara el workflow por la API de
// GitHub y el runner habla IMAP/SMTP. Es el mismo camino que usa tourevo-cl
// para llegar a su servidor (correr-script-vps.yml).
//
// Entradas, todas por variables de entorno (el workflow nunca las mete en un
// comando de shell):
//   ACCION      leer | enviar
//   CARPETA     entrada | enviados              (leer)
//   DE          dirección o dominio del remitente (leer, opcional)
//   PARA        dirección del destinatario        (leer, opcional)
//   ASUNTO      texto dentro del asunto          (leer, opcional)
//   DESDE       YYYY-MM-DD, por defecto hace 7 días (leer)
//   LIMITE      1-50, por defecto 10               (leer)
//   DATOS       base64 de un JSON {to, subject, text, cc?, inReplyTo?, references?} (enviar)
//   MAIL_HOST, MAIL_USER, MAIL_PASS, IMAP_PORT, SMTP_PORT  (secrets)
//
// `leer` no marca nada como leído ni escribe en el buzón.

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

const env = process.env;
const HOST = env.MAIL_HOST || 'mail.imporlan.cl';
const USER = env.MAIL_USER || 'contacto@imporlan.cl';
const PASS = env.MAIL_PASS || '';
const IMAP_PORT = Number(env.IMAP_PORT || 993);
const SMTP_PORT = Number(env.SMTP_PORT || 465);
const FROM_NAME = 'Imporlan';

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const FILTRO = /^[A-Za-z0-9._%+@-]{1,100}$/;

function fallar(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function conImap(fn) {
  const c = new ImapFlow({
    host: HOST, port: IMAP_PORT, secure: IMAP_PORT === 993,
    auth: { user: USER, pass: PASS }, logger: false,
  });
  await c.connect();
  try { return await fn(c); } finally { await c.logout().catch(() => {}); }
}

async function carpetaEnviados(c) {
  return (await c.list()).find((f) => f.specialUse === '\\Sent')?.path || 'INBOX.Sent';
}

async function leer() {
  const filtros = {};
  if (env.DE) { if (!FILTRO.test(env.DE)) fallar('DE inválido'); filtros.from = env.DE; }
  if (env.PARA) { if (!FILTRO.test(env.PARA)) fallar('PARA inválido'); filtros.to = env.PARA; }
  if (env.ASUNTO) { if (env.ASUNTO.length > 120) fallar('ASUNTO muy largo'); filtros.subject = env.ASUNTO; }
  let desde = new Date(Date.now() - 7 * 864e5);
  if (env.DESDE) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(env.DESDE)) fallar('DESDE debe ser YYYY-MM-DD');
    desde = new Date(`${env.DESDE}T00:00:00Z`);
  }
  filtros.since = desde;
  const limite = Math.min(Math.max(Number(env.LIMITE || 10) || 10, 1), 50);

  await conImap(async (c) => {
    const carpeta = env.CARPETA === 'enviados' ? await carpetaEnviados(c) : 'INBOX';
    const lock = await c.getMailboxLock(carpeta, { readOnly: true });
    try {
      const uids = (await c.search(filtros, { uid: true })) || [];
      const elegidos = uids.slice(-limite).reverse();
      console.log(`Carpeta ${carpeta} · ${uids.length} correo(s) desde ${desde.toISOString().slice(0, 10)} · mostrando ${elegidos.length}\n`);
      for (const uid of elegidos) {
        const m = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
        if (!m) continue;
        const p = await simpleParser(m.source);
        console.log('='.repeat(72));
        console.log(`UID:        ${uid}`);
        console.log(`Fecha:      ${p.date?.toISOString()}`);
        console.log(`De:         ${p.from?.text || ''}`);
        console.log(`Para:       ${p.to?.text || ''}`);
        if (p.cc) console.log(`CC:         ${p.cc.text}`);
        console.log(`Asunto:     ${p.subject || ''}`);
        console.log(`Message-ID: ${p.messageId || ''}`);
        if (p.references) console.log(`References: ${[].concat(p.references).join(' ')}`);
        console.log(`Leído:      ${m.flags?.has('\\Seen') ? 'sí' : 'no'}`);
        const adj = (p.attachments || []).map((a) => `${a.filename || '(sin nombre)'} (${a.contentType}, ${a.size} B)`);
        if (adj.length) console.log(`Adjuntos:   ${adj.join('; ')}`);
        console.log('-'.repeat(72));
        console.log((p.text || '(sin texto plano)').trim().slice(0, 15000));
        console.log();
      }
    } finally { lock.release(); }
  });
}

async function enviar() {
  let d;
  try { d = JSON.parse(Buffer.from(env.DATOS || '', 'base64').toString('utf8')); } catch { fallar('DATOS no es base64 de un JSON'); }
  const destinos = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const to = destinos(d.to);
  const cc = destinos(d.cc);
  if (!to.length) fallar('falta "to"');
  for (const x of [...to, ...cc]) if (!EMAIL.test(x)) fallar(`dirección inválida: ${x}`);
  if (!d.subject || typeof d.subject !== 'string') fallar('falta "subject"');
  if (!d.text || typeof d.text !== 'string') fallar('falta "text"');

  const mail = {
    from: { name: FROM_NAME, address: USER },
    to, cc: cc.length ? cc : undefined,
    subject: d.subject, text: d.text,
    inReplyTo: d.inReplyTo || undefined,
    references: d.references || d.inReplyTo || undefined,
  };
  const t = nodemailer.createTransport({ host: HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: USER, pass: PASS } });
  const info = await t.sendMail(mail);
  console.log(`Enviado · Message-ID ${info.messageId} · aceptados: ${info.accepted.join(', ')} · rechazados: ${info.rejected.join(', ') || 'ninguno'}`);

  // Copia en Enviados para que quede en el webmail igual que un correo escrito a mano.
  try {
    const raw = await new MailComposer({ ...mail, messageId: info.messageId, date: new Date() }).compile().build();
    const carpeta = await conImap(async (c) => { const s = await carpetaEnviados(c); await c.append(s, raw, ['\\Seen']); return s; });
    console.log(`Copia guardada en ${carpeta}`);
  } catch (e) {
    console.log(`AVISO: se envió, pero no se pudo guardar copia en Enviados (${e.message})`);
  }
  if (info.rejected.length) process.exit(1);
}

if (!PASS) fallar('falta el secret IMPORLAN_MAIL_PASS');
if (env.ACCION === 'leer') await leer();
else if (env.ACCION === 'enviar') await enviar();
else fallar('ACCION debe ser leer o enviar');
