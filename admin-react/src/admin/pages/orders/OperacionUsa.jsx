import { FileImage } from '../../../shared/components/FileImage';
import { FileOpen } from '../../../shared/components/FileDownload';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../../shared/lib/format';
import { Button, Menu, Badge, Callout, EmptyState, ErrorState, Skeleton, Modal, Textarea, MoneyInput, Lightbox, useConfirm } from '../../../shared/components/UI';
import { Send, Copy, ExternalLink, RefreshCw, Globe, Video, Image as ImageIcon, FileText, File as FileIcon, Paperclip } from '../../../shared/components/Icons';
import { useToast } from '../../../shared/components/Toast';
import { hitoPorId } from '../../../shared/lib/importacion';
import { getOperacionUsa, pedirActualizacionUsa, compartirActualizacionUsa, nuevoLinkUsa, revisarPrecioInspeccion, conservarPrecioAcordado } from '../../api';
import { categoriaArchivo } from '../../components/useExpedienteFiles';

/**
 * Operación en EE. UU.: lo que manda David Morris (api/operador_usa.php).
 * A él le llegan correos solos (al elegir, al pagar el Pago 1, con cada hito
 * de su lado) con un link privado donde escribe una nota y sube fotos, videos
 * o PDF. Las fotos y videos los ve el cliente al tiro; la nota y los PDF
 * quedan para el equipo, que decide qué contarle al cliente, en español, con
 * «Compartir con el cliente». David y el cliente nunca se hablan.
 *
 * Sólo lo ven admin y soporte (el servidor lo exige). `archivos` es el
 * resultado de useExpedienteFiles: las miniaturas salen de ahí por id.
 */
