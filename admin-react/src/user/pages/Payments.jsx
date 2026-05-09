import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyPaymentRequests, createWebPayTransaction, createMercadoPagoPreference, createPayPalOrder, capturePayPalOrder, getPayPalClientId } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Badge, Button, Modal, Input } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const STATUS_MAP = {
  pending:   { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700' },
  paid:      { label: 'Pagado',     color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700' },
};

function fmtUSD(amount) {
  if (!amount || isNaN(amount)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

// --- Payment Card ---
function PaymentCard({ req, onPay }) {
  const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
  const isPending = req.status === 'pending';
  const isPaid = req.status === 'paid';
  const isCancelled = req.status === 'cancelled';
  const meta = req.metadata || {};

  return (
    <div className={cn(
      'relative bg-white rounded-2xl border p-5 transition-all',
      isPending && 'border-amber-200 shadow-sm shadow-amber-200/40 ring-1 ring-amber-100/50 hover:shadow-md',
      isPaid && 'border-emerald-200/60 hover:border-emerald-300',
      isCancelled && 'border-slate-200 opacity-80'
    )}>
      {isPending && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-50 rounded-bl-3xl opacity-50 pointer-events-none" />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 leading-tight">{req.title}</p>
            {req.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{req.description}</p>}
          </div>
          <Badge className={cn(st.color, 'shrink-0 text-[10px] uppercase tracking-wider font-bold')}>{st.label}</Badge>
        </div>

        {/* Amount */}
        <div className="mb-3 pb-3 border-b border-slate-100">
          <p className="text-2xl font-bold text-slate-900 leading-none">{fmtCLP(req.amount_clp)}</p>
          {req.amount_usd > 0 && (
            <p className="text-xs text-slate-400 mt-1">aprox {fmtUSD(req.amount_usd)} USD</p>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>Creado el {fmtDate(req.created_at)}</span>
          </div>
          {meta.boat_name && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 12l10 10 10-10z"/></svg>
              <span className="truncate">{meta.boat_name}</span>
            </div>
          )}
          {isPaid && req.payment_method && (
            <div className="flex items-center gap-1.5 text-emerald-700">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
              <span className="capitalize font-semibold">Pagado por {req.payment_method.replace(/_/g, ' ')}</span>
            </div>
          )}
          {req.paid_at && (
            <div className="flex items-center gap-1.5 text-emerald-700">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span className="font-medium">{fmtDate(req.paid_at)}</span>
            </div>
          )}
        </div>

        {isCancelled && req.cancelled_reason && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
            {req.cancelled_reason}
          </div>
        )}

        {isPending && (
          <Button
            variant="accent"
            size="sm"
            className="mt-4 w-full shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5"
            onClick={() => onPay(req)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            Pagar ahora
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Bank Transfer Info ---
function BankTransferInfo({ amount }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">Realiza una transferencia bancaria con los siguientes datos:</p>
      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <Row label="Banco" value="Banco Santander" />
        <Row label="Empresa" value="Imporlan SpA" />
        <Row label="RUT" value="76.914.409-9" />
        <Row label="Cuenta CLP" value="74233813" />
        <Row label="Cuenta USD" value="5100369305" />
        <Row label="SWIFT" value="BSCHCLRM" />
        <Row label="Email" value="contacto@imporlan.cl" />
        <Row label="Monto" value={fmtCLP(amount)} bold />
      </div>
      <p className="text-xs text-slate-400">Una vez realizada la transferencia, envia el comprobante a contacto@imporlan.cl</p>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={cn('text-slate-700', bold && 'font-bold')}>{value}</span>
    </div>
  );
}

// --- Pay Modal ---
function PayModal({ open, onClose, paymentRequest, toast }) {
  const { user } = useAuth();
  const [method, setMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showBank, setShowBank] = useState(false);

  if (!paymentRequest) return null;
  const pr = paymentRequest;
  const email = user?.email || user?.user_email || '';
  const name = user?.name || '';

  async function handleWebPay() {
    setProcessing(true);
    try {
      const data = await createWebPayTransaction({
        amount: pr.amount_clp,
        session_id: `pr_${pr.id}_${Date.now()}`,
        buy_order: `PR-${pr.id}`,
        user_email: email,
        payer_name: name,
        description: pr.title,
        type: 'payment_request',
        payment_request_id: pr.id,
        return_url: window.location.href,
      });
      if (data.success && data.url && data.token) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.url;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token_ws';
        input.value = data.token;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      } else {
        toast?.('Error al crear transaccion WebPay', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion con WebPay', 'error');
    }
    setProcessing(false);
  }

  async function handleMercadoPago() {
    setProcessing(true);
    try {
      const data = await createMercadoPagoPreference({
        amount: pr.amount_clp,
        description: pr.title,
        plan_name: pr.title,
        payer_email: email,
        payer_name: name,
        payment_request_id: pr.id,
      });
      if (data.success && data.init_point) {
        window.location.href = data.init_point;
      } else {
        toast?.('Error al crear preferencia MercadoPago', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion con MercadoPago', 'error');
    }
    setProcessing(false);
  }

  const methods = [
    { id: 'webpay', label: 'Tarjeta de Credito / Debito', desc: 'Pago con tarjeta via WebPay (Transbank)', logo: 'https://www.webpay.cl/images/webpay-logo.svg', logoFallback: '#E31837', action: handleWebPay, badges: ['VISA', 'MASTERCARD', 'AMEX'] },
    { id: 'webpay2', label: 'WebPay (Transbank)', desc: 'OnePay y Tarjeta credito o debito', logo: 'https://www.webpay.cl/images/webpay-logo.svg', logoFallback: '#E31837', action: handleWebPay },
    { id: 'mercadopago', label: 'MercadoPago', desc: 'Cuenta MercadoPago o tarjeta', logo: 'https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.92/mercadopago/logo__large@2x.png', logoFallback: '#00B1EA', action: handleMercadoPago },
    { id: 'transfer', label: 'Transferencia Bancaria', desc: 'Banco Santander', logoFallback: '#64748b', action: () => setShowBank(true) },
  ];

  const logoMap = {
    webpay: '/panel/user/assets/logos/logowebpay.png',
    webpay2: '/panel/user/assets/logos/logowebpay.png',
    mercadopago: '/panel/user/assets/logos/logomercadopago.png',
    transfer: null,
  };

  return (
    <Modal open={open} onClose={onClose} title={`Pagar: ${pr.title}`} size="md">
      <div className="space-y-4">
        {/* Amount */}
        <div className="text-center py-4 bg-slate-50 rounded-xl">
          <p className="text-3xl font-bold text-slate-900">{fmtCLP(pr.amount_clp)}</p>
          {pr.amount_usd > 0 && <p className="text-sm text-slate-400 mt-1">{fmtUSD(pr.amount_usd)}</p>}
        </div>

        {showBank ? (
          <>
            <BankTransferInfo amount={pr.amount_clp} />
            <Button variant="secondary" className="w-full" onClick={() => setShowBank(false)}>Volver</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">Selecciona un metodo de pago:</p>
            <div className="space-y-2">
              {methods.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setMethod(m.id); m.action(); }}
                  disabled={processing}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                    method === m.id && processing
                      ? 'border-cyan-300 bg-cyan-50'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  )}
                >
                  {logoMap[m.id] ? (
                    <img src={logoMap[m.id]} alt={m.label} className="h-12 w-16 rounded-xl object-contain shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${m.logoFallback}, ${m.logoFallback}cc)` }}>
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                    {m.badges && (
                      <div className="flex gap-1 mt-1">
                        {m.badges.map(b => <span key={b} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{b}</span>)}
                      </div>
                    )}
                  </div>
                  {method === m.id && processing && (
                    <svg className="w-4 h-4 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Custom Pay Form (matching production screenshot) ---
function PayLogo({ id }) {
  const logos = {
    webpay: '/panel/user/assets/logos/logowebpay.png',
    mercadopago: '/panel/user/assets/logos/logomercadopago.png',
    paypal: '/panel/user/assets/logos/logopaypal.png',
  };
  if (logos[id]) return <img src={logos[id]} alt={id} className="w-full h-full object-contain" />;
  return <div className="w-full h-full rounded-lg bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">TRA</div>;
}

const PAY_METHODS = [
  { id: 'webpay', label: 'WebPay (Transbank)', desc: 'Tarjeta credito o debito chilena', color: '#E31837' },
  { id: 'mercadopago', label: 'MercadoPago', desc: 'Cuenta MercadoPago o tarjeta', color: '#00B1EA' },
  { id: 'paypal', label: 'PayPal (USD)', desc: 'Pago internacional con PayPal', color: '#003087' },
  { id: 'transfer', label: 'Transferencia Bancaria', desc: 'Transferencia directa', color: '#10b981' },
];

function CustomPayForm({ onClose, toast, user }) {
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('webpay');
  const [processing, setProcessing] = useState(false);
  const [showBank, setShowBank] = useState(false);

  const email = user?.email || user?.user_email || '';
  const name = user?.name || '';

  async function handlePay() {
    if (!amount || parseInt(amount) <= 0) { toast?.('Ingresa un monto valido', 'error'); return; }
    setProcessing(true);
    const desc = concept || 'Pago Imporlan';
    const amt = parseInt(amount);

    try {
      if (selectedMethod === 'webpay') {
        const data = await createWebPayTransaction({ amount: amt, session_id: `pay_${Date.now()}`, buy_order: `PAY-${Date.now()}`, user_email: email, payer_name: name, description: desc, type: 'custom_payment', return_url: window.location.href });
        if (data.success && data.url && data.token) {
          const f = document.createElement('form'); f.method = 'POST'; f.action = data.url;
          const inp = document.createElement('input'); inp.type = 'hidden'; inp.name = 'token_ws'; inp.value = data.token;
          f.appendChild(inp); document.body.appendChild(f); f.submit(); return;
        } else { toast?.('Error al crear transaccion', 'error'); }
      } else if (selectedMethod === 'mercadopago') {
        const data = await createMercadoPagoPreference({ amount: amt, description: desc, plan_name: desc, payer_email: email, payer_name: name });
        if (data.success && data.init_point) { window.location.href = data.init_point; return; }
        else { toast?.('Error al crear preferencia', 'error'); }
      } else if (selectedMethod === 'transfer') {
        setShowBank(true); setProcessing(false); return;
      } else { toast?.('Metodo no disponible aun', 'warning'); }
    } catch (e) { toast?.(e.message || 'Error al procesar', 'error'); }
    setProcessing(false);
  }

  if (showBank) return (
    <div className="space-y-4">
      <BankTransferInfo amount={parseInt(amount)} />
      <Button variant="secondary" className="w-full" onClick={() => setShowBank(false)}>Volver</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">Selecciona metodo e ingresa el monto</p>

      <Input label="Monto (CLP)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ej: 150.000" />
      <Input label="Concepto" value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej: Pago inspeccion, Anticipo embarcacion..." />

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Metodo de Pago</label>
        <div className="space-y-2">
          {PAY_METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMethod(m.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                selectedMethod === m.id ? 'border-cyan-400 bg-cyan-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="w-14 h-10 shrink-0">
                <PayLogo id={m.id} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                <p className="text-xs text-slate-400">{m.desc}</p>
              </div>
              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', selectedMethod === m.id ? 'border-cyan-500' : 'border-slate-300')}>
                {selectedMethod === m.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={processing || !amount || parseInt(amount) <= 0}
        className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-600/30 hover:from-cyan-700 hover:to-cyan-600 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
        {processing ? 'Procesando...' : 'Pagar Ahora'}
      </button>
    </div>
  );
}

// --- Main Page ---
function StatTile({ label, value, sub, color, icon, active, onClick }) {
  const colors = {
    amber: 'from-amber-500/15 to-orange-500/10 text-amber-600',
    emerald: 'from-emerald-500/15 to-teal-500/10 text-emerald-600',
    rose: 'from-rose-500/15 to-red-500/10 text-rose-600',
    cyan: 'from-cyan-500/15 to-blue-500/10 text-cyan-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative bg-white border rounded-2xl p-4 text-left transition hover:shadow-sm hover:-translate-y-0.5',
        active ? 'border-cyan-300 ring-2 ring-cyan-200/60' : 'border-slate-200/70 hover:border-slate-300'
      )}
    >
      <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2', colors[color])}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
    </button>
  );
}

function ProviderCard({ logo, name, sub, desc, badges, accent, onClick }) {
  const colors = {
    red: 'hover:border-red-300 hover:shadow-red-100/50',
    cyan: 'hover:border-cyan-300 hover:shadow-cyan-100/50',
    indigo: 'hover:border-indigo-300 hover:shadow-indigo-100/50',
    emerald: 'hover:border-emerald-300 hover:shadow-emerald-100/50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative bg-white border border-slate-200/70 rounded-2xl p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5',
        colors[accent]
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-16 flex items-center justify-center rounded-xl bg-slate-50 shrink-0 overflow-hidden">
          {logo}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 truncate">{name}</p>
          <p className="text-[11px] text-slate-400 truncate">{sub}</p>
        </div>
        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {badges.map(b => (
          <span key={b.label} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ background: b.bg, color: b.color }}>{b.label}</span>
        ))}
      </div>
    </button>
  );
}

const TABS = [
  { v: 'all', label: 'Todos' },
  { v: 'pending', label: 'Pendientes' },
  { v: 'paid', label: 'Pagados' },
  { v: 'cancelled', label: 'Cancelados' },
];

export default function Payments() {
  const toast = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [showCustomPay, setShowCustomPay] = useState(false);
  const [tab, setTab] = useState('all');

  const loadRequests = useCallback(async () => {
    try {
      const data = await getMyPaymentRequests('all');
      setRequests(data.requests || data.items || []);
    } catch {
      toast?.('Error al cargar pagos', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const pending = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
  const paid = useMemo(() => requests.filter(r => r.status === 'paid'), [requests]);
  const cancelled = useMemo(() => requests.filter(r => r.status === 'cancelled'), [requests]);

  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount_clp || 0), 0);
  const paidTotal = paid.reduce((s, r) => s + Number(r.amount_clp || 0), 0);

  // Auto-jump to pending tab when there's pending work
  useEffect(() => {
    if (!loading && pending.length > 0 && tab === 'all' && requests.length > 1) setTab('pending');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const visible = useMemo(() => {
    if (tab === 'pending') return pending;
    if (tab === 'paid') return paid;
    if (tab === 'cancelled') return cancelled;
    // 'all' -> show pending first, then paid, then cancelled
    return [...pending, ...paid, ...cancelled];
  }, [tab, pending, paid, cancelled]);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-5 sm:p-7 overflow-hidden mb-5 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className={cn('w-1.5 h-1.5 rounded-full', pending.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400')} />
              {pending.length > 0 ? `${pending.length} pago${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} (${fmtCLP(pendingTotal)})` : 'Estas al dia con tus pagos'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pagos</h1>
            <p className="text-sm text-slate-300 mt-1.5">Gestiona tus pagos, facturas y metodos disponibles</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setLoading(true); loadRequests(); }} className="bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center gap-1.5">
              <svg className={cn('w-4 h-4', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Actualizar
            </Button>
            <Button onClick={() => setShowCustomPay(true)} className="bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 font-semibold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M12 4v16m8-8H4"/></svg>
              Realizar pago
            </Button>
          </div>
        </div>
      </div>

      {/* Premium Card + available methods */}
      <Card className="mb-5 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 relative">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            Tu identidad de pago
          </p>
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <div className="w-full sm:w-64 h-32 sm:h-40 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 p-3 sm:p-4 flex flex-col justify-between shrink-0 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="w-10 h-7 rounded bg-amber-400/80 flex items-center justify-center"><svg className="w-5 h-5 text-amber-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div>
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0"/></svg></div>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-mono tracking-widest">**** **** **** ****</p>
                <div className="flex items-end justify-between mt-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase">Titular</p>
                    <p className="text-white text-sm font-semibold truncate">{(user?.name || 'TITULAR').toUpperCase()}</p>
                  </div>
                  <span className="text-white font-bold text-lg tracking-wider shrink-0">VISA</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-slate-400 text-xs mb-2">Metodos disponibles para ti</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1.5 ring-1 ring-red-500/20">WebPay</span>
                <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center gap-1.5 ring-1 ring-blue-500/20">MercadoPago</span>
                <span className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 ring-1 ring-indigo-500/20">PayPal</span>
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 ring-1 ring-emerald-500/20">Transferencia</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Click en cualquier proveedor abajo para iniciar un pago manual.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Provider cards (clickeables -> abren CustomPayForm) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <ProviderCard
          accent="red"
          name="WebPay"
          sub="Transbank · Chile"
          desc="Tarjeta de credito o debito chilena, en pesos."
          badges={[
            { label: 'Credito', bg: '#fef2f2', color: '#E31837' },
            { label: 'Debito', bg: '#fef2f2', color: '#E31837' },
          ]}
          logo={<img src="/panel/user/assets/logos/logowebpay.png" alt="WebPay" className="h-10 w-14 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          onClick={() => setShowCustomPay(true)}
        />
        <ProviderCard
          accent="cyan"
          name="MercadoPago"
          sub="Mercado Libre"
          desc="Cuenta MercadoPago o cualquier tarjeta."
          badges={[
            { label: 'Wallet', bg: '#e6f7fd', color: '#00B1EA' },
            { label: 'Tarjeta', bg: '#e6f7fd', color: '#00B1EA' },
          ]}
          logo={<img src="/panel/user/assets/logos/logomercadopago.png" alt="MercadoPago" className="h-10 w-14 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          onClick={() => setShowCustomPay(true)}
        />
        <ProviderCard
          accent="indigo"
          name="PayPal"
          sub="Internacional"
          desc="Pago en USD desde tu cuenta PayPal."
          badges={[
            { label: 'USD', bg: '#e8eaf6', color: '#003087' },
            { label: 'Internacional', bg: '#e8eaf6', color: '#003087' },
          ]}
          logo={<img src="/panel/user/assets/logos/logopaypal.png" alt="PayPal" className="h-10 w-14 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          onClick={() => setShowCustomPay(true)}
        />
        <ProviderCard
          accent="emerald"
          name="Transferencia"
          sub="Banco Santander"
          desc="Transferencia directa CLP o USD. Comprobante a contacto@imporlan.cl."
          badges={[
            { label: 'CLP', bg: '#ecfdf5', color: '#059669' },
            { label: 'USD', bg: '#ecfdf5', color: '#059669' },
          ]}
          logo={<svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>}
          onClick={() => setShowCustomPay(true)}
        />
      </div>

      {/* SLA */}
      <div className="mb-5 px-4 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div className="flex-1 min-w-0 text-xs sm:text-sm">
          <p className="font-semibold text-amber-900">Procesamiento de pagos</p>
          <p className="text-amber-800/80 mt-0.5 leading-relaxed">Las solicitudes se procesan en <strong>48-72 hrs habiles</strong>. Para consultas escribinos a <a href="mailto:contacto@imporlan.cl" className="font-semibold underline decoration-amber-300 hover:decoration-amber-500">contacto@imporlan.cl</a> o por <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-500">WhatsApp</a>.</p>
        </div>
      </div>

      {/* Stats clickeables como filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Pendientes"
          value={pending.length}
          sub={pending.length > 0 ? fmtCLP(pendingTotal) : 'Al dia'}
          color="amber"
          active={tab === 'pending'}
          onClick={() => setTab(tab === 'pending' ? 'all' : 'pending')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
        />
        <StatTile
          label="Pagados"
          value={paid.length}
          sub={paid.length > 0 ? fmtCLP(paidTotal) : 'Sin historial'}
          color="emerald"
          active={tab === 'paid'}
          onClick={() => setTab(tab === 'paid' ? 'all' : 'paid')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatTile
          label="Cancelados"
          value={cancelled.length}
          color="rose"
          active={tab === 'cancelled'}
          onClick={() => setTab(tab === 'cancelled' ? 'all' : 'cancelled')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>}
        />
        <StatTile
          label="Total"
          value={requests.length}
          color="cyan"
          active={tab === 'all'}
          onClick={() => setTab('all')}
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
        />
      </div>

      {/* Tab pills */}
      {requests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TABS.map(t => {
            const c = t.v === 'pending' ? pending.length : t.v === 'paid' ? paid.length : t.v === 'cancelled' ? cancelled.length : requests.length;
            return (
              <button
                key={t.v}
                onClick={() => setTab(t.v)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                  tab === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                )}
              >
                {t.label}
                <span className={cn('text-[10px] tabular-nums', tab === t.v ? 'text-white/80' : 'text-slate-400')}>{c}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          </div>
          {requests.length === 0 ? (
            <>
              <p className="text-slate-700 font-semibold">No hay solicitudes de pago todavia</p>
              <p className="text-sm text-slate-500 mt-1">Cuando el equipo Imporlan genere una solicitud aparecera aqui. Tambien podes iniciar un pago manual cuando quieras.</p>
              <Button variant="accent" size="sm" className="mt-4" onClick={() => setShowCustomPay(true)}>Realizar pago manual</Button>
            </>
          ) : (
            <>
              <p className="text-slate-700 font-semibold">No hay {TABS.find(t => t.v === tab)?.label.toLowerCase()}</p>
              <p className="text-sm text-slate-500 mt-1">Probá cambiar de pestaña.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setTab('all')}>Ver todos</Button>
            </>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(r => <PaymentCard key={r.id} req={r} onPay={setPayTarget} />)}
        </div>
      )}

      {/* Pay modal for existing requests */}
      <PayModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        paymentRequest={payTarget}
        toast={toast}
      />

      {/* Custom payment modal */}
      <Modal open={showCustomPay} onClose={() => setShowCustomPay(false)} title="Realizar pago" size="md">
        <CustomPayForm
          onClose={() => setShowCustomPay(false)}
          toast={toast}
          user={user}
        />
      </Modal>
    </div>
  );
}
