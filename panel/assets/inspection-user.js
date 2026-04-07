/**
 * Inspection User Module - Imporlan Client Panel (v2.0)
 * Displays completed inspection reports to clients.
 * Features: Photo lightbox gallery, SVG radar chart, PDF print, accordion sections.
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/panel-test") || window.location.pathname.includes("/test/"))
    ? "/test/api"
    : "/api";

  var inspections = [];
  var currentDetail = null;
  var lightboxOpen = false;
  var lightboxPhotos = [];
  var lightboxIndex = 0;
  var expandedSections = {};

  var REPORT_TYPES = {
    basica: { label: "Basica", color: "#0891b2", bg: "#ecfeff", desc: "Inspeccion visual basica" },
    estandar: { label: "Estandar", color: "#2563eb", bg: "#eff6ff", desc: "Inspeccion estandar completa" },
    premium: { label: "Premium", color: "#7c3aed", bg: "#f5f3ff", desc: "Inspeccion premium con test-drive" }
  };

  var SECTION_LABELS = {
    hull: "Casco Exterior",
    engine: "Motor",
    electrical: "Sistema Electrico",
    interior: "Interior",
    trailer: "Trailer",
    navigation: "Navegacion y Electronica",
    safety: "Seguridad",
    test_drive: "Test-Drive en Agua",
    documentation: "Documentacion"
  };

  var SECTION_ICONS = {
    hull: '<path d="M3 3h18v18H3z"/>',
    engine: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    electrical: '<path d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    interior: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    trailer: '<path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>',
    navigation: '<path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>',
    safety: '<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>',
    test_drive: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    documentation: '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
  };

  // ============================================================
  // HELPERS
  // ============================================================

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      var raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
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

  function ratingColor(val) {
    if (val >= 7) return "#10b981";
    if (val >= 5) return "#f59e0b";
    return "#ef4444";
  }

  // ============================================================
  // SIDEBAR INJECTION
  // ============================================================

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

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.hash = "#inspecciones";
    });

    docContainer.parentNode.insertBefore(wrapper.tagName === "LI" ? wrapper : btn, docContainer.nextSibling);
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-inspecciones-user");
    if (!item) return;
    var active = window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/");
    if (active) {
      item.style.background = "rgba(124,58,237,0.12)";
      item.style.color = "#7c3aed";
      item.style.fontWeight = "600";
    } else {
      item.style.background = "";
      item.style.color = "";
      item.style.fontWeight = "";
    }
  }

  // ============================================================
  // API
  // ============================================================

  async function fetchInspections() {
    var email = getUserEmail();
    if (!email) return [];
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=user_list&user_email=" + encodeURIComponent(email), { headers: userAuthHeaders() });
      var data = await resp.json();
      return data.success ? data.inspections || [] : [];
    } catch (e) { console.error("Error fetching inspections:", e); return []; }
  }

  async function fetchDetail(id) {
    var email = getUserEmail();
    if (!email) return null;
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=user_detail&id=" + id + "&user_email=" + encodeURIComponent(email), { headers: userAuthHeaders() });
      var data = await resp.json();
      return data.success ? data.inspection : null;
    } catch (e) { console.error("Error fetching inspection detail:", e); return null; }
  }

  // ============================================================
  // RADAR CHART (SVG)
  // ============================================================

  function renderRadarChart(insp) {
    var sectionKeys = ["hull", "engine", "electrical", "interior", "trailer", "navigation", "safety", "test_drive", "documentation"];
    var entries = [];
    sectionKeys.forEach(function (key) {
      var data = insp["section_" + key];
      if (data && typeof data === "object" && data.rating) {
        entries.push({ key: key, label: SECTION_LABELS[key], rating: parseFloat(data.rating) });
      }
    });
    if (entries.length < 3) return "";

    var cx = 200, cy = 200, maxR = 150;
    var n = entries.length;
    var angleStep = (2 * Math.PI) / n;
    var overall = insp.overall_rating ? parseFloat(insp.overall_rating) : 5;
    var fillColor = overall >= 7 ? "16,185,129" : overall >= 5 ? "245,158,11" : "239,68,68";

    var gridLevels = [2.5, 5, 7.5, 10];
    var gridHtml = "";
    gridLevels.forEach(function (level) {
      var r = (level / 10) * maxR;
      var points = [];
      for (var i = 0; i < n; i++) {
        var angle = -Math.PI / 2 + i * angleStep;
        points.push((cx + r * Math.cos(angle)).toFixed(1) + "," + (cy + r * Math.sin(angle)).toFixed(1));
      }
      gridHtml += '<polygon points="' + points.join(" ") + '" fill="none" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="' + (level === 10 ? "0" : "4,4") + '"/>';
      gridHtml += '<text x="' + (cx + 4) + '" y="' + (cy - r + 12) + '" fill="#94a3b8" font-size="10" font-family="sans-serif">' + level.toFixed(1) + '</text>';
    });

    // Axis lines
    var axesHtml = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      var x2 = cx + maxR * Math.cos(angle);
      var y2 = cy + maxR * Math.sin(angle);
      axesHtml += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"/>';
    }

    // Data polygon
    var dataPoints = [];
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      var r = (entries[i].rating / 10) * maxR;
      dataPoints.push((cx + r * Math.cos(angle)).toFixed(1) + "," + (cy + r * Math.sin(angle)).toFixed(1));
    }
    var dataHtml = '<polygon points="' + dataPoints.join(" ") + '" fill="rgba(' + fillColor + ',0.2)" stroke="rgb(' + fillColor + ')" stroke-width="2.5" stroke-linejoin="round"/>';

    // Data points (dots)
    var dotsHtml = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      var r = (entries[i].rating / 10) * maxR;
      var px = cx + r * Math.cos(angle);
      var py = cy + r * Math.sin(angle);
      dotsHtml += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4" fill="rgb(' + fillColor + ')" stroke="#fff" stroke-width="2"/>';
    }

    // Labels
    var labelsHtml = "";
    for (var i = 0; i < n; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      var lr = maxR + 28;
      var lx = cx + lr * Math.cos(angle);
      var ly = cy + lr * Math.sin(angle);
      var anchor = "middle";
      if (Math.cos(angle) > 0.3) anchor = "start";
      else if (Math.cos(angle) < -0.3) anchor = "end";
      var rColor = ratingColor(entries[i].rating);
      labelsHtml += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#475569" font-size="11" font-weight="600" font-family="system-ui,sans-serif">' + esc(entries[i].label) + '</text>';
      labelsHtml += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 14).toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="' + rColor + '" font-size="11" font-weight="700" font-family="system-ui,sans-serif">' + entries[i].rating.toFixed(1) + '</text>';
    }

    var svg = '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;margin:0 auto;display:block" class="iu-radar-chart">' +
      gridHtml + axesHtml + dataHtml + dotsHtml + labelsHtml + '</svg>';

    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;' +
      'background:linear-gradient(135deg,rgba(255,255,255,0.9),rgba(248,250,252,0.95));' +
      'backdrop-filter:blur(10px);box-shadow:0 4px 24px rgba(0,0,0,0.04)">' +
      '<div style="padding:20px 24px;border-bottom:1px solid #f1f5f9">' +
      '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
      'Vista General por Seccion</h3></div>' +
      '<div style="padding:24px">' + svg + '</div></div>';
  }

  // ============================================================
  // RENDER: LIST
  // ============================================================

  function renderRatingStars(rating) {
    if (!rating) return '<span style="color:#cbd5e1">Sin calificacion</span>';
    var val = parseFloat(rating);
    var color = ratingColor(val);
    var pct = (val / 10 * 100).toFixed(0);
    return '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="position:relative;width:44px;height:44px;flex-shrink:0">' +
      '<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="3.5"/>' +
      '<circle cx="22" cy="22" r="18" fill="none" stroke="' + color + '" stroke-width="3.5" stroke-dasharray="' + (1.131 * parseFloat(pct)) + ' 113.1" stroke-linecap="round" transform="rotate(-90 22 22)"/></svg>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="font-size:12px;font-weight:800;color:' + color + '">' + val.toFixed(1) + '</span></div></div>' +
      '<span style="font-size:12px;color:#64748b">/ 10</span></div>';
  }

  function renderList() {
    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .4s ease">';

    html += '<div style="margin-bottom:32px">' +
      '<h2 style="margin:0;font-size:26px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:12px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(124,58,237,0.3)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg></div>' +
      'Mis Inspecciones</h2>' +
      '<p style="margin:10px 0 0;font-size:14px;color:#64748b">Tus reportes de inspeccion tecnica de embarcaciones</p></div>';

    if (inspections.length === 0) {
      html += '<div style="background:linear-gradient(135deg,rgba(255,255,255,0.9),rgba(248,250,252,0.95));backdrop-filter:blur(10px);border-radius:24px;border:1px solid #e2e8f0;padding:70px 30px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.03)">' +
        '<div style="width:80px;height:80px;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 4px 14px rgba(124,58,237,0.1)">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5">' +
        '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>' +
        '<polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>' +
        '<h3 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1e293b">No tienes inspecciones aun</h3>' +
        '<p style="margin:0;font-size:14px;color:#94a3b8;max-width:420px;margin:0 auto;line-height:1.6">Cuando contrates una inspeccion tecnica de embarcacion, podras ver el reporte completo aqui con fotos, videos y calificaciones detalladas.</p>' +
        '<div style="margin-top:28px"><a href="https://wa.me/56940211459?text=Hola%2C%20me%20interesa%20contratar%20una%20inspeccion%20de%20embarcacion" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:14px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 16px rgba(37,211,102,.3);transition:all .2s"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Solicitar Inspeccion</a></div></div>';
    } else {
      html += '<div style="display:grid;gap:18px">';
      inspections.forEach(function (insp, idx) {
        var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
        var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Embarcacion";
        var location = [insp.city, insp.state_region, (insp.country || "").toUpperCase()].filter(Boolean).join(", ");

        html += '<div class="iu-card" data-id="' + insp.id + '" style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));backdrop-filter:blur(10px);border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);animation:iuFadeIn .4s ease ' + (idx * 0.06) + 's both">' +
          '<div style="display:flex;align-items:stretch">' +
          '<div style="width:6px;background:linear-gradient(180deg,' + rt.color + ',' + rt.color + 'aa);flex-shrink:0;border-radius:0 0 0 0"></div>' +
          '<div style="flex:1;padding:22px 26px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px">' +
          '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">' + esc(vessel) + '</h3>' +
          '<p style="margin:5px 0 0;font-size:13px;color:#64748b;display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(location) + '</p></div>' +
          '<span style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;border:1px solid ' + rt.color + '22">' + rt.label + '</span></div>' +

          '<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:16px">' +
          (insp.length_ft ? '<div style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M18 8v8"/></svg><span style="font-size:12px;color:#64748b">' + insp.length_ft + ' ft</span></div>' : '') +
          (insp.hull_material ? '<div style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg><span style="font-size:12px;color:#64748b">' + esc(insp.hull_material) + '</span></div>' : '') +
          (insp.inspector_name ? '<div style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="font-size:12px;color:#64748b">' + esc(insp.inspector_name) + '</span></div>' : '') +
          '</div>' +

          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<div>' + renderRatingStars(insp.overall_rating) + '</div>' +
          '<div style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span style="font-size:12px;color:#94a3b8">' + fmtDate(insp.sent_at || insp.created_at) + '</span></div>' +
          '</div>' +
          '</div></div></div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ============================================================
  // RENDER: DETAIL
  // ============================================================

  function renderDetail(insp) {
    var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
    var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Embarcacion";
    var location = [insp.city, insp.state_region, (insp.country || "").toUpperCase()].filter(Boolean).join(", ");

    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .4s ease">';

    // Back + header + PDF button
    html += '<div style="margin-bottom:24px" class="iu-detail-header">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">' +
      '<button id="iu-back" class="iu-no-print" style="padding:9px 16px;border-radius:12px;border:1px solid #e2e8f0;background:linear-gradient(135deg,#fff,#f8fafc);color:#64748b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.04)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Volver</button>' +
      '<button id="iu-pdf-btn" class="iu-no-print" style="padding:9px 18px;border-radius:12px;border:1px solid #e2e8f0;background:linear-gradient(135deg,#fff,#f8fafc);color:#475569;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.04)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar PDF</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
      '<div><h2 style="margin:0;font-size:26px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:12px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,' + rt.color + ',' + rt.color + 'cc);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px ' + rt.color + '44;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></div>' +
      'Reporte de Inspeccion</h2>' +
      '<p style="margin:8px 0 0;font-size:15px;color:#64748b">' + esc(vessel) + (location ? ' &mdash; ' + esc(location) : '') + '</p></div>' +
      '<span style="padding:7px 18px;border-radius:20px;font-size:12px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.04em;border:1px solid ' + rt.color + '22;white-space:nowrap">Inspeccion ' + rt.label + '</span></div></div>';

    // Print-only branding header
    html += '<div class="iu-print-header" style="display:none"><div style="text-align:center;padding:20px 0 16px;border-bottom:3px solid #7c3aed;margin-bottom:24px">' +
      '<h1 style="margin:0;font-size:28px;font-weight:800;color:#0f172a">IMPORLAN</h1>' +
      '<p style="margin:4px 0 0;font-size:13px;color:#64748b;letter-spacing:.1em;text-transform:uppercase">Reporte de Inspeccion Tecnica de Embarcacion</p>' +
      '<p style="margin:8px 0 0;font-size:14px;color:#475569"><strong>' + esc(vessel) + '</strong>' + (location ? ' &mdash; ' + esc(location) : '') + ' &mdash; Inspeccion ' + rt.label + '</p>' +
      '</div></div>';

    // Overall rating card
    if (insp.overall_rating) {
      var ratingPct = (parseFloat(insp.overall_rating) / 10 * 100).toFixed(0);
      var rc = ratingColor(parseFloat(insp.overall_rating));
      html += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:22px;padding:30px 34px;margin-bottom:24px;display:flex;align-items:center;gap:30px;flex-wrap:wrap;box-shadow:0 8px 32px rgba(15,23,42,0.3)" class="iu-overall-card">' +
        '<div style="position:relative;width:110px;height:110px;flex-shrink:0">' +
        '<svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>' +
        '<circle cx="55" cy="55" r="46" fill="none" stroke="' + rc + '" stroke-width="8" stroke-dasharray="' + (2.89 * parseFloat(ratingPct)) + ' 289" stroke-linecap="round" transform="rotate(-90 55 55)" style="transition:stroke-dasharray .8s ease"/></svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:32px;font-weight:800;color:#fff">' + parseFloat(insp.overall_rating).toFixed(1) + '</span><span style="font-size:11px;color:#94a3b8;margin-top:-2px">/10</span></div></div>' +
        '<div style="flex:1;min-width:200px"><h3 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#fff">Calificacion General</h3>' +
        '<p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7">' + esc(insp.overall_summary || "Sin resumen disponible") + '</p>' +
        (insp.inspector_name ? '<p style="margin:12px 0 0;font-size:12px;color:#64748b">Inspector: <strong style="color:#cbd5e1">' + esc(insp.inspector_name) + '</strong></p>' : '') +
        '</div></div>';
    }

    // Radar chart
    html += renderRadarChart(insp);

    // Vessel info card with icons
    html += '<div style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));backdrop-filter:blur(10px);border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 4px 24px rgba(0,0,0,0.03)">' +
      '<div style="padding:20px 26px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>Datos de la Embarcacion</h3></div>' +
      '<div style="padding:22px 26px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px">';

    var vesselFields = [
      { label: "Tipo", value: insp.vessel_type },
      { label: "Marca", value: insp.brand },
      { label: "Modelo", value: insp.model },
      { label: "Ano", value: insp.vessel_year },
      { label: "Eslora", value: insp.length_ft ? insp.length_ft + " ft" : null },
      { label: "Material", value: insp.hull_material },
      { label: "Motor", value: [insp.engine_brand, insp.engine_model].filter(Boolean).join(" ") },
      { label: "Horas Motor", value: insp.engine_hours },
      { label: "Motores", value: insp.num_engines },
      { label: "Combustible", value: insp.fuel_type },
      { label: "Pais", value: (insp.country || "").toUpperCase() },
      { label: "Ciudad", value: insp.city },
      { label: "Marina", value: insp.marina }
    ];

    vesselFields.forEach(function (f) {
      if (!f.value) return;
      html += '<div style="background:#f8fafc;border-radius:12px;padding:14px 16px;border:1px solid #f1f5f9;transition:all .2s" class="iu-vessel-field">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' +
        '<span style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.06em">' + f.label + '</span></div>' +
        '<p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">' + esc(String(f.value)) + '</p></div>';
    });

    html += '</div></div></div>';

    // Inspection sections (accordion)
    var sectionKeys = ["hull", "engine", "electrical", "interior", "trailer", "navigation", "safety", "test_drive", "documentation"];
    sectionKeys.forEach(function (key) {
      var data = insp["section_" + key];
      if (!data || typeof data !== "object") return;
      var hasContent = Object.keys(data).some(function (k) { return data[k] && data[k] !== ""; });
      if (!hasContent) return;

      var label = SECTION_LABELS[key] || key;
      var iconPath = SECTION_ICONS[key] || '<path d="M9 12l2 2 4-4"/>';
      var sectionRating = data.rating ? parseFloat(data.rating) : null;
      var rColor = sectionRating ? ratingColor(sectionRating) : "#94a3b8";
      var isExpanded = expandedSections[key] !== false; // default expanded

      html += '<div class="iu-section-card" data-section="' + key + '" style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));backdrop-filter:blur(10px);border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:18px;box-shadow:0 2px 12px rgba(0,0,0,0.02);transition:all .2s">' +
        '<div class="iu-section-header" style="padding:18px 26px;border-bottom:' + (isExpanded ? '1px solid #f1f5f9' : 'none') + ';display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background .2s;user-select:none" data-key="' + key + '">' +
        '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px">' +
        '<div style="width:34px;height:34px;background:linear-gradient(135deg,' + rt.bg + ',' + rt.color + '18);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + rt.color + '" stroke-width="2">' + iconPath + '</svg></div>' +
        esc(label) + '</h3>' +
        '<div style="display:flex;align-items:center;gap:12px">';

      if (sectionRating) {
        html += '<div style="display:flex;align-items:center;gap:5px"><span style="font-size:20px;font-weight:800;color:' + rColor + '">' + sectionRating.toFixed(1) + '</span><span style="font-size:11px;color:#94a3b8">/10</span></div>';
      }
      html += '<svg class="iu-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="transition:transform .3s;transform:rotate(' + (isExpanded ? '180' : '0') + 'deg)"><polyline points="6 9 12 15 18 9"/></svg>';
      html += '</div></div>';

      html += '<div class="iu-section-body" style="' + (isExpanded ? '' : 'display:none;') + '">';
      html += '<div style="padding:20px 26px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">';

      Object.keys(data).forEach(function (fieldKey) {
        if (fieldKey === "rating" || fieldKey === "notes" || !data[fieldKey]) return;
        var fieldLabel = fieldKey.replace(/_/g, " ").replace(/\b\w/g, function (l) { return l.toUpperCase(); });
        var val = data[fieldKey];
        var valColor = "#1e293b";
        var valBg = "#f8fafc";
        var valBorder = "#f1f5f9";
        if (["Malo", "Severa", "No funciona", "Danado", "Requiere reemplazo", "Excesivo"].some(function (w) { return String(val).includes(w); })) {
          valColor = "#dc2626"; valBg = "#fef2f2"; valBorder = "#fecaca";
        } else if (["Excelente", "Buen estado", "Funcionando", "Si", "Limpio", "Normal"].some(function (w) { return String(val).includes(w); })) {
          valColor = "#059669"; valBg = "#ecfdf5"; valBorder = "#a7f3d0";
        } else if (["Regular", "Desgaste", "Parcial", "Debil"].some(function (w) { return String(val).includes(w); })) {
          valColor = "#d97706"; valBg = "#fffbeb"; valBorder = "#fde68a";
        }

        html += '<div style="background:' + valBg + ';border-radius:12px;padding:12px 14px;border:1px solid ' + valBorder + ';transition:all .2s">' +
          '<p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:.05em">' + esc(fieldLabel) + '</p>' +
          '<p style="margin:5px 0 0;font-size:14px;font-weight:600;color:' + valColor + '">' + esc(val) + '</p></div>';
      });

      html += '</div>';

      // Notes
      if (data.notes) {
        html += '<div style="margin-top:16px;padding:16px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:12px;border:1px solid #fde68a">' +
          '<p style="margin:0;font-size:12px;font-weight:700;color:#92400e;margin-bottom:5px;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>Observaciones</p>' +
          '<p style="margin:0;font-size:13px;color:#78350f;line-height:1.6">' + esc(data.notes) + '</p></div>';
      }

      html += '</div></div>';

      // Section photos
      var photos = insp["photos_" + key] || [];
      if (photos.length > 0) {
        html += '<div style="padding:0 26px 20px">' +
          '<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;display:flex;align-items:center;gap:5px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Fotos (' + photos.length + ')</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">';
        photos.forEach(function (url, idx) {
          html += '<div class="iu-photo" data-section-photos="photos_' + key + '" data-photo-idx="' + idx + '" style="border-radius:12px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0;transition:all .25s">' +
            '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
        });
        html += '</div></div>';
      }

      html += '</div></div>';
    });

    // Videos test drive
    var videos = insp.videos_test_drive || [];
    if (videos.length > 0) {
      html += '<div style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));backdrop-filter:blur(10px);border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 4px 24px rgba(0,0,0,0.03)">' +
        '<div style="padding:20px 26px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Videos Test-Drive</h3></div>' +
        '<div style="padding:22px 26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">';
      videos.forEach(function (url) {
        html += '<div style="border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04)"><video src="' + esc(url) + '" controls style="width:100%;display:block" preload="metadata"></video></div>';
      });
      html += '</div></div>';
    }

    // General photos
    var generalPhotos = insp.photos_general || [];
    if (generalPhotos.length > 0) {
      html += '<div style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));backdrop-filter:blur(10px);border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;box-shadow:0 4px 24px rgba(0,0,0,0.03)">' +
        '<div style="padding:20px 26px;border-bottom:1px solid #f1f5f9"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Fotos Generales (' + generalPhotos.length + ')</h3></div>' +
        '<div style="padding:22px 26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">';
      generalPhotos.forEach(function (url, idx) {
        html += '<div class="iu-photo" data-section-photos="photos_general" data-photo-idx="' + idx + '" style="border-radius:12px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0;transition:all .25s">' +
          '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
      });
      html += '</div></div>';
    }

    // Recommendations
    if (insp.recommendations) {
      html += '<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:20px;border:1px solid #a7f3d0;padding:26px;margin-bottom:24px;box-shadow:0 4px 16px rgba(16,185,129,0.08)">' +
        '<h3 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#065f46;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Recomendaciones del Inspector</h3>' +
        '<p style="margin:0;font-size:14px;color:#065f46;line-height:1.7;white-space:pre-wrap">' + esc(insp.recommendations) + '</p></div>';
    }

    // Listing URL
    if (insp.listing_url) {
      html += '<div style="background:linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98));border-radius:16px;border:1px solid #e2e8f0;padding:18px 22px;margin-bottom:24px;display:flex;align-items:center;gap:12px">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>' +
        '<a href="' + esc(insp.listing_url) + '" target="_blank" style="color:#2563eb;font-size:14px;word-break:break-all;text-decoration:underline">' + esc(insp.listing_url) + '</a></div>';
    }

    // Report date footer
    html += '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:12px">' +
      'Reporte generado el ' + fmtDate(insp.sent_at || insp.created_at) +
      ' &bull; Inspeccion ' + rt.label + ' &bull; Imporlan.cl</div>';

    html += '</div>';
    return html;
  }

  // ============================================================
  // LIGHTBOX (Gallery with prev/next, thumbnails, keyboard)
  // ============================================================

  function collectAllPhotos(insp) {
    var all = [];
    var sectionKeys = ["hull", "engine", "electrical", "interior", "trailer", "navigation", "safety", "test_drive"];
    sectionKeys.forEach(function (key) {
      var photos = insp["photos_" + key] || [];
      photos.forEach(function (url) {
        all.push({ url: url, section: SECTION_LABELS[key] || key });
      });
    });
    var general = insp.photos_general || [];
    general.forEach(function (url) {
      all.push({ url: url, section: "General" });
    });
    return all;
  }

  function openLightbox(photos, startIndex) {
    if (lightboxOpen) return;
    lightboxOpen = true;
    lightboxPhotos = photos;
    lightboxIndex = startIndex || 0;

    var overlay = document.createElement("div");
    overlay.id = "iu-lightbox";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:iuFadeIn .2s;backdrop-filter:blur(12px)";

    function renderLightboxContent() {
      var photo = lightboxPhotos[lightboxIndex];
      var total = lightboxPhotos.length;

      var html = '<div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;z-index:10">' +
        '<span style="background:rgba(255,255,255,.12);padding:6px 14px;border-radius:20px;color:#fff;font-size:13px;font-weight:600">' + (lightboxIndex + 1) + ' / ' + total + '</span>';
      if (photo.section) {
        html += '<span style="background:rgba(124,58,237,.3);padding:6px 14px;border-radius:20px;color:#e2d5ff;font-size:12px;font-weight:500">' + esc(photo.section) + '</span>';
      }
      html += '</div>';

      // Close button
      html += '<button class="iu-lb-close" style="position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background .2s">&times;</button>';

      // Prev/Next arrows
      if (total > 1) {
        html += '<button class="iu-lb-prev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .2s"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>';
        html += '<button class="iu-lb-next" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .2s"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>';
      }

      // Main image
      html += '<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;padding:60px 70px 10px;box-sizing:border-box">' +
        '<img src="' + esc(photo.url) + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);transition:opacity .25s" class="iu-lb-img">' +
        '</div>';

      // Thumbnail strip
      if (total > 1) {
        html += '<div style="width:100%;padding:10px 20px 16px;box-sizing:border-box;overflow-x:auto;display:flex;gap:6px;justify-content:center;flex-wrap:nowrap" class="iu-lb-thumbs">';
        lightboxPhotos.forEach(function (p, idx) {
          var active = idx === lightboxIndex;
          html += '<div class="iu-lb-thumb" data-idx="' + idx + '" style="width:56px;height:56px;flex-shrink:0;border-radius:8px;overflow:hidden;cursor:pointer;border:2px solid ' + (active ? '#7c3aed' : 'transparent') + ';opacity:' + (active ? '1' : '0.5') + ';transition:all .2s">' +
            '<img src="' + esc(p.url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
        });
        html += '</div>';
      }

      return html;
    }

    overlay.innerHTML = renderLightboxContent();

    function updateLightbox() {
      overlay.innerHTML = renderLightboxContent();
      attachLightboxListeners();
    }

    function goTo(idx) {
      if (idx < 0) idx = lightboxPhotos.length - 1;
      if (idx >= lightboxPhotos.length) idx = 0;
      lightboxIndex = idx;
      updateLightbox();
    }

    function closeLightbox() {
      overlay.remove();
      lightboxOpen = false;
      document.removeEventListener("keydown", handleKey);
    }

    function handleKey(e) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") goTo(lightboxIndex - 1);
      else if (e.key === "ArrowRight") goTo(lightboxIndex + 1);
    }

    function attachLightboxListeners() {
      var closeBtn = overlay.querySelector(".iu-lb-close");
      if (closeBtn) closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeLightbox(); });

      var prevBtn = overlay.querySelector(".iu-lb-prev");
      if (prevBtn) prevBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(lightboxIndex - 1); });

      var nextBtn = overlay.querySelector(".iu-lb-next");
      if (nextBtn) nextBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(lightboxIndex + 1); });

      overlay.querySelectorAll(".iu-lb-thumb").forEach(function (thumb) {
        thumb.addEventListener("click", function (e) { e.stopPropagation(); goTo(parseInt(this.getAttribute("data-idx"))); });
      });

      // Click on backdrop (not on image/buttons) to close
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeLightbox();
      });
    }

    attachLightboxListeners();
    document.addEventListener("keydown", handleKey);
    document.body.appendChild(overlay);
  }

  // ============================================================
  // MODULE RENDERING & CONTROL
  // ============================================================

  function renderSkeleton() {
    return '<div data-enhancer-added="true" style="padding:0 8px">' +
      '<div style="height:34px;width:260px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:10px;margin-bottom:28px"></div>' +
      '<div style="height:220px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:20px;margin-bottom:18px"></div>' +
      '<div style="height:220px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:20px"></div></div>';
  }

  async function renderModule() {
    var main = document.querySelector("main");
    if (!main) return;

    var hideStyle = document.getElementById("iu-hide-react");
    if (!hideStyle) {
      hideStyle = document.createElement("style");
      hideStyle.id = "iu-hide-react";
      document.head.appendChild(hideStyle);
    }
    hideStyle.textContent = "main > *:not(#iu-container) { display: none !important; }";

    var container = document.getElementById("iu-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "iu-container";
      container.setAttribute("data-enhancer-added", "true");
      main.appendChild(container);
    }

    var match = window.location.hash.match(/#inspecciones\/(\d+)/);
    if (match) {
      container.innerHTML = renderSkeleton();
      var detail = await fetchDetail(parseInt(match[1]));
      if (detail) {
        currentDetail = detail;
        container.innerHTML = renderDetail(detail);
      } else {
        container.innerHTML = '<div data-enhancer-added="true" style="text-align:center;padding:80px 20px">' +
          '<div style="width:64px;height:64px;background:#fef2f2;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>' +
          '<h3 style="margin:0 0 8px;color:#1e293b;font-weight:700">Inspeccion no encontrada</h3>' +
          '<p style="color:#64748b;font-size:14px">Esta inspeccion no existe o no tienes acceso.</p>' +
          '<button onclick="window.location.hash=\'#inspecciones\'" style="margin-top:20px;padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;font-size:13px">Volver a Mis Inspecciones</button></div>';
      }
    } else {
      container.innerHTML = renderSkeleton();
      inspections = await fetchInspections();
      container.innerHTML = renderList();
    }

    attachListeners();
  }

  function hideModule() {
    var container = document.getElementById("iu-container");
    if (container) container.remove();
    var hideStyle = document.getElementById("iu-hide-react");
    if (hideStyle) hideStyle.textContent = "";
    currentDetail = null;
  }

  function attachListeners() {
    var container = document.getElementById("iu-container");
    if (!container) return;

    // Card click -> detail
    container.querySelectorAll(".iu-card").forEach(function (card) {
      card.addEventListener("click", function () {
        window.location.hash = "#inspecciones/" + this.getAttribute("data-id");
      });
      card.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-3px) scale(1.005)";
        this.style.boxShadow = "0 12px 32px rgba(0,0,0,.08)";
        this.style.borderColor = "#cbd5e1";
      });
      card.addEventListener("mouseleave", function () {
        this.style.transform = "";
        this.style.boxShadow = "";
        this.style.borderColor = "";
      });
    });

    // Back button
    var back = document.getElementById("iu-back");
    if (back) {
      back.addEventListener("click", function () {
        window.location.hash = "#inspecciones";
      });
      back.addEventListener("mouseenter", function () { this.style.background = "#f1f5f9"; this.style.borderColor = "#cbd5e1"; });
      back.addEventListener("mouseleave", function () { this.style.background = ""; this.style.borderColor = ""; });
    }

    // PDF button
    var pdfBtn = document.getElementById("iu-pdf-btn");
    if (pdfBtn) {
      pdfBtn.addEventListener("click", function () {
        triggerPdfPrint();
      });
      pdfBtn.addEventListener("mouseenter", function () { this.style.background = "#f1f5f9"; this.style.borderColor = "#cbd5e1"; });
      pdfBtn.addEventListener("mouseleave", function () { this.style.background = ""; this.style.borderColor = ""; });
    }

    // Accordion section headers
    container.querySelectorAll(".iu-section-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var key = this.getAttribute("data-key");
        var body = this.parentElement.querySelector(".iu-section-body");
        var chevron = this.querySelector(".iu-chevron");
        if (!body) return;

        var isVisible = body.style.display !== "none";
        body.style.display = isVisible ? "none" : "";
        this.style.borderBottom = isVisible ? "none" : "1px solid #f1f5f9";
        if (chevron) chevron.style.transform = "rotate(" + (isVisible ? "0" : "180") + "deg)";
        expandedSections[key] = !isVisible;
      });
      header.addEventListener("mouseenter", function () { this.style.background = "#fafbfc"; });
      header.addEventListener("mouseleave", function () { this.style.background = ""; });
    });

    // Photo lightbox with gallery
    container.querySelectorAll(".iu-photo").forEach(function (photo) {
      photo.addEventListener("click", function () {
        if (!currentDetail) return;
        var sectionPhotosKey = this.getAttribute("data-section-photos");
        var photoIdx = parseInt(this.getAttribute("data-photo-idx") || "0");

        if (sectionPhotosKey && currentDetail[sectionPhotosKey]) {
          var sectionName = sectionPhotosKey.replace("photos_", "");
          var sLabel = SECTION_LABELS[sectionName] || (sectionName === "general" ? "General" : sectionName);
          var photos = currentDetail[sectionPhotosKey].map(function (url) { return { url: url, section: sLabel }; });
          openLightbox(photos, photoIdx);
        } else {
          // Fallback: single photo
          var url = this.getAttribute("data-url") || this.querySelector("img").src;
          openLightbox([{ url: url, section: "" }], 0);
        }
      });
    });
  }

  // ============================================================
  // PDF PRINT
  // ============================================================

  function triggerPdfPrint() {
    // Expand all sections before printing
    var container = document.getElementById("iu-container");
    if (!container) return;

    var bodies = container.querySelectorAll(".iu-section-body");
    var chevrons = container.querySelectorAll(".iu-chevron");
    var headers = container.querySelectorAll(".iu-section-header");

    bodies.forEach(function (b) { b.style.display = ""; });
    chevrons.forEach(function (c) { c.style.transform = "rotate(180deg)"; });
    headers.forEach(function (h) { h.style.borderBottom = "1px solid #f1f5f9"; });

    // Add print stylesheet
    var printStyle = document.getElementById("iu-print-style");
    if (!printStyle) {
      printStyle = document.createElement("style");
      printStyle.id = "iu-print-style";
      document.head.appendChild(printStyle);
    }
    printStyle.textContent = [
      "@media print {",
      "  @page { size: A4; margin: 15mm; }",
      "  body * { visibility: hidden !important; }",
      "  #iu-container, #iu-container * { visibility: visible !important; }",
      "  #iu-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; }",
      "  aside, nav, header, .iu-no-print { display: none !important; }",
      "  .iu-print-header { display: block !important; }",
      "  .iu-section-body { display: block !important; }",
      "  .iu-chevron { display: none !important; }",
      "  .iu-section-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px !important; }",
      "  .iu-overall-card { break-inside: avoid; page-break-inside: avoid; }",
      "  .iu-radar-chart { max-width: 350px !important; }",
      "  .iu-photo { break-inside: avoid; }",
      "  .iu-card { break-inside: avoid; }",
      "  video { display: none !important; }",
      "  a[href]:after { content: none !important; }",
      "  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
      "}"
    ].join("\n");

    setTimeout(function () {
      window.print();
    }, 200);
  }

  // ============================================================
  // STYLES & INIT
  // ============================================================

  function addStyles() {
    if (document.getElementById("iu-styles")) return;
    var style = document.createElement("style");
    style.id = "iu-styles";
    style.textContent = [
      "@keyframes iuFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes iuPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}",
      ".iu-card{transition:all .3s cubic-bezier(.4,0,.2,1)!important}",
      ".iu-card:hover{box-shadow:0 12px 32px rgba(0,0,0,.08)!important;transform:translateY(-3px) scale(1.005)!important;border-color:#cbd5e1!important}",
      ".iu-photo{transition:all .25s cubic-bezier(.4,0,.2,1)}",
      ".iu-photo:hover{opacity:.88;transform:scale(1.04);box-shadow:0 4px 16px rgba(0,0,0,.12)}",
      ".iu-vessel-field:hover{background:#f1f5f9;border-color:#e2e8f0}",
      ".iu-section-header:hover{background:#fafbfc}",
      ".iu-lb-close:hover,.iu-lb-prev:hover,.iu-lb-next:hover{background:rgba(255,255,255,.2)!important}",
      ".iu-lb-thumb:hover{opacity:.8!important;border-color:#a78bfa!important}",
      "#iu-pdf-btn:hover,#iu-back:hover{background:#f1f5f9!important;border-color:#cbd5e1!important}",
      "@media(max-width:768px){",
      "  #iu-container .iu-photo{min-width:80px}",
      "  .iu-lb-prev,.iu-lb-next{width:38px!important;height:38px!important}",
      "  .iu-lb-thumbs{justify-content:flex-start!important;padding:8px 10px 12px!important}",
      "  .iu-lb-thumb{width:44px!important;height:44px!important}",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function init() {
    addStyles();

    var sidebarInterval = setInterval(function () {
      injectSidebarItem();
      updateSidebarActive();
      if (window.location.hash !== "#inspecciones" && !window.location.hash.startsWith("#inspecciones/")) {
        var hs = document.getElementById("iu-hide-react");
        if (hs && hs.textContent) { hs.textContent = ""; }
        var c = document.getElementById("iu-container");
        if (c) c.remove();
      }
    }, 1000);

    window.addEventListener("hashchange", function () {
      updateSidebarActive();
      if (window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/")) {
        renderModule();
      } else {
        hideModule();
      }
    });

    injectSidebarItem();
    updateSidebarActive();
    if (window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/")) {
      renderModule();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
