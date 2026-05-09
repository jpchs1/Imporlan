import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { getMyOrders } from '../api';
import { fmtDate, cn, statusColor } from '../../shared/lib/utils';
import { Card, Badge, Button } from '../../shared/components/UI';
import Timeline from '../../shared/components/Timeline';

const STATUS_LABELS = {
  new: 'Nuevo',
  pending_admin_fill: 'En proceso',
  in_progress: 'En transito',
  completed: 'Completado',
  expired: 'Expirado',
  canceled: 'Cancelado',
};

const TIMELINE_STEPS = [
  { label: 'Plan o cotizacion', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Busqueda activa', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { label: 'Inspeccion', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { label: 'Compra', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Logistica', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
];

function avatarInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Imports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | completed

  async function load() {
    setLoadError('');
    setLoading(true);
    try {
      const data = await getMyOrders();
      const all = data?.orders || data?.data || [];
      setAllOrders(all);
      const filtered = all.filter(o => o.status === 'in_progress' || o.status === 'completed' || (o.timeline_step && o.timeline_step >= 4));
      setOrders(filtered);
    } catch (e) {
      console.error('[Imports] load failed:', e);
      setLoadError(e?.message || 'Error al cargar importaciones');
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const visible = useMemo(() => {
    if (filter === 'active') return orders.filter(o => o.status === 'in_progress');
    if (filter === 'completed') return orders.filter(o => o.status === 'completed');
    return orders;
  }, [orders, filter]);

  const activeCount = orders.filter(o => o.status === 'in_progress').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const totalAll = allOrders.length;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className={cn('w-1.5 h-1.5 rounded-full', activeCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400')} />
              {activeCount > 0 ? `${activeCount} importacion${activeCount > 1 ? 'es' : ''} en transito` : 'Sin importaciones en curso'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mis importaciones</h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Seguimiento en tiempo real de tus expedientes que ya pasaron a la etapa de compra o logistica.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} className="bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center gap-1.5">
              <svg className={cn('w-4 h-4', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Actualizar
            </Button>
            <button onClick={() => navigate('/expedientes')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              Ver expedientes
            </button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'group relative bg-white border rounded-2xl p-4 text-left transition hover:shadow-sm hover:-translate-y-0.5',
            filter === 'all' ? 'border-cyan-300 ring-2 ring-cyan-200/60' : 'border-slate-200/70 hover:border-slate-300'
          )}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 text-cyan-600 flex items-center justify-center mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
          </div>
          <p className="text-2xl font-bold text-slate-800 leading-none">{orders.length}</p>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Importaciones</p>
          <p className="text-[11px] text-slate-500 mt-0.5">En la fase de compra/logistica</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={cn(
            'group relative bg-white border rounded-2xl p-4 text-left transition hover:shadow-sm hover:-translate-y-0.5',
            filter === 'active' ? 'border-cyan-300 ring-2 ring-cyan-200/60' : 'border-slate-200/70 hover:border-slate-300'
          )}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600 flex items-center justify-center mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <p className="text-2xl font-bold text-slate-800 leading-none">{activeCount}</p>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">En transito</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{activeCount > 0 ? 'Con avance reciente' : 'Sin movimientos'}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={cn(
            'group relative bg-white border rounded-2xl p-4 text-left transition hover:shadow-sm hover:-translate-y-0.5',
            filter === 'completed' ? 'border-cyan-300 ring-2 ring-cyan-200/60' : 'border-slate-200/70 hover:border-slate-300'
          )}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 flex items-center justify-center mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-2xl font-bold text-slate-800 leading-none">{completedCount}</p>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Completadas</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Lancha entregada</p>
        </button>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 text-violet-600 flex items-center justify-center mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
          </div>
          <p className="text-2xl font-bold text-slate-800 leading-none">{totalAll}</p>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Expedientes totales</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Incluye no-importaciones</p>
        </div>
      </div>

      {/* Filter pills (only when there's data) */}
      {orders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { v: 'all', label: 'Todas', count: orders.length },
            { v: 'active', label: 'En transito', count: activeCount },
            { v: 'completed', label: 'Completadas', count: completedCount },
          ].map(t => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                filter === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
            >
              {t.label}
              <span className={cn('text-[10px] tabular-nums', filter === t.v ? 'text-white/80' : 'text-slate-400')}>{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-center py-12">
          {loadError ? (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <p className="text-slate-700 font-semibold">No pudimos cargar tus importaciones</p>
              <p className="text-xs text-red-500 mt-1">{loadError}</p>
              <p className="text-xs text-slate-400 mt-3">Cuenta: <span className="font-mono text-slate-600">{user?.email || '-'}</span></p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={load}>Reintentar</Button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
              </div>
              <p className="text-slate-700 font-semibold">No tenes importaciones activas</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Cuando un expediente avance a la etapa de compra o logistica aparecera aqui con su seguimiento en tiempo real.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <button onClick={() => navigate('/expedientes')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 transition">
                  Ver expedientes
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <a href="https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20mi%20importacion" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  Hablar con soporte
                </a>
              </div>
            </>
          )}
        </Card>
      ) : visible.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-slate-700 font-semibold">No hay {filter === 'active' ? 'importaciones en transito' : 'importaciones completadas'}</p>
          <p className="text-sm text-slate-500 mt-1">Probá con otro filtro.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setFilter('all')}>Ver todas</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map(order => {
            const step = order.timeline_step || 1;
            const pct = Math.min(100, Math.max(0, (step / TIMELINE_STEPS.length) * 100));
            const currentStep = TIMELINE_STEPS[Math.min(step - 1, TIMELINE_STEPS.length - 1)];
            const isCompleted = order.status === 'completed';
            return (
              <div key={order.id} className={cn(
                'relative bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md',
                isCompleted ? 'border-emerald-200/60' : 'border-cyan-200/60'
              )}>
                <div className={cn('h-1 bg-gradient-to-r', isCompleted ? 'from-emerald-500 to-teal-500' : 'from-cyan-500 to-blue-500')} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 font-mono text-sm">#{order.order_number}</p>
                        <Badge className={cn(statusColor(order.status), 'text-[10px] uppercase tracking-wider font-bold')}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </div>
                      <p className="text-base font-semibold text-slate-700 mt-1 truncate">{order.asset_name || order.plan_name || 'Importacion'}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                          Creado {fmtDate(order.created_at)}
                        </span>
                        {order.agent_name && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                              {avatarInitials(order.agent_name)}
                            </span>
                            <span>Agente <strong className="text-slate-700">{order.agent_name}</strong></span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/expedientes')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 transition shrink-0"
                    >
                      Ver expediente
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Progress strip */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        Etapa actual: <span className="text-slate-700 font-bold normal-case tracking-normal">{currentStep?.label || '-'}</span>
                      </span>
                      <span className="text-slate-500 tabular-nums">Paso {step} / {TIMELINE_STEPS.length}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full bg-gradient-to-r transition-all', isCompleted ? 'from-emerald-500 to-teal-500' : 'from-cyan-500 to-blue-500')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Compact step tracker (icons + connectors) */}
                  <div className="hidden sm:flex items-center justify-between gap-2 px-1">
                    {TIMELINE_STEPS.map((s, i) => {
                      const stepNum = i + 1;
                      const done = stepNum < step;
                      const active = stepNum === step;
                      return (
                        <div key={s.label} className="flex items-center flex-1 last:flex-none gap-2">
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center transition',
                              done ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' :
                              active ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30 ring-4 ring-cyan-100' :
                              'bg-slate-100 text-slate-400'
                            )}>
                              {done ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                                </svg>
                              )}
                            </div>
                            <p className={cn('text-[10px] font-semibold text-center max-w-[70px] leading-tight', active ? 'text-cyan-700' : done ? 'text-emerald-700' : 'text-slate-400')}>
                              {s.label}
                            </p>
                          </div>
                          {i < TIMELINE_STEPS.length - 1 && (
                            <div className={cn('flex-1 h-0.5 rounded-full -mt-4', stepNum < step ? 'bg-emerald-300' : 'bg-slate-200')} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile: keep the existing Timeline component */}
                  <div className="sm:hidden">
                    <Timeline step={step} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
