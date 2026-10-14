import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyOrderDetail, saveRanking, notifyRanking, getMyFiles, getMyReports } from '../../api';
import { useToast } from '../../../shared/components/Toast';
import { useBreadcrumb } from '../../../shared/lib/page-meta';
import { fmtDateLarga } from '../../../shared/lib/format';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { PageHeader, Card, StatusBadge, ProcessStepper, Callout, Menu, Avatar, DescriptionList, EmptyState, ErrorState, Skeleton, Lightbox } from '../../../shared/components/UI';
import { Printer, Search, WhatsAppIcon } from '../../../shared/components/Icons';
import RankingEmbarcaciones from './RankingEmbarcaciones';
import SeccionReportes from './SeccionReportes';
import SeccionArchivos from './SeccionArchivos';
import ModalInspeccion from './ModalInspeccion';
import TarjetaPartner from './TarjetaPartner';
import BotonEnlace from './BotonEnlace';
import { nombreExpediente, tipoExpediente, etapaDe, esCerrado, fraseEtapa, whatsappExpediente, esImagen } from './lib';

/**
 * Detalle de un expediente: avance, agente, ranking de embarcaciones,
 * reportes y archivos. La lógica de ranking (guardar, avisar, polling de
 * 30 s, arrastrar) es la misma de siempre; cambia cómo se ve.
 */
