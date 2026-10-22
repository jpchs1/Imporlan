import { useState, useRef, useEffect } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Modal, Button, Callout, Textarea, Money, Badge } from '../../../shared/components/UI';
import { Check, Image, MessageSquareText, ExternalLink, ClipboardCheck, Receipt } from '../../../shared/components/Icons';
import { precioChile, FUENTE_PRECIO, INSPECCION_INCLUYE, hitosDe, planDePagos, pago1De } from '../../../shared/lib/importacion';
import { POR_QUE_INSPECCIONAR } from '../../../shared/lib/inspeccion';
import { chooseLink } from '../../api';
import MatrizPrecios from './MatrizPrecios';
import ResumenCotizacion from './ResumenCotizacion';
import BotonEnlace from './BotonEnlace';
import FormularioDatos from './FormularioDatos';
import CaminoInspeccion from './CaminoInspeccion';
import { BotonEnlace as BotonRuta } from '../inicio/BotonEnlace';
import { tituloEmbarcacion, specsEmbarcacion, fuenteAnuncio, urlAbsoluta, rutaPagar } from './lib';

const PASOS = [
  { n: 1, label: 'Revisa la lancha' },
  { n: 2, label: 'Inspección técnica' },
  { n: 3, label: 'Tus datos' },
  { n: 4, label: 'Confirma' },
];

const FORM_DATOS = 'asistente-datos';

/**
 * «Elegir esta lancha»: cuatro pasos cortos (revisar · inspección · tus
 * datos · confirmar) y un estado de éxito dentro del mismo modal.
 *
 * En «Tus datos» (FormularioDatos) el cliente deja sus datos, la cédula por
 * ambos lados y acepta los Términos: sin eso el servidor no deja elegir
 * (409 `faltan_datos`, que devuelve a ese paso). Al confirmar, el servidor
 * crea el cobro del Pago 1 (el primer pago del plan de la cotización
 * publicada) y lo devuelve en `pago1`; la inspección no se cobra aparte, va
 * dentro de la operación. Sin cotización publicada no hay Pago 1 todavía: le
 * llega al cliente cuando esté lista.
 *
 * Con `anteriorNoApta` la lancha que se reemplaza salió no apta en la
 * inspección: no es un cambio de opinión, es el camino previsto, y si el
 * Pago 1 ya estaba pagado (`pago1Abonado`) se abona a la nueva en vez de
 * cobrarse de nuevo.
 *
 * Se monta solo abierto, así cada vez parte limpio.
 *
 *   <AsistenteEleccion open link={link} order={order} anterior={linkElegido}
 *                      inspeccionInicial onClose={…} onSuccess={eleccion => recargar()} />
 */
