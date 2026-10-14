import { useMemo } from 'react';
import { fmtDate, dateValue } from '../../../shared/lib/utils';
import { PageHeader, Card, Button, Input, Select, Field, FilterChips, SearchInput, DataTable, StatusBadge, EmptyState, ProcessStepper } from '../../../shared/components/UI';
import { Plus, FolderOpen } from '../../../shared/components/Icons';
import { STATUS_OPTIONS, SERVICE_TYPES, FILTROS_VACIOS, serviceTypeLabel } from './constantes';
import ModalNuevoExpediente from './ModalNuevoExpediente';

/**
 * Lista de expedientes: cabecera, filtros que se aplican solos y tabla con
 * fila accesible (Tab + Enter) y tarjetas en móvil.
 */
export default function ListaExpedientes({ orders, conteos, loading, filters, setFilters, onOpen, showCreate, setShowCreate, createForm, setCreateForm, onCreate }) {
  const set = (k, v) => setFilters({ ...filters, [k]: v });
  const hayFiltros = Object.entries(filters).some(([k, v]) => k !== 'status' && v);

  // Orden por fecha de compra/creación, el más nuevo primero (como siempre);
  // la tabla permite reordenar por columna encima.
  const sorted = useMemo(() => [...orders].sort((a, b) => {
    const da = new Date(a.purchase_date || a.created_at || 0).getTime();
    const db = new Date(b.purchase_date || b.created_at || 0).getTime();
    return db - da;
  }), [orders]);

  const chips = [{ id: '', label: 'Todos', count: conteos[''] }].concat(
    STATUS_OPTIONS.map(s => ({ id: s.value, label: s.label, count: conteos[s.value] || 0 })),
  );

  const columns = [
    { key: 'order_number', header: 'N°', width: 112, cell: r => <span className="font-medium text-ink-900 tabular">{r.order_number}</span> },
    {
      key: 'customer_name', header: 'Cliente',
      cell: r => (
        <div className="min-w-0">
          <p className="font-medium text-ink-900 truncate">{r.customer_name || '—'}</p>
          <p className="text-xs text-ink-500 truncate">{r.customer_email}</p>
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
    { key: 'status', header: 'Estado', width: 130, cell: r => <StatusBadge kind="expediente" status={r.status} /> },
    { key: 'timeline_step', header: 'Etapa', width: 170, priority: 2, sortValue: r => Number(r.timeline_step || 1), cell: r => <ProcessStepper current={r.timeline_step || 1} compact /> },
    { key: 'agent_name', header: 'Agente', priority: 3, cell: r => r.agent_name || <span className="text-ink-500">Sin asignar</span> },
    { key: 'updated_at', header: 'Actualizado', width: 120, priority: 2, sortValue: r => dateValue(r.updated_at || r.purchase_date || r.created_at), cell: r => <span className="tabular text-ink-500">{fmtDate(r.updated_at || r.purchase_date || r.created_at)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Expedientes"
        description={loading ? 'Cargando…' : `${orders.length} expediente${orders.length === 1 ? '' : 's'}${filters.status || hayFiltros ? ' con los filtros actuales' : ''}`}
        actions={<Button icon={Plus} onClick={() => setShowCreate(true)}>Nuevo expediente</Button>}
      />

      <Card padding="none" className="mb-4">
        <div className="px-(--card-pad) pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 items-end">
          <SearchInput value={filters.search} onChange={v => set('search', v)} placeholder="Buscar por cliente o correo" aria-label="Buscar expediente por cliente o correo" />
          <Select aria-label="Tipo de servicio" value={filters.service_type} onChange={e => set('service_type', e.target.value)} placeholder="Todos los servicios" options={SERVICE_TYPES} />
          <Input aria-label="Agente" value={filters.agent} onChange={e => set('agent', e.target.value)} placeholder="Agente" />
          <div className="flex items-end gap-2">
            <Field label="Desde" className="flex-1 sm:flex-none"><Input type="date" value={filters.from_date} onChange={e => set('from_date', e.target.value)} className="sm:w-40" /></Field>
            <Field label="Hasta" className="flex-1 sm:flex-none"><Input type="date" value={filters.to_date} onChange={e => set('to_date', e.target.value)} className="sm:w-40" /></Field>
          </div>
          <Button variant="ghost" onClick={() => setFilters({ ...FILTROS_VACIOS, status: filters.status })} disabled={!hayFiltros} className="sm:justify-self-end">Limpiar</Button>
        </div>
        <div className="px-(--card-pad) pb-3">
          <FilterChips aria-label="Filtrar por estado" options={chips} value={filters.status} onChange={v => set('status', v)} />
        </div>
      </Card>

      <Card padding="none">
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
              title={filters.status || hayFiltros ? 'No hay expedientes con estos filtros' : 'Aún no hay expedientes'}
              description={filters.status || hayFiltros ? 'Prueba con otro estado o limpia los filtros.' : 'Crea el primero con «Nuevo expediente».'}
            />
          )}
          mobileCard={r => (
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink-900 tabular">{r.order_number}</span>
                <StatusBadge kind="expediente" status={r.status} size="sm" />
              </div>
              <p className="text-sm text-ink-900 truncate">{r.customer_name || '—'}</p>
              <p className="text-13 text-ink-500 truncate">{r.plan_name || serviceTypeLabel(r.service_type)}{r.agent_name ? ` · ${r.agent_name}` : ''}</p>
              <ProcessStepper current={r.timeline_step || 1} compact />
            </div>
          )}
        />
      </Card>

      <ModalNuevoExpediente open={showCreate} onClose={() => setShowCreate(false)} form={createForm} setForm={setCreateForm} onCreate={onCreate} />
    </>
  );
}
