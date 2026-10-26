/** Sólo una fila sin información puede ocultarse o borrarse como borrador vacío. */
export function esLinkVacio(link) {
  return ![
    'url', 'title', 'make', 'model', 'year', 'engine', 'location', 'hours', 'image_url', 'comments',
    'value_usa_usd', 'value_to_negotiate_usd', 'value_chile_clp', 'value_chile_negotiated_clp',
    'selection_order', 'quote_calculated_at', 'quote_total_clp', 'quote_data',
  ].some(key => String(link?.[key] ?? '').trim() !== '');
}
