import { fmtDate } from '../../../shared/lib/utils';
import { fmtDateLarga } from '../../../shared/lib/format';
import { Card, DataTable } from '../../../shared/components/UI';
import { FileText, Eye, Download } from '../../../shared/components/Icons';
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

/** Reportes del expediente (los informes que preparó el equipo), como lista. */
export default function SeccionReportes({ reports }) {
  if (!reports?.length) return null;
  return (
    <Card id="reportes-cliente" className="exp-section">
      <Card.Header title={`Reportes (${reports.length})`} description="Los informes que preparó el equipo para este expediente." />
      <DataTable
        aria-label="Reportes del expediente"
        columns={[
          { key: 'nombre', header: 'Reporte', cell: r => <span className="inline-flex items-center gap-2 font-medium text-ink-900"><FileText size={16} className="shrink-0 text-ink-500" />{nombre(r)}</span>, sortValue: nombre },
          { key: 'created_at', header: 'Fecha', priority: 2, cell: r => <span className="tabular" title={r.created_at ? fmtDateLarga(r.created_at, { hora: true }) : undefined}>{r.created_at ? fmtDate(r.created_at) : '—'}</span> },
          { header: <span className="sr-only">Acciones</span>, align: 'right', cell: r => <Acciones r={r} /> },
        ]}
        data={reports}
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
    </Card>
  );
}
