import { fmtDate } from '../../../shared/lib/utils';
import { fmtDateLarga, fmtBytes } from '../../../shared/lib/format';
import { Card, DataTable, Callout, Badge } from '../../../shared/components/UI';
import { Eye, Download, Video, File } from '../../../shared/components/Icons';
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
 * Archivos que el equipo subió al expediente: fotos como galería (abren el
 * visor), videos y documentos como lista con Ver / Descargar.
 */
export default function SeccionArchivos({ files, onPreview }) {
  if (!files?.length) return null;
  const imagenes = files.filter(esImagen);
  const otros = files.filter(f => !esImagen(f));
  const nota = files.find(f => f.description && !esImagen(f) && !esVideo(f))?.description;

  return (
    <Card>
      <Card.Header title={`Documentos y fotos (${files.length})`} description="Lo que el equipo subió a este expediente." />
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
                    <p className="mt-1 truncate text-xs text-ink-500" title={f.original_name}>{f.original_name}</p>
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
