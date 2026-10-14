import { cn, fmtCLP } from '../lib/utils';
import { fmtUSD } from '../lib/format';

const SIZES = {
  sm: { main: 'text-13 font-semibold', sub: 'text-xs' },
  md: { main: 'text-sm font-semibold', sub: 'text-xs' },
  lg: { main: 'text-xl font-semibold', sub: 'text-13' },
  xl: { main: 'text-3xl font-bold tracking-tight', sub: 'text-sm' },
};

/**
 * Monto en CLP (y USD de referencia).
 *   <Money clp={12523000} usd={13182} />      → $12.523.000  /  ≈ USD 13.182
 *   <Money usd={850} />                        → USD 850
 *   <Money clp={0} size="xl" />                → $0 (grande, para totales)
 * `inline` pone el USD al lado en vez de debajo. `approx={false}` quita el "≈".
 */
export function Money({ clp, usd, size = 'md', inline = false, approx = true, align = 'left', className, tone, strike = false }) {
  const s = SIZES[size] || SIZES.md;
  const hasClp = clp !== null && clp !== undefined && clp !== '';
  const hasUsd = usd !== null && usd !== undefined && usd !== '';
  if (!hasClp && !hasUsd) return <span className={cn('text-ink-500', className)}>—</span>;
  const toneText = { success: 'text-success', danger: 'text-danger', warning: 'text-warning', muted: 'text-ink-500' }[tone] || 'text-ink-900';
  const main = hasClp ? fmtCLP(Number(clp)) : fmtUSD(usd);
  const sub = hasClp && hasUsd ? `${approx ? '≈ ' : ''}${fmtUSD(usd)}` : null;
  return (
    <span className={cn('tabular', inline ? 'inline-flex items-baseline gap-1.5 flex-wrap' : 'inline-flex flex-col', align === 'right' && (inline ? 'justify-end' : 'items-end'), align === 'center' && 'items-center', className)}>
      <span className={cn(s.main, toneText, strike && 'line-through text-ink-500')}>{main}</span>
      {sub && <span className={cn(s.sub, 'text-ink-500 font-normal')}>{sub}</span>}
    </span>
  );
}
