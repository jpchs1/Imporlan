import { useState, useEffect, useCallback } from 'react';
import { getReports, previewReport, sendReport, resendReport, editReport, saveReport, deleteReport as apiDeleteReport } from '../lib/api';
import { fmtDate } from '../lib/utils';
import { Card, Button, Modal } from './UI';
import { useToast } from './Toast';

export default function ReportsSection({ orderId, linksCount = 0, customerEmail }) {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [editModal, setEditModal] = useState(null); // { report, html }

  const loadReports = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getReports(orderId);
      setReports(data.success && data.reports ? data.reports : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function handlePreview() {
    if (linksCount === 0) { toast?.('No hay links para generar reporte', 'error'); return; }
    setPreviewing(true);
    try {
      const data = await previewReport(orderId);
      if (data.success && data.html) {
        const w = window.open('', '_blank');
        if (w) { w.document.write(data.html); w.document.close(); }
        else toast?.('Permite popups para ver el preview', 'error');
      } else {
        toast?.(data.error || 'Error al generar preview', 'error');
      }
    } catch (e) { toast?.('Error de conexion', 'error'); }
    setPreviewing(false);
  }

  async function handleSend() {
    if (linksCount === 0) { toast?.('No hay links para generar reporte', 'error'); return; }
    if (!customerEmail) { toast?.('El expediente no tiene email de cliente', 'error'); return; }
    let msg = `Enviar reporte profesional a ${customerEmail}?`;
    msg += '\n\nSe generara el reporte con analisis AI, se guardara en el expediente y se enviara por email.';
    if (!confirm(msg)) return;
    setSending(true);
    try {
      const data = await sendReport(orderId);
      if (data.success) {
        toast?.('Reporte enviado correctamente al cliente', 'success');
        loadReports();
      } else {
        toast?.(data.error || 'Error al enviar reporte', 'error');
      }
    } catch (e) { toast?.('Error de conexion', 'error'); }
    setSending(false);
  }

  async function handleResend(reportId) {
    if (!confirm('Reenviar este reporte al cliente?')) return;
    try {
      const data = await resendReport(reportId);
      if (data.success) { toast?.('Reporte reenviado exitosamente', 'success'); loadReports(); }
      else toast?.(data.error || 'Error al reenviar', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  async function handleEdit(reportId) {
    try {
      const data = await editReport(reportId);
      if (data.success && data.report) {
        setEditModal({ report: data.report, html: data.report.html_content });
      } else {
        toast?.(data.error || 'Error al cargar reporte', 'error');
      }
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    const iframe = document.getElementById('ea-edit-report-iframe');
    if (!iframe) return;
    const editedHtml = iframe.contentDocument.documentElement.outerHTML;
    try {
      const data = await saveReport(editModal.report.id, editedHtml);
      if (data.success) {
        toast?.(data.message || 'Reporte guardado', 'success');
        setEditModal(null);
        loadReports();
      } else {
        toast?.(data.error || 'Error al guardar', 'error');
      }
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  async function handleDelete(reportId, version) {
    if (!confirm(`Eliminar el reporte v${version}? Esta accion no se puede deshacer.`)) return;
    try {
      const data = await apiDeleteReport(reportId);
      if (data.success) { toast?.(data.message || 'Reporte eliminado', 'success'); loadReports(); }
      else toast?.(data.error || 'Error al eliminar', 'error');
    } catch (e) { toast?.('Error de conexion', 'error'); }
  }

  function handleView(report) {
    if (report.id && report.access_token) {
      const base = window.location.pathname.includes('/test/') || window.location.pathname.includes('/panel-test') ? '/test/api' : '/api';
      window.open(`${base}/reports_api.php?action=view&report_id=${report.id}&token=${report.access_token}`, '_blank');
    }
  }

  function handleDownload(report) {
    if (report.id && report.access_token) {
      const base = window.location.pathname.includes('/test/') || window.location.pathname.includes('/panel-test') ? '/test/api' : '/api';
      window.open(`${base}/reports_api.php?action=download&report_id=${report.id}&token=${report.access_token}`, '_blank');
    }
  }

  return (
    <>
      <Card className="mb-5">
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 -m-6 mb-4 px-7 py-5 rounded-t-2xl border-b border-violet-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Reportes Generados</h3>
              <p className="text-xs text-slate-400">Historial de reportes enviados al cliente</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePreview} disabled={previewing || linksCount === 0}
              className="flex items-center gap-1.5 !bg-violet-50 !text-violet-700 !border-violet-200 hover:!bg-violet-100">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              {previewing ? 'Generando...' : 'Generar Reporte (Preview)'}
            </Button>
            <Button variant="secondary" onClick={handleSend} disabled={sending || linksCount === 0}
              className="flex items-center gap-1.5 !bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {sending ? 'Enviando...' : 'Enviar Reporte'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">Cargando reportes...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-slate-300">
            <svg className="w-8 h-8 mx-auto mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p className="text-sm">No hay reportes generados aun.</p>
            <p className="text-xs mt-1">Usa el boton "Enviar Reporte" para crear uno.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 text-[11px] font-bold text-slate-400 uppercase">Fecha</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-400 uppercase">Version</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-400 uppercase">Plan</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-bold text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2.5 px-3 text-slate-600">{fmtDate(r.created_at)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">v{r.version}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 text-xs">{r.plan_type || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <button onClick={() => handleView(r)} className="px-2.5 py-1 rounded-lg border border-violet-300 text-violet-600 text-[11px] font-semibold hover:bg-violet-50 transition">Ver</button>
                        <button onClick={() => handleDownload(r)} className="px-2.5 py-1 rounded-lg border border-cyan-300 text-cyan-600 text-[11px] font-semibold hover:bg-cyan-50 transition">PDF</button>
                        <button onClick={() => handleResend(r.id)} className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-600 text-[11px] font-semibold hover:bg-amber-50 transition">Reenviar</button>
                        <button onClick={() => handleEdit(r.id)} className="px-2.5 py-1 rounded-lg border border-emerald-300 text-emerald-600 text-[11px] font-semibold hover:bg-emerald-50 transition">Editar</button>
                        <button onClick={() => handleDelete(r.id, r.version)} className="px-2.5 py-1 rounded-lg border border-red-300 text-red-600 text-[11px] font-semibold hover:bg-red-50 transition">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit report modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={editModal ? `Editar Reporte v${editModal.report.version}` : ''} size="xl">
        {editModal && (
          <div className="flex flex-col" style={{height: '60vh'}}>
            <iframe
              id="ea-edit-report-iframe"
              className="flex-1 w-full border-0 rounded-xl border border-slate-200"
              ref={el => {
                if (el && editModal.html) {
                  const doc = el.contentDocument || el.contentWindow.document;
                  doc.open(); doc.write(editModal.html); doc.close();
                  doc.designMode = 'on';
                }
              }}
            />
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="secondary" onClick={() => setEditModal(null)}>Cerrar</Button>
              <Button onClick={handleSaveEdit}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
