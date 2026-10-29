import { useState, useCallback } from 'react';
import { cn, fmtCLP, fmtDate, paymentMethodLabel } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, Menu, Badge, StatusBadge, Callout, Spinner } from '../../../shared/components/UI';
import { Anchor, Ship, CircleCheck, CircleDot, Circle, Check, Plus, Receipt, RotateCw, Pencil, Trash, BadgeCheck, TriangleAlert, Wallet, Upload, FileSearch, ChevronDown, CircleX, Languages, RefreshCw } from '../../../shared/components/Icons';
import { hitosDe, hitoEnCurso, planDePagos, pagosConCobros, precioChile, FUENTE_PRECIO, tituloLancha } from '../../../shared/lib/importacion';
import { inspeccionNoApta, devolucionPedida } from '../../../shared/lib/inspeccion';
import ReporteEspanol from '../../../shared/components/ReporteEspanol';
import ModalCobro from './ModalCobro';
import ModalHito from './ModalHito';
import ModalDeclinada from './ModalDeclinada';
import ModalReporteInspeccion from './ModalReporteInspeccion';
import OperacionUsa from './OperacionUsa';
import DatosCliente from './DatosCliente';
import { useReporteInspeccion } from './useReporteInspeccion';

/**
 * Importación: la lancha elegida (por el cliente desde su panel, o marcada
 * por el equipo cuando lo dijo por WhatsApp), los datos del cliente con su
 * cédula y los Términos, los hitos que marca el equipo, los cobros del plan
 * de pagos de la cotización y la operación en EE. UU. (lo que manda David).
 * Lo que se marca aquí lo ve el cliente en «Tu importación».
 *
 * `importacion` viene del contenedor (Orders.jsx): cobros del expediente,
 * los handlers que hablan con la API y qué puede ver el rol. El agente
 * (operación en EE. UU.) ve la lancha y los hitos, nada de cobros, de los
 * datos del cliente ni del bloque de EE. UU. (es él quien manda esas
 * actualizaciones).
 *
 * La inspección no la decide el equipo (JP, 21-oct-2026: «nosotros cumplimos
 * con cargar el reporte, pero el cliente es el que toma la decisión»). El
 * hito «Inspección técnica aprobada» va por `eleccion.inspection_stage`:
 *   coordinando    → «Cargar reporte» (ModalReporteInspeccion)
 *   reporte_listo  → esperando la decisión del cliente; chip de traducción,
 *                    «Ver reporte», «Reemplazar reporte» y, por si lo dijo por
 *                    teléfono, «Registrar decisión del cliente»
 *   aprobada       → por el cliente, o registrada por el equipo
 *   declinada      → por el cliente (con su motivo), o registrada por el
 *                    equipo (ModalDeclinada); él elige otra lancha o pide la
 *                    devolución del Pago 1
 */
