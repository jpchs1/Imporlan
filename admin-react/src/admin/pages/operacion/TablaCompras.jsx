import { Link } from 'react-router-dom';
import { fmtDate, fmtDateTime, purchaseTypeLabel, paymentMethodLabel } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { DataTable, StatusBadge, Money, Drawer, DescriptionList, Callout, Button, Select, EmptyState } from '../../../shared/components/UI';
import { ShoppingCart, ExternalLink } from '../../../shared/components/Icons';
import { autoCloseDate, PLAN_AUTO_CLOSE_DAYS, ESTADOS_COMPRA } from './compras';

/**
 * Tabla común de Compras y Pagos. `modo="pagos"` agrega la columna ID de pago.
 *   <TablaCompras items={filtradas} loading={cargando} onSelect={setSel} modo="compras" />
 */
export function TablaCompras({ items, loading, onSelect, modo = 'compras', emptyTitle = 'Sin compras registradas', emptyDescription }) {
  const columns = [
    { key: 'created_at', header: 'Fecha', width: 110, sortValue: r => r.sort_time || 0, cell: r => <span className="whitespace-nowrap text-ink-500">{fmtDate(r.created_at)}</span> },
    { key: 'cliente', header: 'Cliente', sortValue: r => r.payer_name || r.user_email, cell: r => (
      <div className="min-w-0 max-w-[240px]">
        <p className="font-medium text-ink-900 truncate" title={r.payer_name || ''}>{r.payer_name || r.user_email}</p>
        {r.payer_name && <p className="text-xs text-ink-500 truncate" title={r.user_email}>{r.user_email}</p>}
      </div>
    ) },
    { key: 'type', header: 'Tipo', priority: 2, cell: r => purchaseTypeLabel(r.type) },
    { key: 'descripcion', header: 'Descripción', priority: 2, cell: r => <span className="block max-w-[220px] truncate" title={r.plan_name || r.description || ''}>{r.plan_name || r.description || '—'}</span> },
    { key: 'amount_clp', header: 'Monto', align: 'right', width: 120, sortValue: r => r.amount_clp || 0, cell: r => <Money clp={r.amount_clp} align="right" /> },
    { key: 'payment_method', header: 'Medio', priority: 3, cell: r => paymentMethodLabel(r.payment_method) },
    ...(modo === 'pagos' ? [{ key: 'payment_id', header: 'ID pago', priority: 3, mono: true, cell: r => <span className="block max-w-[140px] truncate" title={r.payment_id || ''}>{r.payment_id || '—'}</span> }] : []),
    { key: 'status', header: 'Estado', width: 130, cell: r => (
      <div className="flex flex-col items-start gap-0.5">
        <StatusBadge kind="compra" status={r.status} />
        {r.expired_reason?.startsWith('auto_') && <span className="text-xs text-ink-500">Cierre automático</span>}
      </div>
    ) },
  ];

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={r => r.purchase_id}
      onRowClick={onSelect}
      loading={loading}
      pageSize={25}
      aria-label={modo === 'pagos' ? 'Pagos recibidos' : 'Compras'}
      emptyState={<EmptyState compact icon={ShoppingCart} title={emptyTitle} description={emptyDescription} />}
      mobileCard={r => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-ink-900 truncate">{r.payer_name || r.user_email}</p>
            <p className="text-13 text-ink-500 truncate">{r.plan_name || r.description || purchaseTypeLabel(r.type)}</p>
            <p className="text-xs text-ink-500 mt-1">{fmtDate(r.created_at)} · {paymentMethodLabel(r.payment_method)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Money clp={r.amount_clp} align="right" />
            <StatusBadge kind="compra" status={r.status} size="sm" />
          </div>
        </div>
      )}
    />
  );
}

/**
 * Detalle de una compra en Drawer. Con `canEdit`, el pie permite elegir un
 * estado nuevo y llama a `onChangeStatus(nuevo)` (la página confirma y guarda).
 */
export function DetalleCompra({ compra, open, onClose, canEdit = false, nuevoEstado, onNuevoEstado, onChangeStatus, saving = false }) {
  const c = compra;
  const closeDate = c ? autoCloseDate(c) : null;
  const items = c ? [
    { label: 'Cliente', value: (
      <>
        <span className="block">{c.payer_name || '—'}</span>
        <a href={`mailto:${c.user_email}`} className="text-brand-600 hover:underline break-all">{c.user_email}</a>
      </>
    ) },
    { label: 'Teléfono', value: c.payer_phone || '—' },
    { label: 'Tipo', value: purchaseTypeLabel(c.type) },
    { label: 'Medio de pago', value: paymentMethodLabel(c.payment_method) },
    { label: 'Fecha', value: fmtDateTime(c.created_at) },
    { label: 'ID de compra', value: c.purchase_id, mono: true },
    c.payment_id ? { label: 'ID de pago', value: c.payment_id, mono: true } : null,
    c.order_id ? { label: 'Expediente', value: <Link to={`/orders?new=${encodeURIComponent(c.order_id)}`} className="text-brand-600 hover:underline font-medium">{c.order_id}</Link> } : null,
    c.url ? { label: 'Link cotizado', full: true, value: <a href={c.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all inline-flex items-center gap-1">{c.url} <ExternalLink size={14} /></a> } : null,
  ].filter(Boolean) : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={c ? (c.plan_name || c.description || purchaseTypeLabel(c.type)) : ''}
      description={c ? `${purchaseTypeLabel(c.type)} · ${fmtDateLarga(c.created_at, { hora: true })}` : ''}
      width="md"
      footer={c && (canEdit ? (
        <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
          <Select
            aria-label="Nuevo estado"
            value={nuevoEstado}
            onChange={e => onNuevoEstado?.(e.target.value)}
            options={ESTADOS_COMPRA}
            className="w-full sm:w-44"
          />
          <Button onClick={() => onChangeStatus?.(nuevoEstado)} loading={saving} disabled={!nuevoEstado || nuevoEstado === c.status}>Actualizar estado</Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      ))}
    >
      {c && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <Money clp={c.amount_clp} size="xl" />
            <StatusBadge kind="compra" status={c.status} dot />
          </div>

          <DescriptionList cols={2} items={items} />

          {closeDate && (
            <Callout tone="info" compact title={`Se cierra automáticamente el ${fmtDateLarga(closeDate)}`}>
              {PLAN_AUTO_CLOSE_DAYS} días desde {c.reactivated_at ? 'la reactivación' : 'la compra'}.
            </Callout>
          )}
          {c.status === 'expired' && c.expired_at && (
            <Callout tone="neutral" compact title={`Vencida el ${fmtDateLarga(c.expired_at, { hora: true })}${c.expired_reason?.startsWith('auto_') ? ' por cierre automático' : ''}`}>
              Si la reactivas, el plazo de {PLAN_AUTO_CLOSE_DAYS} días corre desde hoy.
            </Callout>
          )}
        </div>
      )}
    </Drawer>
  );
}
