import { createApiClient } from '../shared/lib/api-client';
import { STORAGE_KEYS } from './config';

const { request, uploadFile, getToken, getUserEmail, API_BASE } = createApiClient(STORAGE_KEYS);

// Auth
export const login = (email, password) =>
  request(`${API_BASE}/admin_api.php?action=login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const verify2FA = (code, tempToken) =>
  request(`${API_BASE}/auth/verify-2fa`, { method: 'POST', body: JSON.stringify({ code, temp_token: tempToken }) });

export const forgotPassword = (email) =>
  request(`${API_BASE}/admin_forgot_password.php`, { method: 'POST', body: JSON.stringify({ email }) });

// Profile (admin)
export const getProfile = () => request(`${API_BASE}/admin_profile.php`);
export const updateProfileName = (name) =>
  request(`${API_BASE}/admin_profile.php`, { method: 'POST', body: JSON.stringify({ action: 'update_profile', name }) });
// Cambiar la contrasena cierra las demas sesiones de la cuenta. El servidor
// devuelve un token nuevo para que ESTA siga abierta; sin guardarlo, quien
// acaba de cambiar su clave se expulsaria a si mismo en la peticion siguiente.
export const changeProfilePassword = async (currentPassword, newPassword, confirmPassword) => {
  const res = await request(`${API_BASE}/admin_profile.php`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'change_password',
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  if (res?.access_token) localStorage.setItem(STORAGE_KEYS.token, res.access_token);
  return res;
};
export async function uploadProfilePhoto(file) {
  const fd = new FormData();
  fd.append('action', 'update_photo');
  fd.append('avatar', file);
  return uploadFile(`${API_BASE}/admin_profile.php`, fd);
}

// Dashboard
export const getDashboard = () => request(`${API_BASE}/admin_api.php?action=dashboard`);

// Users (real users from purchases)
export const getUsers = () => request(`${API_BASE}/admin_api.php?action=users`);
export const getUserDetail = (email) => request(`${API_BASE}/admin_api.php?action=user&email=${encodeURIComponent(email)}`);

// Admin users (CRUD)
export const getAdminUsers = () => request(`${API_BASE}/users_api.php?action=list`);
export const createAdminUser = (data) =>
  request(`${API_BASE}/users_api.php?action=create`, { method: 'POST', body: JSON.stringify(data) });
export const updateAdminUser = (data) =>
  request(`${API_BASE}/users_api.php?action=update`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAdminUser = (id) =>
  request(`${API_BASE}/users_api.php?action=delete`, { method: 'POST', body: JSON.stringify({ id }) });

// Purchases
export const getPurchases = () => request(`${API_BASE}/admin_api.php?action=purchases`);
export const updatePurchaseStatus = (purchaseId, status) =>
  request(`${API_BASE}/admin_api.php?action=update_purchase_status`, { method: 'POST', body: JSON.stringify({ purchase_id: purchaseId, status }) });

// Orders (Expedientes)
export const getOrders = (filters = {}) => {
  const params = new URLSearchParams({ action: 'admin_list' });
  Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
  return request(`${API_BASE}/orders_api.php?${params}`);
};
export const getOrderDetail = (id) => request(`${API_BASE}/orders_api.php?action=admin_detail&id=${id}`);
export const updateOrder = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_update`, { method: 'POST', body: JSON.stringify(data) });
export const createOrder = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_create`, { method: 'POST', body: JSON.stringify(data) });
export const deleteOrder = (id) =>
  request(`${API_BASE}/orders_api.php?action=admin_delete`, { method: 'POST', body: JSON.stringify({ id }) });
export const addOrderLink = (orderId) =>
  request(`${API_BASE}/orders_api.php?action=admin_add_link`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const deleteOrderLink = (orderId, linkId) =>
  request(`${API_BASE}/orders_api.php?action=admin_delete_link`, { method: 'POST', body: JSON.stringify({ order_id: orderId, link_id: linkId }) });
export const updateOrderLinks = (orderId, links) =>
  request(`${API_BASE}/orders_api.php?action=admin_update_links`, { method: 'POST', body: JSON.stringify({ order_id: orderId, links }) });
// Una fila por llamada: con Plan B un link puede tardar minutos y el servidor
// web cortaria una peticion que las procese todas juntas.
export const rescrapeOrderLink = (orderId, rowIndex) =>
  request(`${API_BASE}/orders_api.php?action=admin_rescrape_links`, { method: 'POST', body: JSON.stringify({ order_id: orderId, row_index: rowIndex, only_empty: false }), timeoutMs: 150000 });
export const reorderOrderLinks = (orderId, linkIds, authorName) =>
  request(`${API_BASE}/orders_api.php?action=admin_reorder_links`, { method: 'POST', body: JSON.stringify({ order_id: orderId, link_ids: linkIds, author_name: authorName, author_role: 'admin' }) });
export const changeOrderStatus = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_change_status`, { method: 'POST', body: JSON.stringify(data) });
export const sendClientUpdate = (orderId) =>
  request(`${API_BASE}/orders_api.php?action=admin_send_client_update`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const notifyRanking = (orderId, authorName) =>
  request(`${API_BASE}/orders_api.php?action=notify_ranking`, { method: 'POST', body: JSON.stringify({ order_id: parseInt(orderId), author_name: authorName, author_role: 'admin' }) });

// Importación: la lancha elegida y sus hitos (reglas en api/eleccion_lancha.php).
// link_id 0 quita la elección; cambiar de lancha borra los hitos. Con
// request_pago1 el servidor crea el cobro del Pago 1 desde la cotización
// publicada y lo devuelve en `pago1` (null si no hay cotización publicada).
export const chooseLinkAdmin = (orderId, linkId, { inspection = false, note = '', notifyClient = false, requestPago1 = true } = {}) =>
  request(`${API_BASE}/orders_api.php?action=admin_choose_link`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, link_id: linkId, inspection, note, notify_client: notifyClient, request_pago1: !!requestPago1 }),
    timeoutMs: 45000,
  });

