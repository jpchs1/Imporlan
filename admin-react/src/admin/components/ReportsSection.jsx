import { useState, useEffect, useCallback, useRef } from 'react';
import { getReports, previewReport, sendReport, resendReport, editReport, saveReport, deleteReport as apiDeleteReport } from '../api';
import { fmtDate } from '../../shared/lib/utils';
import { Card, Button, IconButton, Modal, DataTable, Badge, EmptyState, useConfirm } from '../../shared/components/UI';
import { Eye, Send, FileDown, Pencil, Trash, FileSearch } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

export default function ReportsSection({ orderId, linksCount = 0, customerEmail }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editModal, setEditModal] = useState(null); // { report, html }
  // El HTML se escribe en el iframe UNA vez por reporte abierto: con un ref
  // inline se reescribía en cada render y se perdía lo editado.
  const writtenFor = useRef(null);
  const iframeRef = useCallback(el => {
    if (!el || !editModal?.html || writtenFor.current === editModal.report.id) return;
    writtenFor.current = editModal.report.id;
    const doc = el.contentDocument || el.contentWindow.document;
    doc.open(); doc.write(editModal.html); doc.close();
    doc.designMode = 'on';
  }, [editModal]);
  useEffect(() => { if (!editModal) writtenFor.current = null; }, [editModal]);

  const loadReports = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getReports(orderId);
      setReports(data.success && data.reports ? data.reports : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const t = setTimeout(loadReports, 0);
    return () => clearTimeout(t);
  }, [loadReports]);

  async function handlePreview() {
    if (linksCount === 0) { toast?.('No hay links para generar el reporte', 'error'); return; }
    setPreviewing(true);
    try {
      const data = await previewReport(orderId);
      if (data.success && data.html) {
        const w = window.open('', '_blank');
        if (w) { w.document.write(data.html); w.document.close(); }
        else toast?.('Permite las ventanas emergentes para ver la vista previa', 'error');
      } else {
        toast?.(data.error || 'Error al generar la vista previa', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
    setPreviewing(false);
  }

  async function handleSend() {
    if (linksCount === 0) { toast?.('No hay links para generar el reporte', 'error'); return; }
    if (!customerEmail) { toast?.('El expediente no tiene correo de cliente', 'error'); return; }
    if (!(await confirm({
      title: `¿Enviar el reporte a ${customerEmail}?`,
      description: 'Se genera el reporte con análisis de IA, se guarda en el expediente y se envía por correo.',
      confirmLabel: 'Generar y enviar',
    }))) return;
    setSending(true);
    try {
      const data = await sendReport(orderId);
      if (data.success) {
        if (data.email_sent === false) toast?.('Reporte generado, pero el correo al cliente no se pudo enviar', 'warning');
        else toast?.('Reporte enviado correctamente al cliente', 'success');
        loadReports();
      } else {
        toast?.(data.error || 'Error al enviar el reporte', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
    setSending(false);
  }

  async function handleResend(r) {
    if (!(await confirm({ title: `¿Reenviar el reporte v${r.version} al cliente?`, description: customerEmail ? `Se manda de nuevo a ${customerEmail}.` : undefined, confirmLabel: 'Reenviar' }))) return;
    try {
      const data = await resendReport(r.id);
      if (data.success) { toast?.('Reporte reenviado', 'success'); loadReports(); }
      else toast?.(data.error || 'Error al reenviar', 'error');
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
  }

  async function handleEdit(reportId) {
    try {
      const data = await editReport(reportId);
      if (data.success && data.report) {
        setEditModal({ report: data.report, html: data.report.html_content });
      } else {
        toast?.(data.error || 'Error al cargar el reporte', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    const iframe = document.getElementById('ea-edit-report-iframe');
    if (!iframe) return;
    const editedHtml = iframe.contentDocument.documentElement.outerHTML;
    setSavingEdit(true);
    try {
      const data = await saveReport(editModal.report.id, editedHtml);
      if (data.success) {
        toast?.(data.message || 'Reporte guardado', 'success');
        setEditModal(null);
        loadReports();
      } else {
        toast?.(data.error || 'Error al guardar', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
    setSavingEdit(false);
  }

  async function handleDelete(reportId, version) {
    if (!(await confirm({ title: `¿Eliminar el reporte v${version}?`, description: 'Esta acción no se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      const data = await apiDeleteReport(reportId);
      if (data.success) { toast?.(data.message || 'Reporte eliminado', 'success'); loadReports(); }
      else toast?.(data.error || 'Error al eliminar', 'error');
    } catch (e) { toast?.(e.message || 'Error de conexión', 'error'); }
  }

  function apiBase() {
    return window.location.pathname.includes('/test/') || window.location.pathname.includes('/panel-test') ? '/test/api' : '/api';
  }

  function handleView(report) {
    if (report.id && report.access_token) {
      window.open(`${apiBase()}/reports_api.php?action=view&report_id=${report.id}&token=${report.access_token}`, '_blank');
    }
  }

  function handleDownload(report) {
    if (report.id && report.access_token) {
      window.open(`${apiBase()}/reports_api.php?action=download&report_id=${report.id}&token=${report.access_token}`, '_blank');
    }
  }

  const sinLinks = linksCount === 0;

  const columns = [
    { key: 'created_at', header: 'Fecha', width: 120, cell: r => <span className="tabular">{fmtDate(r.created_at)}</span> },
    { key: 'version', header: 'Versión', width: 100, sortValue: r => Number(r.version) || 0, cell: r => <Badge tone="brand">v{r.version}</Badge> },
    { key: 'plan_type', header: 'Plan', priority: 2, cell: r => r.plan_type || '—' },
    {
      header: <span className="sr-only">Abrir</span>, width: 88, align: 'right',
      cell: r => (
        <span className="inline-flex items-center gap-1">
          <IconButton size="sm" icon={Eye} aria-label={`Ver reporte v${r.version}`} onClick={() => handleView(r)} />
          <IconButton size="sm" icon={FileDown} aria-label={`Descargar PDF del reporte v${r.version}`} onClick={() => handleDownload(r)} />
        </span>
      ),
    },
  ];

  return (
    <>
      <Card className="exp-section">
        <Card.Header
          title="Reportes de opciones"
          description="Reportes de opciones generados con IA y enviados al cliente."
          actions={(
            <>
              <Button variant="secondary" size="sm" icon={Eye} onClick={handlePreview} loading={previewing} disabled={sinLinks} title={sinLinks ? 'Agrega links al ranking para generar un reporte' : 'Abre una vista previa en otra pestaña, sin guardar ni enviar'}><span className="sr-only sm:not-sr-only">Vista previa</span></Button>
              <Button variant="secondary" size="sm" icon={Send} onClick={handleSend} loading={sending} disabled={sinLinks} title={sinLinks ? 'Agrega links al ranking para generar un reporte' : 'Genera el reporte, lo guarda y lo envía por correo'}><span className="sr-only sm:not-sr-only">Generar y enviar</span></Button>
            </>
          )}
        />
        <DataTable
          aria-label="Reportes del expediente"
          columns={columns}
          data={reports}
          rowKey={r => r.id}
          loading={loading}
          loadingRows={2}
          pageSize={0}
          rowActions={r => [
            { label: 'Reenviar al cliente', icon: Send, onClick: () => handleResend(r) },
            { label: 'Editar', icon: Pencil, onClick: () => handleEdit(r.id) },
            { separator: true },
            { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: () => handleDelete(r.id, r.version) },
          ]}
          emptyState={<EmptyState compact icon={FileSearch} title="Aún no hay reportes de opciones" description={sinLinks ? 'Agrega links al ranking para poder generar uno.' : 'Usa «Generar y enviar» para crear el primero.'} />}
          mobileCard={r => (
            <div className="min-w-0">
              <div className="flex items-center gap-2"><Badge tone="brand">v{r.version}</Badge><span className="text-13 text-ink-500 tabular">{fmtDate(r.created_at)}</span></div>
              <p className="text-13 text-ink-700 mt-1">{r.plan_type || '—'}</p>
              <div className="flex gap-3 mt-1.5 text-13 font-medium">
                <button type="button" onClick={() => handleView(r)} className="text-brand-600 hover:underline">Ver</button>
                <button type="button" onClick={() => handleDownload(r)} className="text-brand-600 hover:underline">PDF</button>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Edit report modal */}
      <Modal
        open={!!editModal}
        onClose={savingEdit ? undefined : () => setEditModal(null)}
        title={editModal ? `Editar reporte v${editModal.report.version}` : ''}
        description="Edita el texto directamente sobre el reporte y guarda."
        size="xl"
        bodyClassName="p-0"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditModal(null)} disabled={savingEdit}>Cerrar</Button>
            <Button onClick={handleSaveEdit} loading={savingEdit}>Guardar</Button>
          </>
        )}
      >
        {editModal && (
          <iframe
            id="ea-edit-report-iframe"
            title={`Reporte v${editModal.report.version}`}
            className="block w-full border-0 h-[65vh] sm:h-[60vh]"
            ref={iframeRef}
          />
        )}
      </Modal>
    </>
  );
}
