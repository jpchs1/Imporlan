import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPurchases } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Spinner } from '../../shared/components/UI';

const AVAILABLE_PLANS = [
  {
    id: 'fragata',
    name: 'Plan Fragata',
    description: 'Monitoreo por 7 dias',
    proposals: 5,
    days: 7,
    price: 67600,
    priceUSD: 67.60,
    color: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/20',
    features: ['5 propuestas de embarcaciones', 'Busqueda en USA y Chile', 'Soporte por email', 'Panel de seguimiento'],
  },
  {
    id: 'capitan',
    name: 'Plan Capitan de Navio',
    description: 'Monitoreo por 14 dias',
    proposals: 9,
    days: 14,
    price: 119600,
    priceUSD: 119.60,
    color: 'from-indigo-500 to-violet-500',
    shadow: 'shadow-indigo-500/20',
    popular: true,
    features: ['9 propuestas de embarcaciones', 'Busqueda en USA y Chile', 'Soporte prioritario', 'Panel de seguimiento', 'Agente dedicado'],
  },
  {
    id: 'almirante',
    name: 'Plan Almirante',
    description: 'Monitoreo por 21 dias',
    proposals: 15,
    days: 21,
    price: 189600,
    priceUSD: 189.60,
    color: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/20',
    features: ['15 propuestas de embarcaciones', 'Busqueda en USA y Chile', 'Soporte prioritario 24/7', 'Panel de seguimiento', 'Agente dedicado', 'Reporte IA incluido'],
  },
];

export default function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyPurchases();
        setPlans(data.plans || []);
        setLinks(data.links || []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Planes de Busqueda" subtitle="Encuentra la embarcacion ideal con nuestros planes" />

      {/* Available Plans Catalog */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Planes Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {AVAILABLE_PLANS.map(plan => (
            <Card key={plan.id} className={cn('relative overflow-hidden p-0', plan.popular && 'ring-2 ring-indigo-400 shadow-lg')}>
              {plan.popular && (
                <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-bold text-center py-1 uppercase tracking-wider">
                  Mas Popular
                </div>
              )}
              <div className="p-6">
                {/* Header */}
                <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg', plan.color, plan.shadow)}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{plan.description} - {plan.proposals} propuestas</p>

                {/* Price */}
                <div className="mt-4 mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{fmtCLP(plan.price)}</span>
                  </div>
                  <p className="text-xs text-slate-400">USD ${plan.priceUSD} · {plan.days} dias</p>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a href={`https://www.imporlan.cl/#planes`} target="_blank" rel="noreferrer">
                  <Button variant={plan.popular ? 'accent' : 'secondary'} className="w-full" size="md">
                    Contratar Plan
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* User's contracted plans */}
      {plans.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Mis Planes Contratados ({plans.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p, i) => (
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
