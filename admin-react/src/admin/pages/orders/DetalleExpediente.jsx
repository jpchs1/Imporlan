import { useState } from 'react';
import { fmtDate } from '../../../shared/lib/utils';
import { Card, Button, Modal, Select, Menu, Callout, ErrorState, EmptyState, Skeleton, Spinner } from '../../../shared/components/UI';
import { Plus, Trash, Link2, FolderOpen, FileText, Ship, Compass, Globe, User } from '../../../shared/components/Icons';
import { etapaPorEleccion } from '../../../shared/lib/importacion';
import LinkRow from '../../components/LinkRow';
import QuoteModal from '../../components/QuoteModal';
import ReportsSection from '../../components/ReportsSection';
import InspectionFilesSection from '../../components/InspectionFilesSection';
import FilesSection from '../../components/FilesSection';
import { useExpedienteFiles } from '../../components/useExpedienteFiles';
import { ExpedienteNavigation } from '../../../shared/components/ExpedienteWorkspace';
import { ResumenExpediente, AvanceExpediente } from './ResumenExpediente';
import './expediente-admin.css';
import { esLinkVacio } from '../../../shared/lib/link-vacio';
import { STATUS_OPTIONS } from './constantes';
import BarraAcciones from './BarraAcciones';
import FormularioExpediente from './FormularioExpediente';
import SeccionImportacion from './SeccionImportacion';
import ModalEleccion from './ModalEleccion';

export default function DetalleExpediente(p) {
  const {
    loading, loadError, onRetry, detail, links, form, setForm, setUnsaved, unsaved, saving,
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
  const [mostrarVacias, setMostrarVacias] = useState(false);
  const abrirEleccion = (lk) => setModalEleccion({ linkId: lk?.id ?? null });

  // Los archivos se piden una vez y los comparten Archivos y «Operación en
  // EE. UU.» (las miniaturas de cada actualización salen de aquí por id).
  const archivos = useExpedienteFiles(detail?.id);

  if (loading) return <Skeleton.Detail />;
  if (!detail) return <Card><ErrorState title="No pudimos cargar este expediente" detail={loadError} onRetry={onRetry} /><Button variant="ghost" onClick={onBack}>Volver a expedientes</Button></Card>;

  const vacias = links.filter(esLinkVacio).length;
  const hayVacias = vacias > 0;
  const linksVisibles = mostrarVacias || links.every(esLinkVacio) ? links : links.filter(l => !esLinkVacio(l));
  const agregarFila = () => { setMostrarVacias(true); onAddLink(); };
  const conUrl = links.filter(l => (l.url || '').trim()).length;
  const eleccion = detail.eleccion || null;
  const etapaEleccion = etapaPorEleccion(eleccion);
  // El rol agente (operación en EE. UU.) no ve el contacto del cliente ni cobra.
  const equipoChile = importacion.puedeCobrar !== false;
  const elegida = eleccion ? links.find(link => Number(link.id) === Number(eleccion.link_id)) : null;

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

      <ResumenExpediente detail={detail} links={links} elegida={elegida} archivos={archivos} equipoChile={equipoChile} />
      <ExpedienteNavigation sections={[
        { id: 'etapa', label: 'Resumen', icon: Compass },
        { id: 'ranking', label: 'Opciones', icon: Link2, count: conUrl },
        { id: 'importacion', label: 'Operación', icon: Ship },
        ...(eleccion && equipoChile ? [{ id: 'operacion-usa', label: 'EE. UU.', icon: Globe }] : []),
        { id: 'reportes', label: 'Informes', icon: FileText },
        { id: 'archivos', label: 'Archivos', icon: FolderOpen, count: archivos.loading || archivos.error ? undefined : archivos.files.length },
        { id: 'datos', label: 'Datos', icon: User },
      ]} />
      <div className="exp-content">

        <AvanceExpediente detail={detail} onTimelineStep={onTimelineStep} etapaEleccion={etapaEleccion} />
          <Card id="ranking" className="exp-section admin-exp-ranking scroll-mt-32">
            <Card.Header
              title="Ranking de opciones en USA"
              description={`${conUrl} ${conUrl === 1 ? 'anuncio' : 'anuncios'}${vacias ? ` · ${vacias} ${vacias === 1 ? 'fila vacía' : 'filas vacías'}` : ''} · arrastra las opciones para ordenarlas`}
              actions={(
                <>
                  <Button variant="secondary" size="sm" icon={Plus} onClick={agregarFila}><span className="sr-only sm:not-sr-only">Agregar fila</span></Button>
                  {hayVacias && (
                    <Menu
                      label="Más acciones del ranking"
                      items={[{ label: 'Borrar filas vacías', icon: Trash, tone: 'danger', onClick: onDeleteEmptyLinks }]}
                    />
                  )}
                </>
              )}
            />
            <Card.Body className="admin-exp-ranking__body space-y-3">
              {detail.ranking_author_name ? (
                <p className="admin-exp-ranking__author">
                  Ranking armado por <strong>{detail.ranking_author_name}</strong> ({detail.ranking_author_role === 'admin' ? 'agente' : 'cliente'}){detail.ranking_updated_at ? ` · ${fmtDate(detail.ranking_updated_at)}` : ''}
                </p>
              ) : (
                <p className="admin-exp-ranking__author">Arrastra las opciones para ordenar el ranking de este expediente.</p>
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
              <div ref={linksContainerRef} className="admin-exp-options space-y-3">
                {links.length === 0 ? (
                  <EmptyState compact icon={Link2} title="Sin opciones todavía" description="Agrega una fila y pega el link del anuncio." primaryAction={<Button size="sm" icon={Plus} onClick={agregarFila}>Agregar fila</Button>} />
                ) : linksVisibles.map(lk => {
                  const idx = links.indexOf(lk);
                  return (
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
                    elegida={!!eleccion && Number(eleccion.link_id) === Number(lk.id)}
                    eleccion={eleccion}
                    onMarcarElegida={lk.id ? abrirEleccion : undefined}
                    dragHandlers={{
                      onDragStart: e => dragHandlers.onDragStart(e, idx),
                      onDragOver: dragHandlers.onDragOver,
                      onDrop: e => dragHandlers.onDrop(e, idx),
                      onDragEnd: dragHandlers.onDragEnd,
                    }}
                  />
                ); })}
              </div>
              {hayVacias && !links.every(esLinkVacio) && (
                <Button variant="ghost" size="sm" onClick={() => setMostrarVacias(v => !v)} aria-expanded={mostrarVacias}>
                  {mostrarVacias ? 'Ocultar filas vacías' : `Mostrar ${vacias} ${vacias === 1 ? 'fila vacía' : 'filas vacías'}`}
                </Button>
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
