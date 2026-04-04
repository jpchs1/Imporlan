import { useState, useEffect, useCallback, useRef } from 'react';
import { getExpedienteFiles, deleteExpedienteFile, uploadExpedienteFiles } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { Card, Button, Input } from './UI';
import { useToast } from './Toast';

function fileCategory(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('excel') || mime.includes('sheet') || mime.includes('presentation') || mime.includes('text')) return 'document';
  return 'other';
}

const CAT_STYLES = {
  image:    { bg: 'bg-violet-500', label: 'IMG' },
  video:    { bg: 'bg-red-500',    label: 'VID' },
  document: { bg: 'bg-blue-500',   label: 'DOC' },
  other:    { bg: 'bg-slate-500',  label: 'FILE' },
};

export default function FilesSection({ orderId }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [pending, setPending] = useState([]);
  const [description, setDescription] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getExpedienteFiles(orderId);
      setFiles(data.success && data.files ? data.files : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  function handleFilesSelected(fileList) {
    setPending(Array.from(fileList));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }

  async function handleUpload() {
    if (pending.length === 0) { toast?.('Selecciona archivos para subir', 'error'); return; }
    setUploading(true);
    try {
      const data = await uploadExpedienteFiles(orderId, pending, description, notifyClient);
      if (data.success) {
        let msg = `${data.count} archivo${data.count > 1 ? 's' : ''} subido${data.count > 1 ? 's' : ''} correctamente`;
        if (notifyClient) msg += '. Cliente notificado.';
        toast?.(msg, 'success');
        setPending([]);
        setDescription('');
        setShowUpload(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadFiles();
        if (data.errors && data.errors.length > 0) {
          toast?.('Algunos archivos fallaron: ' + data.errors.join(', '), 'error');
        }
      } else {
        toast?.(data.error || 'Error al subir archivos', 'error');
      }
    } catch (e) { toast?.('Error de conexion al subir archivos', 'error'); }
    setUploading(false);
  }

  async function handleDeleteFile(fileId) {
    if (!confirm('Eliminar este archivo?')) return;
    try {
      const data = await deleteExpedienteFile(fileId);
      if (data.success) { toast?.('Archivo eliminado', 'success'); loadFiles(); }
      else toast?.(data.error || 'Error al eliminar', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
  }

  return (
    <Card className="mb-5">
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 -m-6 mb-4 px-7 py-5 rounded-t-2xl border-b border-emerald-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Documentos del Expediente</h3>
            <p className="text-xs text-slate-400">Sube archivos, imagenes, videos y documentos para el cliente</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 !bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Subir Archivos
        </Button>
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="mb-4 p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50'}`}
          >
            <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="text-sm text-slate-500 font-medium">Arrastra archivos aqui o haz click para seleccionar</p>
            <p className="text-xs text-slate-400 mt-1">PDF, imagenes, videos, documentos</p>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFilesSelected(e.target.files)} />

          {/* Preview selected files */}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pending.map((f, i) => {
                const cat = f.type ? fileCategory(f.type) : 'other';
                const s = CAT_STYLES[cat];
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                    <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                      <span className="text-white text-[10px] font-bold">{s.label}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 max-w-[200px] truncate">{f.name}</p>
                      <p className="text-[10px] text-slate-400">{formatSize(f.size)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Input label="Descripcion (opcional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripcion de los archivos..." />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={notifyClient} onChange={e => setNotifyClient(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            Notificar al cliente
          </label>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setShowUpload(false); setPending([]); }}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || pending.length === 0}
              className="flex items-center gap-1.5">
              {uploading ? (
                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Subiendo...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Subir</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Files list */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Cargando archivos...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-slate-300">
          <svg className="w-8 h-8 mx-auto mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p className="text-sm">No hay archivos subidos.</p>
          <p className="text-xs mt-1">Usa el boton "Subir Archivos" para agregar documentos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => {
            const cat = f.category || fileCategory(f.mime_type);
            const s = CAT_STYLES[cat] || CAT_STYLES.other;
            const isPreviewable = cat === 'image' || f.mime_type === 'application/pdf' || cat === 'video';
            return (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition">
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <span className="text-white text-[10px] font-bold">{s.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{f.original_name}</p>
                  <p className="text-xs text-slate-400">
                    {f.file_size_formatted || formatSize(f.file_size)} · {fmtDate(f.created_at)}
                    {f.description ? ` · ${f.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {isPreviewable && (
                    <a href={f.download_url} target="_blank" rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-white transition flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Ver
                    </a>
                  )}
                  <a href={f.download_url} download
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-white transition flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Descargar
                  </a>
                  <button onClick={() => handleDeleteFile(f.id)}
                    className="px-2 py-1 rounded-lg border border-red-200 text-red-500 text-[11px] font-medium hover:bg-red-50 transition flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
