import { useState, useRef } from 'react';
import { fmtCLP } from '../../../shared/lib/utils';
import { Modal, Button, Textarea } from '../../../shared/components/UI';
import { Search, Banknote, ShieldCheck } from '../../../shared/components/Icons';

/**
 * «¿No sigues con esta lancha?»: la confirmación de declinar tras leer el
 * reporte, con un motivo opcional («¿Nos cuentas por qué?»). Explica los dos
 * caminos que vienen después (elegir otra lancha con el Pago 1 abonado, o
 * pedir la devolución) y no empuja a ninguno.
 *
 *   <ModalDeclinar open titulo="2020 Malibu…" pago1={…} loading={…} onClose={…} onConfirmar={(motivo) => …} />
 */
export default function ModalDeclinar({ open, titulo, pago1, loading = false, onClose, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  const areaRef = useRef(null);
  const pagado = pago1?.estado === 'pagado';
  const monto = pagado ? Number(pago1.cobro?.amount_clp || pago1.clp) : 0;

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      size="md"
      title="¿No sigues con esta lancha?"
      description={titulo}
      initialFocusRef={areaRef}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Volver</Button>
          <Button onClick={() => onConfirmar(motivo)} loading={loading}>Sí, no sigo con esta lancha</Button>
        </>
      )}
    >
      <p className="text-sm text-ink-700">
        Está bien: para eso existe la inspección, te ahorraste un problema a futuro. Al declinar, {titulo} queda fuera de tu importación y tú eliges cómo seguir:
      </p>
      <ul className="mt-3 space-y-2">
        <li className="flex items-start gap-2.5 rounded-md border border-line bg-canvas px-3 py-2.5 text-13 text-ink-700">
          <Search size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <span className="font-medium text-ink-900">Elegir otra lancha</span> de tu ranking.
            {pagado ? ` Tu Pago 1 (${fmtCLP(monto)}) se abona a la nueva.` : ' Se anula el Pago 1 pendiente y te llega el de la nueva.'}
          </span>
        </li>
        <li className="flex items-start gap-2.5 rounded-md border border-line bg-canvas px-3 py-2.5 text-13 text-ink-700">
          <Banknote size={16} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
          <span>
            <span className="font-medium text-ink-900">Pedir la devolución</span>
            {pagado ? ' del Pago 1, descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5).' : ': como no alcanzaste a pagar el Pago 1, se anula el cobro y no hay nada que devolver.'}
          </span>
        </li>
      </ul>
      <Textarea
        ref={areaRef}
        label="¿Nos cuentas por qué? (opcional)"
        hint="Nos ayuda a buscar mejor la siguiente. Lo lee tu agente."
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        maxLength={1000}
        showCount
        rows={3}
        lang="es-CL"
        placeholder="Por ejemplo: la humedad en el casco me preocupa, o el costo de las reparaciones no vale la pena."
        className="mt-4"
      />
      <p className="mt-3 flex items-start gap-2 text-13 text-ink-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
        <span>Le avisamos a tu agente y se pausa la operación de esta lancha en Estados Unidos. Lo que ya pagaste no se pierde: se abona a la nueva o se devuelve.</span>
      </p>
    </Modal>
  );
}
