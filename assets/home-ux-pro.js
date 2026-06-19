/**
 * Imporlan - Home UX PRO layer
 * Adds premium, performance-safe UX polish to the HOME without touching content:
 *   1. Reading scroll-progress bar (top, gradient).
 *   2. Scroll-reveal for content sections (IntersectionObserver, fade + rise).
 *   3. Sticky mobile conversion bar (Cotizar + WhatsApp), coexisting with the
 *      existing back-to-top button (#imp-pro-totop).
 *
 * Safety: never permanently hides content (a fallback reveals everything after
 * a short timeout and if IntersectionObserver is unavailable), respects
 * prefers-reduced-motion, protects the hero (LCP), is idempotent, skips /panel,
 * and supports a ?noenh kill-switch. Uses a unique imp-uxpro-* namespace so it
 * never collides with the header/footer/plans/etapas enhancers.
 * Version 1.0
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__imporlanUxPro) return;
  window.__imporlanUxPro = true;
  if (window.location.pathname.indexOf('/panel') !== -1) return;
  try {
    var q = (location.search || '') + '|' + (location.hash || '');
    if (/[?&#]noenh(=1|=all|=uxpro)?(&|$|#|\|)/.test(q)) return;
  } catch (e) {}

  var STYLE_ID = 'imp-uxpro-styles';
  var prefersReduced = false;
  try { prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var hasIO = typeof window.IntersectionObserver === 'function';

  var WA = 'https://wa.me/56940211459?text=' + encodeURIComponent('Hola, quiero cotizar una importación de lancha con IMPORLAN.');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Fix pre-existing horizontal overflow caused by the off-canvas mobile drawer
         (and any off-screen decoration): clip the x-axis without affecting vertical scroll. */
      'html,body{overflow-x:hidden;max-width:100%;}',
      /* Scroll progress bar */
      '#imp-uxpro-progress{position:fixed;top:0;left:0;height:3px;width:100%;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,#22d3ee,#6366f1 60%,#a855f7);z-index:10000;pointer-events:none;will-change:transform;transition:transform .08s linear;}',
      '#imp-uxpro-progress::after{content:"";position:absolute;right:0;top:0;height:100%;width:60px;background:linear-gradient(90deg,transparent,rgba(168,85,247,.65));}',

      /* Scroll reveal (gated on <html>.imp-uxpro-on so no-JS / crawlers never hide content) */
      'html.imp-uxpro-on .imp-uxpro-reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);will-change:opacity,transform;}',
      'html.imp-uxpro-on .imp-uxpro-reveal.imp-uxpro-in{opacity:1;transform:none;}',
      '@media (prefers-reduced-motion: reduce){html.imp-uxpro-on .imp-uxpro-reveal{opacity:1 !important;transform:none !important;transition:none !important;}}',
      /* Card stagger (opacity-only so it never clobbers existing card transforms) */
      'html.imp-uxpro-on .imp-uxpro-card{opacity:0;transition:opacity .55s ease;will-change:opacity;}',
      'html.imp-uxpro-on .imp-uxpro-card.imp-uxpro-card-in{opacity:1;}',
      '@media (prefers-reduced-motion: reduce){html.imp-uxpro-on .imp-uxpro-card{opacity:1 !important;transition:none !important;}}',

      /* Sticky mobile conversion bar */
      '#imp-uxpro-cta{position:fixed;left:0;right:0;bottom:0;z-index:9989;display:none;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:rgba(7,15,28,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid rgba(34,211,238,.18);box-shadow:0 -10px 30px -12px rgba(0,0,0,.6);transform:translateY(120%);transition:transform .35s cubic-bezier(.16,1,.3,1);}',
      '#imp-uxpro-cta.imp-uxpro-cta-show{transform:translateY(0);}',
      '#imp-uxpro-cta a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:13px;font-weight:700;font-size:15px;text-decoration:none;font-family:inherit;-webkit-tap-highlight-color:transparent;}',
      '#imp-uxpro-cta a svg{width:18px;height:18px;flex-shrink:0;}',
      '#imp-uxpro-cta .imp-uxpro-quote{background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;box-shadow:0 8px 20px -6px rgba(6,182,212,.5);}',
      '#imp-uxpro-cta .imp-uxpro-wa{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 8px 20px -6px rgba(34,197,94,.5);}',
      '#imp-uxpro-cta .imp-uxpro-quote small{display:block;font-size:10px;font-weight:600;opacity:.85;margin-top:-2px;}',
      '@media (max-width:768px){',
      '  #imp-uxpro-cta{display:flex;}',
      '  body.imp-uxpro-cta-on{padding-bottom:70px;}',
      '  body.imp-uxpro-cta-on #imp-pro-totop{bottom:84px !important;}',
      '}',
      '@media (prefers-reduced-motion: reduce){#imp-uxpro-cta{transition:none;}}',

      /* ---- Phase 3 polish ---- */
      /* Anchor offset so in-page nav (#proceso, #contacto, ...) and scrollIntoView never hide under the fixed header */
      'html{scroll-padding-top:72px;}',
      '[id]{scroll-margin-top:72px;}',
      /* Branded text selection + crisper rendering */
      '::selection{background:rgba(34,211,238,.28);color:#fff;}',
      'body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}',
      'a,button{-webkit-tap-highlight-color:transparent;}',
      /* Accessible keyboard focus rings (only on keyboard nav) */
      'a:focus-visible,button:focus-visible,[tabindex]:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #22d3ee;outline-offset:2px;border-radius:5px;}',
      /* Subtle section delineation for visual rhythm (only on tagged top-level sections; never the hero) */
      'html.imp-uxpro-on .imp-uxpro-reveal{border-top:1px solid rgba(255,255,255,.045);}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- 1. Progress bar ---------- */
  function buildProgress() {
    if (document.getElementById('imp-uxpro-progress')) return;
    var bar = document.createElement('div');
    bar.id = 'imp-uxpro-progress';
    bar.setAttribute('aria-hidden', 'true');
    (document.body || document.documentElement).appendChild(bar);
    return bar;
  }

  /* ---------- 3. Sticky mobile CTA ---------- */
  function buildCta() {
    if (document.getElementById('imp-uxpro-cta')) return;
    var wrap = document.createElement('div');
    wrap.id = 'imp-uxpro-cta';
    wrap.setAttribute('aria-label', 'Acciones rápidas');
    wrap.innerHTML =
      '<a class="imp-uxpro-quote" href="/cotizador-importacion/">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>' +
      '<span>Cotizar<small>online · $9.990</small></span></a>' +
      '<a class="imp-uxpro-wa" href="' + WA + '" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 14.2c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5 1.7.7 2.4.8 3.3.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4z"/></svg>' +
      '<span>WhatsApp</span></a>';
    (document.body || document.documentElement).appendChild(wrap);
    return wrap;
  }

  /* ---------- 2. Scroll reveal ---------- */
  var io = null;
  function topLevelSections() {
    var all = document.querySelectorAll('section');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (s.parentElement && s.parentElement.closest('section')) continue; // skip nested
      out.push(s);
    }
    return out;
  }

  function tagSections() {
    if (!hasIO) return; // never gate/hide without IO support
    var secs = topLevelSections();
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (s.classList.contains('imp-uxpro-reveal')) continue;
      if (s.querySelector('h1')) { continue; }            // protect hero / LCP
      var r = s.getBoundingClientRect();
      if (r.height < 160) continue;                        // skip tiny utility sections
      s.classList.add('imp-uxpro-reveal');
      if (r.top < vh * 0.85) {                             // already in view -> show instantly (no flash)
        s.classList.add('imp-uxpro-in');
      } else {
        io.observe(s);
      }
    }
  }

  function startReveal() {
    if (!hasIO || prefersReduced) {
      document.documentElement.classList.add('imp-uxpro-on'); // CSS keeps reduced-motion visible
      return;
    }
    document.documentElement.classList.add('imp-uxpro-on');
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var t = entries[i].target;
          t.classList.add(t.classList.contains('imp-uxpro-card') ? 'imp-uxpro-card-in' : 'imp-uxpro-in');
          io.unobserve(t);
        }
      }
    }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    tagSections();
    tagCards();
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      tagSections();
      tagCards();
      if (tries >= 12) clearInterval(iv); // ~8.4s: covers late-injected sections
    }, 700);

    // Safety net: never leave anything hidden.
    setTimeout(function () {
      var hidden = document.querySelectorAll('.imp-uxpro-reveal:not(.imp-uxpro-in)');
      for (var i = 0; i < hidden.length; i++) hidden[i].classList.add('imp-uxpro-in');
      var hc = document.querySelectorAll('.imp-uxpro-card:not(.imp-uxpro-card-in)');
      for (var j = 0; j < hc.length; j++) hc[j].classList.add('imp-uxpro-card-in');
    }, 2600);
  }

  // Stagger card grids (opacity-only). Excludes .seo-page-card (it has its own
  // show/hide toggle) and never touches card transforms.
  var CARD_SEL = '.nuevas-lineas-card,.marketplace-feature,.imp-etapas-card,.rp-feature-item,.pc-step,[data-imp-plan-card],.benefit-card,.service-card,.eeat-card';
  function tagCards() {
    if (!hasIO) return;
    var cards = document.querySelectorAll(CARD_SEL);
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.classList.contains('imp-uxpro-card') || c.classList.contains('imp-uxpro-cseen')) continue;
      var r = c.getBoundingClientRect();
      if (r.height < 40) continue;
      if (r.top < vh * 0.92) { c.classList.add('imp-uxpro-cseen'); continue; } // already visible: leave as-is
      // stagger index = number of matching cards before it under the same parent
      var idx = 0, sib = c.previousElementSibling;
      while (sib) { if (sib.matches && sib.matches(CARD_SEL)) idx++; sib = sib.previousElementSibling; }
      c.classList.add('imp-uxpro-card');
      c.style.transitionDelay = (Math.min(idx, 6) * 70) + 'ms';
      io.observe(c);
    }
  }

  /* ---------- scroll handler (progress + CTA visibility) ---------- */
  function wireScroll(progress, cta) {
    var ticking = false;
    var footerEl = null;
    var isMobile = function () { return (window.innerWidth || 0) <= 768; };
    function getFooter() {
      if (!footerEl) footerEl = document.getElementById('imp-pro-footer') || document.querySelector('footer');
      return footerEl;
    }

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var st = window.pageYOffset || doc.scrollTop || 0;
      var vh = window.innerHeight || doc.clientHeight || 800;
      var max = (doc.scrollHeight - vh) || 1;
      var ratio = Math.min(1, Math.max(0, st / max));
      if (progress) progress.style.transform = 'scaleX(' + ratio + ')';

      if (cta) {
        // Hide the bar once the footer enters the viewport so it never covers
        // the footer's own CTA (and to avoid redundancy at the very bottom).
        var f = getFooter();
        var footerVisible = false;
        if (f) { footerVisible = f.getBoundingClientRect().top < (vh - 40); }
        var show = isMobile() && st > 620 && !footerVisible;
        if (show) {
          cta.classList.add('imp-uxpro-cta-show');
          document.body.classList.add('imp-uxpro-cta-on');
        } else {
          cta.classList.remove('imp-uxpro-cta-show');
          document.body.classList.remove('imp-uxpro-cta-on');
        }
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(update);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  function init() {
    injectStyles();
    var progress = buildProgress();
    var cta = buildCta();
    wireScroll(progress, cta);
    startReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
