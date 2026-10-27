import { fmtDate } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Card, DataTable, Button, Badge } from '../../../shared/components/UI';
import { FileText, Eye, Download, ClipboardCheck, Languages, ExternalLink } from '../../../shared/components/Icons';
import { urlOriginal } from '../../../shared/lib/reporte-inspeccion';
import BotonEnlace from './BotonEnlace';

/** Las URLs con token vienen del servidor (view_url / pdf_url); no se arman distinto. */
function urls(r) {
  const viewUrl = r.view_url || (r.id && r.access_token ? `/api/reports_api.php?action=view_report&report_id=${r.id}&token=${encodeURIComponent(r.access_token)}` : null);
  const pdfUrl = r.pdf_url || (r.id && r.access_token ? `/api/reports_api.php?action=download_pdf&report_id=${r.id}&token=${encodeURIComponent(r.access_token)}` : null);
  return { viewUrl, pdfUrl };
}

function nombre(r) {
  const plan = r.plan_type || r.plan_name || 'Reporte';
  return r.version ? `${plan} · versión ${r.version}` : plan;
}

function Acciones({ r }) {
  const { viewUrl, pdfUrl } = urls(r);
  return (
    <div className="flex items-center justify-end gap-2">
      {viewUrl && <BotonEnlace href={viewUrl} size="sm" icon={Eye}>Ver</BotonEnlace>}
      {pdfUrl && <BotonEnlace href={pdfUrl} size="sm" icon={Download}>PDF</BotonEnlace>}
    </div>
  );
}

/**
 * Reportes del expediente (los informes que preparó el equipo), como lista.
 *
 * `inspeccion` (opcional) es el reporte de la inspección técnica de la lancha
 * elegida: { titulo, at, es_status, original, onLeer }. Va primero, con
 * «Leer en español» y el original en inglés, para que siga a mano después de
 * aprobar (o declinar).
 */
export default function SeccionReportes({ reports, inspeccion = null }) {
  const lista = reports || [];
  const total = lista.length + (inspeccion ? 1 : 0);
  if (total === 0) return null;
  const original = inspeccion?.original ? urlOriginal(inspeccion.original) : '';
  return (
    <Card id="reportes-cliente" className="exp-section">
      <Card.Header title={`Reportes (${total})`} description="Los informes que preparó el equipo para este expediente." />
      {inspeccion && (
        <Card.Body className="border-b border-line">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600" aria-hidden="true">
                <ClipboardCheck size={18} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink-900">
                  Reporte de la inspección técnica
                  {inspeccion.es_status === 'listo' && <Badge tone="success" size="sm">En español</Badge>}
                </p>
                <p className="text-13 text-ink-500">{[inspeccion.titulo, inspeccion.at ? fmtDateLarga(inspeccion.at) : ''].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button variant="secondary" size="sm" icon={Languages} onClick={inspeccion.onLeer}>Leer en español</Button>
              {original && <BotonEnlace href={original} size="sm" icon={ExternalLink}>Original (inglés)</BotonEnlace>}
            </div>
          </div>
        </Card.Body>
      )}
      {lista.length > 0 && (
        <DataTable
          aria-label="Reportes del expediente"
          columns={[
            { key: 'nombre', header: 'Reporte', cell: r => <span className="inline-flex items-center gap-2 font-medium text-ink-900"><FileText size={16} className="shrink-0 text-ink-500" />{nombre(r)}</span>, sortValue: nombre },
            { key: 'created_at', header: 'Fecha', priority: 2, cell: r => <span className="tabular" title={r.created_at ? fmtDateLarga(r.created_at, { hora: true }) : undefined}>{r.created_at ? fmtDate(r.created_at) : '—'}</span> },
            { header: <span className="sr-only">Acciones</span>, align: 'right', cell: r => <Acciones r={r} /> },
          ]}
          data={lista}
          rowKey={r => r.id}
          pageSize={0}
          mobileCard={r => (
            <div className="space-y-2">
              <p className="font-medium text-ink-900">{nombre(r)}</p>
              <p className="text-13 text-ink-500 tabular">{r.created_at ? fmtDateLarga(r.created_at) : ''}</p>
              <div className="flex justify-start"><Acciones r={r} /></div>
            </div>
          )}
        />
      )}
    </Card>
  );
}
