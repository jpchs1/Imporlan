import { useEffect, useMemo, useState } from 'react';
import { getLeadsSimulador, descargarLeadsSimulador } from '../api';
import { Card, PageHeader, Input, Button, Badge, SkeletonCard } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Leads() {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, enviados: 0, fallidos: 0 });
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const r = await getLeadsSimulador();
      setLeads(r.leads || []);
      setResumen({ total: r.total || 0, enviados: r.enviados || 0, fallidos: r.fallidos || 0 });
    } catch (e) {
      toast?.(e.message || 'No se pudieron cargar los leads', 'error');
    } finally {
      setCargando(false);
    }
  }

  async function exportar() {
    setExportando(true);
    try {
      await descargarLeadsSimulador();
    } catch (e) {
      toast?.(e.message || 'No se pudo exportar', 'error');
    } finally {
      setExportando(false);
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      `${l.nombre || ''} ${l.email || ''} ${l.ip || ''}`.toLowerCase().includes(q)
    );
  }, [leads, busqueda]);

  return (
    <>
      <PageHeader
        title="Leads del simulador"
        subtitle={`${resumen.total} solicitudes de simulación de costos`}
        action={
          <Button onClick={exportar} disabled={exportando || !resumen.total} className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Tile label="Total" valor={resumen.total} tono="slate" />
        <Tile label="Correo entregado" valor={resumen.enviados} tono="emerald" />
        {/* Un envío fallido es un lead que existe pero al que nunca le llegó su
            simulación: hay que contactarlo a mano, así que se muestra aparte. */}
        <Tile label="Correo no entregado" valor={resumen.fallidos} tono="amber" />
      </div>

      <Card>
        <Input
          placeholder="Buscar por nombre, correo o IP..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="mb-4"
        />

        {cargando ? (
          <SkeletonCard />
        ) : filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <svg className="w-11 h-11 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
            <p className="font-medium text-slate-400">
              {leads.length === 0 ? 'Todavía no hay solicitudes' : 'Ningún lead coincide con la búsqueda'}
            </p>
            {leads.length === 0 && (
              <p className="text-sm text-slate-300 mt-1">
                Aparecerán aquí cuando alguien pida una simulación desde el sitio.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Fecha', 'Nombre', 'Correo', 'Envío', 'IP'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition">
                    <td className="py-3 px-3 text-slate-500 text-xs whitespace-nowrap">{fechaCorta(l.fecha)}</td>
                    <td className="py-3 px-3 font-medium text-slate-700">{l.nombre || '—'}</td>
                    <td className="py-3 px-3">
                      <a href={`mailto:${l.email}`} className="text-indigo-600 hover:text-indigo-700 hover:underline">{l.email}</a>
                    </td>
                    <td className="py-3 px-3">
                      {l.correo_enviado
                        ? <Badge className="bg-emerald-50 text-emerald-700">Entregado</Badge>
                        : <Badge className="bg-amber-100 text-amber-800">No entregado</Badge>}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs font-mono">{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Tile({ label, valor, tono }) {
  const tonos = {
    slate: 'text-slate-800',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  };
  return (
    <Card className="!p-5">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={'text-2xl font-bold ' + tonos[tono]}>{valor}</div>
    </Card>
  );
}
