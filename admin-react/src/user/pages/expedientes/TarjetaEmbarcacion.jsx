import { useState } from 'react';
import { cn } from '../../../shared/lib/utils';
import { Badge, Button, IconButton, Menu } from '../../../shared/components/UI';
import { ChevronUp, ChevronDown, GripVertical, ExternalLink, Copy, ClipboardCheck, Image, MessageSquareText, Check, WhatsAppIcon } from '../../../shared/components/Icons';
import { useToast } from '../../../shared/components/Toast';
import MatrizPrecios from './MatrizPrecios';
import ResumenCotizacion from './ResumenCotizacion';
import BotonEnlace from './BotonEnlace';
import { tituloEmbarcacion, specsEmbarcacion, fuenteAnuncio, urlAbsoluta, estaVendida } from './lib';

function ordinal(n) {
  return `${n}.ª`;
}

/**
 * Una embarcación del ranking: foto con el puesto, ficha en una línea, la
 * nota del agente, los precios a la derecha y la cotización debajo.
 * Reordenar: flechas (teclado) y arrastre en escritorio.
 *
 * Elegir: `onElegir` pone el botón «Elegir esta lancha» (primario) o, si ya
 * hay otra elegida y se puede cambiar, «Cambiar a esta lancha» (secundario,
 * `modoCambio`). `elegida` marca la tarjeta como «Tu elección», sin botón.
 */
export default function TarjetaEmbarcacion({ link, index, total, dragHandlers, onMoveUp, onMoveDown, onRequestInspection, onPreviewImage, onElegir, elegida = false, modoCambio = false }) {
  const toast = useToast();
  const [imgError, setImgError] = useState(false);
  const [imgRetry, setImgRetry] = useState(0);

  const vendida = estaVendida(link);
  const title = tituloEmbarcacion(link);
  const fuente = fuenteAnuncio(link.url);
  const url = urlAbsoluta(link.url);
  const specs = specsEmbarcacion(link);
  const puedeOrdenar = !!(onMoveUp || onMoveDown);
  const tituloPuesto = `Puesto ${index + 1} en tu ranking` + (link.selection_order ? ` · Agregada ${ordinal(link.selection_order)} por Imporlan` : '');
  const hayFoto = link.image_url && !imgError;

  function handleImgError() {
    if (imgRetry < 1) setImgRetry(r => r + 1); else setImgError(true);
  }

  function copiar() {
    if (!link.url) return;
    navigator.clipboard?.writeText(link.url)
      .then(() => toast?.('Link del anuncio copiado', 'success'))
      .catch(() => toast?.('No pudimos copiar el link', 'error'));
  }

  const acciones = [
    link.url && { label: 'Copiar link del anuncio', icon: Copy, onClick: copiar },
    link.url && { label: 'Compartir por WhatsApp', icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(link.url)}` },
    !vendida && onRequestInspection && { label: 'Solicitar inspección técnica', icon: ClipboardCheck, onClick: () => onRequestInspection(link) },
  ].filter(Boolean);

  return (
    <article
      draggable={!!dragHandlers}
      aria-label={`${index + 1}. ${title}${elegida ? ' (tu elección)' : ''}`}
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card transition-colors duration-150 sm:flex-row sm:gap-4',
        elegida ? 'border-brand-600' : 'border-line',
        vendida ? 'bg-canvas' : !elegida && 'hover:border-ink-400',
        dragHandlers && 'sm:cursor-grab sm:active:cursor-grabbing',
      )}
      {...dragHandlers}
    >
      {/* Reordenar: columna a la izquierda en escritorio; fila al pie en móvil. */}
      {puedeOrdenar && (
        <div className="order-last flex items-center justify-center gap-1 border-t border-line pt-3 sm:order-first sm:flex-col sm:justify-start sm:border-0 sm:pt-0" role="group" aria-label={`Ordenar ${title}`}>
          <IconButton icon={ChevronUp} size="sm" aria-label={`Subir ${title} en el ranking`} title="Subir" onClick={onMoveUp} disabled={index === 0} />
          <span className="hidden text-ink-400 sm:inline" title="Arrastra para reordenar" aria-hidden="true"><GripVertical size={16} /></span>
          <span className="text-13 text-ink-500 tabular sm:hidden">Puesto {index + 1} de {total}</span>
          <IconButton icon={ChevronDown} size="sm" aria-label={`Bajar ${title} en el ranking`} title="Bajar" onClick={onMoveDown} disabled={index === total - 1} />
        </div>
      )}

      {/* Foto con el puesto encima */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-md border border-line bg-neutral-bg sm:h-28 sm:w-40">
        {hayFoto ? (
          <button
            type="button"
            onClick={() => onPreviewImage?.(link.image_url, title)}
            className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
            aria-label={`Ver foto grande de ${title}`}
          >
            <img
              key={imgRetry}
              src={link.image_url + (imgRetry ? `?r=${imgRetry}` : '')}
              alt=""
              className={cn('h-full w-full object-cover', vendida && 'opacity-60 grayscale')}
              onError={handleImgError}
              loading="lazy"
            />
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-700">
            <Image size={20} className="text-ink-500" />
            <span className="text-xs font-medium">Sin foto</span>
          </div>
        )}
        <span
          className="absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-sm bg-ink-900/90 px-2 text-13 font-semibold text-white tabular"
          title={tituloPuesto}
          aria-label={tituloPuesto}
        >
          {index + 1}
        </span>
      </div>

      {/* Ficha + precios */}
      <div className="min-w-0 flex-1 @container">
        {/* Con ancho (≥ 672 px de ficha) los precios van a la derecha; si no, debajo. */}
        <div className="@2xl:grid @2xl:grid-cols-[minmax(0,1fr)_320px] @2xl:items-start @2xl:gap-x-5">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h4 className={cn('text-base font-semibold leading-6 line-clamp-2', vendida ? 'text-ink-500' : 'text-ink-900')} title={title}>{title}</h4>
              {vendida && <Badge tone="neutral" className="shrink-0">{link.link_status === 'sold' ? 'Vendida' : 'No disponible'}</Badge>}
              {elegida && <Badge tone="brand" dot className="shrink-0">Tu elección</Badge>}
            </div>
            {(specs.length > 0 || fuente) && (
              <p className="mt-1 text-13 text-ink-500">
                {specs.join(' · ')}
                {specs.length > 0 && fuente && ' · '}
                {fuente && <span>Anuncio en {fuente}</span>}
              </p>
            )}

            {link.comments && (
              <p className="mt-2.5 flex items-start gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-13 text-ink-700">
                <MessageSquareText size={14} className="mt-0.5 shrink-0 text-ink-500" />
                <span><span className="font-medium text-ink-900">Nota de tu agente: </span>{link.comments}</span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onElegir && !elegida && (
                <Button size="sm" variant={modoCambio ? 'secondary' : 'primary'} icon={Check} onClick={() => onElegir(link)}>
                  {modoCambio ? 'Cambiar a esta lancha' : 'Elegir esta lancha'}
                </Button>
              )}
              {url && <BotonEnlace href={url} size="sm" icon={ExternalLink}>Ver anuncio</BotonEnlace>}
              {acciones.length > 0 && <Menu items={acciones} label={`Más acciones de ${title}`} />}
            </div>
          </div>

          <MatrizPrecios link={link} className="mt-3 @2xl:mt-0" />
        </div>

        <ResumenCotizacion link={link} className="mt-3" />
      </div>
    </article>
  );
}
