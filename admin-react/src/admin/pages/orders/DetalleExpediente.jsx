import { useState } from 'react';
import { fmtDate } from '../../../shared/lib/utils';
import { Card, Button, Modal, Select, Menu, StatusBadge, Callout, ErrorState, EmptyState, Skeleton, ProcessStepper, Spinner } from '../../../shared/components/UI';
import { Plus, Trash, Link2, Info, FolderOpen, FileText, Images, Ship, Compass, Globe, User, Calendar, Layers, ArrowUpRight } from '../../../shared/components/Icons';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { etapaPorEleccion, tituloLancha } from '../../../shared/lib/importacion';
import LinkRow from '../../components/LinkRow';
import QuoteModal from '../../components/QuoteModal';
import ReportsSection from '../../components/ReportsSection';
import InspectionFilesSection from '../../components/InspectionFilesSection';
import FilesSection from '../../components/FilesSection';
import { useExpedienteFiles } from '../../components/useExpedienteFiles';
import { ExpedienteHeader, ExpedienteMetrics, ExpedienteNavigation } from '../../../shared/components/ExpedienteWorkspace';
import { irASeccionExpediente } from '../../../shared/lib/expediente-navigation';
import { STATUS_OPTIONS } from './constantes';
import BarraAcciones from './BarraAcciones';
import FormularioExpediente from './FormularioExpediente';
import SeccionImportacion from './SeccionImportacion';
import ModalEleccion from './ModalEleccion';

