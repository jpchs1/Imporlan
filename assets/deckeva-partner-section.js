/**
 * Imporlan — Home: partner DECKEVA (pisos de goma EVA antideslizante)
 * ---------------------------------------------------------------------
 * Dos piezas en las zonas de más alcance del Home:
 *   1. Franja destacada justo debajo de la portada (#inicio).
 *   2. Sección completa después de "Por qué elegir Imporlan" (#servicios),
 *      antes de "Guías y Recursos".
 *
 * Datos tomados de deckeva.cl (500+ embarcaciones, 4.9★, EVA 6 mm, adhesivo
 * 3M, UV, fabricación 10–15 días, hecho en Chile, envíos a 14+ países). Los
 * enlaces llevan UTM para medir en deckeva.cl lo que llega desde Imporlan.
 *
 * Idempotente, sólo en el Home, y con kill-switch: ?noenh=deckeva | ?noenh=all
 * Version 1.0
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__imporlanDeckeva) return;
  window.__imporlanDeckeva = true;

  try {
    var q = (window.location.search || '') + '|' + (window.location.hash || '');
    if (/[?&#]noenh(=1|=all|=deckeva)?(&|$|#|\|)/.test(q)) return;
  } catch (e) { /* noop */ }

  var SECTION_ID = 'deckeva-partner';
  var STRIP_ID = 'deckeva-strip';
  var STYLE_ID = 'deckeva-partner-style';

  var UTM = 'utm_source=imporlan&utm_medium=home&utm_campaign=partner_deckeva';
  var URL_COTIZADOR = 'https://deckeva.cl/cotizador/?' + UTM + '&utm_content=';
  var URL_PROYECTOS = 'https://deckeva.cl/proyectos/?' + UTM + '&utm_content=proyectos';
  var URL_HOME = 'https://deckeva.cl/?' + UTM + '&utm_content=';
  var URL_INTL = 'https://deckeva.com/?' + UTM + '&utm_content=internacional';
  var WA = 'https://wa.me/56940211459?text=' + encodeURIComponent(
    'Hola! Vengo desde Imporlan y quiero cotizar un piso de goma EVA antideslizante DECKEVA para mi embarcación.'
  );

  var IMG = 'https://deckeva.cl/wp-content/uploads/';
  var GALLERY = [
    { src: IMG + '2024/08/piso-de-lancha.jpg', alt: 'Piso de goma EVA antideslizante DECKEVA instalado en lancha' },
    { src: IMG + '2024/09/Lancha-Monterey-258SS-%E2%80%93-Deckeva-principal-1024x576.jpg', alt: 'Lancha Monterey 258SS con piso DECKEVA' },
    { src: IMG + '2024/08/pisos-antideslizante.jpg', alt: 'Detalle de piso antideslizante de goma EVA para embarcaciones' },
    { src: IMG + '2021/01/Lancha-Starcratf-principal-1024x576.jpg', alt: 'Lancha Starcraft renovada con piso DECKEVA' },
    { src: IMG + '2024/08/Pisos-de-goma-eva-para-embarcaciones.jpg', alt: 'Pisos de goma EVA para embarcaciones fabricados a medida' }
  ];

  function onReady(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }

  function isHome() {
    var p = window.location.pathname.replace(/\/+$/, '');
    return p === '' || p === '/test' || p === '/index.html' || p === '/test/index.html';
  }

  /* Medición: si hay Google Analytics en la página, cada clic queda registrado. */
  function track(label) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'click_partner_deckeva', { event_category: 'partner', event_label: label });
      }
    } catch (e) { /* noop */ }
  }

  /* ============================================================
   * ESTILOS
   * ==========================================================*/
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* ---------- Franja bajo la portada ---------- */
      '#' + STRIP_ID + '{position:relative;z-index:2;padding:0 16px;margin:-34px auto 0;max-width:1180px}',
      '#' + STRIP_ID + ' a.dk-strip{display:flex;align-items:center;gap:16px;text-decoration:none;',
      '  background:linear-gradient(100deg,#0b1f3a 0%,#0e3a66 55%,#0e6ba8 100%);color:#fff;border-radius:18px;',
      '  padding:14px 18px;box-shadow:0 18px 50px -18px rgba(14,107,168,.55),0 0 0 1px rgba(255,255,255,.08) inset;',
      '  transition:transform .25s ease,box-shadow .25s ease}',
      '#' + STRIP_ID + ' a.dk-strip:hover{transform:translateY(-2px);box-shadow:0 24px 60px -18px rgba(245,166,35,.45),0 0 0 1px rgba(245,166,35,.35) inset}',
      '#' + STRIP_ID + ' .dk-strip-thumb{width:64px;height:64px;border-radius:12px;object-fit:cover;flex-shrink:0;box-shadow:0 6px 16px rgba(0,0,0,.35)}',
      '#' + STRIP_ID + ' .dk-strip-tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0a1628;background:linear-gradient(90deg,#f5a623,#ffc04d);padding:3px 9px;border-radius:999px;margin-bottom:4px}',
      '#' + STRIP_ID + ' .dk-strip-title{font-size:16px;font-weight:700;line-height:1.3;margin:0}',
      '#' + STRIP_ID + ' .dk-strip-sub{font-size:13px;color:rgba(255,255,255,.75);margin:2px 0 0}',
      '#' + STRIP_ID + ' .dk-strip-cta{margin-left:auto;flex-shrink:0;background:#f5a623;color:#0a1628;font-weight:800;font-size:14px;padding:11px 18px;border-radius:12px;white-space:nowrap}',
      '@media (max-width:640px){#' + STRIP_ID + '{margin-top:-20px}#' + STRIP_ID + ' a.dk-strip{flex-wrap:wrap;gap:12px}',
      '  #' + STRIP_ID + ' .dk-strip-thumb{width:52px;height:52px}#' + STRIP_ID + ' .dk-strip-text{flex:1;min-width:0}',
      '  #' + STRIP_ID + ' .dk-strip-cta{margin-left:0;width:100%;text-align:center}}',

      /* ---------- Sección principal ---------- */
      '#' + SECTION_ID + '{position:relative;overflow:hidden;padding:96px 20px;',
      '  background:radial-gradient(1200px 500px at 85% 0%,rgba(26,155,227,.18),transparent 60%),',
      '  radial-gradient(900px 500px at 0% 100%,rgba(245,166,35,.10),transparent 60%),linear-gradient(180deg,#0a1628 0%,#0c2340 100%);color:#fff}',
      '#' + SECTION_ID + ' .dk-wrap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:center}',
      '#' + SECTION_ID + ' .dk-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;',
      '  color:#ffc04d;background:rgba(245,166,35,.10);border:1px solid rgba(245,166,35,.35);padding:6px 12px;border-radius:999px}',
      '#' + SECTION_ID + ' h2{font-size:clamp(30px,4vw,46px);line-height:1.1;font-weight:800;margin:18px 0 14px;letter-spacing:-.02em}',
      '#' + SECTION_ID + ' h2 .dk-hl{background:linear-gradient(90deg,#1a9be3,#6fd0ff);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#' + SECTION_ID + ' .dk-lead{font-size:17px;line-height:1.65;color:rgba(255,255,255,.78);margin:0 0 22px;max-width:560px}',
      '#' + SECTION_ID + ' .dk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 24px}',
      '#' + SECTION_ID + ' .dk-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:12px 10px;text-align:center}',
      '#' + SECTION_ID + ' .dk-stat b{display:block;font-size:22px;font-weight:800;color:#fff}',
      '#' + SECTION_ID + ' .dk-stat span{display:block;font-size:11.5px;color:rgba(255,255,255,.62);margin-top:2px;line-height:1.3}',
      '#' + SECTION_ID + ' .dk-feats{list-style:none;padding:0;margin:0 0 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}',
      '#' + SECTION_ID + ' .dk-feats li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;line-height:1.45;color:rgba(255,255,255,.86)}',
      '#' + SECTION_ID + ' .dk-feats li i{flex-shrink:0;width:22px;height:22px;border-radius:7px;background:rgba(0,184,122,.16);color:#34d399;',
      '  display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:900;margin-top:1px}',
      '#' + SECTION_ID + ' .dk-ctas{display:flex;flex-wrap:wrap;gap:12px}',
      '#' + SECTION_ID + ' .dk-btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:800;font-size:15px;padding:14px 22px;border-radius:14px;transition:transform .2s ease,box-shadow .2s ease,background .2s ease}',
      '#' + SECTION_ID + ' .dk-btn:hover{transform:translateY(-2px)}',
      '#' + SECTION_ID + ' .dk-btn-primary{background:linear-gradient(90deg,#f5a623,#ffc04d);color:#0a1628;box-shadow:0 14px 34px -12px rgba(245,166,35,.7)}',
      '#' + SECTION_ID + ' .dk-btn-wa{background:#25d366;color:#06331b;box-shadow:0 14px 34px -14px rgba(37,211,102,.7)}',
      '#' + SECTION_ID + ' .dk-btn-ghost{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18)}',
      '#' + SECTION_ID + ' .dk-btn-ghost:hover{background:rgba(255,255,255,.12)}',
      '#' + SECTION_ID + ' .dk-note{margin-top:14px;font-size:13px;color:rgba(255,255,255,.55)}',
      '#' + SECTION_ID + ' .dk-note a{color:#6fd0ff}',
      /* Galería */
      '#' + SECTION_ID + ' .dk-gallery{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:92px;gap:12px;position:relative}',
      '#' + SECTION_ID + ' .dk-gallery figure{margin:0;border-radius:16px;overflow:hidden;position:relative;box-shadow:0 18px 40px -18px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.08)}',
      '#' + SECTION_ID + ' .dk-gallery img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s ease}',
      '#' + SECTION_ID + ' .dk-gallery figure:hover img{transform:scale(1.06)}',
      '#' + SECTION_ID + ' .dk-g1{grid-column:1/5;grid-row:1/4}',
      '#' + SECTION_ID + ' .dk-g2{grid-column:5/7;grid-row:1/3}',
      '#' + SECTION_ID + ' .dk-g3{grid-column:5/7;grid-row:3/5}',
      '#' + SECTION_ID + ' .dk-g4{grid-column:1/3;grid-row:4/6}',
      '#' + SECTION_ID + ' .dk-g5{grid-column:3/5;grid-row:4/6}',
      '#' + SECTION_ID + ' .dk-rating{position:absolute;left:16px;bottom:16px;z-index:2;background:rgba(10,22,40,.82);backdrop-filter:blur(8px);',
      '  -webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 14px;display:flex;gap:10px;align-items:center}',
      '#' + SECTION_ID + ' .dk-rating b{font-size:22px;color:#ffc04d}',
      '#' + SECTION_ID + ' .dk-rating span{font-size:12px;line-height:1.3;color:rgba(255,255,255,.8)}',
      /* Banda "importas con Imporlan" */
      '#' + SECTION_ID + ' .dk-combo{max-width:1180px;margin:48px auto 0;display:flex;gap:18px;align-items:center;flex-wrap:wrap;',
      '  background:linear-gradient(90deg,rgba(26,155,227,.14),rgba(245,166,35,.10));border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:20px 24px}',
      '#' + SECTION_ID + ' .dk-combo-ico{font-size:30px}',
      '#' + SECTION_ID + ' .dk-combo p{margin:0;flex:1;min-width:240px;font-size:15.5px;line-height:1.55;color:rgba(255,255,255,.88)}',
      '#' + SECTION_ID + ' .dk-combo p b{color:#fff}',
      '@media (max-width:980px){#' + SECTION_ID + ' .dk-wrap{grid-template-columns:1fr;gap:40px}#' + SECTION_ID + '{padding:72px 16px}}',
      '@media (max-width:560px){#' + SECTION_ID + ' .dk-stats{grid-template-columns:repeat(2,1fr)}#' + SECTION_ID + ' .dk-feats{grid-template-columns:1fr}',
      '  #' + SECTION_ID + ' .dk-gallery{grid-auto-rows:64px;gap:8px}#' + SECTION_ID + ' .dk-btn{width:100%;justify-content:center}}',
      '@media (prefers-reduced-motion:reduce){#' + SECTION_ID + ' *,#' + STRIP_ID + ' *{transition:none!important}}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
   * MARCADO
   * ==========================================================*/
  function el(html) {
    var t = document.createElement('div');
    t.innerHTML = html.trim();
    return t.firstChild;
  }

  function buildStrip() {
    return el(
      '<div id="' + STRIP_ID + '">' +
      '  <a class="dk-strip" href="' + URL_COTIZADOR + 'franja_home" target="_blank" rel="noopener" data-dk="franja">' +
      '    <img class="dk-strip-thumb" src="' + GALLERY[0].src + '" alt="' + GALLERY[0].alt + '" loading="lazy" width="64" height="64">' +
      '    <div class="dk-strip-text">' +
      '      <span class="dk-strip-tag">Partner oficial · DECKEVA</span>' +
      '      <p class="dk-strip-title">Dale a tu lancha un piso de goma EVA antideslizante, hecho a medida</p>' +
      '      <p class="dk-strip-sub">+500 embarcaciones renovadas · 4.9★ · Toma de medidas e instalación en terreno</p>' +
      '    </div>' +
      '    <span class="dk-strip-cta">Ver precio en segundos →</span>' +
      '  </a>' +
      '</div>'
    );
  }

  function buildSection() {
    var fig = GALLERY.map(function (g, i) {
      return '<figure class="dk-g' + (i + 1) + '"><img src="' + g.src + '" alt="' + g.alt + '" loading="lazy" decoding="async"></figure>';
    }).join('');

    return el(
      '<section id="' + SECTION_ID + '" aria-labelledby="dk-title">' +
      '  <div class="dk-wrap">' +
      '    <div>' +
      '      <span class="dk-eyebrow">★ Partner oficial de Imporlan</span>' +
      '      <h2 id="dk-title">Pisos de goma EVA <span class="dk-hl">antideslizante</span> para tu lancha con DECKEVA</h2>' +
      '      <p class="dk-lead">Seguridad, confort y un look premium desde el primer día. DECKEVA fabrica en Chile pisos a medida para lanchas, veleros y plataformas: agarre firme aunque esté mojado, cómodos para andar descalzo y resistentes al sol y la sal.</p>' +
      '      <div class="dk-stats">' +
      '        <div class="dk-stat"><b>500+</b><span>embarcaciones renovadas</span></div>' +
      '        <div class="dk-stat"><b>4.9★</b><span>reseñas verificadas</span></div>' +
      '        <div class="dk-stat"><b>6 mm</b><span>EVA premium de celda cerrada</span></div>' +
      '        <div class="dk-stat"><b>14+</b><span>países con envíos</span></div>' +
      '      </div>' +
      '      <ul class="dk-feats">' +
      '        <li><i>✓</i>Antideslizante incluso mojado: menos resbalones a bordo</li>' +
      '        <li><i>✓</i>Corte a medida según la plantilla de tu embarcación</li>' +
      '        <li><i>✓</i>Adhesivo 3M de alta resistencia, listo para instalar</li>' +
      '        <li><i>✓</i>Resistente a los rayos UV y al agua salada</li>' +
      '        <li><i>✓</i>Toma de medidas e instalación en terreno</li>' +
      '        <li><i>✓</i>Fabricación en 10–15 días · despacho a todo Chile</li>' +
      '      </ul>' +
      '      <div class="dk-ctas">' +
      '        <a class="dk-btn dk-btn-primary" href="' + URL_COTIZADOR + 'seccion_home" target="_blank" rel="noopener" data-dk="cotizador">💰 Calcula el precio de tu piso</a>' +
      '        <a class="dk-btn dk-btn-wa" href="' + WA + '" target="_blank" rel="noopener" data-dk="whatsapp">WhatsApp</a>' +
      '        <a class="dk-btn dk-btn-ghost" href="' + URL_PROYECTOS + '" target="_blank" rel="noopener" data-dk="proyectos">Ver proyectos →</a>' +
      '      </div>' +
      '      <p class="dk-note">¿Estás fuera de Chile? DECKEVA envía a Latinoamérica, USA y el mundo: <a href="' + URL_INTL + '" target="_blank" rel="noopener" data-dk="internacional">deckeva.com</a></p>' +
      '    </div>' +
      '    <div class="dk-gallery">' + fig +
      '      <div class="dk-rating"><b>4.9★</b><span>Clientes en lagos y mar<br>de todo Chile</span></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dk-combo">' +
      '    <span class="dk-combo-ico">🛥️</span>' +
      '    <p><b>¿Vas a importar tu lancha con Imporlan?</b> Que llegue a Chile y la estrenes con piso nuevo: DECKEVA toma las medidas cuando tu embarcación esté en el país y la deja lista para navegar.</p>' +
      '    <a class="dk-btn dk-btn-primary" href="' + URL_HOME + 'combo_importacion" target="_blank" rel="noopener" data-dk="combo">Conoce DECKEVA</a>' +
      '  </div>' +
      '</section>'
    );
  }

  function wireTracking(root) {
    var links = root.querySelectorAll('a[data-dk]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', (function (label) {
        return function () { track(label); };
      })(links[i].getAttribute('data-dk')));
    }
  }

  /* ============================================================
   * INSERCIÓN
   * ==========================================================*/
  function insert() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;
    if (!isHome()) return;

    var attempts = 0;
    var MAX = 40; /* ~16 s a 400 ms */
    var iv = setInterval(function () {
      attempts++;
      var hero = document.getElementById('inicio');
      var servicios = document.getElementById('servicios');
      var guias = document.getElementById('guias-recursos');

      if (hero && !document.getElementById(STRIP_ID)) {
        injectStyles();
        var strip = buildStrip();
        hero.insertAdjacentElement('afterend', strip);
        wireTracking(strip);
      }

      if (!document.getElementById(SECTION_ID)) {
        var anchor = servicios || guias;
        if (anchor || attempts >= MAX) {
          injectStyles();
          var section = buildSection();
          if (servicios) servicios.insertAdjacentElement('afterend', section);
          else if (guias) guias.insertAdjacentElement('beforebegin', section);
          else {
            var cotizar = document.getElementById('cotizar');
            if (cotizar) cotizar.insertAdjacentElement('beforebegin', section);
            else return clearInterval(iv);
          }
          wireTracking(section);
        }
      }

      if ((document.getElementById(STRIP_ID) || attempts >= MAX) && document.getElementById(SECTION_ID)) {
        clearInterval(iv);
      }
      if (attempts >= MAX + 2) clearInterval(iv);
    }, 400);
  }

  /* Después de que React montó el Home, como los demás enhancers. */
  onReady(function () { setTimeout(insert, 1300); });
})();
