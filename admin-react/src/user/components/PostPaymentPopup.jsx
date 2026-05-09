import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'imporlan_payment_popup_shown_';
const AUTO_CLOSE_MS = 10000;

const PLAN_NAMES = {
  fragata: 'Plan Fragata',
  capitan: 'Plan Capitan de Navio',
  almirante: 'Plan Almirante',
};

function isPlanDeBusqueda(planId) {
  return planId === 'fragata' || planId === 'capitan' || planId === 'almirante';
}

function readParams(search, hash) {
  const q = new URLSearchParams(search || '');
  let h = new URLSearchParams();
  if (hash && hash.includes('?')) h = new URLSearchParams(hash.split('?')[1]);
  return {
    payment: q.get('payment') || h.get('payment'),
    plan: q.get('plan') || h.get('plan'),
    order: q.get('order') || h.get('order'),
    source: q.get('source') || h.get('source'),
  };
}

export default function PostPaymentPopup() {
  const navigate = useNavigate();
  const [params, setParams] = useState(null);
  const [remaining, setRemaining] = useState(AUTO_CLOSE_MS);
  const closingRef = useRef(false);

  useEffect(() => {
    const p = readParams(window.location.search, window.location.hash);
    if (p.payment !== 'success') return;
    const key = STORAGE_KEY + (p.order || p.plan || 'general');
    try { if (localStorage.getItem(key) === 'true') return; } catch { /* empty */ }
    const t = setTimeout(() => {
      setParams(p);
      try { localStorage.setItem(key, 'true'); } catch { /* empty */ }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setParams(null);
    setRemaining(AUTO_CLOSE_MS);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('plan');
      url.searchParams.delete('order');
      url.searchParams.delete('source');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch { /* empty */ }
    setTimeout(() => { closingRef.current = false; }, 100);
  }, []);

  useEffect(() => {
    if (!params) return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = Math.max(0, AUTO_CLOSE_MS - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) close();
    }, 100);
    return () => clearInterval(id);
  }, [params, close]);

  function goToProducts() {
    close();
    navigate('/expedientes');
  }

  if (!params) return null;

  const planName = PLAN_NAMES[params.plan] || params.plan || 'tu plan';
  const isBusqueda = isPlanDeBusqueda(params.plan);
  const isAlmirante = params.plan === 'almirante';
  const title = isBusqueda ? 'Tu Plan de Busqueda ya esta activo!' : 'Tu Cotizacion por Links ya esta activa!';
  const message = isBusqueda
    ? 'Nuestro equipo ya comenzo a trabajar en tu busqueda personalizada. Revisa tu panel para ver el estado de tu plan.'
    : 'Ya puedes gestionar tus embarcaciones desde tu panel. Revisa tus productos contratados para ver los detalles.';
  const pct = (remaining / AUTO_CLOSE_MS) * 100;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 p-8 text-center shadow-2xl">
        <button
          onClick={close}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white transition flex items-center justify-center text-xl leading-none"
        >
          &times;
        </button>

        <div className="w-[72px] h-[72px] mx-auto mb-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 className="text-white text-xl font-bold leading-tight">{title}</h2>

        {params.plan && (
          <p className="text-cyan-400 text-sm font-semibold mt-2 uppercase tracking-wide">{planName}</p>
        )}

        <p className="text-slate-400 text-[15px] leading-relaxed mt-4">{message}</p>

        {isAlmirante ? (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold">
            Reporte IA incluido en tu plan
          </div>
        ) : isBusqueda ? (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-200 text-[13px]">
            Reporte IA disponible por $15.000 CLP adicional (incluido en Plan Almirante)
          </div>
        ) : null}

        <div className="mt-4 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-left">
          <p className="text-[13px] font-semibold text-blue-400">Tiempo de Respuesta</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            El tiempo de respuesta y trabajo para tu requerimiento es de <strong className="text-white">hasta 48 horas</strong>. En periodos de alta demanda, puede ser de <strong className="text-white">hasta 72 hrs</strong>.
          </p>
          <p className="text-xs text-blue-400 mt-1">Por email o WhatsApp estaremos activos ante cualquier duda.</p>
        </div>

        <button
          onClick={goToProducts}
          className="mt-4 w-full px-7 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] transition"
        >
          Ver Mis Productos Contratados
        </button>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex-1 h-[3px] bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-100 linear" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-slate-500 whitespace-nowrap w-7 text-right">{Math.ceil(remaining / 1000)}s</span>
        </div>
      </div>
    </div>
  );
}
