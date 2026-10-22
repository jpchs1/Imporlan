import { useMemo } from 'react';
import { cn } from '../lib/utils';
import { fmtDateLarga, fmtBytes } from '../lib/format';
import { Drawer } from './Drawer';
import { Button } from './Button';
import { Callout } from './Callout';
import { ErrorState } from './ErrorState';
import { Skeleton, Spinner } from './Skeleton';
import { Download, ExternalLink, Languages } from './Icons';

/**
 * Visor del reporte de inspección en español (lo comparten el panel del
 * cliente y el admin). Versión mínima del admin: el integrador se queda con la
 * del cliente, que cumple este mismo contrato.
 *
 *   <ReporteEspanol open onClose data={GET del reporte | null}
 *                   loading error onRetry footer={nodo opcional} />
 *
 * `data` es la respuesta de user_/admin_inspeccion_reporte:
 *   { titulo, order_number, stage, reporte: {at, file_id, summary, es_status, es_at},
 *     original: {id, original_name, file_size, download_url} | null,
 *     es: {status, at, bloques, error} }
 * Los bloques: {t:'h', n, x} · {t:'p', x} · {t:'ul', items} · {t:'table', rows}.
 * El texto trae `**negrita**`: se pinta como <strong>, nunca como HTML.
 */
const ORIGEN = 'https://www.imporlan.cl';

