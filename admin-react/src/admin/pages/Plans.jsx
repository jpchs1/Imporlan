import { useState, useEffect, useCallback } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '../api';
import { fmtCLP } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Textarea, Spinner, ErrorState } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

// La tabla search_plans guarda price_clp / is_active y las características
// como texto separado por comas; el formulario trabaja con una por línea.
const EMPTY = { name: '', description: '', price_clp: '', price_usd: '', duration_days: '', max_links: '', features: '', active: true };

function featuresToLines(f) {
  if (Array.isArray(f)) return f.join('\n');
  return String(f || '').split(',').map(s => s.trim()).filter(Boolean).join('\n');
}

const isActive = (p) => Number(p.is_active ?? 1) === 1;

export default function Plans() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPlans();
      setPlans(res.items || res.plans || []);
    } catch (e) { setError(e.message || 'No se pudieron cargar los planes'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY);
    setShowModal(true);
  }

  function openEdit(p) {
    setEditItem(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price_clp: p.price_clp ?? '',
      price_usd: p.price_usd ?? '',
      duration_days: p.duration_days ?? '',
      max_links: p.max_links ?? '',
      features: featuresToLines(p.features),
      active: isActive(p),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast?.('El plan necesita un nombre', 'error'); return; }
    if (!(Number(form.price_clp) > 0)) { toast?.('El precio en CLP debe ser mayor a 0', 'error'); return; }
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
      toast?.(editItem ? 'Plan actualizado' : 'Plan creado');
      setShowModal(false);
      load();
    } catch (e) { toast?.(e.message || 'Error al guardar', 'error'); }
    setSaving(false);
  }

  async function handleDelete(p) {
    if (!confirm(`Eliminar el plan "${p.name}"?`)) return;
    try { await deletePlan(p.id); toast?.('Plan eliminado'); load(); } catch (e) { toast?.(e.message, 'error'); }
  }

  const columns = [
    { header: 'Nombre', key: 'name' },
    { header: 'Descripción', cell: r => <span className="max-w-[300px] truncate block">{r.description}</span> },
    { header: 'Precio', sortValue: r => Number(r.price_clp), cell: r => fmtCLP(r.price_clp) },
    { header: 'Días', sortValue: r => Number(r.duration_days), cell: r => r.duration_days || '-' },
    { header: 'Propuestas', sortValue: r => Number(r.max_links), cell: r => r.max_links || '-' },
    { header: 'Estado', sortValue: r => (isActive(r) ? 1 : 0), cell: r => <Badge className={isActive(r) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>{isActive(r) ? 'Activo' : 'Inactivo'}</Badge> },
    { header: 'Acciones', cell: r => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(r); }}>Editar</Button>
        <Button size="sm" variant="ghost" className="text-red-600" onClick={e => { e.stopPropagation(); handleDelete(r); }}>Eliminar</Button>
      </div>
    )},
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Planes" subtitle={`${plans.length} planes configurados`} action={<Button onClick={openCreate}>+ Nuevo plan</Button>} />
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Catálogo de referencia interno. Los precios que se cobran en el checkout del sitio están definidos en el sitio web; cambiar un precio aquí no cambia el cobro.
      </div>
      <Card>
        {error ? <ErrorState message={error} onRetry={load} /> : <Table columns={columns} data={plans} onRowClick={openEdit} emptyMsg="Sin planes configurados" />}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar plan' : 'Nuevo plan'}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Textarea label="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Precio (CLP)" type="number" min="0" value={form.price_clp} onChange={e => setForm({ ...form, price_clp: e.target.value })} required />
            <Input label="Precio (USD)" type="number" min="0" value={form.price_usd} onChange={e => setForm({ ...form, price_usd: e.target.value })} />
            <Input label="Duración (días)" type="number" min="0" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} />
            <Input label="Propuestas" type="number" min="0" value={form.max_links} onChange={e => setForm({ ...form, max_links: e.target.value })} />
          </div>
          <Textarea label="Características (una por línea)" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="rounded" />
            Plan activo
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
