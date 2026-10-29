import { createApiClient, SESSION_EXPIRED_EVENT } from '../shared/lib/api-client';
import { STORAGE_KEYS } from './config';

const client = createApiClient(STORAGE_KEYS);
const { request, uploadFile, getToken, getUserEmail, API_BASE } = client;

/**
 * Como `request`/`uploadFile`, pero el error que lanza conserva lo que mandó
 * el servidor: `status`, `code` (p. ej. 'faltan_datos') y `errores` por campo.
 * Para las respuestas en que el panel tiene que distinguir el motivo, no sólo
 * mostrar el mensaje. `body` es un objeto (va como JSON) o un FormData.
 */
async function requestDetallado(url, { body, timeoutMs = 15000, method = 'POST' } = {}) {
  const tokenEnviado = getToken();
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const esGet = method === 'GET';
  const headers = { ...(multipart || esGet ? {} : { 'Content-Type': 'application/json' }), ...(tokenEnviado ? { Authorization: `Bearer ${tokenEnviado}` } : {}) };
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    res = await fetch(url, { method, headers, body: esGet ? undefined : multipart ? body : JSON.stringify(body || {}), signal: controller.signal });
    clearTimeout(timeout);
  } catch (e) {
    throw new Error(e?.name === 'AbortError' ? 'El servidor tardó demasiado en responder. Vuelve a intentarlo.' : 'Error de conexión. Revisa tu internet y vuelve a intentarlo.');
  }
  if (res.status === 401) {
    // Mismo cierre de sesión que api-client: sólo si el token sigue siendo éste.
    if (!getToken() || getToken() === tokenEnviado) {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { storageKeys: STORAGE_KEYS } }));
    }
    throw new Error('No autorizado');
  }
  const text = await res.text();
  let json = {};
  if (text) {
    try { json = JSON.parse(text); } catch { json = { error: 'Respuesta inválida del servidor' }; }
  }
  if (!res.ok) {
    const err = new Error(json.detail || json.error || `Error ${res.status}`);
    err.status = res.status;
    err.code = json.code || null;
    err.errores = json.errores && typeof json.errores === 'object' ? json.errores : null;
    throw err;
  }
  return json;
}

function userJson() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}'); } catch { return {}; }
}

// Auth
export const login = (email, password) =>
  request(`${API_BASE}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const verify2FA = (code, tempToken) =>
  request(`${API_BASE}/auth/verify-2fa`, { method: 'POST', body: JSON.stringify({ code, temp_token: tempToken }) });

export const getMe = () => request(`${API_BASE}/auth/me`);

// Manda al correo del cliente un enlace para crear una contrasena nueva. El
// servidor contesta lo mismo exista o no la cuenta, para que el formulario no
// sirva para averiguar quien es cliente de Imporlan.
//
// El plazo es mas largo que los 15 s de siempre porque la respuesta espera a
// que salga el correo, y solo abrir la conexion SMTP puede tardar 30 s. Con el
// plazo corto el cliente veia "Timeout" mientras el correo si iba en camino, y
// al reintentar gastaba otra de sus tres solicitudes por hora.
export const forgotPassword = (email) =>
  request(`${API_BASE}/user_forgot_password.php`, {
    method: 'POST',
    body: JSON.stringify({ email }),
    timeoutMs: 45000,
  });

export const googleAuth = (credential) =>
  request(`${API_BASE}/auth/google`, { method: 'POST', body: JSON.stringify({ credential }) });

export const updateProfile = (data) =>
  request(`${API_BASE}/auth/update-profile`, { method: 'POST', body: JSON.stringify(data) });

export async function uploadAvatar(file) {
  const fd = new FormData();
  fd.append('avatar', file);
  return uploadFile(`${API_BASE}/auth/upload-avatar`, fd);
}

// Orders (user view)
export const getMyOrders = () => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/orders_api.php?action=user_list&user_email=${encodeURIComponent(email)}`);
};

export const getMyOrderDetail = (id) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/orders_api.php?action=user_detail&id=${id}&user_email=${encodeURIComponent(email)}`);
};

export const saveRanking = (orderId, linkIds) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/orders_api.php?action=save_ranking`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, link_ids: linkIds, author_name: user.name || '', author_role: 'user', user_email: email }),
  });
};

