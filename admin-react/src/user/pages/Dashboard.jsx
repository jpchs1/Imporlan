import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { getMyOrders, getMyPaymentRequests, getMyConversations, getFeaturedVessels, getMyReports, getMyListings } from '../api';
import { fmtDate, fmtCLP, cn, statusColor } from '../../shared/lib/utils';
import { Card, Badge, Spinner, SkeletonCard } from '../../shared/components/UI';

function StatCard({ label, value, icon, color, onClick, subtitle }) {
  const colors = {
    cyan:   { bg: 'bg-cyan-50',    text: 'text-cyan-600',    gradient: 'from-cyan-500 to-cyan-600' },
    amber:  { bg: 'bg-amber-50',   text: 'text-amber-600',   gradient: 'from-amber-500 to-amber-600' },
    indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-600',  gradient: 'from-indigo-500 to-indigo-600' },
    emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-emerald-600' },
    violet: { bg: 'bg-violet-50',  text: 'text-violet-600',  gradient: 'from-violet-500 to-violet-600' },
    red:    { bg: 'bg-red-50',     text: 'text-red-600',     gradient: 'from-red-500 to-red-600' },
  };
  const c = colors[color] || colors.cyan;

  return (
    <Card className="card-hover cursor-pointer relative overflow-hidden group" onClick={onClick}>
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${c.gradient} opacity-[0.04] rounded-full -translate-y-6 translate-x-6 group-hover:opacity-[0.08] transition-opacity`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', c.bg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickLink({ label, icon, to, color }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group bg-white">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110', color)}>
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </button>
  );
}

function RecentOrderRow({ order, onClick }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 py-2.5 px-1 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/50 rounded-lg transition">
      <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
        <span className="text-cyan-600 text-[10px] font-bold">#{order.order_number?.slice(-3) || '?'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{order.asset_name || order.plan_name || `Expediente #${order.order_number}`}</p>
        <p className="text-[11px] text-slate-400">{fmtDate(order.created_at)}</p>
      </div>
      <Badge className={cn(statusColor(order.status), 'text-[10px]')}>{(order.status || '').replace(/_/g, ' ')}</Badge>
    </div>
  );
}

