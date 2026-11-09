import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Switch, Callout } from '../../../shared/components/UI';
import { Dropzone } from '../../../shared/components/Dropzone';
import { X } from '../../../shared/components/Icons';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { etapaPorEleccion, pagoQueGatilla } from '../../../shared/lib/importacion';
import { uploadExpedienteFiles } from '../../api';

/**
 * Confirmación compacta para marcar un hito de la importación como hecho,
 * con el interruptor «Avisar al cliente por correo» (encendido). Dice si
 * la etapa del expediente se mueve con este hito y si crea el Pago 2 o el
 * Pago 3 (JP: inspección aprobada / lancha en el puerto de EE. UU.).
 *
 * El hito de inspección es distinto: el equipo carga el reporte y decide EL
 * CLIENTE desde su panel (JP, 21-oct-2026). Marcarlo hecho desde aquí es
 * registrar por él que aprobó (se lo dijo por teléfono o WhatsApp), así que
 * el modal lo dice con esas palabras. `conReporte`: si ya hay reporte cargado.
 *
 * El retiro y la entrega en el puerto de EE. UU. (`hito.conFotos`) se
 * informan con fotos del pick-up y del drop-off (JP, 9-nov-2026): se suben al
 * expediente, el cliente las ve junto al avance y quedan como evidencia del
 * hito. David también los puede informar desde su link.
 */
export default function ModalHito({ open, onClose, hito, eleccion, onConfirmar, conReporte = false, orderId }) {
  const [notify, setNotify] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState('');
  const previews = useMemo(() => fotos.map(f => ({ f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })), [fotos]);
  useEffect(() => () => previews.forEach(p => p.url && URL.revokeObjectURL(p.url)), [previews]);
  if (!hito) return null;

  const etapaAhora = etapaPorEleccion(eleccion);
  const etapaDespues = etapaPorEleccion({ ...eleccion, steps: { ...(eleccion?.steps || {}), [hito.id]: 'x' } });
  const mueve = etapaDespues > etapaAhora ? ETAPAS_EXPEDIENTE.find(e => e.num === etapaDespues)?.label : null;
  const nPago = pagoQueGatilla(hito.id, eleccion);
  const conFotos = !!hito.conFotos;
  const hayFoto = fotos.some(f => f.type.startsWith('image/'));
  const queFotos = hito.id === 'retiro' ? 'del retiro (pick-up)' : 'de la entrega en el puerto (drop-off)';

  async function confirmar() {
    setError('');
    if (conFotos && !hayFoto) { setError(`Agrega al menos una foto ${queFotos}.`); return; }
    setGuardando(true);
    try {
      let ids = [];
      if (conFotos) {
        // Sin correo de «documentos nuevos»: el aviso del hito ya lleva las fotos.
        const r = await uploadExpedienteFiles(orderId, fotos, hito.id === 'retiro' ? 'Retiro en EE. UU. (pick-up)' : 'Entrega en el puerto de EE. UU. (drop-off)', false);
        ids = (r?.uploaded || []).map(u => Number(u.id)).filter(Boolean);
        if (!ids.length) throw new Error((r?.errors || []).join(' ') || 'No se pudieron subir las fotos');
      }
      const ok = await onConfirmar(hito, true, notify, ids);
      if (ok) onClose();
    } catch (e) {
      setError(e.message || 'No se pudieron subir las fotos');
    } finally {
      setGuardando(false);
    }
  }

  const inspeccion = hito.id === 'inspeccion';

  return (
    <Modal
      open={open}
      onClose={guardando ? undefined : onClose}
      title={inspeccion ? '¿Registrar que el cliente aprobó la inspección?' : conFotos ? `Informar: ${hito.corto}` : `¿Marcar «${hito.corto}» como hecho?`}
      size={conFotos ? 'md' : 'sm'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando} disabled={conFotos && !hayFoto} data-autofocus>
            {inspeccion ? 'Registrar que aprobó' : conFotos ? `Marcar hecho con ${fotos.length || ''} ${fotos.length === 1 ? 'foto' : 'fotos'}`.replace('  ', ' ') : 'Marcar hecho'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {inspeccion ? (
          <p className="text-sm text-ink-700">
            <span className="font-medium text-ink-900">Inspección técnica aprobada por el cliente.</span> Para cuando te lo dijo por teléfono o WhatsApp: normalmente aprueba o declina él mismo desde su panel{conReporte ? ', con el reporte a la vista' : ''}. Queda con la fecha de hoy.
            {mueve && <> La etapa del expediente pasa a <span className="font-medium text-ink-900">{mueve}</span>.</>}
          </p>
        ) : (
          <p className="text-sm text-ink-700">
            <span className="font-medium text-ink-900">{hito.label.endsWith('.') ? hito.label : `${hito.label}.`}</span> Queda con la fecha de hoy y el cliente lo ve en su importación{conFotos ? ', con las fotos' : ''}.
            {mueve && <> La etapa del expediente pasa a <span className="font-medium text-ink-900">{mueve}</span>.</>}
          </p>
        )}
        {inspeccion && !conReporte && (
          <Callout tone="warning" compact>
            Todavía no hay reporte cargado. Si lo tienes, cancela y cárgalo primero: así el cliente lo conserva en inglés y en español.
          </Callout>
        )}
        {conFotos && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink-900">Fotos {queFotos} <span className="text-danger">*</span></p>
            <Dropzone
              multiple
              accept="image/*,video/*"
              onFiles={nuevas => { setError(''); setFotos(prev => [...prev, ...nuevas]); }}
              label="Arrastra las fotos aquí"
              buttonLabel="Elegir fotos"
              hint="Fotos o videos, al menos una foto. El cliente las ve junto al avance de su importación."
              disabled={guardando}
              compact
            />
            {previews.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos elegidas">
                {previews.map(({ f, url }, i) => (
                  <li key={`${f.name}-${i}`} className="relative overflow-hidden rounded-md border border-line bg-canvas">
                    {url
                      ? <img src={url} alt={f.name} className="h-20 w-full object-cover" />
                      : <div className="flex h-20 items-center justify-center px-2 text-center text-xs text-ink-500">{f.name}</div>}
                    <button
                      type="button"
                      onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                      disabled={guardando}
                      className="absolute right-1 top-1 rounded-full bg-surface/90 p-0.5 text-ink-700 shadow-sm hover:text-danger"
                      aria-label={`Quitar ${f.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-500">{hito.id === 'retiro' ? 'David también puede informarlo desde su link privado, con sus fotos.' : 'David también puede informarlo desde su link privado, con sus fotos y el dock receipt.'}</p>
          </div>
        )}
        {nPago > 0 && (
          <Callout tone="info" compact title={`Se crea el Pago ${nPago}${nPago === 3 ? ', el último de la operación' : ''}`}>
            Con el % y el monto de la cotización publicada (si ya existe un cobro del Pago {nPago}, no se crea otro). El cliente lo ve en Pagos de su panel.
          </Callout>
        )}
        {error && <Callout tone="danger" compact>{error}</Callout>}
        <Switch
          label="Avisar al cliente por correo"
          hint={nPago > 0 ? `Le mandamos el avance${conFotos ? ' con las fotos' : ''} y el botón para pagar el Pago ${nPago}.` : `Le mandamos el avance${conFotos ? ' con las fotos' : ' con la lista de hitos'}.`}
          checked={notify}
          onChange={setNotify}
        />
      </div>
    </Modal>
  );
}
