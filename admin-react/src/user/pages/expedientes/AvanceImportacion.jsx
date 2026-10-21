import { cn, fmtCLP, dateValue } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Button } from '../../../shared/components/UI';
import { Check, Receipt, User, TriangleAlert, FileSearch, Banknote } from '../../../shared/components/Icons';
import { hitosDe } from '../../../shared/lib/importacion';
import { inspeccionNoApta, devolucionPedida, pago1AbonadoDeOtra } from '../../../shared/lib/inspeccion';
import { BotonEnlace } from '../inicio/BotonEnlace';
import CaminoInspeccion from './CaminoInspeccion';
import { rutaPagar } from './lib';

/**
 * «Tu avance»: línea de tiempo vertical de la importación. Parte con la
 * elección (hecha, con fecha), sigue con los hitos que marca el equipo
 * (hitosDe) y mete los pagos donde corresponden: los pagados entre lo hecho,
 * ordenados por fecha; el que está por pagar justo antes del hito en curso,
 * porque es lo que le toca al cliente. Si faltan los datos del cliente
 * (`datosPendientes`, cuando la elección la marcó el equipo), ese es el
 * primer pendiente. Lo hecho lleva fecha; lo en curso va destacado con quién
 * lo hace; lo pendiente, atenuado.
 *
 * La inspección técnica, cuando es el hito en curso, lleva además qué pasa
 * según el resultado (CaminoInspeccion compacto) y el reporte si ya está
 * (`reporteInspeccion`). Con el resultado **no apta** el camino de esta
 * lancha termina ahí: el hito se marca en advertencia (no en error), no se
 * piden cobros y no se listan los hitos que venían después.
 */
