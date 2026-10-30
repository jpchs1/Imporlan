import { useCallback, useEffect, useMemo, useState } from 'react';
import { paymentReceiptClient } from '../lib/payment-receipts';
import { fmtCLP } from '../lib/utils';
import { Badge, Button, Callout, Input, Select } from './UI';
import { FileOpen } from './FileDownload';
import { FileCheck, Upload, FileText } from './Icons';
import '../styles/import-process.css';

export default function PaymentReceipts({ request, admin = false, onChange }) {
  return <ReceiptForm key={request.id} request={request} admin={admin} onChange={onChange} />;
}
function ReceiptForm({ request, admin, onChange }) {
  const api = useMemo(() => paymentReceiptClient(admin), [admin]);
  const [receipts, setReceipts] = useState(request.receipts || []);
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
  const hasEvidence = receipts.some(r => r.status !== 'rejected');
  const needsReplacement = receipts.length > 0 && !hasEvidence;
  return <section className="payment-receipts" aria-label={`Comprobantes de ${request.title}`}>
    <div className="payment-receipts__header"><FileCheck size={22} /><div><h4>Comprobantes de transferencia</h4><p>{request.status === 'paid' ? 'Este pago ya está confirmado. Puedes completar su respaldo sin realizar otra transferencia.' : hasEvidence ? 'Tu comprobante está guardado. El equipo verifica el ingreso bancario antes de confirmar el pago.' : needsReplacement ? 'Revisa la observación del equipo y adjunta el comprobante corregido en este mismo pago.' : 'Transfiere, adjunta tu comprobante y el equipo confirma el ingreso. Cada archivo queda asociado a este pago.'}</p></div></div>
    <div className="payment-receipts__body">
    {error && <Callout compact tone="warning">{error}</Callout>}{message && <div role="status"><Callout compact tone="info">{message}</Callout></div>}
    {receipts.map(r => <div key={r.id} className="payment-receipts__item space-y-2 text-13">
      <div className="payment-receipts__file"><FileOpen file={r} className="text-brand-700 inline-flex items-center gap-1 min-w-0"><FileText size={15} className="shrink-0" />{r.original_name}</FileOpen><Badge size="sm" tone={r.status === 'rejected' ? 'warning' : r.status === 'reviewed' ? 'success' : 'info'}>{r.status === 'rejected' ? 'Reemplazo solicitado' : r.status === 'reviewed' ? 'Revisado' : 'Por revisar'}</Badge></div>
      <p className="text-ink-900 font-medium break-words">{r.currency === 'USD' ? `USD ${r.declared_amount}` : fmtCLP(r.declared_amount_clp)}</p>
      <p className="text-xs text-ink-500 break-words">Referencia: {r.reference}</p>
      <p className="text-xs text-ink-500">{r.status === 'rejected' ? `Se requiere otro comprobante: ${r.review_note}` : r.status === 'reviewed' ? 'Comprobante revisado por el equipo. La confirmación del pago se registra por separado.' : 'Recibido · pendiente de revisión'}</p>
      {r.currency === 'USD' ? <Callout compact tone="info">El cobro está en CLP. El equipo debe revisar el monto en USD y la conversión acordada antes de confirmar el ingreso.</Callout> : Number(r.declared_amount_clp) !== Number(request.amount_clp) && <Callout compact tone="warning">El monto informado difiere del cobro. El equipo debe conciliar la diferencia antes de confirmar el pago.</Callout>}
      {admin && r.status !== 'rejected' && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy || r.status === 'reviewed'} onClick={() => review(r, 'reviewed')}>Registrar revisión</Button><Button size="sm" variant="ghost" disabled={busy || note.trim().length < 5} onClick={() => review(r, 'rejected')}>Solicitar otro comprobante</Button></div>}
    </div>)}
    {admin && receipts.length > 0 && <Input label="Nota de revisión o motivo para solicitar otro comprobante" hint="Para solicitar un reemplazo, explica el motivo en al menos 5 caracteres." value={note} maxLength={1000} onChange={e => setNote(e.target.value)} />}{request.status !== 'cancelled' && <details open={receipts.length === 0 || receipts.every(r => r.status === 'rejected')}><summary className="cursor-pointer text-sm font-medium text-brand-700 py-2">{receipts.length ? 'Adjuntar otro comprobante' : 'Adjuntar comprobante de este pago'}</summary><form onSubmit={upload} className="payment-receipts__form mt-2">
      <div className="payment-receipts__fields">
      <Select label="Moneda del comprobante" value={currency} onChange={e => { setCurrency(e.target.value);setAmount(''); }} options={[{ value:'CLP',label:'Pesos chilenos (CLP)' },{ value:'USD',label:'Dólares (USD)' }]} />
      <Input label={`Monto transferido en ${currency}`} hint={currency === 'USD' ? 'Sin separadores de miles y con punto decimal. Ejemplo: 100.50.' : 'Indica el monto entero, sin puntos ni comas.'} inputMode={currency === 'USD' ? 'decimal' : 'numeric'} value={amount} onChange={e => setAmount(e.target.value)} required />
      </div>
      <Input label="Referencia o número de transferencia" hint="Lo encuentras en el comprobante emitido por tu banco." value={reference} onChange={e => setReference(e.target.value)} minLength={3} maxLength={120} required />
      <label className="payment-receipts__upload"><Upload size={22} /><strong>{file ? file.name : 'Selecciona el comprobante de tu banco'}</strong><span>PDF, JPG, PNG o WebP · hasta 10 MB</span><input aria-label="Archivo del comprobante" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required disabled={busy} onChange={e => { const next = e.target.files?.[0] || null; if (next?.size > 10 * 1024 * 1024) { setError('El archivo supera los 10 MB. Elige uno más pequeño.');setFile(null);e.target.value = ''; } else { setFile(next);setError(''); } }} /></label>
      <Button type="submit" icon={Upload} loading={busy} disabled={!file || reference.trim().length < 3}>Adjuntar comprobante</Button>
      <p className="text-xs text-ink-500">El archivo se guarda de forma privada. El pago queda confirmado cuando el equipo verifica el ingreso bancario.</p>
    </form></details>}
    </div>
  </section>;
}
