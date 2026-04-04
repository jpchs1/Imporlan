import { useState, useEffect, useRef } from 'react';
import { getVessels, createVessel, updateVessel, deleteVessel, getVesselPositions } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { PageHeader, Card, Table, Badge, Button, Modal, Input, Select, Spinner, StatCard } from '../components/UI';
import { useToast } from '../components/Toast';

function VesselMap({ positions, vessel }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const L = window.L;
    if (!L) return;
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }

    if (!positions?.length) {
      const map = L.map(mapRef.current).setView([0, -40], 3);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      mapInstance.current = map;
      return;
    }

    const coords = positions.map(p => [parseFloat(p.lat), parseFloat(p.lon || p.lng)]);
    const map = L.map(mapRef.current).setView(coords[0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

    if (coords.length > 1) {
      L.polyline(coords, { color: '#6366f1', weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map);
    }

    const latest = coords[0];
    const icon = L.divIcon({
      html: '<div style="background:#6366f1;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>',
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
    });
    const vesselName = vessel?.display_name || 'Posicion actual';
    L.marker(latest, { icon }).addTo(map)
      .bindPopup('<b>' + vesselName + '</b><br>Lat: ' + latest[0].toFixed(4) + '<br>Lon: ' + latest[1].toFixed(4));

    coords.slice(1).forEach((c) => {
      L.circleMarker(c, { radius: 3, color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.6, weight: 1 }).addTo(map);
    });

    map.fitBounds(coords.length > 1 ? L.latLngBounds(coords).pad(0.15) : [[latest[0]-3,latest[1]-3],[latest[0]+3,latest[1]+3]]);
    mapInstance.current = map;
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [positions, vessel]);

  return <div ref={mapRef} className="h-96 rounded-xl border border-slate-200" />;
}

const STATUS_OPTS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'arrived', label: 'Llegado' },
  { value: 'scheduled', label: 'Programado' },
];
const TYPE_OPTS = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto', label: 'Automatico (AIS)' },
];

