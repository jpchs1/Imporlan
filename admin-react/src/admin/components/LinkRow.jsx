import { useRef, useState, useCallback } from 'react';
import { scrapeBoatTrader, scrapeLink } from '../api';

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

export default function LinkRow({ link, idx, onUpdate, onDelete, onImageUpload, onScrapeResult, onCotizar, dragHandlers }) {
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
      // If the admin pasted into an empty URL field this is a first scrape —
      // force=false is fine (no existing data to preserve). If the URL just
      // CHANGED to a different listing, force=true so the title/image/specs
      // of the previous listing get overwritten with the new one's data.
      doScrape(url, !wasEmpty);
    }
  }

  function handleRescrape() {
    const url = (lk.url || '').trim();
    if (url) doScrape(url, true);
  }

  // Tailwind classes shared by every input/select inside the card.
  const ci = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition placeholder:text-slate-300';

  const titleParts = [lk.year, lk.make, lk.model].filter(Boolean);
  const title = titleParts.length ? titleParts.join(' ') : 'Sin datos';

  return (
    <div
      data-link-id={lk.id || ''}
      draggable
      className={'relative bg-white border border-slate-200/70 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 ' + (scraping ? 'opacity-70' : '')}
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

      {/* Header row: drag, position, title, primary actions */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5 border-b border-slate-100">
        <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition shrink-0" title="Arrastrar para reordenar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{title}</div>
          {lk.location || lk.hours || lk.engine ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              {lk.location && <span>{lk.location}</span>}
              {lk.hours && <span>{lk.hours} hrs</span>}
              {lk.engine && <span>{lk.engine}</span>}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {lk.selection_order && (
            <span className="w-7 h-7 rounded-full bg-amber-400 text-white text-[11px] font-bold flex items-center justify-center shadow" title={`Selección N° ${lk.selection_order}`}>{lk.selection_order}</span>
          )}
          {onCotizar && (
            <button
              onClick={() => onCotizar(lk)}
              className={
                'p-2 rounded-lg transition relative ' +
                (lk.quote_calculated_at
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100')
              }
              title={lk.quote_calculated_at
                ? `Cotizada el ${new Date(lk.quote_calculated_at).toLocaleString('es-CL')}`
                : 'Cotizar este link'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              {lk.quote_calculated_at && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </button>
          )}
          <button onClick={() => onDelete(lk.id)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition" title="Eliminar link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 grid grid-cols-12 gap-3">
        {/* Image column (spans full row on mobile, 3 cols on md+) */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2 flex md:block items-center gap-3">
          {lk.image_url ? (
            <img src={lk.image_url} className="w-24 h-20 md:w-full md:h-32 object-cover rounded-xl border border-slate-200" alt="" />
          ) : (
            <div className="w-24 h-20 md:w-full md:h-32 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 cursor-pointer" onClick={() => fileRef.current?.click()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          )}
          <div className="md:mt-1.5 flex md:justify-center">
            <button onClick={() => fileRef.current?.click()} className="text-[11px] font-semibold text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded hover:bg-cyan-100 transition">Subir imagen</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Inputs grid */}
        <div className="col-span-12 md:col-span-9 lg:col-span-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Field label="Marca">
            <input className={ci} value={lk.make || ''} onChange={e => set('make', e.target.value)} placeholder="Sea Ray" />
          </Field>
          <Field label="Modelo">
            <input className={ci} value={lk.model || ''} onChange={e => set('model', e.target.value)} placeholder="SLX 280" />
          </Field>
          <Field label="Año">
            <input type="number" className={ci} value={lk.year || ''} onChange={e => set('year', e.target.value)} placeholder="2023" />
          </Field>
          <Field label="N° Selección">
            <input type="number" className={ci} value={lk.selection_order || ''} onChange={e => set('selection_order', e.target.value)} placeholder="-" />
          </Field>

          <Field label="Link opción (USA)" colSpan={4}>
            <div className="flex items-center gap-1">
              <input className={ci + ' flex-1'} value={lk.url || ''} onChange={e => set('url', e.target.value)} onBlur={handleUrlBlur} placeholder="https://..." />
              <button onClick={handleRescrape} disabled={scraping} className="shrink-0 p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-40" title="Re-scrapear datos del link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={scraping ? 'animate-spin' : ''}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              </button>
              <button onClick={openUrl} className="shrink-0 p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Abrir en nueva pestaña">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </button>
              <button onClick={copyUrl} className="shrink-0 p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Copiar URL">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
          </Field>

          <Field label="Ubicación">
            <input className={ci} value={lk.location || ''} onChange={e => set('location', e.target.value)} placeholder="Ciudad, Estado" />
          </Field>
          <Field label="Horas">
            <input className={ci} value={lk.hours || ''} onChange={e => set('hours', e.target.value)} placeholder="0 hrs" />
          </Field>
          <Field label="Motor" colSpan={2}>
            <input className={ci} value={lk.engine || ''} onChange={e => set('engine', e.target.value)} placeholder="Mercruiser 4.5L" />
          </Field>

          <Field label="Valor USA (USD)">
            <MoneyInput
              className={ci + ' text-right font-semibold text-emerald-600'}
              placeholder="0.00"
              value={lk.value_usa_usd}
              onChange={v => set('value_usa_usd', v)}
              format={fmtUsd}
              parse={parseUsd}
            />
          </Field>
          <Field label="Negociar (USD)">
            <MoneyInput
              className={ci + ' text-right font-semibold text-emerald-600'}
              placeholder="0.00"
              value={lk.value_to_negotiate_usd}
              onChange={v => set('value_to_negotiate_usd', v)}
              format={fmtUsd}
              parse={parseUsd}
            />
          </Field>
          <Field label="Chile (CLP)">
            <MoneyInput
              className={ci + ' text-right font-bold text-blue-600'}
              placeholder="$ 0"
              prefix="$ "
              value={lk.value_chile_clp}
              onChange={v => set('value_chile_clp', v)}
              format={fmtDot}
              parse={parseClp}
            />
          </Field>
          <Field label="Negociado (CLP)">
            <MoneyInput
              className={ci + ' text-right font-bold text-blue-600'}
              placeholder="$ 0"
              prefix="$ "
              value={lk.value_chile_negotiated_clp}
              onChange={v => set('value_chile_negotiated_clp', v)}
              format={fmtDot}
              parse={parseClp}
            />
          </Field>

          <Field label="Comentarios" colSpan={4}>
            <input className={ci} value={lk.comments || ''} onChange={e => set('comments', e.target.value)} placeholder="Notas internas..." />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, colSpan = 1, children }) {
  // Map colSpan number to a tailwind class. Defaults to 1 column wide.
  const span = {
    1: '',
    2: 'col-span-2',
    3: 'col-span-2 sm:col-span-3',
    4: 'col-span-2 sm:col-span-3 lg:col-span-4',
  }[colSpan] || '';
  return (
    <div className={span}>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
