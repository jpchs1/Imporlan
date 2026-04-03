import { useState, useEffect, useRef } from 'react';
import { getVessels, createVessel, updateVessel, deleteVessel, getVesselPositions } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Select, Spinner } from '../components/UI';

function VesselMap({ positions }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !positions?.length) return;

    const L = window.L;
    if (!L) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
    }

    const map = L.map(mapRef.current).setView([positions[0].lat, positions[0].lng], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const coords = positions.map(p => [p.lat, p.lng]);

    // Route line
    if (coords.length > 1) {
      L.polyline(coords, { color: '#3b82f6', weight: 3, opacity: 0.7 }).addTo(map);
    }

    // Current position marker
    const latest = positions[0];
    L.marker([latest.lat, latest.lng])
      .addTo(map)
      .bindPopup(`<b>Posicion actual</b><br>Lat: ${latest.lat}<br>Lng: ${latest.lng}<br>${fmtDate(latest.timestamp)}`);

    map.fitBounds(coords.length > 1 ? L.latLngBounds(coords).pad(0.1) : [[latest.lat - 2, latest.lng - 2], [latest.lat + 2, latest.lng + 2]]);
    mapInstance.current = map;

    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [positions]);

  if (!positions?.length) return <p className="text-sm text-slate-400 text-center py-8">Sin posiciones registradas</p>;

  return <div ref={mapRef} className="h-80 rounded-lg border border-slate-200" />;
}

export default function Tracking() {
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', imo: '', mmsi: '', type: '', flag: '', status: 'active' });
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(!!window.L);

  useEffect(() => {
    load();
    // Load Leaflet CSS & JS
    if (!window.L) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    }
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getVessels();
      setVessels(res.items || res.vessels || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function viewVessel(v) {
    setSelectedVessel(v);
    setLoadingPos(true);
    try {
      const res = await getVesselPositions(v.id);
      setPositions(res.positions || []);
    } catch { setPositions([]); }
    setLoadingPos(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm({ name: '', imo: '', mmsi: '', type: '', flag: '', status: 'active' });
    setShowModal(true);
  }

  function openEdit(v) {
    setEditItem(v);
    setForm({ name: v.name || '', imo: v.imo || '', mmsi: v.mmsi || '', type: v.type || '', flag: v.flag || '', status: v.status || 'active' });
    setShowModal(true);
  }

  async function handleSave() {
    try {
      if (editItem) await updateVessel({ id: editItem.id, ...form });
      else await createVessel(form);
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta embarcacion?')) return;
    try { await deleteVessel(id); setSelectedVessel(null); load(); } catch (e) { alert(e.message); }
  }

  const columns = [
    { header: 'Nombre', key: 'name' },
    { header: 'IMO', cell: r => <span className="font-mono text-xs">{r.imo || '-'}</span> },
    { header: 'MMSI', cell: r => <span className="font-mono text-xs">{r.mmsi || '-'}</span> },
    { header: 'Tipo', key: 'type' },
    { header: 'Bandera', key: 'flag' },
    { header: 'Estado', cell: r => <Badge className={statusColor(r.status)}>{r.status || 'active'}</Badge> },
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
      <PageHeader title="Seguimiento Maritimo" subtitle={`${vessels.length} embarcaciones`} action={<Button onClick={openCreate}>+ Nueva embarcacion</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-slate-700 mb-3">Embarcaciones</h3>
          <Table columns={columns} data={vessels} onRowClick={viewVessel} />
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-700 mb-3">
            {selectedVessel ? `Mapa - ${selectedVessel.name}` : 'Mapa'}
          </h3>
          {loadingPos ? <Spinner /> : leafletLoaded ? <VesselMap positions={positions} /> : <p className="text-center py-8 text-slate-400">Cargando mapa...</p>}
        </Card>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar embarcacion' : 'Nueva embarcacion'}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="IMO" value={form.imo} onChange={e => setForm({...form, imo: e.target.value})} />
            <Input label="MMSI" value={form.mmsi} onChange={e => setForm({...form, mmsi: e.target.value})} />
          </div>
          <Input label="Tipo" value={form.type} onChange={e => setForm({...form, type: e.target.value})} placeholder="Cargo, Tanker, etc." />
          <Input label="Bandera" value={form.flag} onChange={e => setForm({...form, flag: e.target.value})} placeholder="CL, PA, etc." />
          <Select label="Estado" value={form.status} onChange={e => setForm({...form, status: e.target.value})} options={[
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
          ]} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editItem ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function statusColor(status) {
  const map = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-600' };
  return map[status] || 'bg-gray-100 text-gray-600';
}
