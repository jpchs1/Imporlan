import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Badge, Callout } from '../../shared/components/UI';
import { CircleCheck } from '../../shared/components/Icons';

const STORAGE_KEY = 'imporlan_payment_popup_shown_';

const PLAN_NAMES = {
  fragata: 'Plan Fragata',
  capitan: 'Plan Capitán de Navío',
  almirante: 'Plan Almirante',
};

function isPlanDeBusqueda(planId) {
  return planId === 'fragata' || planId === 'capitan' || planId === 'almirante';
}

function readParams(search, hash) {
  const q = new URLSearchParams(search || '');
  let h = new URLSearchParams();
  if (hash && hash.includes('?')) h = new URLSearchParams(hash.split('?')[1]);
  return {
    payment: q.get('payment') || h.get('payment'),
    plan: q.get('plan') || h.get('plan'),
    order: q.get('order') || h.get('order'),
    source: q.get('source') || h.get('source'),
    justCreated: (q.get('just_created') || h.get('just_created')) === '1',
  };
}

/**
 * Aviso tras volver de la pasarela (`?payment=success`). Se muestra una sola
 * vez por pago (localStorage) y se queda abierto hasta que el cliente lo
 * cierra: nada de cuenta regresiva. `readParams` y `close` (limpieza de los
 * parámetros de WebPay / Mercado Pago en la URL) no cambian.
 */
export default function PostPaymentPopup() {
  const navigate = useNavigate();
  const [params, setParams] = useState(null);
  const closingRef = useRef(false);

  useEffect(() => {
    const p = readParams(window.location.search, window.location.hash);
    if (p.payment !== 'success') return;
    const key = STORAGE_KEY + (p.order || p.plan || 'general');
    try { if (localStorage.getItem(key) === 'true') return; } catch { /* empty */ }
    const t = setTimeout(() => {
      setParams(p);
      try { localStorage.setItem(key, 'true'); } catch { /* empty */ }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setParams(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('plan');
      url.searchParams.delete('order');
      url.searchParams.delete('source');
      url.searchParams.delete('just_created');
      // Also strip these params from inside the hash (HashRouter places
      // query params after the hash route, e.g. #/expedientes?payment=success).
      let cleanHash = url.hash;
      if (cleanHash.includes('?')) {
        const [route, qs] = cleanHash.split('?');
        const hp = new URLSearchParams(qs);
        ['payment', 'plan', 'order', 'source', 'just_created',
         'collection_id', 'collection_status', 'payment_id', 'status',
         'external_reference', 'payment_type', 'merchant_order_id',
         'preference_id', 'site_id', 'processing_mode', 'merchant_account_id',
         'token'].forEach(k => hp.delete(k));
        const remaining = hp.toString();
        cleanHash = remaining ? `${route}?${remaining}` : route;
      }
      window.history.replaceState({}, '', url.pathname + url.search + cleanHash);
    } catch { /* empty */ }
    setTimeout(() => { closingRef.current = false; }, 100);
  }, []);

  function goToProducts() {
    close();
    navigate('/expedientes');
  }

  if (!params) return null;

  const planName = PLAN_NAMES[params.plan] || params.plan || null;
  const isBusqueda = isPlanDeBusqueda(params.plan);
  const isAlmirante = params.plan === 'almirante';
  const title = isBusqueda
    ? 'Tu plan de búsqueda ya está activo'
    : (params.justCreated ? 'Recibimos tus links' : 'Tu cotización por links ya está activa');
  const message = isBusqueda
    ? 'Nuestro equipo ya empezó a trabajar en tu búsqueda. Puedes seguir el avance desde tu expediente.'
    : (params.justCreated
        ? 'Creamos un expediente con tus links. Empezamos a cotizar y te avisamos por correo cuando esté listo.'
        : 'Puedes revisar el detalle de tu cotización desde tu expediente.');

  return (
    <Modal
      open
      onClose={close}
      size="sm"
      title={title}
      footer={<Button block onClick={goToProducts}>Ver mi expediente</Button>}
    >
      <div className="text-center">
        <span className="mx-auto h-14 w-14 rounded-full bg-success-bg text-success flex items-center justify-center" aria-hidden="true">
          <CircleCheck size={32} />
        </span>
        {planName && <div className="mt-4"><Badge tone="brand">{planName}</Badge></div>}
        {params.order && <p className="text-13 text-ink-500 mt-2">Expediente {params.order}</p>}
        <p className="text-sm text-ink-700 mt-3">{message}</p>
      </div>

      <div className="mt-5 space-y-3 text-left">
        {isAlmirante && (
          <Callout tone="success" compact>Tu plan incluye el reporte de inteligencia artificial.</Callout>
        )}
        {isBusqueda && !isAlmirante && (
          <Callout tone="neutral" compact>Si quieres el reporte de inteligencia artificial, tiene un valor adicional de $15.000; pídeselo a tu agente.</Callout>
        )}
        <Callout tone="info" title="Tiempo de respuesta" compact>
          Trabajamos tu requerimiento en hasta 48 horas hábiles (hasta 72 en períodos de alta demanda). Por correo o WhatsApp estamos atentos a cualquier duda.
        </Callout>
      </div>
    </Modal>
  );
}
