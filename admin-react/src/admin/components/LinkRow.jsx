import { useRef, useState, useCallback } from 'react';
import { scrapeBoatTrader, scrapeLink, rescrapeOrderLink } from '../api';

function fmtDot(v) {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '';
  return Math.round(parseFloat(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fmtUsd(v) {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '';
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function stripDots(s) { return (s || '').toString().replace(/[\$\s\.]/g, ''); }

function isBoatTraderUrl(url) {
  return /boattrader\.com|boats\.com/i.test(url || '');
}

function num(v) {
  const n = parseFloat(stripDots(v));
  return isNaN(n) ? null : n;
}

/**
 * Numeric input that only formats the displayed value on blur. While focused
 * shows the raw number so editing is natural — without this, a USD/CLP
 * formatter rewrites the input on every keystroke and effectively blocks
 * typing.
 */
function MoneyInput({ value, onChange, format, parse, prefix = '', className, placeholder }) {
  const [focused, setFocused] = useState(false);
  const raw = value === null || value === undefined ? '' : String(value);
  const display = focused ? raw : format(value);
  return (
    <input
      className={className}
      placeholder={placeholder}
      value={prefix && display ? prefix + display : display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(parse(e.target.value))}
    />
  );
}

const parseUsd = v => (v || '').toString().replace(/[^0-9.]/g, '');
const parseClp = v => stripDots(v);

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

export default function LinkRow({ link, idx, orderId, onUpdate, onDelete, onImageUpload, onScrapeResult, onEncolado, onCotizar, dragHandlers }) {
  const fileRef = useRef(null);
  const lk = link;
  const [scraping, setScraping] = useState(false);
  const prevUrlRef = useRef(lk.url || '');

  function set(field, val) { onUpdate(lk.id, field, val); }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (file && onImageUpload) onImageUpload(lk.id, file);
  }

  function openUrl() {
    const url = lk.url;
    if (url) window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
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
        } catch (e) { /* fallback */ }
      }
      if (!data) {
        try {
          const res = await scrapeLink(url);
          if (res.success !== false) data = res;
        } catch (e) { /* failed */ }
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
      // Al pegar un link de los lentos no se pide nada: la peticion tardaria 90
      // segundos y se cortaria igual, dejando la tarjeta en "Extrayendo
      // datos..." un buen rato para no traer nada. La fila queda marcada como
      // incompleta y el boton de reintentar la encola, que es el camino que si
      // funciona.
      if (necesitaCola(url)) return;
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
    if (necesitaCola(url) && orderId && lk.row_index) {
      setScraping(true);
      try {
        await rescrapeOrderLink(orderId, lk.row_index);
        if (onEncolado) await onEncolado();
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
  const scrapeIncompleto = !!(lk.url || '').trim() && !lk.image_url;

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

  const titleParts = [lk.year, lk.make, lk.model].filter(Boolean);
  const title = titleParts.length ? titleParts.join(' ') : 'Opción sin identificar';

  // Ahorro que consigue la negociación: es el argumento de venta del trabajo
  // del bróker, y antes había que calcularlo mentalmente restando dos campos.
  const sinNegociar = num(lk.value_chile_clp);
  const negociado = num(lk.value_chile_negotiated_clp);
  const ahorro = sinNegociar && negociado && negociado < sinNegociar ? sinNegociar - negociado : null;

  return (
    <div
      data-link-id={lk.id || ''}
      draggable
      className={
        'relative rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 ' +
        (scrapeIncompleto ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300' : 'bg-white border-slate-200/70 hover:border-indigo-200') +
        (scraping ? ' opacity-70' : '')
      }
      {...dragHandlers}
    >
      {scraping && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700 font-medium">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Extrayendo datos...
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 p-4">

        {/* ── Arrastre + posición ── */}
        <div className="flex lg:flex-col items-center gap-2 shrink-0 lg:pt-1">
          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition" title="Arrastrar para reordenar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          </div>
          <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
        </div>

        {/* ── Foto ── */}
        <div className="relative w-full lg:w-52 h-32 shrink-0">
          {lk.image_url ? (
            <>
              <img src={lk.image_url} className="w-full h-full object-cover rounded-xl border border-slate-200" alt={title} />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center transition"
                title="Cambiar imagen"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 flex flex-col items-center justify-center gap-2 hover:bg-amber-100 transition"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span className="text-[11px] font-semibold text-amber-700">Subir imagen</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        {/* ── Ficha ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[15px] font-bold text-slate-900 truncate">{title}</span>
            {scrapeIncompleto ? (
              <Chip tone="amber" icon="alert">Ficha incompleta</Chip>
            ) : lk.image_url ? (
              <Chip tone="emerald" icon="check">Ficha completa</Chip>
            ) : null}

            <div className="flex-1" />

            <label className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg bg-slate-50 border border-slate-200" title="Orden de preferencia que elige el cliente">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">N.° selección</span>
              <input
                type="number"
                className="w-11 bg-transparent text-center text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300 placeholder:font-normal"
                value={lk.selection_order || ''}
                onChange={e => set('selection_order', e.target.value)}
                placeholder="—"
              />
            </label>

            <div className="flex items-center gap-1">
              {onCotizar && (
                <IconBtn
                  onClick={() => onCotizar(lk)}
                  tone={lk.quote_calculated_at ? 'emerald' : 'indigo'}
                  title={lk.quote_calculated_at
                    ? `Cotizada el ${new Date(lk.quote_calculated_at).toLocaleString('es-CL')}`
                    : 'Cotizar este link'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  {lk.quote_calculated_at && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />}
                </IconBtn>
              )}
              <IconBtn onClick={handleRescrape} disabled={scraping} title="Volver a extraer los datos del anuncio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={scraping ? 'animate-spin' : ''}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </IconBtn>
              <IconBtn onClick={openUrl} title="Abrir el anuncio en otra pestaña">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </IconBtn>
              <IconBtn onClick={copyUrl} title="Copiar el link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </IconBtn>
              <IconBtn onClick={() => onDelete(lk.id)} tone="red" title="Eliminar esta opción">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </IconBtn>
            </div>
          </div>

          {enCola && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200">
              <svg className="w-4 h-4 text-sky-600 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              <div className="flex-1 min-w-0">
                {colaDetenida ? (
                  <span className="text-xs font-medium text-sky-800">
                    En cola {esperaTexto}, que es mucho más de lo normal (una lectura tarda 1-2 minutos).
                    Lo más probable es que la cola no se esté procesando: revisá que la tarea programada esté activa.
                  </span>
                ) : (
                  <span className="text-xs font-medium text-sky-800">
                    Leyendo el anuncio en segundo plano — en cola {esperaTexto}. Este sitio tarda 1-2 minutos.
                    Podés seguir trabajando; la ficha se completa sola.
                  </span>
                )}
                {/* Barra indeterminada: ScrapingBee no informa avance, asi que
                    fingir un porcentaje seria inventarlo. Esto solo dice "sigue
                    andando", que es lo unico que sabemos de verdad. */}
                {!colaDetenida && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-sky-100 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-sky-400 animate-[indeterminado_1.4s_ease-in-out_infinite]"
                         style={{ animation: 'indeterminado 1.4s ease-in-out infinite' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {!enCola && scrapeIncompleto && (
            <div className={'flex items-center gap-2.5 px-3 py-2 rounded-xl ' + (errorLectura ? 'bg-amber-50 border border-amber-200' : 'bg-amber-50 border border-amber-200')}>
              <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {/* El texto anterior afirmaba una causa —"el sitio bloquea la
                  lectura a ratos"— y mandaba a reintentar en unos minutos. Es
                  una de las tres causas posibles, y las otras dos no se
                  arreglan reintentando: el anuncio pudo haber sido retirado, o
                  el servicio de lectura puede estar sin créditos. Con la cuenta
                  agotada, ese consejo hacía apretar el botón indefinidamente
                  detrás de un problema que no existía. */}
              <span className="flex-1 text-xs font-medium text-amber-800">
                {lk.scrape_message
                  || 'No se pudo leer el anuncio completo. Puede ser que el vendedor lo haya retirado, que el sitio esté bloqueando la lectura, o que el servicio de lectura no tenga créditos. Reintentá una vez; si sigue igual, subí la foto a mano.'}
              </span>
              <button
                onClick={handleRescrape}
                disabled={scraping}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={scraping ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                Reintentar
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
            <Field label="Marca">
              <Txt value={lk.make} onChange={v => set('make', v)} />
            </Field>
            <Field label="Modelo">
              <Txt value={lk.model} onChange={v => set('model', v)} />
            </Field>
            <Field label="Año">
              <Txt type="number" value={lk.year} onChange={v => set('year', v)} />
            </Field>
            <Field label="Ubicación">
              <Txt value={lk.location} onChange={v => set('location', v)} />
            </Field>
            <Field label="Horas de motor">
              <Txt value={lk.hours} onChange={v => set('hours', v)} />
            </Field>
            <Field label="Motor" colSpan={3}>
              <Txt value={lk.engine} onChange={v => set('engine', v)} />
            </Field>
          </div>

          <Field label="Link del anuncio (USA)">
            <Txt value={lk.url} onChange={v => set('url', v)} onBlur={handleUrlBlur} placeholder="https://..." mono />
          </Field>

          <Field label="Comentarios">
            <Txt value={lk.comments} onChange={v => set('comments', v)} placeholder="Notas internas..." />
          </Field>
        </div>

        {/* ── Precios: publicado contra negociado, en las dos monedas ── */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100 self-start">
          <div className="grid grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-center">
            <span />
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider text-right">En USA</span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider text-right">En Santiago</span>

            <span className="text-[10px] font-semibold text-slate-500">Publicado</span>
            <MoneyInput
              className={moneyCls(lk.value_usa_usd, 'font-bold text-slate-900')}
              placeholder="Sin dato" value={lk.value_usa_usd}
              onChange={v => set('value_usa_usd', v)} format={fmtUsd} parse={parseUsd}
            />
            <MoneyInput
              className={moneyCls(lk.value_chile_clp, 'font-bold text-slate-900')}
              placeholder="Sin dato" prefix="$ " value={lk.value_chile_clp}
              onChange={v => set('value_chile_clp', v)} format={fmtDot} parse={parseClp}
            />

            <span className="text-[10px] font-semibold text-slate-500">Negociado</span>
            <MoneyInput
              className={moneyCls(lk.value_to_negotiate_usd, 'font-semibold text-emerald-700')}
              placeholder="Sin dato" value={lk.value_to_negotiate_usd}
              onChange={v => set('value_to_negotiate_usd', v)} format={fmtUsd} parse={parseUsd}
            />
            <MoneyInput
              className={moneyCls(lk.value_chile_negotiated_clp, 'font-bold text-indigo-700')}
              placeholder="Sin dato" prefix="$ " value={lk.value_chile_negotiated_clp}
              onChange={v => set('value_chile_negotiated_clp', v)} format={fmtDot} parse={parseClp}
            />
          </div>

          {ahorro ? (
            <>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Ahorro negociado</span>
                <span className="text-sm font-bold text-emerald-600">$ {fmtDot(ahorro)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="h-px bg-slate-200" />
              <p className="text-[11px] text-slate-400 leading-snug">
                {sinNegociar ? 'Sin negociación cargada todavía.' : 'Cargá el valor puesto en Chile para ver el ahorro.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Un campo vacío se marca con borde punteado en vez de un placeholder gris que
   parece un valor real: antes "0 hrs" o "Mercruiser 4.5L" se leían como datos
   del anuncio cuando en realidad no había nada cargado. */
const BASE_INPUT = 'w-full px-2.5 py-1.5 rounded-lg text-sm outline-none transition bg-white ' +
  'focus:ring-2 focus:ring-indigo-400/25 focus:border-indigo-400 placeholder:text-slate-300 placeholder:font-normal';

function inputCls(value, extra = '') {
  const vacio = value === null || value === undefined || String(value).trim() === '';
  return BASE_INPUT + ' ' + (vacio ? 'border border-dashed border-slate-300' : 'border border-slate-200') + ' ' + extra;
}

function moneyCls(value, extra = '') {
  return inputCls(value, 'text-right ' + extra);
}

function Txt({ value, onChange, onBlur, placeholder = 'Sin dato', type = 'text', mono = false }) {
  return (
    <input
      type={type}
      className={inputCls(value, mono ? 'font-mono text-xs text-slate-500' : '')}
      value={value || ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

function Chip({ tone, icon, children }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ' + tones[tone]}>
      {icon === 'check' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      {icon === 'alert' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>}
      {children}
    </span>
  );
}

function IconBtn({ onClick, disabled, title, tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-200 text-slate-500 hover:bg-slate-50',
    red: 'border-red-200 text-red-500 hover:bg-red-50',
    emerald: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
    indigo: 'border-indigo-200 text-indigo-600 hover:bg-indigo-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={'relative w-7 h-7 rounded-lg border bg-white flex items-center justify-center transition disabled:opacity-40 ' + tones[tone]}
    >
      {children}
    </button>
  );
}

function Field({ label, colSpan = 1, children }) {
  const span = { 1: '', 2: 'col-span-2', 3: 'col-span-2 sm:col-span-3', 4: 'col-span-2 sm:col-span-4' }[colSpan] || '';
  return (
    <div className={span}>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