function PendingPaymentRow({ req, onClick }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 py-2.5 px-1 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50/50 rounded-lg transition">
      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{req.title}</p>
        <p className="text-[11px] text-slate-400">{fmtDate(req.created_at)}</p>
      </div>
      <span className="text-sm font-bold text-slate-800">{fmtCLP(req.amount_clp)}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = user?.name || user?.email || 'Usuario';

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [reports, setReports] = useState([]);
  const [myListings, setMyListings] = useState([]);

  useEffect(() => {
    async function loadAll() {
      const results = await Promise.allSettled([
        getMyOrders().catch(() => ({ orders: [] })),
        getMyPaymentRequests('all').catch(() => ({ requests: [] })),
        getMyConversations().catch(() => ({ conversations: [] })),
        getFeaturedVessels().catch(() => ({ vessels: [] })),
        getMyReports(),
        getMyListings(),
      ]);

      const [ordersR, paymentsR, convsR, vesselsR, reportsR, listingsR] = results;

      if (ordersR.status === 'fulfilled') {
        const d = ordersR.value;
        setOrders(d.success && d.orders ? d.orders : []);
      }
      if (paymentsR.status === 'fulfilled') {
        const d = paymentsR.value;
        const all = d.requests || d.items || [];
        setPendingPayments(all.filter(r => r.status === 'pending'));
      }
      if (convsR.status === 'fulfilled') {
        const d = convsR.value;
        setConversations(d.conversations || []);
      }
      if (vesselsR.status === 'fulfilled') {
        const d = vesselsR.value;
        setVessels(d.success && d.vessels ? d.vessels : (Array.isArray(d) ? d : []));
      }
      if (reportsR.status === 'fulfilled') {
        const d = reportsR.value;
        setReports(d.reports || []);
      }
      if (listingsR.status === 'fulfilled') {
        const d = listingsR.value;
        setMyListings(d.listings || d.data || []);
      }

      setLoading(false);
    }
    loadAll();
  }, []);

  // Derived stats
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'canceled' && o.status !== 'expired');
  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const activeVessels = vessels.filter(v => v.status === 'active');
  const pendingTotal = pendingPayments.reduce((sum, r) => sum + (r.amount_clp || 0), 0);
  const activeListings = myListings.filter(l => l.status === 'active');
  const lastActivity = orders
    .map(o => o.updated_at || o.created_at)
    .filter(Boolean)
    .sort()
    .pop();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos dias' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const initials = (name || 'U').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  if (loading) return (
    <div className="max-w-7xl mx-auto pb-12 space-y-5">
      <div className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{[1,2].map(i => <SkeletonCard key={i} />)}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Hero - greeting */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-400 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-2xl shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-2">
                <span className={cn('w-1.5 h-1.5 rounded-full', pendingPayments.length > 0 ? 'bg-amber-400 animate-pulse' : activeOrders.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400')} />
                {pendingPayments.length > 0
                  ? `${pendingPayments.length} pago${pendingPayments.length > 1 ? 's' : ''} pendiente${pendingPayments.length > 1 ? 's' : ''}`
                  : activeOrders.length > 0
                    ? `${activeOrders.length} expediente${activeOrders.length > 1 ? 's' : ''} activo${activeOrders.length > 1 ? 's' : ''}`
                    : 'Estas al dia'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{greeting}, {name.split(' ')[0]}</h1>
              <p className="text-sm text-slate-300 mt-1">Resumen de tu actividad en Imporlan</p>
            </div>
          </div>
          {lastActivity && (
            <div className="text-right shrink-0">
              <p className="uppercase tracking-[0.18em] font-bold text-[10px] text-cyan-300/80">Ultima actualizacion</p>
              <p className="text-slate-200 font-semibold mt-1">{fmtDate(lastActivity)}</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Expedientes Activos" value={activeOrders.length} color="cyan"
          subtitle={orders.length > activeOrders.length ? `${orders.length} totales` : 'En proceso'}
          onClick={() => navigate('/expedientes')}
          icon={<svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
        />
        <StatCard
          label="Pagos Pendientes" value={pendingPayments.length} color={pendingPayments.length > 0 ? 'amber' : 'emerald'}
          subtitle={pendingPayments.length > 0 ? fmtCLP(pendingTotal) : 'Al dia'}
          onClick={() => navigate('/payments')}
          icon={<svg className={cn('w-5 h-5', pendingPayments.length > 0 ? 'text-amber-600' : 'text-emerald-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
        />
        <StatCard
          label="Mensajes Sin Leer" value={unreadMessages} color={unreadMessages > 0 ? 'red' : 'emerald'}
          subtitle={`${conversations.length} conversacion${conversations.length !== 1 ? 'es' : ''}`}
          onClick={() => navigate('/messages')}
          icon={<svg className={cn('w-5 h-5', unreadMessages > 0 ? 'text-red-600' : 'text-emerald-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
        />
        <StatCard
          label="Seguimiento" value={activeVessels.length} color="emerald"
          subtitle={activeVessels.length > 0 ? 'Envios en ruta' : 'Sin envios activos'}
          onClick={() => navigate('/tracking')}
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
      </div>

      {/* Pending payment alert (priority over SLA) */}
      {pendingPayments.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/payments')}
          className="w-full text-left mb-4 p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center gap-4 hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-bold text-amber-900">
              Tenes {pendingPayments.length} pago{pendingPayments.length > 1 ? 's' : ''} pendiente{pendingPayments.length > 1 ? 's' : ''} por <span className="text-amber-700">{fmtCLP(pendingTotal)}</span>
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">Click para ver y pagar</p>
          </div>
          <svg className="w-5 h-5 text-amber-500 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}

      {/* SLA banner */}
      <div className="mb-5 px-4 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div className="flex-1 min-w-0 text-xs sm:text-sm">
          <p className="font-semibold text-blue-900">Tiempos de respuesta</p>
          <p className="text-blue-800/80 mt-0.5 leading-relaxed">
            Respondemos cotizaciones y consultas en <strong className="font-semibold text-blue-900">48-72 horas habiles</strong>.
            Para urgencias, escribinos por <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500">WhatsApp</a>.
          </p>
        </div>
      </div>

      {/* Activity row: 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Recent Orders */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 text-cyan-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-sm">Expedientes recientes</h2>
                <p className="text-[11px] text-slate-400">Ultimos en tu cuenta</p>
              </div>
            </div>
            <button onClick={() => navigate('/expedientes')} className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 inline-flex items-center gap-1">
              Ver todos
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {orders.length === 0 ? (
            <div className="py-8 text-center">
              <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              <p className="text-sm text-slate-500 font-medium">Aun no tenes expedientes</p>
              <a href="#/quotation" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 transition">
                Cotizar ahora
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
          ) : (
            <div>
              {orders.slice(0, 5).map(o => (
                <RecentOrderRow key={o.id} order={o} onClick={() => navigate('/expedientes')} />
              ))}
            </div>
          )}
        </Card>

        {/* Pending Payments + Recent Reports */}
        <div className="space-y-5 flex flex-col">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', pendingPayments.length > 0 ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600' : 'bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600')}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Pagos pendientes</h2>
                  <p className="text-[11px] text-slate-400">{pendingPayments.length > 0 ? `${fmtCLP(pendingTotal)} en total` : 'Estado al dia'}</p>
                </div>
              </div>
              <button onClick={() => navigate('/payments')} className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 inline-flex items-center gap-1">
                Ver todos
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            {pendingPayments.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 bg-emerald-50/40 rounded-lg text-sm text-emerald-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                <span className="font-semibold">Sin pagos pendientes</span>
              </div>
            ) : (
              pendingPayments.slice(0, 3).map(r => (
                <PendingPaymentRow key={r.id} req={r} onClick={() => navigate('/payments')} />
              ))
            )}
          </Card>

          {reports.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 text-violet-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-sm">Reportes recientes</h2>
                    <p className="text-[11px] text-slate-400">{reports.length} disponible{reports.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button onClick={() => navigate('/documents')} className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 inline-flex items-center gap-1">
                  Ver todos
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              {reports.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2.5 px-1 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 ring-1 ring-violet-100">
                    <span className="text-violet-600 text-[10px] font-bold">v{r.version || 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">Reporte #{r.order_number || r.id}</p>
                    <p className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</p>
                  </div>
                  {r.view_url && (
                    <a href={r.view_url} target="_blank" rel="noreferrer" className="text-xs text-violet-700 font-semibold hover:text-violet-800 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 hover:bg-violet-100 transition">
                      Ver
                    </a>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Quick Links - rich tiles */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-slate-800">Accesos rapidos</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Atajos a las secciones mas usadas</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Expedientes', to: '/expedientes', accent: 'cyan', subtitle: `${activeOrders.length} activos`, icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
            { label: 'Pagos', to: '/payments', accent: 'amber', subtitle: pendingPayments.length > 0 ? `${pendingPayments.length} pendiente${pendingPayments.length > 1 ? 's' : ''}` : 'Al dia', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { label: 'Mensajes', to: '/messages', accent: 'indigo', subtitle: unreadMessages > 0 ? `${unreadMessages} sin leer` : 'Al dia', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
            { label: 'Marketplace', to: '/marketplace', accent: 'emerald', subtitle: activeListings.length > 0 ? `${activeListings.length} publicacion${activeListings.length > 1 ? 'es' : ''}` : 'Compra y vende', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
            { label: 'Documentos', to: '/documents', accent: 'violet', subtitle: 'Archivos y reportes', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
            { label: 'Seguimiento', to: '/tracking', accent: 'teal', subtitle: activeVessels.length > 0 ? `${activeVessels.length} en ruta` : 'AIS tiempo real', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
          ].map(q => {
            const accentClasses = {
              cyan: 'from-cyan-500/15 to-blue-500/10 text-cyan-600 hover:border-cyan-300 hover:shadow-cyan-100/50',
              amber: 'from-amber-500/15 to-orange-500/10 text-amber-600 hover:border-amber-300 hover:shadow-amber-100/50',
              indigo: 'from-indigo-500/15 to-violet-500/10 text-indigo-600 hover:border-indigo-300 hover:shadow-indigo-100/50',
              emerald: 'from-emerald-500/15 to-teal-500/10 text-emerald-600 hover:border-emerald-300 hover:shadow-emerald-100/50',
              violet: 'from-violet-500/15 to-purple-500/10 text-violet-600 hover:border-violet-300 hover:shadow-violet-100/50',
              teal: 'from-teal-500/15 to-cyan-500/10 text-teal-600 hover:border-teal-300 hover:shadow-teal-100/50',
            };
            const cls = accentClasses[q.accent];
            return (
              <button
                key={q.to}
                type="button"
                onClick={() => navigate(q.to)}
                className={cn(
                  'group relative bg-white border border-slate-200/70 rounded-2xl p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5',
                  cls.split(' ').filter(c => c.startsWith('hover:')).join(' ')
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2', cls.split(' ').filter(c => !c.startsWith('hover:')).join(' '))}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={q.icon}/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800">{q.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{q.subtitle}</p>
                <svg className="absolute top-3 right-3 w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