export default function OperacionUsa({ detail, eleccion, archivos, onRecargarDetalle, onCotizarAprobado }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalPedir, setModalPedir] = useState(false);
  const [compartiendo, setCompartiendo] = useState(null); // la actualización a compartir
  const [lightbox, setLightbox] = useState(null); // { items, index }

  // Se relee cuando cambian la lancha o los hitos: cada uno de esos le manda
  // un correo a David y mueve «le pedimos hace…».
  const clave = `${detail.id}|${eleccion?.link_id || 0}|${Object.keys(eleccion?.steps || {}).join(',')}`;
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const r = await getOperacionUsa(detail.id);
      setEstado(r);
      setError('');
    } catch (e) {
      setError(e.message || 'No se pudo cargar la operación en EE. UU.');
    }
    setCargando(false);
  }, [detail.id]);
  useEffect(() => {
    const t = setTimeout(cargar, 0);
    return () => clearTimeout(t);
  }, [cargar, clave]);

  const operador = estado?.operador?.nombre || 'David Morris';
  const nombre = operador.split(' ')[0];
  const hito = hitoPorId(estado?.hito_en_curso);
  const updates = estado?.updates || [];
  const porId = new Map((archivos?.files || []).map(f => [Number(f.id), f]));

  async function copiarLink() {
    if (!estado?.portal_url) return;
    try {
      await navigator.clipboard.writeText(estado.portal_url);
      toast?.(`Link de ${nombre} copiado`, 'success');
    } catch {
      toast?.({ type: 'error', title: 'No se pudo copiar', description: 'Ábrelo desde el menú y copia la dirección del navegador.' });
    }
  }

  async function generarLink() {
    if (!(await confirm({
      title: `¿Generar un link nuevo para ${nombre}?`,
      description: 'El link anterior deja de funcionar al instante. El próximo correo automático ya lleva el nuevo; si lo tenía guardado, mándaselo.',
      tone: 'warning',
      confirmLabel: 'Generar link nuevo',
    }))) return;
    try {
      const r = await nuevoLinkUsa(detail.id);
      setEstado(prev => ({ ...prev, portal_url: r.portal_url }));
      toast?.('Link nuevo generado. El anterior ya no funciona.', 'success');
    } catch (e) { toast?.(e.message || 'No se pudo generar el link', 'error'); }
  }

  async function pedir(mensaje) {
    try {
      await pedirActualizacionUsa(detail.id, mensaje);
      toast?.(`Le escribimos a ${operador}`, 'success');
      await cargar({ silencioso: true });
      return true;
    } catch (e) {
      toast?.({ type: 'error', title: `No se pudo escribir a ${nombre}`, description: e.message || '' });
      return false;
    }
  }

  async function compartir(update, texto) {
    try {
      await compartirActualizacionUsa(update.id, texto);
      toast?.('Compartida con el cliente. Le llega correo y aviso en su panel.', 'success');
      await cargar({ silencioso: true });
      archivos?.recargar?.();
      return true;
    } catch (e) {
      toast?.({ type: 'error', title: 'No se pudo compartir', description: e.message || '' });
      return false;
    }
  }

  const abrirImagen = (items, index) => setLightbox({ items, index });

  return (
    <section id="operacion-usa" aria-labelledby="importacion-usa" className="exp-operation-usa scroll-mt-32">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-2">
        <h3 id="importacion-usa" className="eyebrow flex items-center gap-1.5"><Globe size={14} className="text-ink-400" aria-hidden="true" />Operación en EE. UU.</h3>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon={Send}
            onClick={() => setModalPedir(true)}
            disabled={!estado || !!estado.inspection_upload?.owns_stage || (!!estado.inspection_price && !estado.inspection_price.ready)}
            title={estado?.inspection_price && !estado.inspection_price.ready
              ? 'La confirmación de precio tiene seguimiento automático. Revisa la respuesta en el bloque de precio antes de continuar.'
              : estado?.inspection_upload?.owns_stage
              ? estado.inspection_upload.status === 'completed'
                ? 'Entrega resuelta; el equipo debe continuar la revisión'
                : 'El seguimiento de esta entrega es automático. Se solicitan sólo los requisitos pendientes, una vez al día por la mañana.'
              : undefined}
          >Pedir actualización</Button>
          <Button size="sm" variant="ghost" icon={Copy} onClick={copiarLink} disabled={!estado?.portal_url} aria-label={`Copiar link de ${nombre}`}>
            <span className="sr-only sm:not-sr-only">Copiar link de {nombre}</span>
          </Button>
          <Menu
            label="Más acciones de la operación en EE. UU."
            items={[
              { label: `Abrir el link de ${nombre}`, icon: ExternalLink, href: estado?.portal_url, disabled: !estado?.portal_url },
              { separator: true },
              { label: 'Generar link nuevo', icon: RefreshCw, onClick: generarLink, disabled: !estado },
            ]}
          />
        </div>
      </div>

      {cargando ? (
        <div className="rounded-md border border-line p-3"><Skeleton.Text lines={3} /></div>
      ) : error ? (
        <ErrorState compact title="No pudimos cargar la operación en EE. UU." message={error} onRetry={() => cargar()} />
      ) : (
        <div className="space-y-3">
          {/* ── Estado ── */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 rounded-md border border-line bg-canvas px-3 py-2.5 text-13">
            <div className="min-w-0">
              <dt className="text-xs text-ink-500">Quién</dt>
              <dd className="text-ink-900 font-medium truncate" title={estado?.operador?.email || undefined}>{operador}</dd>
              <dd className="text-xs text-ink-500">Operador en EE. UU. · sin contacto con el cliente</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-500">Le pedimos</dt>
              <dd className="text-ink-900">
                {estado?.requested_at
                  ? <>una actualización <time dateTime={estado.requested_at} title={fmtDateLarga(estado.requested_at, { hora: true })}>{fmtRelativo(estado.requested_at)}</time></>
                  : 'todavía nada'}
              </dd>
              <dd className="text-ink-900">
                {estado?.updated_at
                  ? <>Última actualización <time dateTime={estado.updated_at} title={fmtDateLarga(estado.updated_at, { hora: true })}>{fmtRelativo(estado.updated_at)}</time></>
                  : <span className="text-ink-500">Aún no manda nada</span>}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-500">Turno</dt>
              <dd>
                {estado?.es_de_usa
                  ? <Badge tone="info" dot size="sm">Le toca a EE. UU.</Badge>
                  : <Badge tone="neutral" size="sm">Lo que sigue es en Chile</Badge>}
              </dd>
              {hito && <dd className="text-ink-900 mt-0.5 truncate">{hito.enCursoCorto}</dd>}
              {!hito && eleccion && <dd className="text-ink-500 mt-0.5">Importación completa</dd>}
            </div>
          </dl>

          {estado?.inspection_upload && (
            <RequisitosInspeccion
              carga={estado.inspection_upload}
              nombre={nombre}
              onRefresh={() => cargar({ silencioso: true })}
            />
          )}
          {estado?.inspection_price && (
            <PrecioTrasInspeccion pago1Pagado={estado.pago1_pagado === true} puedeAprobar={estado.can_approve_price === true} onCotizarAprobado={onCotizarAprobado} precio={estado.inspection_price} nombre={nombre} orderId={detail.id} clienteAprobo={!!eleccion?.inspection_waiting_price} onRefresh={() => cargar({ silencioso: true })} onRecargarDetalle={onRecargarDetalle} />
          )}

          {/* ── Feed ── */}
          {updates.length === 0 ? (
            <EmptyState
              compact
              icon={Paperclip}
              title={`${nombre} todavía no manda actualizaciones`}
              description="Le llegan correos solos con cada hito de su lado y un recordatorio si pasan días sin novedades. También puedes pedirle una ahora."
            />
          ) : (
            <ol className="exp-usa-updates rounded-md border border-line divide-y divide-line">
              {updates.map(u => (
                <Actualizacion
                  key={u.id}
                  update={u}
                  nombre={nombre}
                  porId={porId}
                  cargandoArchivos={!!archivos?.loading}
                  onCompartir={() => setCompartiendo(u)}
                  onVerImagen={abrirImagen}
                />
              ))}
            </ol>
          )}
        </div>
      )}

      {modalPedir && (
        <ModalPedirUsa open onClose={() => setModalPedir(false)} operador={operador} hito={hito} esDeUsa={!!estado?.es_de_usa} onEnviar={pedir} />
      )}
      {compartiendo && (
        <ModalCompartirUsa open onClose={() => setCompartiendo(null)} update={compartiendo} nombre={nombre} porId={porId} onCompartir={compartir} />
      )}
      <Lightbox open={!!lightbox} items={lightbox?.items || []} index={lightbox?.index || 0} onIndexChange={i => setLightbox(l => ({ ...l, index: i }))} onClose={() => setLightbox(null)} />
    </section>
  );
}

