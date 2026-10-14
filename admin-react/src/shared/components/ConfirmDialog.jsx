import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { TriangleAlert, Info, CircleHelp } from './Icons';
import { cn } from '../lib/utils';

/**
 * Diálogo de confirmación (reemplaza confirm()/alert() del navegador).
 *
 *   <ConfirmDialog open title="¿Eliminar el expediente?" description="No se puede deshacer."
 *                  detail={['Se borran 5 links', 'Se avisa al cliente']} tone="danger"
 *                  confirmLabel="Eliminar" onConfirm={…} onCancel={…} />
 *
 * `detail` acepta texto o lista. `cancelLabel={null}` lo convierte en un aviso
 * de un solo botón (reemplazo de alert()).
 */
export function ConfirmDialog({ open, title, description, detail, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary', onConfirm, onCancel, loading = false, icon: Icon }) {
  const confirmRef = useRef(null);
  const I = Icon || (tone === 'danger' ? TriangleAlert : tone === 'info' ? Info : CircleHelp);
  const iconTone = tone === 'danger' ? 'bg-danger-bg text-danger' : tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info';
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      size="sm"
      hideClose
      aria-label={title}
      initialFocusRef={tone === 'danger' ? undefined : confirmRef}
      className="sm:ov-pop"
      footer={(
        <>
          {cancelLabel !== null && <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>}
          <Button ref={confirmRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="flex items-start gap-4">
        <span className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', iconTone)}><I size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink-900 leading-6">{title}</h2>
          {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
          {detail && (
            Array.isArray(detail) ? (
              <ul className="mt-3 text-13 text-ink-700 bg-canvas border border-line rounded-md px-3 py-2 space-y-1 list-disc list-inside">
                {detail.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            ) : (
              <div className="mt-3 text-13 text-ink-700 bg-canvas border border-line rounded-md px-3 py-2 whitespace-pre-line">{detail}</div>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}

const ConfirmCtx = createContext(null);

/**
 * Proveedor + hook: `const confirm = useConfirm();`
 *   if (await confirm({ title: '¿Cancelar la compra?', tone: 'danger', confirmLabel: 'Cancelar compra' })) { … }
 *   await confirm({ title: 'Listo', description: 'Se envió el correo.', cancelLabel: null, confirmLabel: 'Entendido' });   (aviso)
 * El Layout ya monta el ConfirmProvider; fuera del Layout (login) montarlo a mano.
 */
export function ConfirmProvider({ children }) {
  // Cola: si llegan dos confirm() seguidos se muestran uno por uno y cada
  // promesa se resuelve con su propia respuesta (antes la segunda pisaba a la
  // primera y esa quedaba colgada para siempre).
  const [queue, setQueue] = useState([]);
  const seq = useRef(0);
  const confirm = useCallback((opts) => new Promise((resolve) => {
    seq.current += 1;
    setQueue(q => [...q, { id: seq.current, opts: typeof opts === 'string' ? { title: opts } : (opts || {}), resolve }]);
  }), []);
  const head = queue[0] || null;
  const finish = (value) => {
    if (!head) return;
    head.resolve(value);
    setQueue(q => q.filter(item => item !== head));
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {/* `key` por solicitud: cada diálogo monta su propia trampa de foco. */}
      <ConfirmDialog
        key={head ? head.id : 'ninguno'}
        open={!!head}
        {...(head?.opts || {})}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  // Sin proveedor (no debería pasar dentro del Layout) se degrada al nativo.
  return ctx || ((opts) => Promise.resolve(window.confirm(typeof opts === 'string' ? opts : [opts?.title, opts?.description].filter(Boolean).join('\n'))));
}
