import { Fragment, useMemo } from 'react';
import { cn } from '../lib/utils';
import { fmtDateLarga } from '../lib/format';
import { trozosNegrita } from '../lib/inspeccion';
import { urlOriginal, imprimirReporte } from '../lib/reporte-inspeccion';
import { Modal } from './Modal';
import { Button } from './Button';
import { ErrorState } from './ErrorState';
import { Skeleton, Spinner } from './Skeleton';
import { FileDown, ExternalLink, Languages, Clock, TriangleAlert } from './Icons';

/**
 * El reporte de la inspección técnica, en español. Lo usan los dos paneles:
 * el cliente para leerlo y decidir, el equipo para ver lo que el cliente ve.
 *
 *   <ReporteEspanol
 *     open={bool} onClose={fn}
 *     data={la respuesta del GET de reporte | null}   // {titulo, order_number, reporte, original, es: {status, at, bloques, error}}
 *     loading={bool} error={string|null} onRetry={fn}
 *     footer={nodo opcional}                           // el cliente pone aquí los botones de decidir; el admin nada
 *   />
 *
 * Dentro van el aviso de traducción automática, «Descargar en PDF (español)»
 * (un HTML imprimible con la marca, en un iframe oculto: el navegador ofrece
 * «Guardar como PDF») y «Ver original (inglés)» (el PDF, pestaña nueva), más
 * los estados de la traducción: pendiente (se está traduciendo), error
 * (calmado: ver el original o escribir al agente) y listo.
 *
 * Los bloques vienen del servidor (impMarkdownABloques): {t:'h', n, x} ·
 * {t:'p', x} · {t:'ul', items} · {t:'table', rows} (la primera fila es el
 * encabezado). El texto puede traer **negrita**: se pinta con <strong>, nunca
 * como HTML.
 */

/**
 * «Ver original (inglés)»: el PDF en una pestaña nueva. Es un <a> con aspecto
 * de botón secundario (Ctrl+clic, lector de pantalla), no un window.open.
 */
function VerOriginal({ original, className }) {
  const href = urlOriginal(original);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-13 font-medium text-ink-700 no-underline select-none',
        'transition-colors duration-150 hover:border-ink-400 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className,
      )}
    >
      <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
      Ver original (inglés)
    </a>
  );
}

/** Trozos con **negrita** → nodos React. */
function Texto({ x }) {
  return trozosNegrita(x).map((p, i) => (p.strong ? <strong key={i} className="font-semibold text-ink-900">{p.x}</strong> : <Fragment key={i}>{p.x}</Fragment>));
}

/** Nivel HTML de cada título: el más alto del reporte queda justo bajo el título del visor (h2 → h3). */
function nivelesDe(bloques) {
  const ns = (bloques || []).filter(b => b?.t === 'h').map(b => Number(b.n) || 1);
  const min = ns.length ? Math.min(...ns) : 1;
  return (n) => Math.min(6, 3 + Math.max(0, (Number(n) || 1) - min));
}

const TITULO = {
  3: 'mt-8 text-xl font-semibold leading-7 text-ink-900 first:mt-0',
  4: 'mt-6 text-base font-semibold leading-6 text-ink-900 first:mt-0',
  5: 'mt-4 text-sm font-semibold leading-5 text-ink-900 first:mt-0',
  6: 'mt-3 text-sm font-medium leading-5 text-ink-900 first:mt-0',
};