// Operación en EE. UU. (api/operador_usa.php): el feed de David, pedirle una
// actualización, compartirla con el cliente y renovar su link privado. Sólo
// admin y support. Pedir y compartir mandan correo: plazo largo.
export const getOperacionUsa = (orderId) => request(`${API_BASE}/operador_usa.php?r=admin_estado&order_id=${orderId}`);
export const pedirActualizacionUsa = (orderId, message = '') =>
  request(`${API_BASE}/operador_usa.php?r=admin_pedir`, { method: 'POST', body: JSON.stringify({ order_id: orderId, message }), timeoutMs: 45000 });
export const compartirActualizacionUsa = (updateId, text) =>
  request(`${API_BASE}/operador_usa.php?r=admin_compartir`, { method: 'POST', body: JSON.stringify({ update_id: updateId, text }), timeoutMs: 45000 });
export const nuevoLinkUsa = (orderId) =>
  request(`${API_BASE}/operador_usa.php?r=admin_nuevo_link`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const revisarPrecioInspeccion = (orderId, requestId, revision) =>
  request(`${API_BASE}/operador_usa.php?r=admin_precio_revisar`, { method: 'POST', body: JSON.stringify({ order_id: orderId, request_id: requestId, revision }) });
// Datos del cliente para la importación (nombre, RUT, dirección…), su cédula
// por ambos lados y la aceptación de los Términos. Sólo admin y support: trae
// enlaces firmados a la cédula que duran 1 hora (ci_frente_url, ci_reverso_url).
export const getImportDataAdmin = (orderId) => request(`${API_BASE}/orders_api.php?action=admin_import_data&order_id=${orderId}`);
export const setImportStep = (orderId, step, done, notifyClient = false) =>
  request(`${API_BASE}/orders_api.php?action=admin_set_import_step`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, step, done, notify_client: notifyClient }),
    timeoutMs: 45000,
  });
