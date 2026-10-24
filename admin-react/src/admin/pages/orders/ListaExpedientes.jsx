import { useMemo, useState } from 'react';
import { fmtDate, dateValue } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Card, Avatar, Button, Input, Select, Field, Checkbox, FilterChips, SearchInput, DataTable, StatusBadge, Badge, EmptyState, ProcessStepper } from '../../../shared/components/UI';
import { Plus, FolderOpen, Ship, ClipboardCheck, Anchor, SlidersHorizontal, ArrowUpRight } from '../../../shared/components/Icons';
import { STATUS_OPTIONS, SERVICE_TYPES, FILTROS_VACIOS, serviceTypeLabel } from './constantes';
import ModalNuevoExpediente from './ModalNuevoExpediente';
import { ExpedienteHeader, ExpedienteMetrics } from '../../../shared/components/ExpedienteWorkspace';

const TRES_DIAS = 3 * 86400000;

/* «Lancha elegida» en la lista: destacado (y con el «hace…») si la elección
   es de los últimos tres días, para ver de un vistazo quién acaba de decidir. */
function ChipEleccion({ o, ahora }) {
  if (!o.chosen_link_id) return null;
  const cuando = dateValue(o.chosen_at);
  const reciente = cuando > 0 && ahora - cuando < TRES_DIAS;
  return (
    <Badge tone={reciente ? 'success' : 'brand'} dot={reciente} size="sm" title={cuando ? `Lancha elegida el ${fmtDateLarga(o.chosen_at, { hora: true })}` : 'Lancha elegida'}>
      {reciente ? `Lancha elegida · ${fmtRelativo(o.chosen_at)}` : 'Lancha elegida'}
    </Badge>
  );
}

/**
 * Lista de expedientes: cabecera, filtros que se aplican solos y tabla con
 * fila accesible (Tab + Enter) y tarjetas en móvil.
 */
