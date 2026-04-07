/**
 * Inspection User Module - Imporlan Client Panel
 * Enhanced version with radar chart, photo gallery, PDF download.
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/panel-test") || window.location.pathname.includes("/test/"))
    ? "/test/api"
    : "/api";

  var inspections = [];
  var currentDetail = null;
  var allPhotos = [];
  var lightboxIndex = 0;

  var REPORT_TYPES = {
    basica: { label: "Basica", color: "#0891b2", bg: "#ecfeff", gradient: "linear-gradient(135deg,#06b6d4,#0891b2)" },
    estandar: { label: "Estandar", color: "#2563eb", bg: "#eff6ff", gradient: "linear-gradient(135deg,#3b82f6,#2563eb)" },
    premium: { label: "Premium", color: "#7c3aed", bg: "#f5f3ff", gradient: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }
  };

  var SECTION_LABELS = {
    hull: "Casco Exterior", engine: "Motor", electrical: "Sistema Electrico",
    interior: "Interior", trailer: "Trailer", navigation: "Navegacion y Electronica",
    safety: "Seguridad", test_drive: "Test-Drive en Agua", documentation: "Documentacion"
  };

  var SECTION_ICONS = {
    hull: '<path d="M2 20l2-2h16l2 2"/><path d="M4 18V6a2 2 0 012-2h12a2 2 0 012 2v12"/>',
    engine: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    electrical: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    interior: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    trailer: '<path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path d="M5 17H3V6h13v11H9m4 0h2"/>',
    navigation: '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
    safety: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    test_drive: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    documentation: '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
  };

  // ── Helpers ──
  function getUserData() {
    try {
      var r = localStorage.getItem("imporlan_user"); if (r) return JSON.parse(r);
      var r2 = localStorage.getItem("user"); if (r2) return JSON.parse(r2);
    } catch (e) {}
    return null;
  }
  function getUserEmail() { var u = getUserData(); return u ? u.email || u.user_email || "" : ""; }
  function getUserToken() { return localStorage.getItem("imporlan_token") || localStorage.getItem("token") || ""; }
  function userAuthHeaders() {
    var h = { "Authorization": "Bearer " + getUserToken(), "X-User-Email": getUserEmail() };
    var u = getUserData();
    if (u && (u.name || u.user_name)) h["X-User-Name"] = u.name || u.user_name;
    return h;
  }
  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function fmtDate(s) {
    if (!s) return "N/A";
    var d = new Date(s);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  }
  function isInspectionPage() {
    return window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/");
  }

  // ── Sidebar ──
  function injectSidebarItem() {
    var nav = document.querySelector("aside nav") || document.querySelector("nav");
    if (!nav) return;
    var docEl = null;
    nav.querySelectorAll("button, a, li").forEach(function (el) {
      var text = (el.textContent || "").trim().toLowerCase();
      if (text.includes("documentos")) docEl = el;
    });
    if (!docEl) return;
    var docContainer = docEl.closest("li") || docEl;
    if (!docContainer.parentNode) return;
    var existing = document.getElementById("sidebar-inspecciones-user");
    if (existing) {
      var existingContainer = existing.closest("li") || existing.parentElement;
      if (existingContainer && docContainer.nextSibling === existingContainer) return;
      if (existingContainer && existingContainer !== nav) existingContainer.remove();
      else if (existing.parentElement) existing.parentElement.removeChild(existing);
    }
    var wrapper = docContainer.cloneNode(false);
    var btn;
    if (docContainer.tagName === "LI") {
      btn = document.createElement("button");
      if (docEl.className) btn.className = docEl.className;
      wrapper.appendChild(btn);
    } else {
      btn = wrapper;
      if (docEl.className) btn.className = docEl.className;
    }
    btn.id = "sidebar-inspecciones-user";
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg> Inspecciones';
    btn.style.cursor = "pointer";
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); window.location.hash = "#inspecciones"; });
    docContainer.parentNode.insertBefore(wrapper.tagName === "LI" ? wrapper : btn, docContainer.nextSibling);
  }
  function updateSidebarActive() {
    var item = document.getElementById("sidebar-inspecciones-user");
    if (!item) return;
    var active = isInspectionPage();
    if (active) { item.style.background = "rgba(124,58,237,0.12)"; item.style.color = "#7c3aed"; item.style.fontWeight = "600"; }
    else { item.style.background = ""; item.style.color = ""; item.style.fontWeight = ""; }
  }

  // ── API ──
  async function fetchInspections() {
    var email = getUserEmail(); if (!email) return [];
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=user_list&user_email=" + encodeURIComponent(email), { headers: userAuthHeaders() });
      var data = await resp.json();
      return data.success ? data.inspections || [] : [];
    } catch (e) { return []; }
  }
  async function fetchDetail(id) {
    var email = getUserEmail(); if (!email) return null;
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=user_detail&id=" + id + "&user_email=" + encodeURIComponent(email), { headers: userAuthHeaders() });
      var data = await resp.json();
      return data.success ? data.inspection : null;
    } catch (e) { return null; }
  }

  // ── Radar Chart (SVG) ──
  function renderRadarChart(insp) {
    var sectionKeys = ["hull","engine","electrical","interior","trailer","navigation","safety","test_drive","documentation"];
    var ratings = [];
    sectionKeys.forEach(function(key) {
      var data = insp["section_" + key];
      if (data && typeof data === "object" && data.rating) {
        ratings.push({ key: key, label: SECTION_LABELS[key], rating: parseFloat(data.rating) });
      }
    });
    if (ratings.length < 3) return "";

    var cx = 160, cy = 150, maxR = 110;
    var n = ratings.length;
    var angleStep = (2 * Math.PI) / n;
    var overallRating = parseFloat(insp.overall_rating) || 0;
    var fillColor = overallRating >= 7 ? "rgba(16,185,129," : overallRating >= 5 ? "rgba(245,158,11," : "rgba(239,68,68,";
    var strokeColor = overallRating >= 7 ? "#10b981" : overallRating >= 5 ? "#f59e0b" : "#ef4444";

    var gridLines = "";
    [0.25, 0.5, 0.75, 1.0].forEach(function(pct) {
      var r = maxR * pct;
      var pts = [];
      for (var i = 0; i < n; i++) {
        var angle = -Math.PI/2 + i * angleStep;
        pts.push((cx + r * Math.cos(angle)).toFixed(1) + "," + (cy + r * Math.sin(angle)).toFixed(1));
      }
      gridLines += '<polygon points="' + pts.join(" ") + '" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
    });

    var axes = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI/2 + i * angleStep;
      var x2 = cx + maxR * Math.cos(angle);
      var y2 = cy + maxR * Math.sin(angle);
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"/>';
    }

    var dataPts = [];
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI/2 + i * angleStep;
      var r = maxR * (ratings[i].rating / 10);
      dataPts.push((cx + r * Math.cos(angle)).toFixed(1) + "," + (cy + r * Math.sin(angle)).toFixed(1));
    }
    var dataPolygon = '<polygon points="' + dataPts.join(" ") + '" fill="' + fillColor + '0.2)" stroke="' + strokeColor + '" stroke-width="2.5"/>';

    var dots = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI/2 + i * angleStep;
      var r = maxR * (ratings[i].rating / 10);
      var px = cx + r * Math.cos(angle);
      var py = cy + r * Math.sin(angle);
      dots += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4" fill="' + strokeColor + '" stroke="#fff" stroke-width="2"/>';
    }

    var labels = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI/2 + i * angleStep;
      var lx = cx + (maxR + 28) * Math.cos(angle);
      var ly = cy + (maxR + 28) * Math.sin(angle);
      var anchor = "middle";
      if (Math.cos(angle) > 0.3) anchor = "start";
      else if (Math.cos(angle) < -0.3) anchor = "end";
      var rColor = ratings[i].rating >= 7 ? "#10b981" : ratings[i].rating >= 5 ? "#f59e0b" : "#ef4444";
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" font-size="11" font-weight="600" fill="#475569">' + esc(ratings[i].label) + '</text>';
      labels += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 14).toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" font-size="12" font-weight="800" fill="' + rColor + '">' + ratings[i].rating.toFixed(1) + '</text>';
    }

    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' +
      'Resumen por Secciones</h3></div>' +
      '<div style="padding:24px;display:flex;justify-content:center;overflow-x:auto">' +
      '<svg viewBox="0 0 320 300" width="320" height="300" style="max-width:100%">' +
      gridLines + axes + dataPolygon + dots + labels +
      '</svg></div></div>';
  }

  // ── Lightbox with Navigation ──
  function collectAllPhotos(insp) {
    var photos = [];
    var sectionKeys = ["hull","engine","electrical","interior","trailer","navigation","safety","test_drive","documentation"];
    sectionKeys.forEach(function(key) {
      var arr = insp["photos_" + key] || [];
      arr.forEach(function(url) { photos.push({ url: url, section: SECTION_LABELS[key] || key }); });
    });
    (insp.photos_general || []).forEach(function(url) { photos.push({ url: url, section: "General" }); });
    return photos;
  }

  function openLightbox(url) {
    var idx = 0;
    for (var i = 0; i < allPhotos.length; i++) {
      if (allPhotos[i].url === url) { idx = i; break; }
    }
    lightboxIndex = idx;
    showLightbox();
  }

  function showLightbox() {
    var existing = document.getElementById("iu-lightbox");
    if (existing) existing.remove();

    var photo = allPhotos[lightboxIndex];
    if (!photo) return;

    var overlay = document.createElement("div");
    overlay.id = "iu-lightbox";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:iuFadeIn .15s;backdrop-filter:blur(12px)";

    // Counter
    var counter = '<div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);color:#fff;font-size:14px;font-weight:600;background:rgba(0,0,0,.5);padding:6px 16px;border-radius:20px">' +
      (lightboxIndex + 1) + ' / ' + allPhotos.length +
      '<span style="margin-left:8px;color:#94a3b8;font-weight:400">- ' + esc(photo.section) + '</span></div>';

    // Close
    var closeBtn = '<button id="iu-lb-close" style="position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;z-index:2">&times;</button>';

    // Arrows
    var leftArrow = allPhotos.length > 1 ? '<button id="iu-lb-prev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;z-index:2">&#8249;</button>' : '';
    var rightArrow = allPhotos.length > 1 ? '<button id="iu-lb-next" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;z-index:2">&#8250;</button>' : '';

    // Main image
    var mainImg = '<img src="' + esc(photo.url) + '" style="max-width:85%;max-height:70vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);transition:opacity .2s" loading="eager">';

    // Thumbnails
    var thumbs = '<div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:6px;max-width:90%;overflow-x:auto;padding:8px 12px;background:rgba(0,0,0,.5);border-radius:12px">';
    var maxThumbs = Math.min(allPhotos.length, 12);
    var startIdx = Math.max(0, lightboxIndex - 5);
    var endIdx = Math.min(allPhotos.length, startIdx + maxThumbs);
    for (var i = startIdx; i < endIdx; i++) {
      var isActive = i === lightboxIndex;
      thumbs += '<img src="' + esc(allPhotos[i].url) + '" data-lb-idx="' + i + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ' + (isActive ? '#fff' : 'transparent') + ';opacity:' + (isActive ? '1' : '0.5') + ';transition:all .2s" loading="lazy">';
    }
    thumbs += '</div>';

    overlay.innerHTML = counter + closeBtn + leftArrow + mainImg + rightArrow + thumbs;
    document.body.appendChild(overlay);

    // Events
    document.getElementById("iu-lb-close").addEventListener("click", closeLightbox);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) closeLightbox(); });
    var prevBtn = document.getElementById("iu-lb-prev");
    var nextBtn = document.getElementById("iu-lb-next");
    if (prevBtn) prevBtn.addEventListener("click", function(e) { e.stopPropagation(); lightboxIndex = (lightboxIndex - 1 + allPhotos.length) % allPhotos.length; showLightbox(); });
    if (nextBtn) nextBtn.addEventListener("click", function(e) { e.stopPropagation(); lightboxIndex = (lightboxIndex + 1) % allPhotos.length; showLightbox(); });
    overlay.querySelectorAll("[data-lb-idx]").forEach(function(thumb) {
      thumb.addEventListener("click", function(e) { e.stopPropagation(); lightboxIndex = parseInt(this.getAttribute("data-lb-idx")); showLightbox(); });
    });

    // Keyboard
    document.addEventListener("keydown", lightboxKeyHandler);
  }

  function closeLightbox() {
    var el = document.getElementById("iu-lightbox");
    if (el) el.remove();
    document.removeEventListener("keydown", lightboxKeyHandler);
  }

  function lightboxKeyHandler(e) {
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") { lightboxIndex = (lightboxIndex - 1 + allPhotos.length) % allPhotos.length; showLightbox(); }
    else if (e.key === "ArrowRight") { lightboxIndex = (lightboxIndex + 1) % allPhotos.length; showLightbox(); }
  }

  // ── Render List ──
  function renderList() {
    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .4s ease">';
    html += '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0;font-size:26px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:12px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(124,58,237,.3)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg></div>' +
      'Mis Inspecciones</h2>' +
      '<p style="margin:8px 0 0 56px;font-size:14px;color:#64748b">Reportes de inspeccion tecnica de tus embarcaciones</p></div>';

    if (inspections.length === 0) {
      html += '<div style="background:linear-gradient(135deg,#faf5ff,#f5f3ff);border-radius:24px;border:1px solid #e9d5ff;padding:60px 30px;text-align:center">' +
        '<div style="width:80px;height:80px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 8px 24px rgba(124,58,237,.25)">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>' +
        '<h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#1e293b">Aun no tienes inspecciones</h3>' +
        '<p style="margin:0 auto 28px;font-size:15px;color:#64748b;max-width:420px;line-height:1.6">Cuando contrates una inspeccion tecnica pre-compra, podras ver el reporte completo con fotos, videos y calificaciones aqui.</p>' +
        '<a href="https://wa.me/56940211459?text=Hola%2C%20me%20interesa%20contratar%20una%20inspeccion%20de%20embarcacion" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:14px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 4px 16px rgba(37,211,102,.3);transition:transform .2s,box-shadow .2s">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Solicitar Inspeccion</a></div>';
    } else {
      html += '<div style="display:grid;gap:16px">';
      inspections.forEach(function (insp) {
        var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
        var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Embarcacion";
        var location = [insp.city, insp.state_region, (insp.country || "").toUpperCase()].filter(Boolean).join(", ");
        var rating = insp.overall_rating ? parseFloat(insp.overall_rating) : null;
        var rColor = rating >= 7 ? "#10b981" : rating >= 5 ? "#f59e0b" : rating > 0 ? "#ef4444" : "#94a3b8";

        html += '<div class="iu-card" data-id="' + insp.id + '" style="background:#fff;border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;cursor:pointer;transition:all .25s ease">' +
          '<div style="display:flex;align-items:stretch">' +
          '<div style="width:6px;background:' + rt.gradient + ';flex-shrink:0"></div>' +
          '<div style="flex:1;padding:22px 24px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">' +
          '<div style="flex:1;min-width:200px"><h3 style="margin:0;font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.01em">' + esc(vessel) + '</h3>' +
          (location ? '<p style="margin:5px 0 0;font-size:13px;color:#64748b;display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(location) + '</p>' : '') +
          '</div>' +
          '<span style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.05em;border:1px solid ' + rt.color + '33">' + rt.label + '</span></div>';

        // Specs row
        var specs = [];
        if (insp.length_ft) specs.push('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M2 6h20v12H2z"/></svg>' + insp.length_ft + ' ft');
        if (insp.hull_material) specs.push('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' + esc(insp.hull_material));
        if (insp.inspector_name) specs.push('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + esc(insp.inspector_name));
        if (specs.length > 0) {
          html += '<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:16px">';
          specs.forEach(function(s) { html += '<div style="display:flex;align-items:center;gap:5px;font-size:13px;color:#64748b">' + s + '</div>'; });
          html += '</div>';
        }

        // Rating + date
        html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
        if (rating) {
          html += '<div style="display:flex;align-items:center;gap:8px"><div style="width:42px;height:42px;border-radius:12px;background:' + rColor + '15;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:' + rColor + '">' + rating.toFixed(1) + '</span></div><span style="font-size:12px;color:#94a3b8">/10</span></div>';
        }
        html += '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#94a3b8"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + fmtDate(insp.sent_at || insp.created_at) + '</div>';
        html += '</div></div></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ── Render Detail ──
  function renderDetail(insp) {
    allPhotos = collectAllPhotos(insp);
    var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
    var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Embarcacion";
    var location = [insp.city, insp.state_region, (insp.country || "").toUpperCase()].filter(Boolean).join(", ");

    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .4s ease">';

    // Header
    html += '<div style="margin-bottom:24px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
      '<button id="iu-back" style="padding:8px 16px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;transition:all .2s"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Volver</button>' +
      '<button id="iu-download-pdf" style="padding:8px 18px;border-radius:12px;border:none;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(124,58,237,.25);transition:all .2s">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar PDF</button></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
      '<div><h2 style="margin:0;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-.02em">Reporte de Inspeccion</h2>' +
      '<p style="margin:6px 0 0;font-size:15px;color:#64748b">' + esc(vessel) + (location ? ' &mdash; ' + esc(location) : '') + '</p></div>' +
      '<span style="padding:6px 18px;border-radius:20px;font-size:12px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.05em;border:1px solid ' + rt.color + '33">Inspeccion ' + rt.label + '</span></div></div>';

    // Overall rating card
    if (insp.overall_rating) {
      var ratingVal = parseFloat(insp.overall_rating);
      var ratingPct = (ratingVal / 10 * 100).toFixed(0);
      var ratingColor = ratingVal >= 7 ? "#10b981" : ratingVal >= 5 ? "#f59e0b" : "#ef4444";
      var ratingBg = ratingVal >= 7 ? "rgba(16,185,129,.08)" : ratingVal >= 5 ? "rgba(245,158,11,.08)" : "rgba(239,68,68,.08)";
      html += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:24px;padding:32px;margin-bottom:24px;display:flex;align-items:center;gap:32px;flex-wrap:wrap;box-shadow:0 8px 32px rgba(15,23,42,.3)">' +
        '<div style="position:relative;width:110px;height:110px;flex-shrink:0">' +
        '<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="9"/>' +
        '<circle cx="55" cy="55" r="46" fill="none" stroke="' + ratingColor + '" stroke-width="9" stroke-dasharray="' + (2.89 * parseFloat(ratingPct)) + ' 289" stroke-linecap="round" transform="rotate(-90 55 55)" style="transition:stroke-dasharray .8s ease"/></svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:32px;font-weight:800;color:#fff">' + ratingVal.toFixed(1) + '</span><span style="font-size:11px;color:#64748b">/10</span></div></div>' +
        '<div style="flex:1;min-width:220px"><h3 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#fff">Calificacion General</h3>' +
        '<p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7">' + esc(insp.overall_summary || 'Sin resumen disponible') + '</p>' +
        (insp.inspector_name ? '<p style="margin:12px 0 0;font-size:13px;color:#475569"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Inspector: <strong style="color:#94a3b8">' + esc(insp.inspector_name) + '</strong></p>' : '') +
        '</div></div>';
    }

    // Radar chart
    html += renderRadarChart(insp);

    // Vessel info card
    html += '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>Datos de la Embarcacion</h3></div>' +
      '<div style="padding:20px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px">';
    var vesselFields = [
      { label: "Tipo", value: insp.vessel_type, icon: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" },
      { label: "Marca", value: insp.brand, icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" },
      { label: "Modelo", value: insp.model, icon: "M12 3v18m-9-9h18" },
      { label: "Ano", value: insp.vessel_year, icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
      { label: "Eslora", value: insp.length_ft ? insp.length_ft + " ft" : null, icon: "M2 12h20M12 2v20" },
      { label: "Material", value: insp.hull_material, icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" },
      { label: "Motor", value: [insp.engine_brand, insp.engine_model].filter(Boolean).join(" "), icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { label: "Horas Motor", value: insp.engine_hours, icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4l3 3" },
      { label: "Motores", value: insp.num_engines, icon: "M4 4h16v16H4z" },
      { label: "Combustible", value: insp.fuel_type, icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" },
      { label: "Pais", value: (insp.country || "").toUpperCase(), icon: "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z" },
      { label: "Marina", value: insp.marina, icon: "M3 11l19-9-9 19-2-8-8-2z" }
    ];
    vesselFields.forEach(function (f) {
      if (!f.value) return;
      html += '<div style="background:#f8fafc;border-radius:12px;padding:14px 16px">' +
        '<p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.06em;display:flex;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="' + f.icon + '"/></svg>' + f.label + '</p>' +
        '<p style="margin:5px 0 0;font-size:15px;font-weight:700;color:#1e293b">' + esc(String(f.value)) + '</p></div>';
    });
    html += '</div></div></div>';

    // Inspection sections
    var sectionKeys = ["hull","engine","electrical","interior","trailer","navigation","safety","test_drive","documentation"];
    sectionKeys.forEach(function (key) {
      var data = insp["section_" + key];
      if (!data || typeof data !== "object") return;
      var hasContent = Object.keys(data).some(function (k) { return data[k] && data[k] !== ""; });
      if (!hasContent) return;
      var label = SECTION_LABELS[key] || key;
      var iconPath = SECTION_ICONS[key] || '<path d="M9 12l2 2 4-4"/>';
      var sectionRating = data.rating ? parseFloat(data.rating) : null;
      var rColor = sectionRating >= 7 ? "#10b981" : sectionRating >= 5 ? "#f59e0b" : sectionRating > 0 ? "#ef4444" : "#94a3b8";

      html += '<div class="iu-section-card" style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
        '<div class="iu-section-header" style="padding:18px 24px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background .2s" data-section="' + key + '">' +
        '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px">' +
        '<div style="width:36px;height:36px;background:' + rt.bg + ';border-radius:10px;display:flex;align-items:center;justify-content:center;border:1px solid ' + rt.color + '22"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + rt.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg></div>' +
        esc(label) + '</h3>' +
        '<div style="display:flex;align-items:center;gap:12px">';
      if (sectionRating) {
        html += '<div style="display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:10px;background:' + rColor + '12"><span style="font-size:18px;font-weight:800;color:' + rColor + '">' + sectionRating.toFixed(1) + '</span><span style="font-size:11px;color:#94a3b8">/10</span></div>';
      }
      html += '<svg class="iu-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="transition:transform .3s"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div></div>';

      html += '<div class="iu-section-body" data-section-body="' + key + '" style="border-top:1px solid #f1f5f9">' +
        '<div style="padding:20px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">';

      Object.keys(data).forEach(function (fieldKey) {
        if (fieldKey === "rating" || fieldKey === "notes" || !data[fieldKey]) return;
        var fieldLabel = fieldKey.replace(/_/g, " ").replace(/\b\w/g, function (l) { return l.toUpperCase(); });
        var val = data[fieldKey];
        var valColor = "#1e293b";
        var valBg = "#f8fafc";
        var valBorder = "#f1f5f9";
        if (["Malo","Severa","No funciona","Danado","Requiere reemplazo","Excesivo","Corroido"].some(function (w) { return String(val).includes(w); })) { valColor = "#dc2626"; valBg = "#fef2f2"; valBorder = "#fecaca"; }
        else if (["Excelente","Buen estado","Funcionando","Si","Limpio","Normal","Optimo","Nuevo"].some(function (w) { return String(val).includes(w); })) { valColor = "#059669"; valBg = "#ecfdf5"; valBorder = "#a7f3d0"; }
        else if (["Regular","Desgaste","Parcial","Debil","Aceptable"].some(function (w) { return String(val).includes(w); })) { valColor = "#d97706"; valBg = "#fffbeb"; valBorder = "#fde68a"; }

        html += '<div style="background:' + valBg + ';border-radius:12px;padding:12px 14px;border:1px solid ' + valBorder + '">' +
          '<p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.05em">' + esc(fieldLabel) + '</p>' +
          '<p style="margin:5px 0 0;font-size:14px;font-weight:700;color:' + valColor + '">' + esc(val) + '</p></div>';
      });
      html += '</div>';

      if (data.notes) {
        html += '<div style="margin-top:16px;padding:16px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:12px;border:1px solid #fde68a">' +
          '<p style="margin:0;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Observaciones</p>' +
          '<p style="margin:0;font-size:13px;color:#78350f;line-height:1.7">' + esc(data.notes) + '</p></div>';
      }
      html += '</div>';

      // Section photos
      var photos = insp["photos_" + key] || [];
      if (photos.length > 0) {
        html += '<div style="padding:0 24px 20px"><p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Fotos (' + photos.length + ')</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">';
        photos.forEach(function (url) {
          html += '<div class="iu-photo" data-url="' + esc(url) + '" style="border-radius:12px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0;transition:all .2s">' +
            '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
        });
        html += '</div></div>';
      }
      html += '</div></div>';
    });

    // Videos
    var videos = insp.videos_test_drive || [];
    if (videos.length > 0) {
      html += '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
        '<div style="padding:18px 24px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Videos Test-Drive</h3></div>' +
        '<div style="padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">';
      videos.forEach(function (url) {
        html += '<div style="border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.06)"><video src="' + esc(url) + '" controls style="width:100%;display:block" preload="metadata"></video></div>';
      });
      html += '</div></div>';
    }

    // General photos
    var generalPhotos = insp.photos_general || [];
    if (generalPhotos.length > 0) {
      html += '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
        '<div style="padding:18px 24px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Fotos Generales (' + generalPhotos.length + ')</h3></div>' +
        '<div style="padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">';
      generalPhotos.forEach(function (url) {
        html += '<div class="iu-photo" data-url="' + esc(url) + '" style="border-radius:12px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0;transition:all .2s">' +
          '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
      });
      html += '</div></div>';
    }

    // Recommendations
    if (insp.recommendations) {
      html += '<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:20px;border:1px solid #a7f3d0;padding:28px;margin-bottom:24px">' +
        '<h3 style="margin:0 0 12px;font-size:17px;font-weight:800;color:#065f46;display:flex;align-items:center;gap:8px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Recomendaciones del Inspector</h3>' +
        '<p style="margin:0;font-size:14px;color:#065f46;line-height:1.8;white-space:pre-wrap">' + esc(insp.recommendations) + '</p></div>';
    }

    // Listing URL
    if (insp.listing_url) {
      html += '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>' +
        '<a href="' + esc(insp.listing_url) + '" target="_blank" style="color:#2563eb;font-size:14px;word-break:break-all;text-decoration:underline">' + esc(insp.listing_url) + '</a></div>';
    }

    // Footer
    html += '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:12px">' +
      'Reporte generado el ' + fmtDate(insp.sent_at || insp.created_at) + ' | Inspeccion ' + rt.label + ' | Imporlan.cl</div>';
    html += '</div>';
    return html;
  }

  // ── PDF Download ──
  function downloadPDF() {
    var printStyle = document.getElementById("iu-print-style");
    if (!printStyle) {
      printStyle = document.createElement("style");
      printStyle.id = "iu-print-style";
      document.head.appendChild(printStyle);
    }
    printStyle.textContent = '@media print {' +
      'body > *:not(#iu-container):not(#iu-print-header) { display: none !important; }' +
      'aside, nav, header, footer, #sidebar-inspecciones-user { display: none !important; }' +
      '#iu-back, #iu-download-pdf, .iu-chevron { display: none !important; }' +
      '#iu-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }' +
      '.iu-section-body { display: block !important; }' +
      '.iu-photo { break-inside: avoid; }' +
      '.iu-section-card { break-inside: avoid; page-break-inside: avoid; }' +
      '@page { size: A4; margin: 15mm; }' +
      '}';

    // Add print header
    var header = document.getElementById("iu-print-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "iu-print-header";
      header.style.cssText = "display:none";
      header.innerHTML = '<div style="text-align:center;padding:20px 0 16px;border-bottom:2px solid #7c3aed;margin-bottom:20px">' +
        '<h1 style="margin:0;font-size:22px;font-weight:800;color:#7c3aed">IMPORLAN</h1>' +
        '<p style="margin:4px 0 0;font-size:12px;color:#64748b">Reporte de Inspeccion Tecnica Pre-Compra</p></div>';
      document.body.prepend(header);
    }

    // Expand all sections for print
    document.querySelectorAll(".iu-section-body").forEach(function(el) { el.style.display = "block"; });

    // Show print header
    header.style.display = "block";

    // Trigger print
    setTimeout(function() {
      window.print();
      // Restore after print
      setTimeout(function() {
        header.style.display = "none";
        printStyle.textContent = "";
      }, 500);
    }, 200);
  }

  // ── Module Controller ──
  function renderSkeleton() {
    return '<div data-enhancer-added="true" style="padding:0 8px">' +
      '<div style="height:36px;width:260px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:10px;margin-bottom:24px"></div>' +
      '<div style="height:180px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:20px;margin-bottom:16px"></div>' +
      '<div style="height:180px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:20px"></div></div>';
  }

  async function renderModule() {
    var main = document.querySelector("main");
    if (!main) return;
    var hideStyle = document.getElementById("iu-hide-react");
    if (!hideStyle) { hideStyle = document.createElement("style"); hideStyle.id = "iu-hide-react"; document.head.appendChild(hideStyle); }
    hideStyle.textContent = "main > *:not(#iu-container) { display: none !important; }";
    var container = document.getElementById("iu-container");
    if (!container) { container = document.createElement("div"); container.id = "iu-container"; container.setAttribute("data-enhancer-added", "true"); main.appendChild(container); }

    var match = window.location.hash.match(/#inspecciones\/(\d+)/);
    if (match) {
      container.innerHTML = renderSkeleton();
      var detail = await fetchDetail(parseInt(match[1]));
      if (detail) { currentDetail = detail; container.innerHTML = renderDetail(detail); }
      else { container.innerHTML = '<div data-enhancer-added="true" style="text-align:center;padding:60px"><p style="color:#ef4444;font-size:16px;font-weight:600">Inspeccion no encontrada</p></div>'; }
    } else {
      container.innerHTML = renderSkeleton();
      inspections = await fetchInspections();
      container.innerHTML = renderList();
    }
    attachListeners();
  }

  function hideModule() {
    var c = document.getElementById("iu-container"); if (c) c.remove();
    var hs = document.getElementById("iu-hide-react"); if (hs) hs.textContent = "";
    currentDetail = null; allPhotos = [];
  }

  function attachListeners() {
    var container = document.getElementById("iu-container");
    if (!container) return;

    // Card click
    container.querySelectorAll(".iu-card").forEach(function (card) {
      card.addEventListener("click", function () { window.location.hash = "#inspecciones/" + this.getAttribute("data-id"); });
    });

    // Back
    var back = document.getElementById("iu-back");
    if (back) back.addEventListener("click", function () { window.location.hash = "#inspecciones"; });

    // PDF
    var pdfBtn = document.getElementById("iu-download-pdf");
    if (pdfBtn) pdfBtn.addEventListener("click", downloadPDF);

    // Photo lightbox
    container.querySelectorAll(".iu-photo").forEach(function (photo) {
      photo.addEventListener("click", function () { openLightbox(this.getAttribute("data-url")); });
    });

    // Section accordion toggle
    container.querySelectorAll(".iu-section-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var key = this.getAttribute("data-section");
        var body = container.querySelector('[data-section-body="' + key + '"]');
        var chevron = this.querySelector(".iu-chevron");
        if (!body) return;
        if (body.style.display === "none") {
          body.style.display = "block";
          if (chevron) chevron.style.transform = "rotate(0deg)";
        } else {
          body.style.display = "none";
          if (chevron) chevron.style.transform = "rotate(-90deg)";
        }
      });
    });
  }

  // ── Styles ──
  function addStyles() {
    if (document.getElementById("iu-styles")) return;
    var style = document.createElement("style");
    style.id = "iu-styles";
    style.textContent =
      "@keyframes iuFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes iuPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      ".iu-card{transition:all .25s ease !important}" +
      ".iu-card:hover{box-shadow:0 12px 32px rgba(0,0,0,.1)!important;transform:translateY(-3px)!important;border-color:#cbd5e1!important}" +
      ".iu-photo{transition:all .2s ease !important}" +
      ".iu-photo:hover{transform:scale(1.04)!important;box-shadow:0 4px 12px rgba(0,0,0,.12)!important}" +
      ".iu-section-header:hover{background:rgba(0,0,0,.02)}" +
      "#iu-back:hover{background:#f8fafc;border-color:#cbd5e1;color:#1e293b}" +
      "#iu-download-pdf:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(124,58,237,.35)}" +
      "#iu-lb-close:hover,#iu-lb-prev:hover,#iu-lb-next:hover{background:rgba(255,255,255,.25)!important}" +
      "@media(max-width:768px){#iu-container .iu-photo{min-width:80px}#iu-container h2{font-size:20px!important}}";
    document.head.appendChild(style);
  }

  // ── Init ──
  function init() {
    addStyles();
    setInterval(function () {
      injectSidebarItem();
      updateSidebarActive();
      if (!isInspectionPage()) {
        var hs = document.getElementById("iu-hide-react");
        if (hs && hs.textContent) hs.textContent = "";
        var c = document.getElementById("iu-container");
        if (c) c.remove();
      }
    }, 1000);

    window.addEventListener("hashchange", function () {
      updateSidebarActive();
      if (isInspectionPage()) renderModule();
      else hideModule();
    });

    injectSidebarItem();
    updateSidebarActive();
    if (isInspectionPage()) renderModule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
