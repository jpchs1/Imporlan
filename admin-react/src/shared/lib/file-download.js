// Only the expediente API at our own origin may receive a session token.
// Never attach it to report URLs, CDNs, or links supplied by uploaded data.
export async function fetchPrivateFile(src) {
  const url = new URL(src, window.location.href);
  const privateFile = url.origin === window.location.origin
    && /^\/(?:test\/)?api\/expediente_files_api\.php$/.test(url.pathname)
    && url.searchParams.get('action') === 'download';
  const options = { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(120000) };
  let response = await fetch(url.href, options);
  if (response.status === 403 && privateFile) {
    const admin = /\/panel\/admin(?:\/|$)/.test(window.location.pathname);
    const token = localStorage.getItem(admin ? 'token' : 'imporlan_token');
    if (token) response = await fetch(url.href, { ...options, headers: { Authorization: `Bearer ${token}` } });
  }
  const mime = response.headers.get('content-type') || '';
  if (!response.ok || /(?:application\/json|text\/html)/i.test(mime)) {
    const detail = /application\/json/i.test(mime) ? await response.json().catch(() => ({})) : {};
    throw new Error(detail.error || 'No se pudo abrir el archivo. Actualiza el expediente e inténtalo de nuevo.');
  }
  return response;
}

export async function downloadFile(file) {
  const src = file.download_url || file.downloadUrl;
  if (!src) throw new Error('Este archivo no tiene un enlace de descarga.');
  if (new URL(src, window.location.href).origin !== window.location.origin) {
    window.open(src, '_blank', 'noopener');
    return;
  }
  const response = await fetchPrivateFile(src);
  const blob = await response.blob();
  if (!blob.size) throw new Error('El archivo está vacío.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.original_name || file.originalName || file.alt || 'archivo';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start reading before releasing the original.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openFile(file) {
  const src = file.download_url;
  if (!src) throw new Error('Este archivo no tiene un enlace.');
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Permite las ventanas emergentes para abrir el archivo.');
  tab.opener = null;
  try {
    const response = await fetchPrivateFile(src);
    const blob = await response.blob();
    if (!blob.size) throw new Error('El archivo está vacío.');
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    tab.close();
    throw error;
  }
}
