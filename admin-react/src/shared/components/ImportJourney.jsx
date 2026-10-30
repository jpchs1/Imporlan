import { useId } from 'react';
import { cn } from '../lib/utils';
import { fmtDateLarga } from '../lib/format';
import { estadoDeImportacion, hitosDe } from '../lib/importacion';
import { Check, ClipboardCheck, Ship, ShoppingCart, FileCheck, Anchor, Search } from './Icons';
import '../styles/import-process.css';

const stages = {
  disponibilidad: { label: 'Disponibilidad', icon: Search },
  inspeccion: { label: 'Inspección', icon: ClipboardCheck },
  compra: { label: 'Compra', icon: ShoppingCart },
  transporte: { label: 'Envío a Chile', icon: Ship },
  aduana: { label: 'Aduana', icon: FileCheck },
  entrega: { label: 'Entrega', icon: Anchor },
};

/** Sólo las fechas persistidas completan etapas. Un paso posterior no completa los anteriores. */
export default function ImportJourney({ eleccion, cerrado = false, admin = false, className, sectionId }) {
  const id = useId();
  const estado = estadoDeImportacion(eleccion);
  const hitos = hitosDe(eleccion);
  const completados = hitos.filter(h => h.hecho).length;
  return <section id={sectionId} className={cn('import-journey', className)} aria-labelledby={id}>
    <div className="import-journey__heading">
      <div><p className="import-kicker">{admin ? 'Ruta de la operación' : 'Tu lancha, paso a paso'}</p><h3 id={id}>{cerrado && !estado.terminado ? 'Expediente cerrado' : estado.label}</h3></div>
      <span className="import-journey__count"><strong>{completados}</strong> / {hitos.length} etapas completadas</span>
    </div>
    <ol aria-label={admin ? 'Etapas de la operación' : 'Etapas de tu importación'} className="import-journey__steps">
      {hitos.map((h, i) => {
        const actual = !cerrado && !estado.terminado && h.id === estado.id;
        const Icon = h.hecho ? Check : stages[h.id].icon;
        return <li key={h.id} aria-current={actual ? 'step' : undefined} className={cn(h.hecho && 'is-done', actual && 'is-current', estado.pausada && actual && 'is-paused')}>
          <span className="import-journey__node" aria-hidden="true"><Icon size={18} /></span>
          <div><p className="import-journey__label"><span className="import-journey__number">{String(i + 1).padStart(2, '0')} · </span>{stages[h.id].label}</p>
          <p className="import-journey__status">{h.hecho ? <time dateTime={h.hecho}>{fmtDateLarga(h.hecho)}</time> : actual ? estado.pausada ? 'En pausa' : estado.cliente ? admin ? 'Decide el cliente' : 'Te toca decidir' : 'En curso' : cerrado ? 'Sin completar' : 'Pendiente'}</p></div>
        </li>;
      })}
    </ol>
  </section>;
}
