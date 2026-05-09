import { useState, useEffect } from 'react';
import { Card, Button } from '../../shared/components/UI';
import { cn } from '../../shared/lib/utils';

const HERO_IMG = 'https://deckeva.cl/wp-content/uploads/2024/08/dock-bann-1.jpg';

const GALLERY = [
  '/panel/user/assets/gallery/1.jpg',
  'https://deckeva.cl/wp-content/uploads/2024/08/pisos-antideslizante.jpg',
  '/panel/user/assets/gallery/2.jpg',
  'https://deckeva.cl/wp-content/uploads/2024/08/piso-de-lancha.jpg',
  '/panel/user/assets/gallery/3.jpg',
  '/panel/user/assets/gallery/4.jpg',
  'https://deckeva.cl/wp-content/uploads/2024/08/Pisos-de-goma-eva-para-embarcaciones.jpg',
  '/panel/user/assets/gallery/5.jpg',
  '/panel/user/assets/gallery/6.jpg',
  'https://deckeva.cl/wp-content/uploads/2021/01/Lancha-Starcratf-principal-1024x576.jpg',
  '/panel/user/assets/gallery/8.jpg',
  'https://deckeva.cl/wp-content/uploads/2024/09/Lancha-Monterey-258SS-–-Deckeva-principal-1024x576.jpg',
  '/panel/user/assets/gallery/9.jpg',
  '/panel/user/assets/gallery/10.jpg',
  'https://deckeva.cl/wp-content/uploads/2024/09/varas-principal-1024x576.jpg',
  '/panel/user/assets/gallery/2.jpeg',
  'https://deckeva.cl/wp-content/uploads/2021/01/13-1024x768.webp',
  '/panel/user/assets/gallery/11.png',
  'https://deckeva.cl/wp-content/uploads/2024/09/8-2-1024x768.webp',
  '/panel/user/assets/gallery/12.png',
  '/panel/user/assets/gallery/13.png',
  'https://deckeva.cl/wp-content/uploads/2024/09/Lancha-Monterey-258SS-–-Deckeva-2-1024x768.webp',
  '/panel/user/assets/gallery/14.png',
  'https://deckeva.cl/wp-content/uploads/2024/09/9-3-1024x768.webp',
];

const FEATURES = [
  {
    title: 'Antideslizante',
    desc: 'Agarre excepcional incluso con el piso mojado, evita resbalones a bordo.',
    bg: 'from-emerald-500/15 to-teal-500/10',
    text: 'text-emerald-600',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Proteccion UV',
    desc: 'No pierde color ni se quiebra con la exposicion al sol y la salinidad.',
    bg: 'from-amber-500/15 to-orange-500/10',
    text: 'text-amber-600',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    title: 'Facil instalacion',
    desc: 'Adhesivo 3M de alta resistencia, lo coloca tu instalador o vos mismo.',
    bg: 'from-cyan-500/15 to-blue-500/10',
    text: 'text-cyan-600',
    icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  },
  {
    title: 'Corte a medida',
    desc: 'Personalizado segun el plano de tu embarcacion, sin desperdicios.',
    bg: 'from-violet-500/15 to-purple-500/10',
    text: 'text-violet-600',
    icon: 'M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664',
  },
  {
    title: 'Facil limpieza',
    desc: 'Resistente a manchas, sal y combustible. Se limpia con agua y jabon.',
    bg: 'from-blue-500/15 to-sky-500/10',
    text: 'text-blue-600',
    icon: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42',
  },
  {
    title: 'Envio nacional',
    desc: 'Despacho a todo Chile y envio internacional a Latinoamerica.',
    bg: 'from-rose-500/15 to-pink-500/10',
    text: 'text-rose-600',
    icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  },
];

const STATS = [
  { label: 'Embarcaciones renovadas', value: '+500', sub: 'En todo Chile' },
  { label: 'Espesor del piso', value: '6 mm', sub: 'Goma EVA premium' },
  { label: 'Tiempo de instalacion', value: '1 dia', sub: 'Dependiendo del tamano' },
  { label: 'Garantia', value: '2 anos', sub: 'Adhesion y desgaste' },
];

function Lightbox({ items, index, onClose, onNav }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNav(1);
      else if (e.key === 'ArrowLeft') onNav(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNav]);

  if (!items || items.length === 0) return null;
  const url = items[index];
  return (
    <div className="fixed inset-0 z-[10001] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <img src={url} alt="" className="max-w-full max-h-[88vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Cerrar"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {items.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
            onClick={(e) => { e.stopPropagation(); onNav(-1); }}
            aria-label="Anterior"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition"
            onClick={(e) => { e.stopPropagation(); onNav(1); }}
            aria-label="Siguiente"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
            {index + 1} / {items.length}
          </div>
        </>
      )}
    </div>
  );
}

