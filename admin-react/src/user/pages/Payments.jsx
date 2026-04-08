import { useState, useEffect, useCallback } from 'react';
import { getMyPaymentRequests, createWebPayTransaction, createMercadoPagoPreference, createPayPalOrder, capturePayPalOrder, getPayPalClientId } from '../api';
import { fmtDate, fmtCLP, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { PageHeader, Card, Badge, Button, Modal, Spinner, StatCard } from '../../shared/components/UI';
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
  const meta = req.metadata || {};

  return (
    <Card className={cn('relative', isPending && 'border-amber-200 shadow-amber-100/50')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800">{req.title}</p>
          {req.description && <p className="text-xs text-slate-400 mt-0.5">{req.description}</p>}
        </div>
        <Badge className={st.color}>{st.label}</Badge>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <p className="text-xl font-bold text-slate-900">{fmtCLP(req.amount_clp)}</p>
        {req.amount_usd > 0 && (
          <p className="text-sm text-slate-400">{fmtUSD(req.amount_usd)}</p>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{fmtDate(req.created_at)}</span>
        {meta.boat_name && <span>{meta.boat_name}</span>}
        {req.payment_method && req.status === 'paid' && (
          <span className="capitalize">{req.payment_method.replace(/_/g, ' ')}</span>
        )}
        {req.paid_at && <span>Pagado: {fmtDate(req.paid_at)}</span>}
      </div>

      {req.status === 'cancelled' && req.cancelled_reason && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
          {req.cancelled_reason}
        </div>
      )}

      {isPending && (
        <Button variant="accent" size="sm" className="mt-4 w-full" onClick={() => onPay(req)}>
          Pagar Ahora
        </Button>
      )}
    </Card>
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
    { id: 'webpay', label: 'WebPay', desc: 'Tarjeta credito/debito', icon: '💳', action: handleWebPay },
    { id: 'mercadopago', label: 'MercadoPago', desc: 'Multiples medios de pago', icon: '🏦', action: handleMercadoPago },
    { id: 'transfer', label: 'Transferencia', desc: 'Banco Santander', icon: '🏧', action: () => setShowBank(true) },
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Pagar: ${pr.title}`} size="md">
      <div className="space-y-4">
        {/* Amount */}
        <div className="text-center py-3 bg-slate-50 rounded-xl">
          <p className="text-2xl font-bold text-slate-900">{fmtCLP(pr.amount_clp)}</p>
          {pr.amount_usd > 0 && <p className="text-sm text-slate-400">{fmtUSD(pr.amount_usd)}</p>}
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
                      : 'border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
                  )}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{m.label}</p>
                    <p className="text-xs text-slate-400">{m.desc}</p>
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

// --- Main Page ---
export default function Payments() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await getMyPaymentRequests('all');
      setRequests(data.requests || data.items || []);
    } catch (e) {
      toast?.('Error al cargar pagos', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const pending = requests.filter(r => r.status === 'pending');
  const paid = requests.filter(r => r.status === 'paid');
  const cancelled = requests.filter(r => r.status === 'cancelled');

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Pagos" subtitle="Solicitudes de pago y transacciones" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pendientes" value={pending.length} color="yellow"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
        />
        <StatCard label="Pagados" value={paid.length} color="green"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard label="Cancelados" value={cancelled.length} color="red"
          icon={<svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <StatCard label="Total" value={requests.length} color="blue"
          icon={<svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
        />
      </div>

      {requests.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
          <p className="text-slate-500 font-medium">No tienes solicitudes de pago</p>
          <p className="text-sm text-slate-400 mt-1">Cuando el equipo Imporlan genere una solicitud, aparecera aqui.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Pendientes ({pending.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pending.map(r => <PaymentCard key={r.id} req={r} onPay={setPayTarget} />)}
              </div>
            </div>
          )}

          {/* Paid */}
          {paid.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                Historial - Pagados ({paid.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paid.map(r => <PaymentCard key={r.id} req={r} onPay={setPayTarget} />)}
              </div>
            </div>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                Cancelados ({cancelled.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cancelled.map(r => <PaymentCard key={r.id} req={r} onPay={setPayTarget} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay modal */}
      <PayModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        paymentRequest={payTarget}
        toast={toast}
      />
    </div>
  );
}
