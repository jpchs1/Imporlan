/**
 * Imporlan — "Importa tú mismo" · catálogo de planes + checkout online
 * ---------------------------------------------------------------------
 * Expone window.ImporlanDIY para que la sección del Home
 * (importa-tu-mismo-section.js) y la landing /importa-tu-mismo/
 * compartan un único catálogo y un único modal de compra.
 *
 * El modal usa exactamente los mismos endpoints que el resto del sitio:
 *   POST /api/webpay.php?action=create_transaction   -> { redirect_url }
 *   POST /api/mercadopago.php?action=create_preference -> { init_point }
 *   POST /api/paypal.php?action=create_order | capture_order
 * y además ofrece transferencia bancaria, igual que /pago/.
 *
 * Version 1.0
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.ImporlanDIY) return;

  /* ============================================================
   * CONFIGURACIÓN
   * ==========================================================*/

  var WHATSAPP = '56940211459';
  var CONTACT_EMAIL = 'contacto@imporlan.cl';
  var USD_FALLBACK = 950; // sólo para mostrar/convertir en PayPal
  var RECURSOS = '/importa-tu-mismo/recursos/';

  function apiBase() {
    return (window.location.pathname.indexOf('/test/') === 0) ? '/test/api' : '/api';
  }

  function waLink(text) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
  }

  /* Biblioteca descargable. `free: true` se puede bajar sin comprar. */
  var LIBRARY = [
    {
      id: 'mini-guia',
      file: RECURSOS + '00-mini-guia-gratis-importar-embarcacion-usa-chile.pdf',
      title: 'Mini-guía gratis: importar una embarcación en 8 pasos',
      pages: 8,
      free: true,
      desc: 'Resumen del proceso completo, los 10 errores más caros y el orden real de los trámites.'
    },
    {
      id: 'manual',
      file: RECURSOS + '01-manual-maestro-importacion-usa-chile.pdf',
      title: 'Manual Maestro de Importación USA → Chile',
      pages: 13,
      desc: 'Las 12 etapas del proceso, plazos reales, actores involucrados y qué hacer en cada una.'
    },
    {
      id: 'checklist',
      file: RECURSOS + '02-checklist-maestro-70-puntos.pdf',
      title: 'Checklist Maestro de 70 puntos (imprimible)',
      pages: 6,
      desc: 'Punto por punto, desde la búsqueda hasta la matrícula, para no saltarte ningún paso.'
    },
    {
      id: 'costos',
      file: RECURSOS + '03-guia-costos-aranceles-impuestos.pdf',
      title: 'Guía de Costos, Aranceles e Impuestos',
      pages: 10,
      desc: 'Cómo se arma el CIF, arancel, IVA, gastos portuarios y honorarios. Con ejemplos numéricos.'
    },
    {
      id: 'calculadora',
      file: RECURSOS + 'calculadora-costos-importacion-imporlan.csv',
      title: 'Planilla de cálculo de costos (CSV / Excel)',
      pages: 0,
      kind: 'csv',
      desc: 'Planilla lista para usar: cambias el valor FOB y te entrega el costo puesto en Chile.'
    },
    {
      id: 'documentos',
      file: RECURSOS + '04-documentos-formularios-y-plantillas.pdf',
      title: 'Documentos, formularios y plantillas',
      pages: 8,
      desc: 'Bill of Sale, Title, HBL, packing list, DIN, mandato al agente de aduana y modelos listos.'
    },
    {
      id: 'directemar',
      file: RECURSOS + '05-tramites-directemar-y-matricula.pdf',
      title: 'Trámites DIRECTEMAR y matrícula en Chile',
      pages: 7,
      desc: 'Inscripción, matrícula, numeral, seguros obligatorios y licencias para navegar legalmente.'
    },
    {
      id: 'logistica',
      file: RECURSOS + '06-logistica-fletes-seguro-e-inspeccion.pdf',
      title: 'Logística, fletes, seguro e inspección pre-compra',
      pages: 7,
      desc: 'RoRo vs contenedor vs cradle, seguro de carga y cómo contratar un surveyor en USA.'
    },
    {
      id: 'errores',
      file: RECURSOS + '07-errores-costosos-y-como-evitarlos.pdf',
      title: '25 errores costosos y cómo evitarlos',
      pages: 7,
      desc: 'Los errores que hemos visto pagar caro a importadores primerizos, con su antídoto.'
    },
    {
      id: 'directorio',
      file: RECURSOS + '08-directorio-proveedores-y-negociacion.pdf',
      title: 'Directorio de proveedores + guion de negociación',
      pages: 8,
      desc: 'Tipos de contraparte en USA, cómo evaluarlas y plantillas de correo en inglés listas para enviar.'
    },
    {
      id: 'post',
      file: RECURSOS + '09-post-importacion-en-chile.pdf',
      title: 'Después de importar: puesta en marcha en Chile',
      pages: 6,
      desc: 'Traslado interno, mantención, seguro, patente, amarre y primeros 90 días de navegación.'
    }
  ];

  var LIB_BY_ID = {};
  for (var li = 0; li < LIBRARY.length; li++) LIB_BY_ID[LIBRARY[li].id] = LIBRARY[li];

  var BASE_DOCS = ['manual', 'checklist', 'costos', 'calculadora', 'documentos', 'directemar', 'logistica', 'errores'];

  /* Los 3 planes. Precios en CLP — editar sólo aquí. */
  var PLANS = [
    {
      id: 'navegante',
      name: 'Plan Navegante',
      subtitle: 'Autogestión guiada por documentos',
      price: 149900,
      compareAt: 179900,
      accent: 'cyan',
      badge: '',
      ideal: 'Para quien ya decidió importar y necesita el know-how completo, sin asesoría personalizada.',
      docs: BASE_DOCS,
      features: [
        'Biblioteca completa: 8 descargables (7 manuales PDF + planilla de cálculo)',
        'Planilla de cálculo de costos puerta a puerta (CSV / Excel)',
        'Checklist maestro de 70 puntos imprimible',
        'Modelos de Bill of Sale, mandato y correos en inglés',
        'Guía de trámites DIRECTEMAR y matrícula paso a paso',
        'Acceso a las actualizaciones del material por 12 meses',
        'Soporte por email para dudas sobre el material'
      ],
      notIncluded: ['Asesoría 1 a 1', 'Revisión de embarcaciones', 'Revisión de tus documentos']
    },
    {
      id: 'timonel',
      name: 'Plan Timonel',
      subtitle: 'Documentos + asesoría 1 a 1',
      price: 249900,
      compareAt: 319900,
      accent: 'violet',
      badge: 'Más elegido',
      popular: true,
      ideal: 'Para quien quiere importar por su cuenta pero con un especialista revisando sus decisiones clave.',
      docs: BASE_DOCS.concat(['directorio']),
      features: [
        'Todo lo del Plan Navegante',
        'Videollamada de 60 minutos con un especialista en importación',
        'Revisión de hasta 3 embarcaciones candidatas (links o fichas)',
        'Simulación de costos personalizada con tu embarcación real',
        'Directorio de proveedores en USA + guion de negociación',
        'Soporte por WhatsApp durante 30 días',
        'Revisión de tu cotización de flete antes de contratar'
      ],
      notIncluded: ['Gestión de compra por parte de Imporlan', 'Trámites realizados por nosotros']
    },
    {
      id: 'patron',
      name: 'Plan Patrón de Nave',
      subtitle: 'Mentoría completa hasta la matrícula',
      price: 449900,
      compareAt: 599900,
      accent: 'gold',
      badge: 'Acompañamiento total',
      ideal: 'Para quien quiere el ahorro de importar por su cuenta, con un mentor en cada hito del proceso.',
      docs: BASE_DOCS.concat(['directorio', 'post']),
      features: [
        'Todo lo del Plan Timonel',
        '3 videollamadas en los hitos críticos: compra, embarque y aduana',
        'Revisión documental completa (Bill of Sale, Title, HBL, factura y seguro)',
        'Revisión de embarcaciones candidatas sin límite durante la vigencia',
        'Acompañamiento en la coordinación con tu agente de aduana',
        'Guía de puesta en marcha en Chile y post-importación',
        'Soporte prioritario por WhatsApp durante 90 días',
        'Sesión de cierre para matrícula DIRECTEMAR'
      ],
      notIncluded: ['Costos de terceros (flete, seguro, impuestos, agente de aduana)']
    }
  ];

  var PLAN_BY_ID = {};
  for (var pi = 0; pi < PLANS.length; pi++) PLAN_BY_ID[PLANS[pi].id] = PLANS[pi];

  /* ============================================================
   * UTILIDADES
   * ==========================================================*/

  function clp(n) {
    return '$' + Number(n).toLocaleString('es-CL');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function planDocs(plan) {
    var out = [];
    for (var i = 0; i < plan.docs.length; i++) {
      var d = LIB_BY_ID[plan.docs[i]];
      if (d) out.push(d);
    }
    return out;
  }

  var usdRate = USD_FALLBACK;
  var usdRequested = false;
  function ensureUsdRate() {
    if (usdRequested) return;
    usdRequested = true;
    try {
      fetch(apiBase() + '/dolar.php')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var v = parseFloat(d && (d.dolar_compra || d.dolar_observado));
          if (v && v > 300 && v < 3000) usdRate = v;
        })
        .catch(function () { /* se mantiene el fallback */ });
    } catch (e) { /* noop */ }
  }

  /* ============================================================
   * ESTILOS DEL MODAL
   * ==========================================================*/

  var MODAL_STYLE_ID = 'imp-diy-checkout-style';

  function injectStyles() {
    if (document.getElementById(MODAL_STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = MODAL_STYLE_ID;
    s.textContent = [
      '.impdiy-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:flex-start;justify-content:center;padding:24px 16px;background:rgba(3,8,18,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow-y:auto;overscroll-behavior:contain;}',
      '.impdiy-ov.is-open{display:flex;}',
      '.impdiy-modal{position:relative;width:100%;max-width:920px;margin:auto;border-radius:24px;background:linear-gradient(180deg,#0f2140 0%,#0a1628 100%);border:1px solid rgba(255,255,255,.10);box-shadow:0 40px 90px -30px rgba(0,0,0,.8);color:#e2e8f0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:impdiy-in .28s cubic-bezier(.16,1,.3,1);}',
      '@keyframes impdiy-in{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}',
      '@media(prefers-reduced-motion:reduce){.impdiy-modal{animation:none;}}',
      '.impdiy-close{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s;z-index:3;}',
      '.impdiy-close:hover{background:rgba(255,255,255,.14);color:#fff;}',
      '.impdiy-head{padding:28px 30px 20px;border-bottom:1px solid rgba(255,255,255,.08);}',
      '.impdiy-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#67e8f9;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.26);border-radius:999px;padding:5px 13px;margin-bottom:12px;}',
      '.impdiy-head h3{margin:0 0 6px;font-size:1.6rem;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1.2;}',
      '.impdiy-head p{margin:0;color:#94a3b8;font-size:.95rem;line-height:1.55;}',
      '.impdiy-price-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:16px;}',
      '.impdiy-price{font-size:2.1rem;font-weight:800;color:#fff;letter-spacing:-.02em;}',
      '.impdiy-price small{font-size:.85rem;font-weight:600;color:#94a3b8;margin-left:6px;}',
      '.impdiy-was{color:#64748b;text-decoration:line-through;font-size:1rem;font-weight:600;}',
      '.impdiy-off{background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.32);color:#6ee7b7;font-size:11px;font-weight:800;letter-spacing:.06em;padding:4px 10px;border-radius:999px;}',
      '.impdiy-body{display:grid;grid-template-columns:1.05fr .95fr;gap:0;}',
      '.impdiy-col{padding:24px 30px 30px;}',
      '.impdiy-col + .impdiy-col{border-left:1px solid rgba(255,255,255,.08);}',
      '.impdiy-label{display:block;font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7dd3fc;margin:0 0 12px;}',
      '.impdiy-field{margin-bottom:14px;}',
      '.impdiy-field label{display:block;font-size:12.5px;font-weight:600;color:#cbd5e1;margin-bottom:6px;}',
      '.impdiy-field label .opt{color:#64748b;font-weight:500;}',
      '.impdiy-field input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(2,10,22,.6);color:#f1f5f9;font-size:15px;font-family:inherit;transition:border-color .2s,box-shadow .2s;}',
      '.impdiy-field input:focus{outline:none;border-color:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.18);}',
      '.impdiy-field input::placeholder{color:#64748b;}',
      '.impdiy-methods{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}',
      '.impdiy-method{display:flex;align-items:center;gap:10px;padding:12px 13px;border-radius:13px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.04);cursor:pointer;transition:border-color .2s,background .2s,transform .2s;text-align:left;color:#e2e8f0;font-family:inherit;font-size:13.5px;font-weight:600;}',
      '.impdiy-method:hover{border-color:rgba(34,211,238,.4);background:rgba(34,211,238,.07);}',
      '.impdiy-method.is-active{border-color:#22d3ee;background:rgba(34,211,238,.14);box-shadow:0 0 0 3px rgba(34,211,238,.14);}',
      '.impdiy-method-ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);flex-shrink:0;}',
      '.impdiy-method-ico svg{width:16px;height:16px;}',
      '.impdiy-method small{display:block;font-size:11px;font-weight:500;color:#94a3b8;margin-top:2px;}',
      '.impdiy-pay{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 22px;border:none;border-radius:14px;background:linear-gradient(135deg,#0891b2,#2563eb 55%,#7c3aed);color:#fff;font-size:1rem;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 16px 36px -14px rgba(37,99,235,.7);transition:transform .2s,box-shadow .2s,opacity .2s;}',
      '.impdiy-pay:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 22px 44px -14px rgba(37,99,235,.8);}',
      '.impdiy-pay:disabled{opacity:.65;cursor:wait;}',
      '.impdiy-pay .impdiy-spin{width:17px;height:17px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:impdiy-rot .8s linear infinite;display:none;}',
      '.impdiy-pay.is-loading .impdiy-spin{display:inline-block;}',
      '@keyframes impdiy-rot{to{transform:rotate(360deg)}}',
      '.impdiy-secure{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:12px;color:#64748b;font-size:11.5px;}',
      '.impdiy-secure svg{width:13px;height:13px;color:#34d399;}',
      '.impdiy-status{display:none;margin-top:14px;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.5;}',
      '.impdiy-status.show{display:block;}',
      '.impdiy-status.error{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;}',
      '.impdiy-status.info{background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:#93c5fd;}',
      '.impdiy-status.success{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#6ee7b7;}',
      '.impdiy-transfer{display:none;margin-top:14px;padding:16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);font-size:13px;line-height:1.75;color:#cbd5e1;}',
      '.impdiy-transfer.show{display:block;}',
      '.impdiy-transfer b{color:#fff;}',
      '#impdiy-paypal{display:none;margin-top:14px;}',
      '#impdiy-paypal.show{display:block;}',
      '.impdiy-incl{list-style:none;margin:0 0 18px;padding:0;}',
      '.impdiy-incl li{display:flex;gap:9px;align-items:flex-start;font-size:13.2px;line-height:1.5;color:#cbd5e1;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.07);}',
      '.impdiy-incl li:last-child{border-bottom:none;}',
      '.impdiy-incl svg{width:15px;height:15px;color:#34d399;flex-shrink:0;margin-top:2px;}',
      '.impdiy-docs{list-style:none;margin:0;padding:0;}',
      '.impdiy-docs li{display:flex;gap:9px;align-items:flex-start;font-size:12.6px;line-height:1.45;color:#94a3b8;padding:5px 0;}',
      '.impdiy-docs svg{width:14px;height:14px;color:#22d3ee;flex-shrink:0;margin-top:2px;}',
      '.impdiy-note{margin-top:16px;font-size:11.5px;line-height:1.6;color:#64748b;}',
      '.impdiy-note a{color:#7dd3fc;}',
      '@media(max-width:820px){',
      '  .impdiy-body{grid-template-columns:1fr;}',
      '  .impdiy-col + .impdiy-col{border-left:none;border-top:1px solid rgba(255,255,255,.08);}',
      '  .impdiy-head{padding:26px 20px 18px;}',
      '  .impdiy-col{padding:20px;}',
      '  .impdiy-head h3{font-size:1.32rem;}',
      '  .impdiy-price{font-size:1.8rem;}',
      '  .impdiy-ov{padding:12px;}',
      '}',
      '@media(max-width:420px){',
      '  .impdiy-methods{grid-template-columns:1fr;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ============================================================
   * ICONOS
   * ==========================================================*/

  var icoCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var icoDoc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var icoLock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var icoCard = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
  var icoWallet = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><circle cx="17" cy="14" r="1.4"/></svg>';
  var icoGlobe = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var icoBank = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v11M10 10v11M14 10v11M18 10v11"/></svg>';
  var icoX = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  /* ============================================================
   * MODAL
   * ==========================================================*/

  var overlay = null;
  var currentPlan = null;
  var selectedMethod = 'webpay';
  var paypalRendered = false;
  var lastFocused = null;

  function buildModal() {
    if (overlay) return overlay;
    injectStyles();

    overlay = document.createElement('div');
    overlay.className = 'impdiy-ov';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'impdiy-title');
    overlay.innerHTML = [
      '<div class="impdiy-modal">',
      '  <button type="button" class="impdiy-close" aria-label="Cerrar">' + icoX + '</button>',
      '  <div class="impdiy-head">',
      '    <span class="impdiy-eyebrow">Importa tú mismo</span>',
      '    <h3 id="impdiy-title"></h3>',
      '    <p id="impdiy-sub"></p>',
      '    <div class="impdiy-price-row" id="impdiy-pricerow"></div>',
      '  </div>',
      '  <div class="impdiy-body">',
      '    <div class="impdiy-col">',
      '      <span class="impdiy-label">Tus datos</span>',
      '      <div class="impdiy-field"><label for="impdiy-name">Nombre y apellido</label><input type="text" id="impdiy-name" autocomplete="name" placeholder="Ej: Juan Pérez"></div>',
      '      <div class="impdiy-field"><label for="impdiy-email">Email</label><input type="email" id="impdiy-email" autocomplete="email" placeholder="tucorreo@email.com"></div>',
      '      <div class="impdiy-field"><label for="impdiy-phone">Teléfono <span class="opt">(opcional)</span></label><input type="tel" id="impdiy-phone" autocomplete="tel" placeholder="+56 9 1234 5678"></div>',
      '      <span class="impdiy-label" style="margin-top:20px;">Método de pago</span>',
      '      <div class="impdiy-methods" id="impdiy-methods">',
      '        <button type="button" class="impdiy-method is-active" data-method="webpay"><span class="impdiy-method-ico">' + icoCard + '</span><span>WebPay<small>Débito y crédito</small></span></button>',
      '        <button type="button" class="impdiy-method" data-method="mercadopago"><span class="impdiy-method-ico">' + icoWallet + '</span><span>MercadoPago<small>Cuotas disponibles</small></span></button>',
      '        <button type="button" class="impdiy-method" data-method="paypal"><span class="impdiy-method-ico">' + icoGlobe + '</span><span>PayPal<small>Pago internacional</small></span></button>',
      '        <button type="button" class="impdiy-method" data-method="transfer"><span class="impdiy-method-ico">' + icoBank + '</span><span>Transferencia<small>Banco Santander</small></span></button>',
      '      </div>',
      '      <button type="button" class="impdiy-pay" id="impdiy-pay"><span class="impdiy-spin"></span><span id="impdiy-pay-label">Pagar</span></button>',
      '      <div id="impdiy-paypal"></div>',
      '      <div class="impdiy-secure">' + icoLock + ' Pago seguro · No almacenamos datos de tu tarjeta</div>',
      '      <div class="impdiy-status" id="impdiy-status"></div>',
      '      <div class="impdiy-transfer" id="impdiy-transfer"></div>',
      '    </div>',
      '    <div class="impdiy-col">',
      '      <span class="impdiy-label">Qué incluye</span>',
      '      <ul class="impdiy-incl" id="impdiy-incl"></ul>',
      '      <span class="impdiy-label">Material descargable incluido</span>',
      '      <ul class="impdiy-docs" id="impdiy-docs"></ul>',
      '      <p class="impdiy-note">Recibirás los accesos de descarga en tu email inmediatamente después del pago. ¿Dudas antes de comprar? <a href="' + waLink('Hola, tengo una consulta sobre los planes Importa tú mismo de Imporlan.') + '" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>.</p>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    overlay.querySelector('.impdiy-close').addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });

    var methods = overlay.querySelectorAll('.impdiy-method');
    for (var i = 0; i < methods.length; i++) {
      methods[i].addEventListener('click', function () {
        selectMethod(this.getAttribute('data-method'));
      });
    }

    overlay.querySelector('#impdiy-pay').addEventListener('click', processPayment);

    return overlay;
  }

  function setStatus(msg, type) {
    var el = overlay.querySelector('#impdiy-status');
    if (!msg) { el.className = 'impdiy-status'; el.innerHTML = ''; return; }
    el.className = 'impdiy-status show ' + (type || 'info');
    el.innerHTML = msg;
  }

  function setLoading(on) {
    var btn = overlay.querySelector('#impdiy-pay');
    btn.disabled = !!on;
    btn.classList.toggle('is-loading', !!on);
  }

  function selectMethod(method) {
    selectedMethod = method;
    var methods = overlay.querySelectorAll('.impdiy-method');
    for (var i = 0; i < methods.length; i++) {
      methods[i].classList.toggle('is-active', methods[i].getAttribute('data-method') === method);
    }
    setStatus('');

    var payBtn = overlay.querySelector('#impdiy-pay');
    var label = overlay.querySelector('#impdiy-pay-label');
    var ppBox = overlay.querySelector('#impdiy-paypal');
    var transferBox = overlay.querySelector('#impdiy-transfer');

    transferBox.classList.toggle('show', method === 'transfer');
    if (method === 'transfer') {
      transferBox.innerHTML = [
        '<b>Datos para transferencia</b><br>',
        'Banco Santander · Cuenta Corriente (CLP) <b>74233813</b><br>',
        'Razón social: <b>Imporlan SpA</b> · RUT <b>76.914.409-9</b><br>',
        'Email: <b>' + CONTACT_EMAIL + '</b><br>',
        'Monto: <b>' + clp(currentPlan.price) + ' CLP</b><br>',
        'Asunto: <b>' + esc(currentPlan.name) + '</b><br><br>',
        'Envía el comprobante a ' + CONTACT_EMAIL + ' indicando tu nombre y el plan, y te enviamos todo el material dentro del día hábil siguiente.'
      ].join('');
    }

    ppBox.classList.toggle('show', method === 'paypal');
    payBtn.style.display = (method === 'paypal') ? 'none' : 'flex';

    if (method === 'paypal') {
      ensureUsdRate();
      renderPayPal();
    } else if (method === 'transfer') {
      label.textContent = 'Confirmar datos de transferencia';
    } else {
      label.textContent = 'Pagar ' + clp(currentPlan.price) + ' CLP';
    }
  }

  function readForm() {
    var name = overlay.querySelector('#impdiy-name').value.trim();
    var email = overlay.querySelector('#impdiy-email').value.trim();
    var phone = overlay.querySelector('#impdiy-phone').value.trim();

    if (!name) {
      setStatus('Ingresa tu nombre para emitir la compra.', 'error');
      overlay.querySelector('#impdiy-name').focus();
      return null;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Ingresa un email válido: ahí te enviamos el material.', 'error');
      overlay.querySelector('#impdiy-email').focus();
      return null;
    }
    return { name: name, email: email, phone: phone };
  }

  function successUrl() {
    return 'https://www.imporlan.cl/importa-tu-mismo/gracias/?plan=' + encodeURIComponent(currentPlan.id);
  }

  function basePayload(data) {
    return {
      amount: currentPlan.price,
      description: 'Importa tú mismo - ' + currentPlan.name,
      plan_name: 'Importa tú mismo - ' + currentPlan.name,
      type: 'pago_directo',
      source: 'importa_tu_mismo',
      product_id: 'diy_' + currentPlan.id,
      payer_name: data.name,
      payer_phone: data.phone,
      success_redirect: successUrl()
    };
  }

  function processPayment() {
    setStatus('');
    var data = readForm();
    if (!data) return;

    if (selectedMethod === 'transfer') {
      setStatus('Transfiere <b>' + clp(currentPlan.price) + ' CLP</b> a la cuenta indicada y envía el comprobante a <b>' + CONTACT_EMAIL + '</b> indicando "' + esc(currentPlan.name) + '". Apenas lo validamos te enviamos todo el material a ' + esc(data.email) + '.', 'success');
      return;
    }

    setLoading(true);
    if (selectedMethod === 'webpay') payWebpay(data);
    else if (selectedMethod === 'mercadopago') payMercadoPago(data);
  }

  function payWebpay(data) {
    var payload = basePayload(data);
    payload.user_email = data.email;
    payload.buy_order = 'DIY_' + Date.now();
    payload.session_id = 'diy_' + Date.now();
    payload.days = 365;

    fetch(apiBase() + '/webpay.php?action=create_transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success && res.redirect_url) {
          setStatus('Redirigiendo a WebPay…', 'info');
          window.location.href = res.redirect_url;
          return;
        }
        throw new Error((res && res.error) || 'No pudimos iniciar la transacción con WebPay.');
      })
      .catch(function (err) {
        setLoading(false);
        setStatus(esc(err.message || 'Error al conectar con WebPay.') + ' Puedes intentar con otro método o escribirnos por WhatsApp.', 'error');
      });
  }

  function payMercadoPago(data) {
    var payload = basePayload(data);
    payload.payer_email = data.email;
    payload.user_email = data.email;
    payload.quantity = 1;

    fetch(apiBase() + '/mercadopago.php?action=create_preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success && res.init_point) {
          setStatus('Redirigiendo a MercadoPago…', 'info');
          window.location.href = res.init_point;
          return;
        }
        throw new Error((res && res.error) || 'No pudimos crear la preferencia de MercadoPago.');
      })
      .catch(function (err) {
        setLoading(false);
        setStatus(esc(err.message || 'Error al conectar con MercadoPago.') + ' Puedes intentar con otro método o escribirnos por WhatsApp.', 'error');
      });
  }

  /* ---- PayPal Smart Buttons (mismo flujo que /pago/) ---- */

  function renderPayPal() {
    var box = overlay.querySelector('#impdiy-paypal');
    if (paypalRendered) return;
    if (typeof window.paypal !== 'undefined' && window.paypal.Buttons) {
      doRenderPayPal();
      return;
    }
    box.innerHTML = '<div class="impdiy-note">Cargando PayPal…</div>';
    fetch(apiBase() + '/paypal.php?action=get_client_id')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.client_id) throw new Error('PayPal no disponible');
        var domain = (cfg.environment === 'production') ? 'www.paypal.com' : 'www.sandbox.paypal.com';
        var sc = document.createElement('script');
        sc.src = 'https://' + domain + '/sdk/js?client-id=' + encodeURIComponent(cfg.client_id) + '&currency=USD&components=buttons&enable-funding=card';
        sc.onload = doRenderPayPal;
        sc.onerror = function () {
          box.innerHTML = '<div class="impdiy-note">No pudimos cargar PayPal. Elige otro método de pago.</div>';
        };
        document.head.appendChild(sc);
      })
      .catch(function () {
        box.innerHTML = '<div class="impdiy-note">PayPal no está disponible en este momento. Elige otro método de pago.</div>';
      });
  }

  function doRenderPayPal() {
    if (paypalRendered) return;
    var box = overlay.querySelector('#impdiy-paypal');
    if (!box || typeof window.paypal === 'undefined') return;
    box.innerHTML = '';
    paypalRendered = true;

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', tagline: false },
      createOrder: function () {
        var data = readForm();
        if (!data) return Promise.reject(new Error('Completa tus datos'));
        var usd = Math.max(1, Math.round(currentPlan.price / usdRate * 100) / 100).toFixed(2);
        var payload = basePayload(data);
        payload.amount = parseFloat(usd);
        payload.currency = 'USD';
        payload.amount_clp = currentPlan.price;
        payload.payer_email = data.email;
        payload.user_email = data.email;
        payload.type = 'link';
        return fetch(apiBase() + '/paypal.php?action=create_order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (res && res.success && res.order_id) return res.order_id;
          throw new Error((res && res.error) || 'Error al crear la orden de PayPal');
        });
      },
      onApprove: function (d) {
        setStatus('Procesando pago…', 'info');
        return fetch(apiBase() + '/paypal.php?action=capture_order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: d.orderID })
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (res && res.success) {
            window.location.href = successUrl() + '&payment=success';
            return;
          }
          throw new Error((res && res.error) || 'No pudimos confirmar el pago');
        }).catch(function (err) {
          setStatus(esc(err.message), 'error');
        });
      },
      onCancel: function () { setStatus('Pago cancelado. Puedes intentar nuevamente.', 'error'); },
      onError: function () { setStatus('Error al procesar el pago con PayPal. Prueba con WebPay o MercadoPago.', 'error'); }
    }).render('#impdiy-paypal');
  }

  /* ---- Apertura / cierre ---- */

  function fillModal(plan) {
    overlay.querySelector('#impdiy-title').textContent = plan.name;
    overlay.querySelector('#impdiy-sub').textContent = plan.ideal;

    var off = plan.compareAt ? Math.round((1 - plan.price / plan.compareAt) * 100) : 0;
    overlay.querySelector('#impdiy-pricerow').innerHTML =
      '<span class="impdiy-price">' + clp(plan.price) + '<small>CLP · pago único</small></span>' +
      (plan.compareAt ? '<span class="impdiy-was">' + clp(plan.compareAt) + '</span>' : '') +
      (off >= 5 ? '<span class="impdiy-off">-' + off + '%</span>' : '');

    var incl = '';
    for (var i = 0; i < plan.features.length; i++) {
      incl += '<li>' + icoCheck + '<span>' + esc(plan.features[i]) + '</span></li>';
    }
    overlay.querySelector('#impdiy-incl').innerHTML = incl;

    var docs = planDocs(plan);
    var dh = '';
    for (var j = 0; j < docs.length; j++) {
      dh += '<li>' + icoDoc + '<span>' + esc(docs[j].title) + (docs[j].pages ? ' · ' + docs[j].pages + ' págs.' : '') + '</span></li>';
    }
    overlay.querySelector('#impdiy-docs').innerHTML = dh;
  }

  function open(planId) {
    var plan = PLAN_BY_ID[planId] || PLANS[0];
    buildModal();
    currentPlan = plan;
    paypalRendered = false;
    overlay.querySelector('#impdiy-paypal').innerHTML = '';
    fillModal(plan);
    setStatus('');
    setLoading(false);
    selectMethod('webpay');

    lastFocused = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    ensureUsdRate();

    var nameInput = overlay.querySelector('#impdiy-name');
    setTimeout(function () { try { nameInput.focus(); } catch (e) { /* noop */ } }, 60);

    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', { currency: 'CLP', value: plan.price, items: [{ item_id: 'diy_' + plan.id, item_name: plan.name }] });
      }
    } catch (e) { /* noop */ }
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    try { if (lastFocused && lastFocused.focus) lastFocused.focus(); } catch (e) { /* noop */ }
  }

  /* ============================================================
   * API PÚBLICA
   * ==========================================================*/

  window.ImporlanDIY = {
    PLANS: PLANS,
    LIBRARY: LIBRARY,
    planById: function (id) { return PLAN_BY_ID[id]; },
    planDocs: planDocs,
    clp: clp,
    waLink: waLink,
    whatsapp: WHATSAPP,
    open: open,
    close: close,
    /* Delegación global: cualquier elemento con data-diy-plan abre el modal. */
    bind: function (root) {
      var scope = root || document;
      var nodes = scope.querySelectorAll('[data-diy-plan]');
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].__diyBound) continue;
        nodes[i].__diyBound = true;
        nodes[i].addEventListener('click', function (e) {
          e.preventDefault();
          open(this.getAttribute('data-diy-plan'));
        });
      }
    }
  };

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-diy-plan]') : null;
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute('data-diy-plan'));
  });
})();
