import { cn } from '../lib/utils';
import '../styles/import-process.css';

/**
 * Lo que hay que hacer ahora, intermitente (JP, 20-nov-2026: «que vaya
 * quedando como intermitente la parte donde hay que intervenir para agregar,
 * completar, subir lo que hay que hacer durante el proceso»).
 *
 * `<TeToca />` es la etiqueta con el punto que titila. `ATENCION` es la clase
 * que hace latir el botón o la fila de esa acción. Sólo se usa donde le toca
 * actuar a quien está mirando: lo que espera a otro no titila. Con «reducir
 * movimiento» queda un anillo fijo, sin animación.
 */
export const ATENCION = 'atencion';

export default function TeToca({ children = 'Te toca', tone = 'brand', className }) {
  return (
    <span className={cn('te-toca', tone === 'warning' && 'te-toca--warning', className)}>
      <span className="te-toca__punto" aria-hidden="true" />
      {children}
    </span>
  );
}
