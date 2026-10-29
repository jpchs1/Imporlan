import { cn } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Check } from '../../../shared/components/Icons';
import { estadoDeImportacion, hitosDe } from '../../../shared/lib/importacion';

/** Hitos registrados, sin estimar tiempos ni dar por hechos los pasos anteriores. */
export default function EstadoImportacion({ eleccion, cerrado = false }) {
  const nombres = { disponibilidad: 'Disponibilidad', inspeccion: 'Inspección', compra: 'Compra', transporte: 'Transporte a Chile', aduana: 'Aduana', entrega: 'Entrega' };
  const estado = estadoDeImportacion(eleccion);
  const hitos = hitosDe(eleccion);
  const completados = hitos.filter(h => h.hecho).length;
  return <section className="border-b border-line px-(--card-pad) py-4" aria-labelledby="estado-importacion">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="eyebrow">Dónde está tu lancha</p><h3 id="estado-importacion" className="mt-1 text-lg font-semibold text-ink-900">{cerrado && !estado.terminado ? 'Expediente cerrado' : estado.label}</h3></div>
      <p className="text-13 text-ink-500 tabular">{completados} de {hitos.length} hitos completados</p>
    </div>
    <ol aria-label="Etapas de tu importación" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {hitos.map((h, i) => {
        const actual = !cerrado && !estado.terminado && h.id === estado.id;
        return <li key={h.id} aria-current={actual ? 'step' : undefined} className={cn('rounded-md border px-3 py-2.5', actual ? 'border-brand-500 bg-brand-50' : 'border-line bg-canvas')}>
          <span className={cn('mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', h.hecho ? 'bg-brand-600 text-white' : actual ? 'bg-brand-100 text-brand-700' : 'border border-line-strong text-ink-500')} aria-hidden="true">{h.hecho ? <Check size={14} /> : i + 1}</span>
          <p className="text-13 font-medium text-ink-900">{h.hecho ? h.corto : nombres[h.id]}</p>
          <p className={cn('mt-1 text-xs', actual ? 'text-brand-700' : 'text-ink-500')}>{h.hecho ? fmtDateLarga(h.hecho) : actual ? estado.pausada ? 'En pausa' : estado.cliente ? 'Te toca decidir' : 'En curso' : 'Pendiente'}</p>
        </li>;
      })}
    </ol>
  </section>;
}
