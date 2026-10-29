import { useCallback, useEffect, useMemo, useState } from 'react';
import { paymentReceiptClient } from '../lib/payment-receipts';
import { fmtCLP } from '../lib/utils';
import { Button, Callout, Input, Select } from './UI';
import { FileOpen } from './FileDownload';

export default function PaymentReceipts({ request, admin = false, onChange }) {
  return <ReceiptForm key={request.id} request={request} admin={admin} onChange={onChange} />;
}
function ReceiptForm({ request, admin, onChange }) {
  const api = useMemo(() => paymentReceiptClient(admin), [admin]);
  const [receipts, setReceipts] = useState([]);
  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState(String(Math.round(Number(request.amount_clp) || 0)));
  const [currency, setCurrency] = useState('CLP');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => { const r = await api.list(request.id); setReceipts(r.receipts || []); }, [api, request.id]);
  useEffect(() => { let active = true; api.list(request.id).then(r => { if (active) setReceipts(r.receipts || []); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [api, request.id]);
  async function upload(e) {
    e.preventDefault();if (busy || !file) return;setBusy(true);setError('');setMessage('');
    try { const r = await api.upload(request.id, file, amount, reference, currency); onChange?.(r);setMessage(r.message); setFile(null);setReference('');e.target.reset();await load(); }
    catch (e) { setError(e.message || 'No se pudo adjuntar el comprobante'); }
    finally { setBusy(false); }
  }
  async function review(receipt, decision) {
    if (busy) return;setBusy(true);setError('');
    try { const r = await api.review(request.id, receipt.id, decision, note);setMessage(r.message);await load();onChange?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-lg border border-line p-3" aria-label={`Comprobantes de ${request.title}`}>
    <h4 className="text-sm font-semibold text-ink-900">Comprobantes de transferencia</h4>
    <p className="text-xs text-ink-500">Cada archivo queda asociado a este pago. Adjuntarlo no confirma el ingreso bancario ni cambia el monto solicitado.</p>
    {error && <Callout compact tone="warning">{error}</Callout>}{message && <Callout compact tone="info">{message}</Callout>}
    {receipts.map(r => <div key={r.id} className="border-t border-line pt-2 space-y-1 text-13">
      <FileOpen file={r} className="text-brand-700 inline-flex items-center gap-1">{r.original_name}</FileOpen>
      <p className="text-ink-700 break-words">{r.currency === 'USD' ? `USD ${r.declared_amount}` : fmtCLP(r.declared_amount_clp)} · Ref. {r.reference}</p>
      <p className="text-xs text-ink-500">{r.status === 'rejected' ? `Se requiere otro comprobante: ${r.review_note}` : r.status === 'reviewed' ? 'Comprobante revisado por el equipo' : 'Recibido · pendiente de revisión'}</p>
      {r.currency === 'USD' ? <Callout compact tone="info">El cobro está en CLP. El equipo debe revisar el monto en USD y la conversión acordada antes de confirmar el ingreso.</Callout> : Number(r.declared_amount_clp) !== Number(request.amount_clp) && <Callout compact tone="warning">El monto informado difiere del cobro. El equipo debe conciliar la diferencia antes de confirmar el pago.</Callout>}
      {admin && r.status !== 'rejected' && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy || r.status === 'reviewed'} onClick={() => review(r, 'reviewed')}>Registrar revisión</Button><Button size="sm" variant="ghost" disabled={busy || note.trim().length < 5} onClick={() => review(r, 'rejected')}>Solicitar otro comprobante</Button></div>}
    </div>)}
    {admin && <Input label="Nota de revisión o motivo para solicitar otro comprobante" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} />}{request.status !== 'cancelled' && <form onSubmit={upload} className="space-y-3">
      <Select label="Moneda del comprobante" value={currency} onChange={e => { setCurrency(e.target.value);setAmount(''); }} options={[{ value:'CLP',label:'Pesos chilenos (CLP)' },{ value:'USD',label:'Dólares (USD)' }]} />
      <Input label={`Monto transferido en ${currency}`} hint={currency === 'USD' ? 'Sin separadores de miles y con punto decimal. Ejemplo: 100.50.' : 'Indica el monto entero, sin puntos ni comas.'} inputMode={currency === 'USD' ? 'decimal' : 'numeric'} value={amount} onChange={e => setAmount(e.target.value)} required />
      <Input label="Referencia o número de transferencia" value={reference} onChange={e => setReference(e.target.value)} minLength={3} maxLength={120} required />
      <label className="block text-13 text-ink-700">Comprobante PDF, JPG, PNG o WebP · hasta 10 MB<input aria-label="Archivo del comprobante" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} className="block mt-1 w-full text-xs" /></label>
      <Button type="submit" size="sm" loading={busy} disabled={!file || reference.trim().length < 3}>Adjuntar comprobante</Button>
    </form>}
  </section>;
}
