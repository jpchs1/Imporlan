/** Campos que puede editar el equipo; el resto pertenece al servidor. */
const fields = ['url', 'title', 'image_url', 'location', 'hours', 'value_usa_usd', 'value_to_negotiate_usd', 'value_chile_clp', 'value_chile_negotiated_clp', 'selection_order', 'comments', 'row_index', 'link_status', 'engine', 'make', 'model', 'year'];
const numeric = new Set(['hours', 'value_usa_usd', 'value_to_negotiate_usd', 'value_chile_clp', 'value_chile_negotiated_clp', 'selection_order', 'row_index', 'year']);
const value = (row, key) => {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === '') return '';
  return numeric.has(key) ? Number(raw) : String(raw);
};
const changed = (row, base) => fields.some(key => value(row, key) !== value(base, key));
const ids = rows => rows.map(row => String(row.id)).join(',');

export function linksPendientes(rows, saved) {
  const byId = new Map(saved.map(row => [String(row.id), row]));
  return ids(rows) !== ids(saved) || rows.some(row => changed(row, byId.get(String(row.id))));
}

/** Mezcla la ficha del servidor con las ediciones posteriores al último guardado. */
export function sincronizarLinks(current, fresh, saved) {
  const local = new Map(current.map(row => [String(row.id), row]));
  const baseline = new Map(saved.map(row => [String(row.id), row]));
  const merged = new Map();
  for (const row of fresh) {
    const key = String(row.id), edit = local.get(key), base = baseline.get(key);
    if (!edit && base) continue; // La fila se eliminó mientras llegaba la respuesta.
    if (edit && value(edit, 'url') !== value(row, 'url')) { merged.set(key, edit); continue; }
    const next = { ...row };
    if (edit) for (const field of fields) {
      if (base ? value(edit, field) !== value(base, field) : value(edit, field) !== '') next[field] = edit[field];
    }
    merged.set(key, next);
  }
  for (const row of current) {
    const key = String(row.id);
    if (!merged.has(key) && (!baseline.has(key) || changed(row, baseline.get(key)))) merged.set(key, row);
  }
  if (ids(current) !== ids(saved)) {
    return [...current.map(row => merged.get(String(row.id))).filter(Boolean), ...[...merged].filter(([key]) => !local.has(key)).map(([, row]) => row)];
  }
  return [...merged.values()];
}
