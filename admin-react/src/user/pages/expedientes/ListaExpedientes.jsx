import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders } from '../../api';
import { PageHeader, Card, Button, FilterChips, SearchInput, EmptyState, ErrorState, Skeleton } from '../../../shared/components/UI';
import { Link2, FolderOpen, WhatsAppIcon } from '../../../shared/components/Icons';
import TarjetaExpediente from './TarjetaExpediente';
import BotonEnlace from './BotonEnlace';
import { esActivo, esImportacion, esCerrado, WA_SOPORTE } from './lib';

const FILTRO_FN = {
  todos: () => true,
  activos: esActivo,
  importacion: esImportacion,
  completados: (o) => o.status === 'completed',
  vencidos: esCerrado,
};

export default function ListaExpedientes({ filtro, onFiltro, hrefDetalle }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const r = (await getMyOrders()) || {};
      const list = r.orders || r.data || (Array.isArray(r) ? r : []);
      setOrders(Array.isArray(list) ? list : []);
      if (r.error) setError(String(r.error));
    } catch (e) {
      setError(e?.message || 'No pudimos cargar tus expedientes');
      setOrders([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const conteo = useMemo(() => Object.fromEntries(Object.entries(FILTRO_FN).map(([k, fn]) => [k, orders.filter(fn).length])), [orders]);

  const visibles = useMemo(() => {
    const fn = FILTRO_FN[filtro] || FILTRO_FN.todos;
    const t = q.trim().toLowerCase();
    return orders.filter(o => {
      if (!fn(o)) return false;
      if (!t) return true;
      const hay = `${o.order_number || ''} ${o.plan_name || ''} ${o.asset_name || ''} ${o.requirement_name || ''} ${o.agent_name || ''}`.toLowerCase();
      return hay.includes(t);
    });
  }, [orders, filtro, q]);

  const chips = [
    { id: 'todos', label: 'Todos', count: conteo.todos },
    { id: 'activos', label: 'Activos', count: conteo.activos },
    { id: 'importacion', label: 'En importación', count: conteo.importacion },
    { id: 'completados', label: 'Completados', count: conteo.completados },
    { id: 'vencidos', label: 'Vencidos', count: conteo.vencidos },
  ];

  const hayFiltro = filtro !== 'todos' || q.trim() !== '';
  const limpiar = () => { onFiltro('todos'); setQ(''); };

  let cuerpo;
  if (loading) {
    cuerpo = (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Cargando expedientes">
        {[1, 2, 3].map(i => <Skeleton.Card key={i} lines={3} />)}
      </div>
    );
  } else if (orders.length === 0 && error) {
    cuerpo = (
      <Card padding="none">
        <ErrorState title="No pudimos cargar tus expedientes" message="Vuelve a intentarlo en unos segundos. Si sigue fallando, escríbenos." detail={error} onRetry={() => { setError(''); setLoading(true); load(); }} />
      </Card>
    );
  } else if (orders.length === 0) {
    cuerpo = (
      <Card padding="none">
        <EmptyState
          icon={FolderOpen}
          title="Aún no tienes expedientes"
          description="Cuando contrates un plan de búsqueda o cotices links de anuncios, tu expediente aparece aquí con su avance."
          primaryAction={<Button icon={Link2} onClick={() => navigate('/quotation')}>Cotizar links</Button>}
          secondaryAction={<Button variant="secondary" onClick={() => navigate('/plans')}>Ver planes</Button>}
        >
          <BotonEnlace variant="ghost" size="sm" icon={WhatsAppIcon} className="mt-3" href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent('Hola, no veo mis expedientes en el panel')}`}>
            Escríbenos por WhatsApp
          </BotonEnlace>
        </EmptyState>
      </Card>
    );
  } else if (visibles.length === 0) {
    cuerpo = (
      <Card padding="none">
        <EmptyState
          compact
          title="Sin coincidencias"
          description={q.trim() ? `Ningún expediente coincide con “${q.trim()}”.` : 'No hay expedientes en este filtro.'}
          primaryAction={<Button variant="secondary" size="sm" onClick={limpiar}>Limpiar filtros</Button>}
        />
      </Card>
    );
  } else {
    cuerpo = (
      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 list-none m-0 p-0" aria-label="Expedientes">
        {visibles.map(o => (
          <li key={o.id} className="min-w-0 flex">
            <TarjetaExpediente order={o} href={hrefDetalle(o.id)} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        title="Expedientes"
        description="Tus búsquedas y cotizaciones, con la etapa en la que va cada una."
        actions={<Button icon={Link2} onClick={() => navigate('/quotation')}>Cotizar links</Button>}
      />

      {orders.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterChips options={chips} value={filtro} onChange={onFiltro} onClear={hayFiltro ? limpiar : undefined} aria-label="Filtrar expedientes" className="min-w-0" />
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por número, lancha o agente" className="md:w-72 shrink-0" />
        </div>
      )}

      {error && orders.length > 0 && (
        <p role="status" className="mb-4 text-13 text-warning">No pudimos actualizar la lista: {error}</p>
      )}

      {cuerpo}
    </div>
  );
}