export default function ListaExpedientes({ orders, conteos, loading, filters, setFilters, onOpen, showCreate, setShowCreate, createForm, setCreateForm, onCreate }) {
  const set = (k, v) => setFilters({ ...filters, [k]: v });
  const hayFiltros = Object.entries(filters).some(([k, v]) => k !== 'status' && v);
  // Filtro local (la API no lo tiene): sólo los que ya tienen lancha elegida.
  const [soloElegidas, setSoloElegidas] = useState(false);
  const [advanced, setAdvanced] = useState(() => !!(filters.agent || filters.from_date || filters.to_date));
  const conEleccion = orders.filter(o => o.chosen_link_id).length;
  // «Hace…» se calcula una vez por montaje (la lista se recarga sola al filtrar).
  const [ahora] = useState(() => Date.now());

  // Orden por fecha de compra/creación, el más nuevo primero (como siempre);
  // la tabla permite reordenar por columna encima.
  const sorted = useMemo(() => [...orders]
    .filter(o => !soloElegidas || o.chosen_link_id)
    .sort((a, b) => {
      const da = new Date(a.purchase_date || a.created_at || 0).getTime();
      const db = new Date(b.purchase_date || b.created_at || 0).getTime();
      return db - da;
    }), [orders, soloElegidas]);

  const chips = [{ id: '', label: 'Todos', count: conteos[''] }].concat(
    STATUS_OPTIONS.map(s => ({ id: s.value, label: s.label, count: conteos[s.value] || 0 })),
  );

  const columns = [
    { key: 'order_number', header: 'N°', width: 112, cell: r => <span className="exp-row-id tabular"><FolderOpen size={17} />{r.order_number}</span> },
    {
      key: 'customer_name', header: 'Cliente',
      cell: r => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.customer_name || 'Cliente'} size="sm" />
          <div className="min-w-0"><p className="font-medium text-ink-900 truncate">{r.customer_name || '—'}</p>
          {r.customer_email && <p className="text-xs text-ink-500 truncate">{r.customer_email}</p>}</div>
        </div>
      ),
    },
    {
      key: 'plan_name', header: 'Plan', priority: 2,
      cell: r => (
        <div className="min-w-0">
          <p className="truncate">{r.plan_name || '—'}</p>
          <p className="text-xs text-ink-500 truncate">{serviceTypeLabel(r.service_type)}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Estado', width: 150,
      cell: r => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="expediente" status={r.status} />
          <ChipEleccion o={r} ahora={ahora} />
        </div>
      ),
    },
    { key: 'timeline_step', header: 'Etapa', width: 170, priority: 2, sortValue: r => Number(r.timeline_step || 1), cell: r => <ProcessStepper current={r.timeline_step || 1} compact /> },
    { key: 'agent_name', header: 'Agente', priority: 3, cell: r => r.agent_name || <span className="text-ink-500">Sin asignar</span> },
    { key: 'updated_at', header: 'Actualizado', width: 120, priority: 2, sortValue: r => dateValue(r.updated_at || r.purchase_date || r.created_at), cell: r => <span className="tabular text-ink-500">{fmtDate(r.updated_at || r.purchase_date || r.created_at)}</span> },
  ];

  return (
    <div className="exp-workspace">
      <ExpedienteHeader
        eyebrow="Operaciones · Imporlan"
        title="Expedientes"
        description="Cada operación, de la búsqueda a la entrega. Todo en un mismo lugar."
        actions={<Button icon={Plus} onClick={() => setShowCreate(true)}>Nuevo expediente</Button>}
      />

      <ExpedienteMetrics loading={loading} items={[
        { label: 'Expedientes', value: conteos[''] ?? orders.length, hint: 'Operaciones registradas', icon: FolderOpen },
        { label: 'En proceso', value: conteos.in_progress || 0, hint: 'Operaciones en desarrollo', icon: Ship },
        { label: 'Por revisar', value: conteos.pending_admin_fill || 0, hint: 'Pendientes del equipo', icon: ClipboardCheck },
        { label: 'Lancha elegida', value: conEleccion, hint: 'En los resultados actuales', icon: Anchor },
      ]} />
      <Card padding="none" className="exp-filter-panel mb-4">
        <div className="px-(--card-pad) pt-4 pb-3 flex flex-col md:flex-row gap-3 md:items-center">
          <SearchInput value={filters.search} onChange={v => set('search', v)} placeholder="Buscar por cliente o correo" aria-label="Buscar expediente por cliente o correo" className="flex-1 min-w-0" />
          <Select className="md:w-52 shrink-0" aria-label="Tipo de servicio" value={filters.service_type} onChange={e => set('service_type', e.target.value)} placeholder="Todos los servicios" options={SERVICE_TYPES} />
          <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setAdvanced(v => !v)} aria-expanded={advanced} aria-controls="exp-filtros-avanzados">Más filtros</Button>
          {hayFiltros && <Button variant="ghost" onClick={() => setFilters({ ...FILTROS_VACIOS, status: filters.status })}>Limpiar</Button>}
        </div>
        {advanced && <div id="exp-filtros-avanzados" className="px-(--card-pad) py-4 mb-3 border-y border-line bg-canvas grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Agente" value={filters.agent} onChange={e => set('agent', e.target.value)} placeholder="Nombre del agente" />
          <Field label="Desde"><Input type="date" value={filters.from_date} onChange={e => set('from_date', e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={filters.to_date} onChange={e => set('to_date', e.target.value)} /></Field>
        </div>}
        <div className="px-(--card-pad) pb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <FilterChips aria-label="Filtrar por estado" options={chips} value={filters.status} onChange={v => set('status', v)} />
          {(conEleccion > 0 || soloElegidas) && (
            <Checkbox label={`Solo con lancha elegida (${conEleccion})`} checked={soloElegidas} onChange={e => setSoloElegidas(e.target.checked)} className="text-13" />
          )}
        </div>
      </Card>

      <Card padding="none" className="exp-list-table">
        <div className="exp-list-heading"><div><h2>Operaciones registradas</h2><p>{loading ? 'Cargando expedientes…' : `${sorted.length} resultado${sorted.length === 1 ? '' : 's'}${filters.status || hayFiltros || soloElegidas ? ' con los filtros actuales' : ''}`}</p></div><ArrowUpRight size={18} className="text-ink-400" /></div>
        <DataTable
          aria-label="Expedientes"
          columns={columns}
          data={sorted}
          rowKey={r => r.id}
          onRowClick={r => onOpen(r.id)}
          loading={loading}
          loadingRows={6}
          pageSize={50}
          emptyState={(
            <EmptyState
              compact
              icon={FolderOpen}
              title={filters.status || hayFiltros || soloElegidas ? 'No hay expedientes con estos filtros' : 'Aún no hay expedientes'}
              description={filters.status || hayFiltros || soloElegidas ? 'Prueba con otro estado o limpia los filtros.' : 'Crea el primero con «Nuevo expediente».'}
            />
          )}
          mobileCard={r => (
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink-900 tabular">{r.order_number}</span>
                <StatusBadge kind="expediente" status={r.status} size="sm" />
              </div>
              <p className="text-sm text-ink-900 truncate">{r.customer_name || '—'}</p>
              {r.chosen_link_id && <ChipEleccion o={r} ahora={ahora} />}
              <p className="text-13 text-ink-500 truncate">{r.plan_name || serviceTypeLabel(r.service_type)}{r.agent_name ? ` · ${r.agent_name}` : ''}</p>
              <ProcessStepper current={r.timeline_step || 1} compact />
            </div>
          )}
        />
      </Card>

      <ModalNuevoExpediente open={showCreate} onClose={() => setShowCreate(false)} form={createForm} setForm={setCreateForm} onCreate={onCreate} />
    </div>
  );
}
