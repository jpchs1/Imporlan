const isTest = window.location.pathname.includes('/test/');
const API_BASE = isTest ? '/test/api' : '/api';

export { API_BASE };

export function createApiClient(storageKeys = { token: 'token', user: 'user' }) {
  function getToken() {
    return localStorage.getItem(storageKeys.token);
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers };
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
      localStorage.removeItem(storageKeys.token);
      localStorage.removeItem(storageKeys.user);
      window.location.hash = '#/login';
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

  return { request, uploadFile, getToken, authHeaders, API_BASE };
}
