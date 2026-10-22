import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Button } from '../../../shared/components/UI';
import { TriangleAlert, Search, Banknote, FileSearch, Languages, ShieldCheck, WhatsAppIcon, MessageSquareText } from '../../../shared/components/Icons';
import { decidioInspeccion, reporteDe } from '../../../shared/lib/inspeccion';
import { BotonEnlace } from '../inicio/BotonEnlace';
import { whatsappExpediente } from './lib';

/**
 * La lancha quedó fuera tras la inspección: el estado especial de «Tu
 * importación» cuando `inspection_stage === 'declinada'`. Claro y calmado:
 * para eso existe la inspección, el cliente se ahorró un problema.
 *
 * El copy cambia según quién registró la decisión (`inspection_decided_by`):
 *   - 'cliente': «Decidiste no seguir con esta lancha» (lo hizo desde su panel).
 *   - 'equipo':  «No seguimos con esta lancha», con `inspection_note` como
 *                «Nota del equipo» (el cliente avisó por teléfono o WhatsApp).
 * Nunca dice «la inspección recomienda no comprar»: la decisión es del cliente.
 *
 * Abajo, los dos caminos lado a lado:
 *   - «Elegir otra lancha» (primario): abre «Otras opciones». Si el Pago 1
 *     está pagado, se abona a la nueva.
 *   - «Prefiero la devolución» (secundario): el detalle confirma antes
 *     (se descuentan los costos de terceros ya incurridos) y llama a
 *     `user_pedir_devolucion`.
 *
 * Con `eleccion.refund_requested_at` ya no hay caminos: «Pediste la
 * devolución del Pago 1 el …; te contactamos para coordinarla».
 *
 * `pago1` es el Pago 1 del plan cruzado con su cobro (pagosConCobros), o null.
 * `onLeerReporte` abre el reporte en español (si el equipo lo cargó);
 * `reporte` es el reporte antiguo (inspection_reports_api), como respaldo.
 */
