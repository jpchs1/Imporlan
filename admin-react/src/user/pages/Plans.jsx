import { useState, useEffect, useMemo } from 'react';
import { getMyPurchases } from '../api';
import { fmtDate, fmtCLP, cn, paymentMethodLabel } from '../../shared/lib/utils';
import { fmtUSD, fmtDateLarga } from '../../shared/lib/format';
import { Card, Button, Badge, StatusBadge, PageHeader, SectionTitle, DataTable, EmptyState, Skeleton, DescriptionList, Money } from '../../shared/components/UI';
import { Check, ExternalLink, WhatsAppIcon, Link2, Search, ArrowRight } from '../../shared/components/Icons';

/* Catálogo: los precios y los ids son los del checkout de imporlan.cl. */
const PLANS = [
  {
    id: 'fragata', name: 'Fragata', badge: 'Básico',
    desc: 'Para una primera búsqueda acotada.',
    proposals: 5, days: 7, price: 67600, usd: 67.60,
    features: ['5 propuestas de embarcaciones', 'Monitoreo por 7 días', 'Búsqueda en Estados Unidos y Chile', 'Soporte por correo', 'Panel de seguimiento'],
  },
  {
    id: 'capitan', name: 'Capitán de Navío', badge: 'Recomendado', popular: true,
    desc: 'El plan que más eligen nuestros clientes.',
    proposals: 9, days: 14, price: 119600, usd: 119.60,
    features: ['9 propuestas de embarcaciones', 'Monitoreo por 14 días', 'Búsqueda en Estados Unidos y Chile', 'Soporte prioritario', 'Panel de seguimiento', 'Agente dedicado'],
  },
  {
    id: 'almirante', name: 'Almirante', badge: 'Completo',
    desc: 'Servicio completo con reporte de inteligencia artificial.',
    proposals: 15, days: 21, price: 189600, usd: 189.60,
    features: ['15 propuestas de embarcaciones', 'Monitoreo por 21 días', 'Búsqueda en Estados Unidos y Chile', 'Soporte prioritario', 'Panel de seguimiento', 'Agente dedicado', 'Reporte IA incluido'],
  },
];

const CHECKOUT_URL = 'https://www.imporlan.cl/#planes';
const WHATSAPP_URL = 'https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20los%20planes%20de%20b%C3%BAsqueda';

/* Estado de una cotización por link (viene del servidor sin tilde). */
const LINK_ESTADO = {
  pending: { label: 'Pendiente', tone: 'warning' },
  en_revision: { label: 'En revisión', tone: 'warning' },
  active: { label: 'Activa', tone: 'success' },
  completed: { label: 'Completada', tone: 'success' },
  expired: { label: 'Vencida', tone: 'neutral' },
  canceled: { label: 'Cancelada', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
};

function planIdFromName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fragata')) return 'fragata';
  if (n.includes('capitan') || n.includes('capitán')) return 'capitan';
  if (n.includes('almirante')) return 'almirante';
  return null;
}

/* ---------------------------------------------------------------------------
   Tarjeta del catálogo
   --------------------------------------------------------------------------- */
function PlanCard({ plan, current, onContract }) {
  const isCurrent = current === plan.id;
  return (
    <Card as="article" aria-labelledby={`plan-${plan.id}`} className={cn('flex flex-col', plan.popular && 'border-brand-500 ring-1 ring-brand-500')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`plan-${plan.id}`} className="text-xl font-semibold text-ink-900">Plan {plan.name}</h3>
          <p className="text-sm text-ink-500 mt-0.5">{plan.desc}</p>
        </div>
        {isCurrent ? <Badge tone="success" dot>Tu plan actual</Badge> : <Badge tone={plan.popular ? 'brand' : 'neutral'}>{plan.badge}</Badge>}
      </div>

      <div className="mt-5">
        <Money clp={plan.price} size="xl" />
        <p className="text-13 text-ink-500 mt-1">{fmtUSD(plan.usd)} aprox. · pago único</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-canvas border border-line px-3 py-2">
          <dt className="eyebrow">Propuestas</dt>
          <dd className="text-xl font-semibold text-ink-900 tabular">{plan.proposals}</dd>
        </div>
        <div className="rounded-md bg-canvas border border-line px-3 py-2">
          <dt className="eyebrow">Días</dt>
          <dd className="text-xl font-semibold text-ink-900 tabular">{plan.days}</dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
            <Check size={16} className="text-success shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <Button block variant="secondary" disabled icon={Check}>Plan activo</Button>
        ) : (
          <Button block variant={plan.popular ? 'primary' : 'secondary'} iconRight={ExternalLink} onClick={() => onContract(plan)}>
            Contratar
          </Button>
        )}
        {!isCurrent && <p className="text-xs text-ink-500 text-center mt-2">Se abre el sitio de Imporlan para pagar.</p>}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Plan contratado
   --------------------------------------------------------------------------- */
