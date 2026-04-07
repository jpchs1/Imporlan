import { createApiClient } from '../shared/lib/api-client';
import { STORAGE_KEYS } from './config';

const { request, uploadFile, getToken, API_BASE } = createApiClient(STORAGE_KEYS);

// Auth
export const login = (email, password) =>
  request(`${API_BASE}/auth_local.php?action=login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const verify2FA = (code, tempToken) =>
  request(`${API_BASE}/auth_local.php?action=verify-2fa`, { method: 'POST', body: JSON.stringify({ code, temp_token: tempToken }) });

export const getMe = () => request(`${API_BASE}/auth_local.php?action=me`);

// Orders (user view)
export const getMyOrders = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/orders_api.php?action=user_list&user_email=${encodeURIComponent(email)}`);
};

export const getMyOrderDetail = (id) => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/orders_api.php?action=user_detail&id=${id}&user_email=${encodeURIComponent(email)}`);
};

export const saveRanking = (orderId, rankings) =>
  request(`${API_BASE}/orders_api.php?action=save_ranking`, { method: 'POST', body: JSON.stringify({ order_id: orderId, rankings }) });

export const notifyRanking = (orderId) => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  return request(`${API_BASE}/orders_api.php?action=notify_ranking`, {
    method: 'POST',
    body: JSON.stringify({ order_id: parseInt(orderId), author_name: user.name || '', author_role: 'client' }),
  });
};

// Marketplace (user)
export const getMarketplaceListings = () => request(`${API_BASE}/marketplace_api.php?action=list`);

export const getMyListings = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/marketplace_api.php?action=my_listings&user_email=${encodeURIComponent(email)}`);
};

export const createListing = (data) =>
  request(`${API_BASE}/marketplace_api.php?action=create`, { method: 'POST', body: JSON.stringify(data) });

export const updateListing = (data) =>
  request(`${API_BASE}/marketplace_api.php?action=update`, { method: 'POST', body: JSON.stringify(data) });

export const deleteListing = (id) =>
  request(`${API_BASE}/marketplace_api.php?action=delete`, { method: 'POST', body: JSON.stringify({ id }) });

export async function uploadListingPhoto(listingId, file) {
  const fd = new FormData();
  fd.append('listing_id', listingId);
  fd.append('photo', file);
  return uploadFile(`${API_BASE}/marketplace_api.php?action=upload_photo`, fd);
}

// Tracking (user - read only)
export const getMyVessels = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/tracking_api.php?action=user_vessels&user_email=${encodeURIComponent(email)}`);
};

// Chat / Messages
export const getMyConversations = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/chat_api.php?action=user_conversations&user_email=${encodeURIComponent(email)}`);
};

export const getMessages = (conversationId) => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/chat_api.php?action=user_messages&conversation_id=${conversationId}&user_email=${encodeURIComponent(email)}`);
};

export const sendMessage = (conversationId, message) => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/chat_api.php?action=user_send`, {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, message, user_email: email }),
  });
};

export const startConversation = (subject, message) => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/chat_api.php?action=user_start_conversation`, {
    method: 'POST',
    body: JSON.stringify({ subject, message, user_email: email, user_name: user.name || '' }),
  });
};

// Documents (user files)
export const getMyFiles = (orderId) => request(`${API_BASE}/expediente_files_api.php?action=list&order_id=${orderId}`);

// Inspections (user - read only)
export const getMyInspections = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/inspection_api.php?action=user_list&user_email=${encodeURIComponent(email)}`).catch(() => ({ items: [] }));
};

// Payments (user - read only)
export const getMyPaymentRequests = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
  const email = user.email || user.user_email || '';
  return request(`${API_BASE}/payment_requests_api.php?action=user_list_public&user_email=${encodeURIComponent(email)}`).catch(() => ({ items: [] }));
};
