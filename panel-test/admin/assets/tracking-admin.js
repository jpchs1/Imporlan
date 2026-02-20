/**
 * Tracking Admin Module - Imporlan Admin Panel
 * CRUD for vessels, assign to orders, manage positions
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api" : "/api";

  var STATUS_COLORS = {
    active: { bg: "#10b981", text: "#ffffff", label: "Activo" },
    inactive: { bg: "#64748b", text: "#ffffff", label: "Inactivo" },
    arrived: { bg: "#3b82f6", text: "#ffffff", label: "Arribado" },
    scheduled: { bg: "#f59e0b", text: "#ffffff", label: "Programado" }
  };

  var STATUS_OPTIONS = [
    { value: "active", label: "Activo" },
    { value: "scheduled", label: "Programado" },
    { value: "arrived", label: "Arribado" },
    { value: "inactive", label: "Inactivo" }
  ];

  var moduleHidden = false;
  var mapInstance = null;
  var leafletLoaded = false;

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: "Bearer " + getAdminToken() };
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    var d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["active"];
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ';color:' + s.text + '"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + '</span>';
  }

  function showToast(msg, type) {
    var toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981");
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; setTimeout(function () { toast.remove(); }, 300); }, 2500);
  }

  function inputStyle() {
    return "width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;color:#1e293b;background:#fff;box-sizing:border-box;outline:none;transition:border-color .2s";
  }

  function isTrackingPage() {
    var hash = window.location.hash;
    return hash === "#tracking" || hash.startsWith("#tracking/");
  }

  function getVesselIdFromHash() {
    var match = window.location.hash.match(/#tracking\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  function injectSidebarItem() {
    var checkCount = 0;
    var maxChecks = 60;
    function tryInject() {
      checkCount++;
      if (checkCount > maxChecks) return;
      if (document.getElementById("sidebar-tracking-admin")) return;
      var nav = document.querySelector("aside nav") || document.querySelector("nav");
      if (!nav) { setTimeout(tryInject, 500); return; }
      var buttons = nav.querySelectorAll("button");
      if (buttons.length === 0) { setTimeout(tryInject, 500); return; }
      var refBtn = null;
      buttons.forEach(function (el) {
        var text = (el.textContent || "").trim().toLowerCase();
        if (text.includes("configuracion") || text.includes("auditoria") || text.includes("expedientes")) refBtn = el;
      });
      if (!refBtn) refBtn = buttons[buttons.length - 1];

      var btn = document.createElement("button");
      btn.id = "sidebar-tracking-admin";
      btn.className = refBtn.className.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400/g, "");
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg> Tracking';
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        moduleHidden = false;
        window.location.hash = "#tracking";
      });
      refBtn.parentNode.insertBefore(btn, refBtn.nextSibling);
      updateSidebarActive();
    }
    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-tracking-admin");
    if (!item) return;
    var nav = item.parentNode;
    if (isTrackingPage()) {
      if (nav) {
        var siblings = nav.querySelectorAll("button");
        siblings.forEach(function (s) {
          if (s !== item && s.id !== "sidebar-expedientes-admin") {
            s.className = s.className.replace(/bg-cyan-500\/20|bg-blue-500\/20|bg-blue-600|text-white/g, "");
          }
        });
      }
      item.style.background = "rgba(0,212,255,0.15)";
      item.style.color = "#00d4ff";
      item.style.fontWeight = "600";
    } else {
      item.style.background = "";
      item.style.color = "";
      item.style.fontWeight = "";
    }
  }

  async function fetchVessels(filters) {
    try {
      var params = new URLSearchParams({ action: "admin_list_vessels" });
      if (filters) {
        if (filters.status) params.append("status", filters.status);
        if (filters.search) params.append("search", filters.search);
      }
      var resp = await fetch(API_BASE + "/tracking_api.php?" + params.toString(), { headers: authHeaders() });
      var data = await resp.json();
      return data.success ? data.vessels || [] : [];
    } catch (e) { console.error("Error fetching vessels:", e); return []; }
  }

  async function createVessel(vesselData) {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=admin_create_vessel", {
        method: "POST", headers: authHeaders(), body: JSON.stringify(vesselData)
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function updateVessel(vesselData) {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=admin_update_vessel", {
        method: "POST", headers: authHeaders(), body: JSON.stringify(vesselData)
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function deleteVessel(vesselId) {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=admin_delete_vessel", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ id: vesselId })
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function assignVesselToOrder(orderId, vesselId) {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=admin_assign_vessel", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ order_id: orderId, vessel_id: vesselId })
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  async function addPosition(vesselId, lat, lon, speed, course) {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=admin_add_position", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ vessel_id: vesselId, lat: lat, lon: lon, speed: speed, course: course })
      });
      return await resp.json();
    } catch (e) { return { error: "Error de conexion" }; }
  }

  function renderFilters() {
    return '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:20px">' +
      '<input id="ta-search" type="text" placeholder="Buscar por nombre, IMO, MMSI..." style="' + inputStyle() + ';max-width:300px">' +
      '<select id="ta-filter-status" style="' + inputStyle() + ';max-width:160px"><option value="">Todos los estados</option>' +
      STATUS_OPTIONS.map(function (s) { return '<option value="' + s.value + '">' + s.label + '</option>'; }).join('') + '</select>' +
      '<button id="ta-btn-create" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Crear Embarcacion</button></div>';
  }

  function renderListView(vessels) {
    if (vessels.length === 0) {
      return '<div style="text-align:center;padding:40px"><p style="color:#64748b;font-size:14px">No hay embarcaciones registradas</p></div>';
    }
    var html = '<div style="display:grid;gap:12px">';
    vessels.forEach(function (v) {
      html += '<div class="ta-vessel-row" data-id="' + v.id + '" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:18px 24px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:16px">' +
        '<div style="width:44px;height:44px;background:linear-gradient(135deg,' + (v.status === 'active' ? '#3b82f6,#60a5fa' : '#64748b,#94a3b8') + ');border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#0f172a">' + escapeHtml(v.display_name) + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:2px">' + (v.shipping_line ? escapeHtml(v.shipping_line) + ' | ' : '') + 'IMO: ' + escapeHtml(v.imo || '-') + ' | MMSI: ' + escapeHtml(v.mmsi || '-') + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        (v.lat ? '<span style="font-size:11px;color:#94a3b8">Lat: ' + parseFloat(v.lat).toFixed(2) + ', Lon: ' + parseFloat(v.lon).toFixed(2) + '</span>' : '') +
        '<span style="font-size:11px;color:#94a3b8">' + (v.order_count || 0) + ' ordenes</span>' +
        getStatusBadge(v.status) +
        (v.is_featured == 1 ? '<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;background:#fef3c7;color:#d97706">Destacado</span>' : '') +
        '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderCreateModal() {
    var overlay = document.createElement("div");
    overlay.id = "ta-create-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center";
    overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:28px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="margin:0;font-size:20px;font-weight:700;color:#0f172a">Crear Embarcacion</h2>' +
      '<button id="ta-close-modal" style="border:none;background:none;cursor:pointer;padding:4px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
      '<div style="display:grid;gap:14px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Nombre *</label><input id="ta-f-name" style="' + inputStyle() + '" placeholder="Ej: MSC Oscar"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">IMO</label><input id="ta-f-imo" style="' + inputStyle() + '" placeholder="7 digitos" maxlength="7"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">MMSI</label><input id="ta-f-mmsi" style="' + inputStyle() + '" placeholder="9 digitos" maxlength="9"></div></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Naviera</label><input id="ta-f-shipping" style="' + inputStyle() + '" placeholder="Ej: MSC, Maersk, CMA CGM"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Origen</label><input id="ta-f-origin" style="' + inputStyle() + '" placeholder="Ej: Miami, FL"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Destino</label><input id="ta-f-dest" style="' + inputStyle() + '" placeholder="Ej: San Antonio, Chile"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Latitud</label><input id="ta-f-lat" type="number" step="0.0001" style="' + inputStyle() + '" placeholder="Ej: 25.7617"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Longitud</label><input id="ta-f-lon" type="number" step="0.0001" style="' + inputStyle() + '" placeholder="Ej: -80.1918"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">ETA</label><input id="ta-f-eta" type="datetime-local" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Estado</label><select id="ta-f-status" style="' + inputStyle() + '">' + STATUS_OPTIONS.map(function (s) { return '<option value="' + s.value + '">' + s.label + '</option>'; }).join('') + '</select></div></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:flex;align-items:center;gap:8px"><input type="checkbox" id="ta-f-featured"> Embarcacion Destacada (visible en panel usuario)</label></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">' +
      '<button id="ta-btn-cancel" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
      '<button id="ta-btn-save" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Guardar</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    document.getElementById("ta-close-modal").addEventListener("click", function () { overlay.remove(); });
    document.getElementById("ta-btn-cancel").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    document.getElementById("ta-btn-save").addEventListener("click", async function () {
      var name = document.getElementById("ta-f-name").value.trim();
      var imo = document.getElementById("ta-f-imo").value.trim();
      var mmsi = document.getElementById("ta-f-mmsi").value.trim();
      if (!name) { showToast("Se requiere nombre", "error"); return; }
      if (!imo && !mmsi) { showToast("Se requiere IMO o MMSI", "error"); return; }

      var data = {
        display_name: name, imo: imo || null, mmsi: mmsi || null,
        shipping_line: document.getElementById("ta-f-shipping").value.trim() || null,
        origin_label: document.getElementById("ta-f-origin").value.trim() || null,
        destination_label: document.getElementById("ta-f-dest").value.trim() || null,
        lat: document.getElementById("ta-f-lat").value || null,
        lon: document.getElementById("ta-f-lon").value || null,
        eta_manual: document.getElementById("ta-f-eta").value || null,
        status: document.getElementById("ta-f-status").value,
        is_featured: document.getElementById("ta-f-featured").checked ? 1 : 0
      };

      var result = await createVessel(data);
      if (result.success) {
        showToast("Embarcacion creada");
        overlay.remove();
        renderModule();
      } else {
        showToast(result.error || "Error al crear", "error");
      }
    });
  }

  function renderDetailView(vessel) {
    var statusOptions = STATUS_OPTIONS.map(function (s) {
      return '<option value="' + s.value + '"' + (s.value === vessel.status ? ' selected' : '') + '>' + s.label + '</option>';
    }).join('');

    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="padding:20px 28px;background:linear-gradient(to right,#eff6ff,#dbeafe);border-bottom:1px solid #bfdbfe;display:flex;align-items:center;justify-content:space-between">' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<button id="ta-btn-back" style="border:none;background:none;cursor:pointer;padding:4px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
      '<h2 style="margin:0;font-size:20px;font-weight:700;color:#1e293b">' + escapeHtml(vessel.display_name) + '</h2>' +
      getStatusBadge(vessel.status) + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button id="ta-btn-delete" style="padding:8px 16px;border-radius:8px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer">Eliminar</button>' +
      '</div></div>' +
      '<div style="padding:24px 28px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Nombre</label><input id="ta-e-name" value="' + escapeHtml(vessel.display_name) + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Naviera</label><input id="ta-e-shipping" value="' + escapeHtml(vessel.shipping_line || '') + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">IMO</label><input id="ta-e-imo" value="' + escapeHtml(vessel.imo || '') + '" style="' + inputStyle() + '" maxlength="7"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">MMSI</label><input id="ta-e-mmsi" value="' + escapeHtml(vessel.mmsi || '') + '" style="' + inputStyle() + '" maxlength="9"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Origen</label><input id="ta-e-origin" value="' + escapeHtml(vessel.origin_label || '') + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Destino</label><input id="ta-e-dest" value="' + escapeHtml(vessel.destination_label || '') + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">ETA</label><input id="ta-e-eta" type="datetime-local" value="' + (vessel.eta_manual ? vessel.eta_manual.replace(' ', 'T').substring(0, 16) : '') + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Estado</label><select id="ta-e-status" style="' + inputStyle() + '">' + statusOptions + '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:16px"><label style="font-size:12px;font-weight:600;color:#475569;display:flex;align-items:center;gap:8px"><input type="checkbox" id="ta-e-featured"' + (vessel.is_featured == 1 ? ' checked' : '') + '> Embarcacion Destacada</label></div>' +
      '<div style="display:flex;gap:12px;margin-bottom:24px">' +
      '<button id="ta-btn-save-edit" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Guardar Cambios</button></div>' +
      '<div style="border-top:1px solid #e2e8f0;padding-top:20px">' +
      '<h3 style="margin:0 0 14px;font-size:16px;font-weight:600;color:#1e293b">Agregar Posicion Manual</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end">' +
      '<div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Latitud</label><input id="ta-p-lat" type="number" step="0.0001" style="' + inputStyle() + '" placeholder="-33.45"></div>' +
      '<div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Longitud</label><input id="ta-p-lon" type="number" step="0.0001" style="' + inputStyle() + '" placeholder="-70.66"></div>' +
      '<div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Velocidad (kn)</label><input id="ta-p-speed" type="number" step="0.1" style="' + inputStyle() + '" placeholder="12.5"></div>' +
      '<div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Rumbo</label><input id="ta-p-course" type="number" step="0.1" style="' + inputStyle() + '" placeholder="180"></div>' +
      '<button id="ta-btn-add-pos" style="padding:10px 16px;border-radius:10px;border:none;background:#10b981;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">Agregar</button></div></div>' +
      '<div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:20px">' +
      '<h3 style="margin:0 0 14px;font-size:16px;font-weight:600;color:#1e293b">Asignar a Expediente</h3>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">' +
      '<div><label style="font-size:11px;font-weight:600;color:#475569;display:block;margin-bottom:4px">ID del Expediente (Order)</label><input id="ta-a-orderid" type="number" style="' + inputStyle() + '" placeholder="ID de la orden"></div>' +
      '<button id="ta-btn-assign" style="padding:10px 16px;border-radius:10px;border:none;background:#6366f1;color:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">Asignar Tracking</button></div></div>' +
      '</div></div>';
  }

  function attachListeners() {
    var createBtn = document.getElementById("ta-btn-create");
    if (createBtn) {
      createBtn.addEventListener("click", function () { renderCreateModal(); });
    }

    var searchInput = document.getElementById("ta-search");
    var filterStatus = document.getElementById("ta-filter-status");
    var debounceTimer = null;
    function applyFilters() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { renderModule(); }, 300);
    }
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);

    document.querySelectorAll(".ta-vessel-row").forEach(function (row) {
      row.addEventListener("click", function () {
        window.location.hash = "#tracking/" + row.getAttribute("data-id");
      });
    });

    var backBtn = document.getElementById("ta-btn-back");
    if (backBtn) backBtn.addEventListener("click", function () { window.location.hash = "#tracking"; });

    var saveBtn = document.getElementById("ta-btn-save-edit");
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        var vid = getVesselIdFromHash();
        if (!vid) return;
        var data = {
          id: vid,
          display_name: document.getElementById("ta-e-name").value.trim(),
          shipping_line: document.getElementById("ta-e-shipping").value.trim() || null,
          imo: document.getElementById("ta-e-imo").value.trim() || null,
          mmsi: document.getElementById("ta-e-mmsi").value.trim() || null,
          origin_label: document.getElementById("ta-e-origin").value.trim() || null,
          destination_label: document.getElementById("ta-e-dest").value.trim() || null,
          eta_manual: document.getElementById("ta-e-eta").value || null,
          status: document.getElementById("ta-e-status").value,
          is_featured: document.getElementById("ta-e-featured").checked ? 1 : 0
        };
        var result = await updateVessel(data);
        if (result.success) showToast("Embarcacion actualizada");
        else showToast(result.error || "Error", "error");
      });
    }

    var deleteBtn = document.getElementById("ta-btn-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async function () {
        if (!confirm("Eliminar esta embarcacion? Se desvincularan todos los expedientes.")) return;
        var vid = getVesselIdFromHash();
        var result = await deleteVessel(vid);
        if (result.success) { showToast("Eliminada"); window.location.hash = "#tracking"; }
        else showToast(result.error || "Error", "error");
      });
    }

    var addPosBtn = document.getElementById("ta-btn-add-pos");
    if (addPosBtn) {
      addPosBtn.addEventListener("click", async function () {
        var vid = getVesselIdFromHash();
        var lat = parseFloat(document.getElementById("ta-p-lat").value);
        var lon = parseFloat(document.getElementById("ta-p-lon").value);
        if (isNaN(lat) || isNaN(lon)) { showToast("Lat/Lon requeridos", "error"); return; }
        var speed = parseFloat(document.getElementById("ta-p-speed").value) || null;
        var course = parseFloat(document.getElementById("ta-p-course").value) || null;
        var result = await addPosition(vid, lat, lon, speed, course);
        if (result.success) {
          showToast("Posicion agregada");
          document.getElementById("ta-p-lat").value = "";
          document.getElementById("ta-p-lon").value = "";
          document.getElementById("ta-p-speed").value = "";
          document.getElementById("ta-p-course").value = "";
        } else showToast(result.error || "Error", "error");
      });
    }

    var assignBtn = document.getElementById("ta-btn-assign");
    if (assignBtn) {
      assignBtn.addEventListener("click", async function () {
        var vid = getVesselIdFromHash();
        var oid = parseInt(document.getElementById("ta-a-orderid").value);
        if (!oid) { showToast("ID de orden requerido", "error"); return; }
        var result = await assignVesselToOrder(oid, vid);
        if (result.success) {
          showToast("Tracking asignado. Email: " + (result.email_sent ? "Enviado" : "No enviado"));
          document.getElementById("ta-a-orderid").value = "";
        } else showToast(result.error || "Error", "error");
      });
    }
  }

  async function renderModule() {
    if (!isTrackingPage()) return;
    var main = document.querySelector("main");
    if (!main) return;

    var vesselId = getVesselIdFromHash();

    if (vesselId) {
      main.innerHTML = '<div style="padding:0"><div style="text-align:center;padding:40px"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto"></div></div></div>';
      try {
        var resp = await fetch(API_BASE + "/tracking_api.php?action=vessel_detail&id=" + vesselId, { headers: authHeaders() });
        var data = await resp.json();
        if (data.success && data.vessel) {
          main.innerHTML = '<div style="padding:0">' + renderDetailView(data.vessel) + '</div>';
        } else {
          main.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444">Embarcacion no encontrada</div>';
        }
      } catch (e) {
        main.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444">Error al cargar</div>';
      }
    } else {
      var searchVal = document.getElementById("ta-search") ? document.getElementById("ta-search").value : "";
      var statusVal = document.getElementById("ta-filter-status") ? document.getElementById("ta-filter-status").value : "";
      var vessels = await fetchVessels({ search: searchVal, status: statusVal });
      main.innerHTML = '<div style="padding:0">' +
        '<div style="margin-bottom:20px"><h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a">Tracking Maritimo</h1>' +
        '<p style="margin:4px 0 0;font-size:14px;color:#64748b">Gestion de embarcaciones y seguimiento</p></div>' +
        renderFilters() + renderListView(vessels) + '</div>';
    }

    addStyles();
    attachListeners();
  }

  function hideModule() {
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  }

  function addStyles() {
    if (document.getElementById("tracking-admin-styles")) return;
    var style = document.createElement("style");
    style.id = "tracking-admin-styles";
    style.textContent = "@keyframes spin { to { transform: rotate(360deg) } }" +
      ".ta-vessel-row:hover { border-color:#3b82f6 !important; box-shadow:0 2px 8px rgba(59,130,246,.1) }";
    document.head.appendChild(style);
  }

  function checkPage() {
    if (!document.getElementById("sidebar-tracking-admin")) {
      injectSidebarItem();
    }
    updateSidebarActive();
    if (isTrackingPage() && !moduleHidden) {
      var main = document.querySelector("main");
      if (main) renderModule();
    }
  }

  function init() {
    injectSidebarItem();
    var observer = new MutationObserver(function () {
      if (!document.getElementById("sidebar-tracking-admin")) {
        injectSidebarItem();
      }
      checkPage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", function () {
      checkPage();
    });
    if (isTrackingPage()) setTimeout(checkPage, 500);
  }

  function startWhenReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(init, 500);
    } else {
      document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
    }
  }

  startWhenReady();
})();
