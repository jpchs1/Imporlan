/**
 * Inspection Admin Module - Imporlan Admin Panel
 * Allows admin to create, fill, and send inspection reports to clients.
 * Supports 3 tiers: Basica, Estandar, Premium
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  var moduleHidden = false;
  var currentInspection = null;
  var isSaving = false;

  var REPORT_TYPES = {
    basica: { label: "Basica", color: "#0891b2", bg: "#ecfeff", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    estandar: { label: "Estandar", color: "#2563eb", bg: "#eff6ff", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    premium: { label: "Premium", color: "#7c3aed", bg: "#f5f3ff", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" }
  };

  var STATUS_MAP = {
    draft: { label: "Borrador", color: "#94a3b8", bg: "#f1f5f9" },
    in_progress: { label: "En Progreso", color: "#f59e0b", bg: "#fffbeb" },
    completed: { label: "Completado", color: "#10b981", bg: "#ecfdf5" },
    sent: { label: "Enviado", color: "#6366f1", bg: "#eef2ff" }
  };

  // Sections config per report type
  var SECTIONS = {
    basica: [
      { key: "hull", label: "Casco Exterior", icon: "M3 3h18v18H3z" },
      { key: "engine", label: "Motor (Visual)", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { key: "electrical", label: "Sistema Electrico Basico", icon: "M13 10V3L4 14h7v7l9-11h-7z" }
    ],
    estandar: [
      { key: "hull", label: "Casco Exterior", icon: "M3 3h18v18H3z" },
      { key: "engine", label: "Motor", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { key: "electrical", label: "Sistema Electrico", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { key: "interior", label: "Interior", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { key: "trailer", label: "Trailer", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" },
      { key: "navigation", label: "Navegacion y Electronica", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" }
    ],
    premium: [
      { key: "hull", label: "Casco Exterior", icon: "M3 3h18v18H3z" },
      { key: "engine", label: "Motor Completo", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { key: "electrical", label: "Sistema Electrico Completo", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
      { key: "interior", label: "Interior Completo", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { key: "trailer", label: "Trailer", icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" },
      { key: "navigation", label: "Navegacion y Electronica", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
      { key: "safety", label: "Seguridad", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
      { key: "test_drive", label: "Test-Drive en Agua", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" },
      { key: "documentation", label: "Documentacion", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }
    ]
  };

  // Section fields config
  var SECTION_FIELDS = {
    hull: [
      { key: "gelcoat_condition", label: "Estado del Gelcoat", type: "select", options: ["Excelente","Bueno","Regular","Malo","N/A"] },
      { key: "hull_integrity", label: "Integridad del Casco", type: "select", options: ["Sin danos","Danos menores","Danos moderados","Danos severos"] },
      { key: "waterline", label: "Linea de Flotacion", type: "select", options: ["Limpia","Sucia leve","Incrustaciones","Requiere limpieza"] },
      { key: "bottom_paint", label: "Pintura Antifouling", type: "select", options: ["Reciente","Buen estado","Desgastada","Requiere aplicacion","N/A"] },
      { key: "transom", label: "Espejo de Popa", type: "select", options: ["Firme","Blando","Reparado","Requiere atencion"] },
      { key: "rub_rail", label: "Roda/Regala", type: "select", options: ["Buen estado","Desgaste normal","Danada","Faltante"] },
      { key: "through_hulls", label: "Pasacascos", type: "select", options: ["Buen estado","Corrosion leve","Requiere reemplazo","N/A"] },
      { key: "notes", label: "Observaciones del Casco", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    engine: [
      { key: "visual_condition", label: "Condicion Visual", type: "select", options: ["Excelente","Bueno","Regular","Malo"] },
      { key: "oil_condition", label: "Estado del Aceite", type: "select", options: ["Limpio","Oscuro normal","Sucio","Contaminado","N/A"] },
      { key: "corrosion", label: "Corrosion", type: "select", options: ["Sin corrosion","Corrosion leve","Corrosion moderada","Corrosion severa"] },
      { key: "belts_hoses", label: "Correas y Mangueras", type: "select", options: ["Buen estado","Desgaste leve","Requieren reemplazo","N/A"] },
      { key: "exhaust", label: "Sistema de Escape", type: "select", options: ["Buen estado","Fugas menores","Requiere reparacion","N/A"] },
      { key: "cooling_system", label: "Sistema de Enfriamiento", type: "select", options: ["Funcionando","Requiere revision","Danado","N/A"] },
      { key: "starts_properly", label: "Arranca Correctamente", type: "select", options: ["Si","No","No probado"] },
      { key: "idle_smooth", label: "Ralenti Estable", type: "select", options: ["Si","Irregular","No probado"] },
      { key: "notes", label: "Observaciones del Motor", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    electrical: [
      { key: "battery_condition", label: "Estado de Baterias", type: "select", options: ["Buenas","Debiles","Requieren reemplazo","N/A"] },
      { key: "wiring", label: "Cableado", type: "select", options: ["Buen estado","Desgaste leve","Problemas detectados","N/A"] },
      { key: "lights", label: "Luces de Navegacion", type: "select", options: ["Funcionando todas","Algunas fallan","No funcionan","N/A"] },
      { key: "bilge_pump", label: "Bomba de Achique", type: "select", options: ["Funcionando","No probada","No funciona","N/A"] },
      { key: "switches", label: "Panel de Interruptores", type: "select", options: ["Funcionando","Parcialmente","No funciona"] },
      { key: "notes", label: "Observaciones Electricas", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    interior: [
      { key: "upholstery", label: "Tapiceria", type: "select", options: ["Excelente","Buena","Desgastada","Danada","Reemplazada"] },
      { key: "carpet_floor", label: "Alfombra/Piso", type: "select", options: ["Buen estado","Desgaste normal","Manchado","Requiere reemplazo","N/A"] },
      { key: "cabin_condition", label: "Estado de Cabina", type: "select", options: ["Excelente","Buena","Regular","Mala","N/A"] },
      { key: "storage", label: "Compartimentos de Almacenamiento", type: "select", options: ["Buen estado","Humedad detectada","Danados","N/A"] },
      { key: "head_plumbing", label: "Bano/Plomeria", type: "select", options: ["Funcionando","Requiere reparacion","No funciona","N/A"] },
      { key: "notes", label: "Observaciones del Interior", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    trailer: [
      { key: "frame_condition", label: "Estado del Chasis", type: "select", options: ["Excelente","Buen estado","Oxidado","Danado"] },
      { key: "tires", label: "Neumaticos", type: "select", options: ["Buenos","Desgaste normal","Requieren reemplazo","N/A"] },
      { key: "bearings", label: "Rodamientos/Bearings", type: "select", options: ["Buenos","Requieren engrase","Requieren reemplazo","N/A"] },
      { key: "lights_trailer", label: "Luces del Trailer", type: "select", options: ["Funcionando","Parcialmente","No funcionan","N/A"] },
      { key: "winch", label: "Winch/Malacate", type: "select", options: ["Funcionando","Desgastado","No funciona","N/A"] },
      { key: "bunks_rollers", label: "Bunks/Rollers", type: "select", options: ["Buen estado","Desgastados","Requieren reemplazo","N/A"] },
      { key: "coupler", label: "Enganche", type: "select", options: ["Buen estado","Desgaste","Danado","N/A"] },
      { key: "notes", label: "Observaciones del Trailer", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    navigation: [
      { key: "gps_chartplotter", label: "GPS/Chartplotter", type: "select", options: ["Funcionando","No probado","No funciona","No tiene"] },
      { key: "fishfinder", label: "Ecosonda/Fishfinder", type: "select", options: ["Funcionando","No probado","No funciona","No tiene"] },
      { key: "vhf_radio", label: "Radio VHF", type: "select", options: ["Funcionando","No probado","No funciona","No tiene"] },
      { key: "compass", label: "Compas", type: "select", options: ["Funcionando","Descalibrado","No tiene"] },
      { key: "stereo", label: "Equipo de Sonido", type: "select", options: ["Funcionando","Parcial","No funciona","No tiene"] },
      { key: "notes", label: "Observaciones de Navegacion", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    safety: [
      { key: "fire_extinguisher", label: "Extintores", type: "select", options: ["Vigentes","Vencidos","Faltantes","N/A"] },
      { key: "life_jackets", label: "Chalecos Salvavidas", type: "select", options: ["Suficientes y en buen estado","Insuficientes","Deteriorados","Faltantes"] },
      { key: "flares", label: "Bengalas", type: "select", options: ["Vigentes","Vencidas","Faltantes","N/A"] },
      { key: "horn", label: "Bocina", type: "select", options: ["Funcionando","No funciona","Faltante"] },
      { key: "first_aid", label: "Botiquin", type: "select", options: ["Completo","Incompleto","Faltante","N/A"] },
      { key: "notes", label: "Observaciones de Seguridad", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    test_drive: [
      { key: "start_up", label: "Arranque en Agua", type: "select", options: ["Normal","Dificultoso","No arranco","No aplica"] },
      { key: "acceleration", label: "Aceleracion", type: "select", options: ["Normal","Lenta","Irregular","No probada"] },
      { key: "top_speed", label: "Velocidad Maxima Alcanzada", type: "text" },
      { key: "handling", label: "Maniobrabilidad", type: "select", options: ["Excelente","Buena","Regular","Mala","No probada"] },
      { key: "vibration", label: "Vibraciones", type: "select", options: ["Sin vibraciones","Vibracion leve","Vibracion moderada","Vibracion excesiva"] },
      { key: "steering", label: "Direccion", type: "select", options: ["Precisa","Leve juego","Juego excesivo","No probada"] },
      { key: "trim_tabs", label: "Trim/Tabs", type: "select", options: ["Funcionando","Parcial","No funciona","No tiene"] },
      { key: "water_intake", label: "Ingreso de Agua", type: "select", options: ["Ninguno","Goteo minimo","Ingreso moderado","Ingreso excesivo"] },
      { key: "notes", label: "Observaciones del Test-Drive", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ],
    documentation: [
      { key: "title_status", label: "Estado del Titulo", type: "select", options: ["Limpio/Clean Title","Salvage","Rebuilt","Lien","Desconocido"] },
      { key: "registration", label: "Registro/Matricula", type: "select", options: ["Vigente","Vencido","Sin registro"] },
      { key: "hull_id_match", label: "HIN Coincide", type: "select", options: ["Si","No","No verificado"] },
      { key: "service_records", label: "Registros de Mantenimiento", type: "select", options: ["Disponibles","Parciales","No disponibles"] },
      { key: "warranty", label: "Garantia", type: "select", options: ["Vigente","Vencida","Sin garantia","N/A"] },
      { key: "notes", label: "Observaciones de Documentacion", type: "textarea" },
      { key: "rating", label: "Calificacion (1-10)", type: "number", min: 1, max: 10 }
    ]
  };

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }
  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: "Bearer " + getAdminToken() };
  }
  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function fmtDate(s) {
    if (!s) return "N/A";
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    return s;
  }

  function showToast(msg, type) {
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981") + ";animation:inspFadeIn .3s ease";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(function () { t.remove(); }, 300); }, 3000);
  }

  function isInspectionPage() {
    return window.location.hash === "#inspecciones" || window.location.hash.startsWith("#inspecciones/");
  }

  function getInspectionIdFromHash() {
    var match = window.location.hash.match(/#inspecciones\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // ============================================================
  // SIDEBAR INJECTION
  // ============================================================

  function injectSidebarItem() {
    var checkCount = 0;
    function tryInject() {
      checkCount++;
      if (checkCount > 60) return;
      if (document.getElementById("sidebar-inspecciones-admin")) return;

      var nav = document.querySelector("aside nav") || document.querySelector("nav");
      if (!nav) { setTimeout(tryInject, 500); return; }

      var refBtn = null;
      var buttons = nav.querySelectorAll("button");
      buttons.forEach(function (el) {
        var text = el.textContent.trim().toLowerCase();
        if (text.includes("expedientes")) refBtn = el;
      });
      if (!refBtn) {
        buttons.forEach(function (el) {
          var text = el.textContent.trim().toLowerCase();
          if (text.includes("auditoria") || text.includes("contenido") || text.includes("pagos")) refBtn = el;
        });
      }
      if (!refBtn && buttons.length > 0) refBtn = buttons[buttons.length - 1];
      if (!refBtn) { setTimeout(tryInject, 500); return; }

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.id = "sidebar-inspecciones-admin";
      if (refBtn.className) btn.className = refBtn.className.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400/g, "");
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/><path d="M15 3h6v6"/></svg> Inspecciones';

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        moduleHidden = false;
        window.location.hash = "#inspecciones";
      });

      li.appendChild(btn);
      var refLi = refBtn.closest("li");
      if (refLi && refLi.parentNode) refLi.parentNode.insertBefore(li, refLi.nextSibling);
      else if (nav.querySelector("ul")) nav.querySelector("ul").appendChild(li);
      else nav.appendChild(li);

      updateSidebarActive();
    }
    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-inspecciones-admin");
    if (!item) return;
    if (isInspectionPage()) {
      item.style.background = "rgba(124,58,237,0.15)";
      item.style.color = "#a78bfa";
      item.style.borderRight = "4px solid #a78bfa";
      item.style.fontWeight = "600";
    } else {
      item.style.background = "transparent";
      item.style.color = "";
      item.style.borderRight = "none";
      item.style.fontWeight = "";
    }
  }

  // ============================================================
  // API CALLS
  // ============================================================

  async function fetchInspections(filters) {
    try {
      var params = new URLSearchParams({ action: "admin_list" });
      if (filters) {
        if (filters.status) params.append("status", filters.status);
        if (filters.report_type) params.append("report_type", filters.report_type);
        if (filters.search) params.append("search", filters.search);
      }
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?" + params.toString(), { headers: authHeaders() });
      var data = await resp.json();
      return data.success ? data.inspections || [] : [];
    } catch (e) { console.error("Error fetching inspections:", e); return []; }
  }

  async function fetchInspectionDetail(id) {
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=admin_detail&id=" + id, { headers: authHeaders() });
      var data = await resp.json();
      return data.success ? data.inspection : null;
    } catch (e) { console.error("Error fetching inspection detail:", e); return null; }
  }

  async function saveInspection(payload) {
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=admin_update", {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload)
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function createInspection(payload) {
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=admin_create", {
        method: "POST", headers: authHeaders(), body: JSON.stringify(payload)
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function sendInspection(id) {
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=admin_send", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ id: id })
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function deleteInspection(id) {
    try {
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=admin_delete", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ id: id })
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function uploadMedia(file) {
    try {
      var fd = new FormData();
      fd.append("media", file);
      var resp = await fetch(API_BASE + "/inspection_reports_api.php?action=upload_media", {
        method: "POST",
        headers: { Authorization: "Bearer " + getAdminToken() },
        body: fd
      });
      return await resp.json();
    } catch (e) { return { error: "Error subiendo archivo" }; }
  }

  // ============================================================
  // RENDER: LIST VIEW
  // ============================================================

  function renderStatusBadge(status) {
    var s = STATUS_MAP[status] || STATUS_MAP.draft;
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:600;background:' + s.bg + ';color:' + s.color + '"><span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>' + s.label + '</span>';
  }

  function renderTypeBadge(type) {
    var t = REPORT_TYPES[type] || REPORT_TYPES.basica;
    return '<span style="padding:4px 12px;border-radius:8px;font-size:11px;font-weight:700;background:' + t.bg + ';color:' + t.color + ';letter-spacing:.03em;text-transform:uppercase">' + t.label + '</span>';
  }

  function renderListView(inspections) {
    var html = '<div data-enhancer-added="true" style="padding:0 8px">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
      '<div>' +
      '<h2 style="margin:0;font-size:24px;font-weight:800;color:#0f172a">Inspecciones Tecnicas</h2>' +
      '<p style="margin:4px 0 0;font-size:14px;color:#64748b">' + inspections.length + ' inspecciones registradas</p></div>' +
      '<button id="insp-new-btn" style="padding:10px 22px;border-radius:12px;border:none;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(124,58,237,.3)">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nueva Inspeccion</button></div>';

    // Filters
    html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">' +
      '<input id="insp-search" placeholder="Buscar por email, marca, modelo..." style="flex:1;min-width:200px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px">' +
      '<select id="insp-filter-status" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-width:130px"><option value="">Todos los estados</option><option value="draft">Borrador</option><option value="in_progress">En Progreso</option><option value="completed">Completado</option><option value="sent">Enviado</option></select>' +
      '<select id="insp-filter-type" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-width:130px"><option value="">Todos los tipos</option><option value="basica">Basica</option><option value="estandar">Estandar</option><option value="premium">Premium</option></select>' +
      '<button id="insp-filter-apply" style="padding:10px 18px;border-radius:10px;border:1px solid #7c3aed;background:transparent;color:#7c3aed;font-size:13px;font-weight:600;cursor:pointer">Filtrar</button></div>';

    // Table
    if (inspections.length === 0) {
      html += '<div style="text-align:center;padding:60px 20px;color:#94a3b8"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 16px;display:block;opacity:.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p style="font-size:16px;font-weight:600;margin:0 0 4px">No hay inspecciones</p><p style="font-size:13px;margin:0">Crea la primera inspeccion con el boton de arriba</p></div>';
    } else {
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:800px"><thead>' +
        '<tr style="background:#f8fafc"><th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Cliente</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Embarcacion</th>' +
        '<th style="padding:12px 16px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Tipo</th>' +
        '<th style="padding:12px 16px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Estado</th>' +
        '<th style="padding:12px 16px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Rating</th>' +
        '<th style="padding:12px 16px;text-align:right;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Fecha</th>' +
        '<th style="padding:12px 16px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Acciones</th></tr></thead><tbody>';

      inspections.forEach(function (insp) {
        var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Sin datos";
        var ratingHtml = insp.overall_rating ? '<span style="font-weight:700;color:#0f172a">' + parseFloat(insp.overall_rating).toFixed(1) + '</span><span style="color:#94a3b8;font-size:11px">/10</span>' : '<span style="color:#cbd5e1">-</span>';

        html += '<tr style="border-top:1px solid #f1f5f9;cursor:pointer" class="insp-row" data-id="' + insp.id + '">' +
          '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(insp.user_name || insp.user_email) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(insp.user_email) + '</p></div></td>' +
          '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:500;color:#1e293b;font-size:13px">' + esc(vessel) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:11px">' + esc(insp.vessel_type || '') + (insp.length_ft ? ' - ' + insp.length_ft + ' ft' : '') + '</p></div></td>' +
          '<td style="padding:14px 16px;text-align:center">' + renderTypeBadge(insp.report_type) + '</td>' +
          '<td style="padding:14px 16px;text-align:center">' + renderStatusBadge(insp.status) + '</td>' +
          '<td style="padding:14px 16px;text-align:center">' + ratingHtml + '</td>' +
          '<td style="padding:14px 16px;text-align:right"><span style="color:#94a3b8;font-size:12px">' + fmtDate(insp.created_at) + '</span></td>' +
          '<td style="padding:14px 16px;text-align:center"><div style="display:flex;gap:6px;justify-content:center">' +
          '<button class="insp-edit-btn" data-id="' + insp.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #7c3aed;background:transparent;color:#7c3aed;font-size:12px;font-weight:600;cursor:pointer">Editar</button>' +
          '<button class="insp-delete-btn" data-id="' + insp.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button>' +
          '</div></td></tr>';
      });

      html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
  }

  // ============================================================
  // RENDER: DETAIL/EDIT VIEW
  // ============================================================

  function renderDetailView(insp) {
    var rt = REPORT_TYPES[insp.report_type] || REPORT_TYPES.basica;
    var sections = SECTIONS[insp.report_type] || SECTIONS.basica;
    var vessel = [insp.brand, insp.model, insp.vessel_year].filter(Boolean).join(" ") || "Sin datos";

    var html = '<div data-enhancer-added="true" style="padding:0 8px">';

    // Header with back button
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<button id="insp-back" style="padding:8px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Volver</button>' +
      '<div><h2 style="margin:0;font-size:22px;font-weight:800;color:#0f172a">Inspeccion #' + insp.id + '</h2>' +
      '<p style="margin:4px 0 0;font-size:13px;color:#64748b">' + esc(insp.user_name || insp.user_email) + ' - ' + esc(vessel) + '</p></div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      renderTypeBadge(insp.report_type) + ' ' + renderStatusBadge(insp.status) +
      '</div></div>';

    // Sticky save bar
    html += '<div id="insp-save-bar" style="position:sticky;top:0;z-index:100;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:14px;padding:14px 24px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.15)">' +
      '<div style="display:flex;align-items:center;gap:10px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' +
      '<span style="color:#e2e8f0;font-size:14px;font-weight:500">Editando inspeccion</span>' +
      '<span id="insp-save-status" style="color:#94a3b8;font-size:12px"></span></div>' +
      '<div style="display:flex;gap:10px">' +
      '<button id="insp-save-btn" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar Cambios</button>';

    if (insp.status !== 'sent') {
      html += '<button id="insp-send-btn" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar al Cliente</button>';
    }

    html += '</div></div>';

    // Vessel info card
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,' + rt.bg + ',' + rt.bg + ');padding:18px 24px;border-bottom:1px solid #e2e8f0">' +
      '<h3 style="margin:0;font-size:16px;font-weight:700;color:' + rt.color + ';display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>Informacion General</h3></div>' +
      '<div style="padding:20px 24px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">' +
      renderField("user_email", "Email Cliente", insp.user_email, "email") +
      renderField("user_name", "Nombre Cliente", insp.user_name, "text") +
      renderField("report_type", "Tipo de Reporte", insp.report_type, "select", ["basica","estandar","premium"]) +
      renderField("vessel_type", "Tipo Embarcacion", insp.vessel_type, "select", ["Lancha","Velero","Moto de Agua","Yate","Bote de Pesca","Pontoon","Catamaran","Otro"]) +
      renderField("brand", "Marca", insp.brand, "text") +
      renderField("model", "Modelo", insp.model, "text") +
      renderField("vessel_year", "Ano", insp.vessel_year, "number") +
      renderField("length_ft", "Eslora (ft)", insp.length_ft, "number") +
      renderField("hull_material", "Material Casco", insp.hull_material, "select", ["Fibra de Vidrio","Aluminio","Madera","Acero","Hypalon/PVC","Otro"]) +
      renderField("engine_brand", "Marca Motor", insp.engine_brand, "text") +
      renderField("engine_model", "Modelo Motor", insp.engine_model, "text") +
      renderField("engine_hours", "Horas Motor", insp.engine_hours, "text") +
      renderField("num_engines", "Num. Motores", insp.num_engines, "number") +
      renderField("fuel_type", "Combustible", insp.fuel_type, "select", ["Gasolina","Diesel","Electrico","Otro"]) +
      renderField("country", "Pais", insp.country, "select", ["usa","chile"]) +
      renderField("state_region", "Estado/Region", insp.state_region, "text") +
      renderField("city", "Ciudad", insp.city, "text") +
      renderField("marina", "Marina", insp.marina, "text") +
      renderField("price_usd", "Precio USD", insp.price_usd, "number") +
      renderField("listing_url", "Link del Aviso", insp.listing_url, "text") +
      renderField("inspector_name", "Inspector", insp.inspector_name, "text") +
      '</div></div></div>';

    // Inspection sections
    sections.forEach(function (sec) {
      var sectionData = insp["section_" + sec.key] || {};
      var photosKey = "photos_" + sec.key;
      var photos = insp[photosKey] || [];
      var videosKey = sec.key === "test_drive" ? "videos_test_drive" : null;
      var videos = videosKey ? (insp[videosKey] || []) : [];
      var fields = SECTION_FIELDS[sec.key] || [];

      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px" data-section="' + sec.key + '">' +
        '<div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);padding:18px 24px;border-bottom:1px solid #e2e8f0;cursor:pointer" class="insp-section-header" data-section="' + sec.key + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px">' +
        '<div style="width:32px;height:32px;background:linear-gradient(135deg,' + rt.color + ',' + rt.color + '22);border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + rt.color + '" stroke-width="2"><path d="' + sec.icon + '"/></svg></div>' +
        esc(sec.label) + '</h3>' +
        '<svg class="insp-section-chevron" data-section="' + sec.key + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg></div></div>' +
        '<div class="insp-section-body" data-section="' + sec.key + '" style="padding:20px 24px">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-bottom:20px">';

      fields.forEach(function (f) {
        var val = sectionData[f.key] || "";
        if (f.type === "textarea") {
          html += '<div style="grid-column:1/-1"><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(f.label) + '</label>' +
            '<textarea class="insp-field" data-section="' + sec.key + '" data-field="' + f.key + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-height:80px;resize:vertical;box-sizing:border-box;font-family:inherit" placeholder="' + esc(f.label) + '...">' + esc(val) + '</textarea></div>';
        } else if (f.type === "select") {
          html += '<div><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(f.label) + '</label>' +
            '<select class="insp-field" data-section="' + sec.key + '" data-field="' + f.key + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box">' +
            '<option value="">-- Seleccionar --</option>';
          f.options.forEach(function (opt) {
            html += '<option value="' + esc(opt) + '"' + (val === opt ? ' selected' : '') + '>' + esc(opt) + '</option>';
          });
          html += '</select></div>';
        } else {
          html += '<div><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(f.label) + '</label>' +
            '<input class="insp-field" data-section="' + sec.key + '" data-field="' + f.key + '" type="' + (f.type || 'text') + '" value="' + esc(val) + '"' + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + ' style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box" placeholder="' + esc(f.label) + '"></div>';
        }
      });

      html += '</div>';

      // Photo upload area
      html += '<div style="border-top:1px solid #f1f5f9;padding-top:16px">' +
        '<h4 style="margin:0 0 12px;font-size:13px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Fotos - ' + esc(sec.label) + '</h4>' +
        '<div class="insp-photos-grid" data-section="' + sec.key + '" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:12px">';

      photos.forEach(function (url, idx) {
        html += '<div class="insp-photo-item" data-section="' + sec.key + '" data-idx="' + idx + '" style="position:relative;border-radius:10px;overflow:hidden;aspect-ratio:1;border:1px solid #e2e8f0">' +
          '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">' +
          '<button class="insp-remove-photo" data-section="' + sec.key + '" data-idx="' + idx + '" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(239,68,68,.9);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&times;</button></div>';
      });

      html += '</div>' +
        '<label class="insp-upload-area" data-section="' + sec.key + '" data-type="photo" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border:2px dashed #cbd5e1;border-radius:12px;cursor:pointer;transition:all .2s;color:#94a3b8;font-size:13px;font-weight:500">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
        'Arrastra o haz clic para subir fotos' +
        '<input type="file" class="insp-file-input" data-section="' + sec.key + '" data-type="photo" accept="image/*" multiple style="display:none"></label></div>';

      // Video upload for test_drive
      if (sec.key === "test_drive") {
        html += '<div style="border-top:1px solid #f1f5f9;padding-top:16px;margin-top:16px">' +
          '<h4 style="margin:0 0 12px;font-size:13px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Videos - Test Drive</h4>' +
          '<div class="insp-videos-grid" data-section="test_drive" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:12px">';

        videos.forEach(function (url, idx) {
          html += '<div class="insp-video-item" data-idx="' + idx + '" style="position:relative;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">' +
            '<video src="' + esc(url) + '" style="width:100%;height:150px;object-fit:cover" controls></video>' +
            '<button class="insp-remove-video" data-idx="' + idx + '" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(239,68,68,.9);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&times;</button></div>';
        });

        html += '</div>' +
          '<label class="insp-upload-area" data-section="test_drive" data-type="video" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border:2px dashed #cbd5e1;border-radius:12px;cursor:pointer;transition:all .2s;color:#94a3b8;font-size:13px;font-weight:500">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
          'Arrastra o haz clic para subir videos (MP4, MOV, WEBM)' +
          '<input type="file" class="insp-file-input" data-section="test_drive" data-type="video" accept="video/*" multiple style="display:none"></label></div>';
      }

      html += '</div></div>';
    });

    // Overall summary card
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);padding:18px 24px;border-bottom:1px solid #a7f3d0">' +
      '<h3 style="margin:0;font-size:16px;font-weight:700;color:#065f46;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Resumen General</h3></div>' +
      '<div style="padding:20px 24px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:16px">' +
      renderField("overall_rating", "Calificacion General (1-10)", insp.overall_rating, "number") +
      renderField("inspector_name", "Nombre del Inspector", insp.inspector_name, "text") +
      '</div>' +
      '<div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Resumen General</label>' +
      '<textarea class="insp-main-field" data-field="overall_summary" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-height:100px;resize:vertical;box-sizing:border-box;font-family:inherit" placeholder="Resumen general de la inspeccion...">' + esc(insp.overall_summary || '') + '</textarea></div>' +
      '<div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Recomendaciones</label>' +
      '<textarea class="insp-main-field" data-field="recommendations" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-height:100px;resize:vertical;box-sizing:border-box;font-family:inherit" placeholder="Recomendaciones para el cliente...">' + esc(insp.recommendations || '') + '</textarea></div>' +
      '<div><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Notas del Inspector (internas)</label>' +
      '<textarea class="insp-main-field" data-field="inspector_notes" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;min-height:80px;resize:vertical;box-sizing:border-box;font-family:inherit" placeholder="Notas internas...">' + esc(insp.inspector_notes || '') + '</textarea></div>' +
      '</div></div>';

    // General photos
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0"><h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Fotos Generales</h3></div>' +
      '<div style="padding:20px 24px">' +
      '<div class="insp-photos-grid" data-section="general" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:12px">';

    (insp.photos_general || []).forEach(function (url, idx) {
      html += '<div class="insp-photo-item" data-section="general" data-idx="' + idx + '" style="position:relative;border-radius:10px;overflow:hidden;aspect-ratio:1;border:1px solid #e2e8f0">' +
        '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">' +
        '<button class="insp-remove-photo" data-section="general" data-idx="' + idx + '" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(239,68,68,.9);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&times;</button></div>';
    });

    html += '</div>' +
      '<label class="insp-upload-area" data-section="general" data-type="photo" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border:2px dashed #cbd5e1;border-radius:12px;cursor:pointer;transition:all .2s;color:#94a3b8;font-size:13px;font-weight:500">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      'Subir fotos generales' +
      '<input type="file" class="insp-file-input" data-section="general" data-type="photo" accept="image/*" multiple style="display:none"></label>' +
      '</div></div>';

    html += '</div>';
    return html;
  }

  function renderField(name, label, value, type, options) {
    var val = value !== null && value !== undefined ? value : "";
    if (type === "select" && options) {
      var opts = '<option value="">-- Seleccionar --</option>';
      options.forEach(function (o) {
        opts += '<option value="' + esc(o) + '"' + (String(val) === String(o) ? ' selected' : '') + '>' + esc(o.charAt(0).toUpperCase() + o.slice(1)) + '</option>';
      });
      return '<div><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(label) + '</label>' +
        '<select class="insp-main-field" data-field="' + name + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box">' + opts + '</select></div>';
    }
    return '<div><label style="display:block;font-size:11px;color:#64748b;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">' + esc(label) + '</label>' +
      '<input class="insp-main-field" data-field="' + name + '" type="' + (type || 'text') + '" value="' + esc(val) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box" placeholder="' + esc(label) + '"></div>';
  }

  // ============================================================
  // RENDER: CREATE MODAL
  // ============================================================

  function renderCreateModal() {
    return '<div id="insp-create-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:inspFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;max-height:90vh;overflow-y:auto">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">Nueva Inspeccion Tecnica</h3>' +
      '<button id="insp-close-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:14px">' +

      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email del Cliente *</label>' +
      '<input id="insp-new-email" type="email" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="cliente@email.com"></div>' +

      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre del Cliente</label>' +
      '<input id="insp-new-name" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Nombre completo"></div>' +

      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Tipo de Reporte *</label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
      renderTypeCard("basica", "Basica", "Inspeccion visual basica del casco, motor y sistema electrico.", "$850 USD") +
      renderTypeCard("estandar", "Estandar", "Incluye trailer, interior, navegacion y fotos detalladas.", "$1.200 USD") +
      renderTypeCard("premium", "Premium", "Completa con test-drive, documentacion y video en agua.", "$1.800 USD") +
      '</div></div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Marca</label>' +
      '<input id="insp-new-brand" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Ej: Sea Ray"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Modelo</label>' +
      '<input id="insp-new-model" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Ej: 250 SLX"></div></div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Ano</label>' +
      '<input id="insp-new-year" type="number" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="2020"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Pais</label>' +
      '<select id="insp-new-country" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="usa">USA</option><option value="chile">Chile</option></select></div></div>' +

      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="insp-cancel-create" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '<button id="insp-confirm-create" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Crear Inspeccion</button></div>' +
      '</div></div></div>';
  }

  function renderTypeCard(type, label, desc, price) {
    var t = REPORT_TYPES[type];
    return '<label style="cursor:pointer"><input type="radio" name="insp-type" value="' + type + '"' + (type === 'basica' ? ' checked' : '') + ' style="display:none">' +
      '<div class="insp-type-card" data-type="' + type + '" style="border:2px solid ' + (type === 'basica' ? t.color : '#e2e8f0') + ';border-radius:12px;padding:14px;text-align:center;transition:all .2s;background:' + (type === 'basica' ? t.bg : '#fff') + '">' +
      '<p style="margin:0;font-size:14px;font-weight:700;color:' + t.color + '">' + label + '</p>' +
      '<p style="margin:4px 0;font-size:11px;color:#64748b;line-height:1.4">' + desc + '</p>' +
      '<p style="margin:6px 0 0;font-size:16px;font-weight:800;color:' + t.color + '">' + price + '</p>' +
      '</div></label>';
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function attachListeners() {
    var container = document.getElementById("insp-admin-container");
    if (!container) return;

    // Row click -> detail
    container.querySelectorAll(".insp-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;
        window.location.hash = "#inspecciones/" + this.getAttribute("data-id");
      });
    });

    // Edit button
    container.querySelectorAll(".insp-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = "#inspecciones/" + this.getAttribute("data-id");
      });
    });

    // Delete button
    container.querySelectorAll(".insp-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = this.getAttribute("data-id");
        if (!confirm("Seguro que deseas eliminar esta inspeccion?")) return;
        var res = await deleteInspection(id);
        if (res.success) { showToast("Inspeccion eliminada"); renderModule(); }
        else showToast(res.error || "Error", "error");
      });
    });

    // New button
    var newBtn = document.getElementById("insp-new-btn");
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        var modal = document.createElement("div");
        modal.innerHTML = renderCreateModal();
        document.body.appendChild(modal.firstChild);
        attachCreateModalListeners();
      });
    }

    // Filter
    var filterBtn = document.getElementById("insp-filter-apply");
    if (filterBtn) {
      filterBtn.addEventListener("click", function () {
        renderModule({
          status: document.getElementById("insp-filter-status").value,
          report_type: document.getElementById("insp-filter-type").value,
          search: document.getElementById("insp-search").value
        });
      });
    }

    // Search on enter
    var searchInput = document.getElementById("insp-search");
    if (searchInput) {
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          document.getElementById("insp-filter-apply").click();
        }
      });
    }

    // Back button
    var backBtn = document.getElementById("insp-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        window.location.hash = "#inspecciones";
      });
    }

    // Save button
    var saveBtn = document.getElementById("insp-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () { doSave(); });
    }

    // Send button
    var sendBtn = document.getElementById("insp-send-btn");
    if (sendBtn) {
      sendBtn.addEventListener("click", async function () {
        if (!confirm("Esto enviara la inspeccion al cliente. Continuar?")) return;
        // Save first
        await doSave();
        var res = await sendInspection(currentInspection.id);
        if (res.success) {
          showToast("Inspeccion enviada al cliente");
          window.location.hash = "#inspecciones";
        } else {
          showToast(res.error || "Error al enviar", "error");
        }
      });
    }

    // Section collapse/expand
    container.querySelectorAll(".insp-section-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var sec = this.getAttribute("data-section");
        var body = container.querySelector('.insp-section-body[data-section="' + sec + '"]');
        var chevron = container.querySelector('.insp-section-chevron[data-section="' + sec + '"]');
        if (body) {
          var isHidden = body.style.display === "none";
          body.style.display = isHidden ? "block" : "none";
          if (chevron) chevron.style.transform = isHidden ? "rotate(0)" : "rotate(-90deg)";
        }
      });
    });

    // File upload
    container.querySelectorAll(".insp-file-input").forEach(function (input) {
      input.addEventListener("change", async function () {
        var section = this.getAttribute("data-section");
        var type = this.getAttribute("data-type");
        var files = Array.from(this.files);
        for (var i = 0; i < files.length; i++) {
          var res = await uploadMedia(files[i]);
          if (res.success && res.url) {
            if (type === "video") {
              if (!currentInspection.videos_test_drive) currentInspection.videos_test_drive = [];
              currentInspection.videos_test_drive.push(res.url);
            } else {
              var photoKey = "photos_" + section;
              if (!currentInspection[photoKey]) currentInspection[photoKey] = [];
              currentInspection[photoKey].push(res.url);
            }
            // Re-render the photos/videos grid
            refreshMediaGrids();
          } else {
            showToast(res.error || "Error subiendo archivo", "error");
          }
        }
        this.value = "";
      });
    });

    // Remove photo
    container.querySelectorAll(".insp-remove-photo").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var section = this.getAttribute("data-section");
        var idx = parseInt(this.getAttribute("data-idx"));
        var photoKey = "photos_" + section;
        if (currentInspection[photoKey] && currentInspection[photoKey][idx] !== undefined) {
          currentInspection[photoKey].splice(idx, 1);
          refreshMediaGrids();
        }
      });
    });

    // Remove video
    container.querySelectorAll(".insp-remove-video").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute("data-idx"));
        if (currentInspection.videos_test_drive && currentInspection.videos_test_drive[idx] !== undefined) {
          currentInspection.videos_test_drive.splice(idx, 1);
          refreshMediaGrids();
        }
      });
    });

    // Upload area hover effects
    container.querySelectorAll(".insp-upload-area").forEach(function (area) {
      area.addEventListener("dragover", function (e) {
        e.preventDefault();
        this.style.borderColor = "#7c3aed";
        this.style.background = "#f5f3ff";
      });
      area.addEventListener("dragleave", function () {
        this.style.borderColor = "#cbd5e1";
        this.style.background = "transparent";
      });
      area.addEventListener("drop", async function (e) {
        e.preventDefault();
        this.style.borderColor = "#cbd5e1";
        this.style.background = "transparent";
        var section = this.getAttribute("data-section");
        var type = this.getAttribute("data-type");
        var files = Array.from(e.dataTransfer.files);
        for (var i = 0; i < files.length; i++) {
          var res = await uploadMedia(files[i]);
          if (res.success && res.url) {
            if (type === "video") {
              if (!currentInspection.videos_test_drive) currentInspection.videos_test_drive = [];
              currentInspection.videos_test_drive.push(res.url);
            } else {
              var photoKey = "photos_" + section;
              if (!currentInspection[photoKey]) currentInspection[photoKey] = [];
              currentInspection[photoKey].push(res.url);
            }
            refreshMediaGrids();
          }
        }
      });
    });

    // Type card selection
    container.querySelectorAll(".insp-type-card").forEach(function (card) {
      card.addEventListener("click", function () {
        container.querySelectorAll(".insp-type-card").forEach(function (c) {
          c.style.borderColor = "#e2e8f0";
          c.style.background = "#fff";
        });
        var type = this.getAttribute("data-type");
        var t = REPORT_TYPES[type];
        this.style.borderColor = t.color;
        this.style.background = t.bg;
      });
    });
  }

  function attachCreateModalListeners() {
    var modal = document.getElementById("insp-create-modal");
    if (!modal) return;

    modal.querySelector("#insp-close-modal").addEventListener("click", function () { modal.remove(); });
    modal.querySelector("#insp-cancel-create").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

    // Type card selection
    modal.querySelectorAll(".insp-type-card").forEach(function (card) {
      card.addEventListener("click", function () {
        modal.querySelectorAll(".insp-type-card").forEach(function (c) {
          c.style.borderColor = "#e2e8f0";
          c.style.background = "#fff";
        });
        var type = this.getAttribute("data-type");
        var t = REPORT_TYPES[type];
        this.style.borderColor = t.color;
        this.style.background = t.bg;
        var radio = this.closest("label").querySelector("input[type=radio]");
        if (radio) radio.checked = true;
      });
    });

    modal.querySelector("#insp-confirm-create").addEventListener("click", async function () {
      var email = modal.querySelector("#insp-new-email").value.trim();
      if (!email) { showToast("Email requerido", "error"); return; }
      var selectedType = modal.querySelector('input[name="insp-type"]:checked');
      var payload = {
        user_email: email,
        user_name: modal.querySelector("#insp-new-name").value.trim(),
        report_type: selectedType ? selectedType.value : "basica",
        brand: modal.querySelector("#insp-new-brand").value.trim(),
        model: modal.querySelector("#insp-new-model").value.trim(),
        vessel_year: modal.querySelector("#insp-new-year").value.trim(),
        country: modal.querySelector("#insp-new-country").value,
        created_by: "admin"
      };
      var res = await createInspection(payload);
      if (res.success) {
        modal.remove();
        showToast("Inspeccion creada");
        window.location.hash = "#inspecciones/" + res.id;
      } else {
        showToast(res.error || "Error al crear", "error");
      }
    });
  }

  function refreshMediaGrids() {
    // Re-render the detail view with updated photo/video data
    var id = getInspectionIdFromHash();
    if (id && currentInspection) {
      renderDetailModule(currentInspection);
    }
  }

  // ============================================================
  // COLLECT FORM DATA
  // ============================================================

  function collectFormData() {
    if (!currentInspection) return null;
    var payload = { id: currentInspection.id };
    var container = document.getElementById("insp-admin-container");
    if (!container) return payload;

    // Main fields
    container.querySelectorAll(".insp-main-field").forEach(function (el) {
      var field = el.getAttribute("data-field");
      if (field) payload[field] = el.value;
    });

    // Section fields
    var sections = SECTIONS[currentInspection.report_type] || SECTIONS.basica;
    sections.forEach(function (sec) {
      var data = {};
      container.querySelectorAll('.insp-field[data-section="' + sec.key + '"]').forEach(function (el) {
        var field = el.getAttribute("data-field");
        if (field) data[field] = el.value;
      });
      payload["section_" + sec.key] = data;
    });

    // Photos & videos from currentInspection (managed via upload/remove)
    ["photos_hull", "photos_engine", "photos_electrical", "photos_interior", "photos_trailer", "photos_general", "photos_test_drive", "videos_test_drive"].forEach(function (key) {
      if (currentInspection[key]) payload[key] = currentInspection[key];
    });

    return payload;
  }

  async function doSave() {
    if (isSaving) return;
    isSaving = true;
    var statusEl = document.getElementById("insp-save-status");
    if (statusEl) statusEl.textContent = "Guardando...";
    var saveBtn = document.getElementById("insp-save-btn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = "0.6"; }

    var payload = collectFormData();
    if (!payload) { isSaving = false; return; }

    // Auto-set status to in_progress if still draft
    if (currentInspection.status === "draft") {
      payload.status = "in_progress";
    }

    var res = await saveInspection(payload);
    isSaving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = "1"; }

    if (res.success) {
      showToast("Cambios guardados");
      if (statusEl) statusEl.textContent = "Guardado a las " + new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
      // Update current inspection data
      Object.assign(currentInspection, payload);
    } else {
      showToast(res.error || "Error al guardar", "error");
      if (statusEl) statusEl.textContent = "Error al guardar";
    }
  }

  // ============================================================
  // RENDER MODULE
  // ============================================================

  function renderSkeleton() {
    return '<div style="padding:0 8px" data-enhancer-added="true">' +
      '<div style="height:32px;width:250px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:inspPulse 1.5s infinite;border-radius:8px;margin-bottom:24px"></div>' +
      '<div style="height:400px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:inspPulse 1.5s infinite;border-radius:16px"></div></div>';
  }

  async function renderModule(filters) {
    var main = document.querySelector("main");
    if (!main) return;

    // Hide React content
    Array.from(main.children).forEach(function (ch) {
      if (!ch.getAttribute("data-enhancer-added")) ch.style.display = "none";
    });

    var container = document.getElementById("insp-admin-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "insp-admin-container";
      container.setAttribute("data-enhancer-added", "true");
      main.appendChild(container);
    }

    var detailId = getInspectionIdFromHash();
    if (detailId) {
      container.innerHTML = renderSkeleton();
      var insp = await fetchInspectionDetail(detailId);
      if (insp) {
        currentInspection = insp;
        renderDetailModule(insp);
      } else {
        container.innerHTML = '<div style="text-align:center;padding:60px" data-enhancer-added="true"><p style="color:#ef4444;font-size:16px">Inspeccion no encontrada</p></div>';
      }
    } else {
      container.innerHTML = renderSkeleton();
      currentInspection = null;
      var list = await fetchInspections(filters);
      container.innerHTML = renderListView(list);
      attachListeners();
    }
  }

  function renderDetailModule(insp) {
    var container = document.getElementById("insp-admin-container");
    if (!container) return;
    container.innerHTML = renderDetailView(insp);
    attachListeners();
  }

  function hideModule() {
    var container = document.getElementById("insp-admin-container");
    if (container) container.remove();
    var main = document.querySelector("main");
    if (main) {
      Array.from(main.children).forEach(function (ch) {
        ch.style.display = "";
      });
    }
    currentInspection = null;
  }

  // ============================================================
  // STYLES
  // ============================================================

  function addStyles() {
    if (document.getElementById("insp-admin-styles")) return;
    var style = document.createElement("style");
    style.id = "insp-admin-styles";
    style.textContent = "@keyframes inspFadeIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes inspPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      ".insp-row:hover{background:#f8fafc!important}" +
      ".insp-upload-area:hover{border-color:#7c3aed!important;background:#f5f3ff!important;color:#7c3aed!important}" +
      "#insp-save-btn:hover{opacity:.9;transform:translateY(-1px)}" +
      "#insp-send-btn:hover{opacity:.9;transform:translateY(-1px)}" +
      "@media(max-width:768px){#insp-admin-container table{min-width:600px!important}#insp-admin-container .insp-photos-grid{grid-template-columns:repeat(auto-fill,minmax(80px,1fr))!important}}";
    document.head.appendChild(style);
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    addStyles();
    injectSidebarItem();

    window.addEventListener("hashchange", function () {
      updateSidebarActive();
      if (isInspectionPage()) {
        moduleHidden = false;
        renderModule();
      } else {
        hideModule();
      }
    });

    // Check on load
    if (isInspectionPage()) {
      renderModule();
    }

    // Periodic check for sidebar
    setInterval(function () {
      injectSidebarItem();
      updateSidebarActive();
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