export const notifyRanking = (orderId) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/orders_api.php?action=notify_ranking`, {
    method: 'POST',
    body: JSON.stringify({ order_id: parseInt(orderId), author_name: user.name || '', author_role: 'user', user_email: email }),
  });
};

// Elegir la lancha e importar (eleccion_lancha.php). La sesión va en el
// Bearer que ya pone `request`; el servidor valida que el expediente sea del
// cliente y responde con un `error` legible (403/404/409) que se muestra tal cual.
// Con 409 y `code: 'faltan_datos'` el asistente vuelve al paso «Tus datos»;
// por eso va con requestDetallado (conserva el código del servidor).
export const chooseLink = (orderId, linkId, inspection, note = '') =>
  requestDetallado(`${API_BASE}/orders_api.php?action=user_choose_link`, {
    body: { order_id: parseInt(orderId), link_id: parseInt(linkId), inspection: !!inspection, note: String(note || '').slice(0, 1000) },
  });

// Datos del cliente, cédula por ambos lados y Términos (user_import_data).
// GET: lo que hay (de este expediente o precargado de otro). POST multipart:
// los 10 campos + acepta_terminos, terminos_version, reusar_cedula y los
// archivos ci_frente / ci_reverso. Con 400 el error trae `errores` por campo.
export const getImportData = (orderId) =>
  request(`${API_BASE}/orders_api.php?action=user_import_data&order_id=${encodeURIComponent(orderId)}`);

export function saveImportData(orderId, { datos, aceptaTerminos, terminosVersion, reusarCedula, ciFrente, ciReverso }) {
  const fd = new FormData();
  fd.append('order_id', String(orderId));
  for (const [k, v] of Object.entries(datos || {})) fd.append(k, String(v ?? '').trim());
  if (aceptaTerminos) fd.append('acepta_terminos', '1');
  if (terminosVersion) fd.append('terminos_version', String(terminosVersion));
  if (reusarCedula) fd.append('reusar_cedula', '1');
  if (ciFrente) fd.append('ci_frente', ciFrente, ciFrente.name);
  if (ciReverso) fd.append('ci_reverso', ciReverso, ciReverso.name);
  return requestDetallado(`${API_BASE}/orders_api.php?action=user_import_data`, { body: fd, timeoutMs: 120000 });
}

export const unchooseLink = (orderId) =>
  request(`${API_BASE}/orders_api.php?action=user_unchoose_link`, {
    method: 'POST',
    body: JSON.stringify({ order_id: parseInt(orderId) }),
  });

// Inspección no apta: en vez de elegir otra lancha, el cliente pide la
// devolución del Pago 1 (user_pedir_devolucion). Responde {success, eleccion,
// pago1_pagado}; 409 con mensaje si la inspección no salió no apta.
export const pedirDevolucion = (orderId) =>
  requestDetallado(`${API_BASE}/orders_api.php?action=user_pedir_devolucion`, {
    body: { order_id: parseInt(orderId) },
  });

// El reporte de la inspección (user_inspeccion_reporte): el original en
// inglés (enlace firmado por 1 hora) y la traducción al español en bloques
// ({t:'h'|'p'|'ul'|'table'}). 404 si el equipo aún no lo carga.
export const inspeccionReporte = (orderId) =>
  requestDetallado(`${API_BASE}/orders_api.php?action=user_inspeccion_reporte&order_id=${encodeURIComponent(orderId)}`, { method: 'GET' });

// El cliente leyó el reporte y decide (user_inspeccion_decision): 'aprobar'
// marca el hito y crea el Pago 2 ({eleccion, pago}); 'declinar' deja la
// lancha fuera ({eleccion}) y después elige otra o pide la devolución. 409 si
// aún no hay reporte o si ya decidió.
export const inspeccionDecision = (orderId, decision, motivo = '') =>
  requestDetallado(`${API_BASE}/orders_api.php?action=user_inspeccion_decision`, {
    body: { order_id: parseInt(orderId), decision, motivo: String(motivo || '').trim().slice(0, 1000) },
  });

// Marketplace (user)
export const getMarketplaceListings = () => request(`${API_BASE}/marketplace_api.php?action=list`);

export const getMyListings = () => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/marketplace_api.php?action=my_listings&user_email=${encodeURIComponent(email)}`);
};

export const createListing = (data) =>
  request(`${API_BASE}/marketplace_api.php?action=create`, { method: 'POST', body: JSON.stringify(data) });

export const updateListing = (data) =>
  request(`${API_BASE}/marketplace_api.php?action=update`, { method: 'POST', body: JSON.stringify(data) });

export const deleteListing = (id) =>
  request(`${API_BASE}/marketplace_api.php?action=delete`, { method: 'POST', body: JSON.stringify({ id }) });

export const renewListing = (id) =>
  request(`${API_BASE}/marketplace_api.php?action=renew`, { method: 'POST', body: JSON.stringify({ id }) });

export const markListingSold = (id) =>
  request(`${API_BASE}/marketplace_api.php?action=mark_sold`, { method: 'POST', body: JSON.stringify({ id }) });

