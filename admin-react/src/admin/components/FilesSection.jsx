import { useState } from 'react';
import { deleteExpedienteFile, uploadExpedienteFiles } from '../api';
import { fmtDate } from '../../shared/lib/utils';
import { fmtBytes } from '../../shared/lib/format';
import { ORIGEN_ARCHIVO_USA, DESCRIPCION_ARCHIVO_USA } from '../../shared/lib/importacion';
import { Card, Button, IconButton, Input, Checkbox, Modal, Dropzone, DataTable, Badge, EmptyState, useConfirm } from '../../shared/components/UI';
import { Upload, Eye, Download, Trash, X, Image as ImageIcon, Video, FileText, File as FileIcon, Paperclip } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useExpedienteFiles, categoriaArchivo } from './useExpedienteFiles';

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
   allá; «Sólo equipo» si el cliente no lo ve (sus PDF, hasta que se comparten). */
export function ChipsArchivo({ f, size = 'sm' }) {
  const deUsa = f.uploaded_by === ORIGEN_ARCHIVO_USA;
  const interno = f.visible_to_client !== undefined && f.visible_to_client !== null && Number(f.visible_to_client) === 0;
  if (!deUsa && !interno) return null;
  return (
    <>
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
  const { files, loading, recargar: loadFiles } = archivos || propios;
  const [showUpload, setShowUpload] = useState(false);
  const [pending, setPending] = useState([]);
  const [description, setDescription] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [uploading, setUploading] = useState(false);

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
    if (!(await confirm({ title: '¿Eliminar este archivo?', description: `${f.original_name} deja de estar disponible para el cliente. No se puede deshacer.`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
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
            <span className="h-8 w-8 rounded-md bg-neutral-bg text-ink-500 flex items-center justify-center shrink-0" aria-hidden="true"><Icon size={16} /></span>
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
            {previewable && <IconButton size="sm" icon={Eye} aria-label={`Ver ${f.original_name}`} onClick={() => window.open(f.download_url, '_blank', 'noopener')} />}
            <a href={f.download_url} download aria-label={`Descargar ${f.original_name}`} title={`Descargar ${f.original_name}`} className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent text-ink-700 hover:bg-neutral-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"><Download size={14} /></a>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <Card>
        <Card.Header
          title="Archivos"
          description="Documentos, fotos y videos del expediente. El cliente ve todos salvo los marcados «Sólo equipo»."
          actions={<Button variant="secondary" size="sm" icon={Upload} onClick={() => setShowUpload(true)}>Subir archivos</Button>}
        />
        <DataTable
          aria-label="Archivos del expediente"
          columns={columns}
          data={files}
          rowKey={f => f.id}
          loading={loading}
          loadingRows={3}
          pageSize={0}
          rowActions={f => [{ label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDeleteFile(f) }]}
          emptyState={<EmptyState compact icon={Paperclip} title="No hay archivos subidos" description="Sube documentos, fotos o videos para el cliente." primaryAction={<Button size="sm" variant="secondary" icon={Upload} onClick={() => setShowUpload(true)}>Subir archivos</Button>} />}
          mobileCard={f => {
            const cat = CATS[f.category || fileCategory(f.mime_type)] || CATS.other;
            return (
              <div className="min-w-0">
                <p className="font-medium text-ink-900 truncate">{f.original_name}</p>
                <p className="text-13 text-ink-500">{cat.label} · {f.file_size_formatted || fmtBytes(f.file_size)} · {fmtDate(f.created_at)}</p>
                <p className="flex flex-wrap gap-1.5 mt-1 empty:hidden"><ChipsArchivo f={f} /></p>
                <a href={f.download_url} download className="inline-flex items-center gap-1 mt-1.5 text-13 font-medium text-brand-600 hover:underline"><Download size={14} /> Descargar</a>
              </div>
            );
          }}
        />
      </Card>

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
