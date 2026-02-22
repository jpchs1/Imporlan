/**
 * Tracking Enhancer - Imporlan Panel
 * Seguimiento En Vivo de Embarcaciones USA -> Chile
 * Hooks into #seguimiento route in user panel
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/panel-test") ||
    window.location.pathname.includes("/test/"))
    ? "/test/api" : "/api";

  var mapInstance = null;
  var markers = {};
  var routeLine = null;
  var selectedVesselId = null;
  var leafletLoaded = false;
  var moduleHidden = false;
  var isRendering = false;
  var currentHash = "";

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

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    var d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var STATUS_COLORS = {
    active: { bg: "#10b981", text: "#ffffff", label: "Navegando" },
    arrived: { bg: "#3b82f6", text: "#ffffff", label: "Arribado" },
    scheduled: { bg: "#f59e0b", text: "#ffffff", label: "Programado" },
    inactive: { bg: "#64748b", text: "#ffffff", label: "Inactivo" }
  };

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["active"];
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:9999px;font-size:11px;font-weight:600;background:' + s.bg + ';color:' + s.text + '"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + '</span>';
  }

  function isTrackingPage() {
    var hash = window.location.hash;
    return hash === "#seguimiento" || hash.startsWith("#seguimiento/");
  }

  function injectSidebarItem() {
    var checkCount = 0;
    var maxChecks = 60;

    function tryInject() {
      checkCount++;
      if (checkCount > maxChecks) return;
      if (document.getElementById("sidebar-tracking-user")) return;

      var nav = document.querySelector("aside nav") || document.querySelector("nav");
      if (!nav) { setTimeout(tryInject, 500); return; }

      var buttons = nav.querySelectorAll("button");
      if (buttons.length === 0) { setTimeout(tryInject, 500); return; }

      var refBtn = null;
      buttons.forEach(function (el) {
        var text = (el.textContent || "").trim().toLowerCase();
        if (text.includes("configuracion") || text.includes("auditoria") || text.includes("marketplace") || text.includes("productos")) {
          refBtn = el;
        }
      });
      if (!refBtn) refBtn = buttons[buttons.length - 1];

      var btn = document.createElement("button");
      btn.id = "sidebar-tracking-user";
      btn.className = refBtn.className.replace(/bg-blue-500\/20|bg-cyan-500\/20|text-cyan-400|text-blue-400|border-r-4|border-cyan-400/g, "");
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg> Seguimiento';
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        moduleHidden = false;
        window.location.hash = "#seguimiento";
      });

      var refLi = refBtn.closest ? refBtn.closest("li") : refBtn.parentNode;
      if (refLi && refLi.tagName === "LI") {
        var li = document.createElement("li");
        li.appendChild(btn);
        refLi.parentNode.insertBefore(li, refLi.nextSibling);
      } else {
        refBtn.parentNode.insertBefore(btn, refBtn.nextSibling);
      }
      updateSidebarActive();
    }
    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-tracking-user");
    if (!item) return;
    if (isTrackingPage()) {
      item.style.background = "rgba(59,130,246,0.15)";
      item.style.color = "#60a5fa";
      item.style.fontWeight = "600";
    } else {
      item.style.background = "";
      item.style.color = "";
      item.style.fontWeight = "";
    }
  }

  function loadLeaflet(cb) {
    if (leafletLoaded) { cb(); return; }
    if (window.L) { leafletLoaded = true; cb(); return; }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    var script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = function () { leafletLoaded = true; cb(); };
    document.head.appendChild(script);
  }

  function initMap() {
    if (!window.L) return;
    var container = document.getElementById("tracking-map-container");
    if (!container) return;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    mapInstance = L.map(container, { zoomControl: true, attributionControl: false }).setView([-15, -100], 3);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapInstance);
    setTimeout(function () { mapInstance.invalidateSize(); }, 200);
  }

  function updateMapMarkers(vessels) {
    if (!mapInstance || !window.L) return;
    Object.keys(markers).forEach(function (k) {
      mapInstance.removeLayer(markers[k]);
      delete markers[k];
    });
    if (routeLine) { mapInstance.removeLayer(routeLine); routeLine = null; }

    var bounds = [];
    vessels.forEach(function (v) {
      if (!v.lat || !v.lon) return;
      var lat = parseFloat(v.lat);
      var lon = parseFloat(v.lon);
      if (isNaN(lat) || isNaN(lon)) return;

      var labelName = v.client_name || v.display_name;
      var shipIcon = L.divIcon({
        className: "tracking-ship-icon",
        html: '<div style="display:flex;flex-direction:column;align-items:center"><div style="background:' + (v.id == selectedVesselId ? '#1e40af' : '#0f172a') + ';color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap;margin-bottom:4px;box-shadow:0 2px 6px rgba(0,0,0,.3);max-width:120px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(labelName) + '</div><div style="width:32px;height:32px;background:' + (v.id == selectedVesselId ? '#3b82f6' : '#0f172a') + ';border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg></div></div>',
        iconSize: [120, 52],
        iconAnchor: [60, 52]
      });

      var marker = L.marker([lat, lon], { icon: shipIcon })
        .bindPopup('<strong>' + escapeHtml(v.display_name) + '</strong><br>' +
          (v.shipping_line ? escapeHtml(v.shipping_line) + '<br>' : '') +
          'Lat: ' + lat.toFixed(4) + ', Lon: ' + lon.toFixed(4) +
          (v.speed ? '<br>Velocidad: ' + v.speed + ' kn' : ''))
        .addTo(mapInstance);

      marker.on("click", function () {
        selectedVesselId = v.id;
        loadVesselDetail(v.id);
        updateMapMarkers(vessels);
      });

      markers[v.id] = marker;
      bounds.push([lat, lon]);
    });

    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }

  async function loadVessels() {
    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=featured");
      var data = await resp.json();
      if (data.success && data.vessels) {
        renderVesselList(data.vessels);
        updateMapMarkers(data.vessels);
        if (data.vessels.length > 0 && !selectedVesselId) {
          selectedVesselId = data.vessels[0].id;
          loadVesselDetail(data.vessels[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading vessels:", e);
      var list = document.getElementById("tracking-vessel-list");
      if (list) list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">Error al cargar embarcaciones</p>';
    }
  }

  function renderVesselList(vessels) {
    var list = document.getElementById("tracking-vessel-list");
    if (!list) return;

    if (vessels.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg><p style="color:#64748b;font-size:14px;margin:0">No hay embarcaciones en seguimiento</p></div>';
      return;
    }

    var html = '';
    vessels.forEach(function (v) {
      var isSelected = v.id == selectedVesselId;
      html += '<div class="tracking-vessel-card" data-vessel-id="' + v.id + '" style="padding:14px 16px;border-radius:12px;border:1px solid ' + (isSelected ? '#3b82f6' : '#e2e8f0') + ';background:' + (isSelected ? '#eff6ff' : '#fff') + ';cursor:pointer;margin-bottom:10px;transition:all .2s">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
        '<div style="width:36px;height:36px;background:linear-gradient(135deg,' + (v.status === 'active' ? '#3b82f6,#60a5fa' : '#64748b,#94a3b8') + ');border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(v.display_name) + '</div>' +
        (v.client_name ? '<div style="font-size:11px;color:#2563eb;font-weight:500;margin-top:1px">' + escapeHtml(v.client_name) + '</div>' : '') +
        '<div style="font-size:11px;color:#64748b;margin-top:2px">' + escapeHtml(v.shipping_line || '') + '</div></div>' +
        getStatusBadge(v.status) + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">' +
        '<span>' + escapeHtml(v.origin_label || 'USA') + ' → ' + escapeHtml(v.destination_label || 'Chile') + '</span>' +
        (v.speed ? '<span>' + v.speed + ' kn</span>' : '') +
        '</div></div>';
    });

    list.innerHTML = html;

    list.querySelectorAll(".tracking-vessel-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var vid = parseInt(card.getAttribute("data-vessel-id"));
        selectedVesselId = vid;
        renderVesselList(vessels);
        loadVesselDetail(vid);
        updateMapMarkers(vessels);
      });
    });
  }

  async function loadVesselDetail(vesselId) {
    var detail = document.getElementById("tracking-vessel-detail");
    if (!detail) return;

    detail.innerHTML = '<div style="text-align:center;padding:40px"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto"></div></div>';

    try {
      var resp = await fetch(API_BASE + "/tracking_api.php?action=vessel_detail&id=" + vesselId);
      var data = await resp.json();
      if (data.success && data.vessel) {
        renderVesselDetail(data.vessel);
      }
    } catch (e) {
      detail.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px">Error al cargar detalle</p>';
    }
  }

  function renderVesselDetail(vessel) {
    var detail = document.getElementById("tracking-vessel-detail");
    if (!detail) return;

    var pos = vessel.current_position;
    var html = '<div style="margin-bottom:20px">' +
      '<h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">' + escapeHtml(vessel.display_name) + '</h3>' +
      getStatusBadge(vessel.status) + '</div>';

    html += '<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<h4 style="margin:0 0 12px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em">Informacion</h4>' +
      '<div style="display:grid;gap:10px">';

    var fields = [
      { label: "Cliente", value: vessel.client_name },
      { label: "Naviera", value: vessel.shipping_line },
      { label: "IMO", value: vessel.imo },
      { label: "MMSI", value: vessel.mmsi },
      { label: "Origen", value: vessel.origin_label },
      { label: "Destino", value: vessel.destination_label },
      { label: "ETA", value: vessel.eta_manual ? formatDate(vessel.eta_manual) : (pos && pos.eta ? formatDate(pos.eta) : null) }
    ];

    fields.forEach(function (f) {
      if (!f.value) return;
      html += '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:12px;color:#64748b">' + f.label + '</span>' +
        '<span style="font-size:13px;font-weight:500;color:#0f172a">' + escapeHtml(f.value) + '</span></div>';
    });
    html += '</div></div>';

    if (pos) {
      html += '<div style="background:#f0f9ff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #bfdbfe">' +
        '<h4 style="margin:0 0 12px;font-size:13px;font-weight:600;color:#1e40af;text-transform:uppercase;letter-spacing:.05em">Posicion Actual</h4>' +
        '<div style="display:grid;gap:8px">' +
        '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#3b82f6">Latitud</span><span style="font-size:13px;font-weight:600;color:#1e293b">' + (pos.lat ? parseFloat(pos.lat).toFixed(4) : 'N/A') + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#3b82f6">Longitud</span><span style="font-size:13px;font-weight:600;color:#1e293b">' + (pos.lon ? parseFloat(pos.lon).toFixed(4) : 'N/A') + '</span></div>' +
        (pos.speed ? '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#3b82f6">Velocidad</span><span style="font-size:13px;font-weight:600;color:#1e293b">' + pos.speed + ' nudos</span></div>' : '') +
        (pos.course ? '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#3b82f6">Rumbo</span><span style="font-size:13px;font-weight:600;color:#1e293b">' + pos.course + '°</span></div>' : '') +
        '<div style="display:flex;justify-content:space-between"><span style="font-size:12px;color:#3b82f6">Actualizado</span><span style="font-size:12px;color:#64748b">' + formatDate(pos.lastUpdate || pos.fetched_at) + '</span></div>' +
        '</div></div>';
    }

    html += '<div style="margin-top:16px;text-align:center">' +
      '<button id="btn-refresh-tracking" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>Actualizar</button></div>';

    detail.innerHTML = html;

    var refreshBtn = document.getElementById("btn-refresh-tracking");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadVessels();
      });
    }
  }

  function renderTrackingUI() {
    var main = document.querySelector("main");
    if (!main) return;
    if (document.getElementById("tracking-module-wrapper")) return;

    var wrapper = document.createElement("div");
    wrapper.id = "tracking-module-wrapper";
    wrapper.innerHTML = '<div style="padding:0">' +
      '<div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">' +
      '<div><h1 style="margin:0;font-size:24px;font-weight:700;color:#0f172a">Seguimiento En Vivo</h1>' +
      '<p style="margin:4px 0 0;font-size:14px;color:#64748b">Tracking de embarcaciones USA → Chile</p></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;animation:pulse 2s infinite"></span><span style="font-size:12px;color:#64748b">En vivo</span></div></div>' +
      '<div style="display:grid;grid-template-columns:280px 1fr 320px;gap:16px;height:calc(100vh - 200px);min-height:500px">' +
      '<div id="tracking-vessel-list" style="overflow-y:auto;background:#fff;border-radius:14px;padding:14px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04)"></div>' +
      '<div style="background:#f1f5f9;border-radius:14px;position:relative;overflow:hidden;border:1px solid #e2e8f0">' +
      '<div id="tracking-map-container" style="width:100%;height:100%;border-radius:14px"></div></div>' +
      '<div id="tracking-vessel-detail" style="overflow-y:auto;background:#fff;border-radius:14px;padding:18px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.04)"></div>' +
      '</div></div>';

    main.appendChild(wrapper);
    main.classList.add("tracking-active");
    addStyles();
    loadLeaflet(function () {
      initMap();
      loadVessels();
    });
  }

  function addStyles() {
    if (document.getElementById("tracking-enhancer-styles")) return;
    var style = document.createElement("style");
    style.id = "tracking-enhancer-styles";
    style.textContent =
      "@keyframes spin { to { transform: rotate(360deg) } }" +
      "@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }" +
      ".tracking-vessel-card:hover { border-color:#3b82f6 !important; box-shadow:0 2px 8px rgba(59,130,246,.15) }" +
      ".leaflet-container { font-family:system-ui,-apple-system,sans-serif !important }" +
      "@media (max-width:1024px) { #tracking-vessel-list { display:none } }" +
      "@media (max-width:768px) { main > div > div:last-child { grid-template-columns:1fr !important; height:auto !important } #tracking-vessel-detail { order:-1 } }" +
      "main.tracking-active > * { display: none !important; }" +
      "main.tracking-active > #tracking-module-wrapper { display: block !important; }";
    document.head.appendChild(style);
  }

  function hideModule() {
    var wrapper = document.getElementById("tracking-module-wrapper");
    if (wrapper) wrapper.remove();

    var main = document.querySelector("main");
    if (main) main.classList.remove("tracking-active");

    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    markers = {};
    routeLine = null;
    selectedVesselId = null;
  }

  function checkPage() {
    var hash = window.location.hash;
    if (isRendering && hash === currentHash) return;

    if (!document.getElementById("sidebar-tracking-user")) {
      injectSidebarItem();
    }
    updateSidebarActive();
    if (isTrackingPage() && !moduleHidden) {
      if (!document.getElementById("tracking-module-wrapper")) {
        isRendering = true;
        currentHash = hash;
        renderTrackingUI();
        isRendering = false;
      }
    } else {
      var wrapper = document.getElementById("tracking-module-wrapper");
      if (wrapper || mapInstance) hideModule();
    }
  }

  var ROUTE_MAP = {
    "dashboard": "#dashboard", "casos": "#casos", "pagos": "#pagos",
    "usuarios": "#usuarios", "documentos": "#documentos", "auditoria": "#auditoria",
    "configuracion": "#configuracion", "marketplace": "#marketplace",
    "productos": "#productos", "expedientes": "#expedientes", "soporte": "#soporte"
  };

  var sidebarInterceptorInstalled = false;
  function installSidebarInterceptor() {
    if (sidebarInterceptorInstalled) return;
    sidebarInterceptorInstalled = true;
    document.addEventListener("click", function (e) {
      if (!document.getElementById("tracking-module-wrapper")) return;
      var btn = e.target.closest ? e.target.closest("button") : null;
      if (!btn || btn.id === "sidebar-tracking-user") return;
      var nav = btn.closest ? btn.closest("nav") : null;
      if (!nav) return;
      var text = (btn.textContent || "").trim().toLowerCase();
      var route = ROUTE_MAP[text];
      if (route && window.location.hash !== route) {
        window.location.hash = route;
      }
    }, true);
  }

  function init() {
    addStyles();
    injectSidebarItem();
    installSidebarInterceptor();
    var observer = new MutationObserver(function () {
      if (!document.getElementById("sidebar-tracking-user")) {
        injectSidebarItem();
      }
      checkPage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", function () {
      moduleHidden = false;
      checkPage();
    });
    setInterval(function () {
      if (!document.getElementById("sidebar-tracking-user")) {
        injectSidebarItem();
      }
    }, 2000);
    checkPage();
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