export default function Tracking() {
  const toast = useToast();
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    display_name: '', imo: '', mmsi: '', type: 'manual', status: 'active',
    shipping_line: '', client_name: '', origin_label: '', destination_label: '', eta_manual: '',
  });
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(!!window.L);

  useEffect(() => {
    load();
    if (!window.L) {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
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
      setVessels(res.vessels || res.items || []);
    } catch (e) { console.error(e); if (toast) toast('Error cargando embarcaciones', 'error'); }
    setLoading(false);
  }

  async function viewVessel(v) {
    setSelectedVessel(v);
    setLoadingPos(true);
    try { const res = await getVesselPositions(v.id); setPositions(res.positions || []); }
    catch { setPositions([]); }
    setLoadingPos(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm({ display_name: '', imo: '', mmsi: '', type: 'manual', status: 'active', shipping_line: '', client_name: '', origin_label: '', destination_label: '', eta_manual: '' });
    setShowModal(true);
  }

  function openEdit(v) {
    setEditItem(v);
    setForm({
      display_name: v.display_name || v.name || '', imo: v.imo || '', mmsi: v.mmsi || '',
      type: v.type || 'manual', status: v.status || 'active', shipping_line: v.shipping_line || '',
      client_name: v.client_name || '', origin_label: v.origin_label || '',
      destination_label: v.destination_label || '', eta_manual: v.eta_manual ? v.eta_manual.slice(0, 16) : '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.display_name) { if (toast) toast('Nombre es requerido', 'error'); return; }
    if (!form.imo && !form.mmsi) { if (toast) toast('Se requiere IMO o MMSI', 'error'); return; }
    try {
      if (editItem) await updateVessel({ id: editItem.id, ...form });
      else await createVessel(form);
      setShowModal(false);
      if (toast) toast(editItem ? 'Embarcacion actualizada' : 'Embarcacion creada');
      load();
    } catch (e) { if (toast) toast(e.message || 'Error al guardar', 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta embarcacion?')) return;
    try {
      await deleteVessel(id);
      if (selectedVessel && selectedVessel.id === id) { setSelectedVessel(null); setPositions([]); }
      if (toast) toast('Embarcacion eliminada');
      load();
    } catch (e) { if (toast) toast(e.message || 'Error al eliminar', 'error'); }
  }

  const active = vessels.filter(v => v.status === 'active').length;
  const arrived = vessels.filter(v => v.status === 'arrived').length;

  const vesselStatusBadge = (status) => {
    const m = { active: 'bg-emerald-50 text-emerald-700', inactive: 'bg-slate-100 text-slate-500', arrived: 'bg-violet-50 text-violet-700', scheduled: 'bg-amber-50 text-amber-700' };
    return m[status] || 'bg-slate-100 text-slate-500';
  };

  const columns = [
    { header: 'Nombre', cell: r => (<div><p className="font-medium text-slate-700">{r.display_name || r.name || '-'}</p>{r.shipping_line && <p className="text-xs text-slate-400">{r.shipping_line}</p>}</div>) },
    { header: 'IMO', cell: r => <span className="font-mono text-xs">{r.imo || '-'}</span> },
    { header: 'MMSI', cell: r => <span className="font-mono text-xs">{r.mmsi || '-'}</span> },
    { header: 'Ruta', cell: r => {
      const from = r.origin_label || '', to = r.destination_label || '';
      if (!from && !to) return <span className="text-slate-300">-</span>;
      return <span className="text-xs">{from}{from && to ? ' \u2192 ' : ''}{to}</span>;
    }},
    { header: 'Cliente', cell: r => <span className="text-sm">{r.client_name || '-'}</span> },
    { header: 'Posicion', cell: r => {
      if (r.lat && r.lon) return <span className="text-xs text-slate-500">{parseFloat(r.lat).toFixed(2)}, {parseFloat(r.lon).toFixed(2)}</span>;
      return <span className="text-xs text-slate-300">Sin posicion</span>;
    }},
    { header: 'Estado', cell: r => <Badge className={vesselStatusBadge(r.status)}>{r.status || 'active'}</Badge> },
    { header: 'Acciones', cell: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition-colors" title="Editar">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Eliminar">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ];

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Seguimiento Maritimo" subtitle={vessels.length + ' embarcaciones registradas'}
        action={<Button onClick={openCreate}>+ Nueva embarcacion</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total" value={vessels.length} color="blue" />
        <StatCard label="En transito" value={active} color="green" />
        <StatCard label="Llegadas" value={arrived} color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <Card>
            <h3 className="font-bold text-slate-800 mb-3">Embarcaciones</h3>
            <Table columns={columns} data={vessels} onRowClick={viewVessel} emptyMsg="No hay embarcaciones registradas" />
          </Card>
        </div>
        <div className="xl:col-span-2">
          <Card>
            <h3 className="font-bold text-slate-800 mb-3">
              {selectedVessel ? 'Mapa - ' + (selectedVessel.display_name || selectedVessel.name) : 'Mapa de seguimiento'}
            </h3>
            {loadingPos ? <Spinner /> : leafletLoaded ? (
              <VesselMap positions={positions} vessel={selectedVessel} />
            ) : (
              <div className="flex items-center justify-center h-96 text-slate-400">
                <div className="text-center">
                  <div className="w-10 h-10 border-[3px] border-slate-100 rounded-full mx-auto mb-2 relative">
                    <div className="w-10 h-10 border-[3px] border-transparent border-t-indigo-500 rounded-full animate-spin absolute inset-0" />
                  </div>
                  <p className="text-sm">Cargando mapa...</p>
                </div>
              </div>
            )}
            {selectedVessel && positions.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Velocidad</p>
                  <p className="font-bold text-slate-700">{positions[0]?.speed || '-'} kn</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Rumbo</p>
                  <p className="font-bold text-slate-700">{positions[0]?.course || '-'}&deg;</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Destino</p>
                  <p className="font-bold text-slate-700">{positions[0]?.destination || selectedVessel.destination_label || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Ultima actualizacion</p>
                  <p className="font-bold text-slate-700">{fmtDate(positions[0]?.fetched_at) || '-'}</p>
                </div>
              </div>
            )}
            {selectedVessel && !positions.length && !loadingPos && (
              <p className="mt-3 text-center text-sm text-slate-400 py-4">Sin datos de posicion para esta embarcacion</p>
            )}
          </Card>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar embarcacion' : 'Nueva embarcacion'} size="lg">
        <div className="space-y-4">
          <Input label="Nombre de la embarcacion" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} required placeholder="Ej: MSC Pamela" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="IMO" value={form.imo} onChange={e => setForm({...form, imo: e.target.value})} placeholder="7 digitos" />
            <Input label="MMSI" value={form.mmsi} onChange={e => setForm({...form, mmsi: e.target.value})} placeholder="9 digitos" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={form.type} onChange={e => setForm({...form, type: e.target.value})} options={TYPE_OPTS} />
            <Select label="Estado" value={form.status} onChange={e => setForm({...form, status: e.target.value})} options={STATUS_OPTS} />
          </div>
          <Input label="Linea naviera" value={form.shipping_line} onChange={e => setForm({...form, shipping_line: e.target.value})} placeholder="Ej: MSC, Maersk, etc." />
          <Input label="Cliente asociado" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="Nombre del cliente" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Origen" value={form.origin_label} onChange={e => setForm({...form, origin_label: e.target.value})} placeholder="Ej: Miami, FL" />
            <Input label="Destino" value={form.destination_label} onChange={e => setForm({...form, destination_label: e.target.value})} placeholder="Ej: Valparaiso, CL" />
          </div>
          <Input label="ETA estimada" type="datetime-local" value={form.eta_manual} onChange={e => setForm({...form, eta_manual: e.target.value})} />
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editItem ? 'Guardar cambios' : 'Crear embarcacion'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
