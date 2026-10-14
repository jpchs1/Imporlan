import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { getMyOrders, getMyPaymentRequests, getMyConversations, getNotifications, markNotificationRead } from '../api';
import { cn } from '../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../shared/lib/format';
import { Card, SectionTitle, PageHeader, Money, StatusBadge, ProcessStepper, EmptyState, ErrorState, Skeleton, Callout } from '../../shared/components/UI';
import { CreditCard, MessageCircle, File, FolderOpen, CircleCheck, WhatsAppIcon, ChevronRight } from '../../shared/components/Icons';
import DeckevaPromo from '../components/DeckevaPromo';
import { BotonEnlace } from './inicio/BotonEnlace';
import { WA_AYUDA } from './inicio/whatsapp';
import { FilaNotificacion } from './inicio/FilaNotificacion';
import { irAlEnlace } from './inicio/notificaciones';

const CERRADOS = new Set(['completed', 'canceled', 'cancelled', 'expired']);

/** Carga independiente por sección: cada bloque pinta apenas llega su dato. */
function useCarga(fn, vacio) {
  const [estado, setEstado] = useState({ data: vacio, loading: true, error: null });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    fn()
      .then(data => { if (activo) setEstado({ data, loading: false, error: null }); })
      .catch(e => { if (activo) setEstado({ data: vacio, loading: false, error: e }); });
    return () => { activo = false; };
  }, [fn, vacio, intento]);
  const recargar = useCallback(() => { setEstado(s => ({ ...s, loading: true, error: null })); setIntento(n => n + 1); }, []);
  return { ...estado, recargar };
}

const cargaOrdenes = () => getMyOrders().then(d => (d?.success && d.orders) ? d.orders : []);
const cargaPagos = () => getMyPaymentRequests('all').then(d => d?.requests || d?.items || []);
const cargaConversaciones = () => getMyConversations().then(d => d?.conversations || []);
const cargaNotificaciones = () => getNotifications(20).then(d => d?.notifications || []);
const VACIO = [];

function saludoDelDia() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/* ---------------------------------------------------------------------------
   Qué hacer ahora
   --------------------------------------------------------------------------- */
function Pendiente({ icon, tone = 'neutral', title, meta, right, children }) {
  const Icon = icon;
  const tones = {
    warning: 'bg-warning-bg text-warning',
    info: 'bg-info-bg text-info',
    brand: 'bg-brand-100 text-brand-700',
    neutral: 'bg-neutral-bg text-ink-500',
  };
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-(--card-pad) py-3.5">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className={cn('h-9 w-9 rounded-md flex items-center justify-center shrink-0', tones[tone])} aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900 leading-5">{title}</p>
          {meta && <p className="text-13 text-ink-500 mt-0.5 truncate">{meta}</p>}
          {children}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 pl-12 sm:pl-0 shrink-0">
        {right}
      </div>
    </li>
  );
}

