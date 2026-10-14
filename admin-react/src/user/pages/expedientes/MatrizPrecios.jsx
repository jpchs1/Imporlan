import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtUSD } from '../../../shared/lib/format';

/**
 * Los cuatro montos no son cuatro datos sueltos: son dos monedas por dos
 * escenarios. En escritorio es una matriz (Publicado / Negociado × Estados
 * Unidos / Chile); en móvil son dos filas legibles, una por lugar. La resta
 * (el ahorro de la negociación) está hecha y es la última línea.
 */
export default function MatrizPrecios({ link, className }) {
  const vU = Number(link.value_usa_usd) > 0 ? Number(link.value_usa_usd) : null;
  const vN = Number(link.value_to_negotiate_usd) > 0 ? Number(link.value_to_negotiate_usd) : null;
  const vC = Number(link.value_chile_clp) > 0 ? Number(link.value_chile_clp) : null;
  const vCN = Number(link.value_chile_negotiated_clp) > 0 ? Number(link.value_chile_negotiated_clp) : null;
  if (vU === null && vN === null && vC === null && vCN === null) return null;

  const ahorro = vC !== null && vCN !== null && vCN < vC ? vC - vCN : null;

  return (
    <div className={cn('rounded-md border border-line bg-canvas px-3.5 py-3', className)}>
      {/* ≥ sm: matriz */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-3 gap-y-1.5">
        <span aria-hidden="true" />
        <span className="eyebrow text-right" title="Precio del anuncio en Estados Unidos">EE. UU.</span>
        <span className="eyebrow text-right" title="Precio total con la lancha puesta en Chile">Puesto en Chile</span>

        <span className="text-13 text-ink-500">Publicado</span>
        <Celda valor={vU !== null ? fmtUSD(vU) : null} fuerte />
        <Celda valor={vC !== null ? fmtCLP(vC) : null} fuerte />

        <span className="text-13 text-ink-500">Negociado</span>
        <Celda valor={vN !== null ? fmtUSD(vN) : null} />
        <Celda valor={vCN !== null ? fmtCLP(vCN) : null} destacado />
      </div>

      {/* < sm: dos filas, una por lugar */}
      <dl className="sm:hidden space-y-2.5">
        <Fila etiqueta="En EE. UU." publicado={vU !== null ? fmtUSD(vU) : null} negociado={vN !== null ? fmtUSD(vN) : null} />
        <Fila etiqueta="Puesto en Chile" publicado={vC !== null ? fmtCLP(vC) : null} negociado={vCN !== null ? fmtCLP(vCN) : null} destacado />
      </dl>

      {ahorro !== null && (
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
          <span className="text-13 text-ink-500">Ahorro con la negociación</span>
          <span className="text-sm font-semibold text-success tabular">{fmtCLP(ahorro)}</span>
        </div>
      )}
    </div>
  );
}

function Celda({ valor, fuerte, destacado }) {
  if (!valor) return <span className="text-right text-13 text-ink-500 whitespace-nowrap">Sin dato</span>;
  return (
    <span className={cn('text-right tabular whitespace-nowrap', destacado ? 'text-sm font-semibold text-brand-700' : fuerte ? 'text-sm font-semibold text-ink-900' : 'text-sm text-ink-700')}>
      {valor}
    </span>
  );
}

function Fila({ etiqueta, publicado, negociado, destacado }) {
  return (
    <div>
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-13 text-ink-500 tabular">
        <span>Publicado <span className="font-semibold text-ink-900">{publicado || 'sin dato'}</span></span>
        <span>Negociado <span className={cn('font-semibold', negociado ? (destacado ? 'text-brand-700' : 'text-ink-900') : 'text-ink-500')}>{negociado || 'sin dato'}</span></span>
      </dd>
    </div>
  );
}
