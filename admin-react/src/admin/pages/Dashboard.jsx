import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getDashboard } from '../api';
import { fmtCLP, fmtDate, purchaseTypeLabel, paymentMethodLabel } from '../../shared/lib/utils';
import { fmtNumero } from '../../shared/lib/format';
import { statusMeta } from '../../shared/lib/status';
import { Card, StatTile, PageHeader, Button, DataTable, Badge, StatusBadge, Money, ErrorState, EmptyState, Skeleton } from '../../shared/components/UI';
import { RefreshCw, ArrowUpRight, ChartColumn, Receipt } from '../../shared/components/Icons';
import { useCarga } from './operacion/useCarga';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* Colores del gráfico: una sola serie en el color de marca; ejes y grilla en
   los neutros del sistema (tokens, así el modo oscuro los redefine). */
const SERIE = 'var(--color-brand-600)';
const SERIE_HOVER = 'var(--color-brand-700)';
const GRILLA = 'var(--color-line)';
const EJE = { fontSize: 12, fill: 'var(--color-ink-500)' };

/** Ancho real del contenedor (recharts con medidas explícitas: no se queda en 0). */
function useAncho(fallback = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => { const n = Math.round(el.getBoundingClientRect().width); if (n > 0) setW(n); };
    const raf = requestAnimationFrame(medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener('resize', medir);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  return [ref, w || fallback];
}

function compacto(v) {
  if (v >= 1e6) return `${fmtNumero(v / 1e6, v % 1e6 ? 1 : 0)} M`;
  if (v >= 1e3) return `${fmtNumero(Math.round(v / 1e3))} k`;
  return fmtNumero(v);
}

function TooltipMonto({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-surface border border-line rounded-md shadow-pop px-3 py-2 min-w-[140px]">
      <p className="text-xs text-ink-500 mb-1">{p.titulo}</p>
      <Money clp={p.value} size="md" />
    </div>
  );
}

function TooltipConteo({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-surface border border-line rounded-md shadow-pop px-3 py-2 min-w-[120px]">
      <p className="text-xs text-ink-500 mb-0.5">{p.name}</p>
      <p className="text-sm font-semibold text-ink-900 tabular">{fmtNumero(p.value)} {p.value === 1 ? 'pago' : 'pagos'}</p>
    </div>
  );
}

function GraficoIngresos({ data }) {
  const [ref, w] = useAncho();
  return (
    <div ref={ref} className="w-full">
      <AreaChart width={w} height={240} data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ingresosArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIE} stopOpacity={0.14} />
            <stop offset="100%" stopColor={SERIE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRILLA} vertical={false} />
        <XAxis dataKey="name" tick={EJE} axisLine={{ stroke: GRILLA }} tickLine={false} tickMargin={8} />
        <YAxis tickFormatter={compacto} tick={EJE} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TooltipMonto />} cursor={{ stroke: 'var(--color-line-strong)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="value" stroke={SERIE} strokeWidth={2} fill="url(#ingresosArea)"
          dot={{ r: 4, fill: SERIE, stroke: 'var(--color-surface)', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: SERIE_HOVER, stroke: 'var(--color-surface)', strokeWidth: 2 }} />
      </AreaChart>
    </div>
  );
}

function GraficoMedios({ data }) {
  const [ref, w] = useAncho(480);
  return (
    <div ref={ref} className="w-full">
      <BarChart width={w} height={220} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="35%">
        <CartesianGrid stroke={GRILLA} vertical={false} />
        <XAxis dataKey="name" tick={EJE} axisLine={{ stroke: GRILLA }} tickLine={false} tickMargin={8} interval={0} />
        <YAxis allowDecimals={false} tick={EJE} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={<TooltipConteo />} cursor={{ fill: 'var(--color-canvas)' }} />
        <Bar dataKey="value" fill={SERIE} radius={[4, 4, 0, 0]} maxBarSize={28} activeBar={{ fill: SERIE_HOVER }} />
      </BarChart>
    </div>
  );
}

/** Barras horizontales con la etiqueta del estado: se lee sin leyenda ni tooltip. */
function BarrasEstado({ data }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className="space-y-3">
      {data.map(d => (
        <li key={d.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
          <StatusBadge kind="compra" status={d.key} />
          <div className="h-2 rounded-sm bg-neutral-bg overflow-hidden" title={`${d.name}: ${fmtNumero(d.value)} de ${fmtNumero(total)}`}>
            <div className="h-full rounded-sm bg-brand-600" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-ink-900 tabular w-10 text-right">{fmtNumero(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Cargando() {
  return (
    <>
      <PageHeader title="Inicio" description="Resumen de la operación" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"><Skeleton.Stat /><Skeleton.Stat /><Skeleton.Stat /><Skeleton.Stat /></div>
      <Skeleton.Card lines={4} className="mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4"><Skeleton.Card lines={3} /><Skeleton.Card lines={3} /></div>
      <Card padding="none"><Skeleton.TableRows rows={5} cols={5} /></Card>
    </>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { datos: data, cargando, error, recargar } = useCarga(getDashboard, { mensaje: 'No se pudo cargar el resumen' });

  const serieIngresos = useMemo(() => {
    const meses = data?.revenue_by_month || [];
    const anios = new Set(meses.map(m => String(m.month).slice(0, 4)));
    return meses.map(m => {
      const anio = String(m.month).slice(0, 4);
      const idx = Number(String(m.month).slice(5, 7)) - 1;
      return {
        name: anios.size > 1 ? `${MESES[idx] || m.month} ${anio.slice(2)}` : (MESES[idx] || m.month),
        titulo: `${MESES_LARGOS[idx] || m.month} ${anio}`,
        value: Number(m.amount) || 0,
      };
    });
  }, [data]);

  if (cargando) return <Cargando />;

  // Decir qué falló, y no solo que falló: una sesión vencida no es un servidor caído.
  if (!data) {
    return (
      <>
        <PageHeader title="Inicio" description="Resumen de la operación" />
        <Card><ErrorState title="No se pudo cargar el resumen" message={error || 'El servidor no devolvió datos.'} onRetry={recargar} /></Card>
      </>
    );
  }

  const porEstado = (data.submissions_by_status || []).map(s => ({ key: s.status, name: statusMeta('compra', s.status).label, value: Number(s.count) || 0 }));
  const porMedio = (data.payments_by_provider || []).map(p => ({ name: paymentMethodLabel(p.provider), value: Number(p.count) || 0 }));
  const actividad = data.recent_activity || [];

  // Delta real: mes actual vs. mes anterior de la misma serie.
  const n = serieIngresos.length;
  const prev = n >= 2 ? serieIngresos[n - 2].value : 0;
  const delta = n >= 2 && prev > 0 ? ((serieIngresos[n - 1].value - prev) / prev) * 100 : undefined;
  const pendientes = Number(data.pending_submissions) || 0;

  const colsActividad = [
    { key: 'date', header: 'Fecha', width: 110, cell: r => <span className="text-ink-500 whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: 'user_email', header: 'Cliente', cell: r => <span className="font-medium text-ink-900 block max-w-[220px] truncate" title={r.user_email}>{r.user_email}</span> },
    { key: 'type', header: 'Tipo', priority: 2, cell: r => <Badge>{purchaseTypeLabel(r.type)}</Badge> },
    { key: 'description', header: 'Detalle', priority: 2, cell: r => <span className="block max-w-[240px] truncate" title={r.description || ''}>{r.description || '—'}</span> },
    { key: 'amount', header: 'Monto', align: 'right', width: 120, cell: r => <Money clp={r.amount} align="right" /> },
    { key: 'status', header: 'Estado', width: 120, cell: r => <StatusBadge kind="compra" status={r.status} /> },
  ];

  const irACompras = (r) => navigate(`/purchases?q=${encodeURIComponent(r.user_email || '')}`);

  return (
    <>
      <PageHeader
        title="Inicio"
        description="Resumen de la operación"
        actions={<Button variant="secondary" icon={RefreshCw} onClick={recargar}>Actualizar</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="Ingresos del mes" value={fmtCLP(data.revenue_month ?? 0)} delta={delta} deltaLabel={delta !== undefined ? 'vs. mes anterior' : undefined} hint={delta === undefined ? 'Solo pagos recibidos' : undefined} />
        <StatTile label="Ingresos totales" value={fmtCLP(data.total_revenue ?? 0)} hint={`${fmtNumero(data.total_submissions ?? 0)} compras · ${fmtNumero(data.total_users ?? 0)} clientes`} />
        <StatTile label="Planes activos" value={Number(data.active_plans) || 0} hint={`${fmtNumero(data.new_users_7d ?? 0)} ${Number(data.new_users_7d) === 1 ? 'cliente nuevo' : 'clientes nuevos'} en 7 días`} />
        <StatTile label="Pendientes de pago" value={pendientes} tone={pendientes > 0 ? 'warning' : undefined} hint={pendientes > 0 ? 'Compras sin pago confirmado' : 'Todo al día'} onClick={() => navigate('/purchases?estado=pending')} />
      </div>

      <Card className="mb-4">
        <Card.Header title="Ingresos por mes" description="Últimos 6 meses · solo pagos recibidos" />
        <Card.Body>
          {serieIngresos.length > 0
            ? <GraficoIngresos data={serieIngresos} />
            : <EmptyState compact icon={ChartColumn} title="Aún no hay pagos registrados" description="El gráfico se arma con los pagos recibidos mes a mes." />}
        </Card.Body>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <Card.Header title="Compras por estado" description={`${fmtNumero(porEstado.reduce((s, d) => s + d.value, 0))} compras en total`} />
          <Card.Body>
            {porEstado.length > 0
              ? <BarrasEstado data={porEstado} />
              : <EmptyState compact icon={Receipt} title="Sin compras todavía" />}
          </Card.Body>
        </Card>
        <Card>
          <Card.Header title="Métodos de pago" description="Pagos recibidos por medio" />
          <Card.Body>
            {porMedio.length > 0
              ? <GraficoMedios data={porMedio} />
              : <EmptyState compact icon={ChartColumn} title="Sin pagos todavía" />}
          </Card.Body>
        </Card>
      </div>

      <Card>
        <Card.Header title="Actividad reciente" description={`${fmtNumero(actividad.length)} ${actividad.length === 1 ? 'movimiento' : 'movimientos'}`}
          actions={<Button variant="ghost" size="sm" iconRight={ArrowUpRight} onClick={() => navigate('/purchases')}><span className="hidden sm:inline">Ver todas las compras</span><span className="sm:hidden">Ver todas</span></Button>} />
        <DataTable
          columns={colsActividad}
          data={actividad}
          rowKey={r => `${r.date}-${r.user_email}-${r.amount}-${r.description}`}
          pageSize={0}
          onRowClick={irACompras}
          aria-label="Actividad reciente"
          emptyState={<EmptyState compact icon={Receipt} title="Sin actividad reciente" description="Aquí aparecen las últimas compras y pagos." />}
          mobileCard={r => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink-900 truncate">{r.user_email}</p>
                <p className="text-13 text-ink-500 truncate">{r.description || purchaseTypeLabel(r.type)}</p>
                <p className="text-xs text-ink-500 mt-1">{fmtDate(r.date)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Money clp={r.amount} align="right" />
                <StatusBadge kind="compra" status={r.status} size="sm" />
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
