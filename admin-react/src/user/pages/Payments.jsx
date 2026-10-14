import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMyPaymentRequests, getMyOrders, createWebPayTransaction, createMercadoPagoPreference } from '../api';
import { fmtDate, fmtCLP, cn, paymentMethodLabel } from '../../shared/lib/utils';
import { fmtDateLarga } from '../../shared/lib/format';
import { useAuth } from '../../shared/context/AuthContext';
import {
  Card, Button, IconButton, Modal, Input, MoneyInput, PageHeader, Tabs, DataTable, Money,
  StatusBadge, EmptyState, ErrorState, Skeleton, Callout, DescriptionList, SectionTitle,
} from '../../shared/components/UI';
import { Plus, Copy, Check, Banknote, Ship, Receipt, RefreshCw, WebPayIcon, MercadoPagoIcon, WhatsAppIcon } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

/* ---------------------------------------------------------------------------
   Medios de pago. PayPal no se lista: el panel no tiene flujo de pago con
   PayPal (el formulario antiguo respondía "Método no disponible aún").
   --------------------------------------------------------------------------- */
const METODOS = [
  { id: 'webpay', label: 'WebPay', desc: 'Tarjeta de crédito o débito · Transbank', icon: WebPayIcon },
  { id: 'mercadopago', label: 'Mercado Pago', desc: 'Cuenta Mercado Pago o tarjeta', icon: MercadoPagoIcon },
  { id: 'transfer', label: 'Transferencia bancaria', desc: 'Banco Santander · te mostramos los datos', icon: Banknote },
];

const BANCO = [
  { label: 'Banco', value: 'Banco Santander' },
  { label: 'Titular', value: 'Imporlan SpA' },
  { label: 'RUT', value: '76.914.409-9' },
  { label: 'Cuenta corriente CLP', value: '74233813' },
  { label: 'Cuenta USD', value: '5100369305' },
  { label: 'SWIFT', value: 'BSCHCLRM' },
  { label: 'Correo', value: 'contacto@imporlan.cl' },
];

/*
 * Referencia pública del expediente de una solicitud de pago.
 *
 * `api/payment_requests_api.php` guarda `metadata.order_id` con lo que el
 * equipo escribió al crear la solicitud: a veces el id interno (35), a veces
 * el número público («IMP-00035»). Nunca guarda `order_number`. Para no
 * mostrar un id interno como si fuera el número, se cruza con los
 * expedientes del cliente (`getMyOrders`) y se usa su `order_number`; si no
 * calza con ninguno, solo se muestra cuando ya viene con formato «IMP-…».
 */
function referenciaExpediente(req, ordersById) {
  const meta = req?.metadata || {};
  if (meta.order_number) return String(meta.order_number);
  const raw = meta.order_id;
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim();
  const porId = ordersById.get(s);
  if (porId) return porId;
  if (/^IMP-\d+$/i.test(s)) return s.toUpperCase();
  const porNumero = [...ordersById.values()].find(n => String(n).toLowerCase() === s.toLowerCase());
  return porNumero || '';
}

/** Mapa id → order_number con los expedientes del cliente (solo lectura). */
function useMisExpedientes() {
  const [ordersById, setOrdersById] = useState(() => new Map());
  useEffect(() => {
    let vivo = true;
    getMyOrders()
      .then((r) => {
        if (!vivo) return;
        const list = r?.orders || r?.data || (Array.isArray(r) ? r : []);
        const m = new Map();
        for (const o of Array.isArray(list) ? list : []) {
          if (o?.id !== undefined && o?.order_number) m.set(String(o.id), String(o.order_number));
        }
        setOrdersById(m);
      })
      .catch(() => { /* sin expedientes no hay referencia; el pago se muestra igual */ });
    return () => { vivo = false; };
  }, []);
  return ordersById;
}

/** Envía el token de WebPay por POST (igual que siempre: form + token_ws). */
function enviarAWebPay(url, token) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token_ws';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

/* ---------------------------------------------------------------------------
   Selector de medio (radio accesible)
   --------------------------------------------------------------------------- */