export default function DetalleExpediente(p) {
  const {
    loading, detail, links, form, setForm, setUnsaved, unsaved, saving,
    rescraping, rescrapeProgress, scraperFaltante, onCerrarAvisoScraper, linksContainerRef,
    onBack, onSaveAll, onSendClient, onNotifyRanking, onRescrape, onDeleteOrder, onTimelineStep,
    onAddLink, onDeleteEmptyLinks, onLinkUpdate, onDeleteLink, onImageUpload, onScrapeResult, onEncolado, onEncolarUrl,
    onCotizar, onEnviarDesglose, dragHandlers,
    showStatusModal, setShowStatusModal, newStatus, setNewStatus, onStatusChange,
    cotizandoLink, onCloseCotizar, onBreakdownSent, onQuoteSaved,
    importacion,
  } = p;

  // Modal «Marcar lancha elegida»: lo abren la sección Importación y el menú
  // de cada fila del ranking (con esa fila preseleccionada). { linkId } | null.
  const [modalEleccion, setModalEleccion] = useState(null);
  const abrirEleccion = (lk) => setModalEleccion({ linkId: lk?.id ?? null });

  // Los archivos se piden una vez y los comparten Archivos y «Operación en
  // EE. UU.» (las miniaturas de cada actualización salen de aquí por id).
  const archivos = useExpedienteFiles(detail?.id);

  if (loading || !detail) return <Skeleton.Detail />;

  const hayVacias = links.some(l => !l.url && !l.make && !l.model && !l.image_url);
  const conUrl = links.filter(l => (l.url || '').trim()).length;
  const eleccion = detail.eleccion || null;
  const etapaEleccion = etapaPorEleccion(eleccion);
  // El rol agente (operación en EE. UU.) no ve el contacto del cliente ni cobra.
  const equipoChile = importacion.puedeCobrar !== false;
  const elegida = eleccion ? links.find(link => Number(link.id) === Number(eleccion.link_id)) : null;
  const etapaActual = Math.min(ETAPAS_EXPEDIENTE.length, Math.max(1, Number(detail.timeline_step) || 1));
  const documentos = archivos.files.filter(f => f.category === 'document').length;
  const multimedia = archivos.files.filter(f => f.category === 'image' || f.category === 'video').length;

  return (
    <div className="exp-workspace exp-workspace--admin">
      <BarraAcciones
        detail={detail}
        unsaved={unsaved}
        saving={saving}
        rescraping={rescraping}
        rescrapeProgress={rescrapeProgress}
        onBack={onBack}
        onSave={onSaveAll}
        onChangeStatus={() => { setNewStatus(detail.status); setShowStatusModal(true); }}
        onSendClient={onSendClient}
        onNotifyRanking={onNotifyRanking}
        onRescrape={onRescrape}
        onDelete={onDeleteOrder}
        contactoOculto={!equipoChile}
      />

      <ExpedienteHeader
        eyebrow={`Expediente · ${detail.order_number}`}
        title={detail.customer_name || detail.order_number}
        description={elegida ? tituloLancha(elegida) : (detail.asset_name || detail.requirement_name || 'Gestiona el avance y la documentación de esta operación.')}
        meta={<StatusBadge kind="expediente" status={detail.status} dot />}
        image={elegida?.image_url}
        imageLabel="Embarcación elegida"
      >
        <div className="exp-header__meta">
          <span><Layers size={15} />{detail.plan_name || 'Plan por definir'}</span>
          <span><User size={15} />{detail.agent_name || 'Agente sin asignar'}</span>
          <span><Calendar size={15} />{fmtDate(detail.purchase_date || detail.created_at)}</span>
        </div>
        <div className="exp-header__shortcuts">
          <Button variant="secondary" size="sm" icon={FileText} onClick={() => irASeccionExpediente('reportes')}>Informe de inspección</Button>
          <Button variant="ghost" size="sm" iconRight={ArrowUpRight} onClick={() => irASeccionExpediente('archivos')}>Ver archivos</Button>
        </div>
      </ExpedienteHeader>
      <ExpedienteMetrics items={[
        { label: 'Etapa actual', value: `${String(etapaActual).padStart(2, '0')} / ${String(ETAPAS_EXPEDIENTE.length).padStart(2, '0')}`, hint: ETAPAS_EXPEDIENTE[etapaActual - 1]?.label, icon: Compass },
        { label: 'Opciones', value: conUrl, hint: 'Embarcaciones en el ranking', icon: Ship },
        { label: 'Documentos', value: archivos.loading ? '—' : documentos, hint: 'Informes y otros documentos', icon: FileText },
        { label: 'Fotos y videos', value: archivos.loading ? '—' : multimedia, hint: 'Material de la operación', icon: Images },
      ]} />
      <ExpedienteNavigation sections={[
        { id: 'etapa', label: 'Resumen', icon: Compass },
        { id: 'importacion', label: 'Operación', icon: Ship },
        ...(eleccion && equipoChile ? [{ id: 'operacion-usa', label: 'EE. UU.', icon: Globe }] : []),
        { id: 'reportes', label: 'Informes', icon: FileText },
        { id: 'archivos', label: 'Archivos', icon: FolderOpen, count: archivos.files.length },
        { id: 'ranking', label: 'Opciones', icon: Link2, count: conUrl },
        { id: 'datos', label: 'Datos', icon: User },
      ]} />
      <div className="exp-content">

          <Card id="etapa" className="exp-section scroll-mt-32">
            <Card.Header title="Avance de la operación" description="Sigue el recorrido del expediente y actualiza cada etapa cuando corresponda." />
            <Card.Body>
              <ProcessStepper current={detail.timeline_step || 1} onPrev={() => onTimelineStep(-1)} onNext={() => onTimelineStep(1)} showDescription={false} />
              {eleccion && etapaEleccion > 0 && (
                <p className="mt-4 flex items-start gap-2 text-13 text-ink-500">
                  <Info size={16} className="shrink-0 mt-0.5 text-ink-400" />
                  <span>
                    Etapa por la elección: <span className="font-medium text-ink-900">{ETAPAS_EXPEDIENTE.find(e => e.num === etapaEleccion)?.label}</span>
                    {eleccion.inspection && !eleccion.steps?.inspeccion ? ', hasta que se apruebe la inspección' : ''}.
                    {' '}Se mueve sola con los hitos de Importación.
                  </span>
                </p>
              )}
            </Card.Body>
          </Card>

          <SeccionImportacion
            detail={detail}
            links={links}
            importacion={importacion}
            onMarcarElegida={abrirEleccion}
            onCotizar={onCotizar}
            archivos={archivos}
          />

          <div id="reportes" className="scroll-mt-32 space-y-4">
            <InspectionFilesSection archivos={archivos} />
            <ReportsSection orderId={detail.id} linksCount={conUrl} customerEmail={detail.customer_email} />
          </div>

          <div id="archivos" className="scroll-mt-32">
            <FilesSection orderId={detail.id} archivos={archivos} />
          </div>
          <Card id="ranking" className="exp-section scroll-mt-32">
            <Card.Header
              title="Ranking de opciones en USA"
              description={`${links.length} ${links.length === 1 ? 'opción' : 'opciones'} · arrastra las filas para ordenarlas`}
              actions={(
                <>
                  <Button variant="secondary" size="sm" icon={Plus} onClick={onAddLink}><span className="sr-only sm:not-sr-only">Agregar fila</span></Button>
                  {hayVacias && (
                    <Menu
                      label="Más acciones del ranking"
                      items={[{ label: 'Borrar filas vacías', icon: Trash, tone: 'danger', onClick: onDeleteEmptyLinks }]}
                    />
                  )}
                </>
              )}
            />
            <Card.Body className="space-y-3">
              {detail.ranking_author_name ? (
                <Callout tone="success" compact>
                  Ranking armado por <strong>{detail.ranking_author_name}</strong> ({detail.ranking_author_role === 'admin' ? 'agente' : 'cliente'}){detail.ranking_updated_at ? ` · ${fmtDate(detail.ranking_updated_at)}` : ''}
                </Callout>
              ) : (
                <Callout tone="neutral" compact>Aún no se ha armado un ranking. Arrastra las filas para ordenar las opciones.</Callout>
              )}

              {rescraping && (
                <Callout tone="info" compact icon={() => <Spinner inline size="sm" />}>
                  Rescrapeando los links, {rescrapeProgress}… Cada uno puede tardar hasta un minuto.
                </Callout>
              )}

              {scraperFaltante && (
                <Card padding="none" className="border-danger-line">
                  <ErrorState
                    compact
                    title="Falta el módulo de lectura en el servidor"
                    message="Se guardó lo que se pudo deducir de cada URL, pero no las imágenes. Abre el detalle para ver cómo restaurarlo."
                    detail={scraperFaltante}
                    onRetry={onCerrarAvisoScraper}
                    retryLabel="Entendido"
                  />
                </Card>
              )}

              {/* Links list — natural page scroll, no internal max-height. */}
              <div ref={linksContainerRef} className="space-y-3">
                {links.length === 0 ? (
                  <EmptyState compact icon={Link2} title="Sin opciones todavía" description="Agrega una fila y pega el link del anuncio." primaryAction={<Button size="sm" icon={Plus} onClick={onAddLink}>Agregar fila</Button>} />
                ) : links.map((lk, idx) => (
                  <LinkRow
                    key={lk.id || idx}
                    link={lk}
                    idx={idx}
                    onUpdate={onLinkUpdate}
                    onDelete={onDeleteLink}
                    onImageUpload={onImageUpload}
                    onScrapeResult={onScrapeResult}
                    onEncolado={onEncolado}
                    onEncolarUrl={onEncolarUrl}
                    orderId={detail?.id}
                    onCotizar={lk.id ? onCotizar : undefined}
                    onEnviarDesglose={lk.id ? onEnviarDesglose : undefined}
                    elegida={!!eleccion && eleccion.link_id === lk.id}
                    eleccion={eleccion}
                    onMarcarElegida={lk.id ? abrirEleccion : undefined}
                    dragHandlers={{
                      onDragStart: e => dragHandlers.onDragStart(e, idx),
                      onDragOver: dragHandlers.onDragOver,
                      onDrop: e => dragHandlers.onDrop(e, idx),
                      onDragEnd: dragHandlers.onDragEnd,
                    }}
                  />
                ))}
              </div>
            </Card.Body>
          </Card>

        <div><FormularioExpediente detail={detail} form={form} setForm={setForm} setUnsaved={setUnsaved} contactoOculto={!equipoChile} /></div>
      </div>

      {/* Change status modal */}
      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Cambiar estado"
        description="Al cambiar el estado se le avisa al cliente por correo."
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
            <Button onClick={onStatusChange} disabled={newStatus === detail?.status}>Aplicar</Button>
          </>
        )}
      >
        <Select label="Nuevo estado" value={newStatus} onChange={e => setNewStatus(e.target.value)} options={STATUS_OPTIONS} data-autofocus />
      </Modal>

      <QuoteModal
        open={!!cotizandoLink}
        link={cotizandoLink}
        onClose={onCloseCotizar}
        onBreakdownSent={onBreakdownSent}
        onSaved={onQuoteSaved}
      />

      {modalEleccion && (
        <ModalEleccion
          open
          onClose={() => setModalEleccion(null)}
          links={links}
          eleccion={eleccion}
          linkIdInicial={modalEleccion.linkId}
          onConfirmar={importacion.onElegir}
          puedeCobrar={equipoChile}
          datosCompletos={equipoChile && detail.datos_importacion ? !!detail.datos_importacion.completo : null}
        />
      )}
    </div>
  );
}
