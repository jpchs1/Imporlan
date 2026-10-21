import { cn } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Button } from '../../../shared/components/UI';
import { Megaphone, Play, Images } from '../../../shared/components/Icons';
import { esImagen, esVideo, GALERIA_USA_MAX as GALERIA_MAX } from './lib';

/**
 * Lo que llega de la operación en Estados Unidos, para el cliente:
 *
 *   - `Novedades`: lo que el equipo compartió (`order.novedades`: texto en
 *     español, fecha y los archivos de esa actualización). Nunca la nota
 *     original de quien opera allá ni su nombre.
 *   - `GaleriaUsa`: las fotos y videos que entraron al expediente desde
 *     Estados Unidos (archivos con descripción «Desde Estados Unidos»), las
 *     más nuevas primero. Si hay muchas, las últimas GALERIA_MAX y «Ver
 *     todos» lleva a la sección de archivos.
 *
 * Las fotos abren el visor (`onPreview(fotos, índice)`); los videos se abren
 * en una pestaña nueva, el visor solo muestra imágenes. La lista de archivos
 * la arma `archivosDesdeUsa()` de ./lib.
 */

/* ---------------------------------------------------------------------------
   Miniatura: foto (botón que abre el visor) o video (enlace con ícono).
   --------------------------------------------------------------------------- */
function Miniatura({ file, onOpen, size = 'md' }) {
  const alto = size === 'sm' ? 'h-16 w-[5.5rem]' : 'aspect-[4/3] w-full';
  const base = cn('block overflow-hidden rounded-md border border-line bg-neutral-bg transition-colors duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500', alto);
  if (esVideo(file)) {
    return (
      <a href={file.download_url} target="_blank" rel="noopener noreferrer" className={cn(base, 'relative flex items-center justify-center bg-ink-900 text-white')} aria-label={`Ver video ${file.original_name}`} title={file.original_name}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Play size={18} /></span>
        <span className="absolute inset-x-0 bottom-0 truncate bg-ink-900/80 px-1.5 py-0.5 text-left text-xs text-white/90">Video</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={base} aria-label={`Ver ${file.original_name}`} title={file.original_name}>
      <img src={file.download_url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Novedades
   --------------------------------------------------------------------------- */
export function Novedades({ novedades, files, onPreview, className }) {
  const lista = (novedades || []).filter(n => (n.text || '').trim());
  if (lista.length === 0) return null;
  const porId = new Map((files || []).map(f => [Number(f.id), f]));

  return (
    <section aria-labelledby="novedades-importacion" className={className}>
      <div className="flex items-start gap-2">
        <Megaphone size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="novedades-importacion" className="text-sm font-semibold text-ink-900">Novedades</h3>
          <p className="text-13 text-ink-500">Lo que te vamos contando del avance de tu lancha.</p>
        </div>
      </div>
      <ol className="mt-3 divide-y divide-line rounded-lg border border-line">
        {lista.map(n => {
          const adjuntos = (n.file_ids || []).map(id => porId.get(Number(id))).filter(f => f && (esImagen(f) || esVideo(f)));
          const fotos = adjuntos.filter(esImagen);
          return (
            <li key={n.id} className="px-4 py-3">
              <time className="text-xs text-ink-500 tabular" dateTime={n.at} title={fmtDateLarga(n.at, { hora: true })}>{fmtDateLarga(n.at)}</time>
              <p className="mt-0.5 whitespace-pre-line text-sm text-ink-700">{n.text}</p>
              {adjuntos.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-2" aria-label={`Archivos de la novedad del ${fmtDateLarga(n.at)}`}>
                  {adjuntos.map(f => (
                    <li key={f.id}>
                      <Miniatura file={f} size="sm" onOpen={() => onPreview?.(fotos, fotos.indexOf(f))} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Fotos y videos desde Estados Unidos
   --------------------------------------------------------------------------- */
export function GaleriaUsa({ archivos, onPreview, onVerTodos, className }) {
  const todos = archivos || [];
  if (todos.length === 0) return null;
  const visibles = todos.slice(0, GALERIA_MAX);
  const fotos = visibles.filter(esImagen);
  const nFotos = todos.filter(esImagen).length;
  const nVideos = todos.length - nFotos;
  const resumen = [nFotos > 0 && `${nFotos} ${nFotos === 1 ? 'foto' : 'fotos'}`, nVideos > 0 && `${nVideos} ${nVideos === 1 ? 'video' : 'videos'}`].filter(Boolean).join(' y ');

  return (
    <section aria-labelledby="fotos-desde-usa" className={className}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex items-start gap-2">
          <Images size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="fotos-desde-usa" className="text-sm font-semibold text-ink-900">Fotos y videos desde Estados Unidos</h3>
            <p className="text-13 text-ink-500">{resumen} de tu lancha, tal como está allá.{todos.length > GALERIA_MAX ? ` Aquí van las últimas ${visibles.length}; el resto está en Documentos y fotos.` : ''}</p>
          </div>
        </div>
        {todos.length > GALERIA_MAX && onVerTodos && (
          <Button variant="link" size="sm" onClick={onVerTodos} className="shrink-0">Ver todos ({todos.length})</Button>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos y videos desde Estados Unidos">
        {visibles.map(f => (
          <li key={f.id}>
            <Miniatura file={f} onOpen={() => onPreview?.(fotos, fotos.indexOf(f))} />
          </li>
        ))}
      </ul>
    </section>
  );
}
