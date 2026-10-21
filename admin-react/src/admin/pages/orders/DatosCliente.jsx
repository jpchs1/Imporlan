import { useState, useEffect, useCallback, useRef } from 'react';
import { cn, fmtDate } from '../../../shared/lib/utils';
import { fmtDateLarga, fmtBytes } from '../../../shared/lib/format';
import { Button, IconButton, Badge, DescriptionList, ErrorState, Skeleton, Lightbox } from '../../../shared/components/UI';
import { User, Copy, RefreshCw, ExternalLink, FileText, FileCheck, CircleAlert } from '../../../shared/components/Icons';
import { useToast } from '../../../shared/components/Toast';
import { camposDatosImportacion, tituloLancha } from '../../../shared/lib/importacion';
import { getImportDataAdmin } from '../../api';

/**
 * Datos del cliente para la importación: lo que completa al elegir la lancha
 * (nombre, RUT, dirección…), su cédula por ambos lados y la aceptación de los
 * Términos. Sin esto no se puede comprar ni importar a su nombre.
 *
 * Sólo lo ven admin y soporte (el servidor lo exige; el agente de EE. UU. no
 * ve la cédula ni en Archivos). Los enlaces a la cédula van firmados y duran
 * una hora: por eso hay «Recargar». Se relee solo cuando cambia el expediente
 * y hay elección (al marcarla, el correo le pide los datos al cliente).
 */