export default function AvanceImportacion({ eleccion, pagos, tituloLancha, agente, datosPendientes = false, onCompletarDatos, reporteInspeccion = null, className }) {
  const items = construirItems(eleccion, pagos, tituloLancha, agente, datosPendientes, onCompletarDatos, reporteInspeccion);

  return (
    <section aria-labelledby="tu-avance" className={className}>
      <h3 id="tu-avance" className="text-sm font-semibold text-ink-900">Tu avance</h3>
      <ol className="mt-3">
        {items.map((it, i) => {
          const alFinal = i === items.length - 1;
          const hecho = it.estado === 'hecho';
          const teToca = it.estado === 'pago' || it.estado === 'datos';
          const noApta = it.estado === 'no_apta';
          const curso = it.estado === 'curso' || teToca || noApta;
          return (
            <li key={it.id} className={cn('relative flex gap-3', !alFinal && 'pb-5')} aria-current={curso ? 'step' : undefined}>
              {!alFinal && <span aria-hidden="true" className={cn('absolute bottom-0 left-[11px] top-7 w-0.5', hecho ? 'bg-brand-600' : 'bg-line')} />}
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  hecho && 'bg-brand-600 text-white',
                  it.estado === 'curso' && 'border-2 border-brand-600 bg-surface',
                  teToca && 'border-2 border-warning bg-surface text-warning',
                  noApta && 'bg-warning text-white',
                  it.estado === 'pendiente' && 'border border-line-strong bg-surface',
                )}
              >
                {hecho && <Check size={14} strokeWidth={2.5} />}
                {it.estado === 'curso' && (it.icono ? <it.icono size={12} className="text-brand-600" /> : <span className="h-2 w-2 rounded-full bg-brand-600" />)}
                {it.estado === 'pago' && <Receipt size={12} />}
                {it.estado === 'datos' && <User size={12} />}
                {noApta && <TriangleAlert size={13} strokeWidth={2.25} />}
              </span>
              <div className={cn('min-w-0 flex-1', curso && 'rounded-md border px-3 py-2.5 -mt-1', it.estado === 'curso' && 'border-brand-200 bg-brand-50', (teToca || noApta) && 'border-warning-line bg-warning-bg')}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className={cn('text-sm', hecho ? 'font-medium text-ink-900' : curso ? 'font-semibold text-ink-900' : 'text-ink-500')}>{it.titulo}</p>
                  {it.fecha && <time className="text-xs text-ink-500 tabular" dateTime={it.fecha} title={fmtDateLarga(it.fecha, { hora: true })}>{fmtDateLarga(it.fecha)}</time>}
                </div>
                {it.detalle && <p className={cn('mt-0.5 text-13', curso ? 'text-ink-700' : 'text-ink-500')}>{it.detalle}</p>}
                {it.camino && <CaminoInspeccion compacto className="mt-2" />}
                {it.quien && <p className="mt-1 text-xs text-ink-500">{it.quien}</p>}
                {it.accion && <div className="mt-2">{it.accion}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function construirItems(eleccion, pagos, tituloLancha, agente, datosPendientes, onCompletarDatos, reporteInspeccion) {
  const quien = agente ? `Lo hace ${agente}` : 'Lo hace tu agente';
  const noApta = inspeccionNoApta(eleccion);
  const devolucion = devolucionPedida(eleccion);
  const verReporte = reporteInspeccion ? <BotonEnlace to="/inspections" variant="secondary" size="sm" icon={FileSearch}>Ver el reporte</BotonEnlace> : null;
  const hechos = [];
  const porPagar = [];

  hechos.push({
    id: 'eleccion',
    estado: 'hecho',
    titulo: eleccion.by === 'equipo' ? 'Tu agente registró tu elección' : 'Elegiste la lancha',
    fecha: eleccion.at,
    detalle: tituloLancha,
  });

  // Sin los datos del cliente no se puede comprar a su nombre: va antes que
  // cualquier pago, y es lo primero que le toca a él.
  if (datosPendientes && !noApta) {
    porPagar.push({
      id: 'datos',
      estado: 'datos',
      titulo: 'Te toca: completa tus datos y sube tu cédula',
      detalle: 'Los necesitamos para comprar e importar la lancha a tu nombre.',
      accion: <Button variant="secondary" size="sm" icon={User} onClick={onCompletarDatos}>Completar</Button>,
    });
  }

  // Con la inspección no apta no se le pide ningún pago de esta lancha: lo
  // pendiente se anula o lo reemplaza el de la que elija.
  for (const p of pagos?.pagos || []) {
    if (p.estado === 'pagado') {
      const abonado = pago1AbonadoDeOtra(p.cobro, eleccion);
      hechos.push({ id: `pago-${p.n}`, estado: 'hecho', titulo: `Pagaste el Pago ${p.n} · ${p.pct}%`, fecha: p.cobro.paid_at || p.cobro.created_at, detalle: `${fmtCLP(p.cobro.amount_clp)}${abonado ? ' · abonado desde tu elección anterior' : ''}` });
    } else if (p.estado === 'por_pagar' && !noApta) {
      porPagar.push({
        id: `pago-${p.n}`,
        estado: 'pago',
        titulo: `Te toca: pagar el Pago ${p.n} · ${p.pct}%`,
        detalle: `${fmtCLP(p.cobro.amount_clp)} · solicitado el ${fmtDateLarga(p.cobro.created_at)}`,
        accion: <BotonEnlace to={rutaPagar(p.cobro)} variant="secondary" size="sm" icon={Receipt}>Pagar</BotonEnlace>,
      });
    }
  }
  for (const r of pagos?.otros || []) {
    if (r.status === 'paid') {
      hechos.push({ id: `cobro-${r.id}`, estado: 'hecho', titulo: `Pagaste: ${r.title}`, fecha: r.paid_at || r.created_at, detalle: fmtCLP(r.amount_clp) });
    } else if (r.status === 'pending' && !noApta) {
      porPagar.push({
        id: `cobro-${r.id}`,
        estado: 'pago',
        titulo: `Te toca: pagar ${r.title}`,
        detalle: `${fmtCLP(r.amount_clp)} · solicitado el ${fmtDateLarga(r.created_at)}`,
        accion: <BotonEnlace to={rutaPagar(r)} variant="secondary" size="sm" icon={Receipt}>Pagar</BotonEnlace>,
      });
    }
  }

  const hitos = hitosDe(eleccion);
  const pendientes = [];
  let enCursoVisto = false;
  for (const h of hitos) {
    if (h.hecho) {
      hechos.push({ id: h.id, estado: 'hecho', titulo: h.label, fecha: h.hecho, accion: h.id === 'inspeccion' ? verReporte : null });
    } else if (noApta && h.id === 'inspeccion') {
      // El camino de esta lancha termina aquí.
      pendientes.push({
        id: h.id,
        estado: 'no_apta',
        titulo: 'Inspección técnica: no apta',
        fecha: eleccion.inspection_result_at || null,
        detalle: devolucion
          ? 'La inspección recomienda no comprar esta lancha. Te ahorraste un problema a futuro.'
          : 'La inspección recomienda no comprar esta lancha. Te ahorraste un problema: elige otra (tu Pago 1 se abona a la nueva) o pide la devolución.',
        accion: verReporte,
      });
      if (devolucion) {
        pendientes.push({
          id: 'devolucion',
          estado: 'curso',
          titulo: 'Pediste la devolución del Pago 1',
          fecha: eleccion.refund_requested_at,
          detalle: 'Te contactamos para coordinarla.',
          quien,
          icono: Banknote,
        });
      }
      break;
    } else if (!enCursoVisto) {
      enCursoVisto = true;
      const esInspeccion = h.id === 'inspeccion';
      pendientes.push({
        id: h.id,
        estado: 'curso',
        titulo: h.enCursoCorto,
        detalle: h.enCurso,
        camino: esInspeccion,
        quien,
        accion: esInspeccion ? verReporte : null,
      });
    } else {
      pendientes.push({ id: h.id, estado: 'pendiente', titulo: h.label });
    }
  }
  // Si no quedó ningún hito en curso, todo está hecho: el último («Entregada») ya lo dice.
  hechos.sort((a, b) => dateValue(a.fecha) - dateValue(b.fecha));
  return [...hechos, ...porPagar, ...pendientes];
}
