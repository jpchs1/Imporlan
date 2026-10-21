import { useState } from 'react';
import { fmtCLP } from '../../../shared/lib/utils';
import { Modal, Button, Textarea, Switch } from '../../../shared/components/UI';
import { Ship, Wallet, Globe } from '../../../shared/components/Icons';
import { tituloLancha } from '../../../shared/lib/importacion';

/**
 * «Marcar no apta»: la inspección técnica recomienda no comprar la lancha
 * elegida (JP: «si sale no apto se ahorra un problema a futuro y será
 * conveniente ver otra opción»). La nota va al cliente tal cual, en su panel
 * y en el correo; después él elige otra lancha (su Pago 1 se abona a la
 * nueva) o pide la devolución. A David se le pide pausar esa lancha.
 * Sólo admin y soporte. Se monta sólo mientras está abierto.
 *
 * `pago1`: el Pago 1 del plan con su cobro ({ clp, estado }) o null, para
 * decir con cifras qué pasa con lo que ya pagó.
 */
export default function ModalNoApta({ open, onClose, link, pago1, onConfirmar }) {
  const [nota, setNota] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const pagado = pago1?.estado === 'pagado';

  async function confirmar() {
    const texto = nota.trim();
    if (!texto) { setError('Cuéntale al cliente qué encontró la inspección: es lo que lee en su panel y en el correo.'); return; }
    setError('');
    setGuardando(true);
    try {
      const ok = await onConfirmar('no_apta', texto, notify);
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
      title="Marcar la inspección como no apta"
      description={`${tituloLancha(link)}. El hito queda en advertencia y el cliente lo ve en «Tu importación».`}
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando}>Marcar no apta</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Textarea
          label="Lo que le contamos al cliente"
          value={nota}
          onChange={e => { setNota(e.target.value); if (error) setError(''); }}
          rows={5}
          maxLength={2000}
          showCount
          required
          error={error}
          hint={!error ? 'En español y con tus palabras: qué encontró la inspección y por qué no conviene comprarla. Se muestra tal cual en su panel y en el correo.' : undefined}
          placeholder="Ej.: El inspector encontró humedad en el casco bajo la línea de flotación y el motor de babor pierde compresión. No conviene comprarla."
          data-autofocus
        />

        <section aria-labelledby="no-apta-despues" className="rounded-md border border-line bg-canvas px-3 py-2.5">
          <h3 id="no-apta-despues" className="eyebrow mb-1.5">Qué pasa después</h3>
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
          hint="Un correo tranquilo —«te ahorraste un problema»— con tu nota y sus dos opciones. Si lo apagas, lo ve igual en su panel."
          checked={notify}
          onChange={setNotify}
        />
      </div>
    </Modal>
  );
}
