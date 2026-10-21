import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Input, Select, Checkbox, Callout, Button, Skeleton } from '../../../shared/components/UI';
import { Lock, Camera, FileText, CircleCheck, Pencil, ExternalLink, RefreshCw } from '../../../shared/components/Icons';
import {
  CAMPOS_DATOS, ESTADOS_CIVILES, REGIONES_CHILE, TERMINOS_URL, CEDULA_ACEPTA, ORDEN_ERRORES,
  validarDatos, errorArchivoCedula, rutFormato, fechaHaceAnos, fechaLocal, esPdf,
} from '../../../shared/lib/datos-importacion';
import { getImportData, saveImportData } from '../../api';

const VACIO = Object.fromEntries(CAMPOS_DATOS.map(c => [c.id, '']));
const CARAS = [
  { id: 'frente', label: 'Frente', campo: 'ci_frente' },
  { id: 'reverso', label: 'Reverso', campo: 'ci_reverso' },
];

/**
 * Los datos del cliente para importar a su nombre: 10 campos, la cédula por
 * ambos lados y los Términos. Es el mismo formulario en el paso «Tus datos»
 * del asistente y en el modal de «Tu importación» (cuando la elección la
 * marcó el equipo). Lee con GET al montar (o parte de `inicial`), valida
 * como el servidor antes de enviar y guarda con POST multipart.
 *
 * El botón que envía vive fuera (en el pie del modal): `type="submit"
 * form={formId}`. El estado que ese botón necesita sale por `onEstado`:
 * { cargando, enviando, resumen }. Con `resumenSiCompleto`, si los datos ya
 * están, se muestra un resumen con «Editar» en vez del formulario.
 *
 * `borrador` (un ref) guarda lo escrito para que volver un paso atrás no lo
 * pierda. `prefillNombre`/`prefillTelefono` rellenan lo que ya sabemos del
 * expediente cuando aún no hay datos.
 */
