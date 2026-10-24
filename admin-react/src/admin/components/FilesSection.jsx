import { useState } from 'react';
import { deleteExpedienteFile, uploadExpedienteFiles } from '../api';
import { fmtDate } from '../../shared/lib/utils';
import { fmtBytes } from '../../shared/lib/format';
import { ORIGEN_ARCHIVO_USA, DESCRIPCION_ARCHIVO_USA, esCedulaCliente } from '../../shared/lib/importacion';
import { Card, Button, IconButton, Input, Checkbox, Modal, Dropzone, DataTable, Badge, EmptyState, ErrorState, FilterChips, Skeleton, useConfirm } from '../../shared/components/UI';
import { Upload, Eye, Trash, X, Image as ImageIcon, Video, FileText, File as FileIcon, Paperclip, LayoutGrid, List } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useExpedienteFiles, categoriaArchivo } from './useExpedienteFiles';
import { FileImage } from '../../shared/components/FileImage';
import { Lightbox } from '../../shared/components/Lightbox';
import { FileDownload, FileOpen } from '../../shared/components/FileDownload';

function fileCategory(mime) {
  return categoriaArchivo({ mime_type: mime });
}

const CATS = {
  image:    { icon: ImageIcon, label: 'Imagen' },
  video:    { icon: Video,     label: 'Video' },
  document: { icon: FileText,  label: 'Documento' },
  other:    { icon: FileIcon,  label: 'Archivo' },
};

/* De dónde viene y quién lo ve: «Desde EE. UU.» si lo subió el operador de
   allá; «Sólo equipo» si el cliente no lo ve (sus PDF, hasta que se comparten);
   «Cédula · privada» la que subió el cliente al elegir (sólo la ve el equipo:
   ni el cliente entre sus archivos ni el agente de EE. UU.). */
export function ChipsArchivo({ f, size = 'sm' }) {
  const cedula = esCedulaCliente(f);
  const deUsa = f.uploaded_by === ORIGEN_ARCHIVO_USA;
  const interno = !cedula && f.visible_to_client !== undefined && f.visible_to_client !== null && Number(f.visible_to_client) === 0;
  if (!cedula && !deUsa && !interno) return null;
  return (
    <>
      {cedula && <Badge tone="warning" size={size} title="Cédula de identidad del cliente: sólo la ve el equipo en Chile">Cédula · privada</Badge>}
      {deUsa && <Badge tone="info" size={size} title="Lo subió el operador de EE. UU.">Desde EE. UU.</Badge>}
      {interno && <Badge tone="neutral" size={size} title="El cliente no lo ve">Sólo equipo</Badge>}
    </>
  );
}

/**
 * Archivos del expediente. `archivos` es lo que devuelve useExpedienteFiles
 * (lo comparte el detalle con «Operación en EE. UU.»); sin él, los pide solo.
 */