export default function SeccionImportacion({ detail, links, importacion, onMarcarElegida, onCotizar, archivos }) {
  const eleccion = detail.eleccion || null;
  const link = eleccion ? links.find(l => Number(l.id) === Number(eleccion.link_id)) : null;
  const [modalCobro, setModalCobro] = useState(null); // { pago } · { manual: true }
  const [modalHito, setModalHito] = useState(null);   // el hito a marcar
  const [modalDeclinada, setModalDeclinada] = useState(false);
  const [modalReporte, setModalReporte] = useState(null); // { reemplazar: bool }
  const [visor, setVisor] = useState(false);

  const hitos = hitosDe(eleccion);
  const enCurso = hitoEnCurso(eleccion);
  const hechos = hitos.filter(h => h.hecho).length;
  const plan = planDePagos(link);
  const { pagos, otros } = pagosConCobros(plan, importacion.cobros);
  const precio = precioChile(link);
  const equipoChile = importacion.puedeCobrar !== false;
  const noApta = inspeccionNoApta(eleccion);
  const devolucion = devolucionPedida(eleccion);
  const pago1 = pagos.find(p => p.n === 1) || null;
  const pago1Pagado = pago1?.estado === 'pagado' ? pago1 : null;

  // La inspección: etapa, reporte y quién decidió (impEleccionPublica).
  const stage = etapaInspeccion(eleccion);
  const reporte = eleccion?.inspection_report || null;
  const decididoPor = eleccion?.inspection_decided_by || null;
  const porCliente = decididoPor === 'cliente';
  // Cargar, reemplazar, reintentar y registrar decisiones: sólo admin y soporte.
  const puedeGestionar = equipoChile && typeof importacion.onCargarReporte === 'function';
  const puedeRegistrar = equipoChile && typeof importacion.onInspeccionResultado === 'function';

  const onEstadoTraduccion = useCallback(() => { importacion.onRecargar?.(); }, [importacion]);
  const rep = useReporteInspeccion(detail.id, reporte, { onEstado: onEstadoTraduccion });

  function abrirVisor() {
    setVisor(true);
    if (!rep.data && !rep.loading) rep.cargar();
  }
  async function reintentarTraduccion() {
    const ok = await importacion.onTraducirReporte?.();
    if (ok) rep.cargar({ silencioso: true });
  }
  async function cargarReporte(datos) {
    const ok = await importacion.onCargarReporte(datos);
    if (ok) archivos?.recargar?.();
    return ok;
  }

  const motivo = porCliente ? motivoDeclinada(detail) : '';

  return (
    <Card id="importacion" className="exp-section admin-exp-operation scroll-mt-32">
      <Card.Header
        title="Operación de importación"
        description={equipoChile
          ? 'Embarcación elegida, hitos, pagos y actualizaciones de la operación.'
          : 'Embarcación elegida y avances de la operación.'}
        actions={eleccion ? (
          <>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onMarcarElegida(link || { id: eleccion.link_id })}>Cambiar</Button>
            <Menu
              label="Más acciones de la importación"
              items={[{ label: 'Quitar la elección', icon: Trash, tone: 'danger', onClick: importacion.onQuitar }]}
            />
          </>
        ) : undefined}
      />
      <Card.Body className="space-y-5">
        {!eleccion && (
          <div className="admin-exp-operation__empty" data-empty-operation><div className="admin-exp-operation__empty-icon"><Anchor size={22} /></div><div><h3>El cliente todavía no elige lancha</h3><p>Compara las opciones y registra la elección cuando el cliente decida.</p></div><Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => onMarcarElegida(null)}>Marcar lancha elegida</Button></div>
        )}
        {eleccion && (
          <>
            {/* ── La lancha ── */}
            <div className="flex flex-wrap items-start gap-3 sm:gap-4">
              {link?.image_url ? (
                <img src={link.image_url} alt="" className="w-24 h-[68px] rounded-md object-cover border border-line shrink-0" />
              ) : (
                <div className="w-24 h-[68px] rounded-md bg-neutral-bg border border-line flex items-center justify-center text-ink-400 shrink-0" aria-hidden="true"><Ship size={22} /></div>
              )}
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-ink-900">{link ? tituloLancha(link) : 'Lancha elegida'}</h3>
                  <Badge tone={eleccion.inspection ? 'info' : 'neutral'} size="sm">{eleccion.inspection ? 'Con inspección' : 'Sin inspección'}</Badge>
                  {noApta && <Badge tone="warning" dot size="sm">Declinada tras la inspección</Badge>}
                  {link?.link_status === 'sold' && <Badge tone="danger" size="sm">Vendida</Badge>}
                </div>
                <p className="text-13 text-ink-500 mt-0.5">
                  Elegida por {eleccion.by === 'equipo' ? 'el equipo' : 'el cliente'}
                  {eleccion.at && <> · <time dateTime={eleccion.at} title={fmtDateLarga(eleccion.at, { hora: true })}>{fmtRelativo(eleccion.at)}</time></>}
                  {precio && <> · {FUENTE_PRECIO[precio.fuente]}: <span className="text-ink-900 font-medium tabular">{fmtCLP(precio.clp)}</span></>}
                </p>
                {!link && (
                  <p className="text-13 text-warning mt-1">La fila elegida ya no está en el ranking. Cambia la elección o quítala.</p>
                )}
                {eleccion.note && (
                  <blockquote className="mt-2 text-sm text-ink-700 border-l-2 border-brand-500 bg-brand-50 rounded-r-md px-3 py-2">
                    «{eleccion.note}»
                    <span className="block text-xs text-ink-500 mt-0.5">Nota del cliente al elegir</span>
                  </blockquote>
                )}
              </div>
            </div>

            {/* ── El cliente declinó la lancha tras la inspección: qué espera la
                   operación. Sólo el equipo en Chile (lleva montos); el detalle y
                   las notas van en el hito. ── */}
            {equipoChile && noApta && !devolucion && (
              <Callout
                tone="warning"
                compact
                title={porCliente
                  ? 'El cliente declinó esta lancha tras leer el reporte: ahora elige otra o pide la devolución'
                  : 'No seguimos con esta lancha (lo registró el equipo): el cliente elige otra o pide la devolución'}
              >
                Puede elegir otra del ranking —su Pago 1{pago1Pagado ? ` (${fmtCLP(pago1Pagado.clp)}, pagado)` : ''} se abona a la nueva— o pedir la devolución. A David le pedimos pausar esta lancha. Lo ve en su panel{eleccion.inspection_result_at ? ` desde el ${fmtDateLarga(eleccion.inspection_result_at)}` : ''}.
              </Callout>
            )}

            {/* ── El cliente pidió la devolución del Pago 1. Anular o devolver
                   el cobro sigue siendo a mano, en Cobros. ── */}
            {equipoChile && devolucion && (
              <Callout
                tone="warning"
                icon={Wallet}
                title={`El cliente pidió la devolución del Pago 1 el ${fmtDateLarga(eleccion.refund_requested_at)}`}
                action={pago1Pagado && (
                  <Button size="sm" variant="secondary" onClick={() => document.getElementById('importacion-cobros')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ir a Cobros</Button>
                )}
              >
                {pago1Pagado ? (
                  <>
                    Pagó <span className="font-semibold text-ink-900 tabular">{fmtCLP(pago1Pagado.clp)}</span>
                    {pago1Pagado.cobro?.paid_at ? ` el ${fmtDateLarga(pago1Pagado.cobro.paid_at)}` : ''}
                    {pago1Pagado.cobro?.payment_method ? ` (${paymentMethodLabel(pago1Pagado.cobro.payment_method)})` : ''}.
                    {' '}Se devuelve descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5). Contáctalo para coordinarla; el cobro se marca a mano en Cobros.
                  </>
                ) : (
                  <>El Pago 1 no estaba pagado: el cobro pendiente se anuló solo y no hay nada que devolver. Desde su panel ya no puede elegir otra lancha; si quiere retomar, márcala tú desde «Cambiar».</>
                )}
              </Callout>
            )}
          </>
        )}

        {/* ── Datos del cliente, cédula y Términos (sólo el equipo en Chile).
               Van antes de los hitos: sin ellos no se compra a su nombre. ── */}
        {equipoChile && importacion.datosCliente !== false && (
          <DatosCliente detail={detail} eleccion={eleccion} link={link} />
        )}

        {eleccion && (
          <>
            {/* ── Hitos ── */}
            <section aria-labelledby="importacion-hitos">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                <h3 id="importacion-hitos" className="eyebrow">Hitos · {hechos} de {hitos.length}</h3>
                <span className="text-xs text-ink-500">
                  {noApta
                    ? <>En pausa: <span className="text-warning font-medium">{porCliente ? 'el cliente declinó la lancha' : 'no seguimos con esta lancha'}</span></>
                    : stage === 'reporte_listo'
                      ? <>Le toca al cliente: <span className="text-brand-700 font-medium">decidir con el reporte</span></>
                      : enCurso ? <>En curso: <span className="text-ink-700 font-medium">{enCurso.corto}</span></> : 'Importación completa'}
                </span>
              </div>
              <ol className="rounded-md border border-line divide-y divide-line overflow-hidden">
                {hitos.map(h => {
                  if (h.id === 'inspeccion') {
                    return (
                      <HitoInspeccion
                        key={h.id}
                        hito={h}
                        stage={stage}
                        actual={!noApta && enCurso?.id === h.id}
                        eleccion={eleccion}
                        reporte={reporte}
                        esStatus={rep.esStatus}
                        esAt={rep.esAt}
                        porCliente={porCliente}
                        devolucion={devolucion}
                        motivo={motivo}
                        puedeGestionar={puedeGestionar}
                        puedeRegistrar={puedeRegistrar}
                        onVer={abrirVisor}
                        onCargar={() => setModalReporte({ reemplazar: false })}
                        onReemplazar={() => setModalReporte({ reemplazar: true })}
                        onReintentar={reintentarTraduccion}
                        onAprobo={() => setModalHito(h)}
                        onDeclino={() => setModalDeclinada(true)}
                        onDesmarcar={() => importacion.onHito(h, false, false)}
                        onDeshacer={() => importacion.onInspeccionResultado(null)}
                      />
                    );
                  }
                  // Con la lancha declinada nada más está «en curso»: la
                  // operación espera al cliente (otra lancha o devolución).
                  const actual = !noApta && enCurso?.id === h.id;
                  const Icono = h.hecho ? CircleCheck : actual ? CircleDot : Circle;
                  return (
                    <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                      <Icono size={18} className={cn('shrink-0', h.hecho ? 'text-success' : actual ? 'text-brand-600' : 'text-ink-400')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', h.hecho ? 'text-ink-700' : actual ? 'text-ink-900 font-medium' : 'text-ink-500')}>{h.label}</p>
                        <p className="text-xs text-ink-500 tabular">
                          {h.hecho ? `Hecho el ${fmtDateLarga(h.hecho)}` : actual ? 'En curso' : 'Pendiente'}
                        </p>
                      </div>
                      {h.hecho ? (
                        <Menu
                          label={`Acciones del hito ${h.corto}`}
                          items={[{ label: 'Desmarcar', icon: RotateCw, onClick: () => importacion.onHito(h, false, false) }]}
                        />
                      ) : (
                        <Button size="sm" variant="secondary" icon={Check} onClick={() => setModalHito(h)}>Marcar hecho</Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* ── Cobros (sólo el equipo en Chile) ── */}
            {equipoChile && (
            <section aria-labelledby="importacion-cobros">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                <h3 id="importacion-cobros" className="eyebrow flex items-center gap-2">
                  Cobros
                  {importacion.cargandoCobros && <Spinner inline size="sm" label="Cargando cobros" />}
                </h3>
                <Button size="sm" variant="ghost" icon={Plus} disabled={!!importacion.cobrosError || importacion.cargandoCobros} onClick={() => setModalCobro({ manual: true })}>Cobro manual</Button>
              </div>

              {importacion.cobrosError && <Callout tone="warning" compact className="mb-3" action={<Button size="sm" variant="secondary" onClick={importacion.onReintentarCobros}>Reintentar cobros</Button>}>{importacion.cobrosError}</Callout>}
              {plan.length === 0 ? (
                <Callout
                  tone="neutral"
                  compact
                  action={link && onCotizar && <Button size="sm" variant="secondary" icon={Receipt} onClick={() => onCotizar(link)}>Cotizar</Button>}
                >
                  Esta lancha no tiene cotización, así que no hay plan de pagos. Cotízala para crear los cobros con un clic, o crea un cobro manual.
                </Callout>
              ) : (
                <div className="rounded-md border border-line divide-y divide-line">
                  {pagos.map(p => (
                    <FilaCobro
                      key={`pago-${p.n}`}
                      titulo={`Pago ${p.n}`}
                      detalle={`${p.pct}% de la cotización`}
                      clp={p.clp}
                      cobro={p.cobro}
                      accion={p.estado === 'por_cobrar'
                        ? <Button size="sm" variant="secondary" icon={Receipt} disabled={!!importacion.cobrosError || importacion.cargandoCobros} onClick={() => setModalCobro({ pago: p })}>Crear cobro</Button>
                        : <MenuCobro cobro={p.cobro} onEstado={importacion.onEstadoCobro} />}
                    />
                  ))}
                  {otros.map(c => (
                    <FilaCobro
                      key={c.id}
                      titulo={c.title}
                      detalle="Fuera del plan de pagos"
                      clp={c.amount_clp}
                      cobro={c}
                      accion={<MenuCobro cobro={c} onEstado={importacion.onEstadoCobro} />}
                    />
                  ))}
                  <div className="flex items-center justify-between gap-3 px-3 py-2 bg-canvas rounded-b-md text-13">
                    <span className="text-ink-500">
                      Total cotización{link?.quote_published_at ? '' : ' (en análisis, el cliente aún no la ve)'}
                    </span>
                    <span className="font-semibold text-ink-900 tabular">{fmtCLP(link?.quote_total_clp)}</span>
                  </div>
                </div>
              )}

              {plan.length === 0 && otros.length > 0 && (
                <div className="mt-2 rounded-md border border-line divide-y divide-line">
                  {otros.map(c => (
                    <FilaCobro key={c.id} titulo={c.title} detalle="Cobro manual" clp={c.amount_clp} cobro={c} accion={<MenuCobro cobro={c} onEstado={importacion.onEstadoCobro} />} />
                  ))}
                </div>
              )}
            </section>
            )}

            {/* ── Operación en EE. UU. (sólo el equipo en Chile) ── */}
            {equipoChile && importacion.operacionUsa !== false && (
              <OperacionUsa detail={detail} eleccion={eleccion} archivos={archivos} onRecargarDetalle={importacion.onRecargar} onCotizarAprobado={link && onCotizar ? value => onCotizar({ ...link, value_to_negotiate_usd: value }) : undefined} />
            )}
          </>
        )}
      </Card.Body>

      {modalCobro && (
        <ModalCobro
          open
          onClose={() => setModalCobro(null)}
          detail={detail}
          link={link}
          pago={modalCobro.pago || null}
          onCrear={importacion.onCrearCobro}
        />
      )}
      {modalHito && (
        <ModalHito
          open
          onClose={() => setModalHito(null)}
          hito={modalHito}
          eleccion={eleccion}
          onConfirmar={importacion.onHito}
          conReporte={!!reporte}
        />
      )}
      {modalDeclinada && (
        <ModalDeclinada
          open
          onClose={() => setModalDeclinada(false)}
          link={link}
          pago1={pago1}
          conReporte={!!reporte}
          onConfirmar={importacion.onInspeccionResultado}
        />
      )}
      {modalReporte && (
        <ModalReporteInspeccion
          open
          onClose={() => setModalReporte(null)}
          link={link}
          archivos={archivos}
          reporte={modalReporte.reemplazar ? reporte : null}
          onCargar={cargarReporte}
        />
      )}
      {visor && (
        <ReporteEspanol
          open
          onClose={() => setVisor(false)}
          data={rep.data}
          loading={rep.loading}
          error={rep.error}
          onRetry={rep.error ? () => rep.cargar() : (puedeGestionar && rep.esStatus === 'error' ? reintentarTraduccion : undefined)}
        />
      )}
    </Card>
  );
}

/**
 * En qué va la inspección (impEtapaInspeccion). Viene del servidor en
 * `inspection_stage`; si falta (detalle viejo), se deduce.
 */
function etapaInspeccion(eleccion) {
  if (!eleccion?.inspection) return null;
  if (eleccion.inspection_stage) return eleccion.inspection_stage;
  if (inspeccionNoApta(eleccion)) return 'declinada';
  if (eleccion.steps?.inspeccion) return 'aprobada';
  return eleccion.inspection_report ? 'reporte_listo' : 'coordinando';
}

/** Lo que escribió el cliente al declinar (evento `inspeccion_declinada`), o ''. */
function motivoDeclinada(detail) {
  const ev = (detail?.events || []).find(e => e?.event_type === 'inspeccion_declinada');
  if (!ev) return '';
  try {
    const meta = typeof ev.meta_json === 'string' ? JSON.parse(ev.meta_json) : (ev.meta_json || ev.meta || {});
    return String(meta?.motivo || '').trim();
  } catch { return ''; }
}

/* El hito «Inspección técnica aprobada», por etapa. Las acciones van debajo
   del texto (no a la derecha) porque son varias y en móvil no caben. */
function HitoInspeccion({ hito: h, stage, actual, eleccion, reporte, esStatus, esAt, porCliente, devolucion, motivo, puedeGestionar, puedeRegistrar, onVer, onCargar, onReemplazar, onReintentar, onAprobo, onDeclino, onDesmarcar, onDeshacer }) {
  const declinada = stage === 'declinada';
  const esperando = stage === 'reporte_listo';
  const aprobada = stage === 'aprobada' || !!h.hecho;
  // El cliente aprobó, pero el hito (y el Pago 2) esperan que el equipo valide el precio tras la inspección.
  const esperaPrecio = aprobada && !h.hecho && !!eleccion.inspection_waiting_price;
  const Icono = esperaPrecio ? CircleDot : aprobada ? CircleCheck : declinada ? TriangleAlert : esperando || actual ? CircleDot : Circle;
  const colorIcono = esperaPrecio ? 'text-brand-600' : aprobada ? 'text-success' : declinada ? 'text-warning' : esperando || actual ? 'text-brand-600' : 'text-ink-400';
  const destacado = esperando || declinada;

  let titulo = h.label;
  if (declinada) titulo = porCliente ? 'Inspección técnica: el cliente declinó esta lancha' : 'Inspección técnica: no seguimos con esta lancha';
  else if (esperando) titulo = 'Inspección técnica: esperando la decisión del cliente';

  let subtitulo;
  if (esperaPrecio) {
    titulo = 'Inspección técnica: el cliente aprobó, falta validar el precio';
    subtitulo = <>Aprobada por el cliente{eleccion.inspection_client_ok_at ? ` el ${fmtDateLarga(eleccion.inspection_client_ok_at)}` : ''} · valida la confirmación de precio en «Operación en EE. UU.»: al validarla se marca este hito y sale el Pago 2</>;
  } else if (aprobada) {
    subtitulo = <>{porCliente ? 'Aprobada por el cliente' : 'Aprobada (registrada por el equipo)'}{h.hecho ? ` · ${fmtDateLarga(h.hecho)}` : ''}</>;
  } else if (declinada) {
    subtitulo = <>
      {porCliente ? 'Declinada por el cliente' : 'Registrado por el equipo'}
      {eleccion.inspection_result_at ? ` · ${fmtDateLarga(eleccion.inspection_result_at)}` : ''}
      {' · '}{devolucion ? 'pidió la devolución del Pago 1' : 'elige otra lancha o pide la devolución'}
    </>;
  } else if (esperando) {
    subtitulo = <>Reporte cargado{reporte?.at ? ` el ${fmtDateLarga(reporte.at)}` : ''} · el cliente lo revisa en su panel y aprueba o declina</>;
  } else if (actual) {
    subtitulo = puedeGestionar ? 'En curso · Carga el reporte del inspector: el cliente lo lee en inglés y en español y decide' : 'En curso · cuando llegue el reporte, el cliente decide desde su panel';
  } else {
    subtitulo = 'Pendiente';
  }

  const chipTraduccion = reporte ? <ChipTraduccion status={esStatus} at={esAt} onReintentar={puedeGestionar ? onReintentar : null} /> : null;

  return (
    <li className={cn('flex items-start gap-3 px-3 py-2.5', declinada && 'bg-warning-bg', esperando && 'bg-brand-50/60')}>
      <Icono size={18} className={cn('shrink-0 mt-0.5', colorIcono)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm', esperaPrecio ? 'text-ink-900 font-medium' : aprobada ? 'text-ink-700' : destacado || actual ? 'text-ink-900 font-medium' : 'text-ink-500')}>{titulo}</p>
            <p className="text-xs text-ink-500 tabular flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>{subtitulo}</span>
              {chipTraduccion}
            </p>
          </div>
          {/* El «⋯»: deshacer, desmarcar o registrar por el cliente. */}
          {aprobada ? (
            <Menu label={`Acciones del hito ${h.corto}`} items={[{ label: 'Desmarcar', icon: RotateCw, onClick: onDesmarcar }]} />
          ) : declinada ? (
            puedeRegistrar ? <Menu label={`Acciones del hito ${h.corto}`} items={[{ label: 'Deshacer la decisión', icon: RotateCw, onClick: onDeshacer }]} /> : null
          ) : stage === 'coordinando' && puedeRegistrar ? (
            <Menu
              label={`Más acciones del hito ${h.corto}`}
              items={[
                { label: 'Registrar que el cliente aprobó', icon: CircleCheck, onClick: onAprobo },
                { label: 'Registrar que el cliente declinó', icon: CircleX, onClick: onDeclino },
              ]}
            />
          ) : null}
        </div>

        {/* Resumen del equipo (reporte_listo) · motivo del cliente · nota del equipo */}
        {esperando && reporte?.summary && (
          <blockquote className="mt-1.5 text-sm text-ink-700 border-l-2 border-brand-500 bg-surface rounded-r-md px-3 py-2 whitespace-pre-wrap break-words">
            {reporte.summary}
            <span className="block text-xs text-ink-500 mt-0.5">Lo que vemos en el reporte · lo lee el cliente</span>
          </blockquote>
        )}
        {declinada && motivo && (
          <blockquote className="mt-1.5 text-sm text-ink-700 border-l-2 border-warning bg-surface rounded-r-md px-3 py-2 whitespace-pre-wrap break-words">
            «{motivo}»
            <span className="block text-xs text-ink-500 mt-0.5">Lo que nos contó el cliente al declinar</span>
          </blockquote>
        )}
        {declinada && !porCliente && eleccion.inspection_note && (
          <blockquote className="mt-1.5 text-sm text-ink-700 border-l-2 border-warning bg-surface rounded-r-md px-3 py-2 whitespace-pre-wrap break-words">
            «{eleccion.inspection_note}»
            <span className="block text-xs text-ink-500 mt-0.5">Nota del equipo al cliente</span>
          </blockquote>
        )}

        {/* Acciones */}
        {stage === 'coordinando' && puedeGestionar && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant={actual ? 'primary' : 'secondary'} icon={Upload} onClick={onCargar}>Cargar reporte</Button>
          </div>
        )}
        {esperando && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={FileSearch} onClick={onVer}>Ver reporte</Button>
              {puedeGestionar && <Button size="sm" variant="secondary" icon={Upload} onClick={onReemplazar}>Reemplazar reporte</Button>}
              {puedeRegistrar && (
                <Menu
                  label="Registrar decisión del cliente"
                  width={260}
                  trigger={<Button size="sm" variant="secondary" iconRight={ChevronDown}>Registrar decisión del cliente</Button>}
                  items={[
                    { label: 'El cliente aprobó', icon: CircleCheck, onClick: onAprobo },
                    { label: 'El cliente declinó', icon: CircleX, onClick: onDeclino },
                  ]}
                />
              )}
            </div>
            {puedeRegistrar && (
              <p className="mt-1.5 text-xs text-ink-500">Normalmente decide el cliente desde su panel. Regístrala tú sólo si te la dio por teléfono o WhatsApp.</p>
            )}
          </>
        )}
        {(aprobada || declinada) && reporte && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={FileSearch} onClick={onVer}>Ver reporte</Button>
          </div>
        )}
      </div>
    </li>
  );
}

/* Chip del estado de la traducción al español: traduciendo (con sondeo),
   en español, o falló (con «Reintentar» para admin y soporte). */
function ChipTraduccion({ status, at, onReintentar }) {
  if (status === 'listo') {
    return <Badge tone="success" size="sm" title={at ? `Traducido el ${fmtDateLarga(at, { hora: true })}` : undefined}><Languages size={12} aria-hidden="true" />En español ✓</Badge>;
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="warning" size="sm" title="La traducción automática no terminó. El cliente ve el original."><Languages size={12} aria-hidden="true" />Traducción falló</Badge>
        {onReintentar && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onReintentar}>Reintentar</Button>}
      </span>
    );
  }
  if (status === 'pendiente') {
    return <Badge tone="info" size="sm" title="La IA está traduciendo el reporte al español (1 a 5 minutos)"><Spinner inline size="sm" label="Traduciendo" className="text-info" />Traduciendo…</Badge>;
  }
  return null;
}

