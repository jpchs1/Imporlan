import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ListaExpedientes from './ListaExpedientes';
import DetalleExpediente from './DetalleExpediente';
import { FILTROS } from './lib';

/**
 * Expedientes del cliente. La URL manda:
 *   #/expedientes                      lista
 *   #/expedientes?filtro=importacion   lista filtrada (a donde redirige /imports)
 *   #/expedientes?id=35                detalle (el botón "atrás" vuelve a la lista)
 */
export default function Expedientes() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const filtroParam = params.get('filtro');
  const filtro = FILTROS.includes(filtroParam) ? filtroParam : 'todos';

  const cambiarFiltro = useCallback((f) => {
    const next = new URLSearchParams(params);
    if (!f || f === 'todos') next.delete('filtro'); else next.set('filtro', f);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const hrefDetalle = useCallback((orderId) => {
    const q = new URLSearchParams();
    if (filtro !== 'todos') q.set('filtro', filtro);
    q.set('id', String(orderId));
    return `/expedientes?${q.toString()}`;
  }, [filtro]);

  const backTo = filtro !== 'todos' ? `/expedientes?filtro=${filtro}` : '/expedientes';

  if (id) return <DetalleExpediente key={id} orderId={id} backTo={backTo} />;
  return <ListaExpedientes filtro={filtro} onFiltro={cambiarFiltro} hrefDetalle={hrefDetalle} />;
}
