import { cn } from '../../../shared/lib/utils';
import { Badge } from '../../../shared/components/UI';
import { ClipboardCheck, Languages, CircleCheck, TriangleAlert } from '../../../shared/components/Icons';
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
 * El camino de la inspección técnica, dibujado: Inspección → «Tú revisas el
 * reporte (en inglés y en español)» → «Apruebas: seguimos con la compra
 * (Pago 2)» / «Declinas: eliges otra lancha (tu Pago 1 se abona) o te lo
 * devolvemos». Los textos salen de CAMINO_INSPECCION, los mismos que usa el
 * avance. El punto es que el cliente vea que decide él.
 *
 * Un riel vertical a la izquierda une los dos pasos; de ahí sale una
 * horquilla hacia los dos resultados (lado a lado desde `sm`, apilados en
 * móvil). Las líneas son cajas con fondo `line-strong`, nada de SVG. Todo lo
 * decorativo va `aria-hidden`; el orden de lectura es el del DOM.
 *
 *   <CaminoInspeccion />                 // completo (asistente)
 *   <CaminoInspeccion compacto />        // tres líneas con ícono (avance)
 */
export default function CaminoInspeccion({ compacto = false, className }) {
  if (compacto) {
    return (
      <ul className={cn('space-y-1', className)} aria-label="Qué pasa después de la inspección">
        <li className="flex items-start gap-2 text-13 text-ink-700">
          <Languages size={14} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
          <span><span className="font-medium text-ink-900">{CAMINO_INSPECCION.revisas.titulo}:</span> {CAMINO_INSPECCION.revisas.corto}</span>
        </li>
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
    <div role="group" aria-label="El camino de la inspección técnica" className={cn('min-w-0', className)}>
      <Paso
        icono={ClipboardCheck}
        titulo="Inspección técnica"
        texto="Un inspector certificado revisa la lancha en Estados Unidos."
        destacado
      />
      <div className="ml-8 h-4 w-px bg-line-strong" aria-hidden="true" />
      <Paso
        icono={Languages}
        titulo={CAMINO_INSPECCION.revisas.titulo}
        texto={CAMINO_INSPECCION.revisas.texto}
        badge="Tú decides"
      />

      {/* Horquilla en escritorio: baja del riel, cruza hasta el centro de la
          segunda tarjeta y cae sobre el centro de cada una. */}
      <div className="relative hidden h-4 sm:block" aria-hidden="true">
        <span className="absolute left-8 top-0 h-2 w-px bg-line-strong" />
        <span className="absolute left-8 right-1/4 top-2 h-px bg-line-strong" />
        <span className="absolute left-1/4 top-2 h-2 w-px bg-line-strong" />
        <span className="absolute left-3/4 top-2 h-2 w-px bg-line-strong" />
      </div>
      {/* En móvil el riel sigue hacia abajo y cada resultado cuelga de él. */}
      <div className="ml-8 h-4 w-px bg-line-strong sm:hidden" aria-hidden="true" />

      <ol className="grid grid-cols-1 gap-3 pl-12 sm:grid-cols-2 sm:pl-0" aria-label="Los dos resultados posibles">
        {RESULTADOS.map((r, i) => {
          const Icono = r.icono;
          const alFinal = i === RESULTADOS.length - 1;
          return (
            <li key={r.id} className="relative flex">
              <span aria-hidden="true" className={cn('absolute -left-4 top-0 w-px bg-line-strong sm:hidden', alFinal ? 'h-1/2' : '-bottom-3')} />
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

function Paso({ icono, titulo, texto, badge, destacado = false }) {
  const Icono = icono;
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', destacado ? 'border-brand-200 bg-brand-50' : 'border-brand-200 bg-surface')}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', destacado ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700')} aria-hidden="true">
        <Icono size={18} />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-5 text-ink-900">
          {titulo}
          {badge && <Badge tone="brand" size="sm">{badge}</Badge>}
        </p>
        <p className="text-xs text-ink-700">{texto}</p>
      </div>
    </div>
  );
}
