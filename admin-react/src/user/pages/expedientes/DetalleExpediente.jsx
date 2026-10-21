import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyOrderDetail, saveRanking, notifyRanking, getMyFiles, getMyReports, getMyPaymentRequests, unchooseLink } from '../../api';
import { useToast } from '../../../shared/components/Toast';
import { useBreadcrumb } from '../../../shared/lib/page-meta';
import { fmtDateLarga } from '../../../shared/lib/format';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { sePuedeElegir, linkElegido, pctPago1Comun } from '../../../shared/lib/importacion';
import { faltanDatosImportacion } from '../../../shared/lib/datos-importacion';
import { PageHeader, Card, StatusBadge, ProcessStepper, Callout, Menu, Avatar, DescriptionList, EmptyState, ErrorState, Skeleton, Lightbox, useConfirm } from '../../../shared/components/UI';
import { Printer, Search, WhatsAppIcon } from '../../../shared/components/Icons';
import RankingEmbarcaciones from './RankingEmbarcaciones';
import SeccionReportes from './SeccionReportes';
import SeccionArchivos from './SeccionArchivos';
import TarjetaPartner from './TarjetaPartner';
import BotonEnlace from './BotonEnlace';
import GuiaEleccion from './GuiaEleccion';
import AsistenteEleccion from './AsistenteEleccion';
import ModalDatos from './ModalDatos';
import TuImportacion from './TuImportacion';
import { nombreExpediente, tipoExpediente, etapaDe, esCerrado, fraseEtapa, whatsappExpediente, esImagen, tituloEmbarcacion } from './lib';

/** Lo que el polling compara para saber si la importación cambió (elección y datos del cliente). */
function firmaImportacion(ord) {
  return JSON.stringify([ord?.eleccion || null, ord?.datos_importacion || null]);
}

/**
 * Detalle de un expediente: avance, agente, ranking de embarcaciones,
 * reportes y archivos. La lógica de ranking (guardar, avisar, polling de
 * 30 s, arrastrar) es la misma de siempre; cambia cómo se ve.
 *
 * Con una lancha elegida (`order.eleccion`) lo primero es «Tu importación»
 * (TuImportacion, con las novedades que compartió el equipo y las fotos y
 * videos que llegan desde Estados Unidos) y el ranking baja plegado como
 * «Otras opciones». Sin elección, el protagonista es elegir: GuiaEleccion +
 * «Elegir esta lancha» en cada tarjeta, que abre AsistenteEleccion (también
 * desde el menú «Elegir con inspección técnica»).
 */
