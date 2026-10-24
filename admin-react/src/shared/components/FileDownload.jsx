import { useState } from 'react';
import { downloadFile, openFile } from '../lib/file-download';
import { Download, Eye } from './Icons';

/** A failed API response is shown to the user, never saved as a .json file. */
function FileAction({ file, children, className = '', label, iconSize = 14, preview = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download(e) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError('');
    try { await (preview ? openFile(file) : downloadFile(file)); }
    catch (e) { setError(e.message || 'No se pudo descargar el archivo.'); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-start min-w-0 max-w-full">
    <button type="button" className={className} disabled={busy} aria-label={label || `${preview ? 'Ver' : 'Descargar'} ${file.original_name || file.originalName || file.alt || 'archivo'}`} aria-busy={busy} onClick={download} title={busy ? 'Preparando archivo…' : label}>
      {preview ? <Eye size={iconSize} /> : <Download size={iconSize} />}{children}
    </button>
    {error && <span role="alert" className="mt-1 text-xs text-danger break-words max-w-64">{error}</span>}
  </span>;
}

export function FileDownload(props) { return <FileAction {...props} />; }
export function FileOpen(props) { return <FileAction {...props} preview />; }