function ContractedPlanCard({ p, now }) {
  const id = planIdFromName(p.planName || p.plan_name);
  const meta = PLANS.find(x => x.id === id) || PLANS[0];
  const isActive = p.status === 'active';
  const proposalsReceived = Number(p.proposalsReceived || 0);
  const proposalsTotal = Number(p.proposalsTotal || meta.proposals || 0);
  const pct = proposalsTotal > 0 ? Math.min(100, (proposalsReceived / proposalsTotal) * 100) : 0;

  let daysLeft = null;
  if (p.endDate) {
    const ms = new Date(p.endDate).getTime() - now;
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  const items = [
    p.startDate && { label: 'Inicio', value: fmtDate(p.startDate) },
    p.endDate && { label: 'Vence', value: fmtDate(p.endDate) },
    p.days && { label: 'Duración', value: `${p.days} días` },
    p.price && { label: 'Pagado', value: fmtCLP(p.price) },
    p.payment_method && { label: 'Medio de pago', value: paymentMethodLabel(p.payment_method) },
  ].filter(Boolean);

  return (
    <Card as="article" className={cn(!isActive && 'bg-canvas')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-900 truncate">{p.planName || p.plan_name || 'Plan'}</h3>
          {isActive && daysLeft !== null && (
            <p className="text-13 text-ink-500 mt-0.5">{daysLeft > 0 ? `Quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : 'Vence hoy'}</p>
          )}
        </div>
        <StatusBadge kind="plan" status={p.status} dot />
      </div>

      {proposalsTotal > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-13 mb-1.5">
            <span className="text-ink-500">Propuestas recibidas</span>
            <span className="text-ink-900 font-medium tabular">{proposalsReceived} de {proposalsTotal}</span>
          </div>
          <div className="h-2 bg-neutral-bg rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={proposalsTotal} aria-valuenow={proposalsReceived} aria-label="Propuestas recibidas">
            <div className={cn('h-full rounded-full', isActive ? 'bg-brand-600' : 'bg-ink-400')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {items.length > 0 && <DescriptionList cols={2} dense items={items} className="mt-4 pt-4 border-t border-line" />}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Página
   --------------------------------------------------------------------------- */
export default function Plans() {
  const [userPlans, setUserPlans] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyPurchases();
        setUserPlans(data.plans || []);
        setLinks(data.links || []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  const activePlan = useMemo(() => userPlans.find(p => p.status === 'active'), [userPlans]);
  const currentId = activePlan ? planIdFromName(activePlan.planName || activePlan.plan_name) : null;
  const tieneAlgo = userPlans.length > 0 || links.length > 0;

  function handleContract(/* plan */) {
    window.open(CHECKOUT_URL, '_blank');
  }

  const columnasLinks = [
    { key: 'url', header: 'Link', cell: l => (
      <div className="min-w-0 flex items-center gap-2">
        <Link2 size={16} className="text-ink-500 shrink-0" />
        {l.url
          ? <a href={l.url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline truncate max-w-[52ch]" onClick={e => e.stopPropagation()}>{l.url}</a>
          : <span className="font-medium text-ink-900 truncate">{l.name || 'Link'}</span>}
      </div>
    ) },
    { key: 'contractedAt', header: 'Contratado', width: 130, priority: 2, cell: l => <span className="tabular">{fmtDate(l.contractedAt || l.created_at)}</span>, sortValue: l => new Date(l.contractedAt || l.created_at).getTime() },
    { key: 'status', header: 'Estado', width: 130, cell: l => {
      const s = String(l.status || 'pending').toLowerCase();
      const m = LINK_ESTADO[s] || { label: 'En revisión', tone: 'warning' };
      return <Badge tone={m.tone} dot>{m.label}</Badge>;
    } },
  ];

  return (
    <div className="pb-12">
      <PageHeader
        title="Planes"
        description="Elige cuántas propuestas quieres y en cuántos días. Nuestro equipo busca en Estados Unidos y Chile, te entrega un ranking y te acompaña hasta la entrega."
        meta={activePlan ? <Badge tone="success" dot>Plan activo: {activePlan.planName || activePlan.plan_name}</Badge> : null}
        actions={(
          <Button variant="secondary" icon={WhatsAppIcon} onClick={() => window.open(WHATSAPP_URL, '_blank', 'noopener')}>Hablar con un asesor</Button>
        )}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton.Card lines={3} /><Skeleton.Card lines={3} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Skeleton.Card lines={6} /><Skeleton.Card lines={6} /><Skeleton.Card lines={6} /></div>
        </div>
      ) : (
        <>
          {tieneAlgo && (
            <section aria-labelledby="tu-plan" className="mb-10">
              <SectionTitle
                title={<span id="tu-plan">Tu plan</span>}
                description="Lo que ya contrataste con Imporlan."
                actions={<a href="#/expedientes" className="inline-flex items-center gap-1 text-13 font-medium text-brand-600 hover:underline">Ver expedientes <ArrowRight size={14} /></a>}
              />
              {userPlans.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userPlans.map((p, i) => <ContractedPlanCard key={i} p={p} now={now} />)}
                </div>
              )}
              {links.length > 0 && (
                <div className={cn(userPlans.length > 0 && 'mt-6')}>
                  <h3 className="text-sm font-semibold text-ink-900 mb-2">Cotizaciones por links <span className="text-ink-500 font-normal">· {links.length}</span></h3>
                  <Card padding="none">
                    <DataTable
                      columns={columnasLinks}
                      data={links}
                      aria-label="Cotizaciones por links"
                      pageSize={10}
                      mobileCard={l => {
                        const s = String(l.status || 'pending').toLowerCase();
                        const m = LINK_ESTADO[s] || { label: 'En revisión', tone: 'warning' };
                        return (
                          <div className="min-w-0">
                            {l.url
                              ? <a href={l.url} target="_blank" rel="noreferrer" className="block font-medium text-brand-600 hover:underline truncate">{l.url}</a>
                              : <p className="font-medium text-ink-900 truncate">{l.name || 'Link'}</p>}
                            <div className="flex items-center gap-2 mt-1 text-13 text-ink-500">
                              <span className="tabular">{fmtDateLarga(l.contractedAt || l.created_at)}</span>
                              <Badge tone={m.tone} size="sm">{m.label}</Badge>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </Card>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="catalogo">
            <SectionTitle
              title={<span id="catalogo">{tieneAlgo ? 'Contratar otro plan' : 'Elige tu plan'}</span>}
              description="Pago único. Empezamos a buscar el mismo día que confirmas el pago."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} current={currentId} onContract={handleContract} />)}
            </div>
            <p className="text-13 text-ink-500 mt-4">
              ¿Tienes dudas sobre los planes? Las respuestas más frecuentes están en{' '}
              <a href="#/support" className="font-medium text-brand-600 hover:underline">Ayuda</a>, o escríbenos por{' '}
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">WhatsApp</a>.
            </p>
          </section>

          {!tieneAlgo && (
            <Card className="mt-8">
              <EmptyState
                compact
                icon={Search}
                title="¿Solo quieres cotizar una lancha que ya viste?"
                description="Pega los links de los anuncios y te entregamos el precio final puerta a puerta por $9.900 cada uno."
                primaryAction={<Button variant="secondary" onClick={() => { window.location.hash = '#/quotation'; }}>Cotizar links</Button>}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
