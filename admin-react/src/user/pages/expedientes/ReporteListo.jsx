import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Button, Spinner } from '../../../shared/components/UI';
import { FileSearch, Languages, ExternalLink, CircleCheck, Search, Clock, MessageCircle, WhatsAppIcon } from '../../../shared/components/Icons';
import { urlOriginal } from '../../../shared/lib/reporte-inspeccion';
import { BotonEnlace } from '../inicio/BotonEnlace';
import { whatsappExpediente } from './lib';

/**
 * «El reporte de la inspección está listo»: la tarjeta principal de «Tu
 * importación» cuando `inspection_stage === 'reporte_listo'`. Es el momento
 * de mayor decisión de toda la importación, así que va tranquilo y claro: el
 * reporte (en español y el original), lo que el equipo vio, y los dos caminos
 * lado a lado. Decide el cliente; nadie lo apura.
 *
 *   reporte    la respuesta del GET user_inspeccion_reporte (o null mientras carga)
 *   pago2      el Pago 2 del plan ({ pct, clp }) si se ve, para decir cuánto llega
 *   pago1      el Pago 1 cruzado con su cobro (pagosConCobros), para el abono
 *   onLeer     abre el visor en español · onAprobar / onDeclinar: la decisión
 *   decidiendo 'aprobar' | 'declinar' | null mientras se guarda
 */
export default function ReporteListo({ order, eleccion, titulo, reporte, pago1, pago2, onLeer, onAprobar, onDeclinar, decidiendo = null, className }) {
  const rep = eleccion.inspection_report || {};
  const resumen = String(rep.summary || '').trim();
  const estadoEs = reporte?.es?.status || rep.es_status || null;
  const original = reporte?.original || null;
  const fecha = rep.at ? fmtDateLarga(rep.at) : null;
  const pagado = pago1?.estado === 'pagado';
  const montoPago1 = pagado ? Number(pago1.cobro?.amount_clp || pago1.clp) : 0;
  const agente = order.agent_name ? order.agent_name.split(' ')[0] : 'tu agente';

  return (
    <section aria-labelledby="reporte-listo" className={cn('overflow-hidden rounded-lg border border-brand-200', className)}>
      <div className="flex flex-col gap-4 bg-brand-50 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white shadow-card" aria-hidden="true">
          <FileSearch size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Inspección técnica{fecha ? ` · reporte del ${fecha}` : ''}</p>
          <h3 id="reporte-listo" className="text-lg font-semibold leading-7 text-ink-900">El reporte de la inspección está listo</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-700">
            Viene en inglés y lo tradujimos al español para que lo leas con calma. Con lo que decidas, seguimos: no hay apuro ni una respuesta correcta.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="lg" icon={Languages} onClick={onLeer}>Leer el reporte en español</Button>
            {original && urlOriginal(original) && (
              <BotonEnlace href={urlOriginal(original)} size="lg" icon={ExternalLink}>Ver original (inglés)</BotonEnlace>
            )}
          </div>
          <EstadoTraduccion estado={estadoEs} at={reporte?.es?.at || rep.es_at} className="mt-2.5" />
        </div>
      </div>

      {resumen && (
        <div className="border-t border-brand-200 bg-surface px-4 py-3 sm:px-5">
          <p className="eyebrow">Lo que vemos en el reporte · {order.agent_name || 'equipo Imporlan'}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-700">{resumen}</p>
        </div>
      )}

      <div className="border-t border-brand-200 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-ink-900">Tu decisión</p>
          <p className="text-13 text-ink-500">Lee el reporte y elige con calma. Cualquiera de los dos caminos se lo avisamos a {agente}.</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Camino
            icono={CircleCheck}
            tono="success"
            titulo="Apruebo, sigamos con la compra"
            texto={pago2
              ? <>Te llega el <span className="font-medium text-ink-900">Pago 2 ({fmtCLP(pago2.clp)} · {pago2.pct}%)</span> y cerramos la compra de {titulo} con el vendedor, a tu nombre.</>
              : <>Te llega el Pago 2 y cerramos la compra de {titulo} con el vendedor, a tu nombre.</>}
            accion={<Button variant="secondary" icon={CircleCheck} onClick={onAprobar} loading={decidiendo === 'aprobar'} disabled={decidiendo === 'declinar'} className="w-full sm:w-auto [&_svg]:text-success">Aprobar y seguir</Button>}
          />
          <Camino
            icono={Search}
            tono="neutral"
            titulo="No quiero seguir con esta lancha"
            texto={pagado
              ? <>Eliges otra lancha de tu ranking (tu Pago 1 de {fmtCLP(montoPago1)} se abona a la nueva) o pides la devolución. Para eso existe la inspección.</>
              : <>Eliges otra lancha de tu ranking (se anula el Pago 1 pendiente y te llega el de la nueva) o pides la devolución. Para eso existe la inspección.</>}
            accion={<Button variant="secondary" icon={Search} onClick={onDeclinar} loading={decidiendo === 'declinar'} disabled={decidiendo === 'aprobar'} className="w-full sm:w-auto">Declinar esta lancha</Button>}
          />
        </div>
        <p className="mt-3 text-13 text-ink-500">
          <MessageCircle size={14} className="mr-1.5 inline-block align-[-2px] text-ink-400" aria-hidden="true" />
          ¿Dudas sobre el reporte? Escríbenos antes de decidir.{' '}
          <BotonEnlace href={whatsappExpediente(order)} variant="link" size="sm" icon={WhatsAppIcon} className="align-baseline">Hablar con {agente}</BotonEnlace>
        </p>
      </div>
    </section>
  );
}

/** «En español ✓», «Traduciendo…» o «va a tardar un poco más», bajo los botones. */
function EstadoTraduccion({ estado, at, className }) {
  if (estado === 'listo') {
    return (
      <p className={cn('flex items-center gap-1.5 text-13 text-ink-700', className)}>
        <CircleCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
        En español{at ? ` · traducido el ${fmtDateLarga(at)}` : ''} · también lo puedes descargar en PDF
      </p>
    );
  }
  if (estado === 'error') {
    return (
      <p className={cn('flex items-center gap-1.5 text-13 text-ink-700', className)} role="status">
        <Clock size={14} className="shrink-0 text-warning" aria-hidden="true" />
        La versión en español va a tardar un poco más; mientras, puedes ver el original o escribirle a tu agente.
      </p>
    );
  }
  return (
    <p className={cn('flex items-center gap-1.5 text-13 text-ink-700', className)} role="status">
      <Spinner inline size="sm" label="Traduciendo" className="text-brand-600" />
      Estamos traduciendo el reporte al español; suele tardar unos minutos.
    </p>
  );
}

const TONO = {
  success: { caja: 'border-success-line bg-success-bg', ico: 'bg-surface text-success' },
  neutral: { caja: 'border-line bg-canvas', ico: 'border border-line bg-surface text-ink-700' },
};

function Camino({ icono, tono, titulo, texto, accion }) {
  const Icono = icono;
  const t = TONO[tono] || TONO.neutral;
  return (
    <div className={cn('flex flex-col rounded-lg border p-4', t.caja)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', t.ico)} aria-hidden="true">
          <Icono size={16} />
        </span>
        <p className="text-sm font-semibold text-ink-900">{titulo}</p>
      </div>
      <p className="mt-2 flex-1 text-13 text-ink-700">{texto}</p>
      <div className="mt-3">{accion}</div>
    </div>
  );
}
