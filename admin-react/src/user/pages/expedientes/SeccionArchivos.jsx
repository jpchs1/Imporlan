import { fmtDate } from '../../../shared/lib/utils';
import { fmtDateLarga, fmtBytes } from '../../../shared/lib/format';
import { Card, DataTable, Callout, Badge } from '../../../shared/components/UI';
import { Eye, Download, Video, File } from '../../../shared/components/Icons';
import { esDesdeUsa } from '../../../shared/lib/importacion';
import BotonEnlace from './BotonEnlace';
import { esImagen, esVideo } from './lib';


function tamano(f) {
  return f.file_size_formatted || (f.file_size ? fmtBytes(f.file_size) : '');
}

function Acciones({ f }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <BotonEnlace href={f.download_url} size="sm" icon={Eye}>Ver</BotonEnlace>
      <BotonEnlace href={f.download_url} size="sm" icon={Download} download>Descargar</BotonEnlace>
    </div>
  );
}

/**
 * Archivos del expediente: fotos como galería (abren el visor), videos y
 * documentos como lista con Ver / Descargar. Incluye lo que sube el equipo y
 * las fotos y videos que llegan desde Estados Unidos (`id` permite llegar
 * aquí desde «Ver todos» de Tu importación).
 */
export default function SeccionArchivos({ files, onPreview, id }) {
  if (!files?.length) return null;
  const imagenes = files.filter(esImagen);
  const otros = files.filter(f => !esImagen(f));
  // La descripción que el equipo escribe al subir un lote queda en cada
  // archivo del lote; se muestra la primera, venga de una foto, un video o un
  // documento (un lote solo de fotos también trae nota). La marca «Desde
  // Estados Unidos» no es una nota del equipo: se muestra en cada archivo.
  const nota = files.find(f => f.description && !esDesdeUsa(f))?.description;
  const deUsa = files.filter(esDesdeUsa).length;

  return (
    <Card id={id} className={id ? 'scroll-mt-20' : undefined}>
      <Card.Header title={`Documentos y fotos (${files.length})`} description={deUsa > 0 ? `Lo que el equipo subió a este expediente y lo que llega desde Estados Unidos (${deUsa}).` : 'Lo que el equipo subió a este expediente.'} />
      {(nota || imagenes.length > 0) && (
        <Card.Body className="space-y-5">
          {nota && <Callout tone="info" compact>{nota}</Callout>}
          {imagenes.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Fotos ({imagenes.length})</p>
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
                {imagenes.map((f, i) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onPreview?.(i)}
                      aria-label={`Ver ${f.original_name}`}
                      className="block aspect-[4/3] w-full overflow-hidden rounded-md border border-line bg-neutral-bg transition-colors duration-150 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <img src={f.download_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                    <p className="mt-1 truncate text-xs text-ink-500" title={esDesdeUsa(f) ? `${f.original_name} · Desde Estados Unidos` : f.original_name}>
                      {esDesdeUsa(f) && <span className="font-medium text-ink-700">EE. UU. · </span>}{f.original_name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card.Body>
      )}
      {otros.length > 0 && (
        <DataTable
          aria-label="Documentos del expediente"
          columns={[
            {
              key: 'original_name', header: 'Archivo',
              cell: f => (
                <div className="flex min-w-0 items-center gap-2">
                  {esVideo(f) ? <Video size={16} className="shrink-0 text-ink-500" /> : <File size={16} className="shrink-0 text-ink-500" />}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900" title={f.original_name}>{f.original_name}</p>
                    {f.description && <p className="truncate text-13 text-ink-500">{f.description}</p>}
                  </div>
                </div>
              ),
            },
            { key: 'tipo', header: 'Tipo', priority: 2, sortValue: f => (esVideo(f) ? 'Video' : 'Documento'), cell: f => <Badge tone="neutral">{esVideo(f) ? 'Video' : 'Documento'}</Badge> },
            { key: 'file_size', header: 'Tamaño', priority: 2, align: 'right', sortValue: f => Number(f.file_size) || null, cell: f => <span className="tabular">{tamano(f) || '—'}</span> },
            { key: 'created_at', header: 'Fecha', priority: 3, cell: f => <span className="tabular" title={f.created_at ? fmtDateLarga(f.created_at, { hora: true }) : undefined}>{f.created_at ? fmtDate(f.created_at) : '—'}</span> },
            { header: <span className="sr-only">Acciones</span>, align: 'right', cell: f => <Acciones f={f} /> },
          ]}
          data={otros}
          rowKey={f => f.id}
          pageSize={0}
          mobileCard={f => (
            <div className="space-y-2">
              <p className="break-words font-medium text-ink-900">{f.original_name}</p>
              <p className="text-13 text-ink-500">{[esVideo(f) ? 'Video' : 'Documento', tamano(f), f.created_at && fmtDateLarga(f.created_at)].filter(Boolean).join(' · ')}</p>
              {f.description && <p className="text-13 text-ink-700">{f.description}</p>}
              <div className="flex justify-start"><Acciones f={f} /></div>
            </div>
          )}
        />
      )}
    </Card>
  );
}
