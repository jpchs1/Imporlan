import { useState, useEffect, useMemo } from 'react';
import { getMyPurchases } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { Card, Badge, Button } from '../../shared/components/UI';

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

const FAQS = [
  { q: 'Que pasa si no encuentro la embarcacion ideal?', a: 'Te ofrecemos opciones adicionales sin costo extra. Si no encuentras nada, podes extender tu plan con un descuento.' },
  { q: 'Puedo cambiar de plan despues de contratar?', a: 'Si. Si quieres pasar a un plan superior, te descontamos lo pagado del nuevo plan. Hablalo con tu agente.' },
  { q: 'En que paises buscan embarcaciones?', a: 'Buscamos principalmente en USA y Chile, los dos mercados con mejor relacion precio-calidad para Sudamerica. Tambien evaluamos Europa si lo solicitas.' },
  { q: 'Cuando empieza a contar el plazo del plan?', a: 'Desde el dia que confirmas el pago. Te avisamos por email y queda visible en este panel.' },
];

function PlanCard({ plan, current, onContract }) {
  const isCurrent = current === plan.id;
  return (
    <div className={cn(
      'relative bg-white rounded-3xl border overflow-hidden transition-all duration-300 group flex flex-col',
      plan.popular
        ? `ring-2 ring-indigo-500/70 shadow-2xl shadow-indigo-500/15 ${plan.border} lg:scale-[1.02] hover:scale-[1.04]`
        : `shadow-sm hover:shadow-xl ${plan.border} hover:-translate-y-1`
    )}>
      {/* Popular ribbon */}
      {plan.popular && (
        <div className={cn('bg-gradient-to-r text-white text-[11px] font-bold text-center py-2 uppercase tracking-[0.2em]', plan.gradient)}>
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            {plan.badge}
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="bg-emerald-500 text-white text-[11px] font-bold text-center py-1.5 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
          Tu plan actual
        </div>
      )}

      <div className="p-6 sm:p-7 flex-1 flex flex-col">
        {/* Icon + Badge */}
        <div className="flex items-start justify-between mb-5">
          <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow shrink-0', plan.gradient)}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d={plan.icon}/></svg>
          </div>
          {!plan.popular && (
            <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', plan.bg, plan.text)}>{plan.badge}</span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-xl font-bold text-slate-900 mb-1">Plan {plan.name}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{plan.desc}</p>

        {/* Metrics */}
        <div className="flex gap-3 my-5">
          <div className={cn('flex-1 text-center py-3 rounded-xl', plan.bg)}>
            <p className={cn('text-3xl font-extrabold', plan.text)}>{plan.proposals}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Propuestas</p>
          </div>
          <div className={cn('flex-1 text-center py-3 rounded-xl', plan.bg)}>
            <p className={cn('text-3xl font-extrabold', plan.text)}>{plan.days}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Dias</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{fmtCLP(plan.price)}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">USD ${plan.usd} · pago unico</p>
        </div>

        <div className="border-t border-slate-100 mb-5" />

        {/* Features */}
        <ul className="space-y-2.5 mb-6 flex-1">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-600">
              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5', plan.bg)}>
                <svg className={cn('w-3 h-3', plan.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <button disabled className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 border-2 border-emerald-200 cursor-default flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            Plan activo
          </button>
        ) : plan.popular ? (
          <button onClick={() => onContract(plan)} className={cn('w-full py-3.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.97] hover:brightness-110', plan.gradient)}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Contratar ahora
            </span>
          </button>
        ) : (
          <button onClick={() => onContract(plan)} className={cn('w-full py-3.5 rounded-xl font-bold text-sm border-2 transition-all duration-300 active:scale-[0.97]', plan.border, plan.text, 'hover:bg-slate-50 hover:shadow-md')}>
            Contratar plan
          </button>
        )}
      </div>
    </div>
  );
}

function planIdFromName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fragata')) return 'fragata';
  if (n.includes('capitan') || n.includes('capitán')) return 'capitan';
  if (n.includes('almirante')) return 'almirante';
  return null;
}

function ContractedPlanCard({ p }) {
  const id = planIdFromName(p.planName || p.plan_name);
  const meta = PLANS.find(x => x.id === id) || PLANS[0];
  const isActive = p.status === 'active';
  const isExpired = p.status === 'expired';
  const proposalsReceived = Number(p.proposalsReceived || 0);
  const proposalsTotal = Number(p.proposalsTotal || meta.proposals || 0);
  const pct = proposalsTotal > 0 ? Math.min(100, (proposalsReceived / proposalsTotal) * 100) : 0;

  let daysLeft = null;
  if (p.endDate) {
    const ms = new Date(p.endDate).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  return (
    <div className={cn(
      'relative bg-white rounded-2xl border overflow-hidden transition',
      isActive ? `${meta.border} shadow-sm` : 'border-slate-200'
    )}>
      {isActive && <div className={cn('h-1 bg-gradient-to-r', meta.gradient)} />}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', meta.gradient)}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d={meta.icon}/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate">{p.planName || p.plan_name || 'Plan'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={cn(
                'text-[10px] uppercase tracking-wider font-bold',
                isActive ? 'bg-emerald-100 text-emerald-700' :
                isExpired ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {isActive ? 'Activo' : isExpired ? 'Vencido' : p.status}
              </Badge>
              {isActive && daysLeft !== null && (
                <span className="text-[11px] text-slate-500">
                  {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Vence hoy'}
                </span>
              )}
            </div>
          </div>
        </div>

        {proposalsTotal > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-slate-500 font-semibold">Propuestas recibidas</span>
              <span className="text-slate-700 font-bold tabular-nums">{proposalsReceived} / {proposalsTotal}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn('h-full bg-gradient-to-r transition-all', meta.gradient)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
          {p.startDate && (
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Inicio</p>
              <p className="text-slate-700 font-medium">{fmtDate(p.startDate)}</p>
            </div>
          )}
          {p.endDate && (
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Vence</p>
              <p className="text-slate-700 font-medium">{fmtDate(p.endDate)}</p>
            </div>
          )}
          {p.days && (
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Duracion</p>
              <p className="text-slate-700 font-medium">{p.days} dias</p>
            </div>
          )}
          {p.price && (
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Inversion</p>
              <p className="text-slate-700 font-bold">{fmtCLP(p.price)}</p>
            </div>
          )}
          {p.payment_method && (
            <div className="col-span-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Metodo de pago</p>
              <p className="text-slate-700 font-medium capitalize">{p.payment_method.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Plans() {
  const [userPlans, setUserPlans] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

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

  const activePlan = useMemo(() => userPlans.find(p => p.status === 'active'), [userPlans]);
  const currentId = activePlan ? planIdFromName(activePlan.planName || activePlan.plan_name) : null;

  function handleContract(/* plan */) {
    window.open('https://www.imporlan.cl/#planes', '_blank');
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className={cn('w-1.5 h-1.5 rounded-full', activePlan ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400')} />
              {activePlan ? `Plan activo: ${activePlan.planName || activePlan.plan_name}` : 'Encontremos tu lancha'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Planes de busqueda</h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Elegi el plan que mejor se adapte a tus necesidades. Nuestro equipo busca activamente las mejores opciones en USA y Chile, te entrega un ranking ordenado y te acompana hasta la entrega.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20los%20planes%20de%20busqueda" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition ring-1 ring-emerald-400/20">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Hablar con un asesor
            </a>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-[540px] bg-slate-100 rounded-3xl animate-pulse" />)
        ) : (
          PLANS.map(plan => <PlanCard key={plan.id} plan={plan} current={currentId} onContract={handleContract} />)
        )}
      </div>

      {/* Trust bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Pago 100% seguro</p>
            <p className="text-[11px] text-slate-500">WebPay · MercadoPago · PayPal</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-50/40 border border-cyan-100">
          <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Respuesta en 48 hrs</p>
            <p className="text-[11px] text-slate-500">Te respondemos en horario habil</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50/40 border border-violet-100">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Soporte dedicado</p>
            <p className="text-[11px] text-slate-500">Agente asignado al expediente</p>
          </div>
        </div>
      </div>

      {/* User's contracted plans */}
      {!loading && userPlans.length > 0 && (
        <div className="mb-8">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Mis planes contratados</h2>
              <p className="text-xs text-slate-400 mt-0.5">{userPlans.length} plan{userPlans.length > 1 ? 'es' : ''} en tu cuenta</p>
            </div>
            <a href="#/expedientes" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1">
              Ver expedientes
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userPlans.map((p, i) => <ContractedPlanCard key={i} p={p} />)}
          </div>
        </div>
      )}

      {/* Contracted links */}
      {!loading && links.length > 0 && (
        <div className="mb-8">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Cotizaciones por links</h2>
              <p className="text-xs text-slate-400 mt-0.5">{links.length} link{links.length > 1 ? 's' : ''} contratado{links.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {links.map((l, i) => {
                const status = l.status || 'pending';
                const stColor =
                  status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  status === 'en_revision' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600';
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{l.url || l.name || 'Link'}</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(l.contractedAt || l.created_at)}</p>
                    </div>
                    <Badge className={cn(stColor, 'text-[10px] uppercase tracking-wider font-bold')}>{status.replace(/_/g, ' ')}</Badge>
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 hover:text-cyan-700 font-semibold shrink-0 inline-flex items-center gap-1">
                        Abrir
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* FAQ */}
      <div>
        <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Preguntas frecuentes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Lo mas consultado por nuestros clientes</p>
          </div>
          <a href="#/support" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1">
            Ir a Soporte
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className={cn('border rounded-2xl overflow-hidden transition-all bg-white', isOpen ? 'border-cyan-200 shadow-sm' : 'border-slate-200')}>
                <button onClick={() => setOpenFaq(isOpen ? null : i)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition">
                  <span className="text-sm font-semibold text-slate-700">{faq.q}</span>
                  <svg className={cn('w-4 h-4 text-slate-400 transition-transform shrink-0', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      {!activePlan && !loading && (
        <div className="mt-8 relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden shadow-xl">
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold">Listo para encontrar tu lancha?</h3>
              <p className="text-sm text-slate-300 mt-1.5">Empezamos a buscar el mismo dia que confirmas el plan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="https://www.imporlan.cl/#planes" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold shadow-md hover:bg-slate-100 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Contratar plan
              </a>
              <a href="https://wa.me/56940211459?text=Hola%2C%20quiero%20saber%20mas%20sobre%20los%20planes" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 ring-1 ring-white/20 text-white font-semibold hover:bg-white/20 transition">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                Hablar primero
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
