import { useState } from 'react';
import { cn, fmtCLP, fmtDate, paymentMethodLabel } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, Menu, Badge, StatusBadge, Callout, EmptyState, Spinner } from '../../../shared/components/UI';
import { Anchor, Ship, CircleCheck, CircleDot, Circle, Check, Plus, Receipt, RotateCw, Pencil, Trash, BadgeCheck, TriangleAlert, Wallet } from '../../../shared/components/Icons';
import { hitosDe, hitoEnCurso, planDePagos, pagosConCobros, precioChile, FUENTE_PRECIO, tituloLancha } from '../../../shared/lib/importacion';
import { inspeccionNoApta, devolucionPedida } from '../../../shared/lib/inspeccion';
import ModalCobro from './ModalCobro';
import ModalHito from './ModalHito';
import ModalNoApta from './ModalNoApta';
import OperacionUsa from './OperacionUsa';
import DatosCliente from './DatosCliente';

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
 * La inspección tiene dos salidas: «Marcar hecho» (= apta, crea el Pago 2) y
 * «Marcar no apta» (ModalNoApta, sólo admin y soporte). Con no apta el hito
 * queda en advertencia —no en error: el cliente se ahorró un problema— y él
 * elige otra lancha o pide la devolución del Pago 1.
 */
export default function SeccionImportacion({ detail, links, importacion, onMarcarElegida, onCotizar, archivos }) {
  const eleccion = detail.eleccion || null;
  const link = eleccion ? links.find(l => l.id === eleccion.link_id) : null;
  const [modalCobro, setModalCobro] = useState(null); // { pago } · { manual: true }
  const [modalHito, setModalHito] = useState(null);   // el hito a marcar
  const [modalNoApta, setModalNoApta] = useState(false);

  const hitos = hitosDe(eleccion);
  const enCurso = hitoEnCurso(eleccion);
  const hechos = hitos.filter(h => h.hecho).length;
  const plan = planDePagos(link);
  const { pagos, otros } = pagosConCobros(plan, importacion.cobros);
  const precio = precioChile(link);
  const equipoChile = importacion.puedeCobrar !== false;
  const noApta = inspeccionNoApta(eleccion);
  const devolucion = devolucionPedida(eleccion);
  const puedeNoApta = equipoChile && typeof importacion.onInspeccionResultado === 'function';
  const pago1 = pagos.find(p => p.n === 1) || null;
  const pago1Pagado = pago1?.estado === 'pagado' ? pago1 : null;

  return (
    <Card id="importacion" className="scroll-mt-32">
      <Card.Header
        title="Importación"
        description={equipoChile
          ? 'La lancha elegida, los datos del cliente, los hitos, los cobros y lo que manda la operación en EE. UU. El cliente lo ve en su panel como «Tu importación».'
          : 'La lancha elegida y los hitos. El cliente lo ve en su panel como «Tu importación».'}
        actions={eleccion ? (
          <>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onMarcarElegida(link || { id: eleccion.link_id })}>Cambiar</Button>
            <Menu
              label="Más acciones de la importación"
              items={[{ label: 'Quitar la elección', icon: Trash, tone: 'danger', onClick: importacion.onQuitar }]}
            />
          </>
        ) : (
          <Button variant="secondary" size="sm" icon={BadgeCheck} onClick={() => onMarcarElegida(null)}>Marcar lancha elegida</Button>
        )}
      />
      <Card.Body className="space-y-5">
        {!eleccion && (
          <EmptyState
            compact
            icon={Anchor}
            title="El cliente todavía no elige lancha"
            description="Cuando decida —desde su panel o por WhatsApp— márcala aquí: parte la importación, se mueve la etapa y se crean los cobros desde la cotización."
            primaryAction={<Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => onMarcarElegida(null)}>Marcar lancha elegida</Button>}
          />
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
                  {noApta && <Badge tone="warning" dot size="sm">No apta según inspección</Badge>}
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

            {/* ── Inspección no apta: qué espera la operación. Sólo el equipo en
                   Chile (lleva montos); el detalle y la nota van en el hito. ── */}
            {equipoChile && noApta && !devolucion && (
              <Callout tone="warning" compact title="La inspección recomendó no comprar esta lancha: el cliente decide">
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
                    ? <>En pausa: <span className="text-warning font-medium">inspección no apta</span></>
                    : enCurso ? <>En curso: <span className="text-ink-700 font-medium">{enCurso.corto}</span></> : 'Importación completa'}
                </span>
              </div>
              <ol className="rounded-md border border-line divide-y divide-line overflow-hidden">
                {hitos.map(h => {
                  // Con no apta, el hito de inspección es el protagonista en
                  // advertencia y nada más está «en curso»: la operación espera
                  // al cliente (otra lancha o devolución).
                  const esNoApta = noApta && h.id === 'inspeccion';
                  const actual = !noApta && enCurso?.id === h.id;
                  const Icono = h.hecho ? CircleCheck : esNoApta ? TriangleAlert : actual ? CircleDot : Circle;
                  const esInspeccionPendiente = !h.hecho && !esNoApta && h.id === 'inspeccion';
                  return (
                    <li key={h.id} className={cn('flex gap-3 px-3 py-2', esNoApta ? 'items-start bg-warning-bg' : 'items-center')}>
                      <Icono size={18} className={cn('shrink-0', esNoApta && 'mt-0.5', h.hecho ? 'text-success' : esNoApta ? 'text-warning' : actual ? 'text-brand-600' : 'text-ink-400')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', h.hecho ? 'text-ink-700' : esNoApta || actual ? 'text-ink-900 font-medium' : 'text-ink-500')}>
                          {esNoApta ? 'Inspección técnica: no apta' : h.label}
                        </p>
                        <p className="text-xs text-ink-500 tabular">
                          {h.hecho ? `Hecho el ${fmtDateLarga(h.hecho)}`
                            : esNoApta ? <>No apta{eleccion.inspection_result_at ? ` · ${fmtDateLarga(eleccion.inspection_result_at)}` : ''} · {devolucion ? 'el cliente pidió la devolución del Pago 1' : 'el cliente elige otra lancha o pide la devolución'}</>
                            : actual ? (esInspeccionPendiente && puedeNoApta ? 'En curso · si el reporte recomienda no comprar, márcala no apta desde el menú' : 'En curso')
                            : 'Pendiente'}
                        </p>
                        {esNoApta && eleccion.inspection_note && (
                          <blockquote className="mt-1.5 text-sm text-ink-700 border-l-2 border-warning bg-surface rounded-r-md px-3 py-2">
                            «{eleccion.inspection_note}»
                            <span className="block text-xs text-ink-500 mt-0.5">Lo que le contamos al cliente</span>
                          </blockquote>
                        )}
                      </div>
                      {h.hecho ? (
                        <Menu
                          label={`Acciones del hito ${h.corto}`}
                          items={[{ label: 'Desmarcar', icon: RotateCw, onClick: () => importacion.onHito(h, false, false) }]}
                        />
                      ) : esNoApta ? (
                        puedeNoApta ? (
                          <Menu
                            label={`Acciones del hito ${h.corto}`}
                            items={[{ label: 'Deshacer no apta', icon: RotateCw, onClick: () => importacion.onInspeccionResultado(null) }]}
                          />
                        ) : null
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="secondary" icon={Check} onClick={() => setModalHito(h)}>Marcar hecho</Button>
                          {esInspeccionPendiente && puedeNoApta && (
                            <Menu
                              label={`Más acciones del hito ${h.corto}`}
                              items={[{ label: 'Marcar no apta', icon: TriangleAlert, onClick: () => setModalNoApta(true) }]}
                            />
                          )}
                        </div>
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
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setModalCobro({ manual: true })}>Cobro manual</Button>
              </div>

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
                        ? <Button size="sm" variant="secondary" icon={Receipt} onClick={() => setModalCobro({ pago: p })}>Crear cobro</Button>
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
              <OperacionUsa detail={detail} eleccion={eleccion} archivos={archivos} />
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
          puedeNoApta={puedeNoApta}
        />
      )}
      {modalNoApta && (
        <ModalNoApta
          open
          onClose={() => setModalNoApta(false)}
          link={link}
          pago1={pago1}
          onConfirmar={importacion.onInspeccionResultado}
        />
      )}
    </Card>
  );
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