export default function DetalleExpediente({ orderId, backTo = '/expedientes' }) {
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { items: [{src, alt, caption, downloadUrl}], index }
  const [inspectionLink, setInspectionLink] = useState(null);
  const [loadError, setLoadError] = useState('');
  const dragSrc = useRef(null);
  const pollRef = useRef(null);
  const lastRankingTs = useRef(null);

  useBreadcrumb(order?.order_number ? [order.order_number] : null);

  // Los reportes se filtran por id o por número; se piden apenas llega el
  // expediente (no en un efecto aparte, para no encadenar renders).
  const loadReports = useCallback(async (ord) => {
    try {
      const data = await getMyReports();
      const all = data?.reports || [];
      const matchById = (r) => String(r.order_id || r.expediente_id || '') === String(orderId);
      const matchByNumber = (r) => ord?.order_number && (r.order_number === ord.order_number || r.expediente_number === ord.order_number);
      const filtered = all.filter(r => matchById(r) || matchByNumber(r));
      setReports(filtered.length > 0 ? filtered : []);
    } catch { /* silencioso */ }
  }, [orderId]);

  const loadDetail = useCallback(async () => {
    try {
      const data = await getMyOrderDetail(orderId);
      const ord = data?.order || data?.data || null;
      if (ord) {
        setOrder(ord);
        setLinks(ord.links || []);
        lastRankingTs.current = ord.ranking_updated_at || null;
        loadReports(ord);
      } else if (data?.error) {
        setLoadError(String(data.error));
      } else {
        setLoadError('No se pudo cargar el expediente');
      }
    } catch (e) {
      setLoadError(e?.message || 'Error al cargar expediente');
      toast?.('No pudimos cargar el expediente', 'error');
    }
    setLoading(false);
  }, [orderId, toast, loadReports]);

  const loadFiles = useCallback(async () => {
    try {
      const data = await getMyFiles(orderId);
      if (data.success && data.files) setFiles(data.files);
    } catch { /* silencioso: los archivos son secundarios */ }
  }, [orderId]);

  // Como en el kit (NotificationBell): la carga sale del cuerpo del efecto
  // para no encadenar renders síncronos.
  useEffect(() => {
    const t = setTimeout(() => { loadDetail(); loadFiles(); }, 0);
    return () => clearTimeout(t);
  }, [loadDetail, loadFiles]);

  // Polling de cambios de ranking hechos por el equipo (30 s)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getMyOrderDetail(orderId);
        if (data.success && data.order) {
          const newTs = data.order.ranking_updated_at;
          if (newTs && newTs !== lastRankingTs.current) {
            lastRankingTs.current = newTs;
            setOrder(data.order);
            setLinks(data.order.links || []);
            const who = data.order.ranking_author_role === 'admin' ? 'el equipo Imporlan' : data.order.ranking_author_name;
            toast?.(`Ranking actualizado por ${who}`, 'success');
          }
        }
      } catch { /* silencioso */ }
    }, 30000);
    return () => clearInterval(pollRef.current);
  }, [orderId, toast]);

  // --- Ranking: arrastrar, flechas, guardar, avisar ---------------------------
  async function doSaveRanking(currentLinks) {
    setSaving(true);
    try {
      const linkIds = currentLinks.map(l => l.id);
      const data = await saveRanking(orderId, linkIds);
      if (data.success) {
        toast?.('Ranking guardado', 'success');
        if (data.ranking_author_name) lastRankingTs.current = new Date().toISOString();
      } else {
        toast?.(data.error || 'No pudimos guardar el ranking', 'error');
      }
    } catch {
      toast?.('Error de conexión', 'error');
    }
    setSaving(false);
  }

  function dnd(idx) {
    return {
      onDragStart: (e) => { dragSrc.current = idx; e.dataTransfer.effectAllowed = 'move'; },
      onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
      onDrop: (e) => {
        e.preventDefault();
        if (dragSrc.current === null || dragSrc.current === idx) return;
        const newLinks = [...links];
        const [moved] = newLinks.splice(dragSrc.current, 1);
        newLinks.splice(idx, 0, moved);
        setLinks(newLinks);
        dragSrc.current = null;
        doSaveRanking(newLinks);
      },
      onDragEnd: () => { dragSrc.current = null; },
    };
  }

  async function handleNotify() {
    setNotifying(true);
    try {
      const linkIds = links.map(l => l.id);
      await saveRanking(orderId, linkIds);
      const data = await notifyRanking(orderId);
      if (data.success) toast?.(data.message || 'Le avisamos a tu agente', 'success');
      else toast?.(data.error || 'No pudimos avisar a tu agente', 'error');
    } catch {
      toast?.('Error de conexión', 'error');
    }
    setNotifying(false);
  }

  function handleMoveUp(realIdx) {
    if (realIdx <= 0) return;
    const next = [...links];
    [next[realIdx - 1], next[realIdx]] = [next[realIdx], next[realIdx - 1]];
    setLinks(next);
    doSaveRanking(next);
  }

  function handleMoveDown(realIdx) {
    if (realIdx >= links.length - 1) return;
    const next = [...links];
    [next[realIdx], next[realIdx + 1]] = [next[realIdx + 1], next[realIdx]];
    setLinks(next);
    doSaveRanking(next);
  }

  // --- Visor de imágenes --------------------------------------------------------
  const imagenes = files.filter(esImagen);
  function abrirFotoArchivo(i) {
    setLightbox({ items: imagenes.map(f => ({ src: f.download_url, alt: f.original_name, caption: f.original_name, downloadUrl: f.download_url })), index: i });
  }
  function abrirFotoEmbarcacion(url, titulo) {
    setLightbox({ items: [{ src: url, alt: titulo, caption: titulo }], index: 0 });
  }

  // --- Render -------------------------------------------------------------------
  if (loading) {
    return (
      <div className="pb-12" aria-busy="true" aria-label="Cargando expediente">
        <PageHeader backTo={backTo} backLabel="Expedientes" title={<span className="sr-only">Cargando expediente</span>} />
        <Skeleton.Detail />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="pb-12">
        <PageHeader backTo={backTo} backLabel="Expedientes" title="Expediente" />
        <Card padding="none">
          <ErrorState title="No pudimos cargar este expediente" message="Vuelve a intentarlo en unos segundos. Si sigue fallando, escríbenos." detail={loadError} onRetry={() => { setLoadError(''); setLoading(true); loadDetail(); }} />
        </Card>
      </div>
    );
  }

  const nombre = nombreExpediente(order);
  const etapa = etapaDe(order);
  const etapaInfo = ETAPAS_EXPEDIENTE[etapa - 1];
  const cerrado = esCerrado(order);
  const activeLinks = links.filter(l => l.url);
  const frase = fraseEtapa(order, activeLinks[0]);
  const wa = whatsappExpediente(order);
  const completadas = order.status === 'completed' ? Object.fromEntries(ETAPAS_EXPEDIENTE.map(s => [s.num, null])) : {};

  return (
    <div className="pb-12">
      <PageHeader
        backTo={backTo}
        backLabel="Expedientes"
        eyebrow={[order.order_number, tipoExpediente(order), order.plan_name !== nombre && (order.plan_name || '').toLowerCase() !== tipoExpediente(order).toLowerCase() && order.plan_name].filter(Boolean).join(' · ')}
        title={nombre}
        meta={<StatusBadge kind="expediente" status={order.status} dot />}
        actions={
          <>
            <BotonEnlace href={wa} icon={WhatsAppIcon}>Hablar con el agente</BotonEnlace>
            <Menu label="Más opciones" items={[{ label: 'Guardar como PDF', icon: Printer, onClick: () => window.print() }]} />
          </>
        }
      />

      {cerrado && (
        <Callout tone={order.status === 'expired' ? 'warning' : 'neutral'} title={order.status === 'expired' ? 'Este expediente venció' : 'Este expediente fue cancelado'} className="mb-6">
          {frase}
        </Callout>
      )}

      {/* Arriba: el avance (con los datos del expediente) y, al lado, el agente.
          El ranking va después a todo el ancho: es lo que más espacio necesita. */}
      <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0">
          <Card.Header title="Avance del expediente" description={`Etapa ${etapa} de ${ETAPAS_EXPEDIENTE.length} · ${etapaInfo?.label || ''}`} />
          <Card.Body>
            <ProcessStepper current={etapa} completedAt={completadas} currentNote={!cerrado ? frase : undefined} />
          </Card.Body>
          <Card.Body className="border-t border-line">
            <DescriptionList
              cols={4}
              dense
              items={[
                { label: 'Número', value: <span className="tabular">{order.order_number}</span> },
                { label: 'Tipo', value: tipoExpediente(order) },
                order.plan_name && { label: 'Plan', value: order.plan_name },
                { label: 'Creado', value: <span className="tabular">{fmtDateLarga(order.created_at)}</span> },
                order.requirement_name && order.requirement_name !== nombre && { label: 'Lo que buscas', value: order.requirement_name, full: true },
              ].filter(Boolean)}
            />
          </Card.Body>
        </Card>

        <aside className="min-w-0 space-y-6" aria-label="Tu agente">
          <Card>
            <Card.Header title="Tu agente" />
            <Card.Body>
              {order.agent_name ? (
                <div className="flex items-center gap-3">
                  <Avatar name={order.agent_name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{order.agent_name}</p>
                    {order.agent_phone && <p className="text-13 text-ink-500 tabular">{order.agent_phone}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-500">Todavía no tienes un agente asignado. Mientras tanto, te atiende el equipo de Imporlan.</p>
              )}
              <BotonEnlace href={wa} icon={WhatsAppIcon} block className="mt-4">Escribir por WhatsApp</BotonEnlace>
            </Card.Body>
          </Card>
          {etapa >= 4 && !cerrado && <TarjetaPartner />}
        </aside>
      </div>

      <div className="space-y-6">
        <div className="min-w-0 space-y-6">
          {activeLinks.length > 0 ? (
            <RankingEmbarcaciones
              order={order}
              links={activeLinks}
              saving={saving}
              notifying={notifying}
              onNotify={handleNotify}
              dnd={dnd}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRequestInspection={setInspectionLink}
              onPreviewImage={abrirFotoEmbarcacion}
            />
          ) : (
            <Card padding="none">
              <EmptyState
                icon={Search}
                title={cerrado ? 'Este expediente no tiene embarcaciones' : 'Tu agente está buscando opciones'}
                description={cerrado ? 'No quedaron opciones registradas en este expediente.' : 'Cuando encuentre embarcaciones, aparecen aquí para que las ordenes según tu preferencia.'}
              />
            </Card>
          )}

          <SeccionReportes reports={reports} />
          <SeccionArchivos files={files} onPreview={abrirFotoArchivo} />
        </div>
      </div>

      <Lightbox
        open={!!lightbox}
        items={lightbox?.items || []}
        index={lightbox?.index || 0}
        onIndexChange={(i) => setLightbox(lb => (lb ? { ...lb, index: i } : lb))}
        onClose={() => setLightbox(null)}
      />

      <ModalInspeccion link={inspectionLink} orderNumber={order.order_number} open={!!inspectionLink} onClose={() => setInspectionLink(null)} />
    </div>
  );
}