/* Una fila del plan: Pago n · % · monto · estado · acción. En móvil se
   parte en dos líneas (pago/monto arriba, estado/acción abajo). */
function FilaCobro({ titulo, detalle, clp, cobro, accion }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900 truncate">{titulo}</p>
        <p className="text-xs text-ink-500 truncate">{detalle}</p>
      </div>
      <p className="text-sm font-semibold text-ink-900 tabular text-right sm:text-left">{fmtCLP(clp)}</p>
      <EstadoCobro cobro={cobro} />
      <div className="justify-self-end">{accion || <span className="inline-block w-8" aria-hidden="true" />}</div>
    </div>
  );
}

function EstadoCobro({ cobro }) {
  if (!cobro) return <span className="text-13 text-ink-500">Sin cobro</span>;
  const pagado = cobro.status === 'paid';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
      <StatusBadge kind="pago" status={cobro.status} dot size="sm" />
      <span className="text-xs text-ink-500 tabular truncate">
        {pagado
          ? [fmtDate(cobro.paid_at || cobro.created_at), cobro.payment_method && paymentMethodLabel(cobro.payment_method)].filter(Boolean).join(' · ')
          : `enviado el ${fmtDate(cobro.created_at)}`}
      </span>
    </div>
  );
}

/* Cobro pendiente: marcarlo pagado (transferencias) o anularlo. Pagado: nada. */
function MenuCobro({ cobro, onEstado }) {
  if (!cobro || cobro.status !== 'pending') return null;
  return (
    <Menu
      label={`Acciones del cobro ${cobro.title}`}
      items={[
        { label: 'Marcar pagado (transferencia)', icon: CircleCheck, onClick: () => onEstado(cobro, 'paid') },
        { separator: true },
        { label: 'Anular cobro', icon: Trash, tone: 'danger', onClick: () => onEstado(cobro, 'cancelled') },
      ]}
    />
  );
}
