import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPurchases, updatePurchaseStatus } from '../api';
import { purchaseTypeLabel, paymentMethodLabel, downloadCSV, statusLabel } from '../../shared/lib/utils';
import { fmtDateLarga } from '../../shared/lib/format';
import { statusMeta } from '../../shared/lib/status';
import { useAuth } from '../../shared/context/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { PageHeader, Card, Button, Select, SearchInput, FilterChips, ErrorState, useConfirm } from '../../shared/components/UI';
import { Download } from '../../shared/components/Icons';
import { useCarga } from './operacion/useCarga';
import { TablaCompras, DetalleCompra } from './operacion/TablaCompras';
import { ESTADOS_COMPRA, PLAN_AUTO_CLOSE_DAYS, autoCloseDate, textoBusqueda } from './operacion/compras';

export default function Purchases() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canEdit = ['admin', 'support'].includes(user?.role);
  const [params, setParams] = useSearchParams();
  const { datos, cargando, error, recargar, refrescar } = useCarga(getPurchases, { mensaje: 'No se pudieron cargar las compras' });
  const items = useMemo(() => datos?.items || [], [datos]);

  // Los filtros viven en la URL: desde Inicio se llega con ?q=correo o ?estado=pending.
  const search = params.get('q') || '';
  const statusFilter = params.get('estado') || '';
  const typeFilter = params.get('tipo') || '';
  const setParam = (k, v) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // La paleta (⌘K) llega con ?id=PUR-…: abrir esa compra apenas esté la lista,
  // también si ya se estaba en la página. Al cerrar se quita el parámetro, así
  // volver a elegir la misma compra la vuelve a abrir.
  const idParam = params.get('id') || '';
  const abiertaPorUrl = useRef('');

  function abrirDetalle(c) { setSelected(c); setNewStatus(c.status); }
  function cerrarDetalle() {
    setSelected(null);
    abiertaPorUrl.current = '';
    if (params.has('id')) setParam('id', '');
  }

  useEffect(() => {
    if (!idParam || cargando || error || abiertaPorUrl.current === idParam) return;
    abiertaPorUrl.current = idParam;
    const c = items.find(i => String(i.purchase_id) === idParam);
    if (c) abrirDetalle(c);
    else toast?.(`No se encontró la compra ${idParam}`, 'warning');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, cargando, error, items]);

  async function handleStatusChange(nuevo) {
    if (!selected || !nuevo || nuevo === selected.status) return;
    // updatePurchaseStatus (api/admin_api.php) pone reactivated_at = hoy cuando
    // la compra pasa a pagada/activa desde otro estado: el plazo de cierre
    // automático se cuenta desde hoy, no desde la compra original.
    const reactiva = ['paid', 'active'].includes(nuevo) && !['paid', 'active'].includes(selected.status);
    const cierre = { ...selected, status: nuevo, ...(reactiva ? { reactivated_at: new Date().toISOString() } : {}) };
    const fechaCierre = autoCloseDate(cierre);
    const ok = await confirm({
      title: `¿Cambiar el estado a "${statusLabel(nuevo, 'compra')}"?`,
      description: `La compra ${selected.purchase_id} pasa de ${statusLabel(selected.status, 'compra')} a ${statusLabel(nuevo, 'compra')}.`,
      detail: [
        selected.order_id ? `También se actualiza el expediente ${selected.order_id} (salvo que esté completado).` : 'También se actualiza el expediente asociado (salvo que esté completado).',
        fechaCierre ? `Al quedar ${statusLabel(nuevo, 'compra').toLowerCase()}, el plan se cierra solo el ${fmtDateLarga(fechaCierre)} (${PLAN_AUTO_CLOSE_DAYS} días${reactiva ? ' contados desde hoy' : ''}).` : null,
      ].filter(Boolean),
      confirmLabel: 'Actualizar estado',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const r = await updatePurchaseStatus(selected.purchase_id, nuevo);
      toast?.(r?.message || 'Estado actualizado', 'success');
      cerrarDetalle();
      refrescar();
    } catch (e) { toast?.(e.message || 'No se pudo actualizar el estado', 'error'); }
    setSaving(false);
  }

  const types = [...new Set(items.map(i => i.type).filter(Boolean))];
  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (typeFilter && i.type !== typeFilter) return false;
    if (q && !textoBusqueda(i).includes(q)) return false;
    return true;
  });

  const conteo = (st) => items.filter(i => (!typeFilter || i.type === typeFilter) && (!st || i.status === st)).length;
  const chips = [
    { id: '', label: 'Todas', count: conteo('') },
    ...ESTADOS_COMPRA.filter(e => conteo(e.value) > 0).map(e => ({ id: e.value, label: statusMeta('compra', e.value).label, count: conteo(e.value) })),
  ];

  function exportCSV() {
    downloadCSV(`compras-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'ID', value: r => r.purchase_id },
      { header: 'Fecha', value: r => r.created_at },
      { header: 'Email', value: r => r.user_email },
      { header: 'Nombre', value: r => r.payer_name },
      { header: 'Tipo', value: r => purchaseTypeLabel(r.type) },
      { header: 'Descripción', value: r => r.plan_name || r.description },
      { header: 'Monto CLP', value: r => r.amount_clp },
      { header: 'Medio', value: r => paymentMethodLabel(r.payment_method) },
      { header: 'ID pago', value: r => r.payment_id },
      { header: 'Estado', value: r => statusLabel(r.status) },
    ], filtered);
  }

  const hayFiltro = !!(q || statusFilter || typeFilter);

  return (
    <>
      <PageHeader
        title="Compras"
        description={cargando ? 'Cargando compras…' : `${items.length} ${items.length === 1 ? 'compra registrada' : 'compras registradas'}`}
        actions={items.length > 0 && <Button variant="secondary" icon={Download} onClick={exportCSV}>Exportar CSV</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar las compras" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <Card padding="none">
          <div className="px-(--card-pad) pt-4 pb-3 border-b border-line space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <SearchInput value={search} onChange={v => setParam('q', v)} placeholder="Buscar por correo, nombre, descripción o ID" className="flex-1" />
              <Select aria-label="Tipo de compra" value={typeFilter} onChange={e => setParam('tipo', e.target.value)} options={[
                { value: '', label: 'Todos los tipos' },
                ...types.map(t => ({ value: t, label: purchaseTypeLabel(t) })),
              ]} className="w-full sm:w-48" />
            </div>
            <FilterChips aria-label="Filtrar por estado" options={chips} value={statusFilter} onChange={v => setParam('estado', v)} onClear={() => setParam('estado', '')} />
          </div>
          <TablaCompras
            items={filtered}
            loading={cargando}
            onSelect={abrirDetalle}
            emptyTitle={hayFiltro ? 'Ninguna compra coincide con los filtros' : 'Sin compras registradas'}
            emptyDescription={hayFiltro ? 'Prueba con otro texto o quita los filtros.' : 'Aquí aparecen los planes, cotizaciones por links y pagos directos.'}
          />
        </Card>
      )}

      <DetalleCompra
        compra={selected}
        open={!!selected}
        onClose={cerrarDetalle}
        canEdit={canEdit}
        nuevoEstado={newStatus}
        onNuevoEstado={setNewStatus}
        onChangeStatus={handleStatusChange}
        saving={saving}
      />
    </>
  );
}
