/**
 * El reporte de la inspección en español, fuera del visor: la URL del
 * original y «Descargar en PDF» (un HTML imprimible con la marca Imporlan que
 * se abre en un iframe oculto y dispara el diálogo de impresión; el navegador
 * ofrece «Guardar como PDF»). Lo usa ReporteEspanol y quien quiera enlazar el
 * original sin abrir el visor.
 */
import { fmtDateLarga } from './format';
import { trozosNegrita } from './inspeccion';

/** En producción el original se sirve desde el sitio; en dev, igual que el resto del panel (relativo). */
export const ORIGEN_PRODUCCION = 'https://www.imporlan.cl';

export function urlOriginal(original) {
  const u = String(original?.download_url || '');
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return (import.meta.env.PROD ? ORIGEN_PRODUCCION : '') + u;
}


/* ---------------------------------------------------------------------------
   Descargar en PDF: un HTML imprimible con la marca Imporlan (título, lancha,
   expediente, fecha, aviso de traducción) que se abre en un iframe oculto y
   dispara el diálogo de impresión. El navegador ofrece «Guardar como PDF».
   Todo el texto va escapado; la negrita se vuelve <strong> trozo a trozo.
   --------------------------------------------------------------------------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function conNegrita(x) {
  return trozosNegrita(x).map(p => (p.strong ? `<strong>${esc(p.x)}</strong>` : esc(p.x))).join('');
}

const MARCA_SVG = '<svg viewBox="0 0 36 36" width="28" height="28" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 31c1 .8 2 1.5 4 1.5 3.5 0 3.5-3 7-3 2 0 3 .7 4 1.5 1 .8 2 1.5 4 1.5 3.5 0 3.5-3 7-3 2 0 3 .7 4 1.5"/><path d="M29 29.5A17 17 0 0 0 31.5 20L18 14 4.5 20a17 17 0 0 0 4 11.5"/><path d="M28 19V10a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v9"/><path d="M18 14v6"/></g></svg>';

const CSS_IMPRESION = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #f1f5f9; color: #334155; font: 11pt/1.55 "Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .hoja { background: #fff; max-width: 190mm; margin: 24px auto; padding: 18mm 16mm 16mm; box-shadow: 0 1px 3px rgba(15,23,42,.12); }
  .marca { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #0e7490; }
  .marca .logo { display: flex; align-items: center; gap: 10px; color: #0e7490; font-weight: 700; font-size: 14pt; letter-spacing: .04em; }
  .marca .logo small { display: block; font-weight: 500; font-size: 8.5pt; letter-spacing: .08em; color: #64748b; text-transform: uppercase; }
  .marca .tipo { text-align: right; font-size: 9pt; color: #64748b; line-height: 1.4; }
  .marca .tipo strong { display: block; color: #0f172a; font-size: 10pt; }
  h1 { margin: 22px 0 4px; font-size: 20pt; line-height: 1.2; color: #0f172a; }
  .meta { margin: 0; font-size: 9.5pt; color: #64748b; }
  .aviso { margin: 16px 0 22px; padding: 10px 12px; border: 1px solid #bae6fd; border-left: 4px solid #0e7490; background: #f0f9ff; border-radius: 6px; font-size: 9.5pt; color: #334155; }
  .aviso strong { color: #0f172a; }
  .lo-que-vemos { margin: 0 0 20px; padding: 12px 14px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; }
  .lo-que-vemos .eyebrow { margin: 0 0 4px; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #64748b; font-weight: 600; }
  .lo-que-vemos p { margin: 0; white-space: pre-line; }
  .cuerpo h2 { margin: 22px 0 8px; font-size: 15pt; line-height: 1.25; color: #0f172a; page-break-after: avoid; }
  .cuerpo h3 { margin: 16px 0 6px; font-size: 12pt; color: #0f172a; page-break-after: avoid; }
  .cuerpo h4, .cuerpo h5, .cuerpo h6 { margin: 12px 0 4px; font-size: 11pt; color: #0f172a; page-break-after: avoid; }
  .cuerpo p { margin: 0 0 8px; }
  .cuerpo ul { margin: 0 0 10px; padding-left: 20px; }
  .cuerpo li { margin: 2px 0; }
  .cuerpo strong { color: #0f172a; }
  .cuerpo table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9.5pt; page-break-inside: auto; }
  .cuerpo th, .cuerpo td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  .cuerpo th { background: #f1f5f9; color: #0f172a; font-weight: 600; }
  .cuerpo tr { page-break-inside: avoid; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; gap: 12px; font-size: 8.5pt; color: #64748b; }
  @page { size: A4; margin: 14mm 12mm; }
  @media screen and (max-width: 760px) {
    body { background: #fff; }
    .hoja { margin: 0; padding: 20px 16px; box-shadow: none; }
    .marca { flex-direction: column; align-items: flex-start; }
    .marca .tipo { text-align: left; }
    .cuerpo table { display: block; overflow-x: auto; max-width: 100%; }
  }
  @media print {
    body { background: #fff; }
    .hoja { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  }
`;

/** El HTML completo e imprimible del reporte en español (exportado para probarlo). */
export function htmlReporteImprimible(data) {
  const d = data || {};
  const es = d.es || {};
  const rep = d.reporte || {};
  const titulo = esc(d.titulo || 'Lancha elegida');
  const exp = esc(d.order_number || '');
  const resumen = String(rep.summary || '').trim();
  const partes = [
    rep.at ? `Reporte del ${esc(fmtDateLarga(rep.at))}` : '',
    es.at ? `Traducido el ${esc(fmtDateLarga(es.at))}` : '',
    d.original?.original_name ? `Original: ${esc(d.original.original_name)}` : '',
  ].filter(Boolean);
  const cuerpo = (es.bloques || []).map(b => {
    if (!b || typeof b !== 'object') return '';
    if (b.t === 'h') { const n = Math.min(6, 1 + Math.max(1, Number(b.n) || 1)); return `<h${n}>${conNegrita(b.x)}</h${n}>`; }
    if (b.t === 'p') return `<p>${conNegrita(b.x)}</p>`;
    if (b.t === 'ul') return `<ul>${(b.items || []).map(it => `<li>${conNegrita(it)}</li>`).join('')}</ul>`;
    if (b.t === 'table') {
      const [cab, ...filas] = Array.isArray(b.rows) ? b.rows : [];
      if (!cab) return '';
      return `<table><thead><tr>${cab.map(c => `<th scope="col">${conNegrita(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${cab.map((_, j) => `<td>${conNegrita(f?.[j] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return '';
  }).join('\n');
  const hoy = esc(fmtDateLarga(new Date().toISOString(), { hora: true }));
  return `<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte de inspección en español · ${titulo}${exp ? ` · ${exp}` : ''}</title>
<style>${CSS_IMPRESION}</style>
</head>
<body>
<main class="hoja">
  <div class="marca">
    <div class="logo">${MARCA_SVG}<span>IMPORLAN<small>Importación de embarcaciones</small></span></div>
    <div class="tipo"><strong>Reporte de inspección técnica</strong>Traducción al español${exp ? ` · Expediente ${exp}` : ''}</div>
  </div>
  <h1>${titulo}</h1>
  ${partes.length ? `<p class="meta">${partes.join(' · ')}</p>` : ''}
  <div class="aviso"><strong>Traducción automática</strong> del reporte original, que está en inglés, hecha para que lo leas con comodidad. Si hay alguna diferencia, vale el original.</div>
  ${resumen ? `<section class="lo-que-vemos"><p class="eyebrow">Lo que vemos en el reporte · equipo Imporlan</p><p>${esc(resumen)}</p></section>` : ''}
  <section class="cuerpo">
${cuerpo}
  </section>
  <footer><span>Imporlan · www.imporlan.cl · contacto@imporlan.cl</span><span>Generado el ${hoy}</span></footer>
</main>
</body>
</html>`;
}

export const ATRIBUTO_IFRAME_IMPRESION = 'data-reporte-imprimir';

/**
 * Abre el diálogo de impresión con el reporte en español desde un iframe
 * oculto (sin ventanas nuevas: no lo frena el bloqueador de popups y no toca
 * el panel). El iframe se quita al terminar de imprimir.
 */
export function imprimirReporte(data) {
  if (typeof document === 'undefined') return null;
  document.querySelector(`iframe[${ATRIBUTO_IFRAME_IMPRESION}]`)?.remove();
  const f = document.createElement('iframe');
  f.setAttribute(ATRIBUTO_IFRAME_IMPRESION, '1');
  f.setAttribute('title', 'Reporte de inspección para imprimir');
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
  let quitado = false;
  const quitar = () => { if (quitado) return; quitado = true; f.remove(); };
  f.addEventListener('load', () => {
    const w = f.contentWindow;
    if (!w) return quitar();
    try {
      w.addEventListener('afterprint', () => setTimeout(quitar, 300));
      w.focus();
      w.print();
    } catch {
      quitar();
    }
    // Por si el navegador no avisa `afterprint` (o la impresión se cancela sin evento).
    setTimeout(quitar, 120000);
  });
  f.srcdoc = htmlReporteImprimible(data);
  document.body.appendChild(f);
  return f;
}

