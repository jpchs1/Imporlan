import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getOrders, getOrderDetail, updateOrder, createOrder, deleteOrder as apiDeleteOrder, addOrderLink, deleteOrderLink, updateOrderLinks, reorderOrderLinks, rescrapeOrderLink, changeOrderStatus, sendClientUpdate, notifyRanking, uploadLinkImage } from '../api';
import { useAuth } from '../../shared/context/AuthContext';
import { useConfirm } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { useBreadcrumb } from '../../shared/lib/page-meta';
import { enviarDesglose } from '../desglose';
import { FILTROS_VACIOS, AGENTE_POR_DEFECTO } from './orders/constantes';
import ListaExpedientes from './orders/ListaExpedientes';
import DetalleExpediente from './orders/DetalleExpediente';

/**
 * Expedientes (admin). Este archivo es el contenedor: tiene TODO el estado y
 * la lógica de negocio (scraping, cola, guardado, drag, cotización). Las
 * pantallas viven en ./orders/ (`ListaExpedientes`, `DetalleExpediente`,
 * `BarraAcciones`, `FormularioExpediente`, `ModalNuevoExpediente`): sólo
 * pintan y llaman a los handlers que reciben por props.
 *
 * La lógica se queda aquí y no en ./orders/index.jsx porque
 * test/cotizador-desglose-tests.php lee este archivo (handleEnviarDesglose,
 * onBreakdownSent={marcarDesgloseEnviado}).
 */
