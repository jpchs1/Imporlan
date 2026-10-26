import { useRef, useState, useCallback } from 'react';
import { scrapeBoatTrader, scrapeLink, rescrapeOrderLink } from '../api';
import { cn, fmtCLP } from '../../shared/lib/utils';
import { fmtUSD, fmtDateLarga } from '../../shared/lib/format';
import { estadoCotizacion } from './quote-state';
import { sePuedeElegir } from '../../shared/lib/importacion';
import { Button, Input, MoneyInput, Badge, Menu, Spinner } from '../../shared/components/UI';
import { GripVertical, Image as ImageIcon, Upload, ChevronDown, Receipt, Send, RefreshCw, ExternalLink, Copy, Trash, Info, TriangleAlert, Loader, BadgeCheck } from '../../shared/components/Icons';

function isBoatTraderUrl(url) {
  return /boattrader\.com|boats\.com/i.test(url || '');
}

/**
 * Importe → número. De la base llegan como DECIMAL en texto ("139900.00",
 * "189400000"); lo que escribe el admin llega como dígitos (el MoneyInput
 * entrega números) y lo del scraper, como número. Un solo punto con uno o dos
 * decimales es decimal; los puntos que agrupan de a tres son miles
 * ("1.234.567") y la coma es decimal ("1.234,50"). Borrar todos los puntos a
 * ciegas convertía los USD 100.000 de la base ("100000.00") en USD 10.000.000.
 */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$\s]/g, '').replace(',', '.');
  const canon = /^-?\d+(\.\d{1,2})?$/.test(s) ? s : s.replace(/\.(?=\d{3}(?!\d))/g, '');
  const n = parseFloat(canon);
  return Number.isFinite(n) ? n : null;
}

/**
 * Dominios que el servidor lee en segundo plano.
 *
 * Es la misma lista que urlNecesitaCola() en el backend. Pedirlos desde el
 * navegador no funciona: tardan entre 50 y 90 segundos y la peticion se corta
 * antes.
 */
function necesitaCola(url) {
  return /yachtworld\.|boattrader\.com|boats\.com|boatsgroup\.com/i.test(url || '');
}

/* El MoneyInput del kit entrega números; la fila guarda lo mismo que antes
   (texto de dígitos, o '' para que el contenedor lo vuelva NULL). */
const aTexto = v => (v === null || v === undefined ? '' : String(v));

/**
 * Fila del ranking: cabecera (posición, foto, título, estado, selección,
 * acciones) y cuerpo colapsable con la ficha y la matriz de precios.
 * `elegida` la distingue como la lancha con la que el cliente avanza;
 * `onMarcarElegida(lk)` abre el modal de elección con esta fila.
 */
