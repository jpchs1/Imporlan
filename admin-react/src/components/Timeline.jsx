const STEPS = [
  { num: 1, label: 'Plan o Cotizacion', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { num: 2, label: 'Busqueda Activa', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { num: 3, label: 'Inspeccion', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { num: 4, label: 'Compra', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { num: 5, label: 'Logistica', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
];

export default function Timeline({ step = 1, onPrev, onNext }) {
  const pct = Math.round(((step - 1) / 4) * 100);
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-lg mb-5">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span className="text-sm font-bold text-sky-100">Progreso del Expediente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-cyan-400 font-bold">Paso {step}/5</span>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-start justify-center gap-0">
        {STEPS.map((s, i) => {
          const done = s.num < step;
          const active = s.num === step;
          return (
            <div key={s.num} className="flex items-start">
              <div className="flex flex-col items-center" style={{ width: 90 }}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30' :
                  active ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-500/40 animate-pulse' :
                  'bg-white/5 border border-white/10'
                }`}>
                  {done ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg className={`w-4 h-4 ${active ? 'text-white' : 'text-white/20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={s.icon}/></svg>
                  )}
                </div>
                <p className={`mt-1.5 text-[10px] text-center font-semibold leading-tight ${done ? 'text-emerald-300' : active ? 'text-white' : 'text-white/20'}`}>{s.label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mt-[18px] rounded-full ${done ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-white/5'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="px-6 pb-4 flex items-center justify-center gap-3">
        <button onClick={onPrev} disabled={step <= 1} className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs font-semibold disabled:opacity-20 hover:bg-white/5 transition flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6"/></svg> Retroceder
        </button>
        <span className="text-xs text-white/40 font-medium">Paso {step} de 5</span>
        <button onClick={onNext} disabled={step >= 5} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-xs font-semibold disabled:opacity-20 hover:from-cyan-700 hover:to-cyan-600 transition shadow-md shadow-cyan-600/30 flex items-center gap-1">
          Avanzar <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}