export async function uploadListingPhoto(listingId, file) {
  const fd = new FormData();
  fd.append('listing_id', listingId);
  fd.append('photo', file);
  return uploadFile(`${API_BASE}/marketplace_api.php?action=upload_photo`, fd);
}

// Tracking (user - read only, public endpoints)
export const getFeaturedVessels = () =>
  request(`${API_BASE}/tracking_api.php?action=featured`);

export const getVesselDetail = (id) =>
  request(`${API_BASE}/tracking_api.php?action=vessel_detail&id=${id}`);

export const getVesselPositions = (id, limit = 100) =>
  request(`${API_BASE}/tracking_api.php?action=vessel_positions&id=${id}&limit=${limit}`);

export const refreshVesselPosition = (id) =>
  request(`${API_BASE}/tracking_api.php?action=refresh_vessel_position&id=${id}`);

// Chat / Messages
export const getMyConversations = () => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/chat_api.php?action=user_conversations&user_email=${encodeURIComponent(email)}`);
};

export const getMessages = (conversationId) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/chat_api.php?action=user_messages&conversation_id=${conversationId}&user_email=${encodeURIComponent(email)}`);
};

export const sendMessage = (conversationId, message) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/chat_api.php?action=user_send`, {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, message, user_email: email }),
  });
};

export const startConversation = (subject, message) => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/chat_api.php?action=user_start_conversation`, {
    method: 'POST',
    body: JSON.stringify({ subject, message, user_email: email, user_name: user.name || '' }),
  });
};

export const pollMessages = (lastCheck, conversationId) => {
  const user = userJson();
  const email = getUserEmail();
  const params = new URLSearchParams({ action: 'poll', user_email: email });
  if (lastCheck) params.append('last_check', lastCheck);
  if (conversationId) params.append('conversation_id', conversationId);
  return request(`${API_BASE}/chat_api.php?${params}`);
};

// Documents (user files)
export const getMyFiles = (orderId) => request(`${API_BASE}/expediente_files_api.php?action=list&order_id=${orderId}`);

// Reports (user - read only)
export const getMyReports = () => {
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/reports_api.php?action=user_reports&user_email=${encodeURIComponent(email)}`).catch(() => ({ reports: [] }));
};

// Inspections (user - read only)
export const getMyInspections = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/inspection_reports_api.php?action=user_list&user_email=${encodeURIComponent(email)}`).catch(() => ({ reports: [] }));
};

export const getInspectionDetail = (id) => {
  const email = getUserEmail();
  return request(`${API_BASE}/inspection_reports_api.php?action=user_detail&id=${id}&user_email=${encodeURIComponent(email)}`);
};

// Purchases / Plans
export const getMyPurchases = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/purchases.php?action=get&user_email=${encodeURIComponent(email)}`).catch(() => ({ plans: [], links: [] }));
};

// Notifications / Alerts
export const getNotifications = (limit = 30) => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=list&user_email=${encodeURIComponent(email)}&limit=${limit}`).catch(() => ({ notifications: [] }));
};

export const getUnreadCount = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=unread_count&user_email=${encodeURIComponent(email)}`).catch(() => ({ unread_count: 0 }));
};

export const markNotificationRead = (id) =>
  request(`${API_BASE}/notifications_api.php?action=mark_read`, { method: 'POST', body: JSON.stringify({ id }) });

export const markAllNotificationsRead = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=mark_all_read`, { method: 'POST', body: JSON.stringify({ user_email: email }) });
};

// Support
export const submitSupportRequest = (data) =>
  request(`${API_BASE}/support_api.php`, { method: 'POST', body: JSON.stringify(data) });

// Payments (user)
export const getMyPaymentRequests = (status = 'all') => {
  const email = getUserEmail();
  return request(`${API_BASE}/payment_requests_api.php?action=user_list_public&user_email=${encodeURIComponent(email)}&status=${status}`);
};

// Payment gateways
export const createWebPayTransaction = (data) =>
  request(`${API_BASE}/webpay.php?action=create_transaction`, { method: 'POST', body: JSON.stringify(data) });

export const createMercadoPagoPreference = (data) =>
  request(`${API_BASE}/mercadopago.php?action=create_preference`, { method: 'POST', body: JSON.stringify(data) });

export const getPayPalClientId = () =>
  request(`${API_BASE}/paypal.php?action=get_client_id`);

export const createPayPalOrder = (data) =>
  request(`${API_BASE}/paypal.php?action=create_order`, { method: 'POST', body: JSON.stringify(data) });

export const capturePayPalOrder = (orderId) =>
  request(`${API_BASE}/paypal.php?action=capture_order`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