function QueHacerAhora({ pagos, conversaciones, notificaciones, cargando }) {
  const pendientes = pagos.filter(p => p.status === 'pending');
  const sinLeer = conversaciones.filter(c => Number(c.unread_count || 0) > 0);
  const mensajesSinLeer = sinLeer.reduce((s, c) => s + Number(c.unread_count || 0), 0);
  const docsNuevos = notificaciones.filter(n => !n.read_at && (n.type === 'document' || n.type === 'report'));
  const items = pendientes.length + (mensajesSinLeer > 0 ? 1 : 0) + docsNuevos.length;

  return (
    <section aria-labelledby="h-ahora" className="mb-8">
      <SectionTitle title={<span id="h-ahora">Qué hacer ahora</span>} />
      {cargando ? (
        <Skeleton.Card lines={2} />
      ) : items === 0 ? (
        <Callout tone="success" icon={CircleCheck} title="Estás al día">
          No tienes pagos pendientes, mensajes sin leer ni documentos nuevos.
        </Callout>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-line">
            {pendientes.slice(0, 3).map(p => (
              <Pendiente
                key={p.id}
                icon={CreditCard}
                tone="warning"
                title={p.title || 'Solicitud de pago'}
                meta={[p.metadata?.order_number, p.metadata?.boat_name, p.created_at && `solicitado ${fmtRelativo(p.created_at)}`].filter(Boolean).join(' · ')}
                right={<><Money clp={p.amount_clp} usd={p.amount_usd} align="right" /><BotonEnlace to="/payments" variant="primary" size="sm">Pagar</BotonEnlace></>}
              />
            ))}
            {pendientes.length > 3 && (
              <li className="px-(--card-pad) py-2.5 text-13 text-ink-500">
                Y {pendientes.length - 3} {pendientes.length - 3 === 1 ? 'pago pendiente más' : 'pagos pendientes más'} en <Link to="/payments" className="font-medium text-brand-600 hover:text-brand-700">Pagos</Link>.
              </li>
            )}
            {mensajesSinLeer > 0 && (
              <Pendiente
                icon={MessageCircle}
                tone="brand"
                title={mensajesSinLeer === 1 ? 'Tienes 1 mensaje sin leer' : `Tienes ${mensajesSinLeer} mensajes sin leer`}
                meta={`De ${sinLeer.map(c => c.assigned_to_name || 'Equipo Imporlan').filter((v, i, a) => a.indexOf(v) === i).join(', ')}`}
                right={<BotonEnlace to="/messages" size="sm">Leer</BotonEnlace>}
              />
            )}
            {docsNuevos.slice(0, 3).map(n => (
              <Pendiente
                key={n.id}
                icon={File}
                tone="info"
                title={n.title}
                meta={n.message}
                right={<BotonEnlace to="/documents" size="sm">Ver</BotonEnlace>}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Tus expedientes
   --------------------------------------------------------------------------- */
function TarjetaExpediente({ o }) {
  const cerrado = CERRADOS.has(o.status);
  const titulo = o.asset_name || o.requirement_name || o.plan_name || `Expediente ${o.order_number || ''}`.trim();
  const etapa = Number(o.timeline_step) || 1;
  return (
    <Card as={Link} to="/expedientes" className="block min-w-0 hover:border-ink-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" aria-label={`${o.order_number || 'Expediente'}: ${titulo}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow truncate">{[o.order_number, o.plan_name].filter(Boolean).join(' · ')}</p>
        <StatusBadge kind="expediente" status={o.status} size="sm" />
      </div>
      <p className="mt-1 text-base font-semibold text-ink-900 leading-6 line-clamp-2">{titulo}</p>
      <div className="mt-4">
        {cerrado ? (
          <p className="text-13 text-ink-500">Cerrado · {fmtDateLarga(o.updated_at || o.created_at)}</p>
        ) : (
          <ProcessStepper current={etapa} compact />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-13 text-ink-500">
        <span className="truncate">{o.agent_name ? `Agente: ${o.agent_name}` : 'Sin agente asignado aún'}</span>
        {(o.updated_at || o.created_at) && (
          <time dateTime={o.updated_at || o.created_at} title={fmtDateLarga(o.updated_at || o.created_at, { hora: true })} className="shrink-0 tabular">
            {fmtRelativo(o.updated_at || o.created_at)}
          </time>
        )}
      </div>
    </Card>
  );
}

function TusExpedientes({ ordenes, cargando, error, recargar }) {
  const lista = useMemo(() => {
    const t = (o) => new Date(o.updated_at || o.created_at || 0).getTime() || 0;
    const activos = ordenes.filter(o => !CERRADOS.has(o.status)).sort((a, b) => t(b) - t(a));
    const cerrados = ordenes.filter(o => CERRADOS.has(o.status)).sort((a, b) => t(b) - t(a));
    return [...activos, ...cerrados].slice(0, 3);
  }, [ordenes]);

  return (
    <section aria-labelledby="h-expedientes" className="mb-8">
      <SectionTitle
        title={<span id="h-expedientes">Tus expedientes</span>}
        description={ordenes.length > 0 ? `${ordenes.length} en total` : undefined}
        actions={ordenes.length > 0 && <BotonEnlace to="/expedientes" variant="link" size="sm" iconRight={ChevronRight}>Ver todos</BotonEnlace>}
      />
      {cargando ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton.Card lines={3} /><Skeleton.Card lines={3} /><Skeleton.Card lines={3} className="hidden xl:block" />
        </div>
      ) : error ? (
        <Card padding="none"><ErrorState compact message="No pudimos cargar tus expedientes." detail={error} onRetry={recargar} /></Card>
      ) : lista.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={FolderOpen}
            title="Aún no tienes expedientes"
            description="Cuando contrates un plan de búsqueda o cotices links, aparecerán aquí con su etapa y tu agente."
            primaryAction={<BotonEnlace to="/quotation" variant="primary">Cotizar links</BotonEnlace>}
            secondaryAction={<BotonEnlace to="/plans" variant="ghost">Ver planes</BotonEnlace>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(o => <TarjetaExpediente key={o.id} o={o} />)}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Actividad reciente
   --------------------------------------------------------------------------- */
function Actividad({ notificaciones, cargando, onOpen, onMarkRead }) {
  const lista = notificaciones.slice(0, 6);
  return (
    <section aria-labelledby="h-actividad" className="mb-8">
      <Card>
        <Card.Header title={<span id="h-actividad">Actividad reciente</span>} actions={<BotonEnlace to="/alerts" variant="link" size="sm" iconRight={ChevronRight}>Ver todas</BotonEnlace>} />
        {cargando ? (
          <Skeleton.TableRows rows={3} cols={2} />
        ) : lista.length === 0 ? (
          <EmptyState compact title="Sin novedades por ahora" description="Cuando haya cambios en tus expedientes, pagos o reportes, los verás aquí." />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map(n => <FilaNotificacion key={n.id} n={n} compact onOpen={onOpen} onMarkRead={onMarkRead} />)}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Inicio
   --------------------------------------------------------------------------- */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const nombre = (user?.name || user?.email || '').trim().split(/\s+/)[0] || null;

  const ordenes = useCarga(cargaOrdenes, VACIO);
  const pagos = useCarga(cargaPagos, VACIO);
  const conversaciones = useCarga(cargaConversaciones, VACIO);
  const notificaciones = useCarga(cargaNotificaciones, VACIO);
  const [leidas, setLeidas] = useState(() => new Set());

  const notifs = useMemo(
    () => notificaciones.data.map(n => (leidas.has(n.id) && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    [notificaciones.data, leidas],
  );

  async function marcarLeida(n) {
    if (n.read_at) return;
    setLeidas(prev => new Set(prev).add(n.id));
    try { await markNotificationRead(n.id); } catch { /* silencioso: se vuelve a intentar desde Alertas */ }
  }

  function abrirNotificacion(n) {
    marcarLeida(n);
    irAlEnlace(n.link, navigate);
  }

  return (
    <div className="pb-4">
      <PageHeader
        title={nombre ? `${saludoDelDia()}, ${nombre}` : saludoDelDia()}
        description="Esto es lo que tienes pendiente y cómo van tus expedientes."
      />

      <QueHacerAhora
        pagos={pagos.data}
        conversaciones={conversaciones.data}
        notificaciones={notifs}
        cargando={pagos.loading || conversaciones.loading || notificaciones.loading}
      />

      <TusExpedientes ordenes={ordenes.data} cargando={ordenes.loading} error={ordenes.error} recargar={ordenes.recargar} />

      <Actividad notificaciones={notifs} cargando={notificaciones.loading} onOpen={abrirNotificacion} onMarkRead={marcarLeida} />

      <p className="text-13 text-ink-500 mb-8">
        Respondemos cotizaciones y consultas en 48 a 72 horas hábiles. Para urgencias,{' '}
        <a href={WA_AYUDA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
          <WhatsAppIcon size={14} /> escríbenos por WhatsApp
        </a>.
      </p>

      {/* Deckeva: otra empresa del mismo dueño (pisos de goma EVA). Tarjeta de partner al final; el componente lo rediseña WS-C4. */}
      <DeckevaPromo context="panel_dashboard" />
    </div>
  );
}
