import { useState } from 'react';
import { Modal, Button, Input, MoneyInput, Textarea, Switch, FormGrid } from '../../../shared/components/UI';
import { tituloLancha } from '../../../shared/lib/importacion';

/**
 * «Crear cobro»: una solicitud de pago al cliente, prellenada con el pago
 * del plan de la cotización (Pago n · % · monto) o libre («Cobro manual»).
 * Se monta sólo mientras está abierto, así parte limpio cada vez.
 */
export default function ModalCobro({ open, onClose, detail, link, pago, onCrear }) {
  const titulo = tituloLancha(link);
  const usdPlan = pago && Number(link?.quote_total_usd) > 0 ? Math.round(Number(link.quote_total_usd) * pago.pct / 100) : null;
  const [title, setTitle] = useState(pago ? `Pago ${pago.n} · ${titulo} (${pago.pct}%)` : '');
  const [clp, setClp] = useState(pago ? pago.clp : null);
  const [usd, setUsd] = useState(usdPlan);
  const [description, setDescription] = useState(pago
    ? `Pago ${pago.n} de 3 (${pago.pct}%) de la cotización de ${titulo}, expediente ${detail.order_number}.`
    : '');
  const [sendEmail, setSendEmail] = useState(true);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    const e = {};
    if (!title.trim()) e.title = 'Ponle un título: es lo que el cliente ve en Pagos.';
    if (!(Number(clp) > 0)) e.clp = 'El monto en pesos tiene que ser mayor a cero.';
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const ok = await onCrear({
        title: title.trim(),
        description: description.trim(),
        amount_clp: Math.round(Number(clp)),
        amount_usd: Number(usd) > 0 ? Number(usd) : null,
        boat_name: titulo,
        custom_fields: pago ? { pago: pago.n, link_id: link?.id } : { link_id: link?.id },
        send_email: sendEmail,
      });
      if (ok) onClose();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={guardando ? undefined : onClose}
      title={pago ? `Crear cobro · Pago ${pago.n}` : 'Cobro manual'}
      description={`Se le cobra a ${detail.customer_name || 'el cliente'} (${detail.customer_email}). Lo ve en su panel, en Pagos.`}
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={crear} loading={guardando}>Crear cobro</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Input
          label="Título"
          value={title}
          onChange={e => setTitle(e.target.value)}
          error={errores.title}
          placeholder={pago ? undefined : `Ej.: Inspección técnica · ${titulo}`}
          required
          data-autofocus={!pago || undefined}
        />
        <FormGrid cols={2}>
          <MoneyInput
            label="Monto"
            currency="CLP"
            value={clp}
            onChange={setClp}
            error={errores.clp}
            hint={pago ? `${pago.pct}% de la cotización. Puedes ajustarlo.` : undefined}
            required
            data-autofocus={pago || undefined}
          />
          <MoneyInput
            label="Referencia en dólares"
            currency="USD"
            value={usd}
            onChange={setUsd}
            placeholder="—"
            hint="Opcional. Sólo se muestra como referencia."
          />
        </FormGrid>
        <Textarea
          label="Descripción"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          maxLength={500}
          hint="Opcional. Va en el correo y en la fila del cobro."
        />
        <Switch
          label="Mandar correo al cliente"
          hint="Le llega el cobro con el botón para pagar. Igual queda avisado en su chat."
          checked={sendEmail}
          onChange={setSendEmail}
        />
      </div>
    </Modal>
  );
}