export default function DetalleExpediente({ orderId, backTo = '/expedientes' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { items: [{src, alt, caption, downloadUrl}], index }
  const [asistente, setAsistente] = useState(null); // { link, inspection } mientras el asistente está abierto
  const [modalDatos, setModalDatos] = useState(false); // «Completa tus datos» (elección marcada por el equipo)
  const [otrasAbiertas, setOtrasAbiertas] = useState(false);
  const [loadError, setLoadError] = useState('');
  const dragSrc = useRef(null);
  const pollRef = useRef(null);
  const lastRankingTs = useRef(null);
  const lastEleccion = useRef(null);
  const lastNovedades = useRef(null);
  const rankingRef = useRef(null);

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

  // Los cobros (solicitudes de pago) solo importan cuando hay una lancha
  // elegida: son el plan de pagos de «Tu importación».
  const loadPagos = useCallback(async () => {
    try {
      const data = await getMyPaymentRequests('all');
      setPagos(data?.requests || data?.items || []);
    } catch { /* silencioso: sin cobros se muestra el plan igual */ }
  }, []);

  const loadDetail = useCallback(async () => {
    try {
      const data = await getMyOrderDetail(orderId);
      const ord = data?.order || data?.data || null;
      if (ord) {
        setOrder(ord);
        setLinks(ord.links || []);
        lastRankingTs.current = ord.ranking_updated_at || null;
        lastEleccion.current = firmaImportacion(ord);
        lastNovedades.current = JSON.stringify(ord.novedades || []);
        loadReports(ord);
        if (ord.eleccion) loadPagos();
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
  }, [orderId, toast, loadReports, loadPagos]);

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

  // Polling (30 s): cambios de ranking hechos por el equipo y avances de la
  // importación (hitos que marca el agente, elección registrada por él,
  // novedades que comparte; con una novedad nueva pueden venir fotos).
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getMyOrderDetail(orderId);
        if (data.success && data.order) {
          const newTs = data.order.ranking_updated_at;
          const eleccionJson = firmaImportacion(data.order);
          const novedadesJson = JSON.stringify(data.order.novedades || []);
          const cambioRanking = newTs && newTs !== lastRankingTs.current;
          const cambioEleccion = eleccionJson !== lastEleccion.current;
          const cambioNovedades = novedadesJson !== lastNovedades.current;
          if (!cambioRanking && !cambioEleccion && !cambioNovedades) return;
          lastRankingTs.current = newTs || lastRankingTs.current;
          lastEleccion.current = eleccionJson;
          lastNovedades.current = novedadesJson;
          setOrder(data.order);
          setLinks(data.order.links || []);
          if (cambioRanking) {
            const who = data.order.ranking_author_role === 'admin' ? 'el equipo Imporlan' : data.order.ranking_author_name;
            toast?.(`Ranking actualizado por ${who}`, 'success');
          }
          if (cambioEleccion && data.order.eleccion) loadPagos();
          if (cambioNovedades) loadFiles();
          if ((cambioEleccion && data.order.eleccion) || cambioNovedades) toast?.('Tu importación tiene novedades', 'success');
        }
      } catch { /* silencioso */ }
    }, 30000);
    return () => clearInterval(pollRef.current);
  }, [orderId, toast, loadPagos, loadFiles]);

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

  // --- Elegir la lancha ----------------------------------------------------------
  // El asistente guarda y, con éxito, el detalle se vuelve a pedir: el
  // servidor manda la elección y la etapa nueva; aquí no se calcula nada.
  function handleEleccionGuardada() {
    loadDetail();
  }

  // El cliente completó sus datos desde «Tu importación» (elección marcada
  // por el equipo): el servidor ya los tiene, el detalle se vuelve a pedir.
  function handleDatosGuardados() {
    setModalDatos(false);
    toast?.('Listo: recibimos tus datos y tu cédula', 'success');
    loadDetail();
  }

  async function handleDeshacer() {
    const elegido = linkElegido(order);
    const ok = await confirm({
      title: '¿Deshacer tu elección?',
      description: `${elegido ? tituloEmbarcacion(elegido) : 'La lancha elegida'} vuelve al ranking como una opción más y se lo avisamos a tu agente. Puedes elegir de nuevo cuando quieras.`,
      tone: 'danger',
      confirmLabel: 'Deshacer elección',
    });
    if (!ok) return;
    setDeshaciendo(true);
    try {
      const data = await unchooseLink(orderId);
      if (data?.success) {
        toast?.('Listo, deshicimos tu elección', 'success');
        await loadDetail();
      } else {
        toast?.(data?.error || 'No pudimos deshacer la elección', 'error');
      }
    } catch (e) {
      toast?.(e?.message || 'Error de conexión', 'error');
    }
    setDeshaciendo(false);
  }

  function handleCambiar() {
    setOtrasAbiertas(true);
    // El ranking está más abajo: al abrirlo, se lleva la vista hasta ahí.
    setTimeout(() => rankingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // --- Visor de imágenes --------------------------------------------------------
  const imagenes = files.filter(esImagen);
  // `lista` son archivos del expediente (fotos); `i` el que se abre.
  function abrirFotos(lista, i) {
    setLightbox({ items: lista.map(f => ({ src: f.download_url, alt: f.original_name, caption: f.original_name, downloadUrl: f.download_url })), index: i });
  }
  function abrirFotoArchivo(i) {
    abrirFotos(imagenes, i);
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
  const eleccion = order.eleccion || null;
  const elegido = eleccion ? linkElegido({ ...order, links }) : null;
  const datosPendientes = !cerrado && faltanDatosImportacion(order);
  const frase = fraseEtapa(order, elegido || activeLinks[0]);
  const wa = whatsappExpediente(order);
  const completadas = order.status === 'completed' ? Object.fromEntries(ETAPAS_EXPEDIENTE.map(s => [s.num, null])) : {};

  // Qué lanchas se pueden elegir hoy: con anuncio y disponibles, en un
  // expediente abierto, y si ya hay elección, solo mientras se pueda cambiar.
  const puedeElegir = (l) => !cerrado && sePuedeElegir(l) && (!eleccion || eleccion.client_can_change) && Number(l.id) !== Number(eleccion?.link_id);
  const hayElegibles = activeLinks.some(puedeElegir);
  const otras = eleccion ? activeLinks.filter(l => Number(l.id) !== Number(eleccion.link_id)).length : 0;
  // El % del Pago 1 para la guía: el que comparten las cotizaciones publicadas
  // de las lanchas elegibles (null si no hay ninguna: no se inventa).
  const pctPago1 = pctPago1Comun(activeLinks.filter(puedeElegir));

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

      {eleccion && (
        <TuImportacion
          order={order}
          link={elegido}
          eleccion={eleccion}
          requests={pagos}
          novedades={order.novedades || []}
          files={files}
          datosPendientes={datosPendientes}
          onCompletarDatos={() => setModalDatos(true)}
          onCambiar={handleCambiar}
          onDeshacer={handleDeshacer}
          deshaciendo={deshaciendo}
          onPreviewImage={abrirFotoEmbarcacion}
          onPreviewFiles={abrirFotos}
        />
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
          {!eleccion && !cerrado && hayElegibles && <GuiaEleccion agente={order.agent_name} pct={pctPago1} />}

          {activeLinks.length > 0 ? (
            <RankingEmbarcaciones
              ref={rankingRef}
              order={order}
              links={activeLinks}
              saving={saving}
              notifying={notifying}
              onNotify={handleNotify}
              dnd={dnd}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onElegirConInspeccion={(l) => setAsistente({ link: l, inspection: true })}
              onPreviewImage={abrirFotoEmbarcacion}
              onElegir={(l) => setAsistente({ link: l })}
              puedeElegir={puedeElegir}
              eleccion={eleccion}
              titulo={eleccion ? `Otras opciones (${otras})` : undefined}
              descripcion={eleccion ? (eleccion.client_can_change ? 'Las demás embarcaciones de tu ranking. Puedes cambiar a cualquiera mientras tu agente no haya avanzado.' : 'Las demás embarcaciones de tu ranking, como referencia.') : undefined}
              colapsable={!!eleccion}
              abierto={otrasAbiertas}
              onToggle={setOtrasAbiertas}
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
          <SeccionArchivos id="archivos" files={files} onPreview={abrirFotoArchivo} />
        </div>
      </div>

      <Lightbox
        open={!!lightbox}
        items={lightbox?.items || []}
        index={lightbox?.index || 0}
        onIndexChange={(i) => setLightbox(lb => (lb ? { ...lb, index: i } : lb))}
        onClose={() => setLightbox(null)}
      />

      {/* Se monta solo abierto: cada apertura parte en el paso 1, limpia. */}
      {asistente && (
        <AsistenteEleccion
          open
          link={asistente.link}
          order={order}
          anterior={elegido}
          inspeccionInicial={asistente.inspection ?? true}
          onClose={() => setAsistente(null)}
          onSuccess={handleEleccionGuardada}
        />
      )}

      {modalDatos && (
        <ModalDatos open order={order} onClose={() => setModalDatos(false)} onGuardado={handleDatosGuardados} />
      )}
    </div>
  );
}
