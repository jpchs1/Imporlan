import { Modal, Button, Input, Select, FormGrid } from '../../../shared/components/UI';
import { SERVICE_TYPES } from './constantes';

/**
 * Alta de un expediente desde el admin. El estado del formulario vive en el
 * contenedor (`createForm`) para que `handleCreate` siga mandando el mismo
 * payload (`{ ...createForm, initial_links: 1 }`).
 */
export default function ModalNuevoExpediente({ open, onClose, form, setForm, onCreate }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo expediente"
      description="Se crea con una fila de ranking vacía para empezar a pegar links."
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={onCreate}>Crear expediente</Button>
        </>
      )}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); onCreate(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); onCreate(); } }}
        className="space-y-4"
      >
        <FormGrid cols={2}>
          <Input label="Correo del cliente" type="email" required value={form.customer_email} onChange={set('customer_email')} placeholder="cliente@correo.cl" autoComplete="off" data-autofocus />
          <Input label="Nombre del cliente" required value={form.customer_name} onChange={set('customer_name')} placeholder="Nombre y apellido" />
          <Input label="Teléfono" type="tel" value={form.customer_phone} onChange={set('customer_phone')} placeholder="+56 9 1234 5678" />
          <Select label="Tipo de servicio" value={form.service_type} onChange={set('service_type')} options={SERVICE_TYPES} />
          <Input label="Plan" value={form.plan_name} onChange={set('plan_name')} placeholder="Plan Fragata, Capitán de Navío…" />
          <Input label="Embarcación u objetivo" value={form.asset_name} onChange={set('asset_name')} placeholder="Bowrider 26–30 pies" />
          <Input label="Zona o tipo" value={form.type_zone} onChange={set('type_zone')} placeholder="Costa Este USA" />
          <Input label="Agente" value={form.agent_name} onChange={set('agent_name')} />
        </FormGrid>
      </form>
    </Modal>
  );
}