export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [conteos, setConteos] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | detail
  const [detail, setDetail] = useState(null);
  const [links, setLinks] = useState([]);
  const [unsaved, setUnsaved] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [cotizandoLink, setCotizandoLink] = useState(null);

  // Filters
  const [filters, setFilters] = useState(FILTROS_VACIOS);
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // Form fields for detail
  const [form, setForm] = useState({});

  // Estado del botón "Rescrapear expediente"
  const [rescraping, setRescraping] = useState(false);
  const [rescrapeProgress, setRescrapeProgress] = useState('');
  // Aviso persistente cuando al servidor le falta el módulo de scraping (F13:
  // antes iba en un alert() con instrucciones de cPanel).
  const [scraperFaltante, setScraperFaltante] = useState(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    customer_email: '', customer_name: '', customer_phone: '', service_type: 'plan_busqueda',
    plan_name: '', asset_name: '', type_zone: '', agent_name: AGENTE_POR_DEFECTO,
  });

  // Drag state
  const dragIdx = useRef(null);
  const linksContainerRef = useRef(null);

  useBreadcrumb(view === 'detail' && detail ? [detail.order_number] : null);

  // Los avisos internos enlazan a #/orders?new=ID (o ?id=ID): abrir ese expediente.
  const location = useLocation();
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const target = qs.get('id') || qs.get('new');
    loadOrders().then(list => {
      if (!target) return;
      // ?new= trae el número de expediente (IMP-…); ?id= el id interno.
      const hit = /^\d+$/.test(target)
        ? { id: Number(target) }
        : list.find(o => String(o.order_number) === target);
      if (hit?.id) openDetail(hit.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Los filtros se aplican al cambiar (300 ms de espera para lo que se escribe),
  // sin botón "Filtrar". La consulta sigue siendo getOrders(filters) al servidor.
  const filtrosPrevios = useRef(JSON.stringify(FILTROS_VACIOS));
  useEffect(() => {
    const key = JSON.stringify(filters);
    if (key === filtrosPrevios.current) return;
    filtrosPrevios.current = key;
    const t = setTimeout(() => { loadOrders(filters); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function contar(list) {
    const c = { '': list.length };
    list.forEach(o => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }

  async function loadOrders(f = filtersRef.current) {
    setLoading(true);
    let list = [];
    try {
      const res = await getOrders(f);
      list = res.orders || res.items || [];
      setOrders(list);
      // Conteo por estado para los chips: con el estado filtrado, se pide la
      // misma consulta sin estado para que los números no sean los del filtro.
      if (!f.status) setConteos(contar(list));
      else getOrders({ ...f, status: '' }).then(r => setConteos(contar(r.orders || r.items || []))).catch(() => {});
    } catch (e) { toast?.('No se pudieron cargar los expedientes: ' + (e.message || ''), 'error'); }
    setLoading(false);
    return list;
  }

  async function openDetail(orderId) {
    setLoading(true);
    try {
      const o = await getOrderDetail(orderId);
      const order = o.order || o;
      setDetail(order);
      setLinks(JSON.parse(JSON.stringify(order.links || [])));
      setForm({
        customer_phone: order.customer_phone || '',
        service_type: order.service_type || 'plan_busqueda',
        origin: order.origin || 'web',
        plan_name: order.plan_name || '',
        asset_name: order.asset_name || '',
        type_zone: order.type_zone || '',
        requirement_name: order.requirement_name || '',
        agent_name: order.agent_name || '',
        agent_phone: order.agent_phone || '',
        admin_notes: order.admin_notes || '',
        visible_to_client: order.visible_to_client == 1,
      });
      setUnsaved(false);
      setScraperFaltante(null);
      setView('detail');
    } catch (e) { toast?.('Error cargando expediente: ' + (e.message || ''), 'error'); }
    setLoading(false);
  }

  async function goBack() {
    if (unsaved && !(await confirm({
      title: 'Hay cambios sin guardar',
      description: '¿Salir igual? Lo que editaste en este expediente se perderá.',
      tone: 'warning',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando',
    }))) return;
    setUnsaved(false);
    setView('list'); setDetail(null); loadOrders();
  }

  // ---- SAVE ALL ----
  async function handleSaveAll() {
    if (!detail) return;
    setSaving(true);
    try {
      await updateOrder({ id: detail.id, ...form, visible_to_client: form.visible_to_client ? 1 : 0 });
      await updateOrderLinks(detail.id, links);
      setUnsaved(false);
      toast?.('Expediente guardado correctamente');
      const o = await getOrderDetail(detail.id);
      const order = o.order || o;
      setDetail(order);
      setLinks(JSON.parse(JSON.stringify(order.links || [])));
    } catch (e) { toast?.(e.message || 'Error guardando', 'error'); }
    setSaving(false);
  }

  // ---- STATUS CHANGE ----
  async function handleStatusChange() {
    if (!detail || !newStatus) return;
    try {
      const r = await changeOrderStatus({ id: detail.id, status: newStatus });
      if (r?.email_sent === false || r?.email_error) toast?.('Estado actualizado, pero no se pudo enviar el correo al cliente' + (r.email_error ? `: ${r.email_error}` : ''), 'warning');
      else toast?.('Estado actualizado');
      setShowStatusModal(false);
      const o = await getOrderDetail(detail.id);
      setDetail(o.order || o);
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- SEND CLIENT UPDATE ----
  async function handleSendClient() {
    if (!(await confirm({
      title: '¿Enviar una actualización al cliente?',
      description: `Se manda un correo de actualización a ${detail.customer_email || 'el cliente'}.`,
      confirmLabel: 'Enviar correo',
    }))) return;
    try {
      await sendClientUpdate(detail.id);
      toast?.('Notificación enviada al cliente');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- NOTIFY RANKING ----
  async function handleNotifyRanking() {
    if (!(await confirm({
      title: '¿Enviar el ranking por correo?',
      description: `Se le manda el ranking de opciones a ${detail.customer_email || 'el cliente'}.`,
      confirmLabel: 'Enviar ranking',
    }))) return;
    try {
      await notifyRanking(detail.id, user?.name || 'Admin');
      toast?.('Ranking notificado al cliente');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- TIMELINE ----
  async function handleTimelineStep(dir) {
    const step = (detail.timeline_step || 1) + dir;
    if (step < 1 || step > 5) return;
    try {
      await updateOrder({ id: detail.id, timeline_step: step });
      setDetail({ ...detail, timeline_step: step });
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- ADD LINK ----
  // Adding a row used to do a full refetch which silently discarded any
  // unsaved local edits (scrape data the admin hadn't hit Save on yet).
  // Persist current edits first, then append the new empty row to the
  // local state without re-fetching — no flicker, no data loss.
  // Tras encolar una fila hay que releer el expediente: el estado "en cola" lo
  // guarda el servidor, y sin refrescar, la tarjeta seguiria mostrando el aviso
  // viejo como si no hubiera pasado nada.
  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!unsaved) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [unsaved]);

  const linksRef = useRef(links);
  useEffect(() => { linksRef.current = links; }, [links]);

  // Tras enviar el desglose se marca sólo esa fila. No se relee el expediente:
  // el envío puede tardar y, si mientras tanto se editó otra cosa, releer la
  // pisaría (Devin y Codex, PR 668). Guardar los links no escribe esta columna.
  function marcarDesgloseEnviado(linkId, sentAt) {
    const marcar = l => (l.id === linkId ? { ...l, quote_breakdown_sent_at: sentAt } : l);
    setLinks(prev => prev.map(marcar));
    setDetail(prev => (prev ? { ...prev, links: (prev.links || []).map(marcar) } : prev));
  }

  async function handleEnviarDesglose(lk) {
    try {
      const enviado = await enviarDesglose(lk.id);
      if (!enviado) return;
      toast?.(`Desglose enviado a ${enviado.email}`, 'success');
      marcarDesgloseEnviado(lk.id, enviado.sentAt);
    } catch (e) {
      toast?.(e.message || 'Error al enviar el desglose', 'error');
    }
  }

  const refrescarDetalle = useCallback(async () => {
    if (!detail?.id) return;
    try {
      const o = await getOrderDetail(detail.id);
      const orden = o.order || o;
      setDetail(orden);
      setLinks(JSON.parse(JSON.stringify(orden.links || [])));
    } catch { /* si falla, la proxima recarga lo muestra */ }
  }, [detail?.id]);

  // Mientras haya filas leyendose en segundo plano, releer el expediente cada
  // diez segundos. Sin esto el aviso azul se queda puesto para siempre aunque el
  // worker ya haya terminado, porque el panel solo conoce el estado del momento
  // en que se abrio la pantalla.
  useEffect(() => {
    const hayEnCola = links.some(l => l.scrape_state === 'en_cola' || l.scrape_state === 'procesando');
    // Con cambios sin guardar no se relee: pisaría lo que el admin está editando.
    if (!hayEnCola || !detail?.id || unsaved) return;
    const id = setInterval(refrescarDetalle, 10000);
    return () => clearInterval(id);
  }, [links, detail?.id, unsaved, refrescarDetalle]);

  // Rescrapea el expediente fila por fila. Los links pegados a mano nunca
  // pasaban por el scraper del servidor, asi que este boton es la via para
  // recuperar imagen, titulo y ficha de un expediente ya armado.
  //
  // Se hace una peticion por fila a proposito: con Plan B (ScrapingBee +
  // Vision) un solo link puede tardar minutos, y una peticion que las procese
  // todas juntas la corta el servidor web antes de terminar.
  async function handleRescrapeLinks() {
    if (!detail || rescraping) return;
    const pend = links.filter(l => (l.url || '').trim());
    if (!pend.length) {
      await confirm({ title: 'Este expediente no tiene links con URL.', description: 'Pega al menos un link en el ranking para poder leerlo.', cancelLabel: null, confirmLabel: 'Entendido', tone: 'info' });
      return;
    }

    // BoatTrader, boats.com y YachtWorld estan detras de Cloudflare y solo se
    // pueden pedir en el modo mas caro de ScrapingBee: 75 creditos por link,
    // medido. Un expediente de seis lanchas cuesta 450 creditos por click, y
    // este boton no daba ninguna senal de eso. El servidor cachea seis horas,
    // asi que repetirlo el mismo dia no vuelve a cobrar.
    const caros = pend.filter(l => /yachtworld\.|boattrader\.com|boats\.com|boatsgroup\.com/i.test(l.url || '')).length;
    const aviso = caros
      ? [
        `${caros} de ellos ${caros === 1 ? 'es' : 'son'} de sitios con Cloudflare y ${caros === 1 ? 'cuesta' : 'cuestan'} ~75 créditos de ScrapingBee cada uno (~${caros * 75} en total).`,
        'Si ya los rescrapeaste hoy, salen del caché y no cobran.',
      ]
      : undefined;
    if (!(await confirm({
      title: `¿Rescrapear ${pend.length} link${pend.length === 1 ? '' : 's'}?`,
      description: 'Cada uno puede tardar hasta un minuto. Se vuelven a extraer imagen, título y ficha desde el anuncio.',
      detail: aviso,
      tone: caros ? 'warning' : 'primary',
      confirmLabel: 'Rescrapear',
    }))) return;

    setRescraping(true);
    let updated = 0, withImage = 0, failed = 0, partial = 0, noScraper = 0, queued = 0;
    try {
      // El servidor lee las URLs de la base: lo escrito sin guardar se guarda antes.
      if (unsaved) {
        await updateOrderLinks(detail.id, links);
        setUnsaved(false);
      }
      for (let i = 0; i < pend.length; i++) {
        setRescrapeProgress(`${i + 1} de ${pend.length}`);
        try {
          const res = await rescrapeOrderLink(detail.id, pend[i].row_index ?? (i + 1));
          const r = (res.results || [])[0];
          if (r?.image) withImage++;
          if (r?.status === 'updated') updated++;
          // Sin el modulo de scraping el servidor igual deduce año, marca y
          // modelo desde la URL: eso no es un fallo, es un resultado parcial.
          else if (r?.status === 'partial_no_scraper') partial++;
          else if (r?.status === 'no_scraper') noScraper++;
          // Los sitios lentos quedan en cola y se completan solos en segundo plano.
          else if (r?.status === 'en_cola') queued++;
          else if (r && r.status !== 'no_data') failed++;
        } catch {
          failed++;
        }
      }
      const o = await getOrderDetail(detail.id);
      const orden = o.order || o;
      setDetail(orden);
      setLinks(JSON.parse(JSON.stringify(orden.links || [])));
      const parts = [`${updated} de ${pend.length} link(s) actualizados, ${withImage} con imagen.`];
      if (queued) parts.push(`${queued} quedaron en cola y se completan solos en unos minutos.`);
      if (partial || noScraper) {
        parts.push('Falta el módulo de lectura en el servidor (ver aviso en el ranking).');
        setScraperFaltante(
          'Falta api/link_scraper.php en el servidor (el antivirus del hosting lo pone en cuarentena).' +
          (partial ? ` Se guardaron año, marca y modelo de ${partial} link(s) desde la URL, pero no las imágenes.` : '') +
          '\nRestáuralo desde cPanel > ImunifyAV > Cuarentena y márcalo como falso positivo.'
        );
      }
      if (failed) parts.push(`${failed} fallaron; revisa los créditos de ScrapingBee.`);
      await confirm({ title: 'Rescrape terminado', detail: parts, cancelLabel: null, confirmLabel: 'Entendido', tone: failed || partial || noScraper ? 'warning' : 'info' });
    } finally {
      setRescraping(false);
      setRescrapeProgress('');
    }
  }

  async function handleAddLink() {
    if (!detail) return;
    try {
      if (unsaved) {
        await updateOrderLinks(detail.id, links);
        setUnsaved(false);
      }
      const res = await addOrderLink(detail.id);
      const newLink = {
        id: res?.link_id,
        order_id: detail.id,
        row_index: res?.row_index ?? (links.length + 1),
        url: '', title: '', image_url: '',
        location: '', hours: null,
        value_usa_usd: null, value_to_negotiate_usd: null,
        value_chile_clp: null, value_chile_negotiated_clp: null,
        selection_order: null, comments: '',
        engine: '', make: '', model: '', year: null,
      };
      setLinks(prev => [...prev, newLink]);
      toast?.(`Fila agregada (#${newLink.row_index})`);
      // Scroll the new row into view at the bottom of the page-level scroll
      // (no more internal max-height container) so the admin actually sees
      // the row that was added — but with `block: 'nearest'` so context
      // above stays visible too.
      setTimeout(() => {
        const c = linksContainerRef.current;
        const last = c?.lastElementChild;
        if (last && last.scrollIntoView) {
          last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    } catch (e) { toast?.(e.message || 'Error agregando fila', 'error'); }
  }

  // ---- DELETE LINK ----
  async function handleDeleteLink(linkId) {
    if (!(await confirm({ title: '¿Eliminar este link?', description: 'La opción sale del ranking del cliente. No se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteOrderLink(detail.id, linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast?.('Link eliminado');
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- DELETE ALL EMPTY LINKS ----
  // Bulk-clean rows that have no URL, no make/model and no image — typical
  // leftover from "Agregar Fila" clicks during testing or from old plans
  // that pre-allocated empty rows.
  async function handleDeleteEmptyLinks() {
    const empty = links.filter(l => !l.url && !l.make && !l.model && !l.image_url && !l.comments
      && !l.value_usa_usd && !l.value_chile_clp && !l.value_chile_negotiated_clp && !l.selection_order);
    if (!empty.length) return;
    const n = empty.length;
    if (!(await confirm({
      title: `¿Borrar ${n} fila${n === 1 ? '' : 's'} vacía${n === 1 ? '' : 's'}?`,
      description: 'Son filas sin link, marca, modelo, imagen, precios ni comentarios.',
      tone: 'danger',
      confirmLabel: 'Borrar',
    }))) return;
    try {
      for (const lk of empty) {
        if (lk.id) await deleteOrderLink(detail.id, lk.id);
      }
      setLinks(prev => prev.filter(l => !empty.find(e => e.id === l.id)));
      toast?.(`${empty.length} fila${empty.length === 1 ? '' : 's'} vacía${empty.length === 1 ? '' : 's'} borrada${empty.length === 1 ? '' : 's'}`);
    } catch (e) { toast?.(e.message || 'Error borrando filas', 'error'); }
  }

  // ---- UPDATE LINK FIELD ----
  const NUMERIC_LINK_FIELDS = ['value_usa_usd', 'value_to_negotiate_usd', 'value_chile_clp', 'value_chile_negotiated_clp', 'selection_order', 'year', 'hours'];
  function handleLinkUpdate(linkId, field, value) {
    // Un número borrado se guarda como vacío (NULL), no como '' (MySQL estricto lo rechaza).
    const v = NUMERIC_LINK_FIELDS.includes(field) && value === '' ? null : value;
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: v } : l));
    setUnsaved(true);
  }

  // Al escribir un link de un sitio lento hay que encolarlo, no pedirlo: tarda
  // hasta 90 segundos y la peticion se corta. Pero para encolarlo el servidor
  // necesita tener la URL guardada —la lee de la base, no del navegador— asi que
  // primero se persiste la fila y recien despues se encola.
  const encolarUrlLenta = useCallback(async (linkId, url) => {
    if (!detail?.id) return;
    const actualizados = links.map(l => (l.id === linkId ? { ...l, url } : l));
    setLinks(actualizados);
    try {
      await updateOrderLinks(detail.id, actualizados);
      setUnsaved(false);
      // El row_index lo asigna el servidor, asi que se relee antes de encolar:
      // una fila recien agregada todavia no lo tiene en el navegador.
      const o = await getOrderDetail(detail.id);
      const orden = o.order || o;
      const fila = (orden.links || []).find(l => l.id === linkId);
      if (fila?.row_index) await rescrapeOrderLink(detail.id, fila.row_index);
      await refrescarDetalle();
    } catch (e) {
      toast?.('No se pudo poner el anuncio en cola: ' + (e.message || ''), 'error');
    }
  }, [detail?.id, links, refrescarDetalle, toast]);

  // ---- IMAGE UPLOAD ----
  async function handleImageUpload(linkId, file) {
    try {
      const res = await uploadLinkImage(detail.id, linkId, file);
      const url = res.url || res.image_url;
      if (!url) throw new Error(res.error || 'El servidor no devolvió la imagen');
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, image_url: url } : l));
      setUnsaved(true);
      toast?.('Imagen subida. Recuerda guardar el expediente.');
    } catch (e) { toast?.('Error subiendo imagen: ' + (e.message || ''), 'error'); }
  }

  // ---- SCRAPE RESULT ----
  const handleScrapeResult = useCallback((linkId, data, force) => {
    const fields = ['make', 'model', 'year', 'location', 'hours', 'engine', 'image_url'];
    const priceKey = data.value_usa_usd || data.price;
    // Se calcula sobre la fila actual (no dentro del updater de setLinks, que
    // React puede ejecutar más tarde) para saber si de verdad se llenó algo.
    const current = linksRef.current.find(l => l.id === linkId);
    if (!current) return;
    const patch = {};
    fields.forEach(f => { if (data[f] && (force || !current[f])) patch[f] = data[f]; });
    if (priceKey && (force || !current.value_usa_usd)) patch.value_usa_usd = priceKey;
    const filled = Object.keys(patch).length > 0;
    if (filled) setLinks(prev => prev.map(l => (l.id === linkId ? { ...l, ...patch } : l)));
    if (filled) {
      setUnsaved(true);
      const hasImage = !!data.image_url;
      if (filled && hasImage) toast?.('Datos extraídos del link', 'success');
      else if (filled && !hasImage) toast?.('Datos parciales extraídos. Sube la imagen manualmente.', 'warning');
    } else {
      toast?.('No se encontraron datos nuevos', 'warning');
    }
  }, [toast]);

  // ---- DRAG & DROP ----
  function onDragStart(e, idx) {
    dragIdx.current = idx;
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function onDrop(e, dropIdx) {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const arr = [...links];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(dropIdx, 0, moved);
    // El orden se guarda al tiro en el servidor; el row_index local se alinea
    // para que un "Guardar Todo" posterior no lo deshaga.
    const newLinks = arr.map((l, i) => ({ ...l, row_index: i + 1 }));
    setLinks(newLinks);
    const ids = newLinks.map(l => l.id).filter(Boolean);
    reorderOrderLinks(detail.id, ids, user?.name || 'Admin')
      .then(() => setDetail(d => (d ? { ...d, ranking_author_name: user?.name || 'Admin' } : d)))
      .catch(err => toast?.('No se pudo guardar el nuevo orden: ' + (err.message || ''), 'error'));
  }
  function onDragEnd(e) { e.currentTarget.style.opacity = '1'; dragIdx.current = null; }

  // ---- CREATE ORDER ----
  async function handleCreate() {
    if (!createForm.customer_email) { toast?.('Falta el email del cliente', 'error'); return; }
    try {
      await createOrder({ ...createForm, initial_links: 1 });
      setShowCreate(false);
      setCreateForm({ customer_email:'', customer_name:'', customer_phone:'', service_type:'plan_busqueda', plan_name:'', asset_name:'', type_zone:'', agent_name: AGENTE_POR_DEFECTO });
      toast?.('Expediente creado');
      loadOrders();
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ---- DELETE ORDER ----
  async function handleDeleteOrder() {
    if (!(await confirm({
      title: '¿Eliminar este expediente permanentemente?',
      description: `Se borra ${detail.order_number} con sus ${links.length} link${links.length === 1 ? '' : 's'}, reportes y archivos. No se puede deshacer.`,
      tone: 'danger',
      confirmLabel: 'Eliminar expediente',
    }))) return;
    try {
      await apiDeleteOrder(detail.id);
      toast?.('Expediente eliminado');
      goBack();
    } catch (e) { toast?.(e.message, 'error'); }
  }

  // ============ LIST VIEW ============
  if (view === 'list') {
    return (
      <ListaExpedientes
        orders={orders}
        conteos={conteos}
        loading={loading}
        filters={filters}
        setFilters={setFilters}
        onOpen={openDetail}
        showCreate={showCreate}
        setShowCreate={setShowCreate}
        createForm={createForm}
        setCreateForm={setCreateForm}
        onCreate={handleCreate}
      />
    );
  }

  // ============ DETAIL VIEW ============
  return (
    <DetalleExpediente
      loading={loading}
      detail={detail}
      links={links}
      form={form}
      setForm={setForm}
      setUnsaved={setUnsaved}
      unsaved={unsaved}
      saving={saving}
      rescraping={rescraping}
      rescrapeProgress={rescrapeProgress}
      scraperFaltante={scraperFaltante}
      onCerrarAvisoScraper={() => setScraperFaltante(null)}
      linksContainerRef={linksContainerRef}
      onBack={goBack}
      onSaveAll={handleSaveAll}
      onSendClient={handleSendClient}
      onNotifyRanking={handleNotifyRanking}
      onRescrape={handleRescrapeLinks}
      onDeleteOrder={handleDeleteOrder}
      onTimelineStep={handleTimelineStep}
      onAddLink={handleAddLink}
      onDeleteEmptyLinks={handleDeleteEmptyLinks}
      onLinkUpdate={handleLinkUpdate}
      onDeleteLink={handleDeleteLink}
      onImageUpload={handleImageUpload}
      onScrapeResult={handleScrapeResult}
      onEncolado={refrescarDetalle}
      onEncolarUrl={encolarUrlLenta}
      onCotizar={setCotizandoLink}
      onEnviarDesglose={handleEnviarDesglose}
      dragHandlers={{ onDragStart, onDragOver, onDrop, onDragEnd }}
      showStatusModal={showStatusModal}
      setShowStatusModal={setShowStatusModal}
      newStatus={newStatus}
      setNewStatus={setNewStatus}
      onStatusChange={handleStatusChange}
      cotizandoLink={cotizandoLink}
      onCloseCotizar={() => setCotizandoLink(null)}
      onBreakdownSent={marcarDesgloseEnviado}
      onQuoteSaved={async () => {
        if (!detail?.id) return;
        const cotizadoId = cotizandoLink?.id;
        // Guardar la cotización copia su total a "valor negociado" en el
        // servidor. Si había ediciones sin guardar, se persisten tomando ese
        // valor nuevo del servidor para no pisarlo con el local viejo.
        if (unsaved) {
          try {
            const o = await getOrderDetail(detail.id);
            const fresco = ((o.order || o).links || []).find(l => l.id === cotizadoId);
            const merged = links.map(l => (l.id === cotizadoId && fresco
              ? { ...l, value_chile_negotiated_clp: fresco.value_chile_negotiated_clp }
              : l));
            await updateOrderLinks(detail.id, merged);
            setUnsaved(false);
          } catch (e) { toast?.('No se pudieron guardar los cambios pendientes: ' + (e.message || ''), 'error'); }
        }
        await refrescarDetalle();
      }}
    />
  );
}