// Resultado de la inspección técnica: 'no_apta' con la nota para el cliente
// (va en su panel y en el correo), o null para deshacerlo. La aprobada se
// marca con el hito «inspeccion». Con notify manda correo: plazo largo.
export const inspeccionResultado = (orderId, resultado, nota = '', notify = false) =>
  request(`${API_BASE}/orders_api.php?action=admin_inspeccion_resultado`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, resultado: resultado || null, nota, notify_client: !!notify }),
    timeoutMs: 45000,
  });

// Cobros (solicitudes de pago). Crear y cambiar de estado mandan correo al
// cliente: por eso el plazo largo.
export const getPaymentRequestsAdmin = (userEmail = '') => {
  const params = new URLSearchParams({ action: 'admin_list', limit: 100 });
  if (userEmail) params.append('user_email', userEmail);
  return request(`${API_BASE}/payment_requests_api.php?${params}`);
};
export const createPaymentRequest = (data) =>
  request(`${API_BASE}/payment_requests_api.php?action=admin_create`, { method: 'POST', body: JSON.stringify(data), timeoutMs: 45000 });
export const updatePaymentRequestStatus = (requestId, newStatus, extra = {}) =>
  request(`${API_BASE}/payment_requests_api.php?action=update_status`, {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, new_status: newStatus, ...extra }),
    timeoutMs: 45000,
  });

// Inspections
export const getInspections = () => request(`${API_BASE}/inspection_api.php?action=admin_list`);

// Tracking
// Puede consultar AIS en vivo para barcos sin posición: más plazo que el normal.
export const getVessels = () => request(`${API_BASE}/tracking_api.php?action=admin_list_vessels`, { timeoutMs: 60000 });
export const createVessel = (data) =>
  request(`${API_BASE}/tracking_api.php?action=admin_create_vessel`, { method: 'POST', body: JSON.stringify(data) });
export const updateVessel = (data) =>
  request(`${API_BASE}/tracking_api.php?action=admin_update_vessel`, { method: 'POST', body: JSON.stringify(data) });
export const deleteVessel = (id) =>
  request(`${API_BASE}/tracking_api.php?action=admin_delete_vessel`, { method: 'POST', body: JSON.stringify({ id }) });
export const getVesselPositions = (id) => request(`${API_BASE}/tracking_api.php?action=vessel_positions&id=${id}`);

// Plans (config)
export const getPlans = () => request(`${API_BASE}/settings_api.php?action=plans_list`);
export const createPlan = (data) =>
  request(`${API_BASE}/settings_api.php?action=plans_create`, { method: 'POST', body: JSON.stringify(data) });
export const updatePlan = (data) =>
  request(`${API_BASE}/settings_api.php?action=plans_update`, { method: 'POST', body: JSON.stringify(data) });
export const deletePlan = (id) =>
  request(`${API_BASE}/settings_api.php?action=plans_delete`, { method: 'POST', body: JSON.stringify({ id }) });

// Settings
export const getSettings = () => request(`${API_BASE}/settings_api.php?action=get`).catch(() => ({}));
export const updateSettings = (data) =>
  request(`${API_BASE}/settings_api.php?action=update`, { method: 'POST', body: JSON.stringify(data) });

// Pricing
export const getPricing = () => request(`${API_BASE}/settings_api.php?action=pricing_get`);
export const updatePricing = (data) =>
  request(`${API_BASE}/settings_api.php?action=pricing_update`, { method: 'POST', body: JSON.stringify(data) });

// Security
export const getSecurityEvents = (params = '') => request(`${API_BASE}/security_alerts.php?action=recent&${params}`);
export const get2FAStatusMap = (emails) => request(`${API_BASE}/two_factor.php?action=admin_status&emails=${encodeURIComponent(emails.join(','))}`);
export const disable2FA = (email) =>
  request(`${API_BASE}/two_factor.php?action=admin_disable`, { method: 'POST', body: JSON.stringify({ email }) });


