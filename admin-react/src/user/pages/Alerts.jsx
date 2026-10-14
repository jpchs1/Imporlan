import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import { Card, Button, PageHeader, FilterChips, EmptyState, ErrorState, Skeleton } from '../../shared/components/UI';
import { Bell, Check } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { FilaNotificacion } from './inicio/FilaNotificacion';
import { irAlEnlace } from './inicio/notificaciones';

/** Mismo orden y etiquetas (en plural) que los tipos de `FilaNotificacion`. */
const TIPOS = [
  { id: 'payment', label: 'Pagos' },
  { id: 'message', label: 'Mensajes' },
  { id: 'document', label: 'Documentos' },
  { id: 'report', label: 'Reportes' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'inspection', label: 'Inspecciones' },
];

export default function Alerts() {
  const toast = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | unread | <tipo>
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    getNotifications(50)
      .then(data => { if (activo) { setNotifications(data.notifications || []); setError(null); } })
      .catch(e => { if (activo) setError(e); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [intento]);

  const reintentar = () => { setLoading(true); setIntento(n => n + 1); };

  async function marcarLeida(n) {
    if (n.read_at) return;
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    try { await markNotificationRead(n.id); } catch { /* silencioso */ }
  }

  function abrir(n) {
    marcarLeida(n);
    irAlEnlace(n.link, navigate);
  }

  async function marcarTodas() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      toast?.('Todas las alertas quedaron como leídas', 'success');
    } catch {
      toast?.({ type: 'error', title: 'No pudimos marcarlas', description: 'Vuelve a intentarlo en un momento.' });
    }
  }

  const sinLeer = notifications.filter(n => !n.read_at).length;

  const conteoPorTipo = useMemo(() => {
    const map = {};
    for (const n of notifications) {
      const t = n.type === 'chat' ? 'message' : (n.type || 'otro');
      map[t] = (map[t] || 0) + 1;
    }
    return map;
  }, [notifications]);

  const chips = useMemo(() => [
    { id: 'all', label: 'Todas', count: notifications.length },
    { id: 'unread', label: 'Sin leer', count: sinLeer },
    ...TIPOS.filter(t => conteoPorTipo[t.id]).map(t => ({ ...t, count: conteoPorTipo[t.id] })),
  ], [notifications.length, sinLeer, conteoPorTipo]);

  const visibles = useMemo(() => notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read_at;
    const t = n.type === 'chat' ? 'message' : n.type;
    return t === filter;
  }), [notifications, filter]);

  return (
    <div className="pb-4">
      <PageHeader
        title="Alertas"
        description="Novedades de tus expedientes, pagos, documentos y reportes. Las mismas que ves en la campana."
        actions={sinLeer > 0 && <Button variant="secondary" icon={Check} onClick={marcarTodas}>Marcar todas como leídas</Button>}
      />

      {!loading && !error && notifications.length > 0 && (
        <FilterChips options={chips} value={filter} onChange={setFilter} aria-label="Filtrar alertas" className="mb-4" />
      )}

      <Card padding="none">
        {loading ? (
          <Skeleton.TableRows rows={5} cols={2} />
        ) : error ? (
          <ErrorState message="No pudimos cargar tus alertas." detail={error} onRetry={reintentar} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Estás al día" description="Cuando haya novedades en tus expedientes, pagos o reportes, te avisamos aquí y por correo." />
        ) : visibles.length === 0 ? (
          <EmptyState compact icon={Bell} title="Nada con este filtro" description={filter === 'unread' ? 'No tienes alertas sin leer.' : 'No hay alertas de este tipo.'}
            primaryAction={<Button variant="secondary" size="sm" onClick={() => setFilter('all')}>Ver todas</Button>} />
        ) : (
          <ul className="divide-y divide-line" aria-label="Alertas">
            {visibles.map(n => <FilaNotificacion key={n.id} n={n} onOpen={abrir} onMarkRead={marcarLeida} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}
