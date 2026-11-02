export function confirmedCredits(request) { return (request?.payment_credits || []).filter(c => c.status === 'confirmed'); }
export function paymentBalance(request) {
  const total = Math.max(0, Number(request?.amount_clp) || 0);
  const credits = confirmedCredits(request).reduce((sum, c) => sum + Number(c.amount_clp || 0), 0);
  const confirmed = request?.status === 'paid' ? Math.max(total, credits) : credits;
  return { total, confirmed, remaining: Math.max(0, total - confirmed), excess: Math.max(0, confirmed - total) };
}
export function receiptLinked(request, receipt) { return confirmedCredits(request).some(c => c.receipt_id && c.receipt_id === receipt.id); }
export function creditHasProof(request, credit) { return (request?.receipts || []).some(r => r.id === credit.receipt_id && r.status !== 'rejected'); }
export function proofPending(request) {
  if (request?.status !== 'pending') return false;
  if ((request.receipts || []).some(r => r.status !== 'rejected' && !receiptLinked(request, r))) return true;
  return !request.receipts?.length && request.receipt_status !== 'rejected' && !!(request.receipt_received_at || request.receipt_url || request.voucher_url || request.comprobante_url);
}
