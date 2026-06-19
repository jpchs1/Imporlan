/**
 * Imporlan - PRO Footer Enhancer
 *
 * Single-file replacement for the React-rendered footer until the home
 * is migrated to React. Renders a richer, branded footer with:
 *
 *  - Pre-footer CTA strip (cotizar / WhatsApp)
 *  - Trust strip (4 items: pago seguro / respuesta 48-72h /
 *    servicio puerta a puerta / inspeccion certificada)
 *  - Main 5-column grid: brand + newsletter / servicios / recursos /
 *    empresa / contacto + CTA panel
 *  - Real social icons (WhatsApp / Instagram / YouTube / Facebook /
 *    Email)
 *  - Payment-method badges (Transbank / MercadoPago / PayPal /
 *    Transferencia)
 *  - Cross-domain partners (Deckeva, Deckeva Internacional, Muelles)
 *  - Bottom row: copyright + legal links + sitemap
 *  - Floating back-to-top button
 *  - Hides the original bundle footer cleanly (display:none) and
 *    re-applies the hide on every React re-render via MutationObserver
 *  - Idempotent + a11y (skip-to-content target, contentinfo role,
 *    focus-visible outlines, prefers-reduced-motion respected)
 *
 * Loaded with `defer` from index.html so it doesn't block paint.
 */
