import { useState, useEffect, useCallback } from 'react';
import { getInspections } from '../api';
import { fmtDate, fmtDateTime, dateValue, downloadCSV } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, Input, Spinner, Modal, Button, ErrorState } from '../../shared/components/UI';

const PAIS = { cl: 'Chile', us: 'USA' };

function parseTypes(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : [String(a)]; } catch { return [String(v)]; }
}

// Campos del formulario de inspección, en el orden en que se muestran en el detalle.
const DETAIL_FIELDS = [
  ['Cliente', [['full_name', 'Nombre'], ['email', 'Email'], ['phone', 'Teléfono'], ['city_residence', 'Ciudad'], ['how_found', 'Cómo nos conoció']]],
  ['Embarcación', [['vessel_type', 'Tipo'], ['brand', 'Marca'], ['model', 'Modelo'], ['vessel_year', 'Año'], ['hull_material', 'Casco'], ['published_price', 'Precio publicado'], ['listing_url', 'Aviso']]],
  ['Motores y equipos', [['num_engines', 'N° motores'], ['engine_brand_model', 'Marca/modelo'], ['engine_hours', 'Horas'], ['engine_type_chile', 'Tipo de motor'], ['has_generator', 'Generador'], ['electronics', 'Electrónica']]],
  ['Ubicación', [['state_usa', 'Estado (USA)'], ['city', 'Ciudad'], ['marina', 'Marina'], ['region_chile', 'Región (Chile)'], ['lake_or_sea', 'Lago o mar'], ['water_status', 'En agua']]],
  ['Compra', [['purchase_objective', 'Objetivo'], ['import_to_chile', 'Importar a Chile'], ['inspection_timeline', 'Plazo'], ['wants_recommendation', 'Quiere recomendación'], ['has_broker', 'Con broker'], ['broker_name', 'Broker'], ['broker_contact', 'Contacto broker']]],
];

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getInspections()
      .then(res => setItems(res.items || res.leads || []))
      .catch(e => setError(e.message || 'No se pudieron cargar las inspecciones'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i =>
    (!country || i.country === country) &&
    (!q || [i.full_name, i.email, i.phone, i.brand, i.model, i.vessel_type].join(' ').toLowerCase().includes(q))
  );

  const columns = [
    { header: 'ID', sortValue: r => Number(r.id), cell: r => <span className="font-mono text-xs">#{r.id}</span> },
    { header: 'Nombre', key: 'full_name' },
    { header: 'Email', key: 'email' },
    { header: 'Teléfono', key: 'phone' },
    { header: 'País', key: 'country', cell: r => <Badge className="bg-blue-50 text-blue-700">{PAIS[r.country] || r.country}</Badge> },
    { header: 'Embarcación', sortValue: r => `${r.brand || ''} ${r.model || ''}`, cell: r => `${r.vessel_type || ''} ${r.brand || ''} ${r.model || ''}`.trim() || '-' },
    { header: 'Eslora', sortValue: r => Number(r.length_value) || null, cell: r => r.length_value ? `${r.length_value} ${r.length_unit || 'pies'}` : '-' },
    { header: 'Precio pub.', cell: r => r.published_price ? `${r.price_currency || ''} ${r.published_price}` : '-' },
    { header: 'Fecha', sortValue: r => dateValue(r.created_at), cell: r => fmtDate(r.created_at) },
  ];

  function exportCSV() {
    downloadCSV(`inspecciones-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'ID', value: r => r.id },
      { header: 'Fecha', value: r => r.created_at },
      { header: 'País', value: r => PAIS[r.country] || r.country },
      { header: 'Nombre', value: r => r.full_name },
      { header: 'Email', value: r => r.email },
      { header: 'Teléfono', value: r => r.phone },
      { header: 'Tipo', value: r => r.vessel_type },
      { header: 'Marca', value: r => r.brand },
      { header: 'Modelo', value: r => r.model },
      { header: 'Año', value: r => r.vessel_year },
      { header: 'Eslora', value: r => r.length_value ? `${r.length_value} ${r.length_unit || ''}` : '' },
      { header: 'Precio', value: r => r.published_price ? `${r.price_currency || ''} ${r.published_price}` : '' },
      { header: 'Inspecciones', value: r => parseTypes(r.inspection_types).join(' / ') },
      { header: 'Aviso', value: r => r.listing_url },
    ], filtered);
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Inspecciones"
        subtitle={`${items.length} solicitudes de inspección`}
        action={items.length > 0 && <Button variant="secondary" onClick={exportCSV}>Exportar CSV</Button>}
      />
      <Card>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="font-medium">Sin solicitudes de inspección</p>
            <p className="text-sm mt-1">Aparecen aquí cuando alguien envía el formulario de inspección del sitio.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input placeholder="Buscar por nombre, email, teléfono, marca o modelo..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
              <select value={country} onChange={e => setCountry(e.target.value)}
                className="w-full sm:w-44 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                <option value="">Todos los países</option>
                <option value="cl">Chile</option>
                <option value="us">USA</option>
              </select>
            </div>
            <Table columns={columns} data={filtered} onRowClick={setSelected} emptyMsg="Ninguna solicitud coincide con la búsqueda" />
          </>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Inspección #${selected.id}` : ''} size="lg">
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-50 text-blue-700">{PAIS[selected.country] || selected.country}</Badge>
              <Badge className="bg-slate-100 text-slate-600">{fmtDateTime(selected.created_at)}</Badge>
              {parseTypes(selected.inspection_types).map(t => <Badge key={t} className="bg-emerald-50 text-emerald-700">{t}</Badge>)}
            </div>
            {DETAIL_FIELDS.map(([section, fields]) => {
              const rows = fields.filter(([k]) => selected[k] !== null && selected[k] !== undefined && selected[k] !== '');
              if (!rows.length) return null;
              return (
                <div key={section}>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{section}</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {rows.map(([k, label]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-xs text-slate-400">{label}</dt>
                        <dd className="text-slate-700 break-words">
                          {k === 'listing_url'
                            ? <a href={selected[k]} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">{selected[k]}</a>
                            : k === 'email'
                              ? <a href={`mailto:${selected[k]}`} className="text-indigo-600 hover:underline">{selected[k]}</a>
                              : String(selected[k])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
            {selected.comments && (
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Comentarios</h4>
                <p className="text-slate-700 whitespace-pre-wrap">{selected.comments}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
