import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyOrderDetail, saveRanking, notifyRanking, getMyFiles, getMyReports, getMyPaymentRequests, getMyInspections, unchooseLink, pedirDevolucion, inspeccionReporte, inspeccionDecision } from '../../api';
import { useToast } from '../../../shared/components/Toast';
import { useBreadcrumb } from '../../../shared/lib/page-meta';
import { fmtDateLarga } from '../../../shared/lib/format';
import { fmtCLP } from '../../../shared/lib/utils';
import { ETAPAS_EXPEDIENTE } from '../../../shared/lib/status';
import { sePuedeElegir, linkElegido, pctPago1Comun, planDePagos, cobrosDelExpediente, pagosConCobros } from '../../../shared/lib/importacion';
import { inspeccionDeclinada, devolucionPedida, reporteInspeccionDe, reporteDe, etapaInspeccion, lanchasDeclinadas } from '../../../shared/lib/inspeccion';
import { faltanDatosImportacion } from '../../../shared/lib/datos-importacion';
import { PageHeader, Card, Button, StatusBadge, ProcessStepper, Callout, Menu, Avatar, DescriptionList, EmptyState, ErrorState, Skeleton, Lightbox, useConfirm } from '../../../shared/components/UI';
import { Printer, Search, WhatsAppIcon, Compass, Ship, FileText, Images, FolderOpen, Calendar, User, CircleCheck } from '../../../shared/components/Icons';
import { ExpedienteHeader, ExpedienteMetrics, ExpedienteNavigation } from '../../../shared/components/ExpedienteWorkspace';
import ReporteEspanol from '../../../shared/components/ReporteEspanol';
import RankingEmbarcaciones from './RankingEmbarcaciones';
import ModalDeclinar from './ModalDeclinar';
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
 *
 * La inspección técnica (etapaInspeccion): con el reporte listo
 * (`eleccion.inspection_report`), se pide el GET del reporte (`reporte`: el
 * original en inglés y la traducción en bloques) y el cliente lo lee en el
 * visor compartido (ReporteEspanol) y decide: aprobar (useConfirm →
 * `inspeccionDecision` → llega el Pago 2) o declinar (ModalDeclinar con
 * motivo → pasa a 'declinada'). Mientras la traducción esté pendiente se
 * sondea cada 15 s. Con la lancha declinada, «Tu importación» ofrece elegir
 * otra (abre «Otras opciones», con las declinadas marcadas y el Pago 1
 * abonado a la nueva) o pedir la devolución (`pedirDevolucion`, con
 * confirmación). Los reportes de inspección antiguos (inspection_reports_api)
 * se piden como respaldo para enlazar el de la lancha elegida.
 */
