import { useState, useCallback, useRef, createContext, useContext } from 'react';
import { cn } from '../lib/utils';
import { CircleCheck, CircleAlert, TriangleAlert, Info, X } from './Icons';

const ToastCtx = createContext(null);

const META = {
  success: { icon: CircleCheck, cls: 'text-success', ms: 4000 },
  error: { icon: CircleAlert, cls: 'text-danger', ms: 8000 },
  warning: { icon: TriangleAlert, cls: 'text-warning', ms: 6000 },
  info: { icon: Info, cls: 'text-info', ms: 4000 },
};

/**
 * Avisos. `const toast = useToast();`
 *   toast('Guardado', 'success')                                      forma corta (compatibilidad)
 *   toast({ type: 'error', title: 'No se pudo enviar', description: 'Revisa tu conexión.' })
 *   toast({ title: 'Reporte listo', action: { label: 'Ver', onClick: () => navigate('/documents') } })
 * Duración: 4 s (8 s en error). `duration: 0` lo deja hasta que se cierre.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Contador propio: con Date.now() dos avisos en el mismo milisegundo
  // compartían id y se cerraban juntos.
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const show = useCallback((msg, type = 'success') => {
    const id = ++seq.current;
    const opts = (msg && typeof msg === 'object') ? msg : { title: msg, type };
    const t = { id, type: opts.type || 'success', title: opts.title, description: opts.description, action: opts.action };
    setToasts(prev => [...prev.slice(-4), t]);
    const ms = opts.duration ?? (META[t.type] || META.success).ms;
    if (ms > 0) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        className="fixed right-4 left-4 sm:left-auto sm:right-6 z-toast flex flex-col items-end gap-2 pointer-events-none"
        style={{ bottom: 'calc(var(--tabbar-space, 0px) + 1rem)' }}
        aria-live="polite"
      >
        {toasts.map(t => {
          const m = META[t.type] || META.success;
          const I = m.icon;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto w-full sm:w-[380px] flex items-start gap-3 bg-surface border border-line rounded-lg shadow-pop px-4 py-3 ov-up"
            >
              <I size={20} className={cn('shrink-0 mt-px', m.cls)} />
              <div className="flex-1 min-w-0 text-sm">
                {t.title && <p className="font-medium text-ink-900 whitespace-pre-line break-words">{t.title}</p>}
                {t.description && <p className="text-13 text-ink-500 mt-0.5 whitespace-pre-line break-words">{t.description}</p>}
                {t.action && (
                  <button type="button" onClick={() => { t.action.onClick?.(); dismiss(t.id); }} className="mt-1.5 text-13 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="shrink-0 -mr-1 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded text-ink-500 hover:text-ink-900 hover:bg-neutral-bg">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx);
