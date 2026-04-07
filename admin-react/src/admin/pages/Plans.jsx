import { useState, useEffect } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '../api';
import { fmtCLP } from '../../shared/lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Textarea, Spinner } from '../../shared/components/UI';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', features: '', active: true });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getPlans();
      setPlans(res.items || res.plans || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm({ name: '', description: '', price: '', features: '', active: true });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditItem(p);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price || '',
      features: (p.features || []).join('\n'),
      active: p.active !== false,
    });
    setShowModal(true);
  }

  async function handleSave() {
    const data = { ...form, features: form.features.split('\n').filter(Boolean), price: Number(form.price) };
    try {
      if (editItem) await updatePlan({ id: editItem.id, ...data });
      else await createPlan(data);
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este plan?')) return;
    try { await deletePlan(id); load(); } catch (e) { alert(e.message); }
  }

  const columns = [
    { header: 'Nombre', key: 'name' },
    { header: 'Descripcion', cell: r => <span className="max-w-[300px] truncate block">{r.description}</span> },
    { header: 'Precio', cell: r => fmtCLP(r.price) },
    { header: 'Estado', cell: r => <Badge className={r.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>{r.active !== false ? 'Activo' : 'Inactivo'}</Badge> },
    { header: 'Acciones', cell: r => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(r); }}>Editar</Button>
        <Button size="sm" variant="ghost" className="text-red-600" onClick={e => { e.stopPropagation(); handleDelete(r.id); }}>Eliminar</Button>
      </div>
    )},
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Planes" subtitle={`${plans.length} planes configurados`} action={<Button onClick={openCreate}>+ Nuevo plan</Button>} />
      <Card>
        <Table columns={columns} data={plans} />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar plan' : 'Nuevo plan'}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <Textarea label="Descripcion" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <Input label="Precio (CLP)" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
          <Textarea label="Caracteristicas (una por linea)" value={form.features} onChange={e => setForm({...form, features: e.target.value})} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="rounded" />
            Plan activo
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editItem ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