function PrecioTrasInspeccion({ precio, nombre, orderId, onRefresh, onRecargarDetalle, clienteAprobo, puedeAprobar, onCotizarAprobado, pago1Pagado }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [aprobado, setAprobado] = useState(null);
  const [nota, setNota] = useState('');
  const [versionRevisada, setVersionRevisada] = useState(null);
  const [conservando, setConservando] = useState(false);
  const [corregirAviso, setCorregirAviso] = useState(false);
  async function conservar() {
    if (!puedeAprobar || saving || !precio.agreement) return;
    setSaving(true);
    try { const r=await conservarPrecioAcordado(orderId,precio,corregirAviso); setConservando(false); toast?.(r.email_sent ? 'Acuerdo conservado. Corrección del Pago 2 enviada.' : 'Precios conservados y correos de validación desactivados para esta operación.', 'success'); await onRefresh(); onRecargarDetalle?.(); }
    catch(e) { toast?.(e.message,'error'); }
    finally { setSaving(false); }
  }
  const labels = { pending: 'Pendiente de respuesta', negotiating: 'En negociación', unchanged: 'Propuesta sin cambio', adjusted: 'Propuesta reajustada' };
  const money = cents => cents == null ? 'Por confirmar' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(cents / 100);
  function abrirRevision() {
    setAprobado((precio.ready ? precio.approved_cents : precio.confirmed_cents) / 100);
    setNota(precio.ready ? precio.approval_note || '' : '');
    setVersionRevisada({ requestId: precio.request_id, revision: precio.revision, approvalVersion: precio.approval_version, proposedCents: precio.confirmed_cents });
    setRevisando(true);
  }
  async function revisar() {
    if (!puedeAprobar || saving || !versionRevisada || !(aprobado > 0)) return;
    setSaving(true);
    try {
      const r = await revisarPrecioInspeccion(orderId, versionRevisada.requestId, versionRevisada.revision, Number(aprobado).toFixed(2), versionRevisada.approvalVersion, nota);
      setRevisando(false);
      toast?.(r?.inspeccion_aprobada
        ? (r.pago ? 'Aprobación guardada. Como el cliente ya aprobó el reporte, se continuó la inspección y el Pago 2 con la cotización publicada.' : 'Aprobación guardada. El cliente ya aprobó el reporte; revisa los cobros de la operación.')
        : 'Valor aprobado por Juan Pablo. La cotización del cliente mantiene su versión publicada.', 'success');
      await onRefresh();
      if (r?.inspeccion_aprobada) onRecargarDetalle?.();
    } catch (e) { toast?.(e.message || 'No se pudo guardar la aprobación', 'error'); }
    finally { setSaving(false); }
  }
  return (
    <section aria-labelledby="inspection-price-title" className="rounded-lg border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="inspection-price-title" className="text-sm font-semibold text-ink-900">Precio de compra tras la inspección</h4>
        <Badge tone={precio.ready ? 'success' : 'warning'} size="sm">{precio.retained ? 'Acuerdo conservado' : precio.ready ? 'Aprobado por Juan Pablo' : precio.confirmed ? puedeAprobar ? 'Pendiente de tu aprobación' : 'Pendiente de Juan Pablo' : labels[precio.status] || 'Por confirmar'}</Badge>
      </div>
      {precio.retained && <Callout tone={precio.ready ? 'info' : 'warning'} compact>Se conservan los precios acordados. Los correos de validación de precio están desactivados sólo para esta operación.{!precio.ready && ' La cotización cambió después: vuelve a revisar el acuerdo.'}</Callout>}
      <p className="text-13 text-ink-500">{nombre} envía una propuesta interna. Sólo Juan Pablo puede aprobarla o editar el valor; el cliente no recibe esta respuesta.</p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-13">
        <div><dt className="text-ink-500">Precio anterior informado · USD</dt><dd className="font-medium text-ink-900 tabular">{money(precio.original_cents)}</dd></div>
        <div><dt className="text-ink-500">Propuesta de {nombre} · USD</dt><dd className="font-medium text-ink-900 tabular">{money(precio.confirmed_cents)}</dd></div>
        <div><dt className="text-ink-500">Valor aprobado por Juan Pablo · USD</dt><dd className="font-semibold text-brand-700 tabular">{precio.ready ? money(precio.approved_cents) : 'Pendiente de aprobación'}</dd></div>
      </dl>
      {precio.reason && <div><p className="text-xs text-ink-500 mb-1">Hallazgo, acuerdo o negociación · texto original del coordinador</p><p lang="en" className="text-sm text-ink-700 whitespace-pre-wrap break-words">{precio.reason}</p></div>}
      {precio.ready && precio.approval_note && <p className="text-13 text-ink-700 whitespace-pre-wrap">Nota de aprobación: {precio.approval_note}</p>}
      <Callout tone={precio.ready ? 'info' : 'warning'} compact>
        {precio.retained ? 'Se mantienen los precios de la cotización vigente, sin solicitar otra confirmación al coordinador.' : precio.ready ? 'La propuesta ya tiene tu aprobación. Para usar ese valor en la cotización del cliente, revísala y guárdala desde el cotizador.' : precio.confirmed ? 'Propuesta recibida. Falta que Juan Pablo apruebe este precio o ingrese un valor distinto antes de continuar.' : 'Se solicita confirmación al coordinador con seguimiento diario AM de Chile hasta recibir su propuesta.'}
        {' '}La respuesta de {nombre} no publica precios ni modifica cotizaciones o cobros.
      </Callout>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-xs text-ink-500">{precio.last_sent_at ? `Último correo: ${fechaAvisoInspeccion(precio.last_sent_at)}` : 'Primer correo pendiente del seguimiento automático'}</p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={saving}>Actualizar respuesta</Button>
          {puedeAprobar && precio.confirmed && !precio.retained && <Button size="sm" variant="secondary" onClick={abrirRevision} disabled={saving}>{precio.ready ? 'Editar valor aprobado' : 'Revisar y aprobar precio'}</Button>}
          {puedeAprobar && precio.agreement && (!precio.retained || !precio.ready || clienteAprobo) && <Button size="sm" variant="secondary" onClick={() => setConservando(true)} disabled={saving}>Conservar precios acordados</Button>}
          {puedeAprobar && precio.ready && onCotizarAprobado && <Button size="sm" onClick={() => onCotizarAprobado(precio.approved_cents / 100)}>Usar valor aprobado en cotizador</Button>}
        </div>
      </div>
      <Modal open={conservando} onClose={() => !saving && setConservando(false)} title="Conservar el acuerdo de esta operación" size="sm" footer={<><Button variant="secondary" disabled={saving} onClick={() => setConservando(false)}>Cancelar</Button><Button loading={saving} onClick={conservar}>Conservar precios y desactivar validación</Button></>}>
        <div className="space-y-3 text-sm"><p>Se mantiene el precio de compra de la cotización publicada: <strong>{money(precio.agreement?.cents)}</strong>. No se recalculan los precios ni los porcentajes de los pagos.</p><p>Se detienen los correos de validación de precio de esta lancha. Los avisos de pago y las demás operaciones conservan su seguimiento.</p>{clienteAprobo && <p>{pago1Pagado ? `El cliente ya aprobó la inspección: se habilitará el Pago 2 de ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(precio.agreement?.p2_clp || 0)} con la cotización vigente.` : 'Primero debe registrarse el Pago 1 ya realizado. Ahora se conservarán los precios sin crear otro cobro.'}</p>}{clienteAprobo && pago1Pagado && <label className="flex items-start gap-2"><input type="checkbox" checked={corregirAviso} onChange={e => setCorregirAviso(e.target.checked)} />Corregir el correo anterior: confirmar que el Pago 1 ya fue realizado y solicitar el Pago 2.</label>}</div>
      </Modal>
      {!puedeAprobar && precio.confirmed && <p className="text-xs text-ink-500">La aprobación y edición están reservadas a la cuenta principal de Juan Pablo.</p>}
      <Modal open={revisando} onClose={() => !saving && setRevisando(false)} title="Aprobar precio de compra" description="Revisa la propuesta e ingresa el valor que tú apruebas." size="md" footer={<>
        <Button variant="secondary" onClick={() => setRevisando(false)} disabled={saving}>Cancelar</Button>
        <Button onClick={revisar} loading={saving} disabled={!(aprobado > 0)}>Guardar aprobación</Button>
      </>}>
        <div className="space-y-4">
          <p className="text-sm text-ink-700">Propuesta de {nombre}: <strong>{money(versionRevisada?.proposedCents)}</strong>. Se conserva como antecedente, aunque apruebes otro importe.</p>
          <MoneyInput currency="USD" label="Valor que apruebas · USD" value={aprobado} onChange={setAprobado} required hint="Puedes aceptar la propuesta o editar el valor antes de aprobar." />
          <Textarea label="Nota de aprobación" value={nota} onChange={e => setNota(e.target.value)} maxLength={2000} rows={3} hint="Interna. No se envía al cliente ni a David." />
          <Callout tone="info" compact>Esta aprobación no publica ni modifica la cotización. El cliente sólo verá el valor que tú guardes y publiques en el cotizador.</Callout>
          {clienteAprobo && <Callout tone="warning" compact>El cliente ya aprobó el reporte. Al guardar esta aprobación se continuará la inspección y el Pago 2 con la cotización publicada.</Callout>}
        </div>
      </Modal>
    </section>
  );
}