export default function FilesSection({ orderId, archivos }) {
  const toast = useToast();
  const confirm = useConfirm();
  const propios = useExpedienteFiles(archivos ? null : orderId);
  const { files, loading, error, recargar: loadFiles } = archivos || propios;
  const [showUpload, setShowUpload] = useState(false);
  const [pending, setPending] = useState([]);
  const [description, setDescription] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState('gallery');
  const [category, setCategory] = useState('all');
  const filteredFiles = category === 'all' ? files : files.filter(f => categoriaArchivo(f) === category);
  const filters = [{ id: 'all', label: 'Todos', count: files.length },
    ...Object.entries(CATS).map(([id, cat]) => ({ id, label: { image: 'Fotos', video: 'Videos', document: 'Documentos', other: 'Otros' }[id] || cat.label, count: files.filter(f => categoriaArchivo(f) === id).length }))
      .filter(item => item.id !== 'other' || item.count > 0 || category === 'other')];
  const images = files.filter(f => categoriaArchivo(f) === 'image');
  const items = images.map(f => ({ src: f.download_url, downloadUrl: f.download_url, originalName: f.original_name, mimeType: f.mime_type, alt: f.original_name, caption: f.original_name }));
  const openImage = f => setPreview(images.findIndex(image => image.id === f.id));
  const actionClass = 'inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-700 hover:bg-neutral-bg focus-visible:outline-2 focus-visible:outline-brand-500';

  function thumbnail(f, iconComponent) {
    const Icon = iconComponent;
    return categoriaArchivo(f) === 'image' ? <button type="button" onClick={() => openImage(f)} aria-label={`Ver foto ${f.original_name}`} className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-neutral-bg">
      <FileImage src={f.download_url} originalName={f.original_name} mimeType={f.mime_type} alt={f.original_name} loading="lazy" className="h-full w-full object-cover" />
    </button> : <span className="h-8 w-8 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0" aria-hidden="true"><Icon size={16} /></span>;
  }

  function handleFilesSelected(fileList) {
    setPending(Array.from(fileList));
  }

  async function handleUpload() {
    if (pending.length === 0) { toast?.('Selecciona archivos para subir', 'error'); return; }
    setUploading(true);
    try {
      const data = await uploadExpedienteFiles(orderId, pending, description, notifyClient);
      if (data.success && !data.count) {
        toast?.('No se subió ningún archivo' + (data.errors?.length ? ': ' + data.errors.join(', ') : ''), 'error');
      } else if (data.success) {
        let msg = `${data.count} archivo${data.count > 1 ? 's' : ''} subido${data.count > 1 ? 's' : ''} correctamente`;
        if (notifyClient) msg += '. Cliente notificado.';
        toast?.(msg, 'success');
        setPending([]);
        setDescription('');
        setShowUpload(false);
        setCategory('all');
        loadFiles();
        if (data.errors && data.errors.length > 0) {
          toast?.('Algunos archivos fallaron: ' + data.errors.join(', '), 'error');
        }
      } else {
        toast?.(data.error || 'Error al subir archivos', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexión al subir archivos', 'error'); }
    setUploading(false);
  }

  async function handleDeleteFile(f) {
    const descripcion = esCedulaCliente(f)
      ? `Es la cédula del cliente (${f.original_name}). Si la eliminas, sus datos quedan incompletos y tendrá que volver a subirla. No se puede deshacer.`
      : `${f.original_name} deja de estar disponible para el cliente. No se puede deshacer.`;
    if (!(await confirm({ title: '¿Eliminar este archivo?', description: descripcion, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      const data = await deleteExpedienteFile(f.id);
      if (data.success) { toast?.('Archivo eliminado', 'success'); loadFiles(); }
      else toast?.(data.error || 'Error al eliminar', 'error');
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
  }

  function cerrarSubida() { setShowUpload(false); setPending([]); }

  const columns = [
    {
      key: 'original_name', header: 'Archivo',
      cell: f => {
        const cat = CATS[f.category || fileCategory(f.mime_type)] || CATS.other;
        const Icon = cat.icon;
        return (
          <div className="flex items-center gap-3 min-w-0">
            {thumbnail(f, Icon)}
            <div className="min-w-0">
              <p className="font-medium text-ink-900 truncate">{f.original_name}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                <ChipsArchivo f={f} />
                {/* La descripción fija del operador repite el chip: no se pinta dos veces. */}
                {f.description && !(f.uploaded_by === ORIGEN_ARCHIVO_USA && f.description === DESCRIPCION_ARCHIVO_USA) && <span className="truncate">{f.description}</span>}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: 'category', header: 'Tipo', width: 120, priority: 2, cell: f => <Badge>{(CATS[f.category || fileCategory(f.mime_type)] || CATS.other).label}</Badge> },
    { key: 'file_size', header: 'Tamaño', width: 100, align: 'right', priority: 2, sortValue: f => Number(f.file_size) || 0, cell: f => <span className="tabular text-ink-500">{f.file_size_formatted || fmtBytes(f.file_size)}</span> },
    { key: 'created_at', header: 'Fecha', width: 110, cell: f => <span className="tabular text-ink-500">{fmtDate(f.created_at)}</span> },
    {
      header: <span className="sr-only">Abrir</span>, width: 88, align: 'right',
      cell: f => {
        const cat = f.category || fileCategory(f.mime_type);
        const previewable = cat === 'image' || f.mime_type === 'application/pdf' || cat === 'video';
        return (
          <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {previewable && (cat === 'image' ? <IconButton size="sm" icon={Eye} aria-label={`Ver ${f.original_name}`} onClick={() => openImage(f)} /> : <FileOpen file={f} className={actionClass} />)}
            <FileDownload file={f} className={actionClass} />
          </span>
        );
      },
    },
  ];

  return (
    <>
      <Card className="exp-section">
        <Card.Header
          title="Archivos"
          description="Documentos y material de la operación. La etiqueta de cada archivo indica quién puede verlo."
          actions={<Button variant="secondary" size="sm" icon={Upload} onClick={() => setShowUpload(true)}>Subir archivos</Button>}
        />
        <div className="exp-file-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line">
          <FilterChips options={filters} value={category} onChange={setCategory} aria-label="Filtrar archivos por tipo" />
          <div className="exp-file-tools inline-flex gap-1" role="group" aria-label="Vista de archivos">
            <IconButton variant="ghost" size="sm" icon={LayoutGrid} aria-label="Vista de galería" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')} />
            <IconButton variant="ghost" size="sm" icon={List} aria-label="Vista de lista" aria-pressed={view === 'list'} onClick={() => setView('list')} />
          </div>
        </div>
        {error ? <ErrorState compact message={error} onRetry={loadFiles} /> : view === 'gallery' ? (
          <div className="p-(--card-pad)">
            {loading ? <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"><Skeleton.Card /><Skeleton.Card /><Skeleton.Card /></div>
              : !filteredFiles.length ? <EmptyState compact icon={Paperclip} title={files.length ? 'Sin archivos de este tipo' : 'No hay archivos subidos'} description={files.length ? 'Prueba con otro filtro para ver el resto del material.' : 'Sube documentos, fotos o videos para el expediente.'} primaryAction={<Button size="sm" variant="secondary" onClick={files.length ? () => setCategory('all') : () => setShowUpload(true)}>{files.length ? 'Ver todos los archivos' : 'Subir archivos'}</Button>} />
                : <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-label="Galería de archivos del expediente">
                  {filteredFiles.map(f => {
                    const cat = CATS[categoriaArchivo(f)] || CATS.other;
                    const Icon = cat.icon;
                    const photo = categoriaArchivo(f) === 'image';
                    return <li key={f.id} className="exp-file-card rounded-lg border border-line min-w-0 overflow-hidden">
                      <div className="exp-file-card__preview h-36 bg-canvas flex flex-col items-center justify-center gap-2 border-b border-line">
                        {photo ? thumbnail(f, Icon) : <><Icon size={38} className="text-brand-600" /><Badge size="sm">{f.mime_type === 'application/pdf' ? 'PDF' : cat.label}</Badge></>}
                      </div>
                      <div className="exp-file-card__body p-3">
                        <p className="exp-file-card__name text-13 font-medium text-ink-900 break-all" title={f.original_name}>{f.original_name}</p>
                        <p className="exp-file-card__meta text-xs text-ink-500 mt-1">{f.file_size_formatted || fmtBytes(f.file_size)} · {fmtDate(f.created_at)}</p>
                        <div className="flex flex-wrap gap-1 mt-2 empty:hidden"><ChipsArchivo f={f} /></div>
                        <div className="flex flex-wrap items-start gap-1 mt-3 pt-2 border-t border-line">
                          {photo ? <IconButton size="sm" icon={Eye} aria-label={`Ver ${f.original_name}`} onClick={() => openImage(f)} /> : <FileOpen file={f} className={actionClass} />}
                          <FileDownload file={f} label={`Descargar ${f.original_name}`} className="inline-flex items-center justify-center gap-1.5 h-8 px-2 text-13 font-medium text-ink-700 rounded-md hover:bg-neutral-bg"><span className="hidden sm:inline">Descargar</span></FileDownload>
                          <IconButton size="sm" icon={Trash} aria-label={`Eliminar ${f.original_name}`} onClick={() => handleDeleteFile(f)} className="ml-auto" />
                        </div>
                      </div>
                    </li>;
                  })}
                </ul>}
          </div>
        ) : <DataTable
          aria-label="Archivos del expediente"
          columns={columns}
          data={filteredFiles}
          rowKey={f => f.id}
          loading={loading}
          loadingRows={3}
          pageSize={0}
          rowActions={f => [{ label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDeleteFile(f) }]}
          emptyState={<EmptyState compact icon={Paperclip} title="No hay archivos subidos" description="Sube documentos, fotos o videos para el cliente." primaryAction={<Button size="sm" variant="secondary" icon={Upload} onClick={() => setShowUpload(true)}>Subir archivos</Button>} />}
          mobileCard={f => {
            const cat = CATS[f.category || fileCategory(f.mime_type)] || CATS.other;
            return (
              <div className="min-w-0 space-y-2">
                {thumbnail(f, cat.icon)}
                <p className="font-medium text-ink-900 truncate">{f.original_name}</p>
                <p className="text-13 text-ink-500">{cat.label} · {f.file_size_formatted || fmtBytes(f.file_size)} · {fmtDate(f.created_at)}</p>
                <p className="flex flex-wrap gap-1.5 mt-1 empty:hidden"><ChipsArchivo f={f} /></p>
                <div className="flex gap-3">{categoriaArchivo(f) === 'image' ? <Button variant="ghost" size="sm" icon={Eye} onClick={() => openImage(f)}>Ver</Button> : <FileOpen file={f} className="inline-flex items-center gap-1 text-13 font-medium text-brand-600">Ver</FileOpen>}<FileDownload file={f} className="inline-flex items-center gap-1 text-13 font-medium text-brand-600">Descargar</FileDownload></div>
              </div>
            );
          }}
        />}
      </Card>

      <Lightbox open={preview !== null} items={items} index={preview ?? 0} onIndexChange={setPreview} onClose={() => setPreview(null)} />

      <Modal
        open={showUpload}
        onClose={uploading ? undefined : cerrarSubida}
        title="Subir archivos"
        description="Quedan en el expediente y, si quieres, se le avisa al cliente por correo."
        size="md"
        footer={(
          <>
            <Button variant="secondary" onClick={cerrarSubida} disabled={uploading}>Cancelar</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={pending.length === 0}>Subir {pending.length > 0 ? `(${pending.length})` : ''}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Dropzone multiple onFiles={handleFilesSelected} label="Arrastra los archivos o haz clic para elegirlos" hint="PDF, imágenes, videos o documentos" disabled={uploading} />

          {pending.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-md" aria-label="Archivos seleccionados">
              {pending.map((f, i) => {
                const cat = CATS[f.type ? fileCategory(f.type) : 'other'];
                const Icon = cat.icon;
                return (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <Icon size={16} className="text-ink-500 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{f.name}</span>
                    <span className="text-xs text-ink-500 tabular shrink-0">{fmtBytes(f.size)}</span>
                    <IconButton size="sm" icon={X} aria-label={`Quitar ${f.name}`} onClick={() => setPending(p => p.filter((_, j) => j !== i))} disabled={uploading} />
                  </li>
                );
              })}
            </ul>
          )}

          <Input label="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej.: Oferta firmada por el vendedor" disabled={uploading} />
          <Checkbox label="Avisar al cliente por correo" checked={notifyClient} onChange={e => setNotifyClient(e.target.checked)} disabled={uploading} />
        </div>
      </Modal>
    </>
  );
}
