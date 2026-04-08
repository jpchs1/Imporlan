import { createApiClient } from '../shared/lib/api-client';
import { STORAGE_KEYS } from './config';

const { request, uploadFile, getToken, API_BASE } = createApiClient(STORAGE_KEYS);

// Auth
export const login = (email, password) =>
  request(`${API_BASE}/admin_api.php?action=login`, { method: 'POST', body: JSON.stringify({ email, password }) });

export const verify2FA = (code, tempToken) =>
  request(`${API_BASE}/auth_local.php?action=verify-2fa`, { method: 'POST', body: JSON.stringify({ code, temp_token: tempToken }) });

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
export const reorderOrderLinks = (orderId, linkIds, authorName) =>
  request(`${API_BASE}/orders_api.php?action=admin_reorder_links`, { method: 'POST', body: JSON.stringify({ order_id: orderId, link_ids: linkIds, author_name: authorName, author_role: 'admin' }) });
export const changeOrderStatus = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_change_status`, { method: 'POST', body: JSON.stringify(data) });
export const sendClientUpdate = (orderId) =>
  request(`${API_BASE}/orders_api.php?action=admin_send_client_update`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
export const notifyRanking = (orderId, authorName) =>
  request(`${API_BASE}/orders_api.php?action=notify_ranking`, { method: 'POST', body: JSON.stringify({ order_id: parseInt(orderId), author_name: authorName, author_role: 'admin' }) });

// Inspections
export const getInspections = () => request(`${API_BASE}/inspection_api.php?action=admin_list`).catch(() => ({ items: [] }));

// Tracking
export const getVessels = () => request(`${API_BASE}/tracking_api.php?action=admin_list_vessels`);
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
export const getSecurityEvents = (params = '') => request(`${API_BASE}/security_alerts.php?action=list&${params}`).catch(() => ({ items: [] }));
export const get2FAStatus = (email) => request(`${API_BASE}/two_factor.php?action=status&email=${encodeURIComponent(email)}`).catch(() => ({ enabled: false }));
export const disable2FA = (email) =>
  request(`${API_BASE}/two_factor.php?action=disable`, { method: 'POST', body: JSON.stringify({ email }) });

// Content pages
export const getContentPages = () => request(`${API_BASE}/admin_api.php?action=content_list`).catch(() => ({ items: [] }));

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

// File upload (multipart)
export async function uploadLinkImage(orderId, linkId, file) {
  const fd = new FormData();
  fd.append('order_id', orderId);
  fd.append('link_id', linkId);
  fd.append('image', file);
  return uploadFile(`${API_BASE}/expediente_files_api.php?action=upload_link_image`, fd);
}
