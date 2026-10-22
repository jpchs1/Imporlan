import { useState, useId } from 'react';
import { cn } from '../../../shared/lib/utils';
import { fmtBytes, fmtDateLarga, fmtRelativo } from '../../../shared/lib/format';
import { Modal, Button, Textarea, Switch, Callout, Dropzone, SegmentedControl, Badge } from '../../../shared/components/UI';
import { Upload, FileText, Files, X, Languages } from '../../../shared/components/Icons';
import { tituloLancha, ORIGEN_ARCHIVO_USA, ORIGEN_ARCHIVO_IDENTIDAD } from '../../../shared/lib/importacion';

/** Un PDF ya cargado como reporte lleva este origen (impGuardarReporte). */
const ORIGEN_REPORTE_INSPECCION = 'inspeccion_reporte';

const MAX_PDF = 60 * 1024 * 1024;

function esPdf(f) {
  return (f?.mime_type || '') === 'application/pdf' || /\.pdf$/i.test(f?.original_name || '');
}

/** Quién subió un archivo del expediente, para la lista «Usar un PDF del expediente». */
function quienSubio(f) {
  const by = f?.uploaded_by || '';
  if (by === ORIGEN_ARCHIVO_USA) return 'David (EE. UU.)';
  if (by === ORIGEN_REPORTE_INSPECCION) return 'reporte de inspección';
  if (by === ORIGEN_ARCHIVO_IDENTIDAD) return 'el cliente (cédula)';
  if (by === 'user' || by === 'cliente') return 'el cliente';
  return 'el equipo';
}

/**
 * «Cargar reporte de inspección» (JP, 21-oct-2026: «nosotros cumplimos con
 * cargarlo, pero el cliente es el que toma la decisión»). Se sube el PDF del
 * inspector o se usa uno que ya está en el expediente (el que mandó David por
 * su portal). El cliente ve el original al tiro; el servidor lo traduce al
 * español con IA en 1 a 5 minutos y, al terminar, le avisa por correo.
 * Sólo admin y soporte. Se monta sólo mientras está abierto.
 *
 * `archivos`: el resultado de useExpedienteFiles (de ahí salen los PDF).
 * `reporte`: el reporte actual ({file_id, …}) cuando se reemplaza, o null.
 * `onCargar({ archivo | fileId, resumen, notify, onProgress })` → true si se guardó.
 */