/** Las URL relativas del original (enlace firmado) se completan en producción. */
function urlOriginal(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return import.meta.env.PROD ? `${ORIGEN}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

/** «texto **en negrita** más texto» → nodos React (sin HTML). */
function conNegritas(texto) {
  const partes = String(texto ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return partes.map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

function Bloque({ b }) {
  if (b.t === 'h') {
    const n = Number(b.n) || 2;
    const cls = n === 1 ? 'text-lg font-semibold text-ink-900 mt-6 first:mt-0' : n === 2 ? 'text-base font-semibold text-ink-900 mt-5 first:mt-0' : 'text-sm font-semibold text-ink-900 mt-4 first:mt-0';
    if (n === 1) return <h3 className={cls}>{conNegritas(b.x)}</h3>;
    if (n === 2) return <h4 className={cls}>{conNegritas(b.x)}</h4>;
    return <h5 className={cls}>{conNegritas(b.x)}</h5>;
  }
  if (b.t === 'ul') {
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm text-ink-700">
        {(b.items || []).map((it, i) => <li key={i}>{conNegritas(it)}</li>)}
      </ul>
    );
  }
  if (b.t === 'table') {
    const [cab, ...filas] = b.rows || [];
    if (!cab) return null;
    return (
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[480px] text-13 border border-line rounded-md overflow-hidden">
          <thead className="bg-canvas">
            <tr>{cab.map((c, i) => <th key={i} scope="col" className="text-left font-semibold text-ink-900 px-2.5 py-1.5 border-b border-line align-top">{conNegritas(c)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filas.map((f, i) => (
              <tr key={i}>{cab.map((_, j) => <td key={j} className="px-2.5 py-1.5 text-ink-700 align-top">{conNegritas(f[j] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p className="text-sm text-ink-700 leading-relaxed">{conNegritas(b.x)}</p>;
}

/* HTML imprimible con la marca Imporlan: el navegador ofrece «Guardar como PDF». */
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function negritasHtml(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
function bloqueHtml(b) {
  if (b.t === 'h') { const n = Math.min(3, Math.max(1, Number(b.n) || 2)) + 1; return `<h${n}>${negritasHtml(b.x)}</h${n}>`; }
  if (b.t === 'ul') return `<ul>${(b.items || []).map(i => `<li>${negritasHtml(i)}</li>`).join('')}</ul>`;
  if (b.t === 'table') {
    const [cab, ...filas] = b.rows || [];
    if (!cab) return '';
    return `<table><thead><tr>${cab.map(c => `<th>${negritasHtml(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${cab.map((_, j) => `<td>${negritasHtml(f[j] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  return `<p>${negritasHtml(b.x)}</p>`;
}
function htmlImprimible(data) {
  const bloques = data?.es?.bloques || [];
  const fecha = data?.reporte?.at ? fmtDateLarga(data.reporte.at) : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de inspección · ${esc(data?.titulo)} · ${esc(data?.order_number)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 11.5pt; line-height: 1.5; margin: 0; }
  header { border-bottom: 2px solid #0e7490; padding-bottom: 10px; margin-bottom: 18px; }
  .marca { font-weight: 800; letter-spacing: .04em; color: #0e7490; font-size: 13pt; }
  h1 { font-size: 17pt; margin: 6px 0 2px; }
  .meta { color: #475569; font-size: 10pt; }
  .aviso { background: #f1f5f9; border-left: 4px solid #94a3b8; padding: 8px 12px; font-size: 10pt; color: #334155; margin: 0 0 18px; }
  h2 { font-size: 14pt; margin: 20px 0 6px; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 16px 0 4px; page-break-after: avoid; }
  h4 { font-size: 11.5pt; margin: 12px 0 4px; page-break-after: avoid; }
  p { margin: 0 0 8px; } ul { margin: 0 0 10px; padding-left: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 12px; font-size: 10pt; page-break-inside: auto; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; } tr { page-break-inside: avoid; }
  footer { margin-top: 24px; color: #64748b; font-size: 9pt; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head><body>
<header><div class="marca">IMPORLAN</div><h1>Reporte de inspección técnica · versión en español</h1>
<div class="meta">${esc(data?.titulo)} · Expediente ${esc(data?.order_number)}${fecha ? ` · Reporte del ${esc(fecha)}` : ''}</div></header>
<p class="aviso">Traducción automática del reporte original en inglés. Si hay diferencias, vale el original.</p>
${bloques.map(bloqueHtml).join('\n')}
<footer>Imporlan · www.imporlan.cl · contacto@imporlan.cl</footer>
</body></html>`;
}

/** Abre el diálogo de impresión desde un iframe oculto (no rompe el panel). */
function imprimirReporte(data) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Reporte de inspección en español, listo para imprimir';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open();
  doc.write(htmlImprimible(data));
  doc.close();
  const quitar = () => setTimeout(() => iframe.remove(), 1000);
  const w = iframe.contentWindow;
  w.onafterprint = quitar;
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* sin impresión: nada que hacer */ } quitar(); }, 250);
}

export default function ReporteEspanol({ open, onClose, data, loading = false, error = null, onRetry, footer }) {
  const es = data?.es || null;
  const status = es?.status ?? data?.reporte?.es_status ?? null;
  const original = data?.original ? { ...data.original, download_url: urlOriginal(data.original.download_url) } : null;
  const bloques = useMemo(() => (Array.isArray(es?.bloques) ? es.bloques : []), [es]);
  const listo = status === 'listo' && bloques.length > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Reporte de la inspección"
      description={data ? `${data.titulo || 'Lancha elegida'} · ${data.order_number || ''}${data.reporte?.at ? ` · cargado el ${fmtDateLarga(data.reporte.at)}` : ''}` : undefined}
      width="xl"
      footer={footer}
      bodyClassName="bg-canvas"
    >
      {loading ? (
        <div className="space-y-4"><Skeleton.Text lines={2} /><Skeleton.Text lines={6} /><Skeleton.Text lines={4} /></div>
      ) : error ? (
        <ErrorState compact title="No pudimos cargar el reporte" message={error} onRetry={onRetry} />
      ) : !data ? null : (
        <div className="space-y-4 max-w-[70ch] mx-auto">
          <Callout tone="neutral" compact icon={Languages}>
            Traducción automática del reporte original en inglés. Si hay diferencias, vale el original.
          </Callout>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={Download} disabled={!listo} onClick={() => imprimirReporte(data)}>Descargar en PDF (español)</Button>
            {original?.download_url ? (
              <a href={original.download_url} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md text-sm font-medium border bg-surface text-ink-700 border-line-strong hover:bg-canvas hover:border-ink-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                <ExternalLink size={16} className="shrink-0" />Ver original (inglés)
                {original.file_size ? <span className="text-xs text-ink-500">· {fmtBytes(original.file_size)}</span> : null}
              </a>
            ) : (
              <Button variant="secondary" icon={ExternalLink} disabled>Ver original (inglés)</Button>
            )}
          </div>

          {data.reporte?.summary ? (
            <section aria-labelledby="rep-resumen" className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
              <h3 id="rep-resumen" className="eyebrow mb-1">Lo que vemos en el reporte</h3>
              <p className="text-sm text-ink-700 whitespace-pre-wrap break-words">{data.reporte.summary}</p>
            </section>
          ) : null}

          {status === 'pendiente' && (
            <div className="rounded-lg border border-line bg-surface px-4 py-6 text-center" role="status">
              <Spinner size="md" label="Traduciendo el reporte" />
              <p className="text-sm font-medium text-ink-900 mt-3">Estamos traduciendo el reporte al español</p>
              <p className="text-13 text-ink-500 mt-1">Suele tardar unos minutos. Mientras, puedes ver el original en inglés.</p>
            </div>
          )}
          {status === 'error' && (
            <Callout tone="warning" compact title="La versión en español va a tardar un poco más">
              Mientras, puedes ver el original en inglés{es?.error ? <> · <span className="text-ink-500">{es.error}</span></> : null}.
              {onRetry && <div className="mt-2"><Button size="sm" variant="secondary" onClick={onRetry}>Reintentar la traducción</Button></div>}
            </Callout>
          )}
          {status === 'listo' && (
            <article lang="es" className={cn('rounded-lg border border-line bg-surface px-4 sm:px-6 py-5 space-y-3')} aria-label="Reporte traducido al español">
              {bloques.length ? bloques.map((b, i) => <Bloque key={i} b={b} />) : <p className="text-sm text-ink-500">La traducción llegó vacía. Revisa el original.</p>}
              {es?.at && <p className="text-xs text-ink-500 pt-2 border-t border-line">Traducido el {fmtDateLarga(es.at, { hora: true })}</p>}
            </article>
          )}
        </div>
      )}
    </Drawer>
  );
}
