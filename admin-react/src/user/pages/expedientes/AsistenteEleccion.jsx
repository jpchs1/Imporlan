import { useState, useRef, useEffect } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { Modal, Button, Callout, Textarea, Money, Badge } from '../../../shared/components/UI';
import { Check, Image, MessageSquareText, ExternalLink, ClipboardCheck } from '../../../shared/components/Icons';
import { precioChile, FUENTE_PRECIO, INSPECCION_PRECIOS, INSPECCION_INCLUYE, hitosDe, planDePagos } from '../../../shared/lib/importacion';
import { chooseLink } from '../../api';
import MatrizPrecios from './MatrizPrecios';
import ResumenCotizacion from './ResumenCotizacion';
import BotonEnlace from './BotonEnlace';
import { tituloEmbarcacion, specsEmbarcacion, fuenteAnuncio, urlAbsoluta } from './lib';

const PASOS = [
  { n: 1, label: 'Revisa la lancha' },
  { n: 2, label: 'Inspección técnica' },
  { n: 3, label: 'Confirma' },
];

/**
 * «Elegir esta lancha»: tres pasos cortos (revisar · inspección · confirmar)
 * y un estado de éxito dentro del mismo modal. Elegir no es pagar, y se dice
 * en el paso 3 y al final. Se monta solo abierto, así cada vez parte limpio.
 *
 *   <AsistenteEleccion open link={link} order={order} anterior={linkElegido}
 *                      onClose={…} onSuccess={eleccion => recargar()} />
 */
export default function AsistenteEleccion({ open, onClose, link, order, anterior, onSuccess }) {
  const [paso, setPaso] = useState(1);
  const [inspection, setInspection] = useState(true);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
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
  const reemplaza = anterior && Number(anterior.id) !== Number(link.id) ? tituloEmbarcacion(anterior) : null;

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      const data = await chooseLink(order.id, link.id, inspection, nota);
      if (data?.success) {
        setExito(true);
        onSuccess?.(data.eleccion || null);
      } else {
        setError(data?.error || 'No pudimos guardar tu elección. Vuelve a intentarlo.');
      }
    } catch (e) {
      setError(e?.message || 'Error de conexión. Revisa tu internet y vuelve a intentarlo.');
    }
    setEnviando(false);
  }

  function verImportacion() {
    onClose?.();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pasoActual = PASOS[paso - 1];

  let footer;
  if (exito) {
    footer = <Button onClick={verImportacion}>Ver mi importación</Button>;
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
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setPaso(2)} disabled={enviando}>Atrás</Button>
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
        <Exito title={title} agente={agente} inspection={inspection} tituloRef={tituloRef} />
      ) : (
        <div className="space-y-5">
          <IndicadorPasos paso={paso} />
          {paso === 1 && <PasoRevisar link={link} title={title} precio={precio} tituloRef={tituloRef} />}
          {paso === 2 && <PasoInspeccion inspection={inspection} onInspection={setInspection} nota={nota} onNota={setNota} tituloRef={tituloRef} />}
          {paso === 3 && (
            <PasoConfirmar
              link={link}
              title={title}
              precio={precio}
              plan={plan}
              inspection={inspection}
              nota={nota}
              agente={agente}
              reemplaza={reemplaza}
              error={error}
              tituloRef={tituloRef}
            />
          )}
        </div>
      )}
    </Modal>
  );
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