/** La traducción bien tipografiada: títulos, párrafos, listas y tablas con scroll horizontal propio. */
export function BloquesReporte({ bloques, className }) {
  const nivel = useMemo(() => nivelesDe(bloques), [bloques]);
  return (
    <div className={cn('min-w-0', className)}>
      {(bloques || []).map((b, i) => {
        if (!b || typeof b !== 'object') return null;
        if (b.t === 'h') {
          const Tag = `h${nivel(b.n)}`;
          return <Tag key={i} className={TITULO[nivel(b.n)]}><Texto x={b.x} /></Tag>;
        }
        if (b.t === 'p') return <p key={i} className="mt-3 text-sm leading-6 text-ink-700 first:mt-0"><Texto x={b.x} /></p>;
        if (b.t === 'ul') {
          return (
            <ul key={i} className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-700 marker:text-ink-400 first:mt-0">
              {(b.items || []).map((it, j) => <li key={j} className="pl-0.5"><Texto x={it} /></li>)}
            </ul>
          );
        }
        if (b.t === 'table') {
          const [cab, ...filas] = Array.isArray(b.rows) ? b.rows : [];
          if (!cab) return null;
          return (
            <div key={i} className="mt-4 overflow-x-auto rounded-md border border-line scrollbar-thin first:mt-0">
              <table className="w-full min-w-[32rem] border-collapse text-13">
                <thead className="bg-canvas">
                  <tr>{cab.map((c, j) => <th key={j} scope="col" className="px-3 py-2 text-left align-bottom font-semibold text-ink-900"><Texto x={c} /></th>)}</tr>
                </thead>
                <tbody>
                  {filas.map((fila, r) => (
                    <tr key={r} className="border-t border-line">
                      {cab.map((_, j) => <td key={j} className="px-3 py-2 align-top leading-5 text-ink-700"><Texto x={fila?.[j] ?? ''} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   El visor
   --------------------------------------------------------------------------- */
function Pendiente({ original }) {
  return (
    <div role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-5 py-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand-600 shadow-card">
        <Spinner inline size="md" label="Traduciendo" className="text-brand-600" />
      </span>
      <p className="mt-4 text-base font-semibold text-ink-900">Estamos traduciendo el reporte al español</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-700">Suele tardar unos minutos. Esta ventana se actualiza sola; mientras, puedes ver el original en inglés.</p>
      <VerOriginal original={original} className="mt-4" />
    </div>
  );
}

function Tardando({ original, detalle }) {
  return (
    <div role="status" className="rounded-lg border border-line bg-canvas px-5 py-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-warning shadow-card" aria-hidden="true"><Clock size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink-900">La versión en español va a tardar un poco más</p>
          <p className="mt-1 text-sm text-ink-700">Mientras, puedes ver el original en inglés o escribirle a tu agente: te ayuda con lo que no se entienda.</p>
          {detalle && <p className="mt-2 text-xs text-ink-500"><TriangleAlert size={12} className="mr-1 inline-block align-[-2px]" aria-hidden="true" />{detalle}</p>}
          <VerOriginal original={original} className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export default function ReporteEspanol({ open, onClose, data, loading = false, error = null, onRetry, footer }) {
  const es = data?.es || null;
  const estado = es?.status || data?.reporte?.es_status || null;
  const original = data?.original || null;
  const listo = estado === 'listo' && Array.isArray(es?.bloques) && es.bloques.length > 0;
  const resumen = String(data?.reporte?.summary || '').trim();
  const descripcion = data
    ? [data.titulo, data.order_number ? `Expediente ${data.order_number}` : '', data.reporte?.at ? `reporte del ${fmtDateLarga(data.reporte.at)}` : ''].filter(Boolean).join(' · ')
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Reporte de la inspección técnica"
      description={descripcion}
      footer={footer}
      bodyClassName="bg-surface"
    >
      <div className="mx-auto w-full max-w-[44rem]">
        {loading && !data && (
          <div aria-busy="true" aria-label="Cargando el reporte">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton.Text lines={2} className="mt-6" />
            <Skeleton className="mt-6 h-6 w-2/3" />
            <Skeleton.Text lines={5} className="mt-3" />
            <Skeleton className="mt-6 h-6 w-1/2" />
            <Skeleton.Text lines={4} className="mt-3" />
          </div>
        )}

        {!loading && error && !data && (
          <ErrorState compact title="No pudimos abrir el reporte" message="Vuelve a intentarlo en unos segundos. Si sigue fallando, escríbele a tu agente." detail={error} onRetry={onRetry} />
        )}

        {data && (
          <>
            {/* Aviso + acciones. Es una traducción automática: si hay diferencias, vale el original. */}
            <div className="flex flex-col gap-3 rounded-lg border border-info-line bg-info-bg px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="flex items-start gap-2.5 text-13 text-ink-700">
                <Languages size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
                <span><span className="font-semibold text-ink-900">Traducción automática</span> del reporte original, que está en inglés. Si hay alguna diferencia, vale el original.</span>
              </p>
              <div className="flex flex-wrap gap-2 lg:shrink-0">
                <Button variant="secondary" size="sm" icon={FileDown} disabled={!listo} onClick={() => imprimirReporte(data)} title={listo ? undefined : 'Disponible cuando esté la traducción'}>
                  Descargar en PDF (español)
                </Button>
                <VerOriginal original={original} />
              </div>
            </div>

            {resumen && (
              <section aria-labelledby="reporte-lo-que-vemos" className="mt-5 rounded-lg border border-line bg-canvas px-4 py-3">
                <h3 id="reporte-lo-que-vemos" className="eyebrow">Lo que vemos en el reporte · equipo Imporlan</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-700">{resumen}</p>
              </section>
            )}

            <div className="mt-6">
              {listo ? (
                <>
                  <BloquesReporte bloques={es.bloques} />
                  <p className="mt-8 border-t border-line pt-3 text-xs text-ink-500">
                    {es.at ? `Traducido el ${fmtDateLarga(es.at, { hora: true })}` : 'Traducción automática'}
                    {original?.original_name ? ` · Original: ${original.original_name}` : ''}
                  </p>
                </>
              ) : estado === 'error' || estado === 'listo' ? (
                <Tardando original={original} detalle={es?.error || (estado === 'listo' ? 'La traducción llegó vacía.' : null)} />
              ) : (
                <Pendiente original={original} />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