export default function InspeccionNoApta({ order, eleccion, titulo, pago1, reporte, onLeerReporte, onElegirOtra, onPedirDevolucion, pidiendo, className }) {
  const pagado = pago1?.estado === 'pagado';
  const monto = pagado ? Number(pago1.cobro?.amount_clp || pago1.clp) : 0;
  const devolucion = !!eleccion.refund_requested_at;
  const fecha = eleccion.inspection_result_at ? fmtDateLarga(eleccion.inspection_result_at) : null;
  const nota = (eleccion.inspection_note || '').trim();
  const porCliente = decidioInspeccion(eleccion) === 'cliente';
  const hayReporteEs = !!reporteDe(eleccion) && !!onLeerReporte;

  const verReporte = hayReporteEs
    ? <Button variant="secondary" size="sm" icon={Languages} onClick={onLeerReporte} className="shrink-0 self-start">Leer el reporte en español</Button>
    : reporte ? <BotonEnlace to="/inspections" size="sm" icon={FileSearch} className="shrink-0 self-start">Ver el reporte</BotonEnlace> : null;

  if (devolucion) {
    return (
      <section aria-labelledby="devolucion-pedida" className={cn('overflow-hidden rounded-lg border border-info-line', className)}>
        <div className="flex flex-col gap-3 bg-info-bg px-4 py-3.5 sm:flex-row sm:items-start">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-info" aria-hidden="true">
            <Banknote size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-ink-700">Devolución del Pago 1</p>
            <h3 id="devolucion-pedida" className="text-base font-semibold leading-6 text-ink-900">Pediste la devolución del Pago 1 el {fmtDateLarga(eleccion.refund_requested_at)}</h3>
            <p className="mt-1 text-sm text-ink-700">
              {pagado
                ? <>Te contactamos para coordinarla: son {fmtCLP(monto)}, descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5).</>
                : <>Como no alcanzaste a pagarlo, anulamos el cobro pendiente: no hay nada que devolver.</>}
              {' '}Con esto no sigues con {titulo}. Si quieres retomar la búsqueda, escríbele a tu agente.
            </p>
          </div>
          <BotonEnlace href={whatsappExpediente(order)} size="sm" icon={WhatsAppIcon} className="shrink-0 self-start">Hablar con mi agente</BotonEnlace>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-info-line bg-surface px-4 py-2.5 text-13 text-ink-700">
          <span className="inline-flex items-center gap-1.5"><TriangleAlert size={14} className="text-warning" aria-hidden="true" />Inspección{fecha ? ` · ${fecha}` : ''}: {porCliente ? 'decidiste no seguir con esta lancha' : 'no seguimos con esta lancha'}</span>
          {hayReporteEs
            ? <Button variant="link" size="sm" icon={Languages} onClick={onLeerReporte}>Leer el reporte en español</Button>
            : reporte && <BotonEnlace to="/inspections" variant="link" size="sm" icon={FileSearch}>Ver el reporte</BotonEnlace>}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="inspeccion-declinada" className={cn('overflow-hidden rounded-lg border border-warning-line', className)}>
      <div className="flex flex-col gap-3 bg-warning-bg px-4 py-3.5 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-warning" aria-hidden="true">
          <TriangleAlert size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{porCliente ? 'Tu decisión tras la inspección' : 'Inspección técnica'}{fecha ? ` · ${fecha}` : ''}</p>
          <h3 id="inspeccion-declinada" className="text-base font-semibold leading-6 text-ink-900">
            {porCliente ? 'Decidiste no seguir con esta lancha' : 'No seguimos con esta lancha'}
          </h3>
          <p className="mt-1 text-sm text-ink-700">
            {porCliente
              ? <>Para eso existe la inspección: te ahorraste un problema a futuro. {titulo} queda fuera y tú eliges cómo seguir.</>
              : <>Tu agente registró tu decisión después de la inspección. Para eso existe: te ahorraste un problema a futuro. {titulo} queda fuera y tú eliges cómo seguir.</>}
          </p>
        </div>
        {verReporte}
      </div>

      {nota && (
        <div className="border-t border-warning-line bg-surface px-4 py-3">
          <p className="eyebrow flex items-center gap-1.5"><MessageSquareText size={12} className="text-ink-400" aria-hidden="true" />Nota del equipo</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{nota}</p>
        </div>
      )}

      <div className="border-t border-warning-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink-900">Cómo seguir: tú eliges</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Camino
            icono={Search}
            titulo="Elegir otra lancha"
            texto={pagado
              ? <>Vuelves a tu ranking y eliges con cuál seguir. Tu Pago 1 ({fmtCLP(monto)}) se abona a la nueva lancha y con ella partimos de cero: disponibilidad, inspección si la pides y compra.</>
              : <>Vuelves a tu ranking y eliges con cuál seguir. Se anula el Pago 1 pendiente de esta lancha y te llega el de la nueva; con ella partimos de cero.</>}
            recomendado
            accion={<Button icon={Search} onClick={onElegirOtra} disabled={pidiendo}>Elegir otra lancha</Button>}
          />
          <Camino
            icono={Banknote}
            titulo="Prefiero la devolución"
            texto={pagado
              ? <>Te devolvemos el Pago 1 ({fmtCLP(monto)}) descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5). Después no puedes elegir otra lancha en este expediente.</>
              : <>Como no alcanzaste a pagar el Pago 1, anulamos el cobro pendiente y no hay nada que devolver. Después no puedes elegir otra lancha en este expediente.</>}
            accion={<Button variant="secondary" icon={Banknote} onClick={onPedirDevolucion} loading={pidiendo}>Pedir la devolución</Button>}
          />
        </div>
        <p className="mt-3 flex items-start gap-2 text-13 text-ink-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
          <span>Cualquiera de los dos caminos se lo avisamos a tu agente. Si tienes dudas, escríbele antes de decidir.</span>
        </p>
      </div>
    </section>
  );
}

function Camino({ icono, titulo, texto, recomendado = false, accion }) {
  const Icono = icono;
  return (
    <div className={cn('flex flex-col rounded-lg border p-4', recomendado ? 'border-brand-200 bg-brand-50' : 'border-line bg-canvas')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', recomendado ? 'bg-brand-600 text-white' : 'bg-surface text-ink-700 border border-line')} aria-hidden="true">
          <Icono size={16} />
        </span>
        <p className="text-sm font-semibold text-ink-900">{titulo}</p>
      </div>
      <p className="mt-2 flex-1 text-13 text-ink-700">{texto}</p>
      <div className="mt-3">{accion}</div>
    </div>
  );
}
