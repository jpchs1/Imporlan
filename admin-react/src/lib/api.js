const isTest = window.location.pathname.includes('/test/');
const API_BASE = isTest ? '/test/api' : '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
    throw new Error('No autorizado');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
    throw new Error(err.detail || err.error || `Error ${res.status}`);
  }
  return res.json();
}

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
export const getOrders = () => request(`${API_BASE}/orders_api.php?action=admin_list`);
export const getOrderDetail = (id) => request(`${API_BASE}/orders_api.php?action=admin_detail&id=${id}`);
export const updateOrder = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_update`, { method: 'POST', body: JSON.stringify(data) });
export const createOrder = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_create`, { method: 'POST', body: JSON.stringify(data) });
export const deleteOrder = (id) =>
  request(`${API_BASE}/orders_api.php?action=admin_delete`, { method: 'POST', body: JSON.stringify({ id }) });
export const addOrderLink = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_add_link`, { method: 'POST', body: JSON.stringify(data) });
export const deleteOrderLink = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_delete_link`, { method: 'POST', body: JSON.stringify(data) });
export const changeOrderStatus = (data) =>
  request(`${API_BASE}/orders_api.php?action=admin_change_status`, { method: 'POST', body: JSON.stringify(data) });

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
export const getPlans = () => request(`${API_BASE}/config_api.php?action=plans_list`);
export const createPlan = (data) =>
  request(`${API_BASE}/config_api.php?action=plans_create`, { method: 'POST', body: JSON.stringify(data) });
export const updatePlan = (data) =>
  request(`${API_BASE}/config_api.php?action=plans_update`, { method: 'POST', body: JSON.stringify(data) });
export const deletePlan = (id) =>
  request(`${API_BASE}/config_api.php?action=plans_delete`, { method: 'POST', body: JSON.stringify({ id }) });

// Settings
export const getSettings = () => request(`${API_BASE}/settings_api.php?action=get`).catch(() => ({}));
export const updateSettings = (data) =>
  request(`${API_BASE}/settings_api.php?action=update`, { method: 'POST', body: JSON.stringify(data) });

// Pricing
export const getPricing = () => request(`${API_BASE}/config_api.php?action=pricing_get`);
export const updatePricing = (data) =>
  request(`${API_BASE}/config_api.php?action=pricing_update`, { method: 'POST', body: JSON.stringify(data) });

// Security
export const getSecurityEvents = (params = '') => request(`${API_BASE}/security_alerts.php?action=list&${params}`).catch(() => ({ items: [] }));
export const get2FAStatus = (email) => request(`${API_BASE}/two_factor.php?action=status&email=${encodeURIComponent(email)}`).catch(() => ({ enabled: false }));
export const disable2FA = (email) =>
  request(`${API_BASE}/two_factor.php?action=disable`, { method: 'POST', body: JSON.stringify({ email }) });

// Content pages
export const getContentPages = () => request(`${API_BASE}/admin_api.php?action=content_list`).catch(() => ({ items: [] }));

// Marketplace
export const getMarketplaceListings = () => request(`${API_BASE}/marketplace_api.php?action=list`);
