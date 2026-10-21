import { Card, DescriptionList, FormGrid, Input, Select, Textarea, Checkbox, Badge } from '../../../shared/components/UI';
import { fmtDate } from '../../../shared/lib/utils';
import { SERVICE_TYPES, ORIGENES } from './constantes';

/**
 * Datos del expediente. Lo que no se edita (cliente, correos, fecha) va como
 * texto; lo editable, con `Field`. Cada cambio marca `unsaved`.
 *
 * `contactoOculto`: el rol agente (operación en EE. UU.) recibe el correo y
 * el teléfono del cliente vacíos y sólo su primer nombre; el servidor tampoco
 * le deja guardarlos. Aquí se dice en vez de mostrar campos en blanco.
 */
export default function FormularioExpediente({ detail, form, setForm, setUnsaved, contactoOculto = false }) {
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setUnsaved(true); };
  const esAlmirante = (form.plan_name || '').toLowerCase().includes('almirante');
  const oculto = <span className="text-ink-500">Oculto para tu cuenta</span>;

  return (
    <Card id="datos" className="scroll-mt-32">
      <Card.Header
        title="Datos del expediente"
        description={contactoOculto
          ? 'El contacto del cliente lo lleva el equipo en Chile; tu cuenta ve el expediente sin él.'
          : 'Lo que ve el equipo y lo que se le muestra al cliente en su panel.'}
      />
      <Card.Body className="space-y-6">
        <DescriptionList
          cols={4}
          dense
          items={[
            { label: 'Cliente', value: detail.customer_name || '—' },
            { label: 'Correo', value: contactoOculto ? oculto : (detail.customer_email ? <a href={`mailto:${detail.customer_email}`} className="text-brand-600 hover:underline break-all">{detail.customer_email}</a> : '—') },
            { label: 'Correo secundario', value: contactoOculto ? oculto : (detail.secondary_email || <span className="text-ink-500">Sin correo secundario</span>) },
            { label: 'Creado', value: fmtDate(detail.purchase_date || detail.created_at) },
          ]}
        />
        <FormGrid cols={2}>
          {contactoOculto ? (
            <Input label="Teléfono del cliente" type="tel" value="" onChange={() => {}} placeholder="Oculto" disabled hint="Sólo lo ve el equipo en Chile." />
          ) : (
            <Input label="Teléfono del cliente" type="tel" value={form.customer_phone} onChange={set('customer_phone')} placeholder="+56 9 1234 5678" />
          )}
          <Select label="Tipo de servicio" value={form.service_type} onChange={set('service_type')} options={SERVICE_TYPES} />
          <Select label="Origen" value={form.origin} onChange={set('origin')} options={ORIGENES} />
          <Input
            label="Plan"
            value={form.plan_name}
            onChange={set('plan_name')}
            hint={esAlmirante
              ? <Badge tone="success" size="sm">Reporte IA incluido</Badge>
              : <Badge tone="warning" size="sm">Reporte IA: +$15.000 CLP</Badge>}
          />
          <Input label="Embarcación u objetivo" value={form.asset_name} onChange={set('asset_name')} placeholder="Bowrider 26–30 pies" />
          <Input label="Tipo o zona" value={form.type_zone} onChange={set('type_zone')} placeholder="Costa Este USA" />
          <Input label="Requerimiento" value={form.requirement_name} onChange={set('requirement_name')} className="sm:col-span-2" />
          <Input label="Agente" value={form.agent_name} onChange={set('agent_name')} />
          <Input label="Teléfono del agente" type="tel" value={form.agent_phone} onChange={set('agent_phone')} />
          <Textarea label="Notas internas" hint="Sólo las ve el equipo." value={form.admin_notes} onChange={set('admin_notes')} rows={3} className="sm:col-span-2" />
        </FormGrid>
        <Checkbox
          label="Visible para el cliente"
          hint="Si está desmarcado, el expediente no aparece en el panel del cliente."
          checked={!!form.visible_to_client}
          onChange={e => { setForm({ ...form, visible_to_client: e.target.checked }); setUnsaved(true); }}
        />
      </Card.Body>
    </Card>
  );
}