(function () {
  'use strict';

  if (window.__imporlanFooterPRO) return;
  window.__imporlanFooterPRO = true;
  // Kill-switch: load page with ?noenh=1 (or ?noenh=footer) to skip this enhancer.
  try {
    var __q = (location.search || '') + '|' + (location.hash || '');
    if (/[?&#]noenh(=1|=all|=footer)?(&|$|#|\|)/.test(__q)) return;
  } catch (e) {}

  var FOOTER_ID = 'imp-pro-footer';
  var STYLE_ID = 'imp-pro-footer-style';
  var TOP_BTN_ID = 'imp-pro-totop';

  var ARROW = '<svg class="imp-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      // Reset for our footer
      '#' + FOOTER_ID + ',#' + FOOTER_ID + ' *{box-sizing:border-box;}',
      '#' + FOOTER_ID + '{position:relative;background:#070f1c;color:#cbd5e1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;font-size:14px;}',
      // Top hairline accent
      '#' + FOOTER_ID + '::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(34,211,238,.5),rgba(99,102,241,.5),transparent);pointer-events:none;}',
      // Glow blobs
      '#' + FOOTER_ID + ' .imp-glow-a{position:absolute;top:-120px;right:-120px;width:360px;height:360px;background:rgba(6,182,212,.09);border-radius:9999px;filter:blur(90px);pointer-events:none;}',
      '#' + FOOTER_ID + ' .imp-glow-b{position:absolute;bottom:80px;left:-140px;width:340px;height:340px;background:rgba(99,102,241,.07);border-radius:9999px;filter:blur(90px);pointer-events:none;}',
      '#' + FOOTER_ID + ' .imp-wrap{position:relative;max-width:1200px;margin:0 auto;padding:0 24px;}',

      // CTA STRIP (pre-footer)
      '#' + FOOTER_ID + ' .imp-cta-strip{position:relative;margin:-1px auto 0;max-width:1200px;padding:28px 24px;background:linear-gradient(135deg,#0a1628 0%,#0e2a3d 50%,#0a1628 100%);border-radius:24px;transform:translateY(-50%);overflow:hidden;box-shadow:0 30px 60px -20px rgba(6,182,212,.2),0 0 0 1px rgba(34,211,238,.15);}',
      '#' + FOOTER_ID + ' .imp-cta-strip::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 0%,rgba(6,182,212,.18),transparent 60%);pointer-events:none;}',
      '#' + FOOTER_ID + ' .imp-cta-strip::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 0% 100%,rgba(99,102,241,.12),transparent 60%);pointer-events:none;}',
      '#' + FOOTER_ID + ' .imp-cta-inner{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}',
      '#' + FOOTER_ID + ' .imp-cta-text h2{margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1.2;}',
      '#' + FOOTER_ID + ' .imp-cta-text p{margin:6px 0 0;font-size:14px;color:#94a3b8;}',
      '#' + FOOTER_ID + ' .imp-cta-text .imp-cta-pill{display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;padding:4px 10px;border-radius:9999px;background:rgba(34,211,238,.12);color:#67e8f9;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;}',
      '#' + FOOTER_ID + ' .imp-cta-pill .imp-dot{width:6px;height:6px;border-radius:9999px;background:#22d3ee;animation:imp-pulse 1.6s infinite;}',
      '@keyframes imp-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}',
      '#' + FOOTER_ID + ' .imp-cta-actions{display:flex;gap:10px;flex-wrap:wrap;}',
      '#' + FOOTER_ID + ' .imp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:14px;font-weight:600;font-size:14px;text-decoration:none;border:0;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s,color .2s;white-space:nowrap;}',
      '#' + FOOTER_ID + ' .imp-btn-primary{background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;box-shadow:0 10px 25px -5px rgba(6,182,212,.4);}',
      '#' + FOOTER_ID + ' .imp-btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 30px -5px rgba(6,182,212,.55);}',
      '#' + FOOTER_ID + ' .imp-btn-secondary{background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.28);}',
      '#' + FOOTER_ID + ' .imp-btn-secondary:hover{background:rgba(34,197,94,.24);color:#bbf7d0;transform:translateY(-2px);}',

      // Pull main content up so CTA-strip overlap looks natural
      '#' + FOOTER_ID + ' .imp-main{padding:60px 0 0;margin-top:-40px;}',

      // TRUST STRIP
      '#' + FOOTER_ID + ' .imp-trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:18px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.06);margin-bottom:54px;}',
      '#' + FOOTER_ID + ' .imp-trust-item{display:flex;align-items:center;gap:12px;}',
      '#' + FOOTER_ID + ' .imp-trust-icon{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(34,211,238,.06));border:1px solid rgba(34,211,238,.18);display:flex;align-items:center;justify-content:center;color:#22d3ee;flex-shrink:0;}',
      '#' + FOOTER_ID + ' .imp-trust-title{font-size:13.5px;font-weight:600;color:#f1f5f9;line-height:1.2;}',
      '#' + FOOTER_ID + ' .imp-trust-sub{font-size:11.5px;color:#64748b;line-height:1.3;margin-top:3px;}',

      // MAIN GRID
      '#' + FOOTER_ID + ' .imp-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1.2fr;gap:48px;padding-bottom:40px;}',
      '#' + FOOTER_ID + ' .imp-col{min-width:0;}',

      // Brand
      '#' + FOOTER_ID + ' .imp-brand{display:flex;align-items:center;gap:14px;margin-bottom:18px;}',
      '#' + FOOTER_ID + ' .imp-logo{position:relative;width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#06b6d4 0%,#0891b2 50%,#6366f1 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px -8px rgba(6,182,212,.45),inset 0 1px 0 rgba(255,255,255,.2);}',
      '#' + FOOTER_ID + ' .imp-logo::after{content:"";position:absolute;inset:1px;border-radius:13px;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 60%);pointer-events:none;}',
      '#' + FOOTER_ID + ' .imp-brand-name{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1;}',
      '#' + FOOTER_ID + ' .imp-brand-name span{background:linear-gradient(90deg,#22d3ee,#67e8f9);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}',
      '#' + FOOTER_ID + ' .imp-brand-tag{font-size:11px;color:#64748b;font-weight:500;margin-top:5px;letter-spacing:.02em;}',
      '#' + FOOTER_ID + ' .imp-desc{font-size:13.5px;line-height:1.65;color:#94a3b8;margin:0 0 22px;max-width:340px;}',

      // Social
      '#' + FOOTER_ID + ' .imp-socials{display:flex;gap:8px;margin-bottom:26px;flex-wrap:wrap;}',
      '#' + FOOTER_ID + ' .imp-soc{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:#94a3b8;text-decoration:none;transition:transform .2s,background .2s,border-color .2s,color .2s;}',
      '#' + FOOTER_ID + ' .imp-soc:hover{transform:translateY(-2px);background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.4);color:#22d3ee;}',
      '#' + FOOTER_ID + ' .imp-soc.imp-soc-wa:hover{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.4);color:#4ade80;}',
      '#' + FOOTER_ID + ' .imp-soc.imp-soc-ig:hover{background:linear-gradient(135deg,rgba(244,114,182,.18),rgba(251,146,60,.18));border-color:rgba(244,114,182,.45);color:#f9a8d4;}',
      '#' + FOOTER_ID + ' .imp-soc.imp-soc-yt:hover{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.45);color:#fca5a5;}',
      '#' + FOOTER_ID + ' .imp-soc.imp-soc-fb:hover{background:rgba(59,130,246,.16);border-color:rgba(59,130,246,.45);color:#93c5fd;}',

      // Newsletter
      '#' + FOOTER_ID + ' .imp-news-card{padding:16px;border-radius:16px;background:linear-gradient(135deg,rgba(6,182,212,.10),rgba(99,102,241,.06));border:1px solid rgba(34,211,238,.18);}',
      '#' + FOOTER_ID + ' .imp-news-h{font-size:13px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px;margin:0 0 4px;}',
      '#' + FOOTER_ID + ' .imp-news-h svg{color:#22d3ee;}',
      '#' + FOOTER_ID + ' .imp-news-sub{font-size:12px;color:#94a3b8;margin:0 0 12px;line-height:1.5;}',
      '#' + FOOTER_ID + ' .imp-news-form{display:flex;gap:6px;}',
      '#' + FOOTER_ID + ' .imp-news-form input{flex:1;min-width:0;padding:10px 12px;background:rgba(15,23,42,.55);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#f1f5f9;font-size:13px;outline:none;transition:border-color .2s,background .2s;}',
      '#' + FOOTER_ID + ' .imp-news-form input::placeholder{color:#475569;}',
      '#' + FOOTER_ID + ' .imp-news-form input:focus{border-color:rgba(34,211,238,.55);background:rgba(15,23,42,.75);}',
      '#' + FOOTER_ID + ' .imp-news-form button{padding:10px 14px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;border:0;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:transform .15s,box-shadow .2s;}',
      '#' + FOOTER_ID + ' .imp-news-form button:hover{transform:translateY(-1px);box-shadow:0 8px 20px -4px rgba(6,182,212,.4);}',

      // Column titles
      '#' + FOOTER_ID + ' .imp-col-h{font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.18em;margin:0 0 18px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.06);position:relative;}',
      '#' + FOOTER_ID + ' .imp-col-h::after{content:"";position:absolute;left:0;bottom:-1px;width:30px;height:1px;background:linear-gradient(90deg,#22d3ee,transparent);}',

      // Lists
      '#' + FOOTER_ID + ' .imp-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}',
      '#' + FOOTER_ID + ' .imp-list a{color:#94a3b8;text-decoration:none;font-size:13.5px;line-height:1.45;display:inline-flex;align-items:center;gap:5px;transition:color .15s,gap .15s,padding-left .15s;}',
      '#' + FOOTER_ID + ' .imp-list a:hover{color:#22d3ee;gap:9px;}',
      '#' + FOOTER_ID + ' .imp-list a .imp-arrow{opacity:0;transition:opacity .15s,transform .15s;}',
      '#' + FOOTER_ID + ' .imp-list a:hover .imp-arrow{opacity:1;}',
      '#' + FOOTER_ID + ' .imp-badge-new{display:inline-flex;align-items:center;padding:1px 6px;border-radius:6px;background:linear-gradient(135deg,rgba(34,211,238,.2),rgba(99,102,241,.2));color:#67e8f9;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-left:6px;border:1px solid rgba(34,211,238,.25);}',
      '#' + FOOTER_ID + ' .imp-badge-hot{display:inline-flex;align-items:center;padding:1px 6px;border-radius:6px;background:linear-gradient(135deg,rgba(244,63,94,.2),rgba(251,113,133,.2));color:#fda4af;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-left:6px;border:1px solid rgba(244,63,94,.25);}',

      // Contact rows
      '#' + FOOTER_ID + ' .imp-contact{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;}',
      '#' + FOOTER_ID + ' .imp-contact-row{display:flex;align-items:flex-start;gap:11px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);text-decoration:none;color:inherit;transition:background .2s,border-color .2s,transform .15s;}',
      '#' + FOOTER_ID + ' a.imp-contact-row:hover{background:rgba(34,211,238,.07);border-color:rgba(34,211,238,.25);transform:translateX(2px);}',
      '#' + FOOTER_ID + ' .imp-contact-icon{width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;color:#22d3ee;flex-shrink:0;margin-top:1px;}',
      '#' + FOOTER_ID + ' .imp-contact-row.imp-wa .imp-contact-icon{color:#4ade80;background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.18);}',
      '#' + FOOTER_ID + ' .imp-contact-label{font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.16em;display:block;}',
      '#' + FOOTER_ID + ' .imp-contact-value{font-weight:600;color:#e2e8f0;font-size:13.5px;display:block;margin-top:2px;}',
      '#' + FOOTER_ID + ' .imp-contact-sub{font-size:11px;color:#64748b;display:block;margin-top:2px;}',
      '#' + FOOTER_ID + ' a.imp-contact-row:hover .imp-contact-value{color:#22d3ee;}',
      '#' + FOOTER_ID + ' a.imp-wa:hover .imp-contact-value{color:#4ade80;}',

      // Contact CTA
      '#' + FOOTER_ID + ' .imp-panel-cta{display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:13.5px;box-shadow:0 10px 26px -6px rgba(6,182,212,.4);transition:transform .2s,box-shadow .2s;}',
      '#' + FOOTER_ID + ' .imp-panel-cta:hover{transform:translateY(-2px);box-shadow:0 14px 32px -6px rgba(6,182,212,.55);}',

      // Payments strip
      '#' + FOOTER_ID + ' .imp-pay-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:18px 0;border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);}',
      '#' + FOOTER_ID + ' .imp-pay-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.18em;}',
      '#' + FOOTER_ID + ' .imp-pay-list{display:flex;flex-wrap:wrap;gap:8px;}',
      '#' + FOOTER_ID + ' .imp-pay-tag{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);color:#94a3b8;font-size:11.5px;font-weight:600;}',
      '#' + FOOTER_ID + ' .imp-pay-tag svg{flex-shrink:0;}',

      // Partners
      '#' + FOOTER_ID + ' .imp-partners{display:flex;flex-wrap:wrap;align-items:center;gap:18px;padding:18px 0;}',
      '#' + FOOTER_ID + ' .imp-partners-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.18em;}',
      '#' + FOOTER_ID + ' .imp-partners a{color:#94a3b8;text-decoration:none;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:5px;transition:color .15s;}',
      '#' + FOOTER_ID + ' .imp-partners a:hover{color:#22d3ee;}',
      '#' + FOOTER_ID + ' .imp-partners a::before{content:"";display:inline-block;width:6px;height:6px;border-radius:9999px;background:rgba(34,211,238,.5);}',

      // Bottom bar
      '#' + FOOTER_ID + ' .imp-bottom{padding:22px 0 28px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;}',
      '#' + FOOTER_ID + ' .imp-copy{font-size:12.5px;color:#64748b;}',
      '#' + FOOTER_ID + ' .imp-copy b{color:#cbd5e1;font-weight:600;}',
      '#' + FOOTER_ID + ' .imp-flag{display:inline-block;margin-left:4px;}',
      '#' + FOOTER_ID + ' .imp-legal{display:flex;flex-wrap:wrap;gap:18px;}',
      '#' + FOOTER_ID + ' .imp-legal a{color:#64748b;text-decoration:none;font-size:12.5px;transition:color .15s;}',
      '#' + FOOTER_ID + ' .imp-legal a:hover{color:#22d3ee;}',

      // Back to top
      '#' + TOP_BTN_ID + '{position:fixed;right:24px;bottom:24px;width:46px;height:46px;border-radius:9999px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 14px 32px -6px rgba(6,182,212,.5);opacity:0;visibility:hidden;transform:translateY(10px);transition:opacity .25s,transform .25s,visibility .25s,box-shadow .25s;z-index:9990;}',
      '#' + TOP_BTN_ID + '.is-visible{opacity:1;visibility:visible;transform:none;}',
      '#' + TOP_BTN_ID + ':hover{transform:translateY(-2px);box-shadow:0 18px 36px -6px rgba(6,182,212,.6);}',

      // Focus visible (a11y)
      '#' + FOOTER_ID + ' a:focus-visible,#' + FOOTER_ID + ' button:focus-visible,#' + FOOTER_ID + ' input:focus-visible{outline:2px solid #22d3ee;outline-offset:3px;border-radius:6px;}',

      // Reduced motion
      '@media (prefers-reduced-motion: reduce){#' + FOOTER_ID + ' *,#' + FOOTER_ID + ' *::before,#' + FOOTER_ID + ' *::after{animation:none!important;transition:none!important;}}',

      // Responsive
      '@media (max-width: 1100px){',
      '  #' + FOOTER_ID + ' .imp-grid{grid-template-columns:1fr 1fr 1fr;gap:36px;}',
      '  #' + FOOTER_ID + ' .imp-grid > .imp-col:first-child{grid-column:1 / -1;}',
      '}',
      '@media (max-width: 760px){',
      '  #' + FOOTER_ID + ' .imp-cta-strip{padding:22px 18px;border-radius:18px;}',
      '  #' + FOOTER_ID + ' .imp-cta-text h2{font-size:20px;}',
      '  #' + FOOTER_ID + ' .imp-trust{grid-template-columns:1fr 1fr;}',
      '  #' + FOOTER_ID + ' .imp-grid{grid-template-columns:1fr;gap:32px;}',
      '  #' + FOOTER_ID + ' .imp-bottom{flex-direction:column;align-items:flex-start;}',
      '  #' + TOP_BTN_ID + '{right:14px;bottom:14px;}',
      '}',
      '@media (max-width: 460px){',
      '  #' + FOOTER_ID + ' .imp-trust{grid-template-columns:1fr;}',
      '  #' + FOOTER_ID + ' .imp-cta-actions{width:100%;}',
      '  #' + FOOTER_ID + ' .imp-cta-actions .imp-btn{flex:1;justify-content:center;}',
      '}',
      // Mobile perf: drop the heavy blur layers entirely on phones
      '@media (max-width: 760px){',
      '  #' + FOOTER_ID + ' .imp-glow-a,#' + FOOTER_ID + ' .imp-glow-b{display:none !important;}',
      '  #' + FOOTER_ID + ' .imp-cta-strip::before,#' + FOOTER_ID + ' .imp-cta-strip::after{display:none !important;}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function buildFooter() {
    var year = new Date().getFullYear();
    var html = ''
      + '<div class="imp-glow-a"></div>'
      + '<div class="imp-glow-b"></div>'

      // Pre-footer CTA strip
      + '<section class="imp-wrap" aria-label="Cotizar importacion con el Cotizador Online">'
      + '  <div class="imp-cta-strip">'
      + '    <div class="imp-cta-inner">'
      + '      <div class="imp-cta-text">'
      + '        <span class="imp-cta-pill"><span class="imp-dot"></span>Cotizador Online</span>'
      + '        <h2>¿Listo para cotizar tu importación?</h2>'
      + '        <p>Cotizá tu lancha desde Estados Unidos en minutos con el <strong>Cotizador Online</strong>. Resultado puerta a puerta — flete, aduana, IVA y patente — por solo <strong>$9.990 CLP</strong>.</p>'
      + '      </div>'
      + '      <div class="imp-cta-actions">'
      + '        <a href="/cotizador-importacion/" class="imp-btn imp-btn-primary" aria-label="Ir al Cotizador Online por 9990 pesos">'
      + '          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      + '          Cotizar online · $9.990'
      + '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>'
      + '        </a>'
      + '        <a href="https://wa.me/56940211459?text=Hola%2C%20quiero%20cotizar%20una%20importacion%20de%20lancha" target="_blank" rel="noopener noreferrer" class="imp-btn imp-btn-secondary">'
      + '          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>'
      + '          WhatsApp'
      + '        </a>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</section>'

      // Main footer
      + '<div class="imp-main">'
      + '<div class="imp-wrap">'

      // Trust strip
      + '  <div class="imp-trust" role="list">'
      + '    <div class="imp-trust-item" role="listitem">'
      + '      <div class="imp-trust-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div>'
      + '      <div><div class="imp-trust-title">Pago 100% seguro</div><div class="imp-trust-sub">WebPay · MercadoPago · PayPal</div></div>'
      + '    </div>'
      + '    <div class="imp-trust-item" role="listitem">'
      + '      <div class="imp-trust-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>'
      + '      <div><div class="imp-trust-title">Respuesta en 48-72 hrs</div><div class="imp-trust-sub">Cotizaciones y soporte hábil</div></div>'
      + '    </div>'
      + '    <div class="imp-trust-item" role="listitem">'
      + '      <div class="imp-trust-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 7l3-4h12l3 4M3 7v14M21 7v14M8 11v6M16 11v6M12 11v6"/></svg></div>'
      + '      <div><div class="imp-trust-title">Servicio puerta a puerta</div><div class="imp-trust-sub">USA → Chile · LATAM</div></div>'
      + '    </div>'
      + '    <div class="imp-trust-item" role="listitem">'
      + '      <div class="imp-trust-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div>'
      + '      <div><div class="imp-trust-title">Inspección certificada</div><div class="imp-trust-sub">Pre-compra con foto y video</div></div>'
      + '    </div>'
      + '  </div>'

      // Main grid
      + '  <div class="imp-grid">'

      // Brand col
      + '    <div class="imp-col">'
      + '      <div class="imp-brand">'
      + '        <div class="imp-logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a8 8 0 008 4h4a8 8 0 008-4l-1-7-3 1-2-2-2 2-2-2-2 2-2-2-2 2-3-1z"/><path d="M5 13V8h14v5"/><path d="M12 8V3"/></svg></div>'
      + '        <div>'
      + '          <div class="imp-brand-name">IMPOR<span>LAN</span></div>'
      + '          <div class="imp-brand-tag">Tu lancha, puerta a puerta</div>'
      + '        </div>'
      + '      </div>'
      + '      <p class="imp-desc">Soluciones náuticas integrales con calidad y profesionalismo. Importamos lanchas usadas desde USA a Chile y Latinoamérica con servicio puerta a puerta y reportes en tiempo real.</p>'
      + '      <div class="imp-socials">'
      + '        <a href="https://wa.me/56940211459?text=Hola%2C%20tengo%20una%20consulta%20sobre%20Imporlan" target="_blank" rel="noopener noreferrer" class="imp-soc imp-soc-wa" aria-label="WhatsApp Imporlan" title="WhatsApp"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.36-.214-3.741.982.998-3.648-.235-.374A9.86 9.86 0 012.13 11.7c.003-5.45 4.437-9.884 9.92-9.884a9.825 9.825 0 017.013 2.91 9.825 9.825 0 012.9 7.013c-.002 5.45-4.436 9.886-9.913 9.886zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.892-11.893a11.821 11.821 0 00-3.479-8.413z"/></svg></a>'
      + '        <a href="https://www.instagram.com/imporlan.cl/" target="_blank" rel="noopener noreferrer" class="imp-soc imp-soc-ig" aria-label="Instagram Imporlan" title="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>'
      + '        <a href="https://www.youtube.com/@imporlan" target="_blank" rel="noopener noreferrer" class="imp-soc imp-soc-yt" aria-label="YouTube Imporlan" title="YouTube"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>'
      + '        <a href="https://www.facebook.com/imporlan" target="_blank" rel="noopener noreferrer" class="imp-soc imp-soc-fb" aria-label="Facebook Imporlan" title="Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>'
      + '        <a href="mailto:contacto@imporlan.cl" class="imp-soc" aria-label="Email Imporlan" title="Email"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></a>'
      + '      </div>'

      // Newsletter card
      + '      <div class="imp-news-card">'
      + '        <h4 class="imp-news-h"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg> Recibí ofertas exclusivas</h4>'
      + '        <p class="imp-news-sub">Las mejores oportunidades del marketplace y guías de importación, una vez por mes.</p>'
      + '        <form id="imp-news-form" class="imp-news-form" novalidate>'
      + '          <input type="email" name="email" placeholder="tu@email.com" aria-label="Email para newsletter" required>'
      + '          <button type="submit" aria-label="Suscribirse al newsletter">Suscribirme<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></button>'
      + '        </form>'
      + '      </div>'
      + '    </div>'

      // Servicios col
      + '    <nav class="imp-col" aria-label="Servicios">'
      + '      <h3 class="imp-col-h">Servicios</h3>'
      + '      <ul class="imp-list">'
      + '        <li><a href="/marketplace/">Marketplace de lanchas' + ARROW + '</a></li>'
      + '        <li><a href="/cotizador-importacion/">Cotizador online<span class="imp-badge-hot">Hot</span>' + ARROW + '</a></li>'
      + '        <li><a href="/cotizar-importacion/">Cotizar importación' + ARROW + '</a></li>'
      + '        <li><a href="/inspeccion-precompra-embarcaciones/">Inspección pre-compra' + ARROW + '</a></li>'
      + '        <li><a href="/transporte-logistica-embarcaciones-chile/">Transporte y logística' + ARROW + '</a></li>'
      + '        <li><a href="/seguro-embarcaciones-chile/">Seguros náuticos' + ARROW + '</a></li>'
      + '        <li><a href="/servicios-importacion/">Servicios completos' + ARROW + '</a></li>'
      + '      </ul>'
      + '    </nav>'

      // Recursos col
      + '    <nav class="imp-col" aria-label="Recursos y guias">'
      + '      <h3 class="imp-col-h">Recursos</h3>'
      + '      <ul class="imp-list">'
      + '        <li><a href="/lanchas-usadas/">Lanchas usadas en Chile' + ARROW + '</a></li>'
      + '        <li><a href="/precio-lanchas-usadas-chile/">Precios actualizados<span class="imp-badge-new">2026</span>' + ARROW + '</a></li>'
      + '        <li><a href="/mejores-lanchas-usadas-chile/">Mejores lanchas usadas' + ARROW + '</a></li>'
      + '        <li><a href="/lanchas-usadas-marcas/">Marcas: Bayliner, Sea Ray' + ARROW + '</a></li>'
      + '        <li><a href="/como-comprar-lancha-usada-chile/">Cómo comprar una lancha' + ARROW + '</a></li>'
      + '        <li><a href="/costo-mantener-lancha-chile/">Costo de mantención' + ARROW + '</a></li>'
      + '        <li><a href="/preguntas-frecuentes-embarcaciones-usadas/">FAQ embarcaciones' + ARROW + '</a></li>'
      + '      </ul>'
      + '    </nav>'

      // Empresa col
      + '    <nav class="imp-col" aria-label="Empresa">'
      + '      <h3 class="imp-col-h">Empresa</h3>'
      + '      <ul class="imp-list">'
      + '        <li><a href="/casos-de-importacion/">Casos de importación' + ARROW + '</a></li>'
      + '        <li><a href="/comprar-lanchas-usadas-en-chile-o-en-usa/">Chile vs USA' + ARROW + '</a></li>'
      + '        <li><a href="/tipos-de-lanchas-segun-uso/">Tipos de lanchas' + ARROW + '</a></li>'
      + '        <li><a href="/embarcaciones-usadas/">Catálogo embarcaciones' + ARROW + '</a></li>'
      + '        <li><a href="/lanchas-usadas-santiago/">Por región' + ARROW + '</a></li>'
      + '        <li><a href="/panel/">Acceso al panel' + ARROW + '</a></li>'
      + '      </ul>'
      + '    </nav>'

      // Contact col
      + '    <div class="imp-col">'
      + '      <h3 class="imp-col-h">Contacto</h3>'
      + '      <div class="imp-contact">'
      + '        <a href="mailto:contacto@imporlan.cl" class="imp-contact-row">'
      + '          <span class="imp-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></span>'
      + '          <span><span class="imp-contact-label">Email</span><span class="imp-contact-value">contacto@imporlan.cl</span></span>'
      + '        </a>'
      + '        <a href="https://wa.me/56940211459" target="_blank" rel="noopener" class="imp-contact-row imp-wa">'
      + '          <span class="imp-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg></span>'
      + '          <span><span class="imp-contact-label">WhatsApp</span><span class="imp-contact-value">Escríbenos directo</span><span class="imp-contact-sub">Atención Lun-Vie 09-19 · Sáb-Dom 10-19</span></span>'
      + '        </a>'
      + '        <div class="imp-contact-row imp-contact-locked" title="El teléfono directo se comparte al contratar un Plan de Búsqueda o un servicio">'
      + '          <span class="imp-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>'
      + '          <span><span class="imp-contact-label">Teléfono directo</span><span class="imp-contact-value" style="letter-spacing:2px">+56 9 •••• ••••</span><span class="imp-contact-sub" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.75;flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Exclusivo para clientes con plan o servicio activo</span></span>'
      + '        </div>'
      + '        <div class="imp-contact-row">'
      + '          <span class="imp-contact-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>'
      + '          <span><span class="imp-contact-label">Ubicación</span><span class="imp-contact-value">Santiago, Chile</span><span class="imp-contact-sub">Servicio en todo Chile y LATAM</span></span>'
      + '        </div>'
      + '      </div>'
      + '      <a href="/panel/" class="imp-panel-cta">'
      + '        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>'
      + '        Acceder al panel'
      + '        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>'
      + '      </a>'
      + '    </div>'

      + '  </div>' // /imp-grid

      // Payments + partners
      + '  <div class="imp-pay-row">'
      + '    <span class="imp-pay-label">Aceptamos</span>'
      + '    <div class="imp-pay-list">'
      + '      <span class="imp-pay-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 11h20"/></svg>WebPay (Transbank)</span>'
      + '      <span class="imp-pay-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>MercadoPago</span>'
      + '      <span class="imp-pay-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11l5-5 5 5"/><path d="M7 17l5-5 5 5"/></svg>PayPal</span>'
      + '      <span class="imp-pay-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11"/></svg>Transferencia</span>'
      + '    </div>'
      + '  </div>'

      + '  <div class="imp-partners">'
      + '    <span class="imp-partners-label">Nuestras divisiones</span>'
      + '    <a href="https://www.deckeva.cl/" target="_blank" rel="noopener noreferrer">Deck EVA</a>'
      + '    <a href="https://www.deckeva.com/" target="_blank" rel="noopener noreferrer">Deckeva Internacional</a>'
      + '    <a href="https://www.muelleflotante.cl/" target="_blank" rel="noopener noreferrer">Muelles Flotantes</a>'
      + '  </div>'

      // Bottom bar
      + '  <div class="imp-bottom">'
      + '    <div class="imp-copy">© ' + year + ' <b>Grupo Imporlan</b>. Todos los derechos reservados. Hecho con ❤ en Chile<span class="imp-flag" aria-hidden="true">🇨🇱</span></div>'
      + '    <nav class="imp-legal" aria-label="Enlaces legales">'
      + '      <a href="/terminos-y-condiciones/">Términos y Condiciones</a>'
      + '      <a href="/politica-de-privacidad/">Política de Privacidad</a>'
      + '      <a href="/sitemap.xml" target="_blank" rel="noopener">Mapa del sitio</a>'
      + '    </nav>'
      + '  </div>'

      + '</div>' // /imp-wrap
      + '</div>'; // /imp-main

    var foot = document.createElement('footer');
    foot.id = FOOTER_ID;
    foot.setAttribute('role', 'contentinfo');
    foot.innerHTML = html;

    // Back-to-top floats outside the footer flow but lives in this enhancer
    var btn = document.createElement('button');
    btn.id = TOP_BTN_ID;
    btn.setAttribute('aria-label', 'Volver arriba');
    btn.setAttribute('title', 'Volver arriba');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>';

    var frag = document.createDocumentFragment();
    frag.appendChild(foot);
    frag.appendChild(btn);
    return frag;
  }

  function hideOldFooter() {
    var nodes = document.querySelectorAll('footer:not(#' + FOOTER_ID + '),[class*="Footer"]:not(#' + FOOTER_ID + '),[class*="-footer"]:not(#' + FOOTER_ID + ')');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.id === FOOTER_ID) continue;
      if (n.closest && n.closest('#' + FOOTER_ID)) continue;
      // Avoid hiding Imporlan helper footers that aren't visual layout footers
      if (n.dataset && n.dataset.impKeep) continue;
      n.style.setProperty('display', 'none', 'important');
      n.setAttribute('aria-hidden', 'true');
    }
  }

  function attach() {
    if (document.getElementById(FOOTER_ID)) return true;
    if (!document.body) return false;
    var frag = buildFooter();
    document.body.appendChild(frag);
    return true;
  }

  function setupNewsletter() {
    var form = document.getElementById('imp-news-form');
    if (!form || form.dataset.impBound) return;
    form.dataset.impBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = (input && input.value || '').trim();
      if (!email || !/.+@.+\..+/.test(email)) {
        if (input) {
          input.style.borderColor = '#ef4444';
          input.focus();
          setTimeout(function () { input.style.borderColor = ''; }, 1600);
        }
        return;
      }
      var subject = encodeURIComponent('Suscripción newsletter Imporlan');
      var body = encodeURIComponent('Hola, quiero suscribirme al newsletter de Imporlan.\n\nEmail: ' + email + '\n\n(Enviado desde imporlan.cl)');
      window.location.href = 'mailto:contacto@imporlan.cl?subject=' + subject + '&body=' + body;
      form.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:10px 4px;font-size:12.5px;color:#4ade80"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Listo. Revisá tu cliente de email.</div>';
    });
  }

  function setupBackToTop() {
    var btn = document.getElementById(TOP_BTN_ID);
    if (!btn || btn.dataset.impBound) return;
    btn.dataset.impBound = '1';
    function onScroll() {
      if (window.scrollY > 600) btn.classList.add('is-visible');
      else btn.classList.remove('is-visible');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    });
  }

  function init() {
    injectStyles();

    var attached = attach();
    hideOldFooter();
    setupNewsletter();
    setupBackToTop();

    // Defensive: if React rerenders and removes our footer or re-adds the old one, fix it.
    // Throttled via rAF + ignores mutations originating inside our own footer to avoid feedback loops.
    if (window.MutationObserver) {
      var pending = 0;
      var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
      var ob = new MutationObserver(function (mutations) {
        var ours = document.getElementById(FOOTER_ID);
        // Skip if every mutation came from inside our footer
        if (ours) {
          var allInternal = true;
          for (var i = 0; i < mutations.length; i++) {
            var t = mutations[i].target;
            if (!t || (t !== ours && !ours.contains(t))) { allInternal = false; break; }
          }
          if (allInternal) return;
        }
        if (pending) return;
        pending = raf(function () {
          pending = 0;
          if (!document.getElementById(FOOTER_ID)) {
            attach();
            setupNewsletter();
            setupBackToTop();
          }
          hideOldFooter();
        });
      });
      try {
        ob.observe(document.body, { childList: true, subtree: true });
      } catch (e) { /* ignore */ }
    }

    // Retry attach if React mounted later than us
    if (!attached) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (attach() || tries > 40) {
          clearInterval(iv);
          hideOldFooter();
          setupNewsletter();
          setupBackToTop();
        }
      }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
