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

  if (loading) return (
    <div className="space-y-6">
      <div><div className="h-8 w-40 sm:w-64 bg-slate-100 rounded-lg animate-pulse mb-2" /><div className="h-4 w-32 sm:w-48 bg-slate-100 rounded-lg animate-pulse" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{[1,2].map(i => <SkeletonCard key={i} />)}</div>
    </div>
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos dias' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {greeting}, {name}
        </h1>
        <p className="text-sm text-slate-400 mt-1">Resumen de tu actividad en Imporlan</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Expedientes Activos" value={activeOrders.length} color="cyan"
          subtitle={orders.length > activeOrders.length ? `${orders.length} totales` : undefined}
          onClick={() => navigate('/expedientes')}
          icon={<svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
        />
        <StatCard
          label="Pagos Pendientes" value={pendingPayments.length} color={pendingPayments.length > 0 ? 'amber' : 'emerald'}
          subtitle={pendingPayments.length > 0 ? fmtCLP(pendingTotal) : 'Al dia'}
          onClick={() => navigate('/payments')}
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
        />
        <StatCard
          label="Mensajes Sin Leer" value={unreadMessages} color={unreadMessages > 0 ? 'red' : 'emerald'}
          subtitle={`${conversations.length} conversacion${conversations.length !== 1 ? 'es' : ''}`}
          onClick={() => navigate('/messages')}
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
        />
        <StatCard
          label="Seguimiento" value={activeVessels.length} color="emerald"
          subtitle={activeVessels.length > 0 ? 'Envios en ruta' : 'Sin envios activos'}
          onClick={() => navigate('/tracking')}
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
      </div>

      {/* SLA Info */}
      <div className="mb-6 px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800">Informacion sobre tiempos de respuesta</p>
          <p className="text-xs text-blue-600 mt-1">Nuestro equipo responde cotizaciones y consultas en un plazo de <strong>48-72 horas habiles</strong>. Para urgencias, contacta via WhatsApp al +56 9 4021 1459.</p>
        </div>
      </div>

      {/* Alert banner for pending payments */}
      {pendingPayments.length > 0 && (
        <div
          className="mb-6 px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-sm transition"
          onClick={() => navigate('/payments')}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Tienes {pendingPayments.length} pago{pendingPayments.length > 1 ? 's' : ''} pendiente{pendingPayments.length > 1 ? 's' : ''} por {fmtCLP(pendingTotal)}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Haz click para ver y pagar</p>
          </div>
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Recent Orders */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              Expedientes Recientes
            </h2>
            <button onClick={() => navigate('/expedientes')} className="text-xs text-cyan-600 font-medium hover:text-cyan-700">Ver todos</button>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No tienes expedientes</p>
          ) : (
            <div>
              {orders.slice(0, 5).map(o => (
                <RecentOrderRow key={o.id} order={o} onClick={() => navigate('/expedientes')} />
              ))}
            </div>
          )}
        </Card>

        {/* Pending Payments + Recent Reports */}
        <div className="space-y-5">
          {/* Pending Payments */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                Pagos Pendientes
              </h2>
              <button onClick={() => navigate('/payments')} className="text-xs text-cyan-600 font-medium hover:text-cyan-700">Ver todos</button>
            </div>
            {pendingPayments.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-sm text-emerald-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Sin pagos pendientes
              </div>
            ) : (
              pendingPayments.slice(0, 3).map(r => (
                <PendingPaymentRow key={r.id} req={r} onClick={() => navigate('/payments')} />
              ))
            )}
          </Card>

          {/* Recent Reports */}
          {reports.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Reportes Recientes
                </h2>
                <button onClick={() => navigate('/documents')} className="text-xs text-cyan-600 font-medium hover:text-cyan-700">Ver todos</button>
              </div>
              {reports.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <span className="text-violet-600 text-[10px] font-bold">v{r.version || 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">Reporte #{r.order_number || r.id}</p>
                    <p className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</p>
                  </div>
                  {r.view_url && (
                    <a href={r.view_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 font-medium hover:text-cyan-700">Ver</a>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <Card>
        <h2 className="font-bold text-slate-800 mb-4">Accesos Rapidos</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickLink label="Expedientes" to="/expedientes" color="bg-cyan-50"
            icon={<svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
          />
          <QuickLink label="Pagos" to="/payments" color="bg-amber-50"
            icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
          />
          <QuickLink label="Mensajes" to="/messages" color="bg-indigo-50"
            icon={<svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
          />
          <QuickLink label="Marketplace" to="/marketplace" color="bg-emerald-50"
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/></svg>}
          />
          <QuickLink label="Documentos" to="/documents" color="bg-violet-50"
            icon={<svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>}
          />
          <QuickLink label="Seguimiento" to="/tracking" color="bg-teal-50"
            icon={<svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
        </div>
      </Card>
    </div>
  );
}
