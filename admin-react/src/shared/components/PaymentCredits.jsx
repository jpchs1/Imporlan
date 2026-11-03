import { useState, useEffect, useMemo } from 'react';
import { createApiClient } from '../lib/api-client';
import { confirmedCredits, paymentBalance, receiptLinked, creditHasProof } from '../lib/payment-balance';
import { fmtCLP } from '../lib/utils';
import { fmtDateLarga } from '../lib/format';
import { Button, Callout, Input, Select, Modal } from './UI';
import '../styles/import-process.css';
import { CircleCheck, Plus, Link } from './Icons';
import PaymentReconciliationNotice from './PaymentReconciliationNotice';

const banks = { global66: 'Global66', santander: 'Santander', otro: 'Otro banco', webpay: 'WebPay', mercadopago: 'Mercado Pago', paypal: 'PayPal' };

export default function PaymentCredits({ request, admin = false, onChange, onAttachProof }) {
  return <CreditRecord key={request.id} request={request} admin={admin} onChange={onChange} onAttachProof={onAttachProof} />;
}
function CreditRecord({ request, admin, onChange, onAttachProof }) {
  const api = useMemo(() => createApiClient(admin ? {token:'token',user:'user'} : {token:'imporlan_token',user:'imporlan_user'}), [admin]);
  const [current, setCurrent] = useState(request);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [bank, setBank] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [associate, setAssociate] = useState({});
  const [proposal, setProposal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (admin) api.request(`${api.API_BASE}/payment_requests_api.php?action=get_by_id&id=${encodeURIComponent(request.id)}`).then(r => { if (active) setCurrent(r.request || request); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [request, admin, api]);
  const value = admin ? current : request;
  const balance = paymentBalance(value);
  const credits = confirmedCredits(value);
  const receipts = (value.receipts || []).filter(r => r.status !== 'rejected');
  const available = receipts.filter(r => !receiptLinked(value, r));
  const suggestedReceipt = credit => available.find(r => r.credit_id === credit.id)?.id || '';
  async function post(action, data) {
    return api.request(`${api.API_BASE}/payment_requests_api.php?action=${action}`, { method:'POST',body:JSON.stringify({request_id:request.id,...data}) });
  }
  function review(e) {
    e.preventDefault();setError('');
    setProposal({amount_clp:amount,received_on:date,bank,reference,note,receipt_id:receiptId || null,expected_amount_clp:balance.total,expected_remaining_clp:balance.remaining,idempotency_key:crypto.randomUUID()});
  }
  async function confirm() {
    if (busy || !proposal) return;setBusy(true);setError('');
    try {
      const result = await post('register_credit',proposal);
      setCurrent(result.request);onChange?.();setProposal(null);setAmount('');setDate('');setReference('');setNote('');setReceiptId('');setMessage(result.message);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function link(credit) {
    const receipt = associate[credit.id] || suggestedReceipt(credit);
    if (busy || !receipt) return;setBusy(true);setError('');
    try { const result = await post('link_credit_receipt',{credit_id:credit.id,receipt_id:receipt,note});setCurrent(result.request);onChange?.();setMessage('Comprobante asociado al abono confirmado.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!admin && !credits.length) return null;
  return <section className="payment-ledger" aria-label={`Abonos de ${request.title}`}>
    <div><h4 className="text-sm font-semibold text-ink-900 flex items-center gap-2"><CircleCheck size={17} />Abonos confirmados</h4><p className="text-xs text-ink-500 mt-1">{admin ? 'Registra sólo ingresos verificados en la cuenta bancaria. Un comprobante adjunto no confirma dinero.' : 'Estos ingresos ya están registrados. No repitas las transferencias indicadas.'}</p></div>
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-13"><div><dt className="text-ink-500">Total de este pago</dt><dd className="font-semibold tabular">{fmtCLP(balance.total)}</dd></div><div><dt className="text-ink-500">Abonos confirmados</dt><dd className="font-semibold tabular text-success">{fmtCLP(balance.confirmed)}</dd></div><div><dt className="text-ink-500">Saldo de este pago</dt><dd className="font-semibold tabular">{fmtCLP(balance.remaining)}</dd></div></dl>
    <div className="payment-ledger__progress" role="progressbar" aria-label="Avance de este pago" aria-valuemin={0} aria-valuemax={100} aria-valuenow={balance.total ? Math.min(100,Math.floor(balance.confirmed / balance.total * 100)) : 0} aria-valuetext={`${fmtCLP(balance.confirmed)} registrados de ${fmtCLP(balance.total)}`}><span style={{width:`${balance.total ? Math.min(100,balance.confirmed / balance.total * 100) : 0}%`}} /></div>
    {credits.length > 0 && <ul className="divide-y divide-line" aria-label="Ingresos confirmados de este pago">{credits.map(c => <li key={c.id} className="py-3 space-y-2"><div className="flex flex-wrap justify-between gap-2 text-13"><span>{fmtDateLarga(c.received_on)} · {banks[c.bank] || c.bank}</span><strong className="tabular">{fmtCLP(c.amount_clp)}</strong></div><p className="text-xs text-ink-500 break-words">{c.reference ? `Referencia: ${c.reference}` : 'Registrado sin número de operación bancaria'} · {['webpay','mercadopago','paypal'].includes(c.bank) ? 'Confirmación de pasarela' : creditHasProof(value,c) ? 'Con comprobante asociado' : suggestedReceipt(c) ? 'Respaldo recibido · por revisar' : 'Respaldo pendiente'}</p>
      {admin && !['webpay','mercadopago','paypal'].includes(c.bank) && !creditHasProof(value,c) && available.length > 0 && <div className="flex flex-wrap items-end gap-2"><Select className="min-w-0 flex-1 basis-48" label={`Comprobante para abono de ${fmtCLP(c.amount_clp)}`} value={associate[c.id] || suggestedReceipt(c)} onChange={e => setAssociate(x => ({...x,[c.id]:e.target.value}))} placeholder="Seleccionar comprobante" options={available.map(r => ({value:r.id,label:r.original_name}))} /><Button size="sm" variant="secondary" icon={Link} disabled={busy || !(associate[c.id] || suggestedReceipt(c))} onClick={() => link(c)}>Asociar comprobante</Button></div>}
      {!admin && !['webpay','mercadopago','paypal'].includes(c.bank) && !creditHasProof(value,c) && !suggestedReceipt(c) && onAttachProof && <Button size="sm" variant="secondary" icon={Plus} onClick={() => onAttachProof(c)}>Adjuntar comprobante de {fmtCLP(c.amount_clp)}</Button>}
    </li>)}</ul>}
    {balance.excess > 0 && <Callout compact tone="warning">Excedente registrado: {fmtCLP(balance.excess)}. El equipo debe revisar su aplicación o devolución; no se aplica automáticamente a otra cuota.</Callout>}
    {error && <Callout compact tone="warning">{error}</Callout>}{message && <div role="status"><Callout compact tone="info">{message}</Callout></div>}
    {admin && available.length > 0 && credits.length > 0 && <Input label="Observación para asociar comprobantes" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} hint="Explica diferencias de monto o la conversión que ya verificaste en el banco." />}
    {admin && value.status === 'pending' && <details><summary className="cursor-pointer text-sm font-medium text-brand-700 py-2">Registrar abono bancario</summary><form onSubmit={review} className="mt-3 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Input label="Monto del abono en CLP" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} pattern="[1-9][0-9]{0,11}" required hint="Monto real ingresado, sin puntos ni comas." /><Input type="date" label="Fecha del abono bancario" value={date} onChange={e => setDate(e.target.value)} required /></div>
      <Select label="Cuenta que recibió el abono" value={bank} onChange={e => setBank(e.target.value)} required placeholder="Seleccionar cuenta" options={['global66','santander','otro'].map(v => ({value:v,label:banks[v]}))} />
      <Input label="Número de operación o referencia bancaria" value={reference} onChange={e => setReference(e.target.value)} maxLength={120} hint="Si la cartola no informa un número, deja el campo vacío y explica el respaldo en la observación." />
      {available.length > 0 && <Select label="Comprobante que respalda el abono" value={receiptId} onChange={e => setReceiptId(e.target.value)} placeholder="Sin comprobante asociado todavía" options={available.map(r => ({value:r.id,label:r.original_name}))} />}
      <Input label="Observación de conciliación" value={note} onChange={e => setNote(e.target.value)} required={!reference.trim()} minLength={reference.trim() ? undefined : 10} maxLength={1000} hint="Explica cualquier diferencia o conversión revisada. No ingreses datos de cuenta ni claves." />
      <Button type="submit" variant="secondary" icon={Plus} disabled={busy}>Revisar abono</Button>
    </form></details>}
    {admin && value.status==='paid' && <PaymentReconciliationNotice request={value} />}
    {proposal && <Modal open onClose={busy ? undefined : () => setProposal(null)} title="Confirmar ingreso bancario" description={request.title} footer={<><Button variant="secondary" disabled={busy} onClick={() => setProposal(null)}>Volver</Button><Button loading={busy} onClick={confirm}>Confirmar abono verificado</Button></>}>
      <p className="text-sm text-ink-700">Confirma que este movimiento ingresó a la cuenta de Imporlan y que su referencia no está registrada en otro pago.</p><p className="text-2xl font-semibold text-ink-900 mt-4">{fmtCLP(proposal.amount_clp)}</p><p className="text-sm text-ink-500 mt-2">{banks[proposal.bank]} · {fmtDateLarga(proposal.received_on)}</p><p className="text-sm text-ink-700 mt-2 break-words">{proposal.reference || proposal.note}</p><p className="text-sm text-ink-700 mt-4">Saldo después del abono: {fmtCLP(Math.max(0,balance.remaining-Number(proposal.amount_clp)))}</p>{error && <Callout compact tone="warning" className="mt-3">{error}</Callout>}
    </Modal>}
  </section>;
}
