import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPurchases } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Spinner } from '../../shared/components/UI';

const PLANS = [
  {
    id: 'fragata', name: 'Fragata', badge: 'Basico',
    desc: 'Ideal para una primera busqueda rapida',
    proposals: 5, days: 7, price: 67600, usd: 67.60,
    gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    features: ['5 propuestas de embarcaciones', 'Monitoreo por 7 dias', 'Busqueda en USA y Chile', 'Soporte por email', 'Panel de seguimiento'],
  },
  {
    id: 'capitan', name: 'Capitan de Navio', badge: 'Mas Popular', popular: true,
    desc: 'El plan mas elegido por nuestros clientes',
    proposals: 9, days: 14, price: 119600, usd: 119.60,
    gradient: 'from-indigo-500 to-violet-600', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300',
    icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    features: ['9 propuestas de embarcaciones', 'Monitoreo por 14 dias', 'Busqueda en USA y Chile', 'Soporte prioritario', 'Panel de seguimiento', 'Agente dedicado'],
  },
  {
    id: 'almirante', name: 'Almirante', badge: 'Premium',
    desc: 'Servicio completo con reporte de inteligencia artificial',
    proposals: 15, days: 21, price: 189600, usd: 189.60,
    gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    features: ['15 propuestas de embarcaciones', 'Monitoreo por 21 dias', 'Busqueda en USA y Chile', 'Soporte prioritario 24/7', 'Panel de seguimiento', 'Agente dedicado', 'Reporte IA incluido'],
  },
];

function PlanCard({ plan }) {
  return (
    <div className={cn(
      'relative bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl group',
      plan.popular ? `ring-2 ring-indigo-400 shadow-xl ${plan.border}` : `shadow-sm hover:shadow-lg ${plan.border}`
    )}>
      {/* Popular ribbon */}
      {plan.popular && (
        <div className={cn('bg-gradient-to-r text-white text-[11px] font-bold text-center py-1.5 uppercase tracking-widest', plan.gradient)}>
          {plan.badge}
        </div>
      )}

      <div className="p-7">
        {/* Icon + Badge */}
        <div className="flex items-start justify-between mb-5">
          <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', plan.gradient)}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={plan.icon}/></svg>
          </div>
          {!plan.popular && (
            <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase', plan.bg, plan.text)}>{plan.badge}</span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold text-slate-900 mb-1">Plan {plan.name}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{plan.desc}</p>

        {/* Metrics */}
        <div className="flex gap-4 my-5 py-4 border-y border-slate-100">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-slate-900">{plan.proposals}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Propuestas</p>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-slate-900">{plan.days}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Dias</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{fmtCLP(plan.price)}</span>
            <span className="text-sm text-slate-400 font-medium">CLP</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">USD ${plan.usd} · pago unico</p>
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-7">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5', plan.bg)}>
                <svg className={cn('w-3 h-3', plan.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a href="https://www.imporlan.cl/#planes" target="_blank" rel="noreferrer" className="block">
          {plan.popular ? (
            <button className={cn('w-full py-3.5 rounded-xl text-white font-semibold text-sm bg-gradient-to-r shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]', plan.gradient)}>
              Contratar Plan
            </button>
          ) : (
            <button className={cn('w-full py-3.5 rounded-xl font-semibold text-sm border-2 transition-all duration-200 hover:shadow-md active:scale-[0.98]', plan.border, plan.text, `hover:${plan.bg}`)}>
              Contratar Plan
            </button>
          )}
        </a>
      </div>
    </div>
  );
}

export default function Plans() {
  const navigate = useNavigate();
  const [userPlans, setUserPlans] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyPurchases();
        setUserPlans(data.plans || []);
        setLinks(data.links || []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Hero header */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/25">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Planes de Busqueda</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">Elige el plan que mejor se adapte a tus necesidades. Nuestro equipo buscara las mejores embarcaciones para ti.</p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>

      {/* Guarantee bar */}
      <div className="flex flex-wrap justify-center gap-6 mb-10 py-5 border-y border-slate-100">
        {[
          { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', text: 'Pago 100% seguro' },
          { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', text: 'Respuesta en 48 hrs' },
          { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', text: 'Soporte dedicado' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
            {item.text}
          </div>
        ))}
      </div>

      {/* User's contracted plans */}
      {userPlans.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Mis Planes Contratados ({userPlans.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userPlans.map((p, i) => (
              <Card key={i} className={cn('relative overflow-hidden', p.status === 'active' && 'border-cyan-200')}>
                {p.status === 'active' && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-500" />}
                <div className="flex items-start justify-between mb-3">
                  <p className="font-bold text-slate-800">{p.planName || p.plan_name || 'Plan'}</p>
                  <Badge className={p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{p.status === 'active' ? 'Activo' : p.status}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-slate-500">
                  {p.startDate && <div className="flex justify-between"><span>Inicio</span><span className="text-slate-700">{fmtDate(p.startDate)}</span></div>}
                  {p.endDate && <div className="flex justify-between"><span>Vence</span><span className="text-slate-700">{fmtDate(p.endDate)}</span></div>}
                  {p.days && <div className="flex justify-between"><span>Duracion</span><span className="text-slate-700">{p.days} dias</span></div>}
                  {p.price && <div className="flex justify-between"><span>Precio</span><span className="font-bold text-slate-800">{fmtCLP(p.price)}</span></div>}
                  {p.payment_method && <div className="flex justify-between"><span>Metodo</span><span className="text-slate-700 capitalize">{p.payment_method}</span></div>}
                </div>
                {p.proposalsTotal > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Propuestas</span><span>{p.proposalsReceived || 0}/{p.proposalsTotal}</span></div>
                    <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(((p.proposalsReceived || 0) / p.proposalsTotal) * 100, 100)}%` }} /></div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Contracted links */}
      {links.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Links Contratados ({links.length})</h2>
          <div className="space-y-2">
            {links.map((l, i) => (
              <Card key={i} className="py-3">
                <div className="flex items-center gap-3">
                  <Badge className={l.status === 'active' ? 'bg-emerald-100 text-emerald-700' : l.status === 'en_revision' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>{l.status}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{l.url || l.name || 'Link'}</p>
                    <p className="text-xs text-slate-400">{fmtDate(l.contractedAt || l.created_at)}</p>
                  </div>
                  {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 hover:text-cyan-700 font-medium shrink-0">Abrir</a>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