function SelectorMedio({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Medio de pago" className="space-y-2">
      {METODOS.map(m => {
        const Icon = m.icon;
        const sel = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={sel}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-3 rounded-lg border text-left transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed',
              sel ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400 bg-surface',
            )}
          >
            <span className={cn('h-10 w-10 rounded-md flex items-center justify-center shrink-0', sel ? 'bg-brand-100 text-brand-700' : 'bg-neutral-bg text-ink-700')}>
              <Icon size={22} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-ink-900">{m.label}</span>
              <span className="block text-13 text-ink-500">{m.desc}</span>
            </span>
            <span className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', sel ? 'border-brand-600' : 'border-line-strong')} aria-hidden="true">
              {sel && <span className="h-2 w-2 rounded-full bg-brand-600" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Datos para transferir, con "Copiar" por campo
   --------------------------------------------------------------------------- */
function DatosTransferencia({ amount, concepto }) {
  const toast = useToast();
  const [copiado, setCopiado] = useState(null);

  async function copiar(campo, valor) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(campo);
      setTimeout(() => setCopiado(c => (c === campo ? null : c)), 1500);
    } catch {
      toast?.({ type: 'error', title: 'No se pudo copiar', description: 'Selecciona el texto y cópialo a mano.' });
    }
  }

  // El monto se ve con formato pero se copia como número, listo para el banco.
  const filas = [...BANCO, { label: 'Monto', value: fmtCLP(amount), copy: String(Math.round(Number(amount) || 0)), bold: true }];
  if (concepto) filas.push({ label: 'Glosa', value: concepto });

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700">Transfiere a esta cuenta y envíanos el comprobante. Confirmamos el pago en el mismo día hábil.</p>
      <dl className="rounded-lg border border-line divide-y divide-line">
        {filas.map(f => (
          <div key={f.label} className="flex items-center gap-3 px-3.5 py-2.5">
            <dt className="text-13 text-ink-500 w-36 shrink-0">{f.label}</dt>
            <dd className="flex-1 min-w-0 flex items-center gap-2">
              <span className={cn('flex-1 min-w-0 text-sm text-ink-900 break-all tabular', f.bold && 'font-semibold')}>{f.value}</span>
              <IconButton
                size="sm"
                icon={copiado === f.label ? Check : Copy}
                aria-label={`Copiar ${f.label.toLowerCase()}`}
                onClick={() => copiar(f.label, f.copy ?? f.value)}
                className={copiado === f.label ? 'text-success' : undefined}
              />
            </dd>
          </div>
        ))}
      </dl>
      <Callout tone="info" title="Envía el comprobante a contacto@imporlan.cl">
        También puedes mandarlo por{' '}
        <a href="https://wa.me/56940211459?text=Hola%2C%20les%20env%C3%ADo%20el%20comprobante%20de%20mi%20transferencia" target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">WhatsApp</a>.
        Indica el número del expediente o el concepto del pago.
      </Callout>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Modal: pagar una solicitud existente
   --------------------------------------------------------------------------- */
function PayModal({ open, onClose, paymentRequest, toast, expediente }) {
  const { user } = useAuth();
  const [method, setMethod] = useState('webpay');
  const [processing, setProcessing] = useState(false);
  const [showBank, setShowBank] = useState(false);

  if (!paymentRequest) return null;
  const pr = paymentRequest;
  const email = user?.email || user?.user_email || '';
  const name = user?.name || '';
  const meta = pr.metadata || {};

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
        enviarAWebPay(data.url, data.token);
        return;
      }
      toast?.({ type: 'error', title: 'No pudimos iniciar el pago con WebPay', description: 'Vuelve a intentarlo o elige otro medio.' });
    } catch {
      toast?.({ type: 'error', title: 'Sin conexión con WebPay', description: 'Revisa tu conexión y vuelve a intentarlo.' });
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
        return;
      }
      toast?.({ type: 'error', title: 'No pudimos iniciar el pago con Mercado Pago', description: 'Vuelve a intentarlo o elige otro medio.' });
    } catch {
      toast?.({ type: 'error', title: 'Sin conexión con Mercado Pago', description: 'Revisa tu conexión y vuelve a intentarlo.' });
    }
    setProcessing(false);
  }

  function continuar() {
    if (method === 'webpay') return handleWebPay();
    if (method === 'mercadopago') return handleMercadoPago();
    setShowBank(true);
  }

  const etiqueta = METODOS.find(m => m.id === method)?.label;

  return (
    <Modal
      open={open}
      onClose={processing ? undefined : onClose}
      title={showBank ? 'Datos para transferir' : 'Pagar'}
      description={pr.title}
      size="md"
      footer={showBank ? (
        <>
          <Button variant="secondary" onClick={() => setShowBank(false)}>Elegir otro medio</Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose} disabled={processing}>Cancelar</Button>
          <Button onClick={continuar} loading={processing}>
            {method === 'transfer'
              ? 'Ver datos de transferencia'
              : <>Pagar <span className="hidden sm:inline">{fmtCLP(pr.amount_clp)} </span>con {etiqueta}</>}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-canvas border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow">Monto a pagar</p>
            <Money clp={pr.amount_clp} usd={pr.amount_usd > 0 ? pr.amount_usd : undefined} size="xl" />
          </div>
          {(expediente || meta.boat_name) && (
            <div className="text-right text-13 text-ink-500 shrink-0 max-w-[45%]">
              {expediente && <p className="font-medium text-ink-700">{expediente}</p>}
              {meta.boat_name && <p className="truncate">{meta.boat_name}</p>}
            </div>
          )}
        </div>

        {showBank ? (
          <DatosTransferencia amount={pr.amount_clp} concepto={expediente ? `${expediente} · ${pr.title}` : pr.title} />
        ) : (
          <div>
            <p className="text-sm font-medium text-ink-900 mb-2">Elige cómo pagar</p>
            <SelectorMedio value={method} onChange={setMethod} disabled={processing} />
            <p className="text-xs text-ink-500 mt-3">Te llevamos al sitio seguro de {method === 'mercadopago' ? 'Mercado Pago' : 'Transbank'} y vuelves al panel al terminar.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
   Modal: pagar otro monto (pago manual)
   --------------------------------------------------------------------------- */
function CustomPayModal({ open, onClose, toast, user }) {
  const [amount, setAmount] = useState(null);
  const [concept, setConcept] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('webpay');
  const [processing, setProcessing] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [tried, setTried] = useState(false);

  const email = user?.email || user?.user_email || '';
  const name = user?.name || '';
  const montoOk = !!amount && parseInt(amount) > 0;

  async function handlePay() {
    setTried(true);
    if (!montoOk) return;
    setProcessing(true);
    const desc = concept || 'Pago Imporlan';
    const amt = parseInt(amount);

    try {
      if (selectedMethod === 'webpay') {
        const data = await createWebPayTransaction({ amount: amt, session_id: `pay_${Date.now()}`, buy_order: `PAY-${Date.now()}`, user_email: email, payer_name: name, description: desc, type: 'custom_payment', return_url: window.location.href });
        if (data.success && data.url && data.token) { enviarAWebPay(data.url, data.token); return; }
        toast?.({ type: 'error', title: 'No pudimos iniciar el pago con WebPay', description: 'Vuelve a intentarlo o elige otro medio.' });
      } else if (selectedMethod === 'mercadopago') {
        const data = await createMercadoPagoPreference({ amount: amt, description: desc, plan_name: desc, payer_email: email, payer_name: name });
        if (data.success && data.init_point) { window.location.href = data.init_point; return; }
        toast?.({ type: 'error', title: 'No pudimos iniciar el pago con Mercado Pago', description: 'Vuelve a intentarlo o elige otro medio.' });
      } else if (selectedMethod === 'transfer') {
        setShowBank(true); setProcessing(false); return;
      }
    } catch (e) {
      toast?.({ type: 'error', title: 'No se pudo procesar el pago', description: e?.message });
    }
    setProcessing(false);
  }

  const etiqueta = METODOS.find(m => m.id === selectedMethod)?.label;

  return (
    <Modal
      open={open}
      onClose={processing ? undefined : onClose}
      title={showBank ? 'Datos para transferir' : 'Pagar otro monto'}
      description={showBank ? (concept || 'Pago Imporlan') : 'Para abonos, inspecciones u otros cobros que acordaste con tu agente.'}
      size="md"
      footer={showBank ? (
        <>
          <Button variant="secondary" onClick={() => setShowBank(false)}>Volver</Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose} disabled={processing}>Cancelar</Button>
          <Button onClick={handlePay} loading={processing} disabled={!montoOk}>
            {selectedMethod === 'transfer'
              ? 'Ver datos de transferencia'
              : montoOk ? <>Pagar <span className="hidden sm:inline">{fmtCLP(parseInt(amount))} </span>con {etiqueta}</> : 'Pagar'}
          </Button>
        </>
      )}
    >
      {showBank ? (
        <DatosTransferencia amount={parseInt(amount)} concepto={concept} />
      ) : (
        <div className="space-y-4">
          <MoneyInput
            label="Monto"
            currency="CLP"
            value={amount}
            onChange={setAmount}
            required
            error={tried && !montoOk ? 'Ingresa un monto mayor a $0' : undefined}
            hint="En pesos chilenos, sin decimales."
          />
          <Input
            label="Concepto"
            value={concept}
            onChange={e => setConcept(e.target.value)}
            placeholder="Ej.: Pago inspección, anticipo embarcación…"
            hint="Opcional. Nos ayuda a asociar el pago a tu expediente."
            maxLength={120}
          />
          <div>
            <p className="text-13 font-medium text-ink-700 mb-1.5">Medio de pago</p>
            <SelectorMedio value={selectedMethod} onChange={setSelectedMethod} disabled={processing} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
   Solicitud pendiente (tarjeta ancha)
   --------------------------------------------------------------------------- */
function PendienteCard({ req, onPay, expediente }) {
  const meta = req.metadata || {};
  return (
    <Card as="article" className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink-900">{req.title}</h3>
          <StatusBadge kind="pago" status={req.status} dot />
        </div>
        {req.description && <p className="text-sm text-ink-500 mt-1">{req.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-13 text-ink-500">
          {expediente && <span className="font-medium text-ink-700">{expediente}</span>}
          {meta.boat_name && <span className="inline-flex items-center gap-1.5"><Ship size={14} /> {meta.boat_name}</span>}
          <span>Solicitado el {fmtDateLarga(req.created_at)}</span>
          {req.due_at && <span className="text-warning font-medium">Vence el {fmtDateLarga(req.due_at)}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-3 sm:shrink-0">
        <Money clp={req.amount_clp} usd={req.amount_usd > 0 ? req.amount_usd : undefined} size="xl" align="right" />
        <Button onClick={() => onPay(req)} icon={Receipt}>Pagar</Button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Detalle de un pago (historial)
   --------------------------------------------------------------------------- */
function DetalleModal({ req, onClose, onPay, expediente }) {
  if (!req) return null;
  const meta = req.metadata || {};
  const comprobante = req.receipt_url || req.voucher_url || req.comprobante_url;
  // La API no guarda fecha de cancelación (solo `cancelled_reason`), así que
  // un pago cancelado muestra únicamente cuándo se solicitó.
  const items = [
    { label: 'Monto', value: <Money clp={req.amount_clp} usd={req.amount_usd > 0 ? req.amount_usd : undefined} size="lg" /> },
    { label: 'Estado', value: <StatusBadge kind="pago" status={req.status} dot /> },
    { label: 'Solicitado', value: fmtDateLarga(req.created_at) },
    req.paid_at && { label: 'Pagado', value: fmtDateLarga(req.paid_at) },
    req.payment_method && { label: 'Medio de pago', value: paymentMethodLabel(req.payment_method) },
    expediente && { label: 'Expediente', value: expediente },
    meta.boat_name && { label: 'Embarcación', value: meta.boat_name },
    (req.payment_id || req.transaction_id) && { label: 'ID de transacción', value: req.payment_id || req.transaction_id, mono: true },
  ].filter(Boolean);

  return (
    <Modal
      open={!!req}
      onClose={onClose}
      title={req.title}
      size="md"
      footer={(
        <>
          {comprobante && <a href={comprobante} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline mr-auto">Ver comprobante</a>}
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          {req.status === 'pending' && <Button onClick={() => { onClose(); onPay(req); }}>Pagar</Button>}
        </>
      )}
    >
      <div className="space-y-5">
        {req.description && <p className="text-sm text-ink-700">{req.description}</p>}
        <DescriptionList cols={2} items={items} />
        {req.status === 'cancelled' && req.cancelled_reason && (
          <Callout tone="neutral" title="Motivo de la cancelación">{req.cancelled_reason}</Callout>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */
const TABS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'paid', label: 'Pagados' },
  { id: 'cancelled', label: 'Cancelados' },
];

export default function Payments() {
  const toast = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [showCustomPay, setShowCustomPay] = useState(false);
  const [tab, setTab] = useState(null);
  const ordersById = useMisExpedientes();
  const expedienteDe = useCallback((r) => referenciaExpediente(r, ordersById), [ordersById]);

  // Sin setState síncrono antes del await: la carga inicial parte con
  // loading=true y `recargar` (botón / reintentar) lo vuelve a poner.
  const loadRequests = useCallback(() => getMyPaymentRequests('all')
    .then((data) => { setRequests(data.requests || data.items || []); setError(null); })
    .catch((e) => { setError(e?.message || 'No pudimos cargar tus pagos.'); })
    .finally(() => { setLoading(false); }), []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  function recargar() {
    setLoading(true);
    setError(null);
    loadRequests();
  }

  const pending = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
  const paid = useMemo(() => requests.filter(r => r.status === 'paid'), [requests]);
  const cancelled = useMemo(() => requests.filter(r => r.status === 'cancelled'), [requests]);
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount_clp || 0), 0);

  // Pestaña inicial: pendientes si hay; si no, el historial de pagados.
  const tabActual = tab || (pending.length > 0 ? 'pending' : 'paid');
  const visible = tabActual === 'pending' ? pending : tabActual === 'paid' ? paid : cancelled;

  // «Fecha» es cuando se solicitó (`created_at`). «Pagado» (`paid_at`) solo
  // tiene sentido en Pendientes/Pagados: la API no guarda cuándo se canceló
  // una solicitud, así que en Cancelados no hay columna de fecha inventada.
  const columns = [
    { key: 'created_at', header: 'Solicitado', width: 120, cell: r => <span className="tabular whitespace-nowrap">{fmtDate(r.created_at)}</span>, sortValue: r => new Date(r.created_at).getTime() },
    { key: 'title', header: 'Concepto', cell: r => {
      const ref = [expedienteDe(r), r.metadata?.boat_name].filter(Boolean).join(' · ');
      return (
        <div className="min-w-0">
          <p className="font-medium text-ink-900 truncate max-w-[36ch]">{r.title}</p>
          {ref && <p className="text-13 text-ink-500 truncate max-w-[36ch]">{ref}</p>}
        </div>
      );
    } },
    { key: 'payment_method', header: 'Medio', priority: 2, cell: r => r.payment_method ? paymentMethodLabel(r.payment_method) : <span className="text-ink-500">—</span> },
    tabActual !== 'cancelled' && { key: 'paid_at', header: 'Pagado', priority: 3, cell: r => <span className="tabular">{r.paid_at ? fmtDate(r.paid_at) : '—'}</span>, sortValue: r => (r.paid_at ? new Date(r.paid_at).getTime() : 0) },
    { key: 'amount_clp', header: 'Monto', align: 'right', cell: r => <Money clp={r.amount_clp} usd={r.amount_usd > 0 ? r.amount_usd : undefined} align="right" />, sortValue: r => Number(r.amount_clp) },
    { key: 'status', header: 'Estado', priority: 2, cell: r => <StatusBadge kind="pago" status={r.status} dot /> },
  ].filter(Boolean);

  const acciones = (r) => [
    { label: 'Ver detalle', icon: Receipt, onClick: () => setDetalle(r) },
    r.status === 'pending' && { label: 'Pagar', icon: Banknote, onClick: () => setPayTarget(r) },
    (r.receipt_url || r.voucher_url || r.comprobante_url) && { label: 'Ver comprobante', icon: Receipt, onClick: () => window.open(r.receipt_url || r.voucher_url || r.comprobante_url, '_blank', 'noopener') },
  ];

  const vacioTab = {
    pending: { title: 'No tienes pagos pendientes', description: 'Cuando tu agente genere una solicitud de pago, aparecerá aquí.' },
    paid: { title: 'Aún no hay pagos realizados', description: 'Aquí quedará tu historial con fecha, medio y monto.' },
    cancelled: { title: 'No hay pagos cancelados', description: 'Las solicitudes anuladas por el equipo se listan aquí.' },
  }[tabActual];

  return (
    <div className="pb-12">
      <PageHeader
        title="Pagos"
        description="Las solicitudes de pago de tus expedientes y tu historial."
        actions={(
          <>
            <IconButton icon={RefreshCw} aria-label="Actualizar" variant="secondary" onClick={recargar} loading={loading && requests.length > 0} />
            <Button variant="secondary" icon={Plus} onClick={() => setShowCustomPay(true)}>Pagar otro monto</Button>
          </>
        )}
      />

      {error && !loading ? (
        <Card><ErrorState title="No pudimos cargar tus pagos" message="Revisa tu conexión y vuelve a intentarlo." detail={error} onRetry={recargar} /></Card>
      ) : loading && requests.length === 0 ? (
        <div className="space-y-4">
          <Skeleton.Card lines={2} />
          <Skeleton.Card lines={2} />
          <Card padding="none"><Skeleton.TableRows rows={4} cols={5} /></Card>
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="Aún no tienes solicitudes de pago"
            description="Cuando el equipo de Imporlan genere una solicitud para tu expediente, aparecerá aquí con el monto y el botón para pagarla."
            primaryAction={<Button icon={Plus} onClick={() => setShowCustomPay(true)}>Pagar otro monto</Button>}
            secondaryAction={<Button variant="ghost" icon={WhatsAppIcon} onClick={() => window.open('https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20un%20pago', '_blank', 'noopener')}>Escríbenos por WhatsApp</Button>}
          />
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section aria-labelledby="por-pagar" className="mb-8">
              <SectionTitle
                title={<span id="por-pagar">Por pagar</span>}
                description={`${pending.length} ${pending.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} · ${fmtCLP(pendingTotal)} en total`}
              />
              <div className="space-y-3">
                {pending.map(r => <PendienteCard key={r.id} req={r} onPay={setPayTarget} expediente={expedienteDe(r)} />)}
              </div>
            </section>
          )}

          <section aria-label="Historial de pagos">
            <Tabs
              tabs={TABS.map(t => ({ ...t, count: t.id === 'pending' ? pending.length : t.id === 'paid' ? paid.length : cancelled.length }))}
              value={tabActual}
              onChange={setTab}
              aria-label="Historial de pagos"
              className="mb-4"
            />
            <Card padding="none">
              <DataTable
                columns={columns}
                data={visible}
                rowKey={r => r.id}
                onRowClick={setDetalle}
                rowActions={acciones}
                loading={loading}
                aria-label="Pagos"
                emptyState={<EmptyState compact icon={Receipt} title={vacioTab.title} description={vacioTab.description} />}
                mobileCard={r => (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900 truncate">{r.title}</p>
                      <p className="text-13 text-ink-500">{[fmtDate(r.created_at), expedienteDe(r), r.payment_method && paymentMethodLabel(r.payment_method)].filter(Boolean).join(' · ')}</p>
                      <div className="mt-1.5"><StatusBadge kind="pago" status={r.status} dot size="sm" /></div>
                    </div>
                    <Money clp={r.amount_clp} align="right" />
                  </div>
                )}
                pageSize={25}
              />
            </Card>
          </section>
        </>
      )}

      {/* Se montan solo abiertos: cada apertura parte con el estado limpio. */}
      {payTarget && <PayModal open onClose={() => setPayTarget(null)} paymentRequest={payTarget} toast={toast} expediente={expedienteDe(payTarget)} />}
      {detalle && <DetalleModal req={detalle} onClose={() => setDetalle(null)} onPay={setPayTarget} expediente={expedienteDe(detalle)} />}
      {showCustomPay && <CustomPayModal open onClose={() => setShowCustomPay(false)} toast={toast} user={user} />}
    </div>
  );
}
