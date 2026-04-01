/**
 * Deckeva Enhancer - Premium UI/UX for Deckeva section
 * Transforms the default React Deckeva page into a stunning lifestyle experience
 */
(function () {
  "use strict";

  var enhanced = false;

  // Gallery images - lifestyle boat photos with EVA deck
  var GALLERY_IMAGES = [
    { src: "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&q=80", alt: "Lancha con piso EVA premium" },
    { src: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80", alt: "Disfrutando en el agua" },
    { src: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80", alt: "Navegando con estilo" },
    { src: "https://images.unsplash.com/photo-1588401667987-e06480c453e4?w=800&q=80", alt: "Deck de embarcacion" },
    { src: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80", alt: "Experiencia nautica premium" },
    { src: "https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&q=80", alt: "Vida en el mar" }
  ];

  var HERO_BG = "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1400&q=80";

  var COLORS = [
    { name: "Teak Clasico", color: "#c4915e", border: "#a87740" },
    { name: "Gris Platino", color: "#8b95a0", border: "#6b7580" },
    { name: "Negro Carbon", color: "#2d2d2d", border: "#1a1a1a" },
    { name: "Azul Oceano", color: "#1e6091", border: "#155070" },
    { name: "Verde Agua", color: "#40b5a0", border: "#2d9080" },
    { name: "Blanco Perla", color: "#e8e4df", border: "#ccc8c3" }
  ];

  var FEATURES = [
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      title: "Antideslizante",
      desc: "Goma EVA de alta densidad con textura diamond para maxima seguridad, incluso mojado"
    },
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      title: "Diseno a Medida",
      desc: "Corte CNC de precision segun el modelo exacto de tu embarcacion"
    },
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      title: "Facil Instalacion",
      desc: "Sistema adhesivo 3M incluido. Instalacion simple sin herramientas especiales"
    },
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      title: "Garantia 3 Anos",
      desc: "Resistente a UV, agua salada y productos quimicos de limpieza"
    },
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      title: "Confort Superior",
      desc: "Suave al tacto, amortigua impactos y reduce la fatiga al estar de pie"
    },
    {
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
      title: "14 a 30+ Pies",
      desc: "Disponible para lanchas, bowriders, veleros y todo tipo de embarcaciones"
    }
  ];

  var SIZES = [
    { ft: "14'", label: "14 pies", popular: false },
    { ft: "16'", label: "16 pies", popular: false },
    { ft: "18'", label: "18 pies", popular: true },
    { ft: "20'", label: "20 pies", popular: true },
    { ft: "22'", label: "22 pies", popular: true },
    { ft: "24'", label: "24 pies", popular: false },
    { ft: "26'", label: "26 pies", popular: false },
    { ft: "28'", label: "28 pies", popular: false },
    { ft: "30+", label: "30+ pies", popular: false }
  ];

  var TESTIMONIALS = [
    { name: "Roberto M.", boat: "Cobalt R30", text: "Transformo completamente mi lancha. El acabado es increible y mis pasajeros siempre lo comentan.", rating: 5 },
    { name: "Carolina S.", boat: "Bayliner VR5", text: "La instalacion fue super facil y el resultado es como tener una lancha nueva. 100% recomendado.", rating: 5 },
    { name: "Diego P.", boat: "Chaparral 246 SSi", text: "Despues de 2 temporadas el piso sigue perfecto. Gran calidad y excelente atencion.", rating: 5 }
  ];

  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  function buildHero() {
    return '<div style="position:relative;border-radius:20px;overflow:hidden;margin-bottom:32px;min-height:400px;background:linear-gradient(135deg,#0c4a6e,#164e63,#0f766e)">' +
      '<div style="position:absolute;inset:0;background:url(\'' + HERO_BG + '\') center/cover no-repeat;opacity:.25"></div>' +
      '<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(12,74,110,.85),rgba(15,118,110,.7))"></div>' +
      '<div style="position:relative;z-index:1;padding:48px 40px;display:flex;flex-direction:column;align-items:center;text-align:center">' +
        '<img src="/panel/assets/logoevadeck.jpg" alt="Deckeva" style="width:80px;height:80px;border-radius:20px;object-fit:cover;margin-bottom:20px;box-shadow:0 8px 32px rgba(0,0,0,.3);border:3px solid rgba(255,255,255,.2)">' +
        '<h1 style="margin:0 0 8px;font-size:42px;font-weight:800;color:#fff;letter-spacing:-.02em;text-shadow:0 2px 4px rgba(0,0,0,.2)">DECKEVA</h1>' +
        '<p style="margin:0 0 6px;font-size:18px;color:rgba(255,255,255,.9);font-weight:300;letter-spacing:.1em;text-transform:uppercase">Pisos EVA para Embarcaciones</p>' +
        '<p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,.7);max-width:500px;line-height:1.6">Renueva tu lancha con pisos antideslizantes de goma EVA cortados a medida. Seguridad, estilo y confort en cada navegacion.</p>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' +
          '<a href="https://www.deckeva.cl" target="_blank" rel="noopener" style="padding:14px 32px;border-radius:12px;background:#fff;color:#0c4a6e;font-size:15px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:transform .2s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Cotizar en Deckeva.cl</a>' +
          '<a href="mailto:contacto@deckeva.cl" style="padding:14px 32px;border-radius:12px;background:rgba(255,255,255,.15);color:#fff;font-size:15px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(4px);transition:background .2s" onmouseover="this.style.background=\'rgba(255,255,255,.25)\'" onmouseout="this.style.background=\'rgba(255,255,255,.15)\'">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Contactar</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function buildGallery() {
    var html = '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:10px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
        'Galeria de Instalaciones</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-radius:16px;overflow:hidden" id="deckeva-gallery">';
    GALLERY_IMAGES.forEach(function(img, i) {
      var h = i === 0 || i === 5 ? '240px' : '180px';
      html += '<div style="position:relative;height:' + h + ';overflow:hidden;cursor:pointer;' + (i === 0 ? 'grid-column:span 2;grid-row:span 1;' : '') + (i === 5 ? 'grid-column:span 2;' : '') + '" onmouseover="this.querySelector(\'img\').style.transform=\'scale(1.08)\'" onmouseout="this.querySelector(\'img\').style.transform=\'scale(1)\'">' +
        '<img src="' + img.src + '" alt="' + esc(img.alt) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .4s ease">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.4),transparent);pointer-events:none"></div>' +
      '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function buildFeatures() {
    var html = '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:10px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' +
        'Por que elegir Deckeva?</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">';
    FEATURES.forEach(function(f) {
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:24px;display:flex;gap:16px;align-items:flex-start;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,.08)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\'">' +
        '<div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#ecfeff,#cffafe);display:flex;align-items:center;justify-content:center;flex-shrink:0">' + f.icon + '</div>' +
        '<div><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a">' + f.title + '</h3>' +
        '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">' + f.desc + '</p></div></div>';
    });
    html += '</div></div>';
    return html;
  }

  function buildColors() {
    var html = '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:10px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>' +
        'Colores Disponibles</h2>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap">';
    COLORS.forEach(function(c) {
      html += '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:transform .15s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'none\'">' +
        '<div style="width:64px;height:64px;border-radius:16px;background:' + c.color + ';border:3px solid ' + c.border + ';box-shadow:0 4px 12px rgba(0,0,0,.15)"></div>' +
        '<span style="font-size:11px;font-weight:600;color:#475569;text-align:center;max-width:70px">' + c.name + '</span></div>';
    });
    html += '</div></div>';
    return html;
  }

  function buildSizes() {
    var html = '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:10px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M21 3H3v7h18V3z"/><path d="M21 14H3v7h18v-7z"/></svg>' +
        'Tamanos Disponibles</h2>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    SIZES.forEach(function(s) {
      var bg = s.popular ? 'linear-gradient(135deg,#0891b2,#06b6d4)' : '#fff';
      var clr = s.popular ? '#fff' : '#1e293b';
      var brd = s.popular ? 'none' : '1px solid #e2e8f0';
      var shadow = s.popular ? '0 4px 16px rgba(8,145,178,.3)' : 'none';
      html += '<div style="padding:14px 20px;border-radius:12px;background:' + bg + ';color:' + clr + ';border:' + brd + ';font-weight:700;font-size:15px;text-align:center;position:relative;box-shadow:' + shadow + ';transition:transform .15s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">' +
        s.ft +
        (s.popular ? '<span style="position:absolute;top:-8px;right:-8px;background:#f59e0b;color:#fff;font-size:9px;padding:2px 6px;border-radius:6px;font-weight:700">TOP</span>' : '') +
      '</div>';
    });
    html += '</div>' +
      '<p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Tambien disponible para tamanos especiales bajo pedido.</p></div>';
    return html;
  }

  function buildTestimonials() {
    var html = '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:10px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        'Lo que dicen nuestros clientes</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
    TESTIMONIALS.forEach(function(t) {
      var stars = '';
      for (var i = 0; i < t.rating; i++) stars += '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:24px;position:relative">' +
        '<div style="font-size:40px;color:#e2e8f0;position:absolute;top:12px;right:16px;font-family:Georgia,serif">"</div>' +
        '<div style="display:flex;gap:2px;margin-bottom:12px">' + stars + '</div>' +
        '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;font-style:italic">"' + esc(t.text) + '"</p>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + t.name.charAt(0) + '</div>' +
          '<div><span style="font-size:13px;font-weight:700;color:#0f172a;display:block">' + esc(t.name) + '</span>' +
          '<span style="font-size:12px;color:#94a3b8">' + esc(t.boat) + '</span></div></div></div>';
    });
    html += '</div></div>';
    return html;
  }

  function buildPromo() {
    return '<div style="background:linear-gradient(135deg,#0c4a6e,#164e63);border-radius:20px;padding:32px 40px;margin-bottom:32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap">' +
      '<div>' +
        '<div style="display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(245,158,11,.2);color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Temporada 2025-2026</div>' +
        '<h3 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff">Dale un nuevo look a tu lancha</h3>' +
        '<p style="margin:0;font-size:14px;color:rgba(255,255,255,.7);max-width:400px">Planifica con tiempo y asegura tu piso EVA. Produccion limitada con entrega en todo Chile.</p>' +
      '</div>' +
      '<a href="https://www.deckeva.cl" target="_blank" rel="noopener" style="padding:14px 32px;border-radius:12px;background:#fff;color:#0c4a6e;font-size:15px;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:transform .2s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">' +
        'Cotizar Ahora ' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>' +
    '</div>';
  }

  function buildContact() {
    return '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;text-align:center">' +
      '<h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a">Necesitas mas informacion?</h3>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#64748b">Nuestro equipo esta listo para ayudarte</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
        '<a href="mailto:contacto@deckeva.cl" style="padding:10px 20px;border-radius:10px;background:#f0f9ff;color:#0891b2;font-size:13px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;border:1px solid #bae6fd">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
          'contacto@deckeva.cl</a>' +
        '<a href="https://www.deckeva.cl" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:10px;background:#ecfdf5;color:#059669;font-size:13px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;border:1px solid #a7f3d0">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
          'www.deckeva.cl</a>' +
        '<a href="https://www.deckeva.com" target="_blank" rel="noopener" style="padding:10px 20px;border-radius:10px;background:#f5f3ff;color:#7c3aed;font-size:13px;font-weight:600;text-decoration:none;display:flex;align-items:center;gap:6px;border:1px solid #ddd6fe">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
          'deckeva.com (Internacional)</a>' +
      '</div>' +
      '<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Deckeva es parte de Grupo Imporlan</p>' +
    '</div>';
  }

  function enhance() {
    if (enhanced) return;
    if (!window.location.hash.includes("deckeva")) return;

    var main = document.querySelector("main");
    if (!main) return;

    // Wait for React to render
    var existing = main.querySelector("[data-deckeva-enhanced]");
    if (existing) return;

    // Find the React-rendered Deckeva content
    var cards = main.querySelectorAll(".bg-white.rounded-lg, .bg-gradient-to-r, [class*='animate-fade-in']");
    var deckevaContent = null;

    // Check if we're on the deckeva page by looking for distinctive content
    var allText = main.textContent || "";
    if (allText.indexOf("Deckeva") === -1 && allText.indexOf("deckeva") === -1 && allText.indexOf("Renueva tu lancha") === -1) return;

    enhanced = true;

    // Hide all existing React content
    Array.from(main.children).forEach(function(ch) {
      ch.style.display = "none";
    });

    // Create enhanced container
    var container = document.createElement("div");
    container.setAttribute("data-deckeva-enhanced", "true");
    container.style.cssText = "padding:20px 0;max-width:1100px;margin:0 auto;animation:deckevaFadeIn .5s ease-out";
    container.innerHTML = buildHero() + buildGallery() + buildFeatures() + buildColors() + buildSizes() + buildTestimonials() + buildPromo() + buildContact();

    main.appendChild(container);

    // Add animation keyframes
    if (!document.getElementById("deckeva-styles")) {
      var style = document.createElement("style");
      style.id = "deckeva-styles";
      style.textContent = "@keyframes deckevaFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}";
      document.head.appendChild(style);
    }
  }

  // Watch for hash changes
  function checkAndEnhance() {
    if (window.location.hash.includes("deckeva")) {
      // Small delay to let React render first
      setTimeout(enhance, 300);
    } else {
      enhanced = false;
    }
  }

  window.addEventListener("hashchange", checkAndEnhance);
  setInterval(checkAndEnhance, 1000);
  checkAndEnhance();
})();
