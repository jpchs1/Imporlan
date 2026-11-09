import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Switch, Callout } from '../../../shared/components/UI';
import { Dropzone } from '../../../shared/components/Dropzone';
import { X, Check } from '../../../shared/components/Icons';
import { FileImage } from '../../../shared/components/FileImage';
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
 * hito. David también los puede informar desde su link. Si David ya mandó
 * las fotos como actualización, se eligen de `archivos` sin volver a subirlas.
 */
const EXISTENTES_MAX = 12;
// Nunca la cédula del cliente (es privada: sólo el equipo la ve).
const esVisual = f => f?.uploaded_by !== 'cliente_identidad' && (String(f?.mime_type || '').startsWith('image/') || String(f?.mime_type || '').startsWith('video/') || ['image', 'video'].includes(f?.category));
const esFoto = f => String(f?.mime_type || '').startsWith('image/') || f?.category === 'image';

export default function ModalHito({ open, onClose, hito, eleccion, onConfirmar, conReporte = false, orderId, archivos = [] }) {
  const [notify, setNotify] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [elegidas, setElegidas] = useState([]); // ids de fotos que ya están en el expediente
  // Las del expediente: primero las que mandó David, las más nuevas arriba.
  const existentes = useMemo(() => (archivos || []).filter(esVisual)
    .sort((a, b) => (b.uploaded_by === 'operador_usa') - (a.uploaded_by === 'operador_usa') || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, EXISTENTES_MAX), [archivos]);
  const [error, setError] = useState('');
  const previews = useMemo(() => fotos.map(f => ({ f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })), [fotos]);
  useEffect(() => () => previews.forEach(p => p.url && URL.revokeObjectURL(p.url)), [previews]);
  if (!hito) return null;

  const etapaAhora = etapaPorEleccion(eleccion);
  const etapaDespues = etapaPorEleccion({ ...eleccion, steps: { ...(eleccion?.steps || {}), [hito.id]: 'x' } });
  const mueve = etapaDespues > etapaAhora ? ETAPAS_EXPEDIENTE.find(e => e.num === etapaDespues)?.label : null;
  const nPago = pagoQueGatilla(hito.id, eleccion);
  const conFotos = !!hito.conFotos;
  const hayFoto = fotos.some(f => f.type.startsWith('image/')) || existentes.some(f => elegidas.includes(Number(f.id)) && esFoto(f));
  const total = fotos.length + elegidas.length;
  const queFotos = hito.id === 'retiro' ? 'del retiro (pick-up)' : 'de la entrega en el puerto (drop-off)';

  async function confirmar() {
    setError('');
    if (conFotos && !hayFoto) { setError(`Agrega al menos una foto ${queFotos}.`); return; }
    setGuardando(true);
    try {
      let ids = [...elegidas];
      if (conFotos && fotos.length) {
        // Sin correo de «documentos nuevos»: el aviso del hito ya lleva las fotos.
        const r = await uploadExpedienteFiles(orderId, fotos, hito.id === 'retiro' ? 'Retiro en EE. UU. (pick-up)' : 'Entrega en el puerto de EE. UU. (drop-off)', false);
        const subidas = (r?.uploaded || []).map(u => Number(u.id)).filter(Boolean);
        if (!subidas.length) throw new Error((r?.errors || []).join(' ') || 'No se pudieron subir las fotos');
        ids = [...ids, ...subidas];
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
            {inspeccion ? 'Registrar que aprobó' : conFotos ? (total ? `Marcar hecho con ${total} ${total === 1 ? 'foto' : 'fotos'}` : 'Marcar hecho con fotos') : 'Marcar hecho'}
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
            {existentes.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-13 text-ink-700">O elige fotos que ya están en el expediente <span className="text-ink-500">(por ejemplo, las que mandó David)</span></p>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Fotos del expediente">
                  {existentes.map(f => {
                    const id = Number(f.id);
                    const on = elegidas.includes(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${on ? 'Quitar' : 'Usar'} ${f.original_name}`}
                          title={f.original_name}
                          onClick={() => { setError(''); setElegidas(prev => on ? prev.filter(x => x !== id) : [...prev, id]); }}
                          disabled={guardando}
                          className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 ${on ? 'border-brand-600' : 'border-line hover:border-ink-400'}`}
                        >
                          {esFoto(f) && f.download_url
                            ? <FileImage src={f.download_url} mimeType={f.mime_type} originalName={f.original_name} alt="" className="h-full w-full object-cover" loading="lazy" />
                            : <span className="flex h-full items-center justify-center bg-ink-900 text-xs text-white">Video</span>}
                          {on && <span className="absolute right-1 top-1 rounded-full bg-brand-600 p-0.5 text-white"><Check size={12} /></span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
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