export default function DatosCliente({ detail, eleccion, link }) {
  const toast = useToast();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [lightbox, setLightbox] = useState(null); // { items, index }

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const r = await getImportDataAdmin(detail.id);
      setDatos(r);
      setError('');
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los datos del cliente.');
    }
    setCargando(false);
  }, [detail.id]);

  useEffect(() => {
    const t = setTimeout(cargar, 0);
    return () => clearTimeout(t);
  }, [cargar]);

  // Con elección, cada recarga del expediente (hito, cambio de lancha, aviso
  // al cliente) vuelve a pedir los datos sin parpadeo: puede que recién los
  // haya completado. Sin elección, basta con lo que se pidió al abrir.
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (!eleccion) return;
    const t = setTimeout(() => cargar({ silencioso: true }), 0);
    return () => clearTimeout(t);
  }, [detail, eleccion, cargar]);

  const completo = !!datos?.completo;
  const recibido = !!datos?.recibido;
  const campos = camposDatosImportacion(datos?.datos, datos?.campos);
  const faltantes = faltanDe(datos, campos, !!eleccion);
  const terminos = datos?.terminos || {};
  const hayAlgo = recibido || campos.some(c => c.valor);

  async function copiarTodo() {
    const texto = textoParaCopiar({ detail, link, campos, datos });
    try {
      await navigator.clipboard.writeText(texto);
      toast?.('Datos del cliente copiados', 'success');
    } catch {
      toast?.({ type: 'error', title: 'No se pudo copiar', description: 'Selecciona los datos y cópialos a mano.' });
    }
  }

  const caras = [
    { id: 'frente', label: 'Frente', info: datos?.ci_frente, url: datos?.ci_frente_url },
    { id: 'reverso', label: 'Reverso', info: datos?.ci_reverso, url: datos?.ci_reverso_url },
  ];
  const imagenes = caras.filter(c => c.info && c.url && esImagen(c.info));
  const itemsLightbox = imagenes.map(c => ({ src: c.url, alt: `Cédula de identidad, ${c.label.toLowerCase()}`, caption: `Cédula · ${c.label} · ${c.info.original_name}`, downloadUrl: c.url }));

  return (
    <section id="datos-cliente" aria-labelledby="importacion-datos" className="scroll-mt-32">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-2">
        <h3 id="importacion-datos" className="eyebrow flex items-center gap-1.5"><User size={14} className="text-ink-400" aria-hidden="true" />Datos del cliente para la importación</h3>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon={Copy} onClick={copiarTodo} disabled={cargando || !hayAlgo} title="Copia los datos como texto, para el agente de aduana o un mandato">Copiar todo</Button>
          <IconButton size="sm" icon={RefreshCw} aria-label="Recargar los datos del cliente" title="Recargar (los enlaces a la cédula duran 1 hora)" onClick={() => cargar()} disabled={cargando} />
        </div>
      </div>

      {cargando ? (
        <div className="rounded-md border border-line p-3"><Skeleton.Text lines={3} /></div>
      ) : error ? (
        <ErrorState compact title="No pudimos cargar los datos del cliente" message={error} onRetry={() => cargar()} />
      ) : (
        <div className="rounded-md border border-line">
          {/* ── Estado ── */}
          <div className={cn('flex flex-wrap items-start gap-x-3 gap-y-1.5 px-3 py-2.5 text-13', completo ? 'bg-success-bg' : eleccion ? 'bg-warning-bg' : 'bg-canvas', hayAlgo && 'border-b border-line')}>
            <Badge tone={completo ? 'success' : eleccion ? 'warning' : 'neutral'} dot size="sm" className="mt-px">{completo ? 'Completos' : 'Pendientes'}</Badge>
            <p className="min-w-0 flex-1 text-ink-700">
              {completo ? (
                <>Datos, cédula por ambos lados y Términos aceptados: se puede comprar e importar a su nombre.</>
              ) : !recibido ? (
                eleccion
                  ? <>El cliente aún no completa sus datos. Sin ellos no podemos comprar ni importar a su nombre: se los pedimos en su panel y en el correo de la lancha elegida.</>
                  : <>El cliente aún no completa sus datos. Se los pedimos en su panel al elegir la lancha, antes de confirmar.</>
              ) : (
                <>Faltan: {faltantes.join(', ')}. Sin esto no podemos comprar ni importar a su nombre{eleccion ? '; se lo pedimos en su panel' : ''}.</>
              )}
            </p>
          </div>

          {hayAlgo && (
            <>
              {/* ── Datos ── */}
              <div className="px-3 py-3">
                <DescriptionList
                  cols={3}
                  dense
                  items={campos.map(c => ({
                    key: c.clave,
                    label: c.etiqueta,
                    value: c.valor
                      ? (c.clave === 'fecha_nacimiento' ? <span className="tabular">{fmtDateLarga(fechaSola(c.valor))}</span> : c.clave === 'rut' || c.clave === 'telefono' ? <span className="tabular">{c.valor}</span> : c.valor)
                      : <span className="text-warning">Falta</span>,
                    full: c.clave === 'direccion',
                  })).concat(recibido ? [{
                    key: 'titular',
                    label: 'Se importa a nombre de',
                    value: datos?.datos?.titular_tipo === 'otro'
                      ? <span className="font-medium text-ink-900">{titularTexto(datos.datos)}</span>
                      : 'El cliente (por defecto)',
                    full: true,
                  }] : [])}
                />
              </div>

              {/* ── Cédula ── */}
              <div className="px-3 py-3 border-t border-line">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
                  <p className="text-13 font-medium text-ink-900">Cédula de identidad <span className="font-normal text-ink-500">· privada: el cliente no la ve en sus archivos y el agente de EE. UU. tampoco</span></p>
                </div>
                <ul className="flex flex-wrap gap-3" aria-label="Caras de la cédula">
                  {caras.map(c => (
                    <li key={c.id} className="min-w-0">
                      <CaraCedula
                        cara={c}
                        onVerImagen={() => setLightbox({ items: itemsLightbox, index: Math.max(0, imagenes.findIndex(i => i.id === c.id)) })}
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-500 mt-2">Los enlaces duran 1 hora; recarga si vencen.</p>
              </div>

              {/* ── Términos ── */}
              <div className="flex items-start gap-2 px-3 py-2.5 border-t border-line text-13">
                {terminos.aceptados_at ? (
                  <>
                    <FileCheck size={16} className="shrink-0 mt-0.5 text-success" aria-hidden="true" />
                    <p className="min-w-0 text-ink-700">
                      Aceptó los <a href={terminos.url} target="_blank" rel="noopener" className="text-brand-600 underline underline-offset-2 hover:text-brand-700">Términos</a>
                      {terminos.aceptados_version && <> v{terminos.aceptados_version}</>}
                      {' '}el <time dateTime={terminos.aceptados_at} className="tabular">{fmtDateLarga(terminos.aceptados_at, { hora: true })}</time>
                      {datos?.terminos_ip && <> desde <span className="tabular" title={datos.terminos_navegador || undefined}>{datos.terminos_ip}</span></>}.
                      {terminos.aceptados_version && terminos.version && terminos.aceptados_version !== terminos.version && (
                        <span className="block text-xs text-ink-500 mt-0.5">
                          Los vigentes son la v{terminos.version}. {eleccion ? 'Con la lancha ya elegida, vale la versión que aceptó.' : 'Al elegir se le piden los vigentes.'}
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <CircleAlert size={16} className="shrink-0 mt-0.5 text-warning" aria-hidden="true" />
                    <p className="min-w-0 text-ink-700">Aún no acepta los <a href={terminos.url} target="_blank" rel="noopener" className="text-brand-600 underline underline-offset-2 hover:text-brand-700">Términos</a>{terminos.version ? ` (v${terminos.version})` : ''}.</p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <Lightbox open={!!lightbox} items={lightbox?.items || []} index={lightbox?.index || 0} onIndexChange={i => setLightbox(l => ({ ...l, index: i }))} onClose={() => setLightbox(null)} />
    </section>
  );
}

function esImagen(info) {
  return (info?.mime_type || '').startsWith('image/');
}

/* Una fecha sin hora («1984-03-12») se lee como día local: con new Date()
   sería medianoche UTC y en Chile saldría el día anterior. */
function fechaSola(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : v;
}

/* Qué falta, en palabras: los campos vacíos, cada cara de la cédula y los Términos. */
function faltanDe(datos, campos, conEleccion) {
  if (!datos) return [];
  const f = [];
  const vacios = campos.filter(c => !c.valor).length;
  if (vacios) f.push(vacios === campos.length ? 'los datos' : `${vacios} ${vacios === 1 ? 'dato' : 'datos'} del formulario`);
  if (!datos.ci_frente && !datos.ci_reverso) f.push('la cédula por ambos lados');
  else if (!datos.ci_frente) f.push('el frente de la cédula');
  else if (!datos.ci_reverso) f.push('el reverso de la cédula');
  const t = datos.terminos || {};
  if (!t.aceptados_at) f.push('aceptar los Términos');
  // El servidor exige la versión vigente para dar los datos por completos
  // (con la lancha ya elegida la anterior vale igual, y así se explica abajo).
  else if (t.version && t.aceptados_version !== t.version) f.push(conEleccion ? `los Términos vigentes (v${t.version}; aceptó la v${t.aceptados_version || '?'})` : `aceptar los Términos vigentes (v${t.version})`);
  return f;
}

/* Texto plano con todo, para pegarlo en un mandato o mandárselo al agente de aduana. */
/** A nombre de quién se importa: el cliente (por defecto) u otra persona o empresa. */
function titularTexto(d) {
  return d?.titular_tipo === 'otro' && d?.titular_nombre
    ? `${d.titular_nombre} (RUT ${d.titular_rut})`
    : 'el cliente (por defecto)';
}

function textoParaCopiar({ detail, link, campos, datos }) {
  const lineas = [
    `Datos del cliente · ${detail.order_number || `Expediente ${detail.id}`}${link ? ` · ${tituloLancha(link)}` : ''}`,
    ...campos.map(c => `${c.etiqueta}: ${c.clave === 'fecha_nacimiento' && c.valor ? fmtDate(fechaSola(c.valor)) : (c.valor || '—')}`),
    `Se importa a nombre de: ${titularTexto(datos?.datos)}`,
  ];
  const caras = [datos?.ci_frente && 'frente', datos?.ci_reverso && 'reverso'].filter(Boolean);
  lineas.push(`Cédula de identidad: ${caras.length === 2 ? 'frente y reverso recibidos (en el expediente)' : caras.length === 1 ? `sólo ${caras[0]} recibido` : 'pendiente'}`);
  const t = datos?.terminos || {};
  lineas.push(`Términos y Condiciones: ${t.aceptados_at ? `aceptados${t.aceptados_version ? ` (v${t.aceptados_version})` : ''} el ${fmtDateLarga(t.aceptados_at, { hora: true })}` : 'pendientes'}`);
  return lineas.join('\n');
}

/* Una cara de la cédula: miniatura si es imagen (abre el visor), PDF con
   ícono (se abre en otra pestaña) o un hueco si falta. Debajo, «Abrir» con el
   enlace firmado en pestaña nueva. */
function CaraCedula({ cara, onVerImagen }) {
  const { label, info, url } = cara;
  const base = 'relative block w-36 h-[92px] rounded-md border overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
  if (!info) {
    return (
      <div>
        <div className={cn(base, 'border-dashed border-line-strong bg-canvas flex items-center justify-center text-ink-500')}>
          <span className="text-xs">Falta el {label.toLowerCase()}</span>
        </div>
        <p className="text-xs text-ink-500 mt-1">{label}</p>
      </div>
    );
  }
  const imagen = esImagen(info);
  const meta = [info.file_size ? fmtBytes(info.file_size) : null, info.created_at ? fmtDate(info.created_at) : null].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      {imagen && url ? (
        <button type="button" className={cn(base, 'border-line bg-neutral-bg')} onClick={onVerImagen} aria-label={`Ver el ${label.toLowerCase()} de la cédula`} title={info.original_name}>
          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </button>
      ) : (
        <a href={url || undefined} target="_blank" rel="noopener" className={cn(base, 'border-line bg-neutral-bg flex flex-col items-center justify-center gap-1 text-ink-700 hover:bg-line', !url && 'pointer-events-none')} aria-label={`Abrir el ${label.toLowerCase()} de la cédula (PDF)`} title={info.original_name}>
          <FileText size={20} aria-hidden="true" />
          <span className="text-xs font-medium">PDF</span>
        </a>
      )}
      <p className="flex items-center gap-1.5 text-xs text-ink-500 mt-1 min-w-0">
        <span className="font-medium text-ink-700">{label}</span>
        {meta && <span className="truncate">· {meta}</span>}
        {url && (
          <a href={url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-0.5 text-brand-600 hover:underline shrink-0" aria-label={`Abrir el ${label.toLowerCase()} de la cédula en otra pestaña`}>
            <ExternalLink size={12} aria-hidden="true" />Abrir
          </a>
        )}
      </p>
    </div>
  );
}
