import { useState, useEffect } from 'react';
import { getMyPurchases } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Spinner } from '../../shared/components/UI';

export default function Plans() {
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
      <PageHeader title="Planes de Busqueda" subtitle="Tus planes contratados y servicios activos" />

      {plans.length === 0 && links.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <p className="text-slate-500 font-medium">No tienes planes de busqueda activos</p>
          <p className="text-sm text-slate-400 mt-1">Contrata un plan para comenzar a buscar tu embarcacion.</p>
        </Card>
      ) : (
        <>
          {plans.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Planes Contratados ({plans.length})</h2>
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
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Propuestas</span>
                          <span>{p.proposalsReceived || 0}/{p.proposalsTotal}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(((p.proposalsReceived || 0) / p.proposalsTotal) * 100, 100)}%` }} /></div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