export default function AsistenteEleccion({ open, onClose, link, order, anterior, anteriorNoApta = false, pago1Abonado = false, inspeccionInicial = true, onSuccess }) {
  const [paso, setPaso] = useState(1);
  const [inspection, setInspection] = useState(!!inspeccionInicial);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [pago1, setPago1] = useState(null); // lo que respondió el servidor al elegir
  const [datos, setDatos] = useState(null); // respuesta de user_import_data (se cachea entre pasos)
  const [estadoDatos, setEstadoDatos] = useState({ cargando: true, enviando: false, resumen: false });
  const [avisoDatos, setAvisoDatos] = useState(''); // el 409 faltan_datos del servidor
  const borradorDatos = useRef(null);
  const tituloRef = useRef(null);

  // Al cambiar de paso, el cuerpo del modal vuelve arriba (en móvil el paso 2
  // queda scrolleado tras escribir la nota) y el foco va al título del paso:
  // un lector de pantalla lo anuncia y el teclado sigue desde ahí.
  useEffect(() => {
    const h = tituloRef.current;
    if (!h) return;
    let p = h.parentElement;
    while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
    if (p) p.scrollTop = 0;
    h.focus({ preventScroll: true });
  }, [paso, exito]);

  if (!open || !link) return null;

  const title = tituloEmbarcacion(link);
  const agente = order?.agent_name || 'tu agente';
  const precio = precioChile(link);
  const plan = planDePagos(link);
  const primerPago = pago1De(link);
  const reemplaza = anterior && Number(anterior.id) !== Number(link.id) ? tituloEmbarcacion(anterior) : null;

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      const data = await chooseLink(order.id, link.id, inspection, nota);
      if (data?.success) {
        setPago1(data.pago1 || null);
        setExito(true);
        onSuccess?.(data.eleccion || null);
      } else {
        setError(data?.error || 'No pudimos guardar tu elección. Vuelve a intentarlo.');
      }
    } catch (e) {
      if (e?.code === 'faltan_datos') {
        // Al servidor le faltan los datos, la cédula o los Términos vigentes:
        // de vuelta a «Tus datos», pidiéndolos de nuevo (sin caché ni borrador).
        setDatos(null);
        borradorDatos.current = null;
        setAvisoDatos(e.message || 'Completa tus datos, sube tu cédula y acepta los Términos para poder elegir.');
        setPaso(3);
      } else {
        setError(e?.message || 'Error de conexión. Revisa tu internet y vuelve a intentarlo.');
      }
    }
    setEnviando(false);
  }

  function verImportacion() {
    onClose?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pasoActual = PASOS[paso - 1];
  const pago1Pendiente = pago1 && pago1.status === 'pending' && pago1.id;

  let footer;
  if (exito) {
    // Con un Pago 1 por pagar, pagarlo es el primario; ver la importación
    // queda como secundario.
    footer = pago1Pendiente ? (
      <>
        <Button variant="secondary" onClick={verImportacion} className="w-full sm:w-auto">Ver mi importación</Button>
        <BotonRuta to={rutaPagar(pago1)} variant="primary" icon={Receipt} className="w-full sm:w-auto">Pagar el Pago 1 · {fmtCLP(pago1.amount_clp)}</BotonRuta>
      </>
    ) : (
      <Button onClick={verImportacion}>Ver mi importación</Button>
    );
  } else if (paso === 1) {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => setPaso(2)}>Continuar</Button>
      </>
    );
  } else if (paso === 2) {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPaso(1)}>Atrás</Button>
        <Button onClick={() => setPaso(3)}>Continuar</Button>
      </>
    );
  } else if (paso === 3) {
    // Con el formulario a la vista, «Continuar» lo envía (guarda con POST y
    // recién entonces pasa a «Confirma»); con el resumen, sólo avanza.
    // La `key` del botón de envío importa: sin ella React reutiliza el nodo
    // del «Continuar» del paso 2 y el navegador, al terminar ese mismo clic,
    // ya lo ve como submit y manda el formulario recién montado.
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPaso(2)} disabled={estadoDatos.enviando}>Atrás</Button>
        {estadoDatos.resumen ? (
          <Button onClick={() => setPaso(4)}>Continuar</Button>
        ) : (
          <Button key="guardar-datos" type="submit" form={FORM_DATOS} loading={estadoDatos.enviando} disabled={estadoDatos.cargando}>Guardar y continuar</Button>
        )}
      </>
    );
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPaso(3)} disabled={enviando}>Atrás</Button>
        <Button onClick={confirmar} loading={enviando} icon={Check}>Confirmar mi elección</Button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={enviando ? undefined : onClose}
      title={exito ? 'Elección guardada' : 'Elegir esta lancha'}
      description={exito ? title : `Paso ${paso} de ${PASOS.length} · ${pasoActual.label}`}
      size="lg"
      footer={footer}
    >
      {exito ? (
        <Exito title={title} agente={agente} inspection={inspection} pago1={pago1} tituloRef={tituloRef} />
      ) : (
        <div className="space-y-5">
          <IndicadorPasos paso={paso} />
          {paso === 1 && <PasoRevisar link={link} title={title} precio={precio} tituloRef={tituloRef} />}
          {paso === 2 && (
            <PasoInspeccion
              inspection={inspection}
              onInspection={setInspection}
              nota={nota}
              onNota={setNota}
              primerPago={primerPago}
              cuantosPagos={plan.length}
              pago1Abonado={pago1Abonado}
              tituloRef={tituloRef}
            />
          )}
          {paso === 3 && (
            <PasoDatos
              order={order}
              datos={datos}
              borrador={borradorDatos}
              aviso={avisoDatos}
              onDatos={setDatos}
              onGuardado={(d) => { setDatos(d); setAvisoDatos(''); setPaso(4); }}
              onEstado={setEstadoDatos}
              tituloRef={tituloRef}
            />
          )}
          {paso === 4 && (
            <PasoConfirmar
              link={link}
              title={title}
              precio={precio}
              plan={plan}
              primerPago={primerPago}
              inspection={inspection}
              nota={nota}
              datos={datos}
              agente={agente}
              reemplaza={reemplaza}
              reemplazaNoApta={anteriorNoApta}
              pago1Abonado={pago1Abonado}
              error={error}
              tituloRef={tituloRef}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

/** «Pago 1 · 7% · $12.523.000» o, sin plan, «el Pago 1». */
function nombrePago1(primerPago, { capital = false } = {}) {
  const base = capital ? 'El Pago 1' : 'el Pago 1';
  if (!primerPago) return base;
  return `${base} (${primerPago.pct}% · ${fmtCLP(primerPago.clp)})`;
}

/* ---------------------------------------------------------------------------
   Indicador de progreso (1 · 2 · 3). En móvil basta con la descripción del
   modal («Paso 2 de 3 · Inspección técnica»); aquí se ve desde sm.
   --------------------------------------------------------------------------- */
function IndicadorPasos({ paso }) {
  return (
    <ol className="hidden items-center gap-2 sm:flex" aria-label="Pasos del asistente">
      {PASOS.map((p, i) => {
        const hecho = p.n < paso;
        const activo = p.n === paso;
        const alFinal = i === PASOS.length - 1;
        return (
          <li key={p.n} className={cn('flex min-w-0 items-center gap-2', !alFinal && 'flex-1')} aria-current={activo ? 'step' : undefined}>
            <span className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular',
              hecho ? 'bg-brand-600 text-white' : activo ? 'border-2 border-brand-600 bg-surface text-brand-700' : 'border border-line-strong bg-surface text-ink-500',
            )}>
              {hecho ? <Check size={14} strokeWidth={2.5} /> : p.n}
            </span>
            <span className={cn('truncate text-13', activo ? 'font-semibold text-ink-900' : hecho ? 'text-ink-700' : 'text-ink-500')}>{p.label}</span>
            {!alFinal && <span className={cn('h-px min-w-4 flex-1', hecho ? 'bg-brand-600' : 'bg-line')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------------------
   Paso 1 · Revisa la lancha
   --------------------------------------------------------------------------- */
function PasoRevisar({ link, title, precio, tituloRef }) {
  const [imgError, setImgError] = useState(false);
  const specs = specsEmbarcacion(link);
  const fuente = fuenteAnuncio(link.url);
  const url = urlAbsoluta(link.url);
  const hayFoto = link.image_url && !imgError;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-44 w-full shrink-0 overflow-hidden rounded-md border border-line bg-neutral-bg sm:h-32 sm:w-48">
          {hayFoto ? (
            <img src={link.image_url} alt={`Foto de ${title}`} className="h-full w-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-700">
              <Image size={20} className="text-ink-500" />
              <span className="text-xs font-medium">Sin foto</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 ref={tituloRef} tabIndex={-1} className="text-xl font-semibold leading-7 text-ink-900 outline-none">{title}</h3>
          {(specs.length > 0 || fuente) && (
            <p className="mt-1 text-13 text-ink-500">
              {specs.join(' · ')}
              {specs.length > 0 && fuente && ' · '}
              {fuente && <span>Anuncio en {fuente}</span>}
            </p>
          )}
          {url && <BotonEnlace href={url} size="sm" icon={ExternalLink} className="mt-3">Ver anuncio</BotonEnlace>}
        </div>
      </div>

      {link.comments && (
        <p className="flex items-start gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-13 text-ink-700">
          <MessageSquareText size={14} className="mt-0.5 shrink-0 text-ink-500" />
          <span><span className="font-medium text-ink-900">Nota de tu agente: </span>{link.comments}</span>
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-canvas px-4 py-3">
        <div className="min-w-0">
          <p className="eyebrow">Precio puesto en Chile</p>
          {precio ? (
            <Money clp={precio.clp} usd={precio.usd || undefined} size="xl" />
          ) : (
            <p className="mt-1 text-sm text-ink-700">Por confirmar: tu agente te lo informa antes de cualquier pago.</p>
          )}
        </div>
        {precio && <Badge tone={precio.fuente === 'cotizacion' ? 'success' : 'neutral'}>{FUENTE_PRECIO[precio.fuente]}</Badge>}
      </div>

      {link.quote_pending ? (
        <Callout tone="info" title="La cotización final está en análisis">
          Puedes elegir igual. El precio definitivo se confirma antes de cualquier pago.
        </Callout>
      ) : null}

      <MatrizPrecios link={link} />
      {!link.quote_pending && <ResumenCotizacion link={link} />}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Paso 2 · Inspección técnica
   --------------------------------------------------------------------------- */
function OpcionInspeccion({ checked, onSelect, titulo, badge, texto, children }) {
  return (
    <div className={cn('rounded-lg border transition-colors duration-150', checked ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:border-ink-400')}>
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
        <input type="radio" name="inspeccion-tecnica" className="peer sr-only" checked={checked} onChange={onSelect} />
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40',
            checked ? 'border-brand-600' : 'border-line-strong',
          )}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-brand-600" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
            {titulo}
            {badge && <Badge tone="success" size="sm">{badge}</Badge>}
          </span>
          <span className="mt-0.5 block text-13 text-ink-700">{texto}</span>
        </span>
      </label>
      {checked && children && <div className="border-t border-brand-200 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function PasoInspeccion({ inspection, onInspection, nota, onNota, primerPago, cuantosPagos, pago1Abonado, tituloRef }) {
  const pagos = cuantosPagos > 0 ? cuantosPagos : 3;
  let cuanto;
  if (pago1Abonado) cuanto = <>La operación se paga en {pagos} pagos. Tu Pago 1 ya está pagado y se abona a esta lancha: no tienes nada que pagar ahora.</>;
  else if (primerPago) cuanto = <>La operación se paga en {pagos} pagos. {nombrePago1(primerPago, { capital: true })} es el que la pone en marcha, y te llega al confirmar.</>;
  else cuanto = <>La operación se paga en {pagos} pagos. El Pago 1 es el que la pone en marcha y te llega apenas esté lista tu cotización final.</>;

  return (
    <div className="space-y-5">
      <div>
        <h3 ref={tituloRef} tabIndex={-1} className="text-base font-semibold leading-6 text-ink-900 outline-none">¿Quieres una inspección técnica antes de comprar?</h3>
        <p className="mt-1 text-13 text-ink-500">Un inspector revisa la lancha en Estados Unidos y el reporte te llega, en inglés y en español, antes de que pagues la compra. Tú decides si seguimos.</p>
      </div>

      {/* Por qué inspeccionar (JP): conocer el estado real y, según el
          resultado, avanzar o cambiar de lancha sin arrastrar un problema. */}
      <section aria-labelledby="por-que-inspeccionar" className="rounded-lg border border-line bg-surface p-4">
        <h4 id="por-que-inspeccionar" className="eyebrow">Por qué inspeccionar</h4>
        <p className="mt-1 text-sm text-ink-700">{POR_QUE_INSPECCIONAR}</p>
        <CaminoInspeccion className="mt-4" />
      </section>

      <div role="radiogroup" aria-label="Inspección técnica" className="space-y-3">
        <OpcionInspeccion
          checked={inspection}
          onSelect={() => onInspection(true)}
          titulo="Con inspección"
          badge="Recomendada"
          texto="Sabes en qué estado está la lancha antes de pagarla. El reporte queda en tu expediente, en inglés y en español, y tú decides si seguimos."
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="eyebrow mb-1.5">Qué incluye</p>
              <ul className="space-y-1">
                {INSPECCION_INCLUYE.map(it => (
                  <li key={it} className="flex items-start gap-2 text-13 text-ink-700">
                    <Check size={14} className="mt-0.5 shrink-0 text-success" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="self-start rounded-md border border-brand-200 bg-surface px-3.5 py-3">
              <p className="eyebrow mb-1">Cuánto cuesta</p>
              <p className="text-sm font-medium text-ink-900">Va incluida en la operación</p>
              <p className="mt-1 text-13 text-ink-700">{cuanto}</p>
            </div>
          </div>
        </OpcionInspeccion>

        <OpcionInspeccion
          checked={!inspection}
          onSelect={() => onInspection(false)}
          titulo="Sin inspección"
          texto="Avanzamos directo a la compra. Solo si ya conoces la lancha o alguien de tu confianza la revisó."
        />
      </div>

      <Textarea
        label="¿Algo que deba saber tu agente?"
        value={nota}
        onChange={e => onNota(e.target.value)}
        maxLength={1000}
        showCount
        rows={3}
        placeholder="Por ejemplo: fechas en que puedes viajar, qué revisar con más cuidado o cómo prefieres pagar."
        hint="Opcional. Va en el aviso que le llega a tu agente."
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Paso 3 · Tus datos (FormularioDatos). `datos` es la respuesta ya cargada,
   si la hay; `borrador` guarda lo escrito al ir y volver entre pasos.
   --------------------------------------------------------------------------- */
function PasoDatos({ order, datos, borrador, aviso, onDatos, onGuardado, onEstado, tituloRef }) {
  return (
    <div className="space-y-4">
      <h3 ref={tituloRef} tabIndex={-1} className="text-base font-semibold leading-6 text-ink-900 outline-none">Tus datos para la importación</h3>
      {aviso && <Callout tone="warning" title="Antes de confirmar, completa tus datos">{aviso}</Callout>}
      <FormularioDatos
        formId={FORM_DATOS}
        orderId={order.id}
        inicial={datos}
        prefillNombre={order.customer_name || ''}
        prefillTelefono={order.customer_phone || ''}
        resumenSiCompleto
        borrador={borrador}
        onCargado={onDatos}
        onGuardado={onGuardado}
        onEstado={onEstado}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Paso 4 · Confirma
   --------------------------------------------------------------------------- */
function PasoConfirmar({ link, title, precio, plan, primerPago, inspection, nota, datos, agente, reemplaza, reemplazaNoApta, pago1Abonado, error, tituloRef }) {
  const [imgError, setImgError] = useState(false);
  const specs = specsEmbarcacion(link);
  const hitos = hitosDe({ inspection, steps: {} });
  const hayFoto = link.image_url && !imgError;
  const conQue = inspection ? 'coordinamos la inspección técnica y confirmamos' : 'confirmamos';
  let tituloPago1;
  let conPago1;
  if (pago1Abonado) {
    tituloPago1 = 'Tu Pago 1 ya está pagado: se abona a esta lancha';
    conPago1 = `No tienes nada que pagar ahora. Con él ${conQue} la compra con el vendedor; el Pago 2 te llega ${inspection ? 'cuando se apruebe la inspección' : 'cuando el vendedor confirme disponibilidad y precio'}.`;
  } else if (primerPago) {
    tituloPago1 = `Al confirmar te llega el Pago 1 · ${primerPago.pct}% · ${fmtCLP(primerPago.clp)}`;
    conPago1 = `Es el que inicia la operación: lo pagas en Pagos, con tarjeta o transferencia. Con él ${conQue} la compra con el vendedor.`;
  } else {
    tituloPago1 = 'El Pago 1 te llega apenas esté lista tu cotización final';
    conPago1 = `Es el que inicia la operación: lo pagas en Pagos, con tarjeta o transferencia, y con él ${conQue} la compra con el vendedor. Hasta entonces no tienes nada que pagar.`;
  }

  return (
    <div className="space-y-5">
      {/* tabIndex 0 a propósito: este paso no tiene controles dentro del cuerpo
          con scroll, y con el título tabulable se puede recorrer con teclado
          (axe: scrollable-region-focusable). */}
      <h3 ref={tituloRef} tabIndex={0} className="rounded-sm text-base font-semibold leading-6 text-ink-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">Confirma tu elección</h3>

      {reemplaza && reemplazaNoApta && (
        <Callout tone="info" title={`Reemplaza a ${reemplaza}, que salió no apta en la inspección`}>
          Con esta lancha partimos de cero: disponibilidad, inspección si la pides y compra. {pago1Abonado ? 'Tu Pago 1 se abona a esta lancha; no se cobra de nuevo.' : 'Si tenías un Pago 1 pendiente de la anterior, se anula y te llega el de esta.'} Se lo avisamos a {agente}.
        </Callout>
      )}
      {reemplaza && !reemplazaNoApta && (
        <Callout tone="warning" title={`Reemplaza a ${reemplaza}`}>
          Tu elección anterior queda sin efecto y se lo avisamos a {agente}. Si tenías un Pago 1 pendiente de esa lancha, se anula y te llega el de esta.
        </Callout>
      )}

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-3">
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-sm border border-line bg-neutral-bg">
            {hayFoto ? (
              <img src={link.image_url} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-500"><Image size={16} /></div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{title}</p>
            {specs.length > 0 && <p className="truncate text-13 text-ink-500">{specs.join(' · ')}</p>}
          </div>
        </div>
        <dl className="divide-y divide-line px-4">
          <FilaResumen label="Inspección técnica">
            <span className="inline-flex items-center gap-1.5">
              {inspection && <ClipboardCheck size={14} className="text-success" />}
              {inspection ? 'Sí, antes de comprar · incluida en la operación' : 'No'}
            </span>
          </FilaResumen>
          <FilaResumen label="Precio puesto en Chile">
            {precio ? (
              <span className="inline-flex flex-wrap items-baseline gap-x-2">
                <Money clp={precio.clp} usd={precio.usd || undefined} inline />
                <span className="text-xs text-ink-500">{FUENTE_PRECIO[precio.fuente]}</span>
              </span>
            ) : 'Por confirmar'}
          </FilaResumen>
          {plan.length > 0 && (
            <FilaResumen label="Plan de pagos">
              <ul className="space-y-1">
                {plan.map(p => (
                  <li key={p.n} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 tabular">
                    <span className="inline-flex items-center gap-2 text-ink-700">
                      Pago {p.n} · {p.pct}%
                      {p.n === 1 && (pago1Abonado ? <Badge tone="success" size="sm">Ya pagado · se abona</Badge> : <Badge tone="warning" size="sm">Al confirmar</Badge>)}
                    </span>
                    <span className="font-medium text-ink-900">{fmtCLP(p.clp)}</span>
                  </li>
                ))}
              </ul>
            </FilaResumen>
          )}
          <FilaResumen label="Tus datos y tu cédula">
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <Check size={14} className="text-success" />
              Listos{datos?.datos?.rut ? <span className="text-ink-700"> · RUT {datos.datos.rut}</span> : null}
            </span>
          </FilaResumen>
          <FilaResumen label="Términos y Condiciones">
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <Check size={14} className="text-success" />
              Aceptaste los Términos{datos?.terminos?.aceptados_at ? <span className="text-ink-700"> · {fmtDateLarga(datos.terminos.aceptados_at)}</span> : null}
            </span>
          </FilaResumen>
          {nota.trim() && <FilaResumen label="Para tu agente"><span className="whitespace-pre-line">{nota.trim()}</span></FilaResumen>}
        </dl>
      </div>

      <section aria-labelledby="que-pasa-despues">
        <h4 id="que-pasa-despues" className="eyebrow">Qué pasa después</h4>
        <ol className="mt-2 space-y-2">
          <PasoDespues n={1} titulo={`Le avisamos a ${agente}`} texto="Hoy mismo, con tu nota." />
          {pago1Abonado ? (
            <PasoDespues n={2} titulo="Tu Pago 1 se abona a esta lancha" texto="Ya lo pagaste: no tienes nada que pagar ahora." />
          ) : (
            <PasoDespues
              n={2}
              titulo={primerPago ? `Pagas el Pago 1 · ${primerPago.pct}% · ${fmtCLP(primerPago.clp)}` : 'Pagas el Pago 1'}
              texto={primerPago ? 'Te llega al confirmar. Lo pagas en Pagos, con tarjeta o transferencia.' : 'Te llega apenas esté lista tu cotización final. Lo pagas en Pagos, con tarjeta o transferencia.'}
            />
          )}
          {hitos.map((h, i) => (
            <PasoDespues key={h.id} n={i + 3} titulo={h.label} texto={h.enCurso} />
          ))}
        </ol>
      </section>

      <Callout tone="info" title={tituloPago1}>
        {conPago1}
      </Callout>

      {error && (
        <Callout tone="danger" title="No pudimos guardar tu elección">{error}</Callout>
      )}
    </div>
  );
}

function FilaResumen({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-13 text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-900">{children}</dd>
    </div>
  );
}

function PasoDespues({ n, titulo, texto }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-xs font-semibold text-ink-700 tabular" aria-hidden="true">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{titulo}</p>
        <p className="text-13 text-ink-500">{texto}</p>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------------------
   Éxito. `pago1` es lo que respondió el servidor: null sin cotización
   publicada; con status 'pending' el pie ofrece pagarlo.
   --------------------------------------------------------------------------- */
function Exito({ title, agente, inspection, pago1, tituloRef }) {
  let siguiente;
  if (pago1?.status === 'pending') {
    siguiente = <>Le avisamos a {agente}. Para iniciar la operación te llega el <span className="font-medium text-ink-900">Pago 1{pago1.pct ? ` · ${pago1.pct}%` : ''} · {fmtCLP(pago1.amount_clp)}</span>: lo pagas en Pagos, con tarjeta o transferencia. Con él {inspection ? 'coordinamos la inspección técnica y confirmamos' : 'confirmamos'} la compra con el vendedor.</>;
  } else if (pago1?.status === 'paid') {
    siguiente = <>Le avisamos a {agente}. Tu Pago 1 ya está pagado, así que seguimos directo con {inspection ? 'la inspección técnica y la compra' : 'la compra'}.</>;
  } else {
    siguiente = <>Le avisamos a {agente}. El Pago 1 te llega apenas esté lista tu cotización final; lo verás aquí y en Pagos. Hasta entonces no tienes nada que pagar.</>;
  }

  return (
    <div className="flex flex-col items-center py-4 text-center sm:py-6" role="status">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
        <Check size={28} strokeWidth={2.5} />
      </span>
      <h3 ref={tituloRef} tabIndex={-1} className="mt-4 text-xl font-semibold leading-7 text-ink-900 outline-none">Listo, elegiste {title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-700">{siguiente}</p>
      {inspection && pago1?.status !== 'pending' && <p className="mt-2 text-13 text-ink-500">Pediste inspección técnica: la coordinamos antes de comprar.</p>}
    </div>
  );
}
