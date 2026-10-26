/** Compara la compra actual con la base del último cálculo, con precisión de centavos. */
export function estadoCotizacion(link) {
  let snapshot = link?.quote_data;
  if (typeof snapshot === 'string') {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
  }
  const cents = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value) * 100) : null;
  const compra = cents(link?.value_to_negotiate_usd);
  const base = cents(snapshot?.valor_lancha_usd);
  const total = Number(link?.quote_total_clp);
  const tieneCotizacion = !!(link?.quote_calculated_at || link?.quote_data || total > 0);
  const baseCambio = compra !== null && base !== null && compra !== base;
  const vigente = tieneCotizacion && compra !== null && base !== null && !baseCambio && Number.isFinite(total) && total > 0;
  return { tieneCotizacion, baseCambio, requiereRevision: tieneCotizacion && !vigente, vigente, total: Number.isFinite(total) && total > 0 ? total : null };
}
