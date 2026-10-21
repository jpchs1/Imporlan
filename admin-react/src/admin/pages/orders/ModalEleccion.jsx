import { useId, useState } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { Modal, Button, Select, Textarea, Switch, Callout } from '../../../shared/components/UI';
import { hitosDe, precioChile, sePuedeElegir, tituloLancha, pago1AlElegir } from '../../../shared/lib/importacion';

const OPCIONES_INSPECCION = [
  { valor: true, label: 'Con inspección técnica', hint: 'La etapa queda en Inspección hasta que se apruebe. Va incluida en la operación, no se cobra aparte.' },
  { valor: false, label: 'Sin inspección', hint: 'La etapa pasa directo a Compra.' },
];

/**
 * «Marcar lancha elegida» / «Cambiar»: para cuando el cliente decide por
 * WhatsApp o correo y el equipo lo registra por él. Misma lancha = sólo se
 * corrigen inspección y nota (sin correo ni Pago 1); otra lancha borra los
 * hitos y, con cotización publicada, pide el Pago 1 (el primer pago del plan,
 * con el que parte la operación). Se monta sólo mientras está abierto.
 *
 * `puedeCobrar`: false para el rol agente, que no ve cobros; el servidor igual
 * aplica la regla del Pago 1, aquí sólo no se le muestra.
 */
export default function ModalEleccion({ open, onClose, links, eleccion, linkIdInicial, onConfirmar, puedeCobrar = true }) {
  const id = useId();
  const [linkId, setLinkId] = useState(() => String(linkIdInicial ?? eleccion?.link_id ?? ''));
  const [inspection, setInspection] = useState(() => (eleccion ? !!eleccion.inspection : true));
  const [note, setNote] = useState(eleccion?.note || '');
  const [notify, setNotify] = useState(true);
  const [pedirPago1, setPedirPago1] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const conUrl = links.filter(l => l.id && (l.url || '').trim());
  const opciones = conUrl.map(l => {
    const precio = precioChile(l);
    const vendida = !sePuedeElegir(l);
    return { value: String(l.id), label: `${tituloLancha(l)}${precio ? ` · ${fmtCLP(precio.clp)}` : ''}${vendida ? ' · vendida' : ''}`, disabled: vendida && Number(eleccion?.link_id) !== l.id };
  });
  const misma = !!eleccion && Number(linkId) === Number(eleccion.link_id);
  const hitosHechos = hitosDe(eleccion).filter(h => h.hecho).length;
  const cambia = !!eleccion && !!linkId && !misma;
  const elegida = linkId ? conUrl.find(l => String(l.id) === linkId) : null;
  const pago1 = pago1AlElegir(elegida);

  async function confirmar() {
    if (!linkId) { setError('Elige una lancha del ranking.'); return; }
    setError('');
    setGuardando(true);
    try {
      const ok = await onConfirmar({
        linkId: Number(linkId),
        inspection,
        note: note.trim(),
        notify: misma ? false : notify,
        // Misma lancha: sólo se edita, no se vuelve a pedir el Pago 1.
        requestPago1: misma ? false : (pago1 ? pedirPago1 : false),
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
      title={eleccion ? 'Cambiar la lancha elegida' : 'Marcar lancha elegida'}
      description="Para cuando el cliente decide por WhatsApp o correo. Lo ve en su panel como «Tu importación»."
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando} disabled={!linkId}>
            {eleccion ? (misma ? 'Guardar' : 'Cambiar lancha') : 'Marcar elegida'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {conUrl.length === 0 ? (
          <Callout tone="warning" compact>El ranking no tiene filas con link. Pega el anuncio en una fila antes de marcarla como elegida.</Callout>
        ) : (
          <Select
            label="Lancha"
            value={linkId}
            onChange={e => { setLinkId(e.target.value); setError(''); }}
            options={opciones}
            placeholder="Elige una del ranking…"
            error={error}
            hint={!error ? 'Sólo las filas con link del anuncio. El precio es el de la cotización o el negociado.' : undefined}
            data-autofocus
          />
        )}

        {cambia && hitosHechos > 0 && (
          <Callout tone="warning" compact>
            Al cambiar de lancha se borran los {hitosHechos} hito{hitosHechos === 1 ? '' : 's'} marcado{hitosHechos === 1 ? '' : 's'}. Los cobros quedan{pago1 ? ', salvo el Pago 1 pendiente de la otra lancha, que se anula' : ''}.
          </Callout>
        )}

        <fieldset>
          <legend className="block text-13 font-medium text-ink-700 mb-1.5">Inspección técnica antes de comprar</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OPCIONES_INSPECCION.map(o => {
              const activa = inspection === o.valor;
              return (
                <label
                  key={String(o.valor)}
                  className={cn('flex items-start gap-2.5 rounded-md border px-3 py-2.5 cursor-pointer transition-colors duration-150',
                    activa ? 'border-brand-500 bg-brand-50' : 'border-line-strong hover:border-ink-400')}
                >
                  <input
                    type="radio"
                    name={`${id}-inspeccion`}
                    checked={activa}
                    onChange={() => setInspection(o.valor)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                  />
                  <span className="text-sm text-ink-900">
                    {o.label}
                    <span className="block text-xs text-ink-500">{o.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Textarea
          label="Nota del cliente"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          showCount
          placeholder="Lo que dijo al elegir, con sus palabras"
          hint="Opcional. Se muestra en su panel junto a la lancha."
        />

        {misma ? (
          <p className="text-13 text-ink-500">Misma lancha: sólo se actualizan la inspección y la nota. No se manda correo ni se vuelve a pedir el Pago 1.</p>
        ) : (
          <div className="space-y-3">
            {puedeCobrar && linkId && (pago1 ? (
              <Switch
                label={`Pedir el Pago 1 al cliente (${pago1.pct}% · ${fmtCLP(pago1.clp)})`}
                hint="Es el primer pago del plan de la cotización y con él parte la operación. Lo ve en Pagos, con tarjeta o transferencia."
                checked={pedirPago1}
                onChange={setPedirPago1}
              />
            ) : (
              <Callout tone="neutral" compact>
                Sin cotización publicada: crea el Pago 1 cuando la publiques. Mientras, la importación parte igual.
              </Callout>
            ))}
            <Switch
              label="Avisar al cliente por correo"
              hint={pago1 && pedirPago1 && puedeCobrar ? 'Recibe «Confirmamos tu lancha», con el botón para pagar el Pago 1.' : 'Recibe «Confirmamos tu lancha», con lo que sigue en su importación.'}
              checked={notify}
              onChange={setNotify}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
