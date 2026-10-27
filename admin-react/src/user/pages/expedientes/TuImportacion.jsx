import { useState } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, Money, Badge } from '../../../shared/components/UI';
import { Image, ExternalLink, ChevronDown, ClipboardCheck, Receipt, Ship, CircleCheck, Clock, WhatsAppIcon, MessageSquareText, User, TriangleAlert, Banknote, FileSearch } from '../../../shared/components/Icons';
import { precioChile, FUENTE_PRECIO, planDePagos, cobrosDelExpediente, pagosConCobros, queSigue, hitosDe } from '../../../shared/lib/importacion';
import { estadoInspeccion, etapaInspeccion, inspeccionDeclinada, devolucionPedida, CAMINO_INSPECCION } from '../../../shared/lib/inspeccion';
import { BotonEnlace } from '../inicio/BotonEnlace';
import ResumenCotizacion from './ResumenCotizacion';
import MatrizPrecios from './MatrizPrecios';
import AvanceImportacion from './AvanceImportacion';
import PlanDePagos from './PlanDePagos';
import InspeccionNoApta from './InspeccionNoApta';
import ReporteListo from './ReporteListo';
import { Novedades, GaleriaUsa } from './NovedadesImportacion';
import { tituloEmbarcacion, specsEmbarcacion, urlAbsoluta, whatsappExpediente, etapaDe, rutaPagar, archivosDesdeUsa } from './lib';

/**
 * «Tu importación»: lo primero que ve el cliente cuando ya eligió. Arriba,
 * qué sigue en una frase (si hay un cobro por pagar, eso manda); después la
 * lancha elegida, su avance (hitos + pagos); luego las novedades que
 * compartió el equipo y las fotos y videos que llegan desde Estados Unidos
 * (`novedades` y `files` del expediente); al final, el plan de pagos. Todo
 * sale de shared/lib/importacion.js; aquí solo se pinta.
 *
 * Con `datosPendientes` (la elección la marcó el equipo y el cliente aún no
 * deja sus datos, su cédula y los Términos) «Qué sigue» pide eso antes que
 * nada, y `onCompletarDatos` abre el formulario.
 *
 * La inspección técnica (etapaInspeccion) manda sobre la tarjeta:
 *   - 'reporte_listo': ReporteListo arriba de todo. El cliente lee el reporte
 *     (`onLeerReporte`, en español y el original) y decide: `onAprobar`
 *     (llega el Pago 2) o `onDeclinar` (elige otra o pide la devolución).
 *   - 'declinada': InspeccionNoApta, con los dos caminos (`onElegirOtra`,
 *     `onPedirDevolucion`). Ningún cobro de esa lancha se pide mientras tanto.
 * `reporte` es la respuesta del GET del reporte (o null); `reporteInspeccion`
 * es el reporte antiguo (inspection_reports_api), como respaldo.
 */
