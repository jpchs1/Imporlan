export function confirmedCredits(request) { return (request?.payment_credits || []).filter(c => c.status === 'confirmed'); }
export function gatewayOnlyPayment(request) {
  if(request?.status!=='paid')return false;
  const credits=confirmedCredits(request),providers=['webpay','mercadopago','paypal'];
  return credits.length>0 ? credits.every(c=>providers.includes(c.bank)) : !request.payment_credits?.length && providers.includes(request.payment_method);
}
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
/** A paid flag and an uploaded file do not, by themselves, release a purchase. */
export function paymentSettlement(request) {
  const credits=confirmedCredits(request);
  const total=Number(request?.amount_clp) || 0;
  const confirmed=request?.payment_credits?.length ? credits.reduce((s,c)=>s+Number(c.amount_clp),0) : request?.status==='paid' ? total : 0;
  let missingProofs=0,reviewPending=0;
  if(credits.length) {
    for(const c of credits) {
      if(['webpay','mercadopago','paypal'].includes(c.bank))continue;
      const proof=(request.receipts || []).find(r=>r.id===c.receipt_id);
      if(!proof || proof.status==='rejected') {
        if(!(request.receipts || []).some(r=>r.credit_id===c.id && r.status!=='rejected' && !receiptLinked(request,r)))missingProofs++;
      } else if(proof.status!=='reviewed')reviewPending++;
    }
    reviewPending+=(request.receipts || []).filter(r=>r.status!=='rejected' && !receiptLinked(request,r)).length;
  } else if(request?.status==='paid' && !['webpay','mercadopago','paypal'].includes(request.payment_method)) {
    const proofs=(request.receipts || []).filter(r=>r.status!=='rejected');
    if(!proofs.length)missingProofs++;
    reviewPending+=proofs.filter(r=>r.status!=='reviewed' || ((r.currency==='USD' || Number(r.declared_amount_clp)!==total) && (r.review_note || '').trim().length<10)).length;
  }
  return {settled:total>0 && request?.status==='paid' && confirmed>=total && !missingProofs && !reviewPending,missingProofs,reviewPending};
}