export default function DetalleExpediente({ orderId, backTo = '/expedientes' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [links, setLinks] = useState([]);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState('');
  const [reports, setReports] = useState([]);
  const [reportsError, setReportsError] = useState('');
  const [pagosError, setPagosError] = useState('');
  const [inspeccionesError, setInspeccionesError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [inspecciones, setInspecciones] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [pidiendoDevolucion, setPidiendoDevolucion] = useState(false);
  const [reporte, setReporte] = useState(null); // GET user_inspeccion_reporte
  const [reporteCargando, setReporteCargando] = useState(false);
  const [reporteError, setReporteError] = useState('');
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [modalDeclinar, setModalDeclinar] = useState(false);
  const [decidiendo, setDecidiendo] = useState(null); // 'aprobar' | 'declinar' | null
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
  const rankingBusy = useRef(false);
  const rankingGeneration = useRef(0);

  useBreadcrumb(order?.order_number ? [order.order_number] : null);

  // Los reportes se filtran por id o por número; se piden apenas llega el
  // expediente (no en un efecto aparte, para no encadenar renders).
  const loadReports = useCallback(async (ord) => {
    try {
      const data = await getMyReports();
      if (!data?.success || !Array.isArray(data.reports)) throw new Error('No pudimos actualizar los informes.');
      const all = data.reports;
      const matchById = (r) => String(r.order_id || r.expediente_id || '') === String(orderId);
      const matchByNumber = (r) => ord?.order_number && (r.order_number === ord.order_number || r.expediente_number === ord.order_number);
      const filtered = all.filter(r => matchById(r) || matchByNumber(r));
      setReports(filtered);
      setReportsError('');
    } catch { setReportsError('No pudimos actualizar los informes.'); }
  }, [orderId]);

  // Los cobros (solicitudes de pago) solo importan cuando hay una lancha
  // elegida: son el plan de pagos de «Tu importación».
  const loadPagos = useCallback(async () => {
    try {
      const data = await getMyPaymentRequests('all');
      const requests = data?.requests || data?.items;
      if (!data?.success || !Array.isArray(requests)) throw new Error('Cobros no disponibles');
      setPagos(requests);
      setPagosError('');
    } catch { setPagosError('No pudimos actualizar el estado de tus pagos. Revisa Pagos antes de realizar una transferencia.'); }
  }, []);

  // Los reportes de inspección del cliente (inspection_reports_api), sólo
  // cuando eligió con inspección: para enlazar el de la lancha elegida.
  const loadInspecciones = useCallback(async () => {
    try {
      const data = await getMyInspections();
      const items = data?.inspections || data?.reports || data?.items;
      if (!data?.success || !Array.isArray(items)) throw new Error('Inspecciones no disponibles');
      setInspecciones(items);
      setInspeccionesError('');
    } catch { setInspeccionesError('No pudimos actualizar el informe de inspección.'); }
  }, []);

  // El reporte de la inspección que cargó el equipo: el original en inglés y
  // la traducción al español en bloques. Sólo cuando existe (404 si no).
  const loadReporte = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setReporteCargando(true);
    try {
      const data = await inspeccionReporte(orderId);
      if (data?.success) { setReporte(data); setReporteError(''); }
    } catch (e) {
      if (e?.status === 404) setReporte(null);
      else setReporteError(e?.message || 'No pudimos cargar el reporte');
    }
    setReporteCargando(false);
  }, [orderId]);

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
        if (ord.eleccion?.inspection) loadInspecciones();
        if (reporteDe(ord.eleccion)) loadReporte(); else setReporte(null);
        // Con la lancha declinada, lo que sigue es elegir otra: el ranking
        // parte desplegado.
        if (inspeccionDeclinada(ord.eleccion) && !devolucionPedida(ord.eleccion)) setOtrasAbiertas(true);
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
  }, [orderId, toast, loadReports, loadPagos, loadInspecciones, loadReporte]);

  const loadFiles = useCallback(async (background = false) => {
    if (background !== true) setFilesLoading(true);
    setFilesError('');
    try {
      const data = await getMyFiles(orderId);
      if (!data.success || !Array.isArray(data.files)) throw new Error(data.error || 'La respuesta de archivos no está disponible.');
      setFiles(data.files);
    } catch (error) { setFilesError(error.message || 'No pudimos actualizar los archivos.'); }
    finally { setFilesLoading(false); }
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
    let polling = false;
    let disposed = false;
    pollRef.current = setInterval(async () => {
      if (polling || rankingBusy.current) return;
      polling = true;
      const generation = rankingGeneration.current;
      try {
        const data = await getMyOrderDetail(orderId);
        if (!data.success || !data.order) throw new Error('Expediente no disponible');
        // Una lectura iniciada antes de ordenar no puede deshacer el ranking local.
        if (disposed || rankingBusy.current || generation !== rankingGeneration.current) return;
        const ord = data.order;
        const cambioRanking = ord.ranking_updated_at && ord.ranking_updated_at !== lastRankingTs.current;
        const cambioEleccion = firmaImportacion(ord) !== lastEleccion.current;
        const cambioNovedades = JSON.stringify(ord.novedades || []) !== lastNovedades.current;
        lastRankingTs.current = ord.ranking_updated_at || null;
        lastEleccion.current = firmaImportacion(ord);
        lastNovedades.current = JSON.stringify(ord.novedades || []);
        // También cambian cotizaciones, precios, disponibilidad y etapa sin tocar el ranking.
        setOrder(ord);
        setLinks(ord.links || []);
        setSyncError('');
        if (cambioRanking && ord.ranking_author_role !== 'user') {
          toast?.('El equipo actualizó tu ranking', 'success');
        }
        if (ord.eleccion) loadPagos();
        if (ord.eleccion?.inspection) loadInspecciones();
        if (cambioEleccion) { if (reporteDe(ord.eleccion)) loadReporte({ silencioso: true }); else setReporte(null); }
        loadReports(ord);
        loadFiles(true);
        if ((cambioEleccion && ord.eleccion) || cambioNovedades) toast?.('Tu importación tiene novedades', 'success');
      } catch {
        if (!disposed) setSyncError('No pudimos actualizar el expediente. Mostramos la última información recibida y volveremos a intentarlo.');
      } finally { polling = false; }
    }, 30000);
    return () => { disposed = true; clearInterval(pollRef.current); };
  }, [orderId, toast, loadPagos, loadFiles, loadInspecciones, loadReports, loadReporte]);

  // La traducción al español tarda de 1 a 5 minutos: mientras siga pendiente
  // se pregunta por el reporte cada 15 s, y cuando llega (o falla) se vuelve
  // a pedir el detalle para que la elección diga lo mismo.
  const traduccionPendiente = reporteDe(order?.eleccion)?.es_status === 'pendiente' || reporte?.es?.status === 'pendiente';
  useEffect(() => {
    if (!traduccionPendiente) return undefined;
    const t = setInterval(async () => {
      try {
        const data = await inspeccionReporte(orderId);
        if (!data?.success) return;
        setReporte(data);
        if (data.es?.status && data.es.status !== 'pendiente') loadDetail();
      } catch { /* silencioso: se vuelve a intentar en 15 s */ }
    }, 15000);
    return () => clearInterval(t);
  }, [traduccionPendiente, orderId, loadDetail]);

  // --- Ranking: arrastrar, flechas, guardar, avisar ---------------------------
  async function doSaveRanking(currentLinks) {
    if (rankingBusy.current) return false;
    rankingBusy.current = true;
    rankingGeneration.current++;
    const previous = links;
    setSaving(true);
    try {
      const data = await saveRanking(orderId, currentLinks.map(l => l.id));
      if (!data.success) throw new Error(data.error || 'No pudimos guardar el ranking');
      // El servidor es el reloj: no inventar una fecha desde el navegador.
      if (data.ranking_updated_at) lastRankingTs.current = data.ranking_updated_at;
      setOrder(prev => ({ ...prev, ranking_updated_at: data.ranking_updated_at || prev.ranking_updated_at, ranking_author_name: data.ranking_author_name, ranking_author_role: data.ranking_author_role }));
      toast?.('Ranking guardado', 'success');
      return true;
    } catch (e) {
      setLinks(previous);
      toast?.(`${e.message || 'Error de conexión'}. Restablecimos el orden anterior.`, 'error');
      return false;
    } finally {
      rankingBusy.current = false;
      setSaving(false);
    }
  }

  function dnd(idx) {
    return {
      onDragStart: (e) => { dragSrc.current = idx; e.dataTransfer.effectAllowed = 'move'; },
      onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
      onDrop: (e) => {
        e.preventDefault();
        if (rankingBusy.current || dragSrc.current === null || dragSrc.current === idx) return;
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
    if (rankingBusy.current || notifying) return;
    setNotifying(true);
    try {
      if (!(await doSaveRanking(links))) return;
      const data = await notifyRanking(orderId);
      if (data.success) toast?.(data.message || 'Le avisamos a tu agente', 'success');
      else toast?.(data.error || 'No pudimos avisar a tu agente', 'error');
    } catch {
      toast?.('Error de conexión', 'error');
    }
    finally { setNotifying(false); }
  }

  function handleMoveUp(realIdx) {
    if (rankingBusy.current || realIdx <= 0) return;
    const next = [...links];
    [next[realIdx - 1], next[realIdx]] = [next[realIdx], next[realIdx - 1]];
    setLinks(next);
    doSaveRanking(next);
  }

  function handleMoveDown(realIdx) {
    if (rankingBusy.current || realIdx >= links.length - 1) return;
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

  // Inspección no apta: en vez de elegir otra lancha, el cliente prefiere la
  // devolución del Pago 1. Se confirma antes (se descuentan los costos de
  // terceros ya incurridos, y después ya no puede elegir otra).
  async function handlePedirDevolucion(pago1) {
    const pagado = pago1?.estado === 'pagado';
    const monto = pagado ? Number(pago1.cobro?.amount_clp || pago1.clp) : 0;
    const ok = await confirm({
      title: '¿Pedir la devolución del Pago 1?',
      description: pagado
        ? `Te devolvemos los ${fmtCLP(monto)} del Pago 1 descontando los costos de terceros ya incurridos, como la inspección (Términos, cláusula 5). Te contactamos para coordinarla.`
        : 'Tu Pago 1 no está pagado: anulamos el cobro pendiente y no hay nada que devolver.',
      detail: ['Después no podrás elegir otra lancha en este expediente.', 'Si prefieres seguir buscando, elige otra lancha: tu Pago 1 se abona a la nueva.'],
      confirmLabel: 'Pedir la devolución',
      cancelLabel: 'Volver',
    });
    if (!ok) return;
    setPidiendoDevolucion(true);
    try {
      const data = await pedirDevolucion(orderId);
      if (data?.success) {
        toast?.('Listo: pediste la devolución. Te contactamos para coordinarla.', 'success');
        await loadDetail();
      } else {
        toast?.(data?.error || 'No pudimos registrar tu solicitud', 'error');
      }
    } catch (e) {
      toast?.(e?.message || 'Error de conexión', 'error');
    }
    setPidiendoDevolucion(false);
  }

  // --- El reporte de la inspección: leerlo y decidir ------------------------------
  function abrirReporte() {
    setVisorAbierto(true);
    if (!reporte && !reporteCargando) loadReporte();
  }

  // Aprobar: se confirma (llega el Pago 2 y se cierra la compra a su nombre)
  // y el servidor marca el hito «Inspección técnica aprobada» por el cliente.
  async function handleAprobar(titulo, pago2) {
    const ok = await confirm({
      title: '¿Apruebas la inspección y seguimos con la compra?',
      description: `Con tu aprobación cerramos la compra de ${titulo} con el vendedor, a tu nombre.${pago2 ? ` Te llega el Pago 2 (${fmtCLP(pago2.clp)} · ${pago2.pct}%) para pagarlo cuando puedas.` : ' Te llega el Pago 2 para pagarlo cuando puedas.'}`,
      detail: ['Es tu decisión y no hay apuro.', 'Si algo del reporte no te cierra, escríbele a tu agente antes de aprobar.'],
      confirmLabel: 'Sí, apruebo y sigamos',
      cancelLabel: 'Volver',
      icon: CircleCheck,
    });
    if (!ok) return;
    setDecidiendo('aprobar');
    try {
      const data = await inspeccionDecision(orderId, 'aprobar');
      if (data?.success) {
        setVisorAbierto(false);
        toast?.(data.pago ? `Listo: aprobaste la inspección. Te llegó el Pago 2 (${fmtCLP(data.pago.amount_clp)}).` : 'Listo: aprobaste la inspección. Seguimos con la compra.', 'success');
        await loadDetail();
      } else {
        toast?.(data?.error || 'No pudimos guardar tu decisión', 'error');
      }
    } catch (e) {
      toast?.(e?.message || 'Error de conexión', 'error');
    }
    setDecidiendo(null);
  }

  // Declinar: el modal pide un motivo opcional y explica los dos caminos que
  // vienen (otra lancha con el Pago 1 abonado, o la devolución).
  async function confirmarDeclinar(motivo) {
    setDecidiendo('declinar');
    try {
      const data = await inspeccionDecision(orderId, 'declinar', motivo);
      if (data?.success) {
        setModalDeclinar(false);
        setVisorAbierto(false);
        toast?.('Listo: no sigues con esta lancha. Ahora elige otra o pide la devolución.', 'success');
        await loadDetail();
      } else {
        toast?.(data?.error || 'No pudimos guardar tu decisión', 'error');
      }
    } catch (e) {
      toast?.(e?.message || 'Error de conexión', 'error');
    }
    setDecidiendo(null);
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

  // Lancha declinada tras la inspección: queda descartada; el cliente elige
  // otra (su Pago 1 pagado se abona a la nueva) o pide la devolución.
  const noApta = inspeccionDeclinada(eleccion);
  const devolucion = devolucionPedida(eleccion);
  const etapaInsp = etapaInspeccion(eleccion);
  const pagosElegida = elegido ? pagosConCobros(planDePagos(elegido), cobrosDelExpediente(pagos, order.id)) : null;
  const pago1Elegida = pagosElegida?.pagos.find(p => p.n === 1) || null;
  const pago2Elegida = pagosElegida?.pagos.find(p => p.n === 2) || null;
  const pago1Abonado = noApta && pago1Elegida?.estado === 'pagado';
  const tituloElegida = elegido ? tituloEmbarcacion(elegido) : (eleccion?.title || 'la lancha elegida');
  const reporteInspeccion = eleccion?.inspection ? reporteInspeccionDe(inspecciones, elegido, order) : null;
  const hayReporteEs = !!reporteDe(eleccion);
  // Las que ya declinó (declined_link_ids y la elegida si la acaba de
  // declinar): marcadas y sin «Cambiar a esta lancha». El servidor responde 409.
  const declinadas = lanchasDeclinadas(order);

  // Qué lanchas se pueden elegir hoy: con anuncio y disponibles, en un
  // expediente abierto, y si ya hay elección, solo mientras se pueda cambiar
  // (y nunca una que ya declinó tras la inspección).
  const puedeElegir = (l) => !cerrado && sePuedeElegir(l) && (!eleccion || eleccion.client_can_change) && Number(l.id) !== Number(eleccion?.link_id) && !declinadas.includes(Number(l.id));
  const hayElegibles = activeLinks.some(puedeElegir);
  const otras = eleccion ? activeLinks.filter(l => Number(l.id) !== Number(eleccion.link_id)).length : 0;
  let tituloOtras;
  let descripcionOtras;
  if (eleccion && noApta && !devolucion) {
    tituloOtras = `Elige otra lancha (${otras})`;
    descripcionOtras = otras > 0
      ? `Las demás embarcaciones de tu ranking. Elige con cuál seguir: ${pago1Abonado ? 'tu Pago 1 se abona a la que elijas' : 'con ella partimos de cero'}.`
      : 'No quedan otras embarcaciones en tu ranking. Escríbele a tu agente para sumar opciones, o pide la devolución.';
  } else if (eleccion) {
    tituloOtras = `Otras opciones (${otras})`;
    descripcionOtras = eleccion.client_can_change && !devolucion ? 'Las demás embarcaciones de tu ranking. Puedes cambiar a cualquiera mientras tu agente no haya avanzado.' : 'Las demás embarcaciones de tu ranking, como referencia.';
  }
  // El % del Pago 1 para la guía: el que comparten las cotizaciones publicadas
  // de las lanchas elegibles (null si no hay ninguna: no se inventa).
  const pctPago1 = pctPago1Comun(activeLinks.filter(puedeElegir));

  return (
    <div className="exp-workspace pb-12">
      <ExpedienteHeader
        backTo={backTo}
        backLabel="Expedientes"
        image={elegido?.image_url || eleccion?.image_url}
        imageLabel={eleccion ? 'Tu embarcación' : undefined}
        description={frase}
        eyebrow={[order.order_number, tipoExpediente(order), order.plan_name !== nombre && (order.plan_name || '').toLowerCase() !== tipoExpediente(order).toLowerCase() && order.plan_name].filter(Boolean).join(' · ')}
        title={nombre}
        meta={<StatusBadge kind="expediente" status={order.status} dot />}
        actions={
          <>
            <BotonEnlace href={wa} icon={WhatsAppIcon}>Hablar con el agente</BotonEnlace>
            <Menu label="Más opciones" items={[{ label: 'Guardar como PDF', icon: Printer, onClick: () => window.print() }]} />
          </>
        }
      >
        <div className="exp-header__meta"><span><Calendar size={15} />{fmtDateLarga(order.created_at)}</span><span><User size={15} />{order.agent_name || 'Equipo Imporlan'}</span></div>
      </ExpedienteHeader>
      <ExpedienteMetrics items={[
        { label: 'Etapa actual', value: `${String(etapa).padStart(2, '0')} / ${String(ETAPAS_EXPEDIENTE.length).padStart(2, '0')}`, hint: etapaInfo?.label, icon: Compass },
        { label: 'Embarcaciones', value: activeLinks.length, hint: 'Opciones de tu expediente', icon: Ship },
        { label: 'Documentos', value: filesLoading || filesError || reportsError ? '—' : files.filter(f => f.category === 'document').length + reports.length, hint: 'Informes y documentos disponibles', icon: FileText },
        { label: 'Fotos y videos', value: filesLoading || filesError ? '—' : files.filter(f => f.category === 'image' || f.category === 'video').length, hint: 'Material compartido contigo', icon: Images },
      ]} />
      <ExpedienteNavigation sections={[
        ...(eleccion ? [{ id: 'mi-importacion', label: 'Tu importación', icon: Ship }] : []),
        { id: 'avance', label: 'Avance', icon: Compass },
        ...(activeLinks.length ? [{ id: 'opciones-cliente', label: 'Opciones', icon: Search, count: activeLinks.length }] : []),
        ...(reports.length ? [{ id: 'reportes-cliente', label: 'Informes', icon: FileText, count: reports.length }] : []),
        { id: 'archivos', label: 'Archivos', icon: FolderOpen, count: filesLoading || filesError ? undefined : files.length },
      ]} />

      {(syncError || reportsError || pagosError || inspeccionesError) && (
        <Callout tone="warning" title="Hay información pendiente de actualizar" className="mb-6">
          <div className="space-y-2" role="status">
            {syncError && <p>{syncError}</p>}
            {reportsError && <p>{reportsError} <Button variant="ghost" size="sm" onClick={() => loadReports(order)}>Reintentar informes</Button></p>}
            {pagosError && <p>{pagosError} <Button variant="ghost" size="sm" onClick={loadPagos}>Reintentar pagos</Button></p>}
            {inspeccionesError && <p>{inspeccionesError} <Button variant="ghost" size="sm" onClick={loadInspecciones}>Reintentar inspección</Button></p>}
          </div>
        </Callout>
      )}

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
          reporteInspeccion={reporteInspeccion}
          reporte={reporte}
          onCompletarDatos={() => setModalDatos(true)}
          onCambiar={handleCambiar}
          onDeshacer={handleDeshacer}
          deshaciendo={deshaciendo}
          onElegirOtra={handleCambiar}
          onPedirDevolucion={() => handlePedirDevolucion(pago1Elegida)}
          pidiendoDevolucion={pidiendoDevolucion}
          onLeerReporte={hayReporteEs ? abrirReporte : undefined}
          onAprobar={() => handleAprobar(tituloElegida, pago2Elegida)}
          onDeclinar={() => setModalDeclinar(true)}
          decidiendo={decidiendo}
          onPreviewImage={abrirFotoEmbarcacion}
          onPreviewFiles={abrirFotos}
        />
      )}

      {/* Arriba: el avance (con los datos del expediente) y, al lado, el agente.
          El ranking va después a todo el ancho: es lo que más espacio necesita. */}
      <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card id="avance" className="exp-section min-w-0">
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
          <Card className="exp-section">
            <Card.Header title="Tu equipo de apoyo" description="Tu contacto para avanzar con tranquilidad." />
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

          <div id="opciones-cliente">{activeLinks.length > 0 ? (
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
              declinadasIds={declinadas}
              titulo={tituloOtras}
              descripcion={descripcionOtras}
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
          )}</div>

          <SeccionReportes
            reports={reports}
            inspeccion={hayReporteEs && (etapaInsp === 'aprobada' || etapaInsp === 'declinada') ? {
              titulo: tituloElegida,
              at: reporteDe(eleccion).at,
              es_status: reporte?.es?.status || reporteDe(eleccion).es_status,
              original: reporte?.original || null,
              onLeer: abrirReporte,
            } : null}
          />
          <SeccionArchivos id="archivos" files={files} onPreview={abrirFotoArchivo} loading={filesLoading} error={filesError} onRefresh={loadFiles} />
        </div>
      </div>

      {/* El reporte en español (visor compartido con el admin). Con el reporte
          listo, el pie lleva la decisión; después, sólo cerrar. */}
      <ReporteEspanol
        open={visorAbierto}
        onClose={() => setVisorAbierto(false)}
        data={reporte}
        loading={reporteCargando}
        error={reporteError || null}
        onRetry={() => loadReporte()}
        footer={etapaInsp === 'reporte_listo' ? (
          <>
            <Button variant="secondary" onClick={() => setModalDeclinar(true)} disabled={decidiendo === 'aprobar'} loading={decidiendo === 'declinar'} className="w-full sm:w-auto">No quiero seguir con esta lancha</Button>
            <Button icon={CircleCheck} onClick={() => handleAprobar(tituloElegida, pago2Elegida)} loading={decidiendo === 'aprobar'} disabled={decidiendo === 'declinar'} className="w-full sm:w-auto">Apruebo, sigamos con la compra</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setVisorAbierto(false)}>Cerrar</Button>
        )}
      />

      {/* Se monta solo abierto: cada vez parte con el motivo en blanco. */}
      {modalDeclinar && (
        <ModalDeclinar
          open
          titulo={tituloElegida}
          pago1={pago1Elegida}
          loading={decidiendo === 'declinar'}
          onClose={() => setModalDeclinar(false)}
          onConfirmar={confirmarDeclinar}
        />
      )}

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
          anteriorNoApta={noApta}
          pago1Abonado={pago1Abonado}
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
