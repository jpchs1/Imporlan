/* Imporlan home — Planes de Busqueda PRO enhancer
 * Idempotent + perf-tuned for mobile.
 *  - Tags the section + cards with stable hooks (data-imp-plan-card, .imp-plans-pro)
 *  - Injects scoped PRO styles (hero pill, glow blobs (desktop), gradient borders, hover lift)
 *  - Adds: "Más popular" ribbon, "Premium" ribbon, savings badge, help row
 *  - Stops listening as soon as the section is fully wired (no permanent observers)
 * Original React buttons / pricing logic are left untouched.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.__imporlanPlansPRO) return;
  window.__imporlanPlansPRO = true;
  // Kill-switch: load page with ?noenh=1 (or ?noenh=plans) to skip this enhancer.
  try {
    var __q = (location.search || '') + '|' + (location.hash || '');
    if (/[?&#]noenh(=1|=all|=plans)?(&|$|#|\|)/.test(__q)) return;
  } catch (e) {}

  var STYLE_ID = 'imp-plans-pro-style';
  var SECTION_CLASS = 'imp-plans-pro';
  var doneFlag = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.imp-plans-pro{position:relative;isolation:isolate;padding:56px 16px 64px !important;background:linear-gradient(180deg,#06101e 0%,#0a1628 50%,#06101e 100%) !important;overflow:hidden;}',
      '.imp-plans-pro::before{content:"";position:absolute;top:-160px;left:-120px;width:420px;height:420px;background:rgba(6,182,212,.16);border-radius:9999px;filter:blur(110px);pointer-events:none;z-index:0;will-change:auto;}',
      '.imp-plans-pro::after{content:"";position:absolute;bottom:-160px;right:-120px;width:380px;height:380px;background:rgba(99,102,241,.14);border-radius:9999px;filter:blur(110px);pointer-events:none;z-index:0;will-change:auto;}',
      '.imp-plans-pro > *{position:relative;z-index:1;}',
      '.imp-plans-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:9999px;background:rgba(34,211,238,.12);color:#67e8f9;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(34,211,238,.25);margin-bottom:14px;}',
      '.imp-plans-pill .imp-dot{width:6px;height:6px;border-radius:9999px;background:#22d3ee;animation:imp-pulse 1.6s infinite;}',
      '@keyframes imp-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
      '.imp-plans-pro h2{margin-top:8px !important;letter-spacing:-.02em !important;}',
      '.imp-plans-pro [data-imp-plan-card]{position:relative;border-radius:22px !important;background:linear-gradient(180deg,rgba(15,32,52,.85) 0%,rgba(11,22,38,.95) 100%) !important;border:1px solid rgba(255,255,255,.08) !important;box-shadow:0 24px 50px -22px rgba(0,0,0,.55) !important;transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s,border-color .25s !important;overflow:visible !important;}',
      '@media (hover:hover){.imp-plans-pro [data-imp-plan-card]:hover{transform:translateY(-4px) !important;border-color:rgba(34,211,238,.32) !important;box-shadow:0 30px 60px -22px rgba(6,182,212,.35) !important;}}',
      '.imp-plans-pro [data-imp-plan-card="capitan"]{border:1px solid transparent !important;background:linear-gradient(180deg,rgba(15,32,52,.92) 0%,rgba(11,22,38,.98) 100%) padding-box,linear-gradient(135deg,#22d3ee,#6366f1 60%,#8b5cf6) border-box !important;transform:translateY(-2px) scale(1.02) !important;box-shadow:0 30px 60px -22px rgba(6,182,212,.45),0 0 0 1px rgba(34,211,238,.18) inset !important;}',
      '@media (hover:hover){.imp-plans-pro [data-imp-plan-card="capitan"]:hover{transform:translateY(-6px) scale(1.02) !important;}}',
      '.imp-plans-pro [data-imp-plan-card="almirante"]{border:1px solid rgba(168,85,247,.22) !important;}',
      '@media (hover:hover){.imp-plans-pro [data-imp-plan-card="almirante"]:hover{border-color:rgba(168,85,247,.4) !important;box-shadow:0 30px 60px -22px rgba(139,92,246,.3) !important;}}',
      '.imp-plans-pro [data-imp-plan-card] h3,.imp-plans-pro [data-imp-plan-card] h4{letter-spacing:-.01em;}',
      '.imp-plans-ribbon{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#06b6d4,#6366f1);color:#fff;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:6px 14px;border-radius:9999px;box-shadow:0 12px 24px -8px rgba(6,182,212,.55);display:inline-flex;align-items:center;gap:6px;z-index:5;pointer-events:none;}',
      '.imp-plans-ribbon::before{content:"";display:inline-block;width:5px;height:5px;border-radius:9999px;background:#fff;}',
      '.imp-plans-ribbon-premium{background:linear-gradient(135deg,#a855f7,#6366f1);box-shadow:0 12px 24px -8px rgba(168,85,247,.5);}',
      '.imp-plans-saving{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.15);color:#6ee7b7;border:1px solid rgba(16,185,129,.3);font-size:11px;font-weight:700;letter-spacing:.06em;padding:4px 10px;border-radius:9999px;margin-left:8px;vertical-align:middle;}',
      '.imp-plans-saving svg{flex-shrink:0;}',
      '.imp-plans-help{max-width:980px;margin:36px auto 0;padding:18px 22px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;color:#cbd5e1;font-size:13.5px;}',
      '.imp-plans-help-text{display:flex;align-items:center;gap:10px;flex:1;min-width:240px;}',
      '.imp-plans-help-text strong{color:#fff;font-weight:600;}',
      '.imp-plans-help-icon{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,rgba(6,182,212,.2),rgba(99,102,241,.2));display:inline-flex;align-items:center;justify-content:center;color:#22d3ee;flex-shrink:0;}',
      '.imp-plans-help-actions{display:flex;flex-wrap:wrap;gap:8px;}',
      '.imp-plans-help-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:600;text-decoration:none;transition:transform .18s,background .18s,color .18s;}',
      '.imp-plans-help-btn-wa{background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.28);}',
      '.imp-plans-help-btn-wa:hover{background:rgba(34,197,94,.24);color:#bbf7d0;transform:translateY(-1px);}',
      '.imp-plans-help-btn-ghost{background:rgba(255,255,255,.06);color:#e2e8f0;border:1px solid rgba(255,255,255,.12);}',
      '.imp-plans-help-btn-ghost:hover{background:rgba(255,255,255,.10);color:#fff;border-color:rgba(255,255,255,.2);transform:translateY(-1px);}',
      '.imp-plans-trust{max-width:980px;margin:14px auto 28px;display:flex;flex-wrap:wrap;justify-content:center;gap:14px 22px;color:#94a3b8;font-size:12.5px;}',
      '.imp-plans-trust-item{display:inline-flex;align-items:center;gap:6px;}',
      '.imp-plans-trust-item svg{color:#22d3ee;flex-shrink:0;}',
      '@media (prefers-reduced-motion: reduce){',
      '  .imp-plans-pro [data-imp-plan-card]{transition:none !important;}',
      '  .imp-plans-pill .imp-dot{animation:none;}',
      '}',
      // === Mobile perf: drop the heavy blur layers, ease the gradient cards ===
      '@media(max-width:760px){',
      '  .imp-plans-pro::before,.imp-plans-pro::after{display:none !important;}',
      '  .imp-plans-pro [data-imp-plan-card="capitan"]{transform:none !important;}',
      '  .imp-plans-pro [data-imp-plan-card]{box-shadow:0 12px 26px -16px rgba(0,0,0,.55) !important;}',
      '  .imp-plans-pro{padding:36px 12px 44px !important;}',
      '  .imp-plans-help{padding:14px 16px;border-radius:14px;}',
      '  .imp-plans-ribbon{font-size:10px;padding:5px 11px;top:-10px;}',
      '  .imp-plans-trust{gap:8px 16px;font-size:12px;margin:10px auto 18px;}',
      '}',
      '@media(max-width:420px){',
      '  .imp-plans-pro{padding:28px 10px 36px !important;}',
      '  .imp-plans-pill{font-size:10.5px;padding:5px 12px;}',
      '  .imp-plans-saving{font-size:10px;padding:3px 8px;margin-left:6px;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function findHeading() {
    var nodes = document.querySelectorAll('h1,h2,h3');
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || '').trim();
      if (/Planes\s+de\s+B[uú]squeda/i.test(t)) return nodes[i];
    }
    return null;
  }

  function findSectionFromHeading(h) {
    var node = h;
    for (var i = 0; i < 8 && node; i++) {
      if (!node.parentElement) return node;
      var rect = node.getBoundingClientRect();
      if (rect.height > 320 && rect.width > 600) return node;
      node = node.parentElement;
    }
    return h.parentElement;
  }

  // TreeWalker-based card finder. Returns the first text node matching `re`,
  // then climbs to a card-sized ancestor. Cheaper than querySelectorAll('*').
  function findCardByText(section, re) {
    var walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return re.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var node = walker.nextNode();
    if (!node) return null;
    return climbToCard(node.parentElement, section);
  }

  function climbToCard(start, section) {
    var node = start;
    for (var i = 0; i < 10 && node && node !== section; i++) {
      var rect = node.getBoundingClientRect();
      if (rect.width >= 220 && rect.width <= 580 && rect.height >= 300 && rect.height <= 780) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function tagCards(section) {
    var keys = [
      { key: 'fragata', re: /Plan\s+Fragata/i },
      { key: 'capitan', re: /Plan\s+Capit[áa]n/i },
      { key: 'almirante', re: /Plan\s+Almirante/i }
    ];
    var tagged = 0;
    for (var i = 0; i < keys.length; i++) {
      var info = keys[i];
      if (section.querySelector('[data-imp-plan-card="' + info.key + '"]')) { tagged++; continue; }
      var card = findCardByText(section, info.re);
      if (card && !card.hasAttribute('data-imp-plan-card')) {
        card.setAttribute('data-imp-plan-card', info.key);
        addRibbon(card, info.key);
        addSavingBadge(card);
        tagged++;
      }
    }
    return tagged;
  }

  function addRibbon(card, key) {
    if (card.querySelector('.imp-plans-ribbon')) return;
    var label = '', extraClass = '';
    if (key === 'capitan') label = 'Más popular';
    else if (key === 'almirante') { label = 'Premium'; extraClass = 'imp-plans-ribbon-premium'; }
    else return;
    var span = document.createElement('span');
    span.className = 'imp-plans-ribbon ' + extraClass;
    span.textContent = label;
    card.appendChild(span);
  }

  function addSavingBadge(card) {
    if (card.querySelector('.imp-plans-saving')) return;
    var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
    var beforeAmount = null, anchor = null, node;
    while ((node = walker.nextNode())) {
      var m = (node.nodeValue || '').match(/Antes\s*\$([\d.,]+)/i);
      if (m && !beforeAmount) {
        beforeAmount = parseInt(m[1].replace(/[\.,]/g, ''), 10);
        anchor = node.parentElement;
        break;
      }
    }
    if (!beforeAmount) return;
    var priceMatch = (card.textContent || '').match(/\$([\d.,]+)\s*CLP/i);
    if (!priceMatch) return;
    var currentAmount = parseInt(priceMatch[1].replace(/[\.,]/g, ''), 10);
    if (!currentAmount || currentAmount >= beforeAmount) return;
    var pct = Math.round((1 - currentAmount / beforeAmount) * 100);
    if (pct < 5) return;
    var badge = document.createElement('span');
    badge.className = 'imp-plans-saving';
    badge.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Ahorro ' + pct + '%';
    if (anchor && anchor.parentElement) anchor.appendChild(badge);
  }

  function ensureHeroPill(section, heading) {
    if (section.querySelector('.imp-plans-pill')) return;
    var pill = document.createElement('div');
    pill.className = 'imp-plans-pill';
    pill.innerHTML = '<span class="imp-dot"></span>Buscamos por vos';
    pill.style.display = 'block';
    pill.style.textAlign = 'center';
    pill.style.margin = '0 auto 10px';
    pill.style.maxWidth = 'fit-content';
    if (heading && heading.parentElement) heading.parentElement.insertBefore(pill, heading);
  }

  function ensureTrustRow(section, heading) {
    if (section.querySelector('.imp-plans-trust')) return;
    var row = document.createElement('div');
    row.className = 'imp-plans-trust';
    row.innerHTML =
      '<span class="imp-plans-trust-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Búsqueda en concesionarios verificados USA</span>' +
      '<span class="imp-plans-trust-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Reportes en 7, 14 o 21 días</span>' +
      '<span class="imp-plans-trust-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Cancelá cuando quieras</span>';
    var anchor = heading;
    var sibling = heading && heading.nextElementSibling;
    while (sibling && (sibling.tagName === 'P' || sibling.tagName === 'DIV') && sibling.children.length < 3) {
      anchor = sibling;
      sibling = sibling.nextElementSibling;
    }
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(row, anchor.nextSibling);
  }

  function ensureHelpRow(section) {
    if (section.querySelector('.imp-plans-help')) return;
    var help = document.createElement('div');
    help.className = 'imp-plans-help';
    help.innerHTML =
      '<div class="imp-plans-help-text">' +
      '  <span class="imp-plans-help-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>' +
      '  <span><strong>¿No estás seguro qué plan elegir?</strong> Te ayudamos a decidir según tu presupuesto y tipo de embarcación.</span>' +
      '</div>' +
      '<div class="imp-plans-help-actions">' +
      '  <a href="https://wa.me/56940211459?text=Hola%2C%20quiero%20asesoria%20para%20elegir%20un%20Plan%20de%20Busqueda" target="_blank" rel="noopener noreferrer" class="imp-plans-help-btn imp-plans-help-btn-wa">' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 14.2c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5 1.7.7 2.4.8 3.3.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4z"/></svg>' +
      '    Pregúntanos por WhatsApp' +
      '  </a>' +
      '  <a href="/cotizador-importacion/" class="imp-plans-help-btn imp-plans-help-btn-ghost">' +
      '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
      '    Cotizar importación · $9.990' +
      '  </a>' +
      '</div>';
    section.appendChild(help);
  }

  function apply() {
    if (doneFlag) return true;
    var heading = findHeading();
    if (!heading) return false;
    var section = findSectionFromHeading(heading);
    if (!section) return false;
    section.classList.add(SECTION_CLASS);
    injectStyle();
    ensureHeroPill(section, heading);
    ensureTrustRow(section, heading);
    var tagged = tagCards(section);
    ensureHelpRow(section);
    if (tagged >= 3 && section.querySelector('.imp-plans-help')) {
      doneFlag = true;
    }
    return doneFlag;
  }

  function start() {
    if (apply()) return;
    var iv, mo, hardStop, pendingFrame = 0;

    function teardown() {
      if (iv) { clearInterval(iv); iv = null; }
      if (mo) { try { mo.disconnect(); } catch (e) {} mo = null; }
      if (hardStop) { clearTimeout(hardStop); hardStop = null; }
    }

    iv = setInterval(function () {
      if (apply()) teardown();
    }, 500);

    if (window.MutationObserver) {
      mo = new MutationObserver(function () {
        if (doneFlag) { teardown(); return; }
        if (pendingFrame) return;
        pendingFrame = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(function () {
          pendingFrame = 0;
          if (apply()) teardown();
        });
      });
      try { mo.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    }

    // Hard cap: never run longer than 12s regardless of result.
    hardStop = setTimeout(teardown, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
