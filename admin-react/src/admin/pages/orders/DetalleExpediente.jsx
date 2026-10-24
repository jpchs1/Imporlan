import { useEffect, useState } from 'react';
import { fmtDate, cn } from '../../../shared/lib/utils';
import { Card, Button, Modal, Select, Menu, Callout, ErrorState, EmptyState, Skeleton, ProcessStepper, Spinner } from '../../../shared/components/UI';
import { Plus, Trash, Link2, Info } from '../../../shared/components/Icons';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { etapaPorEleccion } from '../../../shared/lib/importacion';
import LinkRow from '../../components/LinkRow';
import QuoteModal from '../../components/QuoteModal';
import ReportsSection from '../../components/ReportsSection';
import InspectionFilesSection from '../../components/InspectionFilesSection';
import FilesSection from '../../components/FilesSection';
import { useExpedienteFiles } from '../../components/useExpedienteFiles';
import { STATUS_OPTIONS } from './constantes';
import BarraAcciones from './BarraAcciones';
import FormularioExpediente from './FormularioExpediente';
import SeccionImportacion from './SeccionImportacion';
import ModalEleccion from './ModalEleccion';

const SECCIONES = [
  { id: 'datos', label: 'Datos' },
  { id: 'etapa', label: 'Etapa' },
  { id: 'importacion', label: 'Importación' },
  { id: 'operacion-usa', label: 'EE. UU.', soloConEleccion: true, soloEquipoChile: true },
  { id: 'ranking', label: 'Ranking' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'archivos', label: 'Archivos' },
];

/* Anclas laterales (≥ xl). Con HashRouter un <a href="#id"> cambiaría de ruta,
   así que se desplaza con scrollIntoView. */
function Anclas({ conEleccion, equipoChile }) {
  const [activa, setActiva] = useState('datos');
  const secciones = SECCIONES.filter(s => (!s.soloConEleccion || conEleccion) && (!s.soloEquipoChile || equipoChile));
  const ids = secciones.map(s => s.id).join(',');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      const visibles = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visibles[0]) setActiva(visibles[0].target.id);
    }, { rootMargin: '-140px 0px -60% 0px', threshold: 0 });
    // Se observa al montar y cada vez que aparece o desaparece una sección
    // (la de EE. UU. nace con la elección y se pinta tras cargar).
    const t = setTimeout(() => ids.split(',').forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); }), 300);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, [ids]);
  const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <nav aria-label="Secciones del expediente" className="sticky top-[calc(var(--topbar-h)+72px)]">
      <ul className="space-y-0.5">
        {secciones.map(s => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => ir(s.id)}
              aria-current={activa === s.id ? 'location' : undefined}
              className={cn('w-full text-left px-3 h-8 rounded-md text-13 transition-colors duration-150 border-l-2',
                activa === s.id ? 'border-brand-600 text-ink-900 font-medium bg-surface' : 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface')}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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

  return (
    <div>
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

      <div className="xl:grid xl:grid-cols-[150px_minmax(0,1fr)] xl:gap-8">
        <aside className="hidden xl:block"><Anclas conEleccion={!!eleccion} equipoChile={equipoChile} /></aside>

        <div className="min-w-0 space-y-4">
          <FormularioExpediente detail={detail} form={form} setForm={setForm} setUnsaved={setUnsaved} contactoOculto={!equipoChile} />

          <Card id="etapa" className="scroll-mt-32">
            <Card.Header title="Etapa del proceso" description="La etapa actual se muestra en el panel del cliente." />
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

          <Card id="ranking" className="scroll-mt-32">
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

          <div id="reportes" className="scroll-mt-32 space-y-4">
            <InspectionFilesSection archivos={archivos} />
            <ReportsSection orderId={detail.id} linksCount={conUrl} customerEmail={detail.customer_email} />
          </div>

          <div id="archivos" className="scroll-mt-32">
            <FilesSection orderId={detail.id} archivos={archivos} />
          </div>
        </div>
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