export default function LinkRow({ link, idx, orderId, onUpdate, onDelete, onImageUpload, onScrapeResult, onEncolado, onEncolarUrl, onCotizar, onEnviarDesglose, dragHandlers, elegida = false, eleccion = null, onMarcarElegida }) {
  const fileRef = useRef(null);
  const lk = link;
  const [scraping, setScraping] = useState(false);
  const [enviandoDesglose, setEnviandoDesglose] = useState(false);
  // Primero se comparan las opciones; sólo las filas nuevas abren el editor
  // de inmediato para pegar el anuncio. Cerrar no descarta ediciones.
  const [abierto, setAbierto] = useState(() => !(lk.url || '').trim());
  const [failedImage, setFailedImage] = useState('');
  const prevUrlRef = useRef(lk.url || '');

  function set(field, val) { onUpdate(lk.id, field, val); }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (file && onImageUpload) onImageUpload(lk.id, file);
  }

  function copyUrl() {
    if (lk.url) navigator.clipboard.writeText(lk.url).catch(() => {});
  }

  const doScrape = useCallback(async (url, force = false) => {
    if (!url || !url.match(/^https?:\/\//i)) return;
    setScraping(true);
    try {
      let data = null;
      if (isBoatTraderUrl(url)) {
        try {
          const btRes = await scrapeBoatTrader(url);
          if (btRes.success && btRes.boat) data = btRes.boat;
        } catch { /* fallback */ }
      }
      if (!data) {
        try {
          const res = await scrapeLink(url);
          if (res.success !== false) data = res;
        } catch { /* failed */ }
      }
      if (data && onScrapeResult) onScrapeResult(lk.id, data, force);
    } catch (e) {
      console.warn('Scrape failed:', e);
    } finally {
      setScraping(false);
    }
  }, [lk.id, onScrapeResult]);

  function handleUrlBlur(e) {
    const url = e.target.value.trim();
    if (url && url !== prevUrlRef.current && url.match(/^https?:\/\//i)) {
      const wasEmpty = !prevUrlRef.current;
      prevUrlRef.current = url;
      // Un link de los lentos no se pide desde el navegador —tarda 90 segundos y
      // la peticion se corta— pero tampoco se ignora: se encola al salir del
      // campo, igual que cualquier otro link se scrapea solo. La primera version
      // no hacia nada y la fila salia diciendo "no se pudo leer el anuncio" sin
      // haberlo intentado siquiera.
      if (necesitaCola(url)) {
        if (onEncolarUrl) { setScraping(true); Promise.resolve(onEncolarUrl(lk.id, url)).finally(() => setScraping(false)); }
        return;
      }
      // If the admin pasted into an empty URL field this is a first scrape —
      // force=false is fine (no existing data to preserve). If the URL just
      // CHANGED to a different listing, force=true so the title/image/specs
      // of the previous listing get overwritten with the new one's data.
      doScrape(url, !wasEmpty);
    }
  }

  async function handleRescrape() {
    const url = (lk.url || '').trim();
    if (!url) return;

    // Este es el boton que aprieta el agente cuando ve la ficha incompleta, y
    // hasta ahora pedia el anuncio directo desde el navegador. Para BoatTrader
    // y compania eso no puede funcionar: tardan hasta 90 segundos y la peticion
    // se corta mucho antes. El endpoint del expediente los deja en cola y el
    // worker los completa; el resto se sigue pidiendo al momento.
    if (necesitaCola(url)) {
      // Se pasa por el mismo camino que el blur, que guarda la fila antes de
      // encolar. Llamar directo al endpoint no alcanzaba: el servidor lee la URL
      // de la base, asi que con un link recien escrito y sin guardar no
      // encontraba nada que encolar y el boton no hacia nada visible.
      setScraping(true);
      try {
        if (onEncolarUrl) {
          await onEncolarUrl(lk.id, url);
        } else if (orderId && lk.row_index) {
          await rescrapeOrderLink(orderId, lk.row_index);
          if (onEncolado) await onEncolado();
        }
      } catch (e) {
        console.warn('No se pudo encolar:', e);
      } finally {
        setScraping(false);
      }
      return;
    }

    doScrape(url, true);
  }

  // Una fila sin foto es el caso NORMAL y no una excepción, así que se avisa con
  // un botón para reintentar en vez de dejar la ficha muda y que el agente no
  // sepa si falta cargar algo o si el sistema falló.
  const scrapeIncompleto = !!(lk.url || '').trim() && (!lk.image_url || !(lk.title || lk.make || lk.model) || !(num(lk.value_usa_usd) > 0));

  // Los sitios con Cloudflare tardan entre 50 y 90 segundos en responder y
  // ninguna peticion web sobrevive eso, asi que el servidor los deja en cola y
  // los lee en segundo plano. Mientras tanto hay que decirlo: ofrecer un boton
  // de "Reintentar" para algo que por construccion no puede terminar en una
  // peticion web solo consigue que el agente lo apriete una y otra vez.
  const enCola = lk.scrape_state === 'en_cola' || lk.scrape_state === 'procesando';
  const errorLectura = lk.scrape_state === 'error';

  // Cuanto lleva esperando. El numero lo calcula el servidor: scrape_queued_at
  // viene sin zona horaria y restarlo en el navegador daba diferencias de horas.
  const esperaSeg = Number(lk.scrape_espera_seg || 0);
  const esperaTexto = esperaSeg < 60
    ? 'hace unos segundos'
    : 'hace ' + Math.round(esperaSeg / 60) + ' min';

  // Una lectura tarda entre uno y dos minutos. Si lleva mucho mas, no es que
  // vaya lenta: es que nadie esta vaciando la cola, o sea que falta el cron.
  // Decirlo convierte un "cargando para siempre" en algo que se puede arreglar.
  const colaDetenida = esperaSeg > 600;

  // Una fila de un sitio lento que nunca se intento no es un fallo: es una que
  // todavia no se ha pedido. Decir "no se pudo leer el anuncio" ahi es
  // directamente falso —fue lo que aparecio al pegar un link nuevo— asi que se
  // distingue del error de verdad.
  const nuncaIntentada = necesitaCola(lk.url) && !enCola && !errorLectura && !lk.title && !lk.image_url;

  const titleParts = [lk.year, lk.make, lk.model].filter(Boolean);
  const title = lk.title || (titleParts.length ? titleParts.join(' ') : 'Opción sin identificar');
  const ficha = [lk.location, lk.hours ? `${lk.hours} h` : null, lk.engine].filter(Boolean).join(' · ');

  // Ahorro que consigue la negociación: es el argumento de venta del trabajo
  // del bróker, y antes había que calcularlo mentalmente restando dos campos.
  const sinNegociar = num(lk.value_chile_clp);
  const negociado = num(lk.value_chile_negotiated_clp);
  const ahorro = sinNegociar && negociado && negociado < sinNegociar ? sinNegociar - negociado : null;

  const vendida = lk.link_status === 'sold';
  const cuerpoId = `link-${lk.id || idx}-ficha`;
  const cotizacion = estadoCotizacion(lk);
  const totalChile = cotizacion.total || negociado;
  const compraUsa = num(lk.value_to_negotiate_usd);
  const imagenDisponible = lk.image_url && failedImage !== lk.image_url;

  const menu = [
    { label: 'Volver a leer el anuncio', icon: RefreshCw, onClick: handleRescrape, disabled: scraping || !(lk.url || '').trim() },
    lk.url ? { label: 'Abrir el anuncio', icon: ExternalLink, href: lk.url.startsWith('http') ? lk.url : 'https://' + lk.url } : null,
    { label: 'Copiar el link', icon: Copy, onClick: copyUrl, disabled: !lk.url },
    { label: lk.image_url ? 'Cambiar la foto' : 'Subir una foto', icon: Upload, onClick: () => fileRef.current?.click() },
    // La lancha con la que el cliente avanza (lo dijo por WhatsApp o correo).
    onMarcarElegida && (lk.url || '').trim() ? { separator: true } : null,
    onMarcarElegida && (lk.url || '').trim()
      ? { label: elegida ? 'Editar la elección' : 'Marcar como elegida', icon: BadgeCheck, onClick: () => onMarcarElegida(lk), disabled: !elegida && !sePuedeElegir(lk) }
      : null,
    { separator: true },
    { label: 'Eliminar esta opción', icon: Trash, tone: 'danger', onClick: () => onDelete(lk.id) },
  ];

  return (
    <article
      data-link-id={lk.id || ''}
      draggable
      aria-label={`Opción ${idx + 1}: ${title}${elegida ? ' (elegida)' : ''}`}
      aria-busy={scraping || undefined}
      className={cn(
        'admin-boat-card rounded-lg border bg-surface shadow-card transition-colors duration-150',
        elegida ? 'border-brand-500 ring-1 ring-brand-500/40' : scrapeIncompleto && !enCola ? 'border-warning-line' : 'border-line',
        scraping && 'opacity-70',
      )}
      {...dragHandlers}
    >
      <div className="admin-boat-card__overview">
        <div className="admin-boat-card__photo">
          {imagenDisponible ? <img src={lk.image_url} alt={title} draggable={false} onError={() => setFailedImage(lk.image_url)} /> : (
            <button type="button" onClick={() => fileRef.current?.click()} className="admin-boat-card__empty-photo">
              <ImageIcon size={28} /><span>Subir foto</span>
            </button>
          )}
          <span className="admin-boat-card__rank" title={`Opción ${idx + 1}`}>{String(idx + 1).padStart(2, '0')}</span>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={`Foto de la opción ${idx + 1}`} onChange={handleFile} />
        </div>
        <div className="admin-boat-card__content">
          <div className="admin-boat-card__heading">
            <div className="min-w-0">
              <div className="admin-boat-card__badges">
                {elegida && <Badge tone="brand" size="sm"><BadgeCheck size={12} />{eleccion?.by === 'equipo' ? 'Elegida' : 'Elegida por el cliente'}</Badge>}
                {scraping ? <Badge tone="info" size="sm"><Spinner inline size="sm" label="Extrayendo datos" /> Extrayendo datos…</Badge>
                  : enCola ? <Badge tone="info" size="sm" dot>En cola</Badge>
                    : errorLectura ? <Badge tone="danger" size="sm">Error de lectura</Badge>
                      : scrapeIncompleto ? <Badge tone="warning" size="sm">Ficha incompleta</Badge>
                        : lk.image_url ? <Badge tone="success" size="sm">Ficha completa</Badge> : <span className="admin-exp-kicker">Nueva opción</span>}
                {vendida && <Badge tone="neutral" size="sm">Vendida</Badge>}
              </div>
              <h3>{title}</h3>
              <p className="admin-boat-card__specs">{ficha || (lk.url ? 'Completa los datos de esta embarcación' : 'Pega un anuncio para completar la ficha automáticamente')}</p>
            </div>
            <div className="admin-boat-card__tools">
              <span draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(lk.id))} className="admin-boat-card__grip" title="Arrastra para reordenar" aria-hidden="true"><GripVertical size={18} /></span>
              <Menu items={menu} label={`Más acciones de la opción ${idx + 1}`} />
            </div>
          </div>
          <dl className="admin-boat-card__prices">
            <div><dt>Publicado · USA</dt><dd>{num(lk.value_usa_usd) > 0 ? fmtUSD(num(lk.value_usa_usd)) : 'Sin precio'}</dd><span>Referencia del anuncio</span></div>
            <div><dt>Compra negociada · USA</dt><dd>{compraUsa > 0 ? fmtUSD(compraUsa) : 'Por negociar'}</dd><span>Base de la cotización</span></div>
            <div className="admin-boat-card__total"><dt>Total puesto en Chile</dt><dd>{cotizacion.requiereRevision ? 'Por actualizar' : totalChile > 0 ? fmtCLP(totalChile) : 'Por cotizar'}</dd><span>{cotizacion.requiereRevision ? cotizacion.total ? `Última cotización: ${fmtCLP(cotizacion.total)}` : 'Revisa la base de compra' : lk.quote_calculated_at ? lk.quote_published_at ? 'Cotización publicada' : 'Cotización en análisis' : totalChile > 0 ? 'Valor negociado · CLP' : 'Calcula el costo de importación'}</span></div>
          </dl>
          {cotizacion.requiereRevision && <p className="admin-boat-card__quote-warning" role="status"><Info size={14} />{cotizacion.baseCambio ? 'Cambió la compra negociada. Actualiza la cotización para renovar el total y los pagos.' : 'Revisa y actualiza la cotización antes de usar este total.'}</p>}
          <div className="admin-boat-card__actions">
            <Button variant="ghost" size="sm" iconRight={ChevronDown} aria-expanded={abierto} aria-controls={cuerpoId} onClick={() => setAbierto(a => !a)} className={cn(abierto && '[&_svg:last-child]:rotate-180')}>
              {abierto ? 'Cerrar edición' : 'Editar ficha'}
            </Button>
            {lk.url && <a href={lk.url.startsWith('http') ? lk.url : 'https://' + lk.url} target="_blank" rel="noopener noreferrer" className="admin-boat-card__listing"><ExternalLink size={14} />Ver anuncio</a>}
            <div className="admin-boat-card__primary-actions">
              {onEnviarDesglose && lk.quote_published_at && (
                <Button variant="secondary" size="sm" icon={Send} loading={enviandoDesglose} onClick={async () => {
                  setEnviandoDesglose(true);
                  try { await onEnviarDesglose(lk); } finally { setEnviandoDesglose(false); }
                }} title={lk.quote_breakdown_sent_at ? `Desglose enviado el ${fmtDateLarga(lk.quote_breakdown_sent_at)}` : 'Enviar el desglose al cliente que lo solicite'}>
                  {lk.quote_breakdown_sent_at ? 'Reenviar desglose' : 'Enviar desglose'}
                </Button>
              )}
              {onCotizar && <Button size="sm" icon={Receipt} onClick={() => onCotizar(lk)}>{cotizacion.requiereRevision ? 'Actualizar cotización' : lk.quote_calculated_at ? 'Revisar cotización' : 'Cotizar'}</Button>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Avisos de lectura (siempre visibles: son lo que decide qué hacer) ── */}
      {(enCola || nuncaIntentada || (!enCola && !nuncaIntentada && scrapeIncompleto)) && (
        <div className="px-3 sm:px-4 pb-3">
          {enCola && (
            <div className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-info-bg border border-info-line text-13 text-ink-700">
              <Loader size={16} className="spin text-info shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                {colaDetenida ? (
                  <span>
                    En cola {esperaTexto}, que es mucho más de lo normal (una lectura tarda 1-2 minutos).
                    Lo más probable es que la cola no se esté procesando: revisa que la tarea programada esté activa.
                  </span>
                ) : (
                  <span>
                    Leyendo el anuncio en segundo plano — en cola {esperaTexto}. Este sitio tarda 1-2 minutos.
                    Puedes seguir trabajando; la ficha se completa sola.
                  </span>
                )}
                {/* Barra indeterminada: ScrapingBee no informa avance, asi que
                    fingir un porcentaje seria inventarlo. Esto solo dice "sigue
                    andando", que es lo unico que sabemos de verdad. */}
                {!colaDetenida && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-info-line overflow-hidden" aria-hidden="true">
                    <div className="h-full w-1/3 rounded-full bg-info" style={{ animation: 'indeterminado 1.4s ease-in-out infinite' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {!enCola && nuncaIntentada && (
            <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-md bg-neutral-bg border border-neutral-line text-13 text-ink-700">
              <Info size={16} className="text-ink-500 shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-[200px]">
                Este sitio se lee en segundo plano porque tarda un par de minutos. Sal del campo del link o aprieta «Leer ahora» para ponerlo en cola.
              </span>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={handleRescrape} loading={scraping}>Leer ahora</Button>
            </div>
          )}

          {!enCola && !nuncaIntentada && scrapeIncompleto && (
            <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-md bg-warning-bg border border-warning-line text-13 text-ink-700">
              <TriangleAlert size={16} className="text-warning shrink-0" aria-hidden="true" />
              {/* El texto anterior afirmaba una causa —"el sitio bloquea la
                  lectura a ratos"— y mandaba a reintentar en unos minutos. Es
                  una de las tres causas posibles, y las otras dos no se
                  arreglan reintentando: el anuncio pudo haber sido retirado, o
                  el servicio de lectura puede estar sin créditos. Con la cuenta
                  agotada, ese consejo hacía apretar el botón indefinidamente
                  detrás de un problema que no existía. */}
              <span className="flex-1 min-w-[200px]">
                {lk.scrape_message
                  || 'No se pudo leer el anuncio completo. Puede ser que el vendedor lo haya retirado, que el sitio esté bloqueando la lectura, o que el servicio de lectura no tenga créditos. Reintenta una vez; si sigue igual, sube la foto a mano.'}
              </span>
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={handleRescrape} loading={scraping}>Reintentar</Button>
            </div>
          )}
        </div>
      )}

      {/* ── Cuerpo: ficha + precios ── */}
      {abierto && (
        <div id={cuerpoId} className="admin-boat-card__editor border-t border-line px-3 sm:px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
          <div className="min-w-0 space-y-3">
            <h4 className="admin-boat-card__editor-title">Ficha técnica</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
              <Txt label="Marca" value={lk.make} onChange={v => set('make', v)} />
              <Txt label="Modelo" value={lk.model} onChange={v => set('model', v)} />
              <Txt label="Año" type="number" inputMode="numeric" value={lk.year} onChange={v => set('year', v)} />
              <Txt label="Ubicación" value={lk.location} onChange={v => set('location', v)} />
              <Txt label="Horas" inputMode="numeric" value={lk.hours} onChange={v => set('hours', v)} />
              <Txt label="Motor" value={lk.engine} onChange={v => set('engine', v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input size="sm" type="number" inputMode="numeric" min={1} label="Preferencia del cliente" aria-label={`N.° de selección del cliente para la opción ${idx + 1}`} value={lk.selection_order || ''} onChange={e => set('selection_order', e.target.value)} placeholder="Sin preferencia" />
              <Txt label="Link del anuncio (USA)" type="url" inputMode="url" value={lk.url} onChange={v => set('url', v)} onBlur={handleUrlBlur} placeholder="https://…" mono />
              <Txt label="Comentarios" value={lk.comments} onChange={v => set('comments', v)} placeholder="Notas internas" />
            </div>
          </div>

          {/* Precios: publicado contra negociado, en las dos monedas */}
          <div className="admin-boat-card__price-editor rounded-md bg-canvas border border-line p-3 self-start">
            <h4 className="admin-boat-card__editor-title">Valores de referencia y compra</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <MoneyInput size="sm" currency="USD" label="Publicado · USA" placeholder="—" value={lk.value_usa_usd} onChange={v => set('value_usa_usd', aTexto(v))} inputClassName={cn('text-right tabular font-semibold', vacio(lk.value_usa_usd) && 'border-dashed')} />
              <MoneyInput size="sm" currency="CLP" suffix="" label="Publicado · Santiago" placeholder="—" value={lk.value_chile_clp} onChange={v => set('value_chile_clp', aTexto(v))} inputClassName={cn('text-right tabular font-semibold', vacio(lk.value_chile_clp) && 'border-dashed')} />
              <MoneyInput size="sm" currency="USD" label="Negociado · USA" placeholder="—" value={lk.value_to_negotiate_usd} onChange={v => set('value_to_negotiate_usd', aTexto(v))} inputClassName={cn('text-right tabular font-semibold text-success', vacio(lk.value_to_negotiate_usd) && 'border-dashed')} />
              <MoneyInput size="sm" currency="CLP" suffix="" label="Negociado · Santiago" placeholder="—" value={lk.value_chile_negotiated_clp} onChange={v => set('value_chile_negotiated_clp', aTexto(v))} inputClassName={cn('text-right tabular font-semibold text-brand-700', vacio(lk.value_chile_negotiated_clp) && 'border-dashed')} />
            </div>
            <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between gap-3 text-13">
              {ahorro ? (
                <>
                  <span className="eyebrow">Ahorro negociado</span>
                  <span className="font-semibold text-success tabular">{fmtCLP(ahorro)}</span>
                </>
              ) : (
                <span className="text-ink-500">{sinNegociar ? 'Sin negociación cargada todavía.' : 'Carga el valor puesto en Chile para ver el ahorro.'}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/* Un campo vacío se marca con borde punteado en vez de un placeholder gris que
   parece un valor real: antes "0 hrs" o "Mercruiser 4.5L" se leían como datos
   del anuncio cuando en realidad no había nada cargado. */
function vacio(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function Txt({ label, value, onChange, onBlur, placeholder = 'Sin dato', type = 'text', mono = false, inputMode }) {
  return (
    <Input
      size="sm"
      label={label}
      type={type}
      inputMode={inputMode}
      inputClassName={cn(vacio(value) && 'border-dashed', mono && 'font-mono text-xs')}
      value={value || ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}
