import { Card, Badge, EmptyState, Skeleton, ErrorState, Button } from '../../shared/components/UI';
import { FileText, RefreshCw } from '../../shared/components/Icons';
import { FileDownload, FileOpen } from '../../shared/components/FileDownload';
import { fmtDate } from '../../shared/lib/utils';
import { fmtBytes } from '../../shared/lib/format';
import { ORIGEN_ARCHIVO_USA } from '../../shared/lib/importacion';

/** Original documents uploaded by the US operator, separate from AI reports. */
export default function InspectionFilesSection({ archivos }) {
  const { files = [], loading, error, recargar } = archivos;
  const reports = files.filter(f => f.uploaded_by === ORIGEN_ARCHIVO_USA
    && (f.mime_type === 'application/pdf' || /\.pdf$/i.test(f.original_name || '')));
  const actionClass = 'inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-13 font-medium text-ink-700 hover:bg-neutral-bg';
  return <Card className="exp-section">
    <Card.Header title="Informe de inspección" description="Documentos originales cargados desde Estados Unidos. Revisa el informe antes de continuar con la adquisición."
      actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={recargar} disabled={loading}>Actualizar</Button>} />
    <Card.Body>
      {loading ? <Skeleton className="h-20" /> : error ? <ErrorState title="No se pudieron cargar los documentos" message={error} onRetry={recargar} /> : reports.length ? <ul className="space-y-3" aria-label="Informes de inspección cargados">
        {reports.map(f => <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
          <FileText className="text-brand-600 shrink-0" size={28} />
          <div className="min-w-0 flex-1"><p className="font-medium text-ink-900 break-all">{f.original_name}</p>
            <p className="text-xs text-ink-500">PDF · {fmtDate(f.created_at)} · {f.file_size_formatted || fmtBytes(f.file_size)}</p>
            <Badge size="sm" tone={Number(f.visible_to_client ?? 1) === 0 ? 'neutral' : 'success'}>{Number(f.visible_to_client ?? 1) === 0 ? 'Sólo equipo · pendiente de compartir' : 'Disponible para el cliente'}</Badge>
          </div>
          <div className="flex flex-wrap gap-2"><FileOpen file={f} className={actionClass}>Ver informe</FileOpen><FileDownload file={f} className={actionClass}>Descargar PDF</FileDownload></div>
        </li>)}
      </ul> : <EmptyState compact icon={FileText} title="Sin informe de inspección cargado" description="El PDF aparecerá aquí cuando el encargado de la operación lo suba. También puedes revisar las cargas en EE. UU. y Archivos." />}
    </Card.Body>
  </Card>;
}