const REQUISITOS_INSPECCION = [
  { key: 'report', label: 'Informe PDF', icon: FileText },
  { key: 'photos', label: 'Fotografías', icon: ImageIcon },
  { key: 'videos', label: 'Videos', icon: Video },
];

// Las fechas de seguimiento se guardan en UTC; el recordatorio se programa
// según el calendario de Chile, aunque el administrador esté en otro país.
function fechaAvisoInspeccion(value) {
  const raw = String(value || '');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

/** La entrega de archivos se comprueba por tipo, sin confundir el número de
 * adjuntos de una actualización con una inspección completa. Los motivos se
 * muestran sólo aquí, en la vista privada del equipo. */
function RequisitosInspeccion({ carga, nombre, onRefresh }) {
  const requisitos = REQUISITOS_INSPECCION.map(item => {
    const detail = carga.requirements?.[item.key];
    const received = !!(detail?.received ?? carga.received?.[item.key]);
    const exception = !received && detail?.exception?.reason?.trim() ? detail.exception : null;
    return { ...item, received, exception, resolved: received || !!exception, count: detail?.count, files: detail?.files || [] };
  });
  const recibidos = requisitos.filter(item => item.received).length;
  const resueltos = requisitos.filter(item => item.resolved).length;
  const faltantes = requisitos.filter(item => !item.resolved);
  const conMotivos = requisitos.some(item => item.exception);
  const completa = carga.status === 'completed';

  return (
    <section aria-labelledby="requisitos-inspeccion" className="rounded-md border border-line bg-surface overflow-hidden">
      <div className="px-3 py-3 border-b border-line space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 id="requisitos-inspeccion" className="text-sm font-semibold text-ink-900">Carga de inspección</h4>
            <p role="status" aria-live="polite" className="text-xs text-ink-500 mt-0.5">{recibidos} de 3 tipos recibidos · {resueltos} de 3 requisitos resueltos</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={completa ? (conMotivos ? 'warning' : 'success') : 'info'} size="sm">
              {completa ? (conMotivos ? 'Resuelta con motivos' : 'Carga completa') : 'En seguimiento'}
            </Badge>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRefresh} aria-label="Actualizar requisitos de inspección">
              <span className="sr-only sm:not-sr-only">Actualizar</span>
            </Button>
          </div>
        </div>
        <div role="progressbar" aria-label="Requisitos de inspección resueltos" aria-valuemin={0} aria-valuemax={3} aria-valuenow={resueltos} className="h-1.5 rounded-full bg-line overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-200', completa && !conMotivos ? 'bg-success' : 'bg-brand-600')} style={{ width: `${resueltos / 3 * 100}%` }} />
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3">
        {requisitos.map(item => {
          const { key, label, icon: Icon, received, exception, count, files } = item;
          return (
          <li key={key} className="min-w-0 rounded-md border border-line bg-canvas px-3 py-2.5">
            <div className="flex items-center gap-2 text-ink-700">
              <Icon size={16} aria-hidden="true" className="shrink-0 text-ink-500" />
              <h5 className="text-13 font-medium">{label}</h5>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
              <Badge tone={received ? 'success' : exception ? 'warning' : 'neutral'} size="sm">
                {received ? 'Recibido' : exception ? 'No disponible' : 'Pendiente'}
              </Badge>
              {received && Number.isInteger(count) && <span className="text-xs text-ink-500 tabular">{count} archivo{count === 1 ? '' : 's'}</span>}
            </div>
            {received && files.length > 0 && (
              <details className="mt-2 text-xs text-ink-500">
                <summary className="cursor-pointer rounded-sm text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">Ver archivos recibidos</summary>
                <ul className="mt-1.5 max-h-28 overflow-y-auto space-y-1">
                  {files.map(file => <li key={file.id} className="break-words" title={file.mime_type}>{file.original_name}</li>)}
                </ul>
              </details>
            )}
            {exception && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-ink-700">Motivo registrado · Sólo equipo</p>
                <p className="text-13 text-ink-700 whitespace-pre-wrap break-words">{exception.reason}</p>
                {exception.created_at && <time className="block text-xs text-ink-500" dateTime={exception.created_at}>{fechaAvisoInspeccion(exception.created_at)} · Chile</time>}
              </div>
            )}
            {!received && !exception && <p className="mt-2 text-xs text-ink-500">Falta cargar este material o explicar por qué no está disponible.</p>}
          </li>
          );
        })}
      </ul>

      <div className="border-t border-line px-3 py-2.5 space-y-1.5">
        {completa ? (
          <p className="text-13 text-ink-700">El seguimiento de carga terminó. El equipo puede continuar la revisión de la inspección{conMotivos ? ' considerando los motivos registrados' : ''}.</p>
        ) : (
          <>
            <p className="text-13 text-ink-700"><span className="font-medium">Falta resolver:</span> {faltantes.map(item => item.label).join(', ') || 'comprobando la entrega'}.</p>
            <p className="text-xs text-ink-500">El sistema le pide a {nombre} sólo los requisitos pendientes, una vez al día por la mañana (hora de Chile). Puede cargarlos o registrar el motivo si no están disponibles.</p>
          </>
        )}
        {carga.last_sent_at && <p className="text-xs text-ink-500">Último aviso: <time dateTime={carga.last_sent_at}>{fechaAvisoInspeccion(carga.last_sent_at)}</time> · hora de Chile</p>}
      </div>
    </section>
  );
}

