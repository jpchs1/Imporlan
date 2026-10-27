import { useState } from 'react';
import { fmtCLP } from '../../../shared/lib/utils';
import { Modal, Button, Textarea, Switch, Callout } from '../../../shared/components/UI';
import { Ship, Wallet, Globe } from '../../../shared/components/Icons';
import { tituloLancha } from '../../../shared/lib/importacion';

/**
 * «Registrar que el cliente declinó»: leyó el reporte de la inspección y no
 * quiere seguir con esta lancha, pero lo dijo por teléfono o WhatsApp en vez
 * de decidirlo en su panel (JP, 21-oct-2026: «el cliente es el que toma la
 * decisión si aprueba o declina la compra»; el equipo sólo la registra por
 * él). La nota es opcional y va al cliente tal cual, en su panel y en el
 * correo. Después él elige otra lancha (su Pago 1 se abona a la nueva) o
 * pide la devolución. A David se le pide pausar esa lancha.
 * Sólo admin y soporte. Se monta sólo mientras está abierto.
 *
 * `pago1`: el Pago 1 del plan con su cobro ({ clp, estado }) o null, para
 * decir con cifras qué pasa con lo que ya pagó. `conReporte`: si hay reporte.
 */
export default function ModalDeclinada({ open, onClose, link, pago1, onConfirmar, conReporte = false }) {
  const [nota, setNota] = useState('');
  const [notify, setNotify] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const pagado = pago1?.estado === 'pagado';

  async function confirmar() {
    setGuardando(true);
    try {
      const ok = await onConfirmar('no_apta', nota.trim(), notify);
      if (ok) onClose();
    } finally {
      setGuardando(false);
    }
  }

  const despues = [
    {
      icon: Ship,
      texto: pagado
        ? <>Puede <span className="font-medium text-ink-900">elegir otra lancha</span> del ranking: su Pago 1 ({fmtCLP(pago1.clp)}) se abona a la nueva.</>
        : <>Puede <span className="font-medium text-ink-900">elegir otra lancha</span> del ranking; si ya pagó el Pago 1, se abona a la nueva.</>,
    },
    {
      icon: Wallet,
      texto: pagado
        ? <>O <span className="font-medium text-ink-900">pedir la devolución</span> del Pago 1, descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5).</>
        : <>O <span className="font-medium text-ink-900">pedir la devolución</span>: como el Pago 1 no está pagado, el cobro pendiente se anula.</>,
    },
    { icon: Globe, texto: <>A David le pedimos <span className="font-medium text-ink-900">pausar esta lancha</span>.</> },
  ];

  return (
    <Modal
      open={open}
      onClose={guardando ? undefined : onClose}
      title="Registrar que el cliente declinó"
      description={`${tituloLancha(link)}. Para cuando te lo dijo por teléfono o WhatsApp: normalmente decide él desde su panel.`}
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando}>Registrar que declinó</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {!conReporte && (
          <Callout tone="warning" compact>
            Todavía no hay reporte cargado. Si lo tienes, conviene cargarlo primero: el cliente lo conserva en inglés y en español aunque no siga con esta lancha.
          </Callout>
        )}
        <Textarea
          label="Nota para el cliente (opcional)"
          value={nota}
          onChange={e => setNota(e.target.value)}
          rows={4}
          maxLength={2000}
          showCount
          hint="En español y con tus palabras: lo que conversaron o lo que vale la pena dejar por escrito. Se muestra tal cual en su panel y en el correo."
          placeholder="Ej.: Como conversamos, con la humedad que encontró el inspector en el casco no conviene seguir. Tu Pago 1 queda abonado para la que elijas."
          data-autofocus
        />

        <section aria-labelledby="declino-despues" className="rounded-md border border-line bg-canvas px-3 py-2.5">
          <h3 id="declino-despues" className="eyebrow mb-1.5">Qué pasa después</h3>
          <ul className="space-y-1.5">
            {despues.map((item, i) => {
              const Icono = item.icon;
              return (
                <li key={i} className="flex items-start gap-2 text-13 text-ink-700">
                  <Icono size={16} className="shrink-0 mt-0.5 text-ink-400" />
                  <span className="min-w-0">{item.texto}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <Switch
          label="Avisar al cliente por correo"
          hint="Un correo neutro —«No seguimos con esta lancha»— con tu nota y sus dos caminos. Si lo apagas, lo ve igual en su panel."
          checked={notify}
          onChange={setNotify}
        />
      </div>
    </Modal>
  );
}
