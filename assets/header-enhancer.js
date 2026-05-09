/**
 * Imporlan - PRO Header Enhancer
 *
 * Single-file replacement for the React-bundle header until the home is
 * migrated to React. Renders a sticky, glassy header with:
 *
 *  - Brand block (logo + name + tagline)
 *  - Primary nav with active state + hover underline + dropdowns
 *    (Servicios, Recursos)
 *  - Live USD ticker (reads window.__imporlanUsdClp / dolar-updater.js
 *    fallbacks; updates every 60s)
 *  - "Cotizar gratis" primary CTA, "Iniciar sesion" ghost CTA,
 *    "Acceder al panel" icon CTA
 *  - Mobile hamburger + slide-in drawer with the full nav stacked,
 *    USD chip, social icons, CTAs
 *  - Hides the original bundle header(s) cleanly and pushes the body
 *    so content doesn't go under our fixed bar
 *  - MutationObserver keeps the old header hidden if React rerenders
 *  - Idempotent, a11y (skip-link target preserved, focus-visible
 *    outlines, prefers-reduced-motion respected, escape closes drawer)
 *
 * Loaded with `defer` from index.html.
 */
(function () {
  'use strict';

  if (window.__imporlanHeaderPRO) return;
  window.__imporlanHeaderPRO = true;

  var HEADER_ID = 'imp-pro-header';
  var STYLE_ID = 'imp-pro-header-style';
  var DRAWER_ID = 'imp-pro-drawer';
  var BACKDROP_ID = 'imp-pro-drawer-bd';
  var HEIGHT = 64; // px desktop
  var HEIGHT_MOBILE = 56;

  var NAV = [
    { label: 'Inicio', href: '/', exact: true },
    { label: 'Marketplace', href: '/marketplace/', badge: 'Hot' },
    {
      label: 'Servicios',
      dropdown: [
        { label: 'Cotizador online', href: '/cotizador-importacion/', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', tone: 'cyan' },
        { label: 'Cotizar importación', href: '/cotizar-importacion/', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', tone: 'cyan' },
        { label: 'Inspección pre-compra', href: '/inspeccion-precompra-embarcaciones/', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', tone: 'emerald' },
        { label: 'Transporte y logística', href: '/transporte-logistica-embarcaciones-chile/', icon: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11', tone: 'amber' },
        { label: 'Seguros náuticos', href: '/seguro-embarcaciones-chile/', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', tone: 'violet' },
        { label: 'Servicios completos', href: '/servicios-importacion/', icon: 'M3 7h18M3 12h18M3 17h18', tone: 'cyan' },
      ],
    },
    { label: 'Proceso', href: '/#proceso', anchor: 'proceso' },
    {
      label: 'Recursos',
      dropdown: [
        { label: 'Lanchas usadas en Chile', href: '/lanchas-usadas/', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', tone: 'cyan' },
        { label: 'Precios actualizados 2026', href: '/precio-lanchas-usadas-chile/', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', tone: 'amber', badge: '2026' },
        { label: 'Mejores lanchas usadas', href: '/mejores-lanchas-usadas-chile/', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', tone: 'amber' },
        { label: 'Marcas: Bayliner, Sea Ray', href: '/lanchas-usadas-marcas/', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', tone: 'cyan' },
        { label: 'Cómo comprar una lancha', href: '/como-comprar-lancha-usada-chile/', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', tone: 'emerald' },
        { label: 'Costo de mantención', href: '/costo-mantener-lancha-chile/', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', tone: 'amber' },
        { label: 'FAQ embarcaciones', href: '/preguntas-frecuentes-embarcaciones-usadas/', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', tone: 'violet' },
      ],
    },
    { label: 'Contacto', href: '/#contacto', anchor: 'contacto' },
  ];

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + HEADER_ID + ',#' + HEADER_ID + ' *{box-sizing:border-box;}',
      '#' + HEADER_ID + '{position:fixed;top:0;left:0;right:0;z-index:9990;height:' + HEIGHT + 'px;background:rgba(8,17,33,.65);backdrop-filter:blur(18px) saturate(180%);-webkit-backdrop-filter:blur(18px) saturate(180%);border-bottom:1px solid rgba(255,255,255,.06);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#cbd5e1;transition:background .25s,box-shadow .25s,border-color .25s;}',
      '#' + HEADER_ID + '.is-scrolled{background:rgba(8,17,33,.92);box-shadow:0 8px 24px -10px rgba(0,0,0,.5);border-bottom-color:rgba(255,255,255,.08);}',
      '#' + HEADER_ID + ' .imp-h-wrap{position:relative;max-width:1280px;margin:0 auto;padding:0 24px;height:100%;display:flex;align-items:center;gap:24px;}',

      // Brand
      '#' + HEADER_ID + ' .imp-h-brand{display:flex;align-items:center;gap:11px;text-decoration:none;flex-shrink:0;}',
      '#' + HEADER_ID + ' .imp-h-logo{position:relative;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#06b6d4,#0891b2 50%,#6366f1);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -6px rgba(6,182,212,.5),inset 0 1px 0 rgba(255,255,255,.18);transition:transform .2s,box-shadow .2s;}',
      '#' + HEADER_ID + ' .imp-h-logo::after{content:"";position:absolute;inset:1px;border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 60%);pointer-events:none;}',
      '#' + HEADER_ID + ' .imp-h-brand:hover .imp-h-logo{transform:translateY(-1px);box-shadow:0 12px 26px -6px rgba(6,182,212,.6);}',
      '#' + HEADER_ID + ' .imp-h-brand-text{display:flex;flex-direction:column;line-height:1;}',
      '#' + HEADER_ID + ' .imp-h-name{font-size:16px;font-weight:800;color:#fff;letter-spacing:-.02em;}',
      '#' + HEADER_ID + ' .imp-h-name span{background:linear-gradient(90deg,#22d3ee,#67e8f9);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      '#' + HEADER_ID + ' .imp-h-tag{font-size:10px;color:#64748b;font-weight:500;margin-top:3px;}',

      // Nav
      '#' + HEADER_ID + ' .imp-h-nav{display:flex;align-items:center;gap:2px;flex:1;justify-content:center;}',
      '#' + HEADER_ID + ' .imp-h-nav-item{position:relative;}',
      '#' + HEADER_ID + ' .imp-h-link{position:relative;display:inline-flex;align-items:center;gap:5px;padding:8px 12px;border-radius:10px;color:#cbd5e1;text-decoration:none;font-size:13.5px;font-weight:500;transition:color .15s,background .15s;cursor:pointer;}',
      '#' + HEADER_ID + ' .imp-h-link::after{content:"";position:absolute;left:50%;bottom:2px;width:0;height:2px;border-radius:2px;background:linear-gradient(90deg,#22d3ee,#6366f1);transition:width .2s,left .2s;}',
      '#' + HEADER_ID + ' .imp-h-link:hover{color:#fff;background:rgba(255,255,255,.04);}',
      '#' + HEADER_ID + ' .imp-h-link:hover::after,#' + HEADER_ID + ' .imp-h-nav-item.is-active > .imp-h-link::after{width:calc(100% - 24px);left:12px;}',
      '#' + HEADER_ID + ' .imp-h-nav-item.is-active > .imp-h-link{color:#fff;}',
      '#' + HEADER_ID + ' .imp-h-link svg.imp-h-caret{transition:transform .2s;}',
      '#' + HEADER_ID + ' .imp-h-nav-item.is-open > .imp-h-link svg.imp-h-caret{transform:rotate(180deg);}',
      '#' + HEADER_ID + ' .imp-h-badge{display:inline-flex;align-items:center;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-left:6px;border:1px solid;line-height:1.2;}',
      '#' + HEADER_ID + ' .imp-h-badge-hot{background:linear-gradient(135deg,rgba(244,63,94,.2),rgba(251,113,133,.2));color:#fda4af;border-color:rgba(244,63,94,.3);}',
      '#' + HEADER_ID + ' .imp-h-badge-new{background:linear-gradient(135deg,rgba(34,211,238,.2),rgba(99,102,241,.2));color:#67e8f9;border-color:rgba(34,211,238,.3);}',

      // Dropdown
      '#' + HEADER_ID + ' .imp-h-dropdown{position:absolute;top:calc(100% + 8px);left:0;min-width:300px;padding:8px;background:rgba(10,22,40,.95);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,.08);border-radius:14px;box-shadow:0 24px 60px -10px rgba(0,0,0,.6),0 0 0 1px rgba(34,211,238,.08);opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility .18s;z-index:1;}',
      '#' + HEADER_ID + ' .imp-h-nav-item.is-open .imp-h-dropdown{opacity:1;visibility:visible;transform:none;}',
      '#' + HEADER_ID + ' .imp-h-dd-item{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;text-decoration:none;color:#cbd5e1;font-size:13.5px;font-weight:500;line-height:1.3;transition:background .15s,color .15s;}',
      '#' + HEADER_ID + ' .imp-h-dd-item:hover{background:rgba(34,211,238,.08);color:#fff;}',
      '#' + HEADER_ID + ' .imp-h-dd-icon{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '#' + HEADER_ID + ' .imp-h-dd-icon.imp-tone-cyan{background:rgba(6,182,212,.14);color:#22d3ee;}',
      '#' + HEADER_ID + ' .imp-h-dd-icon.imp-tone-emerald{background:rgba(16,185,129,.14);color:#34d399;}',
      '#' + HEADER_ID + ' .imp-h-dd-icon.imp-tone-amber{background:rgba(245,158,11,.14);color:#fbbf24;}',
      '#' + HEADER_ID + ' .imp-h-dd-icon.imp-tone-violet{background:rgba(139,92,246,.14);color:#a78bfa;}',
      '#' + HEADER_ID + ' .imp-h-dd-text{flex:1;display:flex;align-items:center;gap:5px;}',

      // Right cluster
      '#' + HEADER_ID + ' .imp-h-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      // USD ticker
      '#' + HEADER_ID + ' .imp-h-usd{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:9999px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.22);color:#86efac;font-size:11.5px;font-weight:600;letter-spacing:.02em;}',
      '#' + HEADER_ID + ' .imp-h-usd-dot{width:6px;height:6px;border-radius:9999px;background:#22c55e;animation:imp-h-pulse 2s infinite;}',
      '@keyframes imp-h-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}',
      '#' + HEADER_ID + ' .imp-h-usd-label{color:#4ade80;font-weight:700;}',
      '#' + HEADER_ID + ' .imp-h-usd-val{color:#bbf7d0;}',
      // CTAs
      '#' + HEADER_ID + ' .imp-h-cta{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:11px;font-weight:600;font-size:13px;text-decoration:none;border:0;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s,color .2s;white-space:nowrap;}',
      '#' + HEADER_ID + ' .imp-h-cta-primary{background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;box-shadow:0 8px 22px -6px rgba(6,182,212,.45);}',
      '#' + HEADER_ID + ' .imp-h-cta-primary:hover{transform:translateY(-1px);box-shadow:0 12px 28px -6px rgba(6,182,212,.6);}',
      '#' + HEADER_ID + ' .imp-h-cta-ghost{background:transparent;color:#cbd5e1;border:1px solid rgba(255,255,255,.1);}',
      '#' + HEADER_ID + ' .imp-h-cta-ghost:hover{background:rgba(255,255,255,.05);color:#fff;border-color:rgba(255,255,255,.18);}',
      '#' + HEADER_ID + ' .imp-h-icon-btn{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;transition:all .2s;}',
      '#' + HEADER_ID + ' .imp-h-icon-btn:hover{background:rgba(34,211,238,.12);border-color:rgba(34,211,238,.3);color:#22d3ee;}',

      // Hamburger
      '#' + HEADER_ID + ' .imp-h-hamb{display:none;width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;cursor:pointer;align-items:center;justify-content:center;}',
      '#' + HEADER_ID + ' .imp-h-hamb:hover{background:rgba(34,211,238,.10);color:#22d3ee;}',
      '#' + HEADER_ID + ' .imp-h-hamb-icon{position:relative;width:18px;height:14px;display:flex;flex-direction:column;justify-content:space-between;}',
      '#' + HEADER_ID + ' .imp-h-hamb-icon::before,#' + HEADER_ID + ' .imp-h-hamb-icon::after,#' + HEADER_ID + ' .imp-h-hamb-icon span{content:"";display:block;height:2px;border-radius:2px;background:currentColor;width:100%;transition:transform .2s,opacity .2s;}',
      '#' + HEADER_ID + ' .imp-h-hamb-icon::before{content:"";}',
      '#' + HEADER_ID + ' .imp-h-hamb-icon::after{content:"";}',

      // Drawer
      '#' + BACKDROP_ID + '{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9991;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s;}',
      '#' + BACKDROP_ID + '.is-open{opacity:1;visibility:visible;}',
      '#' + DRAWER_ID + '{position:fixed;top:0;right:0;bottom:0;width:88%;max-width:380px;background:linear-gradient(180deg,#0a1628,#070f1c);z-index:9992;transform:translateX(100%);transition:transform .3s cubic-bezier(.32,.72,.24,1);box-shadow:-20px 0 60px -10px rgba(0,0,0,.5);display:flex;flex-direction:column;}',
      '#' + DRAWER_ID + '.is-open{transform:none;}',
      '#' + DRAWER_ID + ' .imp-d-head{padding:18px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06);}',
      '#' + DRAWER_ID + ' .imp-d-close{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '#' + DRAWER_ID + ' .imp-d-close:hover{color:#22d3ee;}',
      '#' + DRAWER_ID + ' .imp-d-body{flex:1;overflow-y:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:4px;}',
      '#' + DRAWER_ID + ' .imp-d-section{font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.18em;padding:14px 12px 6px;}',
      '#' + DRAWER_ID + ' .imp-d-link{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:11px;color:#cbd5e1;text-decoration:none;font-size:14px;font-weight:500;transition:background .15s,color .15s;}',
      '#' + DRAWER_ID + ' .imp-d-link:hover,#' + DRAWER_ID + ' .imp-d-link.is-active{background:rgba(34,211,238,.10);color:#22d3ee;}',
      '#' + DRAWER_ID + ' .imp-d-link .imp-h-dd-icon{width:30px;height:30px;border-radius:8px;}',
      '#' + DRAWER_ID + ' .imp-d-link svg.imp-h-arrow{margin-left:auto;color:#475569;}',
      '#' + DRAWER_ID + ' .imp-d-link:hover svg.imp-h-arrow{color:#22d3ee;}',
      '#' + DRAWER_ID + ' .imp-d-foot{padding:18px 20px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:10px;}',
      '#' + DRAWER_ID + ' .imp-d-cta{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;}',
      '#' + DRAWER_ID + ' .imp-d-cta-primary{background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;box-shadow:0 10px 24px -6px rgba(6,182,212,.45);}',
      '#' + DRAWER_ID + ' .imp-d-cta-secondary{background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.28);}',
      '#' + DRAWER_ID + ' .imp-d-foot-row{display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid rgba(255,255,255,.04);margin-top:6px;font-size:12px;color:#64748b;}',
      '#' + DRAWER_ID + ' .imp-d-foot-row a{color:#94a3b8;text-decoration:none;}',
      '#' + DRAWER_ID + ' .imp-d-foot-row a:hover{color:#22d3ee;}',

      // Body padding (we push the body so content does not slip under our fixed bar)
      'body.imp-h-installed{padding-top:' + HEIGHT + 'px;}',
      'body.imp-drawer-open{overflow:hidden;}',

      // Focus visible
      '#' + HEADER_ID + ' a:focus-visible,#' + HEADER_ID + ' button:focus-visible{outline:2px solid #22d3ee;outline-offset:3px;border-radius:6px;}',
      '#' + DRAWER_ID + ' a:focus-visible,#' + DRAWER_ID + ' button:focus-visible{outline:2px solid #22d3ee;outline-offset:3px;border-radius:6px;}',

      '@media (prefers-reduced-motion: reduce){#' + HEADER_ID + ' *,#' + DRAWER_ID + ' *,#' + BACKDROP_ID + '{transition:none!important;animation:none!important;}}',

      // Mobile / tablet breakpoints
      '@media (max-width: 1024px){',
      '  #' + HEADER_ID + '{height:' + HEIGHT_MOBILE + 'px;}',
      '  body.imp-h-installed{padding-top:' + HEIGHT_MOBILE + 'px;}',
      '  #' + HEADER_ID + ' .imp-h-nav,#' + HEADER_ID + ' .imp-h-cta-primary,#' + HEADER_ID + ' .imp-h-cta-ghost,#' + HEADER_ID + ' .imp-h-usd{display:none;}',
      '  #' + HEADER_ID + ' .imp-h-hamb{display:flex;}',
      '}',
      '@media (max-width: 480px){',
      '  #' + HEADER_ID + ' .imp-h-tag{display:none;}',
      '  #' + HEADER_ID + ' .imp-h-wrap{padding:0 14px;gap:12px;}',
      '}',
      // Mobile perf: lighter backdrop-filter to keep scrolling smooth on phones
      '@media (max-width: 760px){',
      '  #' + HEADER_ID + '{background:rgba(8,17,33,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}',
      '  #' + BACKDROP_ID + '{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;background:rgba(0,0,0,.65) !important;}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function arrow(size) {
    var sz = size || 12;
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';
  }

  function caret(size) {
    var sz = size || 11;
    return '<svg class="imp-h-caret" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  function badgeHtml(label) {
    if (!label) return '';
    var cls = label.toLowerCase() === 'hot' ? 'imp-h-badge-hot' : 'imp-h-badge-new';
    return '<span class="imp-h-badge ' + cls + '">' + label + '</span>';
  }

  function getCurrentPath() {
    return (location.pathname || '/').replace(/\/+$/, '/');
  }

  function isItemActive(item) {
    var p = getCurrentPath();
    if (item.exact) return p === '/';
    if (item.dropdown) {
      for (var i = 0; i < item.dropdown.length; i++) {
        var dd = item.dropdown[i];
        if (dd.href && p.indexOf(dd.href.replace(/\/+$/, '/')) === 0 && dd.href !== '/') return true;
      }
      return false;
    }
    if (!item.href) return false;
    if (item.anchor) return p === '/';
    return p.indexOf(item.href.replace(/\/+$/, '/')) === 0;
  }

  function buildNavItem(item) {
    var li = document.createElement('div');
    li.className = 'imp-h-nav-item' + (isItemActive(item) ? ' is-active' : '');
    var trigger = document.createElement('a');
    trigger.className = 'imp-h-link';
    trigger.href = item.href || '#';
    trigger.innerHTML = item.label + (item.badge ? badgeHtml(item.badge) : '') + (item.dropdown ? caret() : '');
    li.appendChild(trigger);

    if (item.dropdown) {
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var open = li.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        // Close siblings
        var siblings = li.parentNode.querySelectorAll('.imp-h-nav-item.is-open');
        for (var k = 0; k < siblings.length; k++) {
          if (siblings[k] !== li) {
            siblings[k].classList.remove('is-open');
            var t = siblings[k].querySelector('.imp-h-link');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        }
      });
      var menu = document.createElement('div');
      menu.className = 'imp-h-dropdown';
      menu.setAttribute('role', 'menu');
      for (var i = 0; i < item.dropdown.length; i++) {
        var dd = item.dropdown[i];
        var a = document.createElement('a');
        a.className = 'imp-h-dd-item';
        a.href = dd.href;
        a.setAttribute('role', 'menuitem');
        a.innerHTML = ''
          + '<span class="imp-h-dd-icon imp-tone-' + (dd.tone || 'cyan') + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + dd.icon + '"/></svg></span>'
          + '<span class="imp-h-dd-text">' + dd.label + (dd.badge ? badgeHtml(dd.badge) : '') + '</span>'
          + '<span style="opacity:.5">' + arrow(11) + '</span>';
        menu.appendChild(a);
      }
      li.appendChild(menu);
    }
    return li;
  }

  function buildHeader() {
    var header = document.createElement('header');
    header.id = HEADER_ID;
    header.setAttribute('role', 'banner');

    var wrap = document.createElement('div');
    wrap.className = 'imp-h-wrap';

    // Brand
    var brand = document.createElement('a');
    brand.className = 'imp-h-brand';
    brand.href = '/';
    brand.setAttribute('aria-label', 'Imporlan - inicio');
    brand.innerHTML = ''
      + '<div class="imp-h-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a8 8 0 008 4h4a8 8 0 008-4l-1-7-3 1-2-2-2 2-2-2-2 2-2-2-2 2-3-1z"/><path d="M5 13V8h14v5"/><path d="M12 8V3"/></svg></div>'
      + '<div class="imp-h-brand-text"><div class="imp-h-name">IMPOR<span>LAN</span></div><div class="imp-h-tag">Tu lancha, puerta a puerta</div></div>';
    wrap.appendChild(brand);

    // Nav
    var nav = document.createElement('nav');
    nav.className = 'imp-h-nav';
    nav.setAttribute('aria-label', 'Navegacion principal');
    for (var i = 0; i < NAV.length; i++) {
      nav.appendChild(buildNavItem(NAV[i]));
    }
    wrap.appendChild(nav);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'imp-h-actions';
    actions.innerHTML = ''
      + '<div class="imp-h-usd" id="imp-h-usd" title="Cotizacion del dolar"><span class="imp-h-usd-dot"></span><span class="imp-h-usd-label">USD</span><span class="imp-h-usd-val">--</span></div>'
      + '<a href="/panel/#/login" class="imp-h-cta imp-h-cta-ghost">Iniciar sesion</a>'
      + '<a href="/panel/" class="imp-h-cta imp-h-cta-primary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Mi panel<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></a>'
      + '<button class="imp-h-hamb" id="imp-h-hamb" aria-label="Abrir menu" aria-expanded="false" aria-controls="' + DRAWER_ID + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>';
    wrap.appendChild(actions);

    header.appendChild(wrap);
    return header;
  }

  function buildDrawer() {
    var bd = document.createElement('div');
    bd.id = BACKDROP_ID;

    var d = document.createElement('aside');
    d.id = DRAWER_ID;
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Menu principal');

    var head = '<div class="imp-d-head"><a class="imp-h-brand" href="/" aria-label="Inicio">'
      + '<div class="imp-h-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a8 8 0 008 4h4a8 8 0 008-4l-1-7-3 1-2-2-2 2-2-2-2 2-2-2-2 2-3-1z"/><path d="M5 13V8h14v5"/><path d="M12 8V3"/></svg></div>'
      + '<div class="imp-h-brand-text"><div class="imp-h-name">IMPOR<span>LAN</span></div><div class="imp-h-tag">Tu lancha, puerta a puerta</div></div>'
      + '</a><button class="imp-d-close" id="imp-d-close" aria-label="Cerrar menu"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';

    var body = '<div class="imp-d-body">';
    var p = getCurrentPath();
    for (var i = 0; i < NAV.length; i++) {
      var it = NAV[i];
      if (it.dropdown) {
        body += '<div class="imp-d-section">' + it.label + '</div>';
        for (var k = 0; k < it.dropdown.length; k++) {
          var dd = it.dropdown[k];
          var act = (dd.href && p.indexOf(dd.href.replace(/\/+$/, '/')) === 0 && dd.href !== '/') ? ' is-active' : '';
          body += '<a class="imp-d-link' + act + '" href="' + dd.href + '">'
            + '<span class="imp-h-dd-icon imp-tone-' + (dd.tone || 'cyan') + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + dd.icon + '"/></svg></span>'
            + '<span>' + dd.label + (dd.badge ? badgeHtml(dd.badge) : '') + '</span>'
            + '<svg class="imp-h-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>'
            + '</a>';
        }
      } else {
        var act2 = isItemActive(it) ? ' is-active' : '';
        body += '<a class="imp-d-link' + act2 + '" href="' + (it.href || '#') + '"><span class="imp-h-dd-icon imp-tone-cyan"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></span><span>' + it.label + (it.badge ? badgeHtml(it.badge) : '') + '</span></a>';
      }
    }
    body += '</div>';

    var foot = '<div class="imp-d-foot">'
      + '<a href="/panel/" class="imp-d-cta imp-d-cta-primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Acceder al panel<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></a>'
      + '<a href="https://wa.me/56940211459" target="_blank" rel="noopener" class="imp-d-cta imp-d-cta-secondary"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg> WhatsApp</a>'
      + '<div class="imp-d-foot-row"><span id="imp-h-usd-mob">USD --</span><a href="/panel/#/login">Iniciar sesion →</a></div>'
      + '</div>';

    d.innerHTML = head + body + foot;
    return [bd, d];
  }

  // Heuristic to detect the React bundle's header even when its class names
  // are minified ("_xX9aB"-style). Looks for an element that contains both
  // the brand text ("IMPORLAN") and at least 2 of the known nav labels,
  // sits within the first 200px of the viewport, and has a header-ish
  // height (24-160px). Then climbs to the smallest such candidate.
  var NAV_HINTS = ['Inicio', 'Servicios', 'Proceso', 'Contacto', 'Marketplace', 'Cotizar', 'Iniciar', 'Registrarse', 'Publicar'];

  function looksLikeOldHeader(node) {
    if (!node || !node.getBoundingClientRect) return false;
    if (node.id === HEADER_ID) return false;
    if (node.closest && (node.closest('#' + HEADER_ID) || node.closest('#' + DRAWER_ID))) return false;
    if (node.tagName === 'BODY' || node.tagName === 'HTML' || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return false;
    var bb = node.getBoundingClientRect();
    if (bb.height < 24 || bb.height > 200) return false;
    if (bb.top < -10 || bb.top > 220) return false;
    if (bb.width < 320) return false;
    var text = (node.textContent || '').slice(0, 600);
    if (!/IMPORLAN/i.test(text)) return false;
    var hits = 0;
    for (var i = 0; i < NAV_HINTS.length; i++) {
      if (text.indexOf(NAV_HINTS[i]) >= 0) hits++;
    }
    return hits >= 2;
  }

  function findOldHeaders() {
    var candidates = [];
    // 1) Standard semantic candidates
    var sem = document.querySelectorAll('header,[role="banner"],nav,[class*="Header"],[class*="-header"],[class*="Navbar"],[class*="navbar"]');
    for (var i = 0; i < sem.length; i++) {
      var n = sem[i];
      if (n.id === HEADER_ID) continue;
      if (n.closest && (n.closest('#' + HEADER_ID) || n.closest('#' + DRAWER_ID))) continue;
      if (looksLikeOldHeader(n)) candidates.push(n);
    }
    // 2) Heuristic scan: walk first ~300 elements inside #root looking for the
    //    smallest header-like container.
    var root = document.getElementById('root') || document.body;
    if (root) {
      var stack = [root];
      var visited = 0;
      while (stack.length && visited < 600) {
        var cur = stack.shift();
        visited++;
        if (cur && cur.children) {
          for (var j = 0; j < cur.children.length; j++) {
            var c = cur.children[j];
            if (looksLikeOldHeader(c)) {
              candidates.push(c);
              // Don't dive deeper into a candidate, prefer outer-most match
            } else {
              stack.push(c);
            }
          }
        }
      }
    }
    // De-dup + keep smallest-by-height matches per ancestor branch
    var seen = new Set ? new Set() : null;
    var out = [];
    for (var k = 0; k < candidates.length; k++) {
      var c = candidates[k];
      if (seen && seen.has(c)) continue;
      if (seen) seen.add(c);
      out.push(c);
    }
    return out;
  }

  function hideOldHeader() {
    var nodes = findOldHeaders();
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.dataset && n.dataset.impKeep) continue;
      n.style.setProperty('display', 'none', 'important');
      n.setAttribute('aria-hidden', 'true');
      n.classList.add('imp-h-hidden-by-enhancer');
    }
  }

  function attach() {
    if (document.getElementById(HEADER_ID)) return true;
    if (!document.body) return false;
    var h = buildHeader();
    var dd = buildDrawer();
    document.body.appendChild(h);
    document.body.appendChild(dd[0]);
    document.body.appendChild(dd[1]);
    document.body.classList.add('imp-h-installed');
    return true;
  }

  // ============================================
  // USD ticker
  // ============================================
  function fmtClp(v) {
    if (!v || isNaN(v)) return '--';
    return '$' + Math.round(v).toLocaleString('es-CL');
  }

  function setUsd(v) {
    var label = document.querySelector('#' + HEADER_ID + ' .imp-h-usd-val');
    if (label) label.textContent = fmtClp(v);
    var mob = document.getElementById('imp-h-usd-mob');
    if (mob) mob.textContent = 'USD ' + fmtClp(v);
  }

  // Reads any value already in the DOM (e.g. set by dolar-updater.js into
  // the cards "Dolar Observado" / "Dolar Compra" $X) so the header stays
  // in sync even before our fetch resolves.
  function readDolarFromDom() {
    // Strategy: find a node whose text starts with $ followed by 3-4 digits
    // and which sits inside or next to a label "Observado"/"Imporlan"/
    // "Compra"; prefer "Observado".
    var labels = document.querySelectorAll('div, span, p, h2, h3');
    var candidate = null;
    for (var i = 0; i < labels.length && i < 4000; i++) {
      var el = labels[i];
      var t = (el.textContent || '').trim();
      // Match a price like "$893" or "$1.005"
      if (!/^\$\s*[0-9]{3,4}([.,][0-9]{3})?$/.test(t)) continue;
      var n = parseFloat(t.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      if (isNaN(n) || n < 200 || n > 5000) continue;
      // Look for sibling/parent text matching the labels
      var ctx = '';
      try {
        var p = el.parentNode;
        ctx = p ? (p.textContent || '').slice(0, 200) : '';
      } catch (e) { /* ignore */ }
      if (/Observado/i.test(ctx)) return n; // strongest signal
      if (!candidate && /(D[óo]lar|USD)/i.test(ctx)) candidate = n;
    }
    return candidate;
  }

  function fetchDolar() {
    // Use the same endpoint the bundle's dolar-updater.js uses so the
    // header value matches exactly what the cards below show.
    fetch('/api/dolar.php', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        // Prefer dolar_observado (matches the "Dolar Observado" card).
        // Accept several shapes just in case.
        var v = j.dolar_observado || (j.data && j.data.dolar_observado) || j.observado || j.valor;
        v = Number(v);
        if (!isNaN(v) && v > 0) {
          window.__imporlanUsdClp = v;
          setUsd(v);
        }
      })
      .catch(function () {
        // Fallback to whatever the bundle already painted in the DOM
        var v = readDolarFromDom();
        if (v) setUsd(v);
      });
  }

  function startUsdTicker() {
    // Try DOM first for instant render; the API call follows
    var existing = readDolarFromDom();
    if (existing) setUsd(existing);
    fetchDolar();
    // Refresh every 60s
    setInterval(fetchDolar, 60000);
    // Re-sync from DOM periodically (catches the case where dolar-updater.js
    // resolves *after* our first fetch, or values change while staying on
    // the page)
    setInterval(function () { var v = readDolarFromDom(); if (v) setUsd(v); }, 4000);
  }

  // ============================================
  // Sticky scroll state + drawer + nav binding
  // ============================================
  function bindScroll() {
    var h = document.getElementById(HEADER_ID);
    if (!h) return;
    function onScroll() {
      if (window.scrollY > 16) h.classList.add('is-scrolled');
      else h.classList.remove('is-scrolled');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function openDrawer() {
    var bd = document.getElementById(BACKDROP_ID);
    var d = document.getElementById(DRAWER_ID);
    var hamb = document.getElementById('imp-h-hamb');
    if (!bd || !d) return;
    bd.classList.add('is-open');
    d.classList.add('is-open');
    document.body.classList.add('imp-drawer-open');
    if (hamb) hamb.setAttribute('aria-expanded', 'true');
    var firstLink = d.querySelector('a, button');
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function closeDrawer() {
    var bd = document.getElementById(BACKDROP_ID);
    var d = document.getElementById(DRAWER_ID);
    var hamb = document.getElementById('imp-h-hamb');
    if (!bd || !d) return;
    bd.classList.remove('is-open');
    d.classList.remove('is-open');
    document.body.classList.remove('imp-drawer-open');
    if (hamb) hamb.setAttribute('aria-expanded', 'false');
    if (hamb) hamb.focus({ preventScroll: true });
  }

  function bindDrawer() {
    var hamb = document.getElementById('imp-h-hamb');
    var bd = document.getElementById(BACKDROP_ID);
    var close = document.getElementById('imp-d-close');
    if (hamb && !hamb.dataset.impBound) {
      hamb.dataset.impBound = '1';
      hamb.addEventListener('click', openDrawer);
    }
    if (bd && !bd.dataset.impBound) {
      bd.dataset.impBound = '1';
      bd.addEventListener('click', closeDrawer);
    }
    if (close && !close.dataset.impBound) {
      close.dataset.impBound = '1';
      close.addEventListener('click', closeDrawer);
    }
    // Close drawer when a link inside is clicked (mobile UX)
    var d = document.getElementById(DRAWER_ID);
    if (d && !d.dataset.impLinkBound) {
      d.dataset.impLinkBound = '1';
      d.addEventListener('click', function (e) {
        var a = e.target.closest('a');
        if (!a) return;
        // If it's an in-page anchor (#proceso, #contacto), scroll smoothly after closing
        var href = a.getAttribute('href') || '';
        if (href.charAt(0) === '#' || href.indexOf('/#') === 0) {
          // Let default happen; close after a tick
          setTimeout(closeDrawer, 80);
        } else {
          closeDrawer();
        }
      });
    }
    // Escape to close
    if (!document.body.dataset.impEscBound) {
      document.body.dataset.impEscBound = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeDrawer();
      });
    }
  }

  // Outside-click closes desktop dropdowns
  function bindDropdownClose() {
    if (document.body.dataset.impDdBound) return;
    document.body.dataset.impDdBound = '1';
    document.addEventListener('click', function (e) {
      var open = document.querySelectorAll('#' + HEADER_ID + ' .imp-h-nav-item.is-open');
      for (var i = 0; i < open.length; i++) {
        if (!open[i].contains(e.target)) {
          open[i].classList.remove('is-open');
          var t = open[i].querySelector('.imp-h-link');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  function init() {
    injectStyles();

    var attached = attach();
    hideOldHeader();
    bindScroll();
    bindDrawer();
    bindDropdownClose();
    startUsdTicker();

    if (window.MutationObserver) {
      var pending = 0;
      var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
      var ob = new MutationObserver(function (mutations) {
        var ours = document.getElementById(HEADER_ID);
        var drw = document.getElementById(DRAWER_ID);
        var bd = document.getElementById(BACKDROP_ID);
        // Skip if every mutation came from our own header / drawer / backdrop
        if (ours) {
          var allInternal = true;
          for (var i = 0; i < mutations.length; i++) {
            var t = mutations[i].target;
            if (!t) continue;
            var inside = (t === ours || ours.contains(t) || (drw && (t === drw || drw.contains(t))) || (bd && t === bd));
            if (!inside) { allInternal = false; break; }
          }
          if (allInternal) return;
        }
        if (pending) return;
        pending = raf(function () {
          pending = 0;
          if (!document.getElementById(HEADER_ID)) {
            attach();
            bindScroll();
            bindDrawer();
            bindDropdownClose();
          }
          hideOldHeader();
        });
      });
      try { ob.observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
    }

    if (!attached) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (attach() || tries > 40) {
          clearInterval(iv);
          hideOldHeader();
          bindScroll();
          bindDrawer();
          bindDropdownClose();
        }
      }, 250);
    }

    // Belt-and-braces: reapply hideOldHeader for the first 6 seconds in case
    // the bundle mounts its header in batches the MutationObserver misses.
    var hideTries = 0;
    var hideIv = setInterval(function () {
      hideTries++;
      hideOldHeader();
      if (hideTries > 24) clearInterval(hideIv);
    }, 250);
    // And once more after window load (when fonts/images are settled and
    // any late layout pass has happened)
    window.addEventListener('load', function () { setTimeout(hideOldHeader, 100); setTimeout(hideOldHeader, 600); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
