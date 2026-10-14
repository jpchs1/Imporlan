import { useState, useMemo } from 'react';
import { getInspections } from '../api';
import { fmtDate, dateValue, downloadCSV } from '../../shared/lib/utils';
import { fmtDateLarga, fmtNumero } from '../../shared/lib/format';
import { PageHeader, Card, DataTable, Badge, SearchInput, Select, Drawer, Button, ErrorState, EmptyState, DescriptionList } from '../../shared/components/UI';
import { Download, ClipboardCheck, Mail, ExternalLink } from '../../shared/components/Icons';
import { useCarga } from './operacion/useCarga';

const PAIS = { cl: 'Chile', us: 'Estados Unidos' };

function parseTypes(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : [String(a)]; } catch { return [String(v)]; }
}

function precioPublicado(r) {
  if (!r.published_price) return '';
  return `${r.price_currency || ''} ${r.published_price}`.trim();
}

function embarcacion(r) {
  return `${r.brand || ''} ${r.model || ''}`.trim();
}

// Campos del formulario de inspección, en el orden en que se muestran en el detalle.
const DETAIL_FIELDS = [
  ['Cliente', [['full_name', 'Nombre'], ['email', 'Correo'], ['phone', 'Teléfono'], ['city_residence', 'Ciudad'], ['how_found', 'Cómo nos conoció']]],
  ['Embarcación', [['vessel_type', 'Tipo'], ['brand', 'Marca'], ['model', 'Modelo'], ['vessel_year', 'Año'], ['hull_material', 'Casco'], ['published_price', 'Precio publicado'], ['listing_url', 'Aviso']]],
  ['Motores y equipos', [['num_engines', 'N.° de motores'], ['engine_brand_model', 'Marca y modelo'], ['engine_hours', 'Horas'], ['engine_type_chile', 'Tipo de motor'], ['has_generator', 'Generador'], ['electronics', 'Electrónica']]],
  ['Ubicación', [['state_usa', 'Estado (EE. UU.)'], ['city', 'Ciudad'], ['marina', 'Marina'], ['region_chile', 'Región (Chile)'], ['lake_or_sea', 'Lago o mar'], ['water_status', 'En el agua']]],
  ['Compra', [['purchase_objective', 'Objetivo'], ['import_to_chile', 'Importar a Chile'], ['inspection_timeline', 'Plazo'], ['wants_recommendation', 'Quiere recomendación'], ['has_broker', 'Con broker'], ['broker_name', 'Broker'], ['broker_contact', 'Contacto del broker']]],
];

function valorDetalle(sel, k) {
  if (k === 'listing_url') return <a href={sel[k]} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all inline-flex items-center gap-1">{sel[k]} <ExternalLink size={14} /></a>;
  if (k === 'email') return <a href={`mailto:${sel[k]}`} className="text-brand-600 hover:underline break-all">{sel[k]}</a>;
  if (k === 'published_price') return precioPublicado(sel);
  return String(sel[k]);
}

