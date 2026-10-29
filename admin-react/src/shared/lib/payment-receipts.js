import { createApiClient } from './api-client';

export function paymentReceiptClient(admin = false) {
  const { request, uploadFile, API_BASE } = createApiClient(admin ? { token: 'token', user: 'user' } : { token: 'imporlan_token', user: 'imporlan_user' });
  return {
    list: id => request(`${API_BASE}/payment_receipts_api.php?action=list&request_id=${encodeURIComponent(id)}`),
    upload: (id, file, amount, reference, currency = 'CLP') => {
      const data = new FormData();data.append('request_id', id);data.append('receipt', file);data.append('amount', String(amount));data.append('currency', currency);data.append('reference', reference);
      return uploadFile(`${API_BASE}/payment_receipts_api.php?action=upload`, data);
    },
    review: (id, receiptId, decision, note = '') => request(`${API_BASE}/payment_receipts_api.php?action=review`, { method: 'POST', body: JSON.stringify({ request_id: id, receipt_id: receiptId, decision, note }) }),
  };
}
