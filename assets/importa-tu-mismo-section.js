/**
 * Imporlan — Sección Home "Importa tú mismo"
 * ---------------------------------------------------------------------
 * La sección estrella del Home: 3 planes de autogestión con material
 * descargable y compra online (WebPay / MercadoPago / PayPal / transferencia).
 *
 * Depende de assets/importa-tu-mismo-checkout.js (window.ImporlanDIY),
 * que provee el catálogo de planes y el modal de compra.
 *
 * Se inserta justo ANTES de "Planes de Búsqueda" para quedar en la zona
 * de mayor visibilidad del Home. Idempotente y con auto-apagado.
 *
 * Version 1.0
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__imporlanDIYSection) return;
  window.__imporlanDIYSection = true;

  /* Kill-switch: ?noenh=1 | ?noenh=all | ?noenh=diy */
  try {
    var q = (window.location.search || '') + '|' + (window.location.hash || '');
    if (/[?&#]noenh(=1|=all|=diy)?(&|$|#|\|)/.test(q)) return;
  } catch (e) { /* noop */ }

  var SECTION_ID = 'importa-tu-mismo';
  var STYLE_ID = 'imp-diy-section-style';

  function onReady(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }

  /* ============================================================
   * ICONOS
   * ==========================================================*/

  var ico = {
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><circle cx="17" cy="14" r="1.4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
  };

  /* ============================================================
   * ESTILOS
   * ==========================================================*/

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* ---- Shell ---- */
      '#' + SECTION_ID + '{position:relative;isolation:isolate;overflow:hidden;padding:104px 20px 108px;background:radial-gradient(120% 90% at 50% -10%,#0d2f52 0%,#0a1a30 45%,#050d1a 100%);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '#' + SECTION_ID + '::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 45% at 15% 0%,rgba(34,211,238,.20) 0%,transparent 60%),radial-gradient(ellipse 55% 45% at 88% 12%,rgba(139,92,246,.18) 0%,transparent 62%),radial-gradient(ellipse 70% 50% at 50% 108%,rgba(37,99,235,.16) 0%,transparent 65%);}',
      '#' + SECTION_ID + '::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:linear-gradient(rgba(148,197,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(148,197,255,.055) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 35%,#000 0%,transparent 78%);mask-image:radial-gradient(ellipse 75% 65% at 50% 35%,#000 0%,transparent 78%);}',
      // text-align explícito: la sección se inyecta dentro del árbol de React
      // y no debe heredar la alineación del contenedor que la aloje.
      '.impdiy-wrap{position:relative;z-index:2;max-width:1220px;margin:0 auto;text-align:left;}',

      /* ---- Header ---- */
      '.impdiy-head{text-align:center;margin-bottom:46px;}',
      '.impdiy-kicker{display:inline-flex;align-items:center;gap:9px;padding:8px 18px;border-radius:999px;background:linear-gradient(135deg,rgba(34,211,238,.16),rgba(139,92,246,.16));border:1px solid rgba(125,211,252,.34);color:#a5f3fc;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:22px;box-shadow:0 0 34px -8px rgba(34,211,238,.5);}',
      '.impdiy-kicker svg{width:15px;height:15px;}',
      '.impdiy-kicker .impdiy-live{width:7px;height:7px;border-radius:999px;background:#22d3ee;box-shadow:0 0 0 0 rgba(34,211,238,.7);animation:impdiy-pulse 2s infinite;}',
      '@keyframes impdiy-pulse{0%{box-shadow:0 0 0 0 rgba(34,211,238,.6)}70%{box-shadow:0 0 0 9px rgba(34,211,238,0)}100%{box-shadow:0 0 0 0 rgba(34,211,238,0)}}',
      '.impdiy-head h2{margin:0 0 18px;font-size:clamp(2.1rem,5.4vw,3.7rem);font-weight:900;line-height:1.06;letter-spacing:-.035em;color:#fff;text-wrap:balance;}',
      '.impdiy-grad{background:linear-gradient(105deg,#67e8f9 0%,#60a5fa 42%,#c084fc 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      '.impdiy-lead{max-width:760px;margin:0 auto 26px;color:#cbd5e1;font-size:clamp(1rem,1.9vw,1.18rem);line-height:1.68;text-wrap:pretty;}',
      '.impdiy-lead b{color:#fff;font-weight:700;}',

      /* ---- Métricas ---- */
      '.impdiy-stats{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-bottom:14px;}',
      '.impdiy-stat{display:inline-flex;align-items:center;gap:9px;padding:10px 17px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);color:#e2e8f0;font-size:13px;font-weight:600;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}',
      '.impdiy-stat svg{width:16px;height:16px;color:#22d3ee;flex-shrink:0;}',
      '.impdiy-stat b{color:#fff;font-weight:800;}',

      /* ---- Grid de planes ---- */
      '.impdiy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;align-items:stretch;margin:44px 0 0;}',
      '.impdiy-card{position:relative;display:flex;flex-direction:column;padding:34px 28px 30px;border-radius:26px;background:linear-gradient(180deg,rgba(17,36,60,.92) 0%,rgba(9,20,36,.97) 100%);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 66px -30px rgba(0,0,0,.85);transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s,border-color .3s;}',
      '@media(hover:hover){.impdiy-card:hover{transform:translateY(-7px);border-color:rgba(34,211,238,.38);box-shadow:0 40px 78px -30px rgba(6,182,212,.5);}}',
      '.impdiy-card--violet{border:1px solid transparent;background:linear-gradient(180deg,rgba(20,32,60,.95) 0%,rgba(10,18,36,.98) 100%) padding-box,linear-gradient(140deg,#22d3ee,#6366f1 48%,#c084fc) border-box;box-shadow:0 40px 82px -28px rgba(124,58,237,.55),0 0 0 1px rgba(168,85,247,.16) inset;transform:translateY(-10px);z-index:2;}',
      '@media(hover:hover){.impdiy-card--violet:hover{transform:translateY(-16px);}}',
      '.impdiy-card--gold{border-color:rgba(234,179,8,.28);}',
      '@media(hover:hover){.impdiy-card--gold:hover{border-color:rgba(234,179,8,.5);box-shadow:0 40px 78px -30px rgba(202,138,4,.45);}}',

      '.impdiy-ribbon{position:absolute;top:-14px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:7px;padding:7px 17px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:#fff;white-space:nowrap;background:linear-gradient(135deg,#06b6d4,#6366f1 55%,#a855f7);box-shadow:0 14px 30px -10px rgba(99,102,241,.75);z-index:3;}',
      '.impdiy-ribbon--gold{background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 14px 30px -10px rgba(217,119,6,.7);}',

      '.impdiy-card h3{margin:6px 0 4px;font-size:1.5rem;font-weight:800;color:#fff;letter-spacing:-.02em;}',
      '.impdiy-card-sub{margin:0 0 16px;font-size:13px;font-weight:600;color:#7dd3fc;letter-spacing:.01em;}',
      '.impdiy-card--gold .impdiy-card-sub{color:#fcd34d;}',
      '.impdiy-price-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;}',
      '.impdiy-amount{font-size:2.45rem;font-weight:900;color:#fff;letter-spacing:-.035em;line-height:1;}',
      '.impdiy-was{color:#64748b;text-decoration:line-through;font-size:1rem;font-weight:600;}',
      '.impdiy-off{background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.34);color:#6ee7b7;font-size:10.5px;font-weight:900;letter-spacing:.07em;padding:4px 9px;border-radius:999px;}',
      '.impdiy-payonce{margin:0 0 16px;font-size:12px;color:#94a3b8;font-weight:600;}',
      '.impdiy-ideal{margin:0 0 18px;padding:12px 14px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);font-size:13px;line-height:1.55;color:#cbd5e1;}',

      '.impdiy-feats{list-style:none;margin:0 0 16px;padding:0;flex-grow:1;}',
      '.impdiy-feats li{display:flex;gap:10px;align-items:flex-start;padding:7px 0;font-size:13.6px;line-height:1.5;color:#dbe4ef;}',
      '.impdiy-feats svg{width:15px;height:15px;flex-shrink:0;margin-top:3px;color:#34d399;}',
      '.impdiy-feats li.is-off{color:#7c8aa0;}',
      '.impdiy-feats li.is-off svg{color:#64748b;width:13px;height:13px;}',

      '.impdiy-docs-pill{display:flex;align-items:center;gap:10px;margin:0 0 18px;padding:12px 14px;border-radius:13px;background:linear-gradient(135deg,rgba(34,211,238,.12),rgba(99,102,241,.12));border:1px solid rgba(34,211,238,.24);color:#a5f3fc;font-size:12.6px;font-weight:700;line-height:1.4;}',
      '.impdiy-docs-pill svg{width:17px;height:17px;flex-shrink:0;}',
      '.impdiy-docs-pill b{color:#fff;}',

      '.impdiy-buy{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:16px 20px;border:none;border-radius:15px;font-family:inherit;font-size:15px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#0891b2,#2563eb 60%,#7c3aed);box-shadow:0 18px 38px -16px rgba(37,99,235,.8);transition:transform .22s,box-shadow .22s,filter .22s;}',
      '.impdiy-buy svg{width:17px;height:17px;transition:transform .22s;}',
      '.impdiy-buy:hover{transform:translateY(-2px);box-shadow:0 24px 48px -16px rgba(37,99,235,.9);filter:brightness(1.06);}',
      '.impdiy-buy:hover svg{transform:translateX(3px);}',
      '.impdiy-card--gold .impdiy-buy{background:linear-gradient(135deg,#d97706,#b45309 60%,#92400e);box-shadow:0 18px 38px -16px rgba(217,119,6,.75);}',
      '.impdiy-detail{display:block;text-align:center;margin-top:11px;font-size:12.5px;font-weight:600;color:#94a3b8;text-decoration:none;transition:color .2s;}',
      '.impdiy-detail:hover{color:#7dd3fc;}',

      /* ---- Biblioteca ---- */
      '.impdiy-lib{margin-top:56px;padding:34px 30px;border-radius:26px;background:linear-gradient(160deg,rgba(15,32,56,.86),rgba(8,17,32,.94));border:1px solid rgba(255,255,255,.09);}',
      '.impdiy-lib-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;}',
      '.impdiy-lib-head h3{margin:0 0 6px;font-size:1.42rem;font-weight:800;color:#fff;letter-spacing:-.02em;}',
      '.impdiy-lib-head p{margin:0;color:#94a3b8;font-size:14px;line-height:1.6;max-width:620px;}',
      '.impdiy-free{display:inline-flex;align-items:center;gap:9px;padding:14px 22px;border-radius:14px;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.34);color:#6ee7b7;font-size:13.5px;font-weight:800;text-decoration:none;white-space:nowrap;transition:background .22s,transform .22s,color .22s;}',
      '.impdiy-free:hover{background:rgba(52,211,153,.22);color:#bbf7d0;transform:translateY(-2px);}',
      '.impdiy-free svg{width:17px;height:17px;}',
      '.impdiy-lib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;}',
      '.impdiy-lib-item{display:flex;gap:12px;align-items:flex-start;padding:14px 15px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.075);transition:border-color .22s,background .22s;}',
      '.impdiy-lib-item:hover{border-color:rgba(34,211,238,.3);background:rgba(34,211,238,.06);}',
      '.impdiy-lib-ico{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(135deg,rgba(34,211,238,.2),rgba(99,102,241,.2));color:#67e8f9;}',
      '.impdiy-lib-ico svg{width:17px;height:17px;}',
      '.impdiy-lib-item h4{margin:0 0 3px;font-size:13.4px;font-weight:700;color:#f1f5f9;line-height:1.35;}',
      '.impdiy-lib-item p{margin:0;font-size:11.8px;color:#8fa0b5;line-height:1.45;}',
      '.impdiy-lib-tag{display:inline-block;margin-top:5px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#67e8f9;}',
      '.impdiy-lib-item--free .impdiy-lib-tag{color:#6ee7b7;}',

      /* ---- Comparativa / cierre ---- */
      '.impdiy-foot{margin-top:34px;display:grid;grid-template-columns:1.35fr 1fr;gap:20px;}',
      '.impdiy-panel{padding:26px 26px 24px;border-radius:22px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);}',
      '.impdiy-panel h4{margin:0 0 10px;font-size:1.08rem;font-weight:800;color:#fff;display:flex;align-items:center;gap:10px;}',
      '.impdiy-panel h4 svg{width:19px;height:19px;color:#22d3ee;}',
      '.impdiy-panel p{margin:0 0 12px;color:#a8b6c8;font-size:13.6px;line-height:1.68;}',
      '.impdiy-panel p:last-child{margin-bottom:0;}',
      '.impdiy-panel a{color:#7dd3fc;font-weight:600;text-decoration:none;}',
      '.impdiy-panel a:hover{text-decoration:underline;}',
      '.impdiy-pays{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}',
      '.impdiy-pay-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11);color:#cbd5e1;font-size:11.5px;font-weight:700;}',
      '.impdiy-pay-chip svg{width:13px;height:13px;color:#7dd3fc;}',
      '.impdiy-fine{margin-top:26px;text-align:center;color:#64748b;font-size:11.8px;line-height:1.7;max-width:900px;margin-left:auto;margin-right:auto;}',

      /* ---- Responsive ---- */
      '@media(max-width:1024px){',
      '  .impdiy-grid{grid-template-columns:1fr;max-width:560px;margin-left:auto;margin-right:auto;gap:34px;}',
      '  .impdiy-card--violet{transform:none;}',
      '  .impdiy-foot{grid-template-columns:1fr;}',
      '}',
      // Regla aparte (no anidada) para no romper el bloque anterior en parsers
      // que no soportan @media dentro de @media.
      '@media(max-width:1024px) and (hover:hover){.impdiy-card--violet:hover{transform:translateY(-7px);}}',
      '@media(max-width:768px){',
      '  #' + SECTION_ID + '{padding:64px 15px 68px;}',
      '  #' + SECTION_ID + '::after{display:none;}',
      '  .impdiy-lib{padding:24px 18px;}',
      '  .impdiy-lib-head{flex-direction:column;align-items:flex-start;}',
      '  .impdiy-free{width:100%;justify-content:center;}',
      '  .impdiy-card{padding:28px 22px 26px;}',
      '  .impdiy-stat{font-size:12px;padding:9px 14px;}',
      '  .impdiy-panel{padding:20px;}',
      '}',
      '@media(max-width:420px){',
      '  #' + SECTION_ID + '{padding:52px 12px 56px;}',
      '  .impdiy-amount{font-size:2.05rem;}',
      '  .impdiy-lib-grid{grid-template-columns:1fr;}',
      '}',
      '@media(prefers-reduced-motion:reduce){',
      '  .impdiy-card,.impdiy-buy,.impdiy-buy svg,.impdiy-free{transition:none !important;}',
      '  .impdiy-kicker .impdiy-live{animation:none;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ============================================================
   * MARKUP
   * ==========================================================*/

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cardHtml(plan, DIY) {
    var accentClass = plan.accent === 'violet' ? ' impdiy-card--violet' : (plan.accent === 'gold' ? ' impdiy-card--gold' : '');
    var off = plan.compareAt ? Math.round((1 - plan.price / plan.compareAt) * 100) : 0;
    var docs = DIY.planDocs(plan);

    var ribbon = '';
    if (plan.badge) {
      ribbon = '<span class="impdiy-ribbon' + (plan.accent === 'gold' ? ' impdiy-ribbon--gold' : '') + '">' + esc(plan.badge) + '</span>';
    }

    var feats = '';
    var i;
    for (i = 0; i < plan.features.length; i++) {
      feats += '<li>' + ico.check + '<span>' + esc(plan.features[i]) + '</span></li>';
    }
    for (i = 0; i < (plan.notIncluded || []).length; i++) {
      feats += '<li class="is-off">' + ico.cross + '<span>' + esc(plan.notIncluded[i]) + '</span></li>';
    }

    var pages = 0;
    for (i = 0; i < docs.length; i++) pages += (docs[i].pages || 0);

    return [
      '<article class="impdiy-card' + accentClass + '">',
      ribbon,
      '  <h3>' + esc(plan.name) + '</h3>',
      '  <p class="impdiy-card-sub">' + esc(plan.subtitle) + '</p>',
      '  <div class="impdiy-price-row">',
      '    <span class="impdiy-amount">' + DIY.clp(plan.price) + '</span>',
      plan.compareAt ? '    <span class="impdiy-was">' + DIY.clp(plan.compareAt) + '</span>' : '',
      off >= 5 ? '    <span class="impdiy-off">-' + off + '%</span>' : '',
      '  </div>',
      '  <p class="impdiy-payonce">CLP · pago único, sin suscripción</p>',
      '  <p class="impdiy-ideal">' + esc(plan.ideal) + '</p>',
      '  <div class="impdiy-docs-pill">' + ico.download + '<span><b>' + docs.length + ' documentos descargables</b> · ' + pages + '+ páginas listas para usar</span></div>',
      '  <ul class="impdiy-feats">' + feats + '</ul>',
      '  <button type="button" class="impdiy-buy" data-diy-plan="' + esc(plan.id) + '">Comprar ahora' + ico.arrow + '</button>',
      '  <a class="impdiy-detail" href="/importa-tu-mismo/#plan-' + esc(plan.id) + '">Ver el detalle completo del plan</a>',
      '</article>'
    ].join('\n');
  }

  function buildSection(DIY) {
    var section = document.createElement('section');
    section.id = SECTION_ID;
    section.setAttribute('aria-labelledby', 'impdiy-h2');

    var cards = '';
    for (var i = 0; i < DIY.PLANS.length; i++) cards += cardHtml(DIY.PLANS[i], DIY);

    var lib = '';
    var freeDoc = null;
    for (var j = 0; j < DIY.LIBRARY.length; j++) {
      var d = DIY.LIBRARY[j];
      if (d.free) { freeDoc = d; continue; }
      lib += [
        '<div class="impdiy-lib-item">',
        '  <span class="impdiy-lib-ico">' + ico.doc + '</span>',
        '  <div>',
        '    <h4>' + esc(d.title) + '</h4>',
        '    <p>' + esc(d.desc) + '</p>',
        '    <span class="impdiy-lib-tag">' + (d.kind === 'csv' ? 'Planilla CSV / Excel' : d.pages + ' páginas · PDF') + '</span>',
        '  </div>',
        '</div>'
      ].join('');
    }

    section.innerHTML = [
      '<div class="impdiy-wrap">',

      '  <div class="impdiy-head">',
      '    <span class="impdiy-kicker"><span class="impdiy-live"></span>' + ico.compass + 'Importa tú mismo</span>',
      '    <h2 id="impdiy-h2">Importa tu embarcación <span class="impdiy-grad">por tu cuenta</span><br>sin pagar de más</h2>',
      '    <p class="impdiy-lead">Te entregamos <b>todo el conocimiento que usamos internamente</b> para importar embarcaciones desde Estados Unidos a Chile: manuales, checklists, planillas de costos, formularios y trámites paso a paso. Tú gestionas, nosotros te enseñamos exactamente cómo hacerlo bien y <b>sin pagar de más</b>.</p>',
      '    <div class="impdiy-stats">',
      '      <span class="impdiy-stat">' + ico.wallet + '<span>Ahorra hasta <b>$2.000.000</b> en honorarios de gestión</span></span>',
      '      <span class="impdiy-stat">' + ico.doc + '<span>Hasta <b>10 documentos</b> descargables al instante</span></span>',
      '      <span class="impdiy-stat">' + ico.clock + '<span>Proceso real de <b>45 a 90 días</b></span></span>',
      '      <span class="impdiy-stat">' + ico.shield + '<span>Basado en <b>importaciones reales</b> de Imporlan</span></span>',
      '    </div>',
      '  </div>',

      '  <div class="impdiy-grid">' + cards + '</div>',

      '  <div class="impdiy-lib">',
      '    <div class="impdiy-lib-head">',
      '      <div>',
      '        <h3>La biblioteca completa del importador</h3>',
      '        <p>Todo el proceso documentado: qué revisar antes de comprar, cómo calcular el costo real puesto en Chile, qué papeles necesitas en cada etapa y cómo cerrar la matrícula en DIRECTEMAR.</p>',
      '      </div>',
      freeDoc ? '      <a class="impdiy-free" href="' + esc(freeDoc.file) + '" download>' + ico.download + 'Descargar mini-guía gratis</a>' : '',
      '    </div>',
      '    <div class="impdiy-lib-grid">' + lib + '</div>',
      '  </div>',

      '  <div class="impdiy-foot">',
      '    <div class="impdiy-panel">',
      '      <h4>' + ico.spark + 'Por qué conviene importar tú mismo</h4>',
      '      <p>Una embarcación importada desde USA suele costar entre <b>20% y 40% menos</b> que su equivalente en el mercado chileno. Ese ahorro se pierde cuando se pagan comisiones evitables, se elige mal el tipo de flete o se subvalora la carga y aduana la reliquida.</p>',
      '      <p>Estos planes existen para eso: que entiendas el proceso completo antes de mover un peso, negocies con información y controles cada costo desde el primer día.</p>',
      '      <p>¿Prefieres que lo hagamos por ti? Revisa el <a href="#avanza-por-etapas">servicio por etapas de Imporlan</a> o los <a href="/cotizador-importacion/">planes de búsqueda</a>.</p>',
      '    </div>',
      '    <div class="impdiy-panel">',
      '      <h4>' + ico.users + 'Compra 100% online</h4>',
      '      <p>Pagas con los mismos medios que el resto del sitio y recibes los accesos de descarga en tu email inmediatamente después de la confirmación del pago.</p>',
      '      <div class="impdiy-pays">',
      '        <span class="impdiy-pay-chip">' + ico.card + 'WebPay</span>',
      '        <span class="impdiy-pay-chip">' + ico.wallet + 'MercadoPago</span>',
      '        <span class="impdiy-pay-chip">' + ico.shield + 'PayPal</span>',
      '        <span class="impdiy-pay-chip">' + ico.wallet + 'Transferencia</span>',
      '      </div>',
      '    </div>',
      '  </div>',

      '  <p class="impdiy-fine">Los planes "Importa tú mismo" son servicios de información, capacitación y asesoría. No incluyen el valor de la embarcación, fletes, seguros, impuestos, derechos aduaneros, honorarios de agente de aduana ni gastos de terceros. Los valores de referencia (arancel 6%, IVA 19%, y demás) deben confirmarse siempre con el Servicio Nacional de Aduanas y DIRECTEMAR al momento de tu operación.</p>',

      '</div>'
    ].join('\n');

    return section;
  }

  /* ============================================================
   * INSERCIÓN
   * ==========================================================*/

  function findSectionByHeading(text) {
    var sections = document.querySelectorAll('section');
    for (var i = 0; i < sections.length; i++) {
      var h = sections[i].querySelector('h1,h2,h3');
      if (h && h.textContent.toUpperCase().indexOf(text.toUpperCase()) !== -1) return sections[i];
    }
    return null;
  }

  function isHome() {
    var p = window.location.pathname.replace(/\/+$/, '');
    return p === '' || p === '/test' || p === '/index.html' || p === '/test/index.html';
  }

  function insert() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;
    if (!isHome()) return;
    if (document.getElementById(SECTION_ID)) return;
    if (!window.ImporlanDIY) return;

    var attempts = 0;
    var MAX = 34; /* ~14s a 400ms */
    var iv = setInterval(function () {
      attempts++;
      if (document.getElementById(SECTION_ID)) { clearInterval(iv); return; }

      var planes = findSectionByHeading('Planes de B');
      var anchor = null;
      var mode = 'before';

      if (planes) {
        anchor = planes;
      } else if (attempts >= 10) {
        /* Fallback: después del primer bloque de contenido del Home. */
        var root = document.getElementById('root');
        var candidates = root ? root.querySelectorAll('section') : [];
        if (candidates.length > 1) { anchor = candidates[1]; mode = 'before'; }
        else if (candidates.length === 1) { anchor = candidates[0]; mode = 'after'; }
      }

      if (!anchor) {
        if (attempts >= MAX) clearInterval(iv);
        return;
      }

      clearInterval(iv);
      injectStyles();
      var section = buildSection(window.ImporlanDIY);
      if (mode === 'after') anchor.insertAdjacentElement('afterend', section);
      else anchor.insertAdjacentElement('beforebegin', section);

      wireEtapasLink(section);
    }, 400);

    setTimeout(function () { clearInterval(iv); }, 16000);
  }

  /* El enlace #avanza-por-etapas apunta a una sección que se inserta por JS
   * más tarde; hacemos scroll manual y con fallback a la landing. */
  function wireEtapasLink(section) {
    var link = section.querySelector('a[href="#avanza-por-etapas"]');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('avanza-por-etapas');
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.location.href = '/servicios-importacion/';
    });
  }

  /* Corre después de que React montó el Home (los otros enhancers usan 1.5-3s). */
  onReady(function () {
    setTimeout(insert, 1200);
  });
})();
