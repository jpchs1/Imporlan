import { sendQuoteBreakdown } from './api';

function fmtClp(n) {
  return '$ ' + Math.round(n || 0).toLocaleString('es-CL');
}

// «Enviar desglose»: el All-Inclusive por etapa, sin mostrar el FEE. No va por
// defecto; JP lo manda a mano a quien lo pida, desde la fila del link o desde
// la ventana de cotización. Primero se pide la vista previa al servidor y se
// confirma con los montos exactos y el destinatario; el envío lleva de vuelta
// la revisión, así que si la cotización cambió entremedio no sale nada.
// Devuelve el email al que se mandó, o null si se canceló.
export async function enviarDesglose(linkId) {
  const p = await sendQuoteBreakdown(linkId);
  const lineas = (p.etapas || []).map((e, i) => `${i + 1}. ${e.label}: ${fmtClp(e.clp)}`).join('\n');
  if (!confirm(`Enviar el desglose a ${p.email}:\n\n${lineas}\n\nServicio All-Inclusive: ${fmtClp(p.all_inclusive)}\n\nSe usa la cotización guardada (no los cambios sin guardar). ¿Enviar?`)) return null;
  await sendQuoteBreakdown(linkId, p.revision);
  return p.email;
}
