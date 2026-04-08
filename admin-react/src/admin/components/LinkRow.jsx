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

export default function LinkRow({ link, idx, onUpdate, onDelete, onImageUpload, onScrapeResult, dragHandlers }) {
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
        } catch (e) { /* fallback to generic scraper */ }
      }
      if (!data) {
        try {
          const res = await scrapeLink(url);
          if (res.success !== false) data = res;
        } catch (e) { /* scrape failed */ }
      }
      if (data && onScrapeResult) {
        onScrapeResult(lk.id, data, force);
      }
    } catch (e) {
      console.warn('Scrape failed:', e);
    } finally {
      setScraping(false);
    }
  }, [lk.id, onScrapeResult]);

  function handleUrlBlur(e) {
    const url = e.target.value.trim();
    if (url && url !== prevUrlRef.current && url.match(/^https?:\/\//i)) {
      prevUrlRef.current = url;
      doScrape(url, false);
    }
  }

  function handleRescrape() {
    const url = (lk.url || '').trim();
    if (url) doScrape(url, true);
  }

  const ci = 'px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white transition w-full';

  return (
    <tr
      data-link-id={lk.id || ''}
      draggable
      className={`border-b border-slate-50 hover:bg-indigo-50/30 transition group ${scraping ? 'opacity-60' : ''}`}
      {...dragHandlers}
    >
      {/* Scraping overlay */}
      {scraping && (
        <td colSpan={0} style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'rgba(255,255,255,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,borderRadius:8,pointerEvents:'none'}}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700 font-medium">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Extrayendo datos...
          </div>
        </td>
      )}
      {/* 1. Drag handle */}
      <td className="px-1 py-2 text-center align-middle cursor-grab active:cursor-grabbing">
        <div className="opacity-30 group-hover:opacity-60 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </div>
      </td>
      {/* 2. Row number */}
      <td className="px-1 py-2 text-center text-sm font-extrabold text-slate-400">{idx + 1}</td>
      {/* 3. Image */}
      <td className="px-1 py-2 text-center align-middle">
        <div className="flex flex-col items-center gap-1">
          {lk.image_url ? (
            <img src={lk.image_url} className="w-20 h-14 object-cover rounded-lg border border-slate-200 shadow-sm" alt="" />
          ) : (
            <div className="w-20 h-14 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 cursor-pointer" onClick={() => fileRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} className="text-[10px] font-semibold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded hover:bg-cyan-100 transition">Subir</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </td>
      {/* 4. Marca */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:100}} value={lk.make||''} onChange={e=>set('make',e.target.value)} placeholder="Sea Ray"/></td>
      {/* 5. Modelo */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:120}} value={lk.model||''} onChange={e=>set('model',e.target.value)} placeholder="SLX 280"/></td>
      {/* 6. Año */}
      <td className="px-1 py-2"><input type="number" className={`${ci} text-center`} style={{minWidth:65}} value={lk.year||''} onChange={e=>set('year',e.target.value)} placeholder="2023"/></td>
      {/* 7. Link URL */}
      <td className="px-1 py-2">
        <div className="flex items-center gap-1">
          <input className={ci} style={{minWidth:160}} value={lk.url||''} onChange={e=>set('url',e.target.value)} onBlur={handleUrlBlur} placeholder="https://..."/>
          <button onClick={handleRescrape} disabled={scraping} className="shrink-0 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-40" title="Re-scrapear datos del link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={scraping ? 'animate-spin' : ''}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
          <button onClick={openUrl} className="shrink-0 p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Abrir">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button onClick={copyUrl} className="shrink-0 p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Copiar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </div>
      </td>
      {/* 8. Ubicacion */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:130}} value={lk.location||''} onChange={e=>set('location',e.target.value)} placeholder="Ciudad, Estado"/></td>
      {/* 9. Horas */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:70}} value={lk.hours||''} onChange={e=>set('hours',e.target.value)} placeholder="0 hrs"/></td>
      {/* 10. Motor */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:170}} value={lk.engine||''} onChange={e=>set('engine',e.target.value)} placeholder="Mercruiser 4.5L"/></td>
      {/* 11. Valor USA USD */}
      <td className="px-1 py-2"><input className={`${ci} text-right font-semibold text-emerald-600`} style={{minWidth:105}} value={fmtUsd(lk.value_usa_usd)} onChange={e=>{const raw=e.target.value.replace(/[^0-9.]/g,'');set('value_usa_usd',raw)}} placeholder="0.00"/></td>
      {/* 12. Negociar USD */}
      <td className="px-1 py-2"><input className={`${ci} text-right font-semibold text-emerald-600`} style={{minWidth:105}} value={fmtUsd(lk.value_to_negotiate_usd)} onChange={e=>{const raw=e.target.value.replace(/[^0-9.]/g,'');set('value_to_negotiate_usd',raw)}} placeholder="0.00"/></td>
      {/* 13. Chile CLP */}
      <td className="px-1 py-2"><input className={`${ci} text-right font-bold text-blue-600`} style={{minWidth:115}} value={lk.value_chile_clp ? '$ '+fmtDot(lk.value_chile_clp) : ''} onChange={e=>{const raw=stripDots(e.target.value);set('value_chile_clp',raw)}} placeholder="$ 0"/></td>
      {/* 14. Negociado CLP */}
      <td className="px-1 py-2"><input className={`${ci} text-right font-bold text-blue-600`} style={{minWidth:115}} value={lk.value_chile_negotiated_clp ? '$ '+fmtDot(lk.value_chile_negotiated_clp) : ''} onChange={e=>{const raw=stripDots(e.target.value);set('value_chile_negotiated_clp',raw)}} placeholder="$ 0"/></td>
      {/* 15. N° Sel */}
      <td className="px-1 py-2"><input type="number" className={`${ci} text-center font-bold`} style={{minWidth:50}} value={lk.selection_order||''} onChange={e=>set('selection_order',e.target.value)} placeholder="-"/></td>
      {/* 16. Comentarios */}
      <td className="px-1 py-2"><input className={ci} style={{minWidth:160}} value={lk.comments||''} onChange={e=>set('comments',e.target.value)} placeholder="Comentario..."/></td>
      {/* 17. Acciones */}
      <td className="px-1 py-2 text-center">
        <button onClick={()=>onDelete(lk.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </td>
    </tr>
  );
}
