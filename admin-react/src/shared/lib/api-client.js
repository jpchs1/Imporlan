// The panel can live at /panel/user/ (prod) or /test/panel/user/ (preview),
// but auth (login, /auth/google) and the data endpoints all live at /api in
// production. The /test/api/ proxy is a stub: it does NOT serve /auth/google
// and most of the user data lives in the prod database. So we always talk
// to /api regardless of where the panel HTML is hosted.
const API_BASE = '/api';

// Cuando el token vence, la sesion se cae en mitad de una pantalla ya montada.
// Limpiar localStorage no alcanza: AuthContext guarda el token en estado de
// React y seguiria creyendo que hay sesion, asi que avisamos por evento para
// que el arbol entero se entere y el router mande al login.
const SESSION_EXPIRED_EVENT = 'imporlan:session-expired';

export { API_BASE, SESSION_EXPIRED_EVENT };

export function createApiClient(storageKeys = { token: 'token', user: 'user' }) {
  function getToken() {
    return localStorage.getItem(storageKeys.token);
  }

  function getUserData() {
    try { return JSON.parse(localStorage.getItem(storageKeys.user) || '{}'); } catch { return {}; }
  }

  function getUserEmail() {
    const u = getUserData();
    return u.email || u.user_email || '';
  }

  function authHeaders() {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const email = getUserEmail();
    if (email) headers['X-User-Email'] = email;
    return headers;
  }

  async function request(url, options = {}) {
    const isGet = !options.method || options.method === 'GET';
    const baseHeaders = isGet ? { ...authHeaders() } : { 'Content-Type': 'application/json', ...authHeaders() };
    const headers = { ...baseHeaders, ...options.headers };
    // Con que token sale ESTA peticion. Se guarda antes del fetch porque para
    // cuando vuelva el 401 puede haber otro guardado (ver mas abajo).
    const tokenEnviado = getToken();
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Timeout: el servidor no respondio');
      throw new Error('Error de conexion');
    }
    if (res.status === 401) {
      const tokenActual = getToken();
      // Un 401 solo habla del token con el que salio su peticion. Una pantalla
      // dispara varias llamadas a la vez y alguna puede tardar: si el usuario
      // ya volvio a entrar cuando llega ese 401 atrasado, el token vigente es
      // otro y borrarlo lo expulsaria de la sesion que acaba de abrir.
      if (tokenActual && tokenActual !== tokenEnviado) {
        throw new Error('No autorizado');
      }
      // El primer 401 borra el token; los que vengan detras ya no encuentran
      // nada y no repiten el aviso. Asi no hace falta un flag que se quede
      // pegado y deje muda la proxima expiracion, despues de volver a entrar.
      if (tokenActual || getUserData().email) {
        localStorage.removeItem(storageKeys.token);
        localStorage.removeItem(storageKeys.user);
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { storageKeys } }));
      }
      throw new Error('No autorizado');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
      throw new Error(err.detail || err.error || `Error ${res.status}`);
    }
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Respuesta invalida del servidor');
    }
  }

  async function uploadFile(url, formData) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    const text = await res.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { error: 'Respuesta invalida' }; }
  }

  return { request, uploadFile, getToken, getUserEmail, authHeaders, API_BASE };
}
