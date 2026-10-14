import { createContext, useContext, useEffect } from 'react';

/**
 * Migas de pan reales en la barra superior.
 *
 * El Layout muestra `Sección › …trail`. Una página de detalle agrega su cola:
 *
 *   useBreadcrumb(order ? [`IMP-${order.id}`] : null);
 *
 * También puede pasar `{ label, to }` para que la miga sea un enlace:
 *
 *   useBreadcrumb([{ label: 'IMP-00035', to: '/orders?id=35' }, 'Cotización']);
 *
 * El título de la pestaña del navegador se arma con lo mismo.
 */
export const PageMetaContext = createContext({ trail: null, setTrail: () => {} });

export function useBreadcrumb(trail) {
  const { setTrail } = useContext(PageMetaContext);
  const key = JSON.stringify(trail || null);
  useEffect(() => {
    setTrail(trail && trail.length ? trail : null);
    return () => setTrail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setTrail]);
}

export function usePageMeta() {
  return useContext(PageMetaContext);
}
