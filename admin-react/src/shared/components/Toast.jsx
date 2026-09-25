import { useState, useCallback, useRef, createContext, useContext } from 'react';

const ToastCtx = createContext(null);

const STYLES = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  info: 'bg-slate-800',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Contador propio: con Date.now() dos avisos en el mismo milisegundo
  // compartían id y se cerraban juntos.
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
  const show = useCallback((msg, type = 'success') => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-4), { id, msg, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : type === 'warning' ? 5000 : 3000);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-[10000] flex flex-col items-end gap-2 pointer-events-none" aria-live="polite" role="status">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto max-w-md w-full sm:w-auto flex items-start gap-3 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-xl animate-fade-in whitespace-pre-line ${STYLES[t.type] || STYLES.success}`}>
            <span className="flex-1">{t.msg}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100 leading-none text-base" aria-label="Cerrar aviso">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx);
