import { useState } from 'react';
import { Modal, Button } from '../../../shared/components/UI';
import { Check } from '../../../shared/components/Icons';
import FormularioDatos from './FormularioDatos';

const FORM_ID = 'datos-importacion-modal';

/**
 * «Completa tus datos»: el mismo formulario del asistente, en un modal, para
 * cuando la elección la marcó el equipo y al cliente le faltan los datos,
 * la cédula o los Términos. Al guardar avisa (`onGuardado`) y el detalle se
 * vuelve a pedir. Se monta solo abierto.
 */
export default function ModalDatos({ open, order, onClose, onGuardado }) {
  const [estado, setEstado] = useState({ cargando: true, enviando: false, resumen: false });
  if (!open || !order) return null;
  const { cargando, enviando } = estado;

  return (
    <Modal
      open={open}
      onClose={enviando ? undefined : onClose}
      title="Completa tus datos"
      description="Para comprar e importar la lancha a tu nombre"
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button type="submit" form={FORM_ID} loading={enviando} disabled={cargando} icon={Check}>Guardar mis datos</Button>
        </>
      )}
    >
      <FormularioDatos
        formId={FORM_ID}
        orderId={order.id}
        prefillNombre={order.customer_name || ''}
        prefillTelefono={order.customer_phone || ''}
        onEstado={setEstado}
        onGuardado={onGuardado}
      />
    </Modal>
  );
}