function PasoInspeccion({ inspection, onInspection, nota, onNota, tituloRef }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 ref={tituloRef} tabIndex={-1} className="text-base font-semibold leading-6 text-ink-900 outline-none">¿Quieres una inspección técnica antes de comprar?</h3>
        <p className="mt-1 text-13 text-ink-500">Un inspector revisa la lancha en Estados Unidos y te manda el reporte antes de que pagues la compra.</p>
      </div>

      <div role="radiogroup" aria-label="Inspección técnica" className="space-y-3">
        <OpcionInspeccion
          checked={inspection}
          onSelect={() => onInspection(true)}
          titulo="Con inspección"
          badge="Recomendada"
          texto="Sabes en qué estado está la lancha antes de pagarla. El reporte queda en tu expediente."
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
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
            <div className="sm:w-56">
              <p className="eyebrow mb-1.5">Costo referencial según eslora</p>
              <table className="w-full text-13">
                <tbody className="divide-y divide-brand-200">
                  {INSPECCION_PRECIOS.map(p => (
                    <tr key={p.rango}>
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-700">{p.rango}</th>
                      <td className="py-1.5 text-right font-semibold text-ink-900 tabular">{p.precio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1.5 text-xs text-ink-500">Puede variar según la ubicación y la eslora exacta. Te lo confirmamos antes de coordinar; no se cobra al elegir.</p>
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
   Paso 3 · Confirma
   --------------------------------------------------------------------------- */
function PasoConfirmar({ link, title, precio, plan, inspection, nota, agente, reemplaza, error, tituloRef }) {
  const [imgError, setImgError] = useState(false);
  const specs = specsEmbarcacion(link);
  const hitos = hitosDe({ inspection, steps: {} });
  const hayFoto = link.image_url && !imgError;

  return (
    <div className="space-y-5">
      {/* tabIndex 0 a propósito: este paso no tiene controles dentro del cuerpo
          con scroll, y con el título tabulable se puede recorrer con teclado
          (axe: scrollable-region-focusable). */}
      <h3 ref={tituloRef} tabIndex={0} className="rounded-sm text-base font-semibold leading-6 text-ink-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">Confirma tu elección</h3>

      {reemplaza && (
        <Callout tone="warning" title={`Reemplaza a ${reemplaza}`}>
          Tu elección anterior queda sin efecto y se lo avisamos a {agente}.
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
              {inspection ? 'Sí, antes de comprar' : 'No'}
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
              <ul className="space-y-0.5">
                {plan.map(p => (
                  <li key={p.n} className="flex items-baseline justify-between gap-3 tabular">
                    <span className="text-ink-700">Pago {p.n} · {p.pct}%</span>
                    <span className="font-medium text-ink-900">{fmtCLP(p.clp)}</span>
                  </li>
                ))}
              </ul>
            </FilaResumen>
          )}
          {nota.trim() && <FilaResumen label="Para tu agente"><span className="whitespace-pre-line">{nota.trim()}</span></FilaResumen>}
        </dl>
      </div>

      <section aria-labelledby="que-pasa-despues">
        <h4 id="que-pasa-despues" className="eyebrow">Qué pasa después</h4>
        <ol className="mt-2 space-y-2">
          <PasoDespues n={1} titulo={`Le avisamos a ${agente}`} texto="Hoy mismo, con tu nota." />
          {hitos.map((h, i) => (
            <PasoDespues key={h.id} n={i + 2} titulo={h.label} texto={h.enCurso} />
          ))}
        </ol>
      </section>

      <Callout tone="info" title="Elegir no es un pago">
        El primer cobro te llega cuando {agente} confirme la disponibilidad y el precio. Lo verás aquí y en Pagos; hasta entonces no tienes nada que pagar.
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
   Éxito
   --------------------------------------------------------------------------- */
function Exito({ title, agente, inspection, tituloRef }) {
  return (
    <div className="flex flex-col items-center py-4 text-center sm:py-6" role="status">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
        <Check size={28} strokeWidth={2.5} />
      </span>
      <h3 ref={tituloRef} tabIndex={-1} className="mt-4 text-xl font-semibold leading-7 text-ink-900 outline-none">Listo, elegiste {title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-700">
        Le avisamos a {agente}. Te escribe cuando confirme con el vendedor que sigue disponible y el precio final; recién ahí te llega el primer cobro.
      </p>
      {inspection && <p className="mt-2 text-13 text-ink-500">Pediste inspección técnica: la coordinamos antes de comprar.</p>}
    </div>
  );
}