/* Una actualización: fecha, nota (interna, en inglés), sus archivos y si ya
   se compartió con el cliente. */
function Actualizacion({ update: u, nombre, porId, cargandoArchivos, onCompartir, onVerImagen }) {
  const archivos = (u.file_ids || []).map(id => porId.get(Number(id)) || { id, faltante: true });
  const imagenes = archivos.filter(f => !f.faltante && categoriaArchivo(f) === 'image');
  const items = imagenes.map(f => ({ src: f.download_url, alt: f.original_name, caption: `${f.original_name} · ${nombre}, ${fmtDateLarga(u.created_at)}`, downloadUrl: f.download_url }));
  const compartida = !!u.shared_at || !!(u.shared_text || '').trim();
  return (
    <li className="px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
        <time dateTime={u.created_at} className="tabular text-ink-700 font-medium">{fmtDateLarga(u.created_at, { hora: true })}</time>
        <span aria-hidden="true">·</span>
        <span>{nombre}</span>
        {archivos.length > 0 && <><span aria-hidden="true">·</span><span>{archivos.length} archivo{archivos.length === 1 ? '' : 's'}</span></>}
        {compartida
          ? <Badge tone="success" dot size="sm" className="ml-auto">Compartida con el cliente</Badge>
          : <Badge tone="neutral" size="sm" className="ml-auto">Sin compartir</Badge>}
      </div>

      {(u.note || '').trim() ? (
        <div className="flex items-start gap-2">
          <Badge tone="neutral" size="sm" className="shrink-0 mt-0.5" title="La nota es para el equipo; el cliente no la ve">Interna</Badge>
          <p lang="en" className="text-sm text-ink-700 whitespace-pre-wrap break-words min-w-0">{u.note}</p>
        </div>
      ) : (
        <p className="text-13 text-ink-500">{archivos.length ? 'Sin nota: sólo mandó archivos.' : 'Sin nota adicional. Revisa los motivos registrados en los requisitos de inspección.'}</p>
      )}

      {archivos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Archivos de la actualización del ${fmtDateLarga(u.created_at)}`}>
          {archivos.map(f => (
            <li key={f.id}>
              <Miniatura f={f} cargando={cargandoArchivos} onVerImagen={() => onVerImagen(items, imagenes.findIndex(i => i.id === f.id))} />
            </li>
          ))}
        </ul>
      )}

      {compartida ? (
        <blockquote className="text-sm text-ink-700 border-l-2 border-success bg-success-bg rounded-r-md px-3 py-2">
          <span className="block text-xs text-ink-500 mb-0.5">
            Lo que le contamos al cliente{u.shared_at && <> · <time dateTime={u.shared_at} title={fmtDateLarga(u.shared_at, { hora: true })}>{fmtDateLarga(u.shared_at)}</time></>}
          </span>
          <span className="whitespace-pre-wrap break-words">{u.shared_text}</span>
        </blockquote>
      ) : (
        <div>
          <Button size="sm" variant="secondary" icon={Send} onClick={onCompartir}>Compartir con el cliente</Button>
        </div>
      )}
    </li>
  );
}

/* Miniatura de un archivo: imagen (abre el visor), video o PDF (abren en
   otra pestaña). Los que el cliente no ve llevan «Sólo equipo». */
function Miniatura({ f, cargando, onVerImagen }) {
  const base = 'exp-usa-file relative block w-24 h-16 rounded-md border border-line overflow-hidden bg-neutral-bg text-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
  if (f.faltante) {
    return (
      <div className={cn(base, 'flex items-center justify-center')} title={cargando ? 'Cargando archivo…' : 'Archivo eliminado'}>
        {cargando ? <span className="h-2 w-12 rounded-sm bg-line" aria-hidden="true" /> : <span className="text-xs">Eliminado</span>}
      </div>
    );
  }
  const cat = categoriaArchivo(f);
  const interno = Number(f.visible_to_client ?? 1) === 0;
  const chip = interno && <Badge tone="neutral" size="sm" className="absolute left-1 bottom-1">Sólo equipo</Badge>;
  if (cat === 'image') {
    return (
      <button type="button" className={base} onClick={onVerImagen} aria-label={`Ver ${f.original_name}`} title={f.original_name}>
        <FileImage src={f.download_url} mimeType={f.mime_type} originalName={f.original_name} alt="" className="w-full h-full object-cover" loading="lazy" />
        {chip}
      </button>
    );
  }
  const Icono = cat === 'video' ? Video : cat === 'document' ? FileText : FileIcon;
  const etiqueta = cat === 'video' ? 'Video' : cat === 'document' ? (/\.pdf$/i.test(f.original_name || '') ? 'PDF' : 'Documento') : 'Archivo';
  return (
    <FileOpen file={f} label={`Abrir ${f.original_name}`} className={cn(base, 'flex flex-col items-center justify-center gap-1 px-1 text-ink-700 hover:bg-line')}>
      <Icono size={18} aria-hidden="true" />
      {interno ? chip && <Badge tone="neutral" size="sm">Sólo equipo</Badge> : <span className="text-xs font-medium max-w-full truncate">{etiqueta}</span>}
    </FileOpen>
  );
}

/* «Pedir actualización»: un correo en inglés a David, con mensaje opcional. */
function ModalPedirUsa({ open, onClose, operador, hito, esDeUsa, onEnviar }) {
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const nombre = operador.split(' ')[0];

  async function enviar() {
    setEnviando(true);
    try {
      const ok = await onEnviar(mensaje.trim());
      if (ok) onClose();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={enviando ? undefined : onClose}
      title={`Pedir una actualización a ${nombre}`}
      description="Le llega un correo en inglés con su link privado y lo que toca según el hito en curso. Sin datos del cliente ni precios."
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={enviar} loading={enviando} icon={Send}>Enviar a {nombre}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {hito ? (
          <Callout tone={esDeUsa ? 'info' : 'warning'} compact>
            {esDeUsa
              ? <>Lo que le pedimos ahora: <span className="font-medium">{hito.enCursoCorto.toLowerCase()}</span>, con fotos o videos recientes.</>
              : <>Lo que sigue («{hito.corto}») es en Chile. Igual puedes pedirle fotos o documentos que falten.</>}
          </Callout>
        ) : (
          <Callout tone="neutral" compact>La importación ya está completa. Igual puedes pedirle algo puntual.</Callout>
        )}
        <Textarea
          label={`Mensaje para ${nombre} (opcional)`}
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          rows={4}
          maxLength={2000}
          showCount
          lang="en"
          placeholder="Could you send a short walk-around video of the engine running?"
          hint="Escríbelo en inglés: va tal cual en el correo. Si lo dejas vacío, le pedimos sólo lo del hito en curso."
          data-autofocus
        />
      </div>
    </Modal>
  );
}

/* «Compartir con el cliente»: la nota de David como referencia y el texto en
   español que el cliente va a leer. */
function ModalCompartirUsa({ open, onClose, update: u, nombre, porId, onCompartir }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const archivos = (u.file_ids || []).map(id => porId.get(Number(id))).filter(Boolean);
  const visibles = archivos.filter(f => Number(f.visible_to_client ?? 1) === 1).length;
  const internos = archivos.length - visibles;

  async function compartir() {
    if (!texto.trim()) { setError('Escribe lo que le contamos al cliente: es lo que va a leer.'); return; }
    setError('');
    setGuardando(true);
    try {
      const ok = await onCompartir(u, texto.trim());
      if (ok) onClose();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={guardando ? undefined : onClose}
      title="Compartir con el cliente"
      description="Se lo contamos en español, con nuestras palabras. El cliente no ve la nota ni sabe quién la mandó."
      size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={compartir} loading={guardando} icon={Send}>Compartir</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-canvas px-3 py-2.5">
          <p className="text-xs text-ink-500 mb-1">
            Nota de {nombre} · <time dateTime={u.created_at}>{fmtDateLarga(u.created_at, { hora: true })}</time> · interna, en inglés
          </p>
          {(u.note || '').trim()
            ? <p lang="en" className="text-sm text-ink-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto scrollbar-thin">{u.note}</p>
            : <p className="text-13 text-ink-500">{archivos.length ? 'Sin nota: sólo mandó archivos.' : 'Sin nota adicional. Revisa los motivos registrados en los requisitos de inspección.'}</p>}
          {archivos.length > 0 && (
            <p className="text-xs text-ink-500 mt-1.5">
              {archivos.length} archivo{archivos.length === 1 ? '' : 's'}
              {visibles > 0 && <> · {visibles} ya visible{visibles === 1 ? '' : 's'} para el cliente</>}
              {internos > 0 && <> · {internos} sólo equipo</>}
            </p>
          )}
        </div>
        <Textarea
          label="Lo que le contamos al cliente"
          value={texto}
          onChange={e => { setTexto(e.target.value); setError(''); }}
          rows={4}
          maxLength={2000}
          showCount
          required
          error={error}
          placeholder="En español y en nuestras palabras. Lo lee tal cual en su correo y en su panel."
          data-autofocus
        />
        <Callout tone="info" compact>
          Le llega un correo y un aviso en su panel{internos > 0 ? `, y ${internos === 1 ? 'el documento de esta actualización pasa' : `los ${internos} documentos de esta actualización pasan`} a ser visible${internos === 1 ? '' : 's'} para él en Archivos` : ''}.
        </Callout>
      </div>
    </Modal>
  );
}
