import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders } from '../api';
import { fmtDate, cn, statusColor } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Spinner } from '../../shared/components/UI';
import Timeline from '../../shared/components/Timeline';

const STATUS_LABELS = { new: 'Nuevo', pending_admin_fill: 'En Proceso', in_progress: 'En Transito', completed: 'Completado', expired: 'Expirado', canceled: 'Cancelado' };

export default function Imports() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyOrders();
        const all = data.success && data.orders ? data.orders : [];
        setOrders(all.filter(o => o.status === 'in_progress' || o.status === 'completed' || (o.timeline_step && o.timeline_step >= 4)));
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Mis Importaciones" subtitle="Seguimiento de tus importaciones activas y completadas" />

      {orders.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
          <p className="text-slate-500 font-medium">No tienes importaciones activas</p>
          <p className="text-sm text-slate-400 mt-1">Cuando un expediente avance a la etapa de compra o logistica, aparecera aqui.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-slate-800">#{order.order_number}</p>
                  <p className="text-sm text-slate-400">{order.asset_name || order.plan_name || 'Importacion'}</p>
                </div>
                <Badge className={statusColor(order.status)}>{STATUS_LABELS[order.status] || order.status}</Badge>
              </div>
              <Timeline step={order.timeline_step || 1} />
              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Creado: {fmtDate(order.created_at)}</span>
                  {order.agent_name && <span>Agente: {order.agent_name}</span>}
                </div>
                <button onClick={() => navigate('/expedientes')} className="text-xs text-cyan-600 font-medium hover:text-cyan-700 flex items-center gap-1">
                  Ver expediente <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
