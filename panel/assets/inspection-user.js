/**
 * Inspection User Module - Imporlan Client Panel
 * Displays completed inspection reports to clients.
 * Read-only view with photo gallery and video player.
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/panel-test") || window.location.pathname.includes("/test/"))
    ? "/test/api"
    : "/api";

  var inspections = [];
  var currentDetail = null;
  var lightboxOpen = false;

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

  // ============================================================
  // SIDEBAR INJECTION
  // ============================================================

  function injectSidebarItem() {
    if (document.getElementById("sidebar-inspecciones-user")) return;
    var nav = document.querySelector("aside nav") || document.querySelector("nav");
    if (!nav) return;

    var refBtn = null;
    var buttons = nav.querySelectorAll("button, a");
    buttons.forEach(function (el) {
      var text = el.textContent.trim().toLowerCase();
      if (text.includes("productos") || text.includes("contratados") || text.includes("expedientes")) refBtn = el;
    });
    if (!refBtn && buttons.length > 0) refBtn = buttons[buttons.length - 1];
    if (!refBtn) return;

    var li = document.createElement("li");
    var btn = document.createElement("button");
    btn.id = "sidebar-inspecciones-user";
    if (refBtn.className) btn.className = refBtn.className;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg> Inspecciones';

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.hash = "#inspecciones";
    });

    li.appendChild(btn);
    var refLi = refBtn.closest("li");
    if (refLi && refLi.parentNode) refLi.parentNode.insertBefore(li, refLi.nextSibling);
    else if (nav.querySelector("ul")) nav.querySelector("ul").appendChild(li);
    else nav.appendChild(li);
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
  // RENDER: LIST
  // ============================================================

  function renderRatingStars(rating) {
    if (!rating) return '<span style="color:#cbd5e1">Sin calificacion</span>';
    var val = parseFloat(rating);
    var stars = "";
    for (var i = 1; i <= 10; i++) {
      if (i <= val) stars += '<span style="color:#f59e0b">&#9733;</span>';
      else stars += '<span style="color:#e2e8f0">&#9733;</span>';
    }
    return '<span style="font-size:14px">' + stars + '</span> <span style="font-weight:700;color:#0f172a;margin-left:4px">' + val.toFixed(1) + '/10</span>';
  }

  function renderList() {
    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .3s ease">';

    html += '<div style="margin-bottom:28px">' +
      '<h2 style="margin:0;font-size:24px;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:10px">' +
      '<div style="width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg></div>' +
      'Mis Inspecciones</h2>' +
      '<p style="margin:8px 0 0;font-size:14px;color:#64748b">Tus reportes de inspeccion tecnica de embarcaciones</p></div>';

    if (inspections.length === 0) {
      html += '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;padding:60px 30px;text-align:center">' +
        '<div style="width:64px;height:64px;background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>' +
        '<h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1e293b">No tienes inspecciones</h3>' +
        '<p style="margin:0;font-size:14px;color:#94a3b8;max-width:400px;margin:0 auto">Cuando contrates una inspeccion tecnica, podras ver el reporte completo aqui.</p>' +
        '<div style="margin-top:24px"><a href="https://wa.me/56940211459?text=Hola%2C%20me%20interesa%20contratar%20una%20inspeccion%20de%20embarcacion" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 12px rgba(37,211,102,.3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Solicitar Inspeccion</a></div></div>';
    } else {
      html += '<div style="display:grid;gap:16px">';
      inspections.forEach(function (insp) {
        var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
        var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Embarcacion";
        var location = [insp.city, insp.state_region, (insp.country || "").toUpperCase()].filter(Boolean).join(", ");

        html += '<div class="iu-card" data-id="' + insp.id + '" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;cursor:pointer;transition:all .2s">' +
          '<div style="display:flex;align-items:stretch">' +
          '<div style="width:8px;background:' + rt.color + ';flex-shrink:0"></div>' +
          '<div style="flex:1;padding:20px 24px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
          '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">' + esc(vessel) + '</h3>' +
          '<p style="margin:4px 0 0;font-size:13px;color:#64748b">' + esc(location) + '</p></div>' +
          '<span style="padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.03em;white-space:nowrap">' + rt.label + '</span></div>' +

          '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:14px">' +
          (insp.length_ft ? '<div style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 3H3v18h18V3z"/></svg><span style="font-size:13px;color:#64748b">' + insp.length_ft + ' ft</span></div>' : '') +
          (insp.hull_material ? '<div style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg><span style="font-size:13px;color:#64748b">' + esc(insp.hull_material) + '</span></div>' : '') +
          (insp.inspector_name ? '<div style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="font-size:13px;color:#64748b">Inspector: ' + esc(insp.inspector_name) + '</span></div>' : '') +
          '</div>' +

          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<div>' + renderRatingStars(insp.overall_rating) + '</div>' +
          '<div style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span style="font-size:12px;color:#94a3b8">' + fmtDate(insp.sent_at || insp.created_at) + '</span></div>' +
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

    var html = '<div data-enhancer-added="true" style="padding:0 8px;animation:iuFadeIn .3s ease">';

    // Back + header
    html += '<div style="margin-bottom:24px">' +
      '<button id="iu-back" style="padding:8px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;margin-bottom:16px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Volver a Mis Inspecciones</button>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
      '<div><h2 style="margin:0;font-size:24px;font-weight:800;color:#0f172a">Reporte de Inspeccion Tecnica</h2>' +
      '<p style="margin:6px 0 0;font-size:15px;color:#64748b">' + esc(vessel) + (location ? ' - ' + esc(location) : '') + '</p></div>' +
      '<span style="padding:6px 16px;border-radius:10px;font-size:13px;font-weight:700;background:' + rt.bg + ';color:' + rt.color + ';text-transform:uppercase;letter-spacing:.03em">Inspeccion ' + rt.label + '</span></div></div>';

    // Overall rating card
    if (insp.overall_rating) {
      var ratingPct = (parseFloat(insp.overall_rating) / 10 * 100).toFixed(0);
      var ratingColor = parseFloat(insp.overall_rating) >= 7 ? "#10b981" : parseFloat(insp.overall_rating) >= 5 ? "#f59e0b" : "#ef4444";
      html += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:20px;padding:28px 32px;margin-bottom:24px;display:flex;align-items:center;gap:28px;flex-wrap:wrap">' +
        '<div style="position:relative;width:100px;height:100px;flex-shrink:0">' +
        '<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="8"/>' +
        '<circle cx="50" cy="50" r="42" fill="none" stroke="' + ratingColor + '" stroke-width="8" stroke-dasharray="' + (2.64 * parseFloat(ratingPct)) + ' 264" stroke-linecap="round" transform="rotate(-90 50 50)" style="transition:stroke-dasharray .6s"/></svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><span style="font-size:28px;font-weight:800;color:#fff">' + parseFloat(insp.overall_rating).toFixed(1) + '</span><span style="font-size:11px;color:#94a3b8">/10</span></div></div>' +
        '<div style="flex:1;min-width:200px"><h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#fff">Calificacion General</h3>' +
        '<p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6">' + esc(insp.overall_summary || 'Sin resumen disponible') + '</p>' +
        (insp.inspector_name ? '<p style="margin:10px 0 0;font-size:12px;color:#64748b">Inspector: <strong style="color:#94a3b8">' + esc(insp.inspector_name) + '</strong></p>' : '') +
        '</div></div>';
    }

    // Vessel info
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>Datos de la Embarcacion</h3></div>' +
      '<div style="padding:20px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px">';

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
      html += '<div><p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:.05em">' + f.label + '</p>' +
        '<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b">' + esc(String(f.value)) + '</p></div>';
    });

    html += '</div></div></div>';

    // Inspection sections
    var sectionKeys = ["hull", "engine", "electrical", "interior", "trailer", "navigation", "safety", "test_drive", "documentation"];
    sectionKeys.forEach(function (key) {
      var data = insp["section_" + key];
      if (!data || typeof data !== "object") return;
      var hasContent = Object.keys(data).some(function (k) { return data[k] && data[k] !== ""; });
      if (!hasContent) return;

      var label = SECTION_LABELS[key] || key;
      var iconPath = SECTION_ICONS[key] || '<path d="M9 12l2 2 4-4"/>';
      var sectionRating = data.rating ? parseFloat(data.rating) : null;
      var rColor = sectionRating >= 7 ? "#10b981" : sectionRating >= 5 ? "#f59e0b" : sectionRating > 0 ? "#ef4444" : "#94a3b8";

      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:16px">' +
        '<div style="padding:16px 24px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">' +
        '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px">' +
        '<div style="width:32px;height:32px;background:linear-gradient(135deg,' + rt.bg + ',' + rt.color + '22);border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + rt.color + '" stroke-width="2">' + iconPath + '</svg></div>' +
        esc(label) + '</h3>';

      if (sectionRating) {
        html += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:20px;font-weight:800;color:' + rColor + '">' + sectionRating.toFixed(1) + '</span><span style="font-size:11px;color:#94a3b8">/10</span></div>';
      }
      html += '</div><div style="padding:18px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">';

      Object.keys(data).forEach(function (fieldKey) {
        if (fieldKey === "rating" || fieldKey === "notes" || !data[fieldKey]) return;
        var fieldLabel = fieldKey.replace(/_/g, " ").replace(/\b\w/g, function (l) { return l.toUpperCase(); });
        var val = data[fieldKey];
        var valColor = "#1e293b";
        if (["Malo", "Severa", "No funciona", "Danado", "Requiere reemplazo", "Excesivo"].some(function (w) { return String(val).includes(w); })) valColor = "#ef4444";
        else if (["Excelente", "Buen estado", "Funcionando", "Si", "Limpio", "Normal"].some(function (w) { return String(val).includes(w); })) valColor = "#10b981";
        else if (["Regular", "Desgaste", "Parcial", "Debil"].some(function (w) { return String(val).includes(w); })) valColor = "#f59e0b";

        html += '<div style="background:#f8fafc;border-radius:10px;padding:12px 14px">' +
          '<p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;letter-spacing:.04em">' + esc(fieldLabel) + '</p>' +
          '<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:' + valColor + '">' + esc(val) + '</p></div>';
      });

      html += '</div>';

      // Notes
      if (data.notes) {
        html += '<div style="margin-top:14px;padding:14px;background:#fffbeb;border-radius:10px;border:1px solid #fef3c7">' +
          '<p style="margin:0;font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px">Observaciones</p>' +
          '<p style="margin:0;font-size:13px;color:#78350f;line-height:1.6">' + esc(data.notes) + '</p></div>';
      }

      html += '</div></div>';

      // Section photos
      var photos = insp["photos_" + key] || [];
      if (photos.length > 0) {
        html += '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px;margin-bottom:16px;margin-top:-8px">' +
          '<p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#64748b">Fotos - ' + esc(label) + ' (' + photos.length + ')</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">';
        photos.forEach(function (url, idx) {
          html += '<div class="iu-photo" data-url="' + esc(url) + '" style="border-radius:10px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0">' +
            '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
        });
        html += '</div></div>';
      }
    });

    // Videos test drive
    var videos = insp.videos_test_drive || [];
    if (videos.length > 0) {
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
        '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Videos Test-Drive</h3></div>' +
        '<div style="padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
      videos.forEach(function (url) {
        html += '<div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0"><video src="' + esc(url) + '" controls style="width:100%;display:block" preload="metadata"></video></div>';
      });
      html += '</div></div>';
    }

    // General photos
    var generalPhotos = insp.photos_general || [];
    if (generalPhotos.length > 0) {
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
        '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Fotos Generales (' + generalPhotos.length + ')</h3></div>' +
        '<div style="padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">';
      generalPhotos.forEach(function (url) {
        html += '<div class="iu-photo" data-url="' + esc(url) + '" style="border-radius:10px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:1px solid #e2e8f0">' +
          '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>';
      });
      html += '</div></div>';
    }

    // Recommendations
    if (insp.recommendations) {
      html += '<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:16px;border:1px solid #a7f3d0;padding:24px;margin-bottom:20px">' +
        '<h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#065f46;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Recomendaciones del Inspector</h3>' +
        '<p style="margin:0;font-size:14px;color:#065f46;line-height:1.7;white-space:pre-wrap">' + esc(insp.recommendations) + '</p></div>';
    }

    // Listing URL
    if (insp.listing_url) {
      html += '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>' +
        '<a href="' + esc(insp.listing_url) + '" target="_blank" style="color:#2563eb;font-size:14px;word-break:break-all;text-decoration:underline">' + esc(insp.listing_url) + '</a></div>';
    }

    // Report date
    html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">' +
      'Reporte generado el ' + fmtDate(insp.sent_at || insp.created_at) +
      ' | Inspeccion ' + rt.label + ' | Imporlan.cl</div>';

    html += '</div>';
    return html;
  }

  // ============================================================
  // LIGHTBOX
  // ============================================================

  function openLightbox(url) {
    if (lightboxOpen) return;
    lightboxOpen = true;
    var overlay = document.createElement("div");
    overlay.id = "iu-lightbox";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;animation:iuFadeIn .2s;cursor:pointer;backdrop-filter:blur(8px)";
    overlay.innerHTML = '<img src="' + esc(url) + '" style="max-width:92%;max-height:92%;object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
      '<button style="position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>';
    overlay.addEventListener("click", function () { overlay.remove(); lightboxOpen = false; });
    document.body.appendChild(overlay);
  }

  // ============================================================
  // MODULE
  // ============================================================

  function renderSkeleton() {
    return '<div data-enhancer-added="true" style="padding:0 8px">' +
      '<div style="height:32px;width:250px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:8px;margin-bottom:24px"></div>' +
      '<div style="height:200px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:16px;margin-bottom:16px"></div>' +
      '<div style="height:200px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:iuPulse 1.5s infinite;border-radius:16px"></div></div>';
  }

  async function renderModule() {
    var main = document.querySelector("main");
    if (!main) return;

    // Hide React content
    Array.from(main.children).forEach(function (ch) {
      if (!ch.getAttribute("data-enhancer-added")) ch.style.display = "none";
    });

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
        container.innerHTML = '<div data-enhancer-added="true" style="text-align:center;padding:60px"><p style="color:#ef4444">Inspeccion no encontrada</p></div>';
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
    var main = document.querySelector("main");
    if (main) {
      Array.from(main.children).forEach(function (ch) { ch.style.display = ""; });
    }
    currentDetail = null;
  }

  function attachListeners() {
    var container = document.getElementById("iu-container");
    if (!container) return;

    // Card click
    container.querySelectorAll(".iu-card").forEach(function (card) {
      card.addEventListener("click", function () {
        window.location.hash = "#inspecciones/" + this.getAttribute("data-id");
      });
      card.addEventListener("mouseenter", function () { this.style.transform = "translateY(-2px)"; this.style.boxShadow = "0 8px 24px rgba(0,0,0,.08)"; });
      card.addEventListener("mouseleave", function () { this.style.transform = ""; this.style.boxShadow = ""; });
    });

    // Back button
    var back = document.getElementById("iu-back");
    if (back) {
      back.addEventListener("click", function () {
        window.location.hash = "#inspecciones";
      });
    }

    // Photo lightbox
    container.querySelectorAll(".iu-photo").forEach(function (photo) {
      photo.addEventListener("click", function () {
        openLightbox(this.getAttribute("data-url"));
      });
    });
  }

  // ============================================================
  // STYLES & INIT
  // ============================================================

  function addStyles() {
    if (document.getElementById("iu-styles")) return;
    var style = document.createElement("style");
    style.id = "iu-styles";
    style.textContent = "@keyframes iuFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes iuPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      ".iu-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)!important;transform:translateY(-2px)!important}" +
      ".iu-photo:hover{opacity:.85;transform:scale(1.02)}" +
      ".iu-photo{transition:all .2s}" +
      "@media(max-width:768px){#iu-container .iu-photo{min-width:80px}}";
    document.head.appendChild(style);
  }

  function init() {
    addStyles();

    // Periodically try to inject sidebar
    var sidebarInterval = setInterval(function () {
      injectSidebarItem();
      updateSidebarActive();
    }, 1000);

    window.addEventListener("hashchange", function () {
      updateSidebarActive();
      if (window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/")) {
        renderModule();
      } else {
        hideModule();
      }
    });

    // Check on load
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