export default function FormularioDatos({
  formId, orderId, inicial = null, prefillNombre = '', prefillTelefono = '',
  resumenSiCompleto = false, borrador, onEstado, onCargado, onGuardado,
}) {
  const [carga, setCarga] = useState(() => (inicial ? { data: inicial, error: '' } : { data: null, error: '' }));
  const [valores, setValores] = useState(() => estadoInicial(inicial, prefillNombre, prefillTelefono, borrador).valores);
  const [archivos, setArchivos] = useState(() => estadoInicial(inicial, prefillNombre, prefillTelefono, borrador).archivos);
  const [reusar, setReusar] = useState(() => estadoInicial(inicial, prefillNombre, prefillTelefono, borrador).reusar);
  const [terminos, setTerminos] = useState(() => estadoInicial(inicial, prefillNombre, prefillTelefono, borrador).terminos);
  const [editando, setEditando] = useState(() => !!borrador?.current?.editando);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [intento, setIntento] = useState(0); // reintentar la carga
  const refs = useRef({});
  const avisoRef = useRef(null);

  const data = carga.data;
  const cargando = !data && !carga.error;

  const aplicar = useCallback((d) => {
    const ini = estadoInicial(d, prefillNombre, prefillTelefono, null);
    setCarga({ data: d, error: '' });
    setValores(ini.valores);
    setArchivos(ini.archivos);
    setReusar(ini.reusar);
    setTerminos(ini.terminos);
  }, [prefillNombre, prefillTelefono]);

  // GET al montar, salvo que venga `inicial` (el asistente lo cachea entre pasos).
  useEffect(() => {
    if (inicial) return undefined;
    let activo = true;
    const t = setTimeout(async () => {
      try {
        const d = await getImportData(orderId);
        if (!activo) return;
        if (d?.success === false) throw new Error(d.error || 'No pudimos cargar tus datos');
        aplicar(d);
        onCargado?.(d);
      } catch (e) {
        if (activo) setCarga({ data: null, error: e?.message || 'No pudimos cargar tus datos' });
      }
    }, 0);
    return () => { activo = false; clearTimeout(t); };
  }, [orderId, inicial, intento, aplicar, onCargado]);

  // Lo escrito queda en el borrador del padre (volver un paso atrás no lo pierde).
  useEffect(() => {
    if (borrador) borrador.current = { valores, archivos, reusar, terminos, editando };
  }, [borrador, valores, archivos, reusar, terminos, editando]);

  const mostrarResumen = !!(resumenSiCompleto && data?.completo && !editando);
  useEffect(() => {
    onEstado?.({ cargando, enviando, resumen: mostrarResumen });
  }, [cargando, enviando, mostrarResumen, onEstado]);

  // Vista previa de las fotos recién elegidas (se libera al cambiarlas).
  const previewFrente = useMemo(() => (archivos.frente && !esPdf(archivos.frente) ? URL.createObjectURL(archivos.frente) : null), [archivos.frente]);
  const previewReverso = useMemo(() => (archivos.reverso && !esPdf(archivos.reverso) ? URL.createObjectURL(archivos.reverso) : null), [archivos.reverso]);
  useEffect(() => () => { if (previewFrente) URL.revokeObjectURL(previewFrente); }, [previewFrente]);
  useEffect(() => () => { if (previewReverso) URL.revokeObjectURL(previewReverso); }, [previewReverso]);
  const previews = { frente: previewFrente, reverso: previewReverso };

  if (cargando) {
    return (
      <div aria-busy="true" role="status" className="space-y-4 py-2">
        <span className="sr-only">Cargando tus datos</span>
        <Skeleton.Text lines={2} />
        <Skeleton.Text lines={4} />
      </div>
    );
  }
  if (!data) {
    return (
      <Callout tone="danger" title="No pudimos cargar tus datos" action={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { setCarga({ data: null, error: '' }); setIntento(n => n + 1); }}>Reintentar</Button>}>
        {carga.error}
      </Callout>
    );
  }

  const estados = data.estados_civiles?.length ? data.estados_civiles : ESTADOS_CIVILES;
  const etiquetas = data.campos || {};
  const version = data.terminos?.version || '';
  const urlTerminos = data.terminos?.url || TERMINOS_URL;
  const deOtro = !!data.de_otro_expediente;
  const existente = { frente: data.ci_frente || null, reverso: data.ci_reverso || null };
  // La cédula que ya tenemos sirve tal cual si es de este expediente; si es
  // de otro, sólo mientras el cliente marque «usar la que ya nos enviaste».
  const puedeReusar = deOtro && existente.frente && existente.reverso;
  const cedulaLista = (cara) => !!(archivos[cara] || (existente[cara] && (!deOtro || (puedeReusar && reusar))));
  const terminosCambiaron = !!(data.terminos?.aceptados_version && data.terminos.aceptados_version !== version);

  if (mostrarResumen) {
    return (
      <Resumen data={data} onEditar={() => setEditando(true)} />
    );
  }

  function set(campo, valor) {
    setValores(v => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores(e => ({ ...e, [campo]: undefined }));
  }

  function elegirArchivo(cara, e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const err = errorArchivoCedula(f, cara);
    setErrores(prev => ({ ...prev, [`ci_${cara}`]: err || undefined }));
    if (!err) setArchivos(prev => ({ ...prev, [cara]: f }));
  }

  function enfocarPrimero(errs) {
    const k = ORDEN_ERRORES.find(x => errs[x]);
    const el = refs.current[k];
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      avisoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    const errs = validarDatos(valores, estados);
    for (const c of CARAS) {
      if (errores[c.campo]) errs[c.campo] = errores[c.campo];
      else if (!cedulaLista(c.id)) errs[c.campo] = `Falta la foto del ${c.id} de tu cédula`;
    }
    if (!terminos) errs.terminos = 'Para seguir, acepta los Términos y Condiciones';
    if (Object.keys(errs).length) {
      setErrores(errs);
      setErrorGeneral('Revisa los campos marcados.');
      enfocarPrimero(errs);
      return;
    }
    setErrores({});
    setErrorGeneral('');
    setEnviando(true);
    try {
      const d = await saveImportData(orderId, {
        datos: valores,
        aceptaTerminos: true,
        terminosVersion: version,
        reusarCedula: puedeReusar && reusar,
        ciFrente: archivos.frente,
        ciReverso: archivos.reverso,
      });
      aplicar(d);
      setEditando(false);
      onGuardado?.(d);
    } catch (err) {
      if (err?.errores && Object.keys(err.errores).length) {
        setErrores(err.errores);
        setErrorGeneral(err.status === 400 ? 'Revisa los campos marcados.' : err.message);
        enfocarPrimero(err.errores);
      } else {
        setErrorGeneral(err?.message || 'No pudimos guardar tus datos. Vuelve a intentarlo.');
        avisoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
    setEnviando(false);
  }

  const inputId = (campo) => `${formId}-${campo}`;
  const regiones = REGIONES_CHILE.includes(valores.region) || !valores.region ? REGIONES_CHILE : [valores.region, ...REGIONES_CHILE];

  return (
    <form id={formId} onSubmit={enviar} noValidate className="space-y-5">
      <div ref={avisoRef} className="space-y-3">
        <p className="flex items-start gap-2.5 rounded-lg border border-line bg-canvas px-3.5 py-3 text-13 text-ink-700">
          <Lock size={16} className="mt-0.5 shrink-0 text-ink-500" />
          <span>
            <span className="font-medium text-ink-900">Con esto compramos e importamos la lancha a tu nombre. </span>
            Tu cédula es privada: sólo la ve el equipo que lleva tu operación y no aparece entre tus archivos.
          </span>
        </p>
        {deOtro && (
          <Callout tone="info" title="Usamos los datos de tu importación anterior; revísalos">
            Si algo cambió, corrígelo aquí. {puedeReusar ? 'Tu cédula ya la tenemos: puedes usar la misma o subir otra.' : ''}
          </Callout>
        )}
        {errorGeneral && <Callout tone="danger" title="No pudimos guardar tus datos">{errorGeneral}</Callout>}
      </div>

      <fieldset disabled={enviando} className="min-w-0 space-y-5">
        <legend className="sr-only">Tus datos</legend>

        <section aria-labelledby={`${formId}-h-datos`}>
          <h4 id={`${formId}-h-datos`} className="eyebrow mb-3">Tus datos</h4>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
            {CAMPOS_DATOS.map(c => (
              <Campo
                key={c.id}
                campo={c}
                id={inputId(c.id)}
                label={etiquetas[c.id] || c.label}
                value={valores[c.id] ?? ''}
                error={errores[c.id]}
                estados={estados}
                regiones={regiones}
                onChange={v => set(c.id, v)}
                inputRef={el => { refs.current[c.id] = el; }}
                className={c.ancho === 'full' ? 'sm:col-span-2' : undefined}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby={`${formId}-h-cedula`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 id={`${formId}-h-cedula`} className="eyebrow">Cédula de identidad</h4>
            <p className="text-xs text-ink-500">Una foto nítida de cada lado, o un PDF · hasta 10 MB</p>
          </div>
          {puedeReusar && (
            <Checkbox
              label="Usar la cédula que ya nos enviaste"
              hint={`${existente.frente.original_name} y ${existente.reverso.original_name}, del ${fmtDateLarga(existente.frente.created_at)}`}
              checked={reusar}
              onChange={e => { setReusar(e.target.checked); setErrores(prev => ({ ...prev, ci_frente: undefined, ci_reverso: undefined })); }}
              className="mb-3"
            />
          )}
          {!(puedeReusar && reusar) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {CARAS.map(c => (
                  <TarjetaCedula
                    key={c.id}
                    id={`${formId}-ci-${c.id}`}
                    cara={c.id}
                    label={c.label}
                    archivo={archivos[c.id]}
                    preview={previews[c.id]}
                    existente={!deOtro ? existente[c.id] : null}
                    error={errores[c.campo]}
                    onChange={e => elegirArchivo(c.id, e)}
                    inputRef={el => { refs.current[c.campo] = el; }}
                  />
                ))}
              </div>
              {/* Los errores van debajo de las dos tarjetas, a todo el ancho (en
                  media columna el mensaje se parte en cuatro líneas). */}
              {CARAS.filter(c => errores[c.campo]).map(c => (
                <p key={c.id} id={`${formId}-ci-${c.id}-err`} role="alert" className="mt-1.5 text-xs text-danger">{errores[c.campo]}</p>
              ))}
            </>
          )}
        </section>

        <section aria-labelledby={`${formId}-h-terminos`}>
          <h4 id={`${formId}-h-terminos`} className="eyebrow mb-3">Términos y Condiciones</h4>
          {terminosCambiaron && !terminos && (
            <p className="mb-2 text-13 text-ink-700">Los Términos se actualizaron desde que los aceptaste: léelos y acéptalos de nuevo.</p>
          )}
          <Checkbox
            ref={el => { refs.current.terminos = el; }}
            id={inputId('terminos')}
            label={(
              <>
                Leí y acepto los{' '}
                <a href={urlTerminos} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:text-brand-700 hover:underline">
                  Términos y Condiciones
                  <ExternalLink size={12} aria-hidden="true" />
                  <span className="sr-only">(se abre en una pestaña nueva)</span>
                </a>
                {' '}de Imporlan
              </>
            )}
            hint={version ? `Versión del ${fmtDateLarga(fechaLocal(version))}` : undefined}
            checked={terminos}
            aria-invalid={errores.terminos ? true : undefined}
            aria-describedby={errores.terminos ? inputId('terminos-err') : undefined}
            onChange={e => { setTerminos(e.target.checked); if (e.target.checked) setErrores(prev => ({ ...prev, terminos: undefined })); }}
          />
          {errores.terminos && <p id={inputId('terminos-err')} role="alert" className="mt-1.5 text-xs text-danger">{errores.terminos}</p>}
        </section>
      </fieldset>

      {enviando && (
        <p role="status" className="text-13 text-ink-700">Guardando tus datos y subiendo tu cédula…</p>
      )}
    </form>
  );
}

/* ---------------------------------------------------------------------------
   Estado inicial: lo que mandó el servidor, lo que ya sabemos del expediente
   (nombre y teléfono) y, si hay, el borrador del padre.
   --------------------------------------------------------------------------- */
function estadoInicial(data, prefillNombre, prefillTelefono, borrador) {
  const b = borrador?.current;
  if (b?.valores) return { valores: b.valores, archivos: b.archivos || {}, reusar: !!b.reusar, terminos: !!b.terminos };
  const d = data?.datos && typeof data.datos === 'object' ? data.datos : {};
  const valores = { ...VACIO };
  for (const c of CAMPOS_DATOS) valores[c.id] = String(d[c.id] ?? '');
  if (!valores.nombre && prefillNombre) valores.nombre = String(prefillNombre);
  if (!valores.telefono && prefillTelefono) valores.telefono = String(prefillTelefono);
  const t = data?.terminos || {};
  return {
    valores,
    archivos: {},
    reusar: !!(data?.de_otro_expediente && data?.ci_frente && data?.ci_reverso),
    terminos: !!(t.aceptados_at && t.aceptados_version && t.aceptados_version === t.version),
  };
}

/* ---------------------------------------------------------------------------
   Un campo del formulario, según su tipo.
   --------------------------------------------------------------------------- */
function Campo({ campo, id, label, value, error, estados, regiones, onChange, inputRef, className }) {
  const comunes = { id, label, required: true, error, className, autoComplete: campo.autoComplete || 'off' };
  switch (campo.id) {
    case 'rut':
      return <Input ref={inputRef} {...comunes} value={value} onChange={e => onChange(rutFormato(e.target.value))} placeholder="12.345.678-9" inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={12} inputClassName="tabular" />;
    case 'fecha_nacimiento':
      return <Input ref={inputRef} {...comunes} type="date" value={value} onChange={e => onChange(e.target.value)} min={fechaHaceAnos(110)} max={fechaHaceAnos(18)} inputClassName="tabular" />;
    case 'estado_civil':
      return <Select ref={inputRef} {...comunes} value={value} onChange={e => onChange(e.target.value)} placeholder="Elige…" options={estados.map(s => ({ value: s, label: s }))} />;
    case 'region':
      return <Select ref={inputRef} {...comunes} value={value} onChange={e => onChange(e.target.value)} placeholder="Elige…" options={regiones.map(r => ({ value: r, label: r }))} />;
    case 'telefono':
      return <Input ref={inputRef} {...comunes} type="tel" inputMode="tel" value={value} onChange={e => onChange(e.target.value)} placeholder="+56 9 1234 5678" maxLength={campo.max} inputClassName="tabular" />;
    case 'nacionalidad':
      return <Input ref={inputRef} {...comunes} value={value} onChange={e => onChange(e.target.value)} placeholder="Chilena" maxLength={campo.max} />;
    default:
      return <Input ref={inputRef} {...comunes} value={value} onChange={e => onChange(e.target.value)} maxLength={campo.max} />;
  }
}

/* ---------------------------------------------------------------------------
   Una cara de la cédula: la tarjeta entera es el control (toca para subir o
   cambiar). En el celular abre la cámara o la galería; no se fuerza
   `capture`, que impide elegir de la galería.
   --------------------------------------------------------------------------- */
function TarjetaCedula({ id, cara, label, archivo, preview, existente, error, onChange, inputRef }) {
  const errId = `${id}-err`;
  const hayNuevo = !!archivo;
  const hayExistente = !hayNuevo && !!existente;
  const nombre = hayNuevo ? archivo.name : hayExistente ? existente.original_name : '';
  const pdf = hayNuevo ? esPdf(archivo) : hayExistente ? esPdf(existente) : false;

  let contenido;
  if (hayNuevo && preview) {
    contenido = <img src={preview} alt={`Vista previa del ${cara} de tu cédula`} className="h-full w-full object-cover" />;
  } else if (hayNuevo || hayExistente) {
    contenido = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
        {pdf ? <FileText size={22} className="text-ink-700" /> : <CircleCheck size={22} className="text-success" />}
        <span className="text-13 font-medium text-ink-900">{hayExistente ? 'Recibida' : pdf ? 'PDF listo' : 'Lista'}</span>
        {hayExistente && existente.created_at && <span className="text-xs text-ink-500">{fmtDateLarga(existente.created_at)}</span>}
      </div>
    );
  } else {
    contenido = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Camera size={18} /></span>
        <span className="text-13 font-medium text-ink-900">Subir el {cara}</span>
        <span className="text-xs text-ink-500">Foto o PDF</span>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={CEDULA_ACEPTA}
        className="peer sr-only"
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        aria-label={`${label} de tu cédula de identidad`}
      />
      <label
        htmlFor={id}
        className={cn(
          'block cursor-pointer overflow-hidden rounded-lg border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
          hayNuevo || hayExistente ? 'border-success-line bg-success-bg' : 'border-dashed border-line-strong bg-canvas hover:border-brand-500 hover:bg-brand-50',
          error && 'border-danger',
        )}
      >
        <span className="flex items-center justify-between gap-2 px-3 pt-2.5">
          <span className="text-13 font-semibold text-ink-900">{label}</span>
          {(hayNuevo || hayExistente) && <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600"><Pencil size={12} /> Cambiar</span>}
        </span>
        <span className={cn('mt-2 block h-28 w-full', hayNuevo && preview && 'bg-neutral-bg')}>{contenido}</span>
        {nombre && <span className="block truncate border-t border-success-line px-3 py-1.5 text-xs text-ink-700" title={nombre}>{nombre}</span>}
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Resumen cuando ya está todo (por ejemplo, al volver a elegir).
   --------------------------------------------------------------------------- */
function Resumen({ data, onEditar }) {
  const d = data.datos || {};
  const t = data.terminos || {};
  return (
    <div className="rounded-lg border border-success-line bg-success-bg px-4 py-3.5" role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <CircleCheck size={18} className="shrink-0 text-success" />
            Tus datos ya están
          </p>
          <ul className="mt-2 space-y-1 text-13 text-ink-700">
            <li>{[d.nombre, d.rut && `RUT ${d.rut}`].filter(Boolean).join(' · ')}</li>
            <li>Cédula recibida, frente y reverso</li>
            <li>Términos aceptados{t.aceptados_at ? ` el ${fmtDateLarga(t.aceptados_at)}` : ''}</li>
          </ul>
        </div>
        <Button variant="secondary" size="sm" icon={Pencil} onClick={onEditar}>Editar</Button>
      </div>
    </div>
  );
}