export default function Deckeva() {
  const [lbIndex, setLbIndex] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const visibleGallery = showAll ? GALLERY : GALLERY.slice(0, 8);

  function nav(d) {
    setLbIndex(i => (i + d + GALLERY.length) % GALLERY.length);
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero with photo bg + dark overlay */}
      <div className="relative rounded-3xl overflow-hidden mb-6 shadow-xl" style={{ minHeight: '320px' }}>
        <img src={HERO_IMG} alt="Deckeva" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/65 to-cyan-950/80" />
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-start sm:items-center justify-center text-left sm:text-center p-6 sm:p-10" style={{ minHeight: '320px' }}>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3 sm:mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Partner oficial Imporlan
          </div>

          <img
            src="/panel/assets/logoevadeck.jpg"
            alt="Deckeva"
            className="h-12 sm:h-16 rounded-xl mb-3 sm:mb-4 shadow-2xl"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">DECKEVA</h1>
          <p className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-[0.25em] mt-2">Pisos EVA para embarcaciones</p>
          <p className="text-white/85 text-sm sm:text-base mt-3 max-w-xl leading-relaxed">
            Renueva tu lancha con pisos antideslizantes de goma EVA cortados a medida. Seguridad, estilo y confort en cada navegacion.
          </p>
          <div className="flex flex-wrap gap-2 mt-5 sm:mt-6">
            <a href="https://www.deckeva.cl" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold shadow-lg hover:bg-slate-100 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
              Cotizar en Deckeva.cl
            </a>
            <a href="mailto:contacto@deckeva.cl" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 text-white font-semibold ring-1 ring-white/20 hover:bg-white/20 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              Contactar
            </a>
          </div>
        </div>
      </div>

      {/* Highlights row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {STATS.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200/70 rounded-2xl p-4">
            <p className="text-2xl font-bold text-slate-800 leading-none">{s.value}</p>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1.5">{s.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Gallery */}
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Galeria de instalaciones</h2>
          <p className="text-xs text-slate-400 mt-0.5">Embarcaciones que renovamos con piso EVA</p>
        </div>
        {!showAll && GALLERY.length > visibleGallery.length && (
          <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1">
            Ver toda la galeria ({GALLERY.length})
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-8">
        {visibleGallery.map((url, i) => {
          const big = i === 0 || i === 1;
          return (
            <button
              key={`${url}-${i}`}
              onClick={() => setLbIndex(GALLERY.indexOf(url))}
              className={cn(
                'relative rounded-xl overflow-hidden bg-slate-100 hover:shadow-xl transition-all duration-300 group ring-1 ring-slate-200/60 hover:ring-cyan-300',
                big ? 'sm:col-span-1 md:col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
              )}
              type="button"
            >
              <img
                src={url}
                alt={`Instalacion ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={e => { e.currentTarget.style.opacity = '0.3'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Features + contact + price card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Features */}
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Caracteristicas del producto</h3>
              <p className="text-xs text-slate-400 mt-0.5">Por que la goma EVA es la mejor opcion</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition">
                <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', f.bg)}>
                  <svg className={cn('w-4 h-4', f.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact + price CTA */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Contacto Deckeva</h3>
                <p className="text-xs text-slate-400 mt-0.5">Hablemos de tu proyecto</p>
              </div>
            </div>
            <div className="space-y-2">
              <a href="mailto:contacto@deckeva.cl" className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40 transition">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">contacto@deckeva.cl</p>
                </div>
              </a>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Telefono</p>
                  <p className="text-xs text-amber-800 mt-0.5">Disponible para clientes con plan de busqueda Imporlan</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ubicacion</p>
                  <p className="text-sm font-semibold text-slate-800">Lo Barnechea, Santiago</p>
                  <p className="text-[11px] text-slate-400">Chile</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-5 overflow-hidden shadow-lg">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                  <h3 className="font-bold">Consulta el precio</h3>
                  <p className="text-cyan-200 text-[11px] mt-0.5">Personalizado para tu lancha</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                El precio depende del tamano y diseno de tu embarcacion. Coordina la cotizacion directamente con Deckeva y mencionales que vienes desde Imporlan.
              </p>
              <a href="https://www.deckeva.cl" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold shadow-md hover:bg-slate-100 transition">
                Ir a Deckeva.cl
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lbIndex !== null && (
        <Lightbox items={GALLERY} index={lbIndex} onClose={() => setLbIndex(null)} onNav={nav} />
      )}
    </div>
  );
}
