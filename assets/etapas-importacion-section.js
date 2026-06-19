/**
 * Imporlan - Avanza por Etapas Section
 * Commercial, premium section presented AFTER the existing "Planes de Busqueda".
 * It introduces the staged journey: 1) Busqueda (links to existing plans),
 * 2) Compra y Logistica USA (CLP $1.000.000), 3) Importacion Full + Entrega
 * Santiago (CLP $2.000.000).
 *
 * IMPORTANT: This script ONLY inserts a new section. It NEVER modifies, hides
 * or reorders the existing "Planes de Busqueda" cards (prices, names, copy and
 * buttons stay exactly as they are).
 *
 * Insertion order target: Planes de Busqueda -> Ranking preview -> THIS -> Nuevas Lineas
 * Version 1.0
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__imporlanEtapasPRO) return;
  window.__imporlanEtapasPRO = true;

  var SECTION_ID = 'avanza-por-etapas';
  var STYLE_ID = 'imp-etapas-styles';
  var WA_NUMBER = '56940211459';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function waLink(text) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
  }

  /* ---- Icons (inline SVG, lucide-style to match the rest of the site) ---- */
  var iconLayers = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
  var iconSearch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var iconHandshake = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l2 2a1 1 0 0 0 1.41 0l3.3-3.3a1 1 0 0 0 0-1.42l-3.3-3.29"/><path d="M3 13l3.3 3.3a1 1 0 0 0 1.4 0l1.6-1.6"/><path d="M13.5 8.5 12 7l-4 4a1 1 0 0 0 0 1.41l.59.59a1 1 0 0 0 1.41 0L13 11"/><path d="M2 9l4-4 4 1"/><path d="M22 9l-4-4-4 1"/></svg>';
  var iconAnchor = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>';
  var iconCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var iconArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  var iconWhats = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 14.2c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5 1.7.7 2.4.8 3.3.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4z"/></svg>';
  var iconWallet = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 7H5"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5z"/></svg>';

  /* ============================================================
   * STYLES
   * ============================================================ */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.imp-etapas-section{position:relative;overflow:hidden;padding:96px 20px;background:linear-gradient(180deg,#06101e 0%,#0a1628 55%,#0d1f3c 100%);}',
      '.imp-etapas-section::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 22% 8%,rgba(6,182,212,.08) 0%,transparent 55%),radial-gradient(ellipse at 82% 92%,rgba(139,92,246,.08) 0%,transparent 55%);}',
      '.imp-etapas-container{position:relative;z-index:1;max-width:1200px;margin:0 auto;}',
      /* Header */
      '.imp-etapas-header{text-align:center;margin-bottom:56px;}',
      '.imp-etapas-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.25);border-radius:24px;padding:8px 20px;font-size:13px;font-weight:600;color:#22d3ee;margin-bottom:22px;text-transform:uppercase;letter-spacing:.8px;}',
      '.imp-etapas-badge svg{width:16px;height:16px;}',
      '.imp-etapas-header h2{font-size:2.8rem;font-weight:800;color:#fff;margin:0 0 16px;line-height:1.15;letter-spacing:-.02em;}',
      '.imp-etapas-grad{background:linear-gradient(135deg,#22d3ee,#6366f1 55%,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '.imp-etapas-sub{color:#cbd5e1;font-size:1.2rem;font-weight:600;max-width:760px;margin:0 auto 18px;line-height:1.55;}',
      '.imp-etapas-intro{color:#94a3b8;font-size:1.02rem;max-width:780px;margin:0 auto;line-height:1.7;}',
      /* Grid */
      '.imp-etapas-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1140px;margin:0 auto;align-items:stretch;}',
      '.imp-etapas-card{position:relative;display:flex;flex-direction:column;border-radius:22px;padding:30px 26px 28px;background:linear-gradient(180deg,rgba(15,32,52,.92) 0%,rgba(11,22,38,.96) 100%);border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 50px -24px rgba(0,0,0,.6);transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s,border-color .25s;}',
      '@media(hover:hover){.imp-etapas-card:hover{transform:translateY(-5px);border-color:rgba(34,211,238,.3);box-shadow:0 32px 64px -26px rgba(6,182,212,.4);}}',
      '.imp-etapas-card--e2{border-color:rgba(59,130,246,.28);}',
      '.imp-etapas-card--e3{border:1px solid transparent;background:linear-gradient(180deg,rgba(15,32,52,.94) 0%,rgba(11,22,38,.98) 100%) padding-box,linear-gradient(135deg,#22d3ee,#6366f1 55%,#a855f7) border-box;box-shadow:0 30px 64px -24px rgba(139,92,246,.4),0 0 0 1px rgba(168,85,247,.16) inset;}',
      /* Badges row */
      '.imp-etapas-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}',
      '.imp-etapas-stage{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 12px;border-radius:9999px;color:#fff;}',
      '.imp-etapas-card--e1 .imp-etapas-stage{background:linear-gradient(135deg,#0891b2,#06b6d4);}',
      '.imp-etapas-card--e2 .imp-etapas-stage{background:linear-gradient(135deg,#3b82f6,#6366f1);}',
      '.imp-etapas-card--e3 .imp-etapas-stage{background:linear-gradient(135deg,#8b5cf6,#a855f7);}',
      '.imp-etapas-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 12px;border-radius:9999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e2e8f0;}',
      /* Icon chip */
      '.imp-etapas-ico{width:52px;height:52px;border-radius:15px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}',
      '.imp-etapas-ico svg{width:26px;height:26px;color:#fff;}',
      '.imp-etapas-card--e1 .imp-etapas-ico{background:linear-gradient(135deg,#0891b2,#06b6d4);box-shadow:0 8px 24px rgba(8,145,178,.32);}',
      '.imp-etapas-card--e2 .imp-etapas-ico{background:linear-gradient(135deg,#3b82f6,#6366f1);box-shadow:0 8px 24px rgba(59,130,246,.32);}',
      '.imp-etapas-card--e3 .imp-etapas-ico{background:linear-gradient(135deg,#8b5cf6,#a855f7);box-shadow:0 8px 24px rgba(139,92,246,.32);}',
      '.imp-etapas-card h3{font-size:1.28rem;font-weight:800;color:#f8fafc;margin:0 0 10px;line-height:1.25;letter-spacing:-.01em;}',
      /* Price */
      '.imp-etapas-price{font-size:2rem;font-weight:800;color:#fff;line-height:1.1;margin:2px 0 2px;}',
      '.imp-etapas-card--e2 .imp-etapas-price{background:linear-gradient(135deg,#60a5fa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '.imp-etapas-card--e3 .imp-etapas-price{background:linear-gradient(135deg,#22d3ee,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '.imp-etapas-price--soft{font-size:1.25rem;font-weight:700;color:#67e8f9;}',
      '.imp-etapas-price-note{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin:0 0 14px;}',
      '.imp-etapas-desc{color:#94a3b8;font-size:.94rem;line-height:1.6;margin:0 0 16px;}',
      /* Bullets */
      '.imp-etapas-list{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:9px;}',
      '.imp-etapas-list li{display:flex;align-items:flex-start;gap:10px;color:#cbd5e1;font-size:.9rem;line-height:1.45;}',
      '.imp-etapas-list li svg{width:16px;height:16px;flex-shrink:0;margin-top:2px;}',
      '.imp-etapas-card--e2 .imp-etapas-list li svg{color:#60a5fa;}',
      '.imp-etapas-card--e3 .imp-etapas-list li svg{color:#c084fc;}',
      '.imp-etapas-fine{font-size:11.5px;color:#64748b;line-height:1.5;margin:0 0 18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);}',
      /* CTA */
      '.imp-etapas-cta{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:14px 20px;border-radius:13px;font-size:.98rem;font-weight:700;text-decoration:none;cursor:pointer;border:none;transition:transform .2s,box-shadow .2s,background .2s,border-color .2s;font-family:inherit;}',
      '.imp-etapas-cta svg{width:17px;height:17px;transition:transform .2s;}',
      '.imp-etapas-cta:hover svg{transform:translateX(3px);}',
      '.imp-etapas-cta--ghost{background:rgba(34,211,238,.1);color:#67e8f9;border:1px solid rgba(34,211,238,.3);}',
      '.imp-etapas-cta--ghost:hover{background:rgba(34,211,238,.18);color:#a5f3fc;transform:translateY(-2px);}',
      '.imp-etapas-cta--wa{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 8px 22px rgba(34,197,94,.32);}',
      '.imp-etapas-cta--wa:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(34,197,94,.42);}',
      '.imp-etapas-cta--wa svg:not(:hover){transform:none;}',
      '.imp-etapas-cta--primary{background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;box-shadow:0 8px 22px rgba(139,92,246,.35);}',
      '.imp-etapas-cta--primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(139,92,246,.45);}',
      /* Modular + fees panels */
      '.imp-etapas-panels{max-width:1140px;margin:32px auto 0;display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:stretch;}',
      '.imp-etapas-panel{border-radius:20px;padding:30px 28px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);}',
      '.imp-etapas-panel-head{display:flex;align-items:center;gap:14px;margin-bottom:16px;}',
      '.imp-etapas-panel-ico{width:46px;height:46px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.imp-etapas-panel-ico svg{width:22px;height:22px;}',
      '.imp-etapas-panel-ico--cyan{background:linear-gradient(135deg,rgba(6,182,212,.2),rgba(99,102,241,.2));color:#22d3ee;}',
      '.imp-etapas-panel-ico--amber{background:linear-gradient(135deg,rgba(245,158,11,.18),rgba(168,85,247,.18));color:#fbbf24;}',
      '.imp-etapas-panel h3{font-size:1.3rem;font-weight:800;color:#f8fafc;margin:0;letter-spacing:-.01em;}',
      '.imp-etapas-panel p{color:#94a3b8;font-size:.95rem;line-height:1.65;margin:0 0 18px;}',
      '.imp-etapas-panel p.imp-etapas-closing{margin:18px 0 0;color:#cbd5e1;font-weight:600;}',
      /* Price ladder */
      '.imp-etapas-ladder{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}',
      '.imp-etapas-ladder li{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;border-radius:13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);}',
      '.imp-etapas-ladder .imp-l-name{display:flex;align-items:center;gap:10px;color:#e2e8f0;font-size:.92rem;font-weight:600;}',
      '.imp-etapas-ladder .imp-l-step{width:24px;height:24px;flex-shrink:0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;}',
      '.imp-etapas-ladder li:nth-child(1) .imp-l-step{background:linear-gradient(135deg,#0891b2,#06b6d4);}',
      '.imp-etapas-ladder li:nth-child(2) .imp-l-step{background:linear-gradient(135deg,#3b82f6,#6366f1);}',
      '.imp-etapas-ladder li:nth-child(3) .imp-l-step{background:linear-gradient(135deg,#8b5cf6,#a855f7);}',
      '.imp-etapas-ladder .imp-l-price{font-size:.95rem;font-weight:800;color:#fff;white-space:nowrap;text-align:right;}',
      '.imp-etapas-ladder .imp-l-price.imp-l-soft{color:#94a3b8;font-weight:700;}',
      /* Fees list */
      '.imp-etapas-fees-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:11px;}',
      '.imp-etapas-fees-list li{display:flex;align-items:center;gap:11px;color:#cbd5e1;font-size:.93rem;}',
      '.imp-etapas-fees-list li::before{content:"";width:7px;height:7px;border-radius:9999px;background:linear-gradient(135deg,#fbbf24,#f59e0b);flex-shrink:0;}',
      /* Responsive */
      '@media(max-width:960px){',
      '  .imp-etapas-grid{grid-template-columns:1fr;max-width:520px;}',
      '  .imp-etapas-panels{grid-template-columns:1fr;max-width:560px;}',
      '}',
      '@media(max-width:768px){',
      '  .imp-etapas-section{padding:62px 16px;}',
      '  .imp-etapas-header{margin-bottom:40px;}',
      '  .imp-etapas-header h2{font-size:1.95rem;}',
      '  .imp-etapas-sub{font-size:1.06rem;}',
      '  .imp-etapas-intro{font-size:.98rem;}',
      '  .imp-etapas-card{padding:26px 22px 24px;}',
      '  .imp-etapas-panel{padding:26px 22px;}',
      '}',
      '@media(max-width:480px){',
      '  .imp-etapas-section{padding:46px 13px;}',
      '  .imp-etapas-header h2{font-size:1.6rem;line-height:1.2;}',
      '  .imp-etapas-sub{font-size:1rem;}',
      '  .imp-etapas-price{font-size:1.75rem;}',
      '  .imp-etapas-ladder li{flex-wrap:wrap;gap:6px;}',
      '}',
      '@media(prefers-reduced-motion:reduce){',
      '  .imp-etapas-card,.imp-etapas-cta,.imp-etapas-cta svg{transition:none !important;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ============================================================
   * MARKUP
   * ============================================================ */
  function bullets(items) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      html += '<li>' + iconCheck + '<span>' + items[i] + '</span></li>';
    }
    return html;
  }

  function buildSection() {
    var section = document.createElement('section');
    section.className = 'imp-etapas-section';
    section.id = SECTION_ID;
    section.setAttribute('aria-labelledby', 'imp-etapas-title');

    var compraBullets = [
      'Gestión con vendedor, broker o dealer.',
      'Apoyo en negociación y condiciones de compra.',
      'Coordinación general de documentación y pagos.',
      'Coordinación logística inicial en USA.',
      'Acompañamiento hasta dejar la unidad lista para avanzar a la siguiente etapa.'
    ];
    var fullBullets = [
      'Coordinación internacional de la operación.',
      'Acompañamiento documental y seguimiento.',
      'Coordinación con actores logísticos y de internación.',
      'Gestión de liberación y entrega final.',
      'Seguimiento hasta recepción en Santiago.'
    ];
    var feeBullets = [
      'Valor de la embarcación.',
      'Inspecciones o revisiones externas.',
      'Transportes, fletes o seguros.',
      'Impuestos, derechos y cargos asociados.',
      'Gastos de terceros necesarios para ejecutar la operación.'
    ];

    var waCompra = waLink('Hola, quiero solicitar la gestión de Compra y Logística USA (CLP $1.000.000) con IMPORLAN.');
    var waFull = waLink('Hola, quiero cotizar la Importación Full + Entrega Santiago (CLP $2.000.000) con IMPORLAN.');

    section.innerHTML = [
      '<div class="imp-etapas-container">',

      /* Header */
      '  <div class="imp-etapas-header">',
      '    <div class="imp-etapas-badge">' + iconLayers + 'Servicio por etapas</div>',
      '    <h2 id="imp-etapas-title">Avanza con IMPORLAN <span class="imp-etapas-grad">por etapas</span></h2>',
      '    <p class="imp-etapas-sub">Desde la búsqueda hasta la entrega en Santiago, tú decides hasta dónde quieres que te acompañemos.</p>',
      '    <p class="imp-etapas-intro">En IMPORLAN entendemos que cada cliente necesita un nivel distinto de apoyo. Por eso nuestro servicio está diseñado por etapas: puedes comenzar con un Plan de Búsqueda, avanzar luego con la compra y logística en USA, o delegar también la importación completa hasta recibir tu embarcación en Santiago, Chile.</p>',
      '  </div>',

      /* Cards */
      '  <div class="imp-etapas-grid">',

      /* Card 1 - Busqueda */
      '    <article class="imp-etapas-card imp-etapas-card--e1">',
      '      <div class="imp-etapas-badges"><span class="imp-etapas-stage">Etapa 1</span></div>',
      '      <span class="imp-etapas-ico">' + iconSearch + '</span>',
      '      <h3>1. Plan de Búsqueda IMPORLAN</h3>',
      '      <div class="imp-etapas-price imp-etapas-price--soft">Según plan vigente</div>',
      '      <p class="imp-etapas-price-note">Primera etapa de tu compra</p>',
      '      <p class="imp-etapas-desc">Para quienes aún están buscando la embarcación correcta. Te ayudamos a encontrar, filtrar y analizar oportunidades reales según tu presupuesto, tipo de embarcación y objetivo de uso.</p>',
      '      <a class="imp-etapas-cta imp-etapas-cta--ghost" data-scroll-planes href="#' + SECTION_ID + '">Ver planes de búsqueda' + iconArrow + '</a>',
      '    </article>',

      /* Card 2 - Compra y Logistica USA */
      '    <article class="imp-etapas-card imp-etapas-card--e2">',
      '      <div class="imp-etapas-badges"><span class="imp-etapas-stage">Etapa 2</span><span class="imp-etapas-tag">Compra en USA</span></div>',
      '      <span class="imp-etapas-ico">' + iconHandshake + '</span>',
      '      <h3>2. Compra y Logística USA</h3>',
      '      <div class="imp-etapas-price">CLP $1.000.000</div>',
      '      <p class="imp-etapas-price-note">Honorarios de gestión IMPORLAN</p>',
      '      <p class="imp-etapas-desc">Para clientes que ya tienen una embarcación seleccionada y quieren que IMPORLAN los acompañe en la gestión comercial de compra y coordinación inicial dentro de Estados Unidos.</p>',
      '      <ul class="imp-etapas-list">' + bullets(compraBullets) + '</ul>',
      '      <p class="imp-etapas-fine">No incluye valor de la embarcación ni costos de terceros asociados a la operación.</p>',
      '      <a class="imp-etapas-cta imp-etapas-cta--wa" href="' + waCompra + '" target="_blank" rel="noopener noreferrer">' + iconWhats + 'Solicitar gestión de compra</a>',
      '    </article>',

      /* Card 3 - Importacion Full + Entrega Santiago */
      '    <article class="imp-etapas-card imp-etapas-card--e3">',
      '      <div class="imp-etapas-badges"><span class="imp-etapas-stage">Etapa 3</span><span class="imp-etapas-tag">Hasta Santiago</span></div>',
      '      <span class="imp-etapas-ico">' + iconAnchor + '</span>',
      '      <h3>3. Importación Full + Entrega Santiago</h3>',
      '      <div class="imp-etapas-price">CLP $2.000.000</div>',
      '      <p class="imp-etapas-price-note">Honorarios de gestión IMPORLAN</p>',
      '      <p class="imp-etapas-desc">Para clientes que desean que IMPORLAN continúe con la coordinación completa posterior a la compra, hasta la entrega final de la embarcación en Santiago, Chile.</p>',
      '      <ul class="imp-etapas-list">' + bullets(fullBullets) + '</ul>',
      '      <p class="imp-etapas-fine">No incluye fletes, seguros, impuestos, gastos portuarios, aduaneros, transporte local ni otros costos de terceros.</p>',
      '      <a class="imp-etapas-cta imp-etapas-cta--primary" href="' + waFull + '" target="_blank" rel="noopener noreferrer">Cotizar importación completa' + iconArrow + '</a>',
      '    </article>',

      '  </div>',

      /* Panels: modular + fees */
      '  <div class="imp-etapas-panels">',

      '    <div class="imp-etapas-panel">',
      '      <div class="imp-etapas-panel-head"><span class="imp-etapas-panel-ico imp-etapas-panel-ico--cyan">' + iconLayers + '</span><h3>Puedes contratar solo lo que necesitas</h3></div>',
      '      <p>Si ya contrataste un Plan de Búsqueda y luego decides avanzar, puedes contratar únicamente la etapa siguiente. Si después quieres continuar con IMPORLAN hasta la entrega en Santiago, solo pagas el servicio correspondiente a la etapa pendiente.</p>',
      '      <ul class="imp-etapas-ladder">',
      '        <li><span class="imp-l-name"><span class="imp-l-step">1</span>Plan de Búsqueda</span><span class="imp-l-price imp-l-soft">Según plan vigente</span></li>',
      '        <li><span class="imp-l-name"><span class="imp-l-step">2</span>Compra y Logística USA</span><span class="imp-l-price">CLP $1.000.000</span></li>',
      '        <li><span class="imp-l-name"><span class="imp-l-step">3</span>Importación Full + Entrega Santiago</span><span class="imp-l-price">CLP $2.000.000</span></li>',
      '      </ul>',
      '      <p class="imp-etapas-closing">Así mantienes control del presupuesto y decides en cada etapa cuánto apoyo necesitas.</p>',
      '    </div>',

      '    <div class="imp-etapas-panel">',
      '      <div class="imp-etapas-panel-head"><span class="imp-etapas-panel-ico imp-etapas-panel-ico--amber">' + iconWallet + '</span><h3>Valores de gestión IMPORLAN</h3></div>',
      '      <p>Los valores publicados corresponden exclusivamente a honorarios de gestión IMPORLAN. Cada operación puede requerir costos externos según la embarcación, ubicación, dimensiones, destino y condiciones comerciales.</p>',
      '      <ul class="imp-etapas-fees-list">' + (function () {
        var h = '';
        for (var i = 0; i < feeBullets.length; i++) h += '<li>' + feeBullets[i] + '</li>';
        return h;
      })() + '</ul>',
      '    </div>',

      '  </div>',
      '</div>'
    ].join('\n');

    return section;
  }

  /* ============================================================
   * WIRING
   * ============================================================ */
  function findSectionByHeading(searchText) {
    var sections = document.querySelectorAll('section');
    for (var i = 0; i < sections.length; i++) {
      var heading = sections[i].querySelector('h2');
      if (heading && heading.textContent.toUpperCase().indexOf(searchText.toUpperCase()) !== -1) {
        return sections[i];
      }
    }
    return null;
  }

  function wireScrollToPlanes(section) {
    var btn = section.querySelector('[data-scroll-planes]');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var planes = findSectionByHeading('Planes de Busqueda');
      if (planes && planes.scrollIntoView) {
        planes.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function insertSection() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;
    if (document.getElementById(SECTION_ID)) return;

    var attempts = 0;
    var MAX_ATTEMPTS = 32; /* ~13s at 400ms */
    var iv = setInterval(function () {
      attempts++;
      if (document.getElementById(SECTION_ID)) { clearInterval(iv); return; }

      var ranking = document.getElementById('ranking-preview');
      var planes = findSectionByHeading('Planes de Busqueda');

      /* Need the plans section to exist (confirms we're on Home and React rendered). */
      if (!ranking && !planes) {
        if (attempts >= MAX_ATTEMPTS) clearInterval(iv);
        return;
      }

      /* Prefer to land right after the ranking-preview promo (which itself sits
       * right after the plans). Give that script a moment to insert; if it never
       * shows up, fall back to placing this section right after the plans. */
      var anchor = null;
      if (ranking) {
        anchor = ranking;
      } else if (planes && attempts >= 6) {
        anchor = planes;
      }
      if (!anchor) return; /* wait a few more cycles for ranking-preview */

      clearInterval(iv);
      injectStyles();
      var section = buildSection();
      anchor.insertAdjacentElement('afterend', section);
      wireScrollToPlanes(section);
    }, 400);

    setTimeout(function () { clearInterval(iv); }, 15000);
  }

  /* Run after the other home enhancers (nuevas-lineas 1500ms, ranking 2500ms). */
  onReady(function () {
    setTimeout(insertSection, 3000);
  });

})();
