import { useState, useRef, useMemo } from 'react';
import { getVessels, createVessel, updateVessel, deleteVessel, getVesselPositions } from '../api';
import { fmtDateLarga, fmtNumero } from '../../shared/lib/format';
import {
  PageHeader, Card, DataTable, StatusBadge, Button, Modal, Input, Select, StatTile, StatGrid,
  ErrorState, EmptyState, DescriptionList, Skeleton, FormGrid, useConfirm,
} from '../../shared/components/UI';
import { Plus, Pencil, Trash, Ship, MapPin } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useCarga } from './operacion/useCarga';
import { MapaBarco } from './operacion/MapaBarco';

const STATUS_OPTS = [
  { value: 'active', label: 'En tránsito' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'arrived', label: 'Arribado' },
  { value: 'inactive', label: 'Inactivo' },
];
const TYPE_OPTS = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto', label: 'Automático (AIS)' },
];
const FORM_VACIO = {
  display_name: '', imo: '', mmsi: '', type: 'manual', status: 'active',
  shipping_line: '', client_name: '', origin_label: '', destination_label: '', eta_manual: '',
};

function nombre(v) {
  return v?.display_name || v?.name || '—';
}

export default function Tracking() {
  const toast = useToast();
  const confirm = useConfirm();
  const { datos, cargando, error, recargar, refrescar } = useCarga(getVessels, { mensaje: 'No se pudieron cargar las embarcaciones' });
  const vessels = useMemo(() => datos?.vessels || datos?.items || [], [datos]);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);

  // Con dos clics rápidos no deben quedar las posiciones de un barco bajo el
  // nombre de otro: la ruta se vacía al cambiar (si no, el mapa seguía
  // pintando el recorrido del barco anterior hasta que llegaba el nuevo) y las
  // respuestas que llegan tarde se descartan.
  const posReq = useRef(0);
  async function viewVessel(v) {
    const n = ++posReq.current;
    setSelectedVessel(v);
    setPositions([]);
    setLoadingPos(true);
    let pos = [];
    try { const res = await getVesselPositions(v.id); pos = res.positions || []; }
    catch { pos = []; }
    if (posReq.current !== n) return;
    setPositions(pos);
    setLoadingPos(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm(FORM_VACIO);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(v) {
    setEditItem(v);
    setForm({
      display_name: v.display_name || v.name || '', imo: v.imo || '', mmsi: v.mmsi || '',
      // _db_status: el estado real guardado (el puente de tracking puede mostrar uno proyectado).
      type: v.type || 'manual', status: v._db_status || v.status || 'active', shipping_line: v.shipping_line || '',
      client_name: v.client_name || '', origin_label: v.origin_label || '',
      destination_label: v.destination_label || '', eta_manual: v.eta_manual ? v.eta_manual.slice(0, 16) : '',
    });
    setErrors({});
    setShowModal(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.display_name) errs.display_name = 'El nombre es obligatorio';
    if (!form.imo && !form.mmsi) errs.imo = 'Se necesita el IMO o el MMSI';
    if (form.imo && !/^\d{7}$/.test(form.imo)) errs.imo = 'El IMO tiene 7 dígitos';
    if (form.mmsi && !/^\d{9}$/.test(form.mmsi)) errs.mmsi = 'El MMSI tiene 9 dígitos';
    setErrors(errs);
    if (Object.keys(errs).length) { toast?.(Object.values(errs)[0], 'error'); return; }
    if (saving) return;
    // Vacíos como null: MySQL estricto rechaza '' en columnas DATETIME.
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
    setSaving(true);
    try {
      if (editItem) await updateVessel({ id: editItem.id, ...payload });
      else await createVessel(payload);
      setShowModal(false);
      toast?.(editItem ? 'Embarcación actualizada' : 'Embarcación creada', 'success');
      refrescar();
    } catch (e) { toast?.(e.message || 'No se pudo guardar la embarcación', 'error'); }
    setSaving(false);
  }

  async function handleDelete(v) {
    const ok = await confirm({
      title: `¿Eliminar ${nombre(v)}?`,
      description: 'Deja de aparecer en el seguimiento del panel y del cliente. Esta acción no se puede deshacer.',
      tone: 'danger',
      confirmLabel: 'Eliminar embarcación',
    });
    if (!ok) return;
    try {
      await deleteVessel(v.id);
      if (selectedVessel && selectedVessel.id === v.id) { setSelectedVessel(null); setPositions([]); }
      toast?.('Embarcación eliminada', 'success');
      refrescar();
    } catch (e) { toast?.(e.message || 'No se pudo eliminar la embarcación', 'error'); }
  }

  const enTransito = vessels.filter(v => v.status === 'active').length;
  const arribadas = vessels.filter(v => v.status === 'arrived').length;

  const columns = [
    { key: 'display_name', header: 'Embarcación', sortValue: r => nombre(r), cell: r => (
      <div className="min-w-0 max-w-[200px]">
        <p className="font-medium text-ink-900 truncate" title={nombre(r)}>{nombre(r)}</p>
        <p className="text-xs text-ink-500 truncate" title={[r.shipping_line, r.client_name].filter(Boolean).join(' · ')}>{[r.shipping_line, r.client_name].filter(Boolean).join(' · ') || `IMO ${r.imo || '—'}`}</p>
      </div>
    ) },
    { key: 'ruta', header: 'Ruta', priority: 2, cell: r => {
      const from = r.origin_label || '', to = r.destination_label || '';
      if (!from && !to) return <span className="text-ink-500">—</span>;
      return <span className="block max-w-[180px] truncate" title={`${from} → ${to}`}>{from}{from && to ? ' → ' : ''}{to}</span>;
    } },
    { key: 'status', header: 'Estado', width: 130, sortValue: r => r.status || 'active', cell: r => (
      <div className="flex flex-col items-start gap-0.5">
        <StatusBadge kind="barco" status={r.status || 'active'} dot />
        {(r.eta_manual || r.pos_eta) && <span className="text-xs text-ink-500 whitespace-nowrap">Llega {fmtDateLarga(r.eta_manual || r.pos_eta)}</span>}
      </div>
    ) },
  ];

  const ultima = positions[0];

  return (
    <>
      <PageHeader
        title="Seguimiento marítimo"
        description={cargando ? 'Cargando embarcaciones…' : `${fmtNumero(vessels.length)} ${vessels.length === 1 ? 'embarcación registrada' : 'embarcaciones registradas'}`}
        actions={<Button icon={Plus} onClick={openCreate}>Nueva embarcación</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar las embarcaciones" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <>
          <StatGrid cols={3} className="mb-6">
            <StatTile label="Embarcaciones" value={vessels.length} loading={cargando} />
            <StatTile label="En tránsito" value={enTransito} loading={cargando} />
            <StatTile label="Arribadas" value={arribadas} loading={cargando} />
          </StatGrid>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
            <Card padding="none">
              <DataTable
                columns={columns}
                data={vessels}
                rowKey={r => r.id}
                loading={cargando}
                onRowClick={viewVessel}
                pageSize={25}
                aria-label="Embarcaciones"
                rowClassName={r => (selectedVessel?.id === r.id ? 'bg-brand-50' : undefined)}
                rowActions={r => [
                  { label: 'Ver en el mapa', icon: MapPin, onClick: () => viewVessel(r) },
                  { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
                  { separator: true },
                  { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDelete(r) },
                ]}
                emptyState={<EmptyState compact icon={Ship} title="No hay embarcaciones registradas" description="Agrega la nave que trae la carga de un cliente para seguirla aquí." primaryAction={<Button size="sm" icon={Plus} onClick={openCreate}>Nueva embarcación</Button>} />}
                mobileCard={r => (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 truncate">{nombre(r)}</p>
                      <p className="text-13 text-ink-500 truncate">{[r.origin_label, r.destination_label].filter(Boolean).join(' → ') || r.shipping_line || '—'}</p>
                      <p className="text-xs text-ink-500 mt-1 truncate">{[r.client_name, r.imo ? `IMO ${r.imo}` : r.mmsi ? `MMSI ${r.mmsi}` : ''].filter(Boolean).join(' · ')}</p>
                    </div>
                    <StatusBadge kind="barco" status={r.status || 'active'} size="sm" />
                  </div>
                )}
              />
            </Card>

            <Card className="xl:sticky xl:top-[calc(var(--topbar-h)+16px)]">
              <Card.Header
                title={selectedVessel ? nombre(selectedVessel) : 'Mapa de seguimiento'}
                description={selectedVessel
                  ? [selectedVessel.shipping_line, [selectedVessel.origin_label, selectedVessel.destination_label].filter(Boolean).join(' → ')].filter(Boolean).join(' · ') || 'Posiciones registradas'
                  : 'Elige una embarcación de la lista para ver su recorrido.'}
                actions={selectedVessel && <StatusBadge kind="barco" status={selectedVessel.status || 'active'} dot />}
              />
              <Card.Body className="space-y-4">
                <MapaBarco positions={positions} vessel={selectedVessel} className="h-[360px] xl:h-[400px]" />
                {selectedVessel && (
                  <DescriptionList cols={2} dense items={[
                    { label: 'IMO', value: selectedVessel.imo || '—', mono: true },
                    { label: 'MMSI', value: selectedVessel.mmsi || '—', mono: true },
                  ]} />
                )}
                {loadingPos ? (
                  <Skeleton.Text lines={2} />
                ) : selectedVessel && ultima ? (
                  <DescriptionList cols={2} dense items={[
                    { label: 'Velocidad', value: ultima.speed ? `${fmtNumero(ultima.speed, 1)} nudos` : '—' },
                    { label: 'Rumbo', value: ultima.course ? `${fmtNumero(ultima.course)}°` : '—' },
                    { label: 'Destino', value: ultima.destination || selectedVessel.destination_label || '—' },
                    { label: 'Última posición', value: ultima.fetched_at ? fmtDateLarga(ultima.fetched_at, { hora: true }) : '—' },
                    selectedVessel.eta_manual ? { label: 'Llegada estimada', value: fmtDateLarga(selectedVessel.eta_manual, { hora: true }) } : null,
                  ].filter(Boolean)} />
                ) : selectedVessel ? (
                  <EmptyState compact icon={MapPin} title="Sin datos de posición" description="Esta embarcación todavía no tiene posiciones registradas." />
                ) : null}
              </Card.Body>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Editar embarcación' : 'Nueva embarcación'}
        description="Se necesita el IMO o el MMSI para ubicarla."
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editItem ? 'Guardar cambios' : 'Crear embarcación'}</Button>
          </>
        )}
      >
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <Input label="Nombre de la embarcación" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} required placeholder="Ej.: MSC Pamela" error={errors.display_name} />
          <FormGrid cols={2}>
            <Input label="IMO" value={form.imo} onChange={e => setForm({ ...form, imo: e.target.value })} placeholder="7 dígitos" inputMode="numeric" error={errors.imo} />
            <Input label="MMSI" value={form.mmsi} onChange={e => setForm({ ...form, mmsi: e.target.value })} placeholder="9 dígitos" inputMode="numeric" error={errors.mmsi} />
          </FormGrid>
          <FormGrid cols={2}>
            <Select label="Tipo de seguimiento" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={TYPE_OPTS} />
            <Select label="Estado" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTS} />
          </FormGrid>
          <FormGrid cols={2}>
            <Input label="Línea naviera" value={form.shipping_line} onChange={e => setForm({ ...form, shipping_line: e.target.value })} placeholder="Ej.: MSC, Maersk" />
            <Input label="Cliente asociado" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Nombre del cliente" />
          </FormGrid>
          <FormGrid cols={2}>
            <Input label="Origen" value={form.origin_label} onChange={e => setForm({ ...form, origin_label: e.target.value })} placeholder="Ej.: Miami, FL" />
            <Input label="Destino" value={form.destination_label} onChange={e => setForm({ ...form, destination_label: e.target.value })} placeholder="Ej.: San Antonio, Chile" />
          </FormGrid>
          <Input label="Llegada estimada" type="datetime-local" value={form.eta_manual} onChange={e => setForm({ ...form, eta_manual: e.target.value })} hint="Se muestra al cliente como fecha estimada de arribo." />
        </form>
      </Modal>
    </>
  );
}
