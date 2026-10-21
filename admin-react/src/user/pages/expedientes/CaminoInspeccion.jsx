import { cn } from '../../../shared/lib/utils';
import { Badge } from '../../../shared/components/UI';
import { ClipboardCheck, CircleCheck, TriangleAlert } from '../../../shared/components/Icons';
import { CAMINO_INSPECCION } from '../../../shared/lib/inspeccion';

const RESULTADOS = [
  { ...CAMINO_INSPECCION.apta, icono: CircleCheck, tono: 'success' },
  { ...CAMINO_INSPECCION.no_apta, icono: TriangleAlert, tono: 'warning' },
];

const TARJETA = {
  success: 'border-success-line bg-success-bg',
  warning: 'border-warning-line bg-warning-bg',
};
const ICONO = {
  success: 'text-success',
  warning: 'text-warning',
};

/**
 * El camino de la inspección técnica, dibujado: Inspección → «Apta: avanzamos
 * con la compra (Pago 2)» / «No apta: te ahorraste un problema; eliges otra
 * lancha o te lo devolvemos». Los textos salen de CAMINO_INSPECCION, los
 * mismos que usa el avance.
 *
 * Desde `sm` es un árbol horizontal (nodo a la izquierda, horquilla, dos
 * resultados a la derecha); en móvil, vertical (nodo arriba y los resultados
 * colgando de una línea). Las líneas son cajas con fondo `line-strong`, nada
 * de SVG. Todo decorativo va `aria-hidden`; el orden de lectura es el del DOM.
 *
 *   <CaminoInspeccion />                 // completo (asistente)
 *   <CaminoInspeccion compacto />        // dos líneas con ícono (avance)
 */
export default function CaminoInspeccion({ compacto = false, className }) {
  if (compacto) {
    return (
      <ul className={cn('space-y-1', className)} aria-label="Qué pasa según el resultado de la inspección">
        {RESULTADOS.map(r => {
          const Icono = r.icono;
          return (
            <li key={r.id} className="flex items-start gap-2 text-13 text-ink-700">
              <Icono size={14} className={cn('mt-0.5 shrink-0', ICONO[r.tono])} aria-hidden="true" />
              <span><span className="font-medium text-ink-900">{r.label}:</span> {r.corto}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div
      role="group"
      aria-label="Qué pasa según el resultado de la inspección"
      className={cn('sm:grid sm:grid-cols-[minmax(0,15rem)_2.5rem_minmax(0,1fr)] sm:items-stretch', className)}
    >
      {/* Nodo: la inspección. Centrado verticalmente en escritorio para que la
          línea salga de su mitad. */}
      <div className="flex sm:items-center">
        <div className="flex w-full items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white" aria-hidden="true">
            <ClipboardCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-ink-900">Inspección técnica</p>
            <p className="text-xs text-ink-700">Un inspector revisa la lancha en Estados Unidos</p>
          </div>
        </div>
      </div>

      {/* Horquilla (escritorio): un tramo desde el nodo y un corchete que
          llega al centro de cada resultado (están a 1/4 y 3/4 de la altura). */}
      <div className="relative hidden sm:block" aria-hidden="true">
        <span className="absolute left-0 top-1/2 h-px w-1/2 bg-line-strong" />
        <span className="absolute bottom-1/4 left-1/2 right-0 top-1/4 rounded-l-lg border-b border-l border-t border-line-strong" />
      </div>

      {/* Tramo vertical bajo el nodo (móvil), alineado con el centro de su ícono. */}
      <div className="ml-8 h-4 w-px bg-line-strong sm:hidden" aria-hidden="true" />

      <ol className="grid auto-rows-fr grid-cols-1 pl-12 sm:grid-rows-2 sm:pl-0">
        {RESULTADOS.map((r, i) => {
          const Icono = r.icono;
          const alFinal = i === RESULTADOS.length - 1;
          return (
            <li key={r.id} className="relative flex py-1 sm:py-1">
              {/* Líneas en móvil: la vertical (hasta el centro si es el último) y el tramo al resultado. */}
              <span aria-hidden="true" className={cn('absolute -left-4 top-0 w-px bg-line-strong sm:hidden', alFinal ? 'h-1/2' : 'h-full')} />
              <span aria-hidden="true" className="absolute -left-4 top-1/2 h-px w-4 bg-line-strong sm:hidden" />
              <div className={cn('flex w-full items-start gap-3 rounded-lg border px-3.5 py-3', TARJETA[r.tono])}>
                <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface', ICONO[r.tono])} aria-hidden="true">
                  <Icono size={16} />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-5 text-ink-900">
                    <Badge tone={r.tono} size="sm">{r.label}</Badge>
                    {r.titulo}
                  </p>
                  <p className="mt-1 text-13 text-ink-700">{r.texto}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
