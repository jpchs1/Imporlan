import { useState } from 'react';
import { cn, fmtCLP } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Card, Button, Money, Badge } from '../../../shared/components/UI';
import { Image, ExternalLink, ChevronDown, ClipboardCheck, Receipt, Ship, CircleCheck, Clock, WhatsAppIcon, MessageSquareText } from '../../../shared/components/Icons';
import { precioChile, FUENTE_PRECIO, planDePagos, cobrosDelExpediente, pagosConCobros, queSigue, hitosDe } from '../../../shared/lib/importacion';
import { BotonEnlace } from '../inicio/BotonEnlace';
import ResumenCotizacion from './ResumenCotizacion';
import MatrizPrecios from './MatrizPrecios';
import AvanceImportacion from './AvanceImportacion';
import PlanDePagos from './PlanDePagos';
import { Novedades, GaleriaUsa } from './NovedadesImportacion';
import { tituloEmbarcacion, specsEmbarcacion, urlAbsoluta, whatsappExpediente, etapaDe, rutaPagar, archivosDesdeUsa } from './lib';

/**
 * «Tu importación»: lo primero que ve el cliente cuando ya eligió. Arriba,
 * qué sigue en una frase (si hay un cobro por pagar, eso manda); después la
 * lancha elegida, su avance (hitos + pagos); luego las novedades que
 * compartió el equipo y las fotos y videos que llegan desde Estados Unidos
 * (`novedades` y `files` del expediente); al final, el plan de pagos. Todo
 * sale de shared/lib/importacion.js; aquí solo se pinta.
 */
export default function TuImportacion({ order, link, eleccion, requests, novedades, files, onCambiar, onDeshacer, deshaciendo, onPreviewImage, onPreviewFiles }) {
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
  const sigue = queSigue(eleccion, pagos);
  const hitos = hitosDe(eleccion);
  const enViaje = hitos.some(h => h.id === 'transporte' && h.hecho) || etapaDe(order) === 5;
  const agente = order.agent_name || '';
  const tieneCotizacion = !!(link && (link.quote_total_clp || link.quote_pending));

  return (
    <Card as="section" aria-labelledby="tu-importacion" className="mb-6">
      <Card.Header
        title={<span id="tu-importacion">Tu importación</span>}
        description={`${title} · elegida el ${fmtDateLarga(eleccion.at)} ${eleccion.by === 'equipo' ? 'por tu agente' : 'por ti'}`}
        actions={enViaje ? <BotonEnlace to="/tracking" size="sm" icon={Ship}>Seguimiento</BotonEnlace> : undefined}
      />

      <QueSigue sigue={sigue} agente={agente} />

      <Card.Body>
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
                  <img src={imagen} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
                </button>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-700">
                  <Image size={24} className="text-ink-500" />
                  <span className="text-xs font-medium">Sin foto</span>
                </div>
              )}
              <Badge tone="brand" dot className="absolute left-3 top-3 shadow-card">Tu elección</Badge>
            </div>

            <h3 className="mt-3 text-xl font-semibold leading-7 text-ink-900">{title}</h3>
            {specs.length > 0 && <p className="mt-0.5 text-13 text-ink-500">{specs.join(' · ')}</p>}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md border border-line bg-canvas px-3.5 py-3">
              <div className="min-w-0">
                <p className="eyebrow">Precio puesto en Chile</p>
                {precio ? (
                  <Money clp={precio.clp} usd={precio.usd || undefined} size="lg" />
                ) : (
                  <p className="mt-1 text-sm text-ink-700">Por confirmar con tu agente</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {precio && <Badge tone={precio.fuente === 'cotizacion' ? 'success' : 'neutral'}>{FUENTE_PRECIO[precio.fuente]}</Badge>}
                <span className={cn('inline-flex items-center gap-1.5 text-13', eleccion.inspection ? 'text-ink-700' : 'text-ink-500')}>
                  <ClipboardCheck size={14} className={eleccion.inspection ? 'text-success' : 'text-ink-400'} />
                  {eleccion.inspection ? 'Con inspección técnica' : 'Sin inspección técnica'}
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
          </div>

          {/* Avance */}
          <AvanceImportacion eleccion={eleccion} pagos={pagos} tituloLancha={title} agente={agente} className="min-w-0" />
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
          <PlanDePagos pagos={pagos.pagos} otros={pagos.otros} />
        </Card.Body>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   «Qué sigue», en una frase. Si hay un cobro por pagar, eso va primero.
   --------------------------------------------------------------------------- */
function QueSigue({ sigue, agente }) {
  let icono = Clock;
  let tono = 'brand';
  let titulo;
  let detalle;
  let accion = null;

  if (sigue.tipo === 'pago') {
    const { pago } = sigue;
    const cobro = pago.cobro;
    icono = Receipt;
    tono = 'warning';
    titulo = pago.n ? `Te toca: pagar el Pago ${pago.n} · ${pago.pct}%` : `Te toca: pagar ${cobro.title}`;
    detalle = `${fmtCLP(cobro.amount_clp)} · lo pagas en Pagos, con tarjeta o transferencia.`;
    accion = <BotonEnlace to={rutaPagar(cobro)} variant="primary" icon={Receipt}>Pagar {fmtCLP(cobro.amount_clp)}</BotonEnlace>;
  } else if (sigue.tipo === 'hito') {
    titulo = sigue.hito.enCurso;
    detalle = `${agente ? `Lo hace ${agente}` : 'Lo hace tu agente'}. Por ahora no tienes nada pendiente; te avisamos cuando haya novedades.`;
  } else {
    icono = CircleCheck;
    tono = 'success';
    titulo = 'Tu lancha fue entregada';
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
          <p className="text-sm font-semibold leading-5 text-ink-900">{titulo}</p>
          <p className="mt-0.5 text-13 text-ink-700">{detalle}</p>
        </div>
      </div>
      {accion && <div className="shrink-0 pl-12 sm:pl-0">{accion}</div>}
    </div>
  );
}
