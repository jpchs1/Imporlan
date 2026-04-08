import { createApiClient } from '../shared/lib/api-client';
import { STORAGE_KEYS } from './config';

const client = createApiClient(STORAGE_KEYS);
const { request, uploadFile, getToken, getUserEmail, API_BASE } = client;

function userJson() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}'); } catch { return {}; }
}

// Auth
export const login = (email, password) =>
  request(`${API_BASE}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const verify2FA = (code, tempToken) =>
  request(`${API_BASE}/auth/verify-2fa`, { method: 'POST', body: JSON.stringify({ code, temp_token: tempToken }) });

export const getMe = () => request(`${API_BASE}/auth/me`);

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
  const user = userJson();
  const email = getUserEmail();
  return request(`${API_BASE}/payment_requests_api.php?action=user_list_public&user_email=${encodeURIComponent(email)}&status=${status}`).catch(() => ({ requests: [] }));
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