export default function ModalReporteInspeccion({ open, onClose, link, archivos, reporte = null, onCargar }) {
  const pdfs = (archivos?.files || []).filter(f => esPdf(f) && f.uploaded_by !== ORIGEN_ARCHIVO_IDENTIDAD);
  const [modo, setModo] = useState('subir'); // 'subir' | 'expediente'
  const [archivo, setArchivo] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [resumen, setResumen] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const id = useId();
  const reemplazo = !!reporte;

  const elegido = modo === 'subir' ? !!archivo : !!fileId;

  async function cargar() {
    if (!elegido) { setError(modo === 'subir' ? 'Elige el PDF del inspector.' : 'Elige uno de los PDF del expediente.'); return; }
    setError('');
    setSubiendo(true);
    setProgreso(0);
    try {
      const ok = await onCargar({
        archivo: modo === 'subir' ? archivo : null,
        fileId: modo === 'expediente' ? fileId : null,
        resumen: resumen.trim(),
        notify,
        onProgress: setProgreso,
      });
      if (ok) onClose();
      else setError('No se pudo guardar el reporte. Intenta de nuevo.');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  function elegirArchivo(files) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_PDF) { setArchivo(null); setError(`«${f.name}» pesa ${fmtBytes(f.size)}: el máximo es 60 MB.`); return; }
    setArchivo(f);
    setError('');
  }

  const subirId = `${id}-subir`;
  const listaId = `${id}-lista`;

  return (
    <Modal
      open={open}
      onClose={subiendo ? undefined : onClose}
      title={reemplazo ? 'Reemplazar el reporte de inspección' : 'Cargar el reporte de inspección'}
      description={`${tituloLancha(link)}. El cliente lo lee en inglés y en español y después decide: aprueba la compra o elige otra lancha.`}
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={subiendo}>Cancelar</Button>
          <Button onClick={cargar} loading={subiendo} icon={Upload}>{reemplazo ? 'Reemplazar reporte' : 'Cargar reporte'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {reemplazo && (
          <Callout tone="warning" compact>
            El reporte actual (cargado el {fmtDateLarga(reporte.at)}) se reemplaza y la traducción se hace de nuevo. Se puede mientras el cliente no decida.
          </Callout>
        )}

        {pdfs.length > 0 && (
          <SegmentedControl
            aria-label="De dónde sale el PDF"
            size="sm"
            className="max-w-full"
            value={modo}
            onChange={(m) => { setModo(m); setError(''); }}
            options={[
              { id: 'subir', label: 'Subir un PDF', icon: Upload },
              { id: 'expediente', label: `Usar uno del expediente (${pdfs.length})`, icon: Files },
            ]}
          />
        )}

        {modo === 'subir' ? (
          <section aria-labelledby={subirId}>
            <h3 id={subirId} className="sr-only">Subir el PDF del inspector</h3>
            {archivo ? (
              <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
                <span className="h-9 w-9 rounded-md bg-surface border border-line flex items-center justify-center text-ink-500 shrink-0" aria-hidden="true"><FileText size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900 truncate" title={archivo.name}>{archivo.name}</p>
                  <p className="text-xs text-ink-500">{fmtBytes(archivo.size)} · PDF</p>
                </div>
                <Button size="sm" variant="ghost" icon={X} onClick={() => setArchivo(null)} disabled={subiendo} aria-label={`Quitar ${archivo.name}`}>Quitar</Button>
              </div>
            ) : (
              <Dropzone
                accept=".pdf,application/pdf"
                onFiles={elegirArchivo}
                onReject={() => setError('Sólo se admite un PDF.')}
                showRejected={false}
                label="Arrastra el PDF del inspector"
                buttonLabel="Elegir PDF"
                hint="Sólo PDF, hasta 60 MB. Va tal cual al cliente: en inglés, como llegó."
                disabled={subiendo}
                compact
              />
            )}
          </section>
        ) : (
          <fieldset className="min-w-0">
            <legend id={listaId} className="text-sm font-medium text-ink-900 mb-1.5">PDF del expediente</legend>
            <p className="text-xs text-ink-500 mb-2">Por ejemplo, el que mandó David por su portal. Queda visible para el cliente.</p>
            <ul className="rounded-md border border-line divide-y divide-line max-h-64 overflow-y-auto scrollbar-thin" aria-labelledby={listaId}>
              {pdfs.map(f => {
                const actual = reporte?.file_id && Number(reporte.file_id) === Number(f.id);
                const sel = Number(fileId) === Number(f.id);
                return (
                  <li key={f.id}>
                    <label className={cn('flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150', sel ? 'bg-brand-50' : 'hover:bg-canvas')}>
                      <input
                        type="radio"
                        name={`${id}-pdf`}
                        value={f.id}
                        checked={sel}
                        onChange={() => { setFileId(f.id); setError(''); }}
                        disabled={subiendo}
                        className="mt-1 h-4 w-4 accent-brand-600 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium text-ink-900 truncate max-w-full" title={f.original_name}>{f.original_name}</span>
                          {actual && <Badge tone="info" size="sm">Reporte actual</Badge>}
                          {f.uploaded_by === ORIGEN_ARCHIVO_USA && <Badge tone="info" size="sm">Desde EE. UU.</Badge>}
                        </span>
                        <span className="block text-xs text-ink-500 tabular">
                          {fmtBytes(f.file_size)} · {quienSubio(f)}
                          {f.created_at && <> · <time dateTime={f.created_at} title={fmtDateLarga(f.created_at, { hora: true })}>{fmtRelativo(f.created_at)}</time></>}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        <Textarea
          label="Lo que vemos en el reporte (para el cliente, en español)"
          value={resumen}
          onChange={e => setResumen(e.target.value)}
          rows={4}
          maxLength={3000}
          showCount
          disabled={subiendo}
          hint="Opcional. Va arriba del reporte en su panel y en el correo. En tus palabras y sin decidir por él: la decisión es suya."
          placeholder="Ej.: El casco y la estructura están bien. El inspector marca el impeller del motor de babor para cambiar antes de la temporada y un rayón cosmético en la popa. Nada que afecte la navegación."
        />

        <Switch
          label="Avisar al cliente por correo cuando esté la traducción"
          hint="Recibe «Ya está el reporte de la inspección», con tu resumen y el botón para leerlo y decidir. Si lo apagas, lo ve igual en su panel."
          checked={notify}
          onChange={setNotify}
          disabled={subiendo}
        />

        <Callout tone="neutral" compact icon={Languages}>
          La traducción al español la hace una IA en 1 a 5 minutos; el cliente ve el original de inmediato.
        </Callout>

        {subiendo && modo === 'subir' && (
          <div>
            <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
              <span>{progreso < 100 ? 'Subiendo el PDF…' : 'Guardando…'}</span>
              <span className="tabular">{progreso}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-bg overflow-hidden" role="progressbar" aria-label="Progreso de la subida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
              <div className="h-full bg-brand-600 transition-[width] duration-200" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        )}

        {error && <Callout tone="danger" compact>{error}</Callout>}
      </div>
    </Modal>
  );
}

/** Los errores del servidor, en palabras del equipo (400 / 409 / 413). */
function mensajeDeError(e) {
  const st = e?.status;
  const m = e?.message || '';
  if (st === 413 || /muy pesado|413/i.test(m)) return 'El PDF es muy pesado para el servidor (máximo 60 MB). Comprímelo o pídele al inspector una versión más liviana.';
  if (st === 400) return m || 'El archivo no es un PDF válido.';
  if (st === 409) return m || 'No se puede cargar el reporte en este estado (sin inspección o el cliente ya decidió).';
  return m || 'No se pudo guardar el reporte. Intenta de nuevo.';
}