export default function TuImportacion({
  order, link, eleccion, requests, novedades, files, datosPendientes = false, reporteInspeccion = null, reporte = null,
  onCompletarDatos, onCambiar, onDeshacer, deshaciendo, onElegirOtra, onPedirDevolucion, pidiendoDevolucion,
  onLeerReporte, onAprobar, onDeclinar, decidiendo = null, onPreviewImage, onPreviewFiles,
}) {
  const [verCotizacion, setVerCotizacion] = useState(false);
  const [imgError, setImgError] = useState(false);
  const desdeUsa = archivosDesdeUsa(files);
  const hayNovedades = (novedades || []).some(n => (n.text || '').trim());

  function irAArchivos() {
    document.getElementById('archivos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const title = link ? tituloEmbarcacion(link) : (eleccion.title || 'Tu lancha');
  const specs = link ? specsEmbarcacion(link) : [];
  const precio = link ? precioChile(link) : null;
  const url = link ? urlAbsoluta(link.url) : '';
  const imagen = link?.image_url || eleccion.image_url;
  const hayFoto = imagen && !imgError;

  const plan = link ? planDePagos(link) : [];
  const cobros = cobrosDelExpediente(requests, order.id);
  const pagos = pagosConCobros(plan, cobros);
  const inspeccion = estadoInspeccion(eleccion);
  const etapaInsp = etapaInspeccion(eleccion);
  const declinada = inspeccionDeclinada(eleccion);
  const reporteListo = etapaInsp === 'reporte_listo';
  const devolucion = devolucionPedida(eleccion);
  const sigue = declinada ? { tipo: devolucion ? 'devolucion' : 'declinada' } : reporteListo ? { tipo: 'reporte_listo' } : queSigue(eleccion, pagos);
  const hitos = hitosDe(eleccion);
  const enViaje = hitos.some(h => h.id === 'transporte' && h.hecho) || etapaDe(order) === 5;
  const agente = order.agent_name || '';
  const tieneCotizacion = !!(link && (link.quote_total_clp || link.quote_pending));
  const pago1 = pagos.pagos.find(p => p.n === 1) || null;
  const pago2 = pagos.pagos.find(p => p.n === 2) || null;

  const chipInspeccion = {
    sin_inspeccion: { icono: ClipboardCheck, texto: 'Sin inspección técnica', cls: 'text-ink-500', ico: 'text-ink-400' },
    pendiente: { icono: ClipboardCheck, texto: 'Con inspección técnica', cls: 'text-ink-700', ico: 'text-success' },
    en_curso: { icono: ClipboardCheck, texto: 'Inspección técnica en curso', cls: 'text-ink-700', ico: 'text-brand-600' },
    reporte_listo: { icono: FileSearch, texto: 'Reporte de inspección listo: tú decides', cls: 'text-ink-700', ico: 'text-brand-600' },
    aprobada: { icono: CircleCheck, texto: 'Inspección técnica aprobada', cls: 'text-ink-700', ico: 'text-success' },
    declinada: { icono: TriangleAlert, texto: 'Declinada tras la inspección', cls: 'text-warning', ico: 'text-warning' },
  }[inspeccion];
  const ChipIcono = chipInspeccion.icono;

  return (
    <Card as="section" id="mi-importacion" aria-labelledby="tu-importacion" className="exp-section mb-6">
      <Card.Header
        title={<span id="tu-importacion">Tu importación</span>}
        description={`${title} · elegida el ${fmtDateLarga(eleccion.at)} ${eleccion.by === 'equipo' ? 'por tu agente' : 'por ti'}`}
        actions={enViaje ? <BotonEnlace to="/tracking" size="sm" icon={Ship}>Seguimiento</BotonEnlace> : undefined}
      />

      <QueSigue sigue={sigue} agente={agente} titulo={title} datosPendientes={datosPendientes && !declinada && !reporteListo} onCompletarDatos={onCompletarDatos} />

      <Card.Body>
        {reporteListo && (
          <ReporteListo
            order={order}
            eleccion={eleccion}
            titulo={title}
            reporte={reporte}
            pago1={pago1}
            pago2={pago2}
            onLeer={onLeerReporte}
            onAprobar={onAprobar}
            onDeclinar={onDeclinar}
            decidiendo={decidiendo}
            className="mb-6"
          />
        )}

        {declinada && (
          <InspeccionNoApta
            order={order}
            eleccion={eleccion}
            titulo={title}
            pago1={pago1}
            reporte={reporteInspeccion}
            onLeerReporte={onLeerReporte}
            onElegirOtra={onElegirOtra}
            onPedirDevolucion={onPedirDevolucion}
            pidiendo={pidiendoDevolucion}
            className="mb-6"
          />
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          {/* La lancha elegida */}
          <div className="min-w-0">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-line bg-neutral-bg">
              {hayFoto ? (
                <button
                  type="button"
                  onClick={() => onPreviewImage?.(imagen, title)}
                  className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                  aria-label={`Ver foto grande de ${title}`}
                >
                  <img src={imagen} alt="" className={cn('h-full w-full object-cover', declinada && 'opacity-70 grayscale')} onError={() => setImgError(true)} />
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-700">
                  <Image size={24} className="text-ink-500" />
                  <span className="text-xs font-medium">Sin foto</span>
                </div>
              )}
              {declinada
                ? <Badge tone="warning" dot className="absolute left-3 top-3 shadow-card">Declinada tras la inspección</Badge>
                : <Badge tone="brand" dot className="absolute left-3 top-3 shadow-card">Tu elección</Badge>}
            </div>

            <h3 className="mt-3 text-xl font-semibold leading-7 text-ink-900">{title}</h3>
            {specs.length > 0 && <p className="mt-0.5 text-13 text-ink-500">{specs.join(' · ')}</p>}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md border border-line bg-canvas px-3.5 py-3">
              <div className="min-w-0">
                <p className="eyebrow">Precio puesto en Chile</p>
                {precio ? (
                  <Money clp={precio.clp} usd={precio.usd || undefined} size="lg" tone={declinada ? 'muted' : undefined} />
                ) : (
                  <p className="mt-1 text-sm text-ink-700">Por confirmar con tu agente</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {precio && <Badge tone={precio.fuente === 'cotizacion' && !declinada ? 'success' : 'neutral'}>{FUENTE_PRECIO[precio.fuente]}</Badge>}
                <span className={cn('inline-flex items-center gap-1.5 text-13', chipInspeccion.cls)}>
                  <ChipIcono size={14} className={chipInspeccion.ico} />
                  {chipInspeccion.texto}
                </span>
              </div>
            </div>

            {eleccion.note && (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-13 text-ink-700">
                <MessageSquareText size={14} className="mt-0.5 shrink-0 text-ink-500" />
                <span><span className="font-medium text-ink-900">Le dijiste a tu agente: </span>{eleccion.note}</span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {url && <BotonEnlace href={url} size="sm" icon={ExternalLink}>Ver anuncio</BotonEnlace>}
              {tieneCotizacion && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconRight={ChevronDown}
                  aria-expanded={verCotizacion}
                  aria-controls="cotizacion-elegida"
                  onClick={() => setVerCotizacion(v => !v)}
                  className={verCotizacion ? '[&_svg:last-child]:rotate-180' : undefined}
                >
                  {verCotizacion ? 'Ocultar cotización' : 'Ver cotización'}
                </Button>
              )}
            </div>
            {verCotizacion && (
              <div id="cotizacion-elegida" className="mt-3 space-y-3">
                <MatrizPrecios link={link} />
                <ResumenCotizacion link={link} />
              </div>
            )}

            {/* Cambiar o deshacer: sólo mientras el agente no avanzó. Con la
                lancha declinada los caminos están arriba (InspeccionNoApta). */}
            {!declinada && (
              <div className="mt-4 border-t border-line pt-3">
                {eleccion.client_can_change ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Button variant="ghost" size="sm" onClick={onCambiar}>Cambiar de lancha</Button>
                    <Button variant="danger-ghost" size="sm" onClick={onDeshacer} loading={deshaciendo}>Deshacer elección</Button>
                    <p className="basis-full text-xs text-ink-500">Puedes cambiar o deshacer mientras tu agente no haya avanzado con esta lancha.</p>
                  </div>
                ) : (
                  <p className="text-13 text-ink-500">
                    ¿Quieres cambiar de lancha?{' '}
                    <a href={whatsappExpediente(order)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
                      <WhatsAppIcon size={14} /> Habla con tu agente
                    </a>
                    : tu importación ya avanzó con esta.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Avance */}
          <AvanceImportacion
            eleccion={eleccion}
            pagos={pagos}
            tituloLancha={title}
            agente={agente}
            datosPendientes={datosPendientes && !declinada}
            onCompletarDatos={onCompletarDatos}
            reporteInspeccion={reporteInspeccion}
            onLeerReporte={onLeerReporte}
            className="min-w-0"
          />
        </div>
      </Card.Body>

      {(hayNovedades || desdeUsa.length > 0) && (
        <Card.Body className="border-t border-line">
          <div className={cn('grid grid-cols-1 gap-8', hayNovedades && desdeUsa.length > 0 && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]')}>
            {hayNovedades && <Novedades novedades={novedades} files={files} onPreview={onPreviewFiles} className="min-w-0" />}
            {desdeUsa.length > 0 && <GaleriaUsa archivos={desdeUsa} onPreview={onPreviewFiles} onVerTodos={irAArchivos} className="min-w-0" />}
          </div>
        </Card.Body>
      )}

      {(pagos.pagos.length > 0 || pagos.otros.length > 0) && (
        <Card.Body className="border-t border-line">
          <PlanDePagos pagos={pagos.pagos} otros={pagos.otros} eleccion={eleccion} />
        </Card.Body>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   «Qué sigue», en una frase. Si faltan los datos del cliente, eso manda;
   si no, un cobro por pagar; si no, el hito en curso. Con el reporte de la
   inspección listo: le toca leerlo y decidir (la tarjeta está justo debajo).
   Con la lancha declinada: le toca elegir otra o pedir la devolución, o ya
   pidió la devolución.
   --------------------------------------------------------------------------- */
function QueSigue({ sigue, agente, titulo, datosPendientes, onCompletarDatos }) {
  let icono = Clock;
  let tono = 'brand';
  let tituloQue;
  let detalle;
  let accion = null;

  if (sigue.tipo === 'reporte_listo') {
    icono = FileSearch;
    tono = 'brand';
    tituloQue = 'Te toca: revisa el reporte y decide';
    detalle = `El reporte de la inspección de ${titulo} ya está, en inglés y en español. Léelo con calma; con lo que decidas, seguimos.`;
  } else if (sigue.tipo === 'declinada') {
    icono = TriangleAlert;
    tono = 'warning';
    tituloQue = 'Te toca: elige otra lancha o pide la devolución';
    detalle = `No sigues con ${titulo}. Tienes los dos caminos aquí abajo; con el que elijas, seguimos.`;
  } else if (sigue.tipo === 'devolucion') {
    icono = Banknote;
    detalle = 'Te contactamos para coordinarla. Por ahora no tienes nada pendiente.';
    tituloQue = 'Pediste la devolución del Pago 1';
  } else if (datosPendientes) {
    icono = User;
    tono = 'warning';
    tituloQue = 'Te toca: completa tus datos y sube tu cédula';
    detalle = 'Los necesitamos para comprar e importar la lancha a tu nombre. Tu cédula es privada: sólo la ve el equipo.';
    accion = <Button icon={User} onClick={onCompletarDatos}>Completar mis datos</Button>;
  } else if (sigue.tipo === 'pago') {
    const { pago } = sigue;
    const cobro = pago.cobro;
    icono = Receipt;
    tono = 'warning';
    tituloQue = pago.n ? `Te toca: pagar el Pago ${pago.n} · ${pago.pct}%` : `Te toca: pagar ${cobro.title}`;
    detalle = `${fmtCLP(cobro.amount_clp)} · lo pagas en Pagos, con tarjeta o transferencia.`;
    accion = <BotonEnlace to={rutaPagar(cobro)} variant="primary" icon={Receipt}>Pagar {fmtCLP(cobro.amount_clp)}</BotonEnlace>;
  } else if (sigue.tipo === 'hito') {
    tituloQue = sigue.hito.enCurso;
    const quien = agente ? `Lo hace ${agente}` : 'Lo hace tu agente';
    detalle = sigue.hito.id === 'inspeccion'
      ? `${quien}. Cuando esté el reporte, tú lo revisas (${CAMINO_INSPECCION.revisas.corto.replace(/\.$/, '')}) y decides. ${CAMINO_INSPECCION.apta.label}: ${CAMINO_INSPECCION.apta.corto} ${CAMINO_INSPECCION.no_apta.label}: ${CAMINO_INSPECCION.no_apta.corto}`
      : `${quien}. Por ahora no tienes nada pendiente; te avisamos cuando haya novedades.`;
  } else {
    icono = CircleCheck;
    tono = 'success';
    tituloQue = 'Tu lancha fue entregada';
    detalle = 'Que la disfrutes. Si necesitas algo más, escríbele a tu agente.';
  }

  const Icono = icono;
  const estilos = {
    brand: 'border-brand-200 bg-brand-50',
    warning: 'border-warning-line bg-warning-bg',
    success: 'border-success-line bg-success-bg',
  }[tono];
  const icoEstilo = { brand: 'bg-brand-100 text-brand-700', warning: 'bg-surface text-warning', success: 'bg-surface text-success' }[tono];

  return (
    <div className={cn('flex flex-col gap-3 border-b px-(--card-pad) py-4 sm:flex-row sm:items-center sm:justify-between', estilos)} role="status">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', icoEstilo)} aria-hidden="true">
          <Icono size={18} />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Qué sigue</p>
          <p className="text-sm font-semibold leading-5 text-ink-900">{tituloQue}</p>
          <p className="mt-0.5 text-13 text-ink-700">{detalle}</p>
        </div>
      </div>
      {accion && <div className="shrink-0 pl-12 sm:pl-0">{accion}</div>}
    </div>
  );
}
