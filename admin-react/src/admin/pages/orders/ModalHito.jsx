import { useState } from 'react';
import { Modal, Button, Switch, Callout } from '../../../shared/components/UI';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { etapaPorEleccion, pagoQueGatilla } from '../../../shared/lib/importacion';

/**
 * Confirmación compacta para marcar un hito de la importación como hecho,
 * con el interruptor «Avisar al cliente por correo» (encendido). Dice si
 * la etapa del expediente se mueve con este hito y si crea el Pago 2 o el
 * Pago 3 (JP: inspección aprobada / lancha en el puerto de EE. UU.).
 */
export default function ModalHito({ open, onClose, hito, eleccion, onConfirmar }) {
  const [notify, setNotify] = useState(true);
  const [guardando, setGuardando] = useState(false);
  if (!hito) return null;

  const etapaAhora = etapaPorEleccion(eleccion);
  const etapaDespues = etapaPorEleccion({ ...eleccion, steps: { ...(eleccion?.steps || {}), [hito.id]: 'x' } });
  const mueve = etapaDespues > etapaAhora ? ETAPAS_EXPEDIENTE.find(e => e.num === etapaDespues)?.label : null;
  const nPago = pagoQueGatilla(hito.id, eleccion);

  async function confirmar() {
    setGuardando(true);
    try {
      const ok = await onConfirmar(hito, true, notify);
      if (ok) onClose();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={guardando ? undefined : onClose}
      title={`¿Marcar «${hito.corto}» como hecho?`}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando} data-autofocus>Marcar hecho</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-700">
          <span className="font-medium text-ink-900">{hito.label}.</span> Queda con la fecha de hoy y el cliente lo ve en su importación.
          {mueve && <> La etapa del expediente pasa a <span className="font-medium text-ink-900">{mueve}</span>.</>}
        </p>
        {nPago > 0 && (
          <Callout tone="info" compact title={`Se crea el Pago ${nPago}`}>
            Con el % y el monto de la cotización publicada (si ya existe un cobro del Pago {nPago}, no se crea otro). El cliente lo ve en Pagos de su panel.
          </Callout>
        )}
        <Switch
          label="Avisar al cliente por correo"
          hint={nPago > 0 ? `Le mandamos el avance con la lista de hitos y el botón para pagar el Pago ${nPago}.` : 'Le mandamos el avance con la lista de hitos.'}
          checked={notify}
          onChange={setNotify}
        />
      </div>
    </Modal>
  );
}
