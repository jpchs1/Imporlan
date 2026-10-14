import { useMemo, useState } from 'react';
import { getLeadsSimulador, descargarLeadsSimulador } from '../api';
import { fmtDateTime, dateValue } from '../../shared/lib/utils';
import { fmtNumero } from '../../shared/lib/format';
import { Card, PageHeader, Button, Badge, DataTable, SearchInput, StatTile, StatGrid, ErrorState, EmptyState } from '../../shared/components/UI';
import { Download, Mail } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useCarga } from './operacion/useCarga';

export default function Leads() {
  const toast = useToast();
  const { datos, cargando, error, recargar } = useCarga(getLeadsSimulador, { mensaje: 'No se pudieron cargar los leads' });
  const leads = useMemo(() => datos?.leads || [], [datos]);
  const resumen = { total: datos?.total || 0, enviados: datos?.enviados || 0, fallidos: datos?.fallidos || 0 };
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);

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
    return leads.filter(l => `${l.nombre || ''} ${l.email || ''} ${l.ip || ''}`.toLowerCase().includes(q));
  }, [leads, busqueda]);

  const columnas = [
    { key: 'fecha', header: 'Fecha', width: 150, sortValue: r => dateValue(r.fecha), cell: r => <span className="text-ink-500 whitespace-nowrap">{fmtDateTime(r.fecha)}</span> },
    { key: 'nombre', header: 'Nombre', sortValue: r => r.nombre || '', cell: r => <span className="font-medium text-ink-900">{r.nombre || '—'}</span> },
    { key: 'email', header: 'Correo', cell: r => <a href={`mailto:${r.email}`} className="text-brand-600 hover:underline break-all" onClick={e => e.stopPropagation()}>{r.email}</a> },
    // Un envío fallido es un lead que existe pero al que nunca le llegó su
    // simulación: hay que contactarlo a mano, por eso se marca aparte.
    { key: 'envio', header: 'Envío', width: 140, sortValue: r => (r.correo_enviado ? 1 : 0), cell: r => r.correo_enviado
      ? <Badge tone="success" dot>Entregado</Badge>
      : <Badge tone="warning" dot>No entregado</Badge> },
    { key: 'ip', header: 'IP', priority: 3, mono: true, cell: r => <span className="text-ink-500">{r.ip || '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Leads del simulador"
        description={cargando ? 'Cargando solicitudes…' : `${fmtNumero(resumen.total)} ${resumen.total === 1 ? 'solicitud' : 'solicitudes'} de simulación de costos desde el sitio`}
        actions={<Button variant="secondary" icon={Download} onClick={exportar} loading={exportando} disabled={!resumen.total}>Exportar CSV</Button>}
      />

      {error ? (
        <Card><ErrorState title="No se pudieron cargar los leads" message="Vuelve a intentarlo en unos segundos." detail={error} onRetry={recargar} /></Card>
      ) : (
        <>
          <StatGrid cols={3} className="mb-6">
            <StatTile label="Solicitudes" value={resumen.total} loading={cargando} />
            <StatTile label="Correo entregado" value={resumen.enviados} loading={cargando} hint="Recibieron su simulación" />
            <StatTile label="Correo no entregado" value={resumen.fallidos} loading={cargando} tone={resumen.fallidos > 0 ? 'warning' : undefined} hint={resumen.fallidos > 0 ? 'Conviene contactarlos a mano' : 'Todos recibieron su correo'} />
          </StatGrid>

          <Card padding="none">
            <div className="px-(--card-pad) pt-4 pb-3 border-b border-line">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, correo o IP" className="max-w-md" />
            </div>
            <DataTable
              columns={columnas}
              data={filtrados}
              rowKey={r => r.id}
              loading={cargando}
              pageSize={25}
              aria-label="Leads del simulador"
              emptyState={(
                <EmptyState compact icon={Mail}
                  title={leads.length === 0 ? 'Todavía no hay solicitudes' : 'Ningún lead coincide con la búsqueda'}
                  description={leads.length === 0 ? 'Aparecerán aquí cuando alguien pida una simulación desde el sitio.' : 'Prueba con otro texto.'} />
              )}
              mobileCard={r => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 truncate">{r.nombre || '—'}</p>
                    <a href={`mailto:${r.email}`} className="text-13 text-brand-600 hover:underline break-all">{r.email}</a>
                    <p className="text-xs text-ink-500 mt-1">{fmtDateTime(r.fecha)}</p>
                  </div>
                  {r.correo_enviado ? <Badge tone="success" size="sm" dot>Entregado</Badge> : <Badge tone="warning" size="sm" dot>No entregado</Badge>}
                </div>
              )}
            />
          </Card>
        </>
      )}
    </>
  );
}
