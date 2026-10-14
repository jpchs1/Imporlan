import { useState, useEffect, useCallback } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '../api';
import { fmtUSD } from '../../shared/lib/format';
import { PageHeader, Card, DataTable, Badge, Button, Modal, Input, Textarea, Checkbox, MoneyInput, NumberInput, FormGrid, Money, Callout, Spinner, ErrorState, EmptyState, useConfirm } from '../../shared/components/UI';
import { Plus, Pencil, Trash, Layers } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

// La tabla search_plans guarda price_clp / is_active y las características
// como texto separado por comas; el formulario trabaja con una por línea.
const EMPTY = { name: '', description: '', price_clp: null, price_usd: null, duration_days: '', max_links: '', features: '', active: true };

function featuresToLines(f) {
  if (Array.isArray(f)) return f.join('\n');
  return String(f || '').split(',').map(s => s.trim()).filter(Boolean).join('\n');
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const isActive = (p) => Number(p.is_active ?? 1) === 1;

export default function Plans() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPlans();
        if (!alive) return;
        setPlans(res.items || res.plans || []);
        setError('');
      } catch (e) {
        if (alive) setError(e.message || 'No se pudieron cargar los planes');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tick]);

  const load = useCallback(() => { setLoading(true); setTick(t => t + 1); }, []);

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(p) {
    setEditItem(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price_clp: num(p.price_clp),
      price_usd: num(p.price_usd),
      duration_days: p.duration_days ?? '',
      max_links: p.max_links ?? '',
      features: featuresToLines(p.features),
      active: isActive(p),
    });
    setFormErrors({});
    setShowModal(true);
  }

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave(e) {
    e?.preventDefault?.();
    const errs = {};
    if (!form.name.trim()) errs.name = 'El plan necesita un nombre.';
    if (!(Number(form.price_clp) > 0)) errs.price_clp = 'El precio en CLP debe ser mayor a 0.';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    const data = {
      name: form.name.trim(),
      description: form.description,
      price_clp: Number(form.price_clp),
      price_usd: Number(form.price_usd) || 0,
      duration_days: Number(form.duration_days) || 0,
      max_links: Number(form.max_links) || 0,
      features: form.features.split('\n').map(s => s.trim().replace(/,/g, ';')).filter(Boolean).join(','),
      is_active: form.active ? 1 : 0,
    };
    setSaving(true);
    try {
      if (editItem) await updatePlan({ id: editItem.id, ...data });
      else await createPlan(data);
      toast?.(editItem ? 'Plan actualizado' : 'Plan creado', 'success');
      setShowModal(false);
      load();
    } catch (err) { toast?.(err.message || 'No se pudo guardar el plan', 'error'); }
    setSaving(false);
  }

  async function handleDelete(p) {
    const ok = await confirm({
      title: `¿Eliminar el plan «${p.name}»?`,
      description: 'Desaparece de este catálogo. Los expedientes que ya lo tienen no cambian.',
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try { await deletePlan(p.id); toast?.('Plan eliminado', 'success'); load(); } catch (e) { toast?.(e.message || 'No se pudo eliminar', 'error'); }
  }

  const columns = [
    { key: 'name', header: 'Plan', cell: r => <span className="font-medium text-ink-900">{r.name}</span> },
    { key: 'description', header: 'Descripción', priority: 2, cell: r => <span className="block max-w-[320px] truncate" title={r.description}>{r.description || '—'}</span> },
    { key: 'price_clp', header: 'Precio', align: 'right', sortValue: r => Number(r.price_clp), cell: r => <Money clp={r.price_clp} usd={Number(r.price_usd) > 0 ? r.price_usd : undefined} size="sm" align="right" /> },
    { key: 'duration_days', header: 'Vigencia', align: 'right', priority: 2, sortValue: r => Number(r.duration_days), cell: r => (Number(r.duration_days) > 0 ? `${r.duration_days} días` : '—') },
    { key: 'max_links', header: 'Propuestas', align: 'right', priority: 3, sortValue: r => Number(r.max_links), cell: r => (Number(r.max_links) > 0 ? r.max_links : '—') },
    { key: 'is_active', header: 'Estado', sortValue: r => (isActive(r) ? 1 : 0), cell: r => (isActive(r) ? <Badge tone="success" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>), width: 120 },
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Planes"
        description={`${plans.length} ${plans.length === 1 ? 'plan configurado' : 'planes configurados'}`}
        actions={<Button icon={Plus} onClick={openCreate}>Nuevo plan</Button>}
      />

      <Callout tone="info" title="Catálogo de referencia interno" className="mb-4">
        Los precios que se cobran en el checkout están definidos en el sitio web: cambiar un valor aquí no cambia el cobro.
      </Callout>

      <Card padding="none">
        {error ? <ErrorState message={error} onRetry={load} /> : (
          <DataTable
            columns={columns}
            data={plans}
            rowKey={r => r.id}
            onRowClick={openEdit}
            aria-label="Planes"
            rowActions={r => [
              { label: 'Editar', icon: Pencil, onClick: () => openEdit(r) },
              { separator: true },
              { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDelete(r) },
            ]}
            emptyState={<EmptyState compact icon={Layers} title="Sin planes configurados" description="Crea el primero con «Nuevo plan»." />}
            mobileCard={r => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{r.name}</p>
                  {r.description && <p className="text-13 text-ink-500 truncate">{r.description}</p>}
                  <p className="text-13 text-ink-700 mt-1 tabular">
                    <Money clp={r.price_clp} inline />
                    {Number(r.price_usd) > 0 && <span className="text-ink-500"> · ≈ {fmtUSD(r.price_usd)}</span>}
                  </p>
                </div>
                {isActive(r) ? <Badge tone="success" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>}
              </div>
            )}
          />
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Editar plan' : 'Nuevo plan'}
        description={editItem ? editItem.name : 'Catálogo interno de referencia.'}
        size="md"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" form="form-plan" loading={saving}>{editItem ? 'Guardar' : 'Crear plan'}</Button>
          </>
        )}
      >
        <form id="form-plan" onSubmit={handleSave} className="space-y-4" noValidate>
          <Input label="Nombre" value={form.name} onChange={e => set('name')(e.target.value)} error={formErrors.name} required data-autofocus />
          <Textarea label="Descripción" value={form.description} onChange={e => set('description')(e.target.value)} rows={2} />
          <FormGrid cols={2}>
            <MoneyInput label="Precio" currency="CLP" value={form.price_clp} onChange={set('price_clp')} error={formErrors.price_clp} required />
            <MoneyInput label="Precio de referencia" currency="USD" value={form.price_usd} onChange={set('price_usd')} />
            <NumberInput label="Vigencia" unit="días" min="0" value={form.duration_days} onChange={e => set('duration_days')(e.target.value)} />
            <NumberInput label="Propuestas" unit="links" min="0" value={form.max_links} onChange={e => set('max_links')(e.target.value)} hint="Embarcaciones que incluye el plan" />
          </FormGrid>
          <Textarea label="Características" hint="Una por línea" value={form.features} onChange={e => set('features')(e.target.value)} rows={4} />
          <Checkbox label="Plan activo" hint="Desmarca los planes que ya no se ofrecen." checked={form.active} onChange={e => set('active')(e.target.checked)} />
        </form>
      </Modal>
    </>
  );
}