// Marketplace
export const getMarketplaceListings = () => request(`${API_BASE}/marketplace_api.php?action=list`);
export const getMarketplaceAdminList = (status = '') => {
  const params = new URLSearchParams({ action: 'admin_list' });
  if (status) params.append('status', status);
  return request(`${API_BASE}/marketplace_api.php?${params}`);
};
export const getMarketplaceAdminDetail = (id) => request(`${API_BASE}/marketplace_api.php?action=admin_get&id=${id}`);
export const updateMarketplaceStatus = (id, status) =>
  request(`${API_BASE}/marketplace_api.php?action=admin_update_status`, { method: 'POST', body: JSON.stringify({ id, status }) });
export const updateMarketplaceListing = (data) =>
  request(`${API_BASE}/marketplace_api.php?action=admin_update`, { method: 'POST', body: JSON.stringify(data) });
export const deleteMarketplaceListing = (id) =>
  request(`${API_BASE}/marketplace_api.php?action=admin_delete`, { method: 'POST', body: JSON.stringify({ id }) });

// Reports
export const getReports = (orderId) => request(`${API_BASE}/reports_api.php?action=list&order_id=${orderId}`);
export const previewReport = (orderId) =>
  request(`${API_BASE}/reports_api.php?action=preview`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const sendReport = (orderId) =>
  request(`${API_BASE}/reports_api.php?action=send`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const resendReport = (reportId) =>
  request(`${API_BASE}/reports_api.php?action=resend`, { method: 'POST', body: JSON.stringify({ report_id: reportId }) });
export const editReport = (reportId) =>
  request(`${API_BASE}/reports_api.php?action=edit`, { method: 'POST', body: JSON.stringify({ report_id: reportId }) });
export const saveReport = (reportId, htmlContent) =>
  request(`${API_BASE}/reports_api.php?action=save`, { method: 'POST', body: JSON.stringify({ report_id: reportId, html_content: htmlContent }) });
export const deleteReport = (reportId) =>
  request(`${API_BASE}/reports_api.php?action=delete`, { method: 'POST', body: JSON.stringify({ report_id: reportId }) });

// Expediente files
export const getExpedienteFiles = (orderId) => request(`${API_BASE}/expediente_files_api.php?action=list&order_id=${orderId}`);
export const deleteExpedienteFile = (fileId) =>
  request(`${API_BASE}/expediente_files_api.php?action=delete`, { method: 'POST', body: JSON.stringify({ id: parseInt(fileId) }) });
export async function uploadExpedienteFiles(orderId, files, description = '', notifyClient = true) {
  const fd = new FormData();
  fd.append('order_id', orderId);
  fd.append('description', description);
  fd.append('notify_client', notifyClient ? '1' : '0');
  for (let i = 0; i < files.length; i++) fd.append('files[]', files[i]);
  return uploadFile(`${API_BASE}/expediente_files_api.php?action=upload`, fd);
}

// Scraping
export function scrapeBoatTrader(url) {
  return request(`${API_BASE}/boattrader_scraper.php?action=scrape&url=${encodeURIComponent(url)}`);
}
export function scrapeLink(url) {
  return request(`${API_BASE}/link_scraper.php?action=fetch&url=${encodeURIComponent(url)}`);
}

// Quotation (Cotizador)
export const saveQuote = (linkId, quoteData, totalClp, totalUsd, payments, publishNow = false) =>
  request(`${API_BASE}/orders_api.php?action=admin_save_quote`, {
    method: 'POST',
    body: JSON.stringify({
      link_id: linkId,
      quote_data: quoteData,
      quote_total_clp: totalClp,
      quote_total_usd: totalUsd,
      quote_payments: payments,
      publish_now: publishNow,
    }),
  });
export const deleteQuote = (linkId) =>
  request(`${API_BASE}/orders_api.php?action=admin_delete_quote`, { method: 'POST', body: JSON.stringify({ link_id: linkId }) });
// Sin revision es la vista previa: no envía nada, devuelve las etapas, el
// destinatario y la revision. El envío real lleva esa revision de vuelta y el
// servidor lo rechaza si la cotización cambió entremedio. Espera al SMTP, por
// eso el plazo largo.
export const sendQuoteBreakdown = (linkId, revision = null) =>
  request(`${API_BASE}/orders_api.php?action=admin_send_quote_breakdown`, {
    method: 'POST',
    body: JSON.stringify(revision ? { link_id: linkId, revision } : { link_id: linkId, preview: true }),
    timeoutMs: revision ? 45000 : 15000,
  });

// Chat
export const getChatConversations = (status = 'all', assigned = 'all') => {
  const params = new URLSearchParams({ action: 'admin_conversations', status, assigned });
  return request(`${API_BASE}/chat_api.php?${params}`);
};
export const getChatMessages = (conversationId) =>
  request(`${API_BASE}/chat_api.php?action=admin_messages&conversation_id=${conversationId}`);
export const sendChatMessage = (conversationId, message) =>
  request(`${API_BASE}/chat_api.php?action=admin_send`, { method: 'POST', body: JSON.stringify({ conversation_id: conversationId, message }) });
export const assignChatConversation = (conversationId) =>
  request(`${API_BASE}/chat_api.php?action=admin_assign`, { method: 'POST', body: JSON.stringify({ conversation_id: conversationId }) });
export const closeChatConversation = (conversationId) =>
  request(`${API_BASE}/chat_api.php?action=admin_close`, { method: 'POST', body: JSON.stringify({ conversation_id: conversationId }) });
export const reopenChatConversation = (conversationId) =>
  request(`${API_BASE}/chat_api.php?action=admin_reopen`, { method: 'POST', body: JSON.stringify({ conversation_id: conversationId }) });
export const getChatUnreadCount = () => request(`${API_BASE}/chat_api.php?action=admin_unread_count`);

// File upload (multipart)
export async function uploadLinkImage(orderId, linkId, file) {
  const fd = new FormData();
  fd.append('order_id', orderId);
  fd.append('link_id', linkId);
  fd.append('image', file);
  return uploadFile(`${API_BASE}/image_upload.php?action=upload_link_image`, fd);
}

// Notifications (admin bell). Backed by the same `notifications` table the
// user panel uses; the row's user_email is the admin's email, which the
// backend writes to from createOrderFromQuotation() (orders_api.php).
export const getNotifications = (limit = 30) => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=list&user_email=${encodeURIComponent(email)}&limit=${limit}`)
    .catch(() => ({ notifications: [] }));
};

export const getUnreadCount = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=unread_count&user_email=${encodeURIComponent(email)}`)
    .catch(() => ({ unread_count: 0 }));
};

export const markNotificationRead = (id) =>
  request(`${API_BASE}/notifications_api.php?action=mark_read`, { method: 'POST', body: JSON.stringify({ id }) });

export const markAllNotificationsRead = () => {
  const email = getUserEmail();
  return request(`${API_BASE}/notifications_api.php?action=mark_all_read`, { method: 'POST', body: JSON.stringify({ user_email: email }) });
};

// Leads del simulador de costos
export const getLeadsSimulador = () => request(`${API_BASE}/leads_api.php?action=list`);
// Se descarga con fetch y no con un <a href>: el endpoint exige la cabecera
// Authorization, y meter el token en la URL lo dejaría escrito en los logs
// del servidor y en el historial del navegador.
export async function descargarLeadsSimulador() {
  const res = await fetch(`${API_BASE}/leads_api.php?action=export`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('No se pudo exportar el listado');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-simulador-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
