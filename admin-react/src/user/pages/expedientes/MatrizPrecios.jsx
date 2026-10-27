import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtUSD } from '../../../shared/lib/format';
import { precioChile } from './lib';

/** Compra negociada y total en Chile; el precio del anuncio queda de referencia. */
export default function MatrizPrecios({ link, className }) {
  const publicado = Number(link.value_usa_usd) > 0 ? Number(link.value_usa_usd) : null;
  const negociado = Number(link.value_to_negotiate_usd) > 0 ? Number(link.value_to_negotiate_usd) : null;
  const total = precioChile(link);
  if (publicado === null && negociado === null && total === null && !link.quote_pending) return null;
  const anteriorChile = !link.quote_pending && Number(link.value_chile_clp) > 0 ? Number(link.value_chile_clp) : null;
  const ahorro = anteriorChile !== null && total !== null && total < anteriorChile ? anteriorChile - total : null;
  return (
    <div className={cn('rounded-md border border-line bg-canvas px-3.5 py-3', className)}>
      <dl className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <div className="min-w-0">
          <dt className="eyebrow">Compra en EE. UU.</dt>
          <dd className="mt-1 text-base font-semibold text-ink-900 tabular break-words">{negociado !== null ? fmtUSD(negociado) : 'Por negociar'}</dd>
          <dd className="mt-1 text-xs text-ink-500">{negociado !== null ? 'Valor negociado' : 'Aún sin precio acordado'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="eyebrow">Puesto en Chile</dt>
          <dd className="mt-1 text-base font-semibold text-brand-700 tabular break-words">{link.quote_pending ? 'En análisis' : total !== null ? fmtCLP(total) : 'Por cotizar'}</dd>
          <dd className="mt-1 text-xs text-ink-500">Total de la operación · CLP</dd>
        </div>
      </dl>
      {publicado !== null && <p className="mt-3 border-t border-line pt-2 text-xs text-ink-500">Precio publicado en EE. UU.: <span className="tabular">{fmtUSD(publicado)}</span></p>}
      {ahorro !== null && (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-13 text-ink-500">Ahorro en Chile con la negociación</span>
          <span className="text-sm font-semibold text-success tabular">{fmtCLP(ahorro)}</span>
        </div>
      )}
    </div>
  );
}
