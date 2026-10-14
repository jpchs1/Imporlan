import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPurchases } from '../api';
import { fmtCLP, paymentMethodLabel, downloadCSV, statusLabel, PAID_STATUSES } from '../../shared/lib/utils';
import { fmtNumero } from '../../shared/lib/format';
import { PageHeader, Card, Button, Select, SearchInput, StatTile, ErrorState } from '../../shared/components/UI';
import { Download } from '../../shared/components/Icons';
import { useCarga } from './operacion/useCarga';
import { TablaCompras, DetalleCompra } from './operacion/TablaCompras';
import { textoBusqueda } from './operacion/compras';

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const { datos, cargando, error, recargar } = useCarga(getPurchases, { mensaje: 'No se pudieron cargar los pagos' });
  // Pagos = compras con dinero recibido. "Vencido" cuenta: es un plan que se
  // pagó y ya cerró; sacarlo haría bajar los ingresos solos con el tiempo.
  const items = useMemo(() => (datos?.items || []).filter(i => PAID_STATUSES.includes(i.status)), [datos]);
  const [selected, setSelected] = useState(null);

  const search = params.get('q') || '';
  const methodFilter = params.get('medio') || '';
  const setParam = (k, v) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const totalRevenue = items.reduce((s, i) => s + (i.amount_clp || 0), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
  const delMes = items.filter(i => (i.sort_time || 0) >= monthStart);
  const monthRevenue = delMes.reduce((s, i) => s + (i.amount_clp || 0), 0);
  const methods = [...new Set(items.map(i => i.payment_method).filter(Boolean))];

  const q = search.trim().toLowerCase();
  const filtered = items.filter(i => {
    if (methodFilter && i.payment_method !== methodFilter) return false;
    if (q && !textoBusqueda(i).includes(q)) return false;
    return true;
  });
  const filteredTotal = filtered.reduce((s, i) => s + (i.amount_clp || 0), 0);

  function exportCSV() {
    downloadCSV(`pagos-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: 'Fecha', value: r => r.created_at },
      { header: 'Email', value: r => r.user_email },
      { header: 'Descripción', value: r => r.plan_name || r.description },
      { header: 'Monto CLP', value: r => r.amount_clp },
      { header: 'Medio', value: r => paymentMethodLabel(r.payment_method) },
      { header: 'ID pago', value: r => r.payment_id },
      { header: 'ID compra', value: r => r.purchase_id },
      { header: 'Estado', value: r => statusLabel(r.status) },
    ], filtered);
  }

  const hayFiltro = !!(q || methodFilter);

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Compras con el pago recibido"
        actions={items.length > 0 && <Button variant="secondary" icon={Download} onClick={exportCSV}>Exportar CSV</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar los pagos" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <StatTile label="Pagos recibidos" value={items.length} loading={cargando} hint={items.length ? 'Planes, links y pagos directos' : undefined} />
            <StatTile label="Ingresos totales" value={fmtCLP(totalRevenue)} loading={cargando} hint="Histórico" />
            <StatTile label="Ingresos del mes" value={fmtCLP(monthRevenue)} loading={cargando} hint={`${fmtNumero(delMes.length)} ${delMes.length === 1 ? 'pago' : 'pagos'} este mes`} />
          </div>

          <Card padding="none">
            <div className="px-(--card-pad) pt-4 pb-3 border-b border-line">
              <div className="flex flex-col sm:flex-row gap-2">
                <SearchInput value={search} onChange={v => setParam('q', v)} placeholder="Buscar por correo, ID de pago o compra" className="flex-1" />
                <Select aria-label="Medio de pago" value={methodFilter} onChange={e => setParam('medio', e.target.value)} options={[
                  { value: '', label: 'Todos los medios' },
                  ...methods.map(m => ({ value: m, label: paymentMethodLabel(m) })),
                ]} className="w-full sm:w-48" />
              </div>
              {hayFiltro && !cargando && (
                <p className="text-13 text-ink-500 mt-2 tabular">{fmtNumero(filtered.length)} {filtered.length === 1 ? 'pago' : 'pagos'} · {fmtCLP(filteredTotal)}</p>
              )}
            </div>
            <TablaCompras
              items={filtered}
              loading={cargando}
              modo="pagos"
              onSelect={setSelected}
              emptyTitle={hayFiltro ? 'Ningún pago coincide con la búsqueda' : 'Sin pagos para mostrar'}
              emptyDescription={hayFiltro ? 'Prueba con otro texto o quita el filtro.' : 'Aquí aparecen las compras con el pago confirmado.'}
            />
          </Card>
        </>
      )}

      <DetalleCompra compra={selected} open={!!selected} onClose={() => setSelected(null)} canEdit={false} />
    </>
  );
}