export default function Inspections() {
  const { datos, cargando, error, recargar } = useCarga(getInspections, { mensaje: 'No se pudieron cargar las inspecciones' });
  const items = useMemo(() => datos?.items || datos?.leads || [], [datos]);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [selected, setSelected] = useState(null);

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i =>
    (!country || i.country === country) &&
    (!q || [i.full_name, i.email, i.phone, i.brand, i.model, i.vessel_type].join(' ').toLowerCase().includes(q))
  );

  const columns = [
    { key: 'id', header: 'N.°', width: 72, mono: true, sortValue: r => Number(r.id), cell: r => <span className="text-ink-500">#{r.id}</span> },
    { key: 'full_name', header: 'Cliente', sortValue: r => r.full_name || '', cell: r => (
      <div className="min-w-0 max-w-[220px]">
        <p className="font-medium text-ink-900 truncate" title={r.full_name || ''}>{r.full_name || '—'}</p>
        <p className="text-xs text-ink-500 truncate" title={r.email || ''}>{r.email}</p>
      </div>
    ) },
    { key: 'phone', header: 'Teléfono', priority: 3, cell: r => <span className="whitespace-nowrap tabular">{r.phone || '—'}</span> },
    { key: 'vessel', header: 'Embarcación', sortValue: r => embarcacion(r), cell: r => (
      <div className="min-w-0 max-w-[240px]">
        <p className="text-ink-900 truncate" title={embarcacion(r)}>{embarcacion(r) || '—'}</p>
        <p className="text-xs text-ink-500 truncate">{[r.vessel_type, r.vessel_year, r.length_value ? `${r.length_value} ${r.length_unit || 'pies'}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
    ) },
    { key: 'country', header: 'País', width: 130, priority: 2, cell: r => <Badge>{PAIS[r.country] || r.country || '—'}</Badge> },
    { key: 'price', header: 'Precio publicado', align: 'right', priority: 2, sortValue: r => Number(String(r.published_price || '').replace(/\D/g, '')) || null, cell: r => <span className="tabular whitespace-nowrap">{precioPublicado(r) || '—'}</span> },
    { key: 'types', header: 'Inspecciones', priority: 3, cell: r => {
      const t = parseTypes(r.inspection_types);
      return t.length ? <span className="text-ink-700">{t.join(' · ')}</span> : '—';
    } },
    { key: 'created_at', header: 'Fecha', width: 110, priority: 2, sortValue: r => dateValue(r.created_at), cell: r => <span className="text-ink-500 whitespace-nowrap">{fmtDate(r.created_at)}</span> },
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

  const hayFiltro = !!(q || country);
  const sel = selected;

  return (
    <>
      <PageHeader
        title="Inspecciones"
        description={cargando ? 'Cargando solicitudes…' : `${fmtNumero(items.length)} ${items.length === 1 ? 'solicitud' : 'solicitudes'} de inspección desde el sitio`}
        actions={items.length > 0 && <Button variant="secondary" icon={Download} onClick={exportCSV}>Exportar CSV</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar las inspecciones" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <Card padding="none">
          <div className="px-(--card-pad) pt-4 pb-3 border-b border-line flex flex-col sm:flex-row gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, correo, teléfono, marca o modelo" className="flex-1" />
            <Select aria-label="País" value={country} onChange={e => setCountry(e.target.value)} options={[
              { value: '', label: 'Todos los países' },
              { value: 'cl', label: 'Chile' },
              { value: 'us', label: 'Estados Unidos' },
            ]} className="w-full sm:w-48" />
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={r => r.id}
            loading={cargando}
            onRowClick={setSelected}
            pageSize={25}
            aria-label="Solicitudes de inspección"
            emptyState={(
              <EmptyState compact icon={ClipboardCheck}
                title={hayFiltro ? 'Ninguna solicitud coincide con la búsqueda' : 'Sin solicitudes de inspección'}
                description={hayFiltro ? 'Prueba con otro texto o quita el filtro.' : 'Aparecen aquí cuando alguien envía el formulario de inspección del sitio.'} />
            )}
            mobileCard={r => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900 truncate">{r.full_name || r.email}</p>
                  <p className="text-13 text-ink-700 truncate">{embarcacion(r) || r.vessel_type || '—'}</p>
                  <p className="text-xs text-ink-500 mt-1">{fmtDate(r.created_at)} · {PAIS[r.country] || r.country}</p>
                </div>
                <span className="text-13 tabular text-ink-900 whitespace-nowrap">{precioPublicado(r)}</span>
              </div>
            )}
          />
        </Card>
      )}

      <Drawer
        open={!!sel}
        onClose={() => setSelected(null)}
        title={sel ? `Inspección #${sel.id}` : ''}
        description={sel ? `Solicitada el ${fmtDateLarga(sel.created_at, { hora: true })} · ${PAIS[sel.country] || sel.country || ''}` : ''}
        width="lg"
        footer={sel && (
          <>
            {sel.listing_url && <Button variant="secondary" iconRight={ExternalLink} onClick={() => window.open(sel.listing_url, '_blank', 'noopener')}>Ver aviso</Button>}
            {sel.email && <Button icon={Mail} onClick={() => { window.location.href = `mailto:${sel.email}`; }}>Escribir al cliente</Button>}
          </>
        )}
      >
        {sel && (
          <div className="space-y-6">
            <div>
              <p className="text-base font-semibold text-ink-900">{embarcacion(sel) || sel.vessel_type || 'Embarcación sin datos'}</p>
              <p className="text-13 text-ink-500">{[sel.vessel_type, sel.vessel_year, sel.length_value ? `${sel.length_value} ${sel.length_unit || 'pies'}` : '', precioPublicado(sel)].filter(Boolean).join(' · ')}</p>
              {parseTypes(sel.inspection_types).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parseTypes(sel.inspection_types).map(t => <Badge key={t} tone="brand">{t}</Badge>)}
                </div>
              )}
            </div>

            {DETAIL_FIELDS.map(([section, fields]) => {
              const rows = fields.filter(([k]) => sel[k] !== null && sel[k] !== undefined && sel[k] !== '');
              if (!rows.length) return null;
              return (
                <section key={section}>
                  <h3 className="text-sm font-semibold text-ink-900 mb-3 pb-2 border-b border-line">{section}</h3>
                  <DescriptionList cols={2} dense items={rows.map(([k, label]) => ({ key: k, label, value: valorDetalle(sel, k), full: k === 'listing_url' }))} />
                </section>
              );
            })}

            {sel.comments && (
              <section>
                <h3 className="text-sm font-semibold text-ink-900 mb-2 pb-2 border-b border-line">Comentarios del cliente</h3>
                <p className="text-sm text-ink-700 whitespace-pre-wrap">{sel.comments}</p>
              </section>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
