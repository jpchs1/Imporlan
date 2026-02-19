/**
 * Expedientes Admin Module - Imporlan Admin Panel
 * Modern UI with drag & drop reordering
 */
(function () {
  "use strict";

  const API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  const STATUS_COLORS = {
    new: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    pending: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    pending_admin_fill: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    in_progress: { bg: "#10b981", text: "#ffffff", label: "En Proceso" },
    completed: { bg: "#6366f1", text: "#ffffff", label: "Completado" },
    expired: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    canceled: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
  };

  const STATUS_OPTIONS = [
    { value: "pending", label: "Pendiente" },
    { value: "in_progress", label: "En Proceso" },
    { value: "completed", label: "Completado" },
  ];

  let currentOrderData = null;
  let currentLinks = [];
  let hasUnsavedChanges = false;
  var moduleHidden = false;
  var dragSrcRow = null;

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }

  function getAdminUser() {
    try {
      var raw = localStorage.getItem("imporlan_admin_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function numOrEmpty(v) {
    return (v === null || v === undefined || v === '') ? '' : v;
  }

  function formatDotNumber(v) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '';
    var n = Math.round(parseFloat(v));
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatUsdDisplay(v) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '';
    var n = parseFloat(v);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function stripDots(s) {
    if (!s) return '';
    return s.toString().replace(/\./g, '');
  }

  function parseNumOrNull(v) {
    if (v === '' || v === undefined || v === null) return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
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

  function formatCurrency(amount, currency) {
    if (amount === null || amount === undefined || amount === "") return "-";
    var num = parseFloat(amount);
    if (isNaN(num)) return "-";
    if (currency === "USD") return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " USD";
    return "$" + num.toLocaleString("es-CL") + " CLP";
  }

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["new"];
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ';color:' + s.text + ';letter-spacing:.02em"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + '</span>';
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getAdminToken(),
    };
  }

  function isExpedientesPage() {
    var hash = window.location.hash;
    return hash === "#expedientes" || hash.startsWith("#expedientes/");
  }

  function getOrderIdFromHash() {
    var match = window.location.hash.match(/#expedientes\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  function injectSidebarItem() {
    var checkCount = 0;
    var maxChecks = 60;

    function tryInject() {
      checkCount++;
      if (checkCount > maxChecks) return;

      if (document.getElementById("sidebar-expedientes-admin")) return;

      var nav = document.querySelector("aside nav") || document.querySelector("nav");
      if (!nav) {
        setTimeout(tryInject, 500);
        return;
      }

      var ul = nav.querySelector("ul");
      var refBtn = null;
      var buttons = nav.querySelectorAll("button");
      buttons.forEach(function (el) {
        var text = el.textContent.trim().toLowerCase();
        if (text.includes("auditoria") || text.includes("contenido") || text.includes("pagos")) {
          refBtn = el;
        }
      });

      if (!refBtn && buttons.length > 0) {
        refBtn = buttons[buttons.length - 1];
      }

      if (!refBtn) {
        setTimeout(tryInject, 500);
        return;
      }

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.id = "sidebar-expedientes-admin";
      if (refBtn.className) {
        btn.className = refBtn.className.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400|bg-blue-50|text-blue-600/g, "");
      }
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>' +
        ' Expedientes';

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        moduleHidden = false;
        if (window.location.hash === "#expedientes") {
          renderModule();
        } else {
          window.location.hash = "#expedientes";
        }
      });

      li.appendChild(btn);

      var refLi = refBtn.closest("li");
      if (refLi && refLi.parentNode) {
        refLi.parentNode.insertBefore(li, refLi.nextSibling);
      } else if (ul) {
        ul.appendChild(li);
      } else {
        nav.appendChild(li);
      }

      updateSidebarActive();
    }

    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-expedientes-admin");
    if (!item) return;
    if (isExpedientesPage()) {
      item.style.background = "rgba(0,212,255,0.15)";
      item.style.color = "#00d4ff";
      item.style.borderRight = "4px solid #00d4ff";
      item.style.fontWeight = "600";
    } else {
      item.style.background = "transparent";
      item.style.color = "";
      item.style.borderRight = "none";
      item.style.fontWeight = "";
    }
  }

  async function fetchOrders(filters) {
    try {
      var params = new URLSearchParams({ action: "admin_list" });
      if (filters) {
        if (filters.status) params.append("status", filters.status);
        if (filters.agent) params.append("agent", filters.agent);
        if (filters.from_date) params.append("from_date", filters.from_date);
        if (filters.to_date) params.append("to_date", filters.to_date);
        if (filters.search) params.append("search", filters.search);
        if (filters.service_type) params.append("service_type", filters.service_type);
      }
      var resp = await fetch(API_BASE + "/orders_api.php?" + params.toString(), { headers: authHeaders() });
      var data = await resp.json();
      return data.success ? data.orders || [] : [];
    } catch (e) {
      console.error("Error fetching admin orders:", e);
      return [];
    }
  }

  async function fetchOrderDetail(orderId) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_detail&id=" + orderId, { headers: authHeaders() });
      var data = await resp.json();
      return data.success ? data.order : null;
    } catch (e) {
      console.error("Error fetching admin order detail:", e);
      return null;
    }
  }

  async function saveOrder(orderData) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_update", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(orderData),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error saving order:", e);
      return { error: "Error de conexion" };
    }
  }

  async function saveLinks(orderId, links) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_update_links", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ order_id: orderId, links: links }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error saving links:", e);
      return { error: "Error de conexion" };
    }
  }

  async function addNewLink(orderId) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_add_link", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ order_id: orderId }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error adding link:", e);
      return { error: "Error de conexion" };
    }
  }

  async function deleteLink(orderId, linkId) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_delete_link", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ order_id: orderId, link_id: linkId }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error deleting link:", e);
      return { error: "Error de conexion" };
    }
  }

  async function deleteOrder(orderId) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_delete", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: orderId }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error deleting order:", e);
      return { error: "Error de conexion" };
    }
  }

  async function createNewOrder(orderData) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_create", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(orderData),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error creating order:", e);
      return { error: "Error de conexion" };
    }
  }

  async function reorderLinks(orderId, linkIds) {
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=admin_reorder_links", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ order_id: orderId, link_ids: linkIds }),
      });
      return await resp.json();
    } catch (e) {
      console.error("Error reordering links:", e);
      return { error: "Error de conexion" };
    }
  }

  async function fetchClientPurchases(email) {
    try {
      var resp = await fetch(API_BASE + "/purchases.php?action=get&user_email=" + encodeURIComponent(email));
      return await resp.json();
    } catch (e) {
      console.error("Error fetching purchases:", e);
      return { plans: [], links: [] };
    }
  }

  function renderProductsSection(data) {
    var plans = data.plans || [];
    var links = data.links || [];
    if (plans.length === 0 && links.length === 0) return '';
    var itemsHtml = '';
    plans.forEach(function(p) {
      var sc = p.status === 'active' ? '#10b981' : (p.status === 'pending' ? '#f59e0b' : '#94a3b8');
      itemsHtml += '<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;border:1px solid #e2e8f0;background:#fafafa">' +
        '<div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:#1e293b">' + escapeHtml(p.planName || p.plan_name || '') + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:2px">' + (p.days ? p.days + ' dias' : '') + (p.startDate ? ' - Desde ' + escapeHtml(p.startDate) : '') + '</div></div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
        '<span style="font-size:14px;font-weight:700;color:#059669">$' + Number(p.price || 0).toLocaleString() + ' CLP</span>' +
        '<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + sc + ';color:#fff">' + escapeHtml(p.status || 'pendiente') + '</span></div></div>';
    });
    links.forEach(function(l) {
      itemsHtml += '<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;border:1px solid #e2e8f0;background:#fafafa">' +
        '<div style="width:40px;height:40px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:#1e293b">Cotizacion por Link</div>' +
        '<a href="' + escapeHtml(l.url || '') + '" target="_blank" style="font-size:12px;color:#0891b2;text-decoration:none">' + escapeHtml((l.url || '').substring(0, 60)) + '</a></div></div>';
    });
    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="padding:18px 28px;background:linear-gradient(to right,#f0fdf4,#ecfdf5);border-bottom:1px solid #d1fae5;display:flex;align-items:center;gap:12px">' +
      '<div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Productos Contratados del Cliente</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Planes y servicios adquiridos</p></div></div>' +
      '<div style="padding:16px 28px;display:flex;flex-direction:column;gap:10px">' + itemsHtml + '</div></div>';
  }

  function showToast(msg, type) {
    var toast = document.createElement("div");
    var bgColor = type === "error" ? "#ef4444" : "#10b981";
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;animation:eaSlideUp .3s;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + bgColor;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .3s";
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function inputStyle() {
    return "width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;background:#fff;outline:none;transition:all .2s;box-sizing:border-box";
  }

  function cellInputStyle() {
    return "padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1e293b;width:100%;box-sizing:border-box;outline:none;background:#fff;transition:all .2s";
  }

  function renderFilters() {
    return (
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;padding:18px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:14px;border:1px solid #e2e8f0" id="ea-filters">' +
      '<select id="ea-filter-status" style="' + inputStyle() + '">' +
      '<option value="">Todos los estados</option>' +
      STATUS_OPTIONS.map(function (s) { return '<option value="' + s.value + '">' + escapeHtml(s.label) + "</option>"; }).join("") +
      "</select>" +
      '<select id="ea-filter-service-type" style="' + inputStyle() + '">' +
      '<option value="">Tipo Servicio</option>' +
      '<option value="plan_busqueda">Plan Busqueda</option>' +
      '<option value="cotizacion_link">Cotizacion Link</option>' +
      '</select>' +
      '<input type="text" id="ea-filter-agent" placeholder="Agente..." style="' + inputStyle() + '">' +
      '<input type="date" id="ea-filter-from" style="' + inputStyle() + '" title="Desde">' +
      '<input type="date" id="ea-filter-to" style="' + inputStyle() + '" title="Hasta">' +
      '<input type="text" id="ea-filter-search" placeholder="Buscar cliente..." style="' + inputStyle() + '">' +
      '<button id="ea-filter-btn" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(8,145,178,.25)">Filtrar</button>' +
      "</div>"
    );
  }

  function renderListView(orders) {
    var rows = "";
    if (orders.length === 0) {
      rows = '<tr><td colspan="7" style="text-align:center;padding:50px;color:#94a3b8"><div style="display:flex;flex-direction:column;align-items:center;gap:12px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><span style="font-size:15px">No se encontraron expedientes</span></div></td></tr>';
    } else {
      orders.forEach(function (o) {
        var si = STATUS_COLORS[o.status] || STATUS_COLORS["new"];
        rows +=
          '<tr class="ea-list-row" style="border-bottom:1px solid #f1f5f9;transition:all .15s;cursor:pointer" data-id="' + o.id + '">' +
          '<td style="padding:14px 16px"><span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;background:linear-gradient(135deg,rgba(8,145,178,.08),rgba(6,182,212,.08));color:#0891b2;font-size:13px;font-weight:700;letter-spacing:.02em">' + escapeHtml(o.order_number) + "</span></td>" +
          '<td style="padding:14px 16px"><div style="font-size:14px;color:#1e293b;font-weight:500">' + escapeHtml(o.customer_name) + '</div><div style="font-size:12px;color:#94a3b8;margin-top:2px">' + escapeHtml(o.customer_email) + "</div></td>" +
          '<td style="padding:14px 16px;font-size:14px;color:#475569">' + escapeHtml(o.plan_name || "-") + "</td>" +
          '<td style="padding:14px 16px">' + getStatusBadge(o.status) + "</td>" +
          '<td style="padding:14px 16px;font-size:13px;color:#64748b">' + formatDate(o.created_at) + "</td>" +
          '<td style="padding:14px 16px;font-size:14px;color:#475569">' + escapeHtml(o.agent_name || "-") + "</td>" +
          '<td style="padding:14px 16px"><button class="ea-btn-edit" data-id="' + o.id + '" style="padding:8px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(8,145,178,.2)">Editar</button></td>' +
          "</tr>";
      });
    }

    return (
      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:28px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(8,145,178,.12);border-radius:50%"></div>' +
      '<div style="display:flex;align-items:center;gap:16px;position:relative">' +
      '<div style="width:52px;height:52px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(8,145,178,.3)">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Expedientes</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">Gestion de expedientes de busqueda</p></div></div>' +
      '<button id="ea-btn-create" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;box-shadow:0 4px 12px rgba(16,185,129,.3);position:relative">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Expediente</button></div>' +
      renderFilters() +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="background:linear-gradient(to right,#f8fafc,#f1f5f9)">' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Pedido N\u00b0</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Cliente</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Plan</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Estado</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Fecha</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Agente</th>' +
      '<th style="padding:14px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Acciones</th>' +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div></div>"
    );
  }

  function renderDetailView(order) {
    if (!order) {
      return (
        '<div style="text-align:center;padding:60px;color:#94a3b8"><p style="font-size:16px">Expediente no encontrado</p>' +
        '<button class="ea-btn-back" style="margin-top:16px;padding:10px 24px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;cursor:pointer;font-size:14px;font-weight:500">Volver</button></div>'
      );
    }

    currentOrderData = JSON.parse(JSON.stringify(order));
    currentLinks = JSON.parse(JSON.stringify(order.links || []));

    var statusOptions = STATUS_OPTIONS.map(function (s) {
      return '<option value="' + s.value + '"' + (order.status === s.value ? " selected" : "") + ">" + escapeHtml(s.label) + "</option>";
    }).join("");

    var linksRows = "";
    currentLinks.forEach(function (lk, idx) {
      linksRows += renderLinkRow(lk, idx);
    });

    if (currentLinks.length === 0) {
      linksRows = '<tr><td colspan="11" style="text-align:center;padding:40px;color:#94a3b8;font-size:14px"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="display:block;margin:0 auto 10px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>No hay links. Agrega uno con el boton de abajo.</td></tr>';
    }

    return (
      '<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
      '<button class="ea-btn-back" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.04)">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Volver</button>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<span id="ea-unsaved-badge" style="display:none;padding:8px 16px;border-radius:10px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:500;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Cambios sin guardar</span>' +
      '<button id="ea-save-all" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;box-shadow:0 4px 12px rgba(16,185,129,.25)">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Todo</button>' +
      '<button id="ea-delete-order" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;box-shadow:0 4px 12px rgba(239,68,68,.25)">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Eliminar Expediente</button></div></div>' +

      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(8,145,178,.12);border-radius:50%"></div>' +
      '<div style="display:flex;align-items:center;gap:14px;position:relative">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<h2 style="color:#fff;font-size:20px;font-weight:700;margin:0">Expediente ' + escapeHtml(order.order_number) + "</h2></div>" +
      '<select id="ea-status-select" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:600;cursor:pointer;backdrop-filter:blur(4px)">' + statusOptions + "</select></div>" +
      '<div style="padding:24px 28px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Cliente</label><input id="ea-f-customer_name" value="' + escapeHtml(order.customer_name || "") + '" style="' + inputStyle() + ';background:#f8fafc;color:#64748b" disabled></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Email</label><input id="ea-f-customer_email" value="' + escapeHtml(order.customer_email || "") + '" style="' + inputStyle() + ';background:#f8fafc;color:#64748b" disabled></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Telefono Cliente</label><input id="ea-f-customer_phone" value="' + escapeHtml(order.customer_phone || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tipo Servicio</label><select id="ea-f-service_type" style="' + inputStyle() + '"><option value="plan_busqueda"' + (order.service_type === 'plan_busqueda' ? ' selected' : '') + '>Plan Busqueda</option><option value="cotizacion_link"' + (order.service_type === 'cotizacion_link' ? ' selected' : '') + '>Cotizacion Link</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Origen</label><select id="ea-f-origin" style="' + inputStyle() + '"><option value="web"' + (order.origin === 'web' ? ' selected' : '') + '>Web</option><option value="admin"' + (order.origin === 'admin' ? ' selected' : '') + '>Admin</option><option value="whatsapp"' + (order.origin === 'whatsapp' ? ' selected' : '') + '>WhatsApp</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Plan</label><input id="ea-f-plan_name" value="' + escapeHtml(order.plan_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Embarcacion/Objetivo</label><input id="ea-f-asset_name" value="' + escapeHtml(order.asset_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tipo/Zona</label><input id="ea-f-type_zone" value="' + escapeHtml(order.type_zone || "") + '" style="' + inputStyle() + '"><span style="font-size:10px;color:#64748b;margin-top:4px;display:flex;align-items:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Ubicacion geografica del primer link</span></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Requerimiento</label><input id="ea-f-requirement_name" value="' + escapeHtml(order.requirement_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Agente</label><input id="ea-f-agent_name" value="' + escapeHtml(order.agent_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Telefono Agente</label><input id="ea-f-agent_phone" value="' + escapeHtml(order.agent_phone || "") + '" style="' + inputStyle() + '"></div>' +
      '<div style="grid-column:1/-1"><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Notas Admin (internas)</label><textarea id="ea-f-admin_notes" rows="3" style="' + inputStyle() + ';resize:vertical">' + escapeHtml(order.admin_notes || "") + '</textarea></div>' +
      '<div><label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#475569;cursor:pointer"><input type="checkbox" id="ea-f-visible_to_client"' + (order.visible_to_client == 1 ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#0891b2;cursor:pointer">Visible para cliente</label></div>' +
      "</div></div></div>" +

      '<div id="ea-client-products"></div>' +

      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="padding:20px 28px;background:linear-gradient(to right,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:36px;height:36px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Links Opciones en USA</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Arrastra las filas para reordenar por prioridad</p></div></div>' +
      '<button id="ea-add-link" style="padding:8px 18px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Fila</button></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse" id="ea-links-table">' +
      '<thead><tr style="background:linear-gradient(to right,#f8fafc,#f1f5f9)">' +
      '<th style="padding:14px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:32px"></th>' +
      '<th style="padding:14px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:36px">#</th>' +
      '<th style="padding:14px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:110px">Imagen</th>' +
      '<th style="padding:14px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;min-width:180px">Link Opcion (USA)</th>' +
      '<th style="padding:14px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:130px">Ubicacion</th>' +
      '<th style="padding:14px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:80px">Horas</th>' +
      '<th style="padding:14px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:120px">Valor USA (USD)</th>' +
      '<th style="padding:14px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:120px">Negociar (USD)</th>' +
      '<th style="padding:14px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:130px">Chile (CLP)</th>' +
      '<th style="padding:14px 8px;text-align:right;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:130px">Negociado (CLP)</th>' +
      '<th style="padding:14px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:55px">N\u00b0 Sel</th>' +
      '<th style="padding:14px 8px;text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;min-width:140px">Comentarios</th>' +
      '<th style="padding:14px 8px;text-align:center;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;width:50px">Acc.</th>' +
      '</tr></thead><tbody id="ea-links-tbody">' +
      linksRows +
      "</tbody></table></div></div>"
    );
  }

  function renderLinkRow(lk, idx) {
    var ci = cellInputStyle();
    var placeholderSvg = '<div class="ea-img-placeholder" style="width:88px;height:66px;border-radius:10px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#f1f5f9);cursor:pointer" title="Click para subir imagen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
    var imgPreview = lk.image_url
      ? '<img src="' + escapeHtml(lk.image_url) + '" style="width:88px;height:66px;object-fit:cover;border-radius:10px;border:2px solid #e2e8f0;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,.08)" class="ea-img-preview" data-url="' + escapeHtml(lk.image_url) + '">'
      : placeholderSvg;
    var clpVal = formatDotNumber(lk.value_chile_clp);
    var clpNegVal = formatDotNumber(lk.value_chile_negotiated_clp);
    var usdVal = formatUsdDisplay(lk.value_usa_usd);
    var usdNegVal = formatUsdDisplay(lk.value_to_negotiate_usd);
    return (
      '<tr data-link-id="' + (lk.id || "") + '" draggable="true" class="ea-link-row" style="border-bottom:1px solid #f1f5f9;transition:all .15s">' +
      '<td style="padding:8px 4px;text-align:center;vertical-align:middle"><div class="ea-drag-handle" style="cursor:grab;padding:4px;opacity:.3;transition:opacity .2s" title="Arrastra para reordenar"><svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></div></td>' +
      '<td class="ea-row-num" style="padding:8px 4px;text-align:center;font-size:14px;color:#64748b;font-weight:800">' + (idx + 1) + '</td>' +
      '<td style="padding:8px 6px;text-align:center;vertical-align:middle"><div style="display:flex;flex-direction:column;align-items:center;gap:4px">' + imgPreview +
      '<div style="display:flex;gap:2px;align-items:center">' +
      '<button class="ea-upload-img-btn" style="border:none;background:#f0f9ff;cursor:pointer;color:#0891b2;padding:4px 8px;border-radius:6px;display:flex;align-items:center;gap:3px;font-size:10px;font-weight:600;transition:all .15s" title="Subir imagen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Subir</button>' +
      '<button class="ea-edit-imgurl-btn" style="border:none;background:#f1f5f9;cursor:pointer;color:#64748b;padding:4px 6px;border-radius:6px;display:flex;align-items:center;font-size:10px;transition:all .15s" title="Editar URL de imagen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
      '</div>' +
      '<input type="file" class="ea-img-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none">' +
      '<input class="ea-link-image_url" value="' + escapeHtml(lk.image_url || "") + '" placeholder="URL imagen" style="' + ci + ';font-size:10px;width:92px;text-align:center;padding:3px 6px;color:#94a3b8;display:none" title="URL de la imagen"></div></td>' +
      '<td style="padding:8px 6px"><div style="display:flex;align-items:center;gap:4px"><input class="ea-link-url" value="' + escapeHtml(lk.url || "") + '" placeholder="https://..." style="' + ci + ';flex:1">' +
      '<div style="display:flex;gap:2px;flex-shrink:0">' +
      '<button class="ea-open-url" data-url="' + escapeHtml(lk.url || "") + '" style="border:none;background:#f1f5f9;cursor:pointer;color:#64748b;padding:7px;border-radius:8px;display:flex;align-items:center;transition:all .15s" title="Abrir"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
      '<button class="ea-copy-url" data-url="' + escapeHtml(lk.url || "") + '" style="border:none;background:#f1f5f9;cursor:pointer;color:#64748b;padding:7px;border-radius:8px;display:flex;align-items:center;transition:all .15s" title="Copiar"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>' +
      '</div></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-location" value="' + escapeHtml(lk.location || '') + '" placeholder="Ciudad, Estado" style="' + ci + '"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-hours" value="' + escapeHtml(lk.hours || '') + '" placeholder="0 hrs" style="' + ci + ';width:72px"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-value_usa_usd ea-fmt-usd" data-raw="' + numOrEmpty(lk.value_usa_usd) + '" value="' + usdVal + '" placeholder="0.00" style="' + ci + ';text-align:right;font-weight:600;color:#059669"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-value_to_negotiate_usd ea-fmt-usd" data-raw="' + numOrEmpty(lk.value_to_negotiate_usd) + '" value="' + usdNegVal + '" placeholder="0.00" style="' + ci + ';text-align:right;font-weight:600;color:#059669"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-value_chile_clp ea-fmt-clp" data-raw="' + numOrEmpty(lk.value_chile_clp) + '" value="' + (clpVal ? '$ ' + clpVal : '') + '" placeholder="$ 0" style="' + ci + ';text-align:right;font-weight:700;color:#2563eb"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-value_chile_negotiated_clp ea-fmt-clp" data-raw="' + numOrEmpty(lk.value_chile_negotiated_clp) + '" value="' + (clpNegVal ? '$ ' + clpNegVal : '') + '" placeholder="$ 0" style="' + ci + ';text-align:right;font-weight:700;color:#2563eb"></td>' +
      '<td style="padding:8px 4px"><input class="ea-link-selection_order" type="number" value="' + numOrEmpty(lk.selection_order) + '" placeholder="-" style="' + ci + ';text-align:center;font-weight:700"></td>' +
      '<td style="padding:8px 6px"><input class="ea-link-comments" value="' + escapeHtml(lk.comments || "") + '" placeholder="Agregar comentario..." style="' + ci + '"></td>' +
      '<td style="padding:8px 4px;text-align:center">' +
      '<button class="ea-delete-link" data-link-id="' + (lk.id || "") + '" style="border:none;background:#fef2f2;cursor:pointer;color:#ef4444;padding:7px;border-radius:8px;display:flex;align-items:center;transition:all .15s" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>' +
      '</tr>'
    );
  }

  function renderCreateModal() {
    return (
      '<div id="ea-create-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99998;display:flex;align-items:center;justify-content:center;animation:eaFadeIn .2s;backdrop-filter:blur(4px)">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.3)">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:24px 28px;display:flex;justify-content:space-between;align-items:center">' +
      '<div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>' +
      '<h3 style="color:#fff;font-size:18px;font-weight:700;margin:0">Nuevo Expediente</h3></div>' +
      '<button id="ea-close-modal" style="border:none;background:rgba(255,255,255,.1);color:#94a3b8;cursor:pointer;padding:8px;border-radius:8px;display:flex;align-items:center;transition:all .2s"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
      '<div style="padding:28px">' +
      '<div style="display:grid;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Email Cliente *</label><input id="ea-new-email" style="' + inputStyle() + '" placeholder="cliente@email.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Nombre Cliente *</label><input id="ea-new-name" style="' + inputStyle() + '" placeholder="Nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Telefono Cliente</label><input id="ea-new-phone" style="' + inputStyle() + '" placeholder="+56 9 1234 5678"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tipo Servicio</label><select id="ea-new-service-type" style="' + inputStyle() + '"><option value="plan_busqueda">Plan Busqueda</option><option value="cotizacion_link">Cotizacion Link</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Plan</label><input id="ea-new-plan" style="' + inputStyle() + '" placeholder="Plan Fragata, etc."></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Embarcacion/Objetivo</label><input id="ea-new-asset" style="' + inputStyle() + '" placeholder="Tipo de embarcacion"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Zona/Tipo</label><input id="ea-new-zone" style="' + inputStyle() + '" placeholder="Costa Este USA, etc."></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Agente</label><input id="ea-new-agent-name" value="Rodrigo Calder\u00f3n" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Telefono Agente</label><input id="ea-new-agent-phone" value="+56 9 40211459" style="' + inputStyle() + '"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">' +
      '<button id="ea-cancel-create" style="padding:10px 24px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:14px;cursor:pointer;font-weight:500;transition:all .2s">Cancelar</button>' +
      '<button id="ea-submit-create" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,.25);transition:all .2s">Crear Expediente</button>' +
      "</div></div></div></div>"
    );
  }

  function collectLinkData() {
    var tbody = document.getElementById("ea-links-tbody");
    if (!tbody) return [];
    var rows = tbody.querySelectorAll("tr[data-link-id]");
    var links = [];
    rows.forEach(function (row, idx) {
      links.push({
        id: parseInt(row.getAttribute("data-link-id")) || null,
        row_index: idx + 1,
        url: (row.querySelector(".ea-link-url") || {}).value || null,
        image_url: (row.querySelector(".ea-link-image_url") || {}).value || null,
        location: (row.querySelector(".ea-link-location") || {}).value || null,
        hours: (row.querySelector(".ea-link-hours") || {}).value || null,
        value_usa_usd: parseNumOrNull((row.querySelector(".ea-link-value_usa_usd") || {}).getAttribute('data-raw') || (row.querySelector(".ea-link-value_usa_usd") || {}).value),
        value_to_negotiate_usd: parseNumOrNull((row.querySelector(".ea-link-value_to_negotiate_usd") || {}).getAttribute('data-raw') || (row.querySelector(".ea-link-value_to_negotiate_usd") || {}).value),
        value_chile_clp: parseNumOrNull(stripDots(((row.querySelector(".ea-link-value_chile_clp") || {}).getAttribute('data-raw') || (row.querySelector(".ea-link-value_chile_clp") || {}).value || '').replace(/\$/g,'').trim())),
        value_chile_negotiated_clp: parseNumOrNull(stripDots(((row.querySelector(".ea-link-value_chile_negotiated_clp") || {}).getAttribute('data-raw') || (row.querySelector(".ea-link-value_chile_negotiated_clp") || {}).value || '').replace(/\$/g,'').trim())),
        selection_order: parseNumOrNull((row.querySelector(".ea-link-selection_order") || {}).value),
        comments: (row.querySelector(".ea-link-comments") || {}).value || null,
      });
    });
    return links;
  }

  function initDragDrop() {
    var tbody = document.getElementById("ea-links-tbody");
    if (!tbody) return;

    tbody.querySelectorAll(".ea-link-row").forEach(function (row) {
      row.addEventListener("dragstart", function (e) {
        dragSrcRow = this;
        this.style.opacity = "0.4";
        this.classList.add("ea-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", this.getAttribute("data-link-id"));
      });

      row.addEventListener("dragend", function () {
        this.style.opacity = "1";
        this.classList.remove("ea-dragging");
        var ind = tbody.querySelector(".ea-drop-indicator-row");
        if (ind) ind.remove();
        dragSrcRow = null;
        renumberRows();
        hasUnsavedChanges = true;
        showUnsavedBadge();
      });

      row.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (this === dragSrcRow) return;

        var rect = this.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;

        var existing = tbody.querySelector(".ea-drop-indicator-row");
        if (existing) existing.remove();

        var indicator = document.createElement("tr");
        indicator.className = "ea-drop-indicator-row";
        indicator.innerHTML = '<td colspan="11" style="padding:0;border:none"><div style="height:3px;background:linear-gradient(90deg,#0891b2,#06b6d4);border-radius:2px;margin:0 8px"></div></td>';

        if (e.clientY < midY) {
          this.parentNode.insertBefore(indicator, this);
        } else {
          this.parentNode.insertBefore(indicator, this.nextSibling);
        }
      });

      row.addEventListener("drop", function (e) {
        e.preventDefault();
        if (dragSrcRow === this) return;
        var indicator = tbody.querySelector(".ea-drop-indicator-row");
        if (indicator) {
          tbody.insertBefore(dragSrcRow, indicator);
          indicator.remove();
        }
      });
    });
  }

  function isBoatTraderUrl(url) {
    return /boattrader\.com|boats\.com/i.test(url);
  }

  function applyScrapedData(row, data) {
    var filled = false;
    if (data.image_url) {
      var imgInput = row.querySelector(".ea-link-image_url");
      if (imgInput && !imgInput.value) {
        imgInput.value = data.image_url;
        var imgContainer = imgInput.closest("div");
        var placeholder = imgContainer ? imgContainer.querySelector(".ea-img-placeholder") : null;
        if (placeholder) {
          var newImg = document.createElement("img");
          newImg.src = data.image_url;
          newImg.style.cssText = "width:88px;height:66px;object-fit:cover;border-radius:10px;border:2px solid #e2e8f0;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,.08)";
          newImg.className = "ea-img-preview";
          newImg.setAttribute("data-url", data.image_url);
          placeholder.parentNode.insertBefore(newImg, placeholder);
          placeholder.remove();
        }
        filled = true;
      }
    }
    if (data.location) {
      var locInput = row.querySelector(".ea-link-location");
      if (locInput && !locInput.value) { locInput.value = data.location; filled = true; }
    }
    if (data.hours) {
      var hrsInput = row.querySelector(".ea-link-hours");
      if (hrsInput && !hrsInput.value) { hrsInput.value = data.hours; filled = true; }
    }
    var priceVal = data.value_usa_usd || data.price;
    if (priceVal) {
      var usdInput = row.querySelector(".ea-link-value_usa_usd");
      if (usdInput && !usdInput.value && !usdInput.getAttribute("data-raw")) {
        usdInput.setAttribute("data-raw", priceVal);
        usdInput.value = formatUsdDisplay(priceVal);
        filled = true;
      }
    }
    return filled;
  }

  async function autoFetchLinkData(urlInput) {
    var url = urlInput.value.trim();
    if (!url || !url.match(/^https?:\/\//i)) return;
    var row = urlInput.closest("tr");
    if (!row) return;

    var loadingEl = document.createElement("div");
    loadingEl.className = "ea-link-loading";
    loadingEl.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;z-index:10;border-radius:8px";
    loadingEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;font-size:12px;color:#0369a1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ea-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Extrayendo datos...</div>';
    row.style.position = "relative";
    row.appendChild(loadingEl);

    try {
      var data = null;
      if (isBoatTraderUrl(url)) {
        var btResp = await fetch(API_BASE + "/boattrader_scraper.php?action=scrape&url=" + encodeURIComponent(url), { headers: authHeaders() });
        var btData = await btResp.json();
        if (btData.success && btData.boat) {
          data = btData.boat;
        }
      }
      if (!data) {
        var resp = await fetch(API_BASE + "/link_scraper.php?action=fetch&url=" + encodeURIComponent(url), { headers: authHeaders() });
        data = await resp.json();
        if (!data.success) data = null;
      }
      if (data) {
        applyScrapedData(row, data);
        showToast("Datos extraidos del link", "success");
        hasUnsavedChanges = true;
        showUnsavedBadge();
      }
    } catch (e) {
      console.warn("Auto-fetch failed:", e);
    } finally {
      if (loadingEl.parentNode) loadingEl.remove();
    }
  }

  function showUnsavedBadge() {
    var badge = document.getElementById("ea-unsaved-badge");
    if (badge) badge.style.display = "inline-flex";
  }

  function hideUnsavedBadge() {
    var badge = document.getElementById("ea-unsaved-badge");
    if (badge) badge.style.display = "none";
  }

  async function uploadLinkImage(file, row) {
    var uploadBtn = row.querySelector(".ea-upload-img-btn");
    var origHtml = uploadBtn ? uploadBtn.innerHTML : "";
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ea-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    }
    try {
      var formData = new FormData();
      formData.append("image", file);
      var resp = await fetch(API_BASE + "/image_upload.php?action=upload_link_image", {
        method: "POST",
        headers: { Authorization: "Bearer " + getAdminToken() },
        body: formData,
      });
      var data = await resp.json();
      if (data.success && data.url) {
        var imgInput = row.querySelector(".ea-link-image_url");
        if (imgInput) imgInput.value = data.url;
        updateImagePreview(row, data.url);
        hasUnsavedChanges = true;
        showUnsavedBadge();
        showToast("Imagen subida exitosamente", "success");
      } else {
        showToast(data.error || "Error al subir imagen", "error");
      }
    } catch (e) {
      console.error("Upload error:", e);
      showToast("Error al subir imagen", "error");
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = origHtml;
      }
    }
  }

  function updateImagePreview(row, url) {
    var container = row.querySelector("td:nth-child(3) > div");
    if (!container) return;
    var existingImg = container.querySelector(".ea-img-preview");
    var existingPlaceholder = container.querySelector(".ea-img-placeholder");
    if (url) {
      if (existingImg) {
        existingImg.src = url;
        existingImg.setAttribute("data-url", url);
        existingImg.style.display = "";
      } else {
        var newImg = document.createElement("img");
        newImg.src = url;
        newImg.style.cssText = "width:88px;height:66px;object-fit:cover;border-radius:10px;border:2px solid #e2e8f0;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,.08)";
        newImg.className = "ea-img-preview";
        newImg.setAttribute("data-url", url);
        newImg.addEventListener("click", function (e) {
          e.stopPropagation();
          var overlay = document.createElement("div");
          overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;animation:eaFadeIn .2s;backdrop-filter:blur(8px)";
          overlay.innerHTML = '<div style="position:relative;max-width:90%;max-height:90%"><img src="' + url + '" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5)"><button style="position:absolute;top:-12px;right:-12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);font-size:18px;font-weight:700">&times;</button></div>';
          overlay.addEventListener("click", function () { overlay.remove(); });
          document.body.appendChild(overlay);
        });
        newImg.addEventListener("error", function () {
          this.style.display = "none";
        });
        if (existingPlaceholder) {
          container.insertBefore(newImg, existingPlaceholder);
          existingPlaceholder.remove();
        } else {
          container.insertBefore(newImg, container.firstChild);
        }
      }
    } else {
      if (existingImg) existingImg.style.display = "none";
      if (!existingPlaceholder) {
        var ph = document.createElement("div");
        ph.className = "ea-img-placeholder";
        ph.style.cssText = "width:88px;height:66px;border-radius:10px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#f1f5f9);cursor:pointer";
        ph.title = "Click para subir imagen";
        ph.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
        ph.addEventListener("click", function (e) {
          e.stopPropagation();
          var r = this.closest("tr");
          if (r) { var fi = r.querySelector(".ea-img-file-input"); if (fi) fi.click(); }
        });
        container.insertBefore(ph, container.firstChild);
      }
    }
  }

  function attachListeners(container) {
    container.querySelectorAll(".ea-btn-edit").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        window.location.hash = "#expedientes/" + this.getAttribute("data-id");
      });
    });

    container.querySelectorAll(".ea-list-row").forEach(function (row) {
      row.addEventListener("click", function () {
        window.location.hash = "#expedientes/" + this.getAttribute("data-id");
      });
      row.addEventListener("mouseover", function () { this.style.background = "#f8fafc"; });
      row.addEventListener("mouseout", function () { this.style.background = "transparent"; });
    });

    container.querySelectorAll(".ea-btn-back").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = "#expedientes";
      });
    });

    container.querySelectorAll(".ea-open-url").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var url = this.getAttribute("data-url");
        if (url) window.open(url, "_blank");
      });
    });

    container.querySelectorAll(".ea-copy-url").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var url = this.getAttribute("data-url");
        if (url) { navigator.clipboard.writeText(url); showToast("Link copiado", "success"); }
      });
    });

    container.querySelectorAll(".ea-link-url").forEach(function (inp) {
      inp.addEventListener("blur", function () {
        var val = this.value.trim();
        if (val && val.match(/^https?:\/\//i)) {
          autoFetchLinkData(this);
        }
      });
    });

    container.querySelectorAll('.ea-fmt-clp').forEach(function (inp) {
      inp.addEventListener('focus', function () {
        var raw = this.getAttribute('data-raw') || '';
        this.value = raw;
        this.select();
      });
      inp.addEventListener('blur', function () {
        var val = stripDots(this.value.replace(/\$/g,'').trim());
        var n = parseFloat(val);
        if (!isNaN(n)) { this.setAttribute('data-raw', Math.round(n)); this.value = '$ ' + formatDotNumber(n); }
        else if (!val) { this.setAttribute('data-raw', ''); this.value = ''; }
      });
    });

    container.querySelectorAll('.ea-fmt-usd').forEach(function (inp) {
      inp.addEventListener('focus', function () {
        var raw = this.getAttribute('data-raw') || '';
        this.value = raw;
        this.select();
      });
      inp.addEventListener('blur', function () {
        var val = this.value.replace(/,/g,'').trim();
        var n = parseFloat(val);
        if (!isNaN(n)) { this.setAttribute('data-raw', n); this.value = formatUsdDisplay(n); }
        else if (!val) { this.setAttribute('data-raw', ''); this.value = ''; }
      });
    });

    container.querySelectorAll(".ea-img-preview").forEach(function (img) {
      img.addEventListener("error", function () {
        this.style.display = "none";
        var placeholder = document.createElement("div");
        placeholder.className = "ea-img-placeholder";
        placeholder.style.cssText = "width:88px;height:66px;border-radius:10px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#f1f5f9);cursor:pointer";
        placeholder.title = "Click para subir imagen";
        placeholder.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
        this.parentNode.insertBefore(placeholder, this);
      });
    });
    container.querySelectorAll(".ea-img-preview").forEach(function (img) {
      img.addEventListener("click", function (e) {
        e.stopPropagation();
        var url = this.getAttribute("data-url");
        var overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;animation:eaFadeIn .2s;backdrop-filter:blur(8px)";
        overlay.innerHTML = '<div style="position:relative;max-width:90%;max-height:90%"><img src="' + url + '" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5)"><button style="position:absolute;top:-12px;right:-12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);font-size:18px;font-weight:700">&times;</button></div>';
        overlay.addEventListener("click", function () { overlay.remove(); });
        document.body.appendChild(overlay);
      });
    });

    container.querySelectorAll(".ea-upload-img-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = this.closest("tr");
        if (row) {
          var fileInput = row.querySelector(".ea-img-file-input");
          if (fileInput) fileInput.click();
        }
      });
    });

    container.querySelectorAll(".ea-img-placeholder").forEach(function (ph) {
      ph.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = this.closest("tr");
        if (row) {
          var fileInput = row.querySelector(".ea-img-file-input");
          if (fileInput) fileInput.click();
        }
      });
    });

    container.querySelectorAll(".ea-img-file-input").forEach(function (inp) {
      inp.addEventListener("change", function () {
        if (!this.files || !this.files[0]) return;
        var file = this.files[0];
        var row = this.closest("tr");
        if (!row) return;
        uploadLinkImage(file, row);
      });
    });

    container.querySelectorAll(".ea-edit-imgurl-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = this.closest("tr");
        if (!row) return;
        var imgInput = row.querySelector(".ea-link-image_url");
        if (!imgInput) return;
        var currentUrl = imgInput.value || "";
        var newUrl = prompt("URL de la imagen:", currentUrl);
        if (newUrl !== null) {
          imgInput.value = newUrl.trim();
          updateImagePreview(row, newUrl.trim());
          hasUnsavedChanges = true;
          showUnsavedBadge();
        }
      });
    });

    var filterBtn = document.getElementById("ea-filter-btn");
    if (filterBtn) {
      filterBtn.addEventListener("click", async function () {
        var filters = {
          status: document.getElementById("ea-filter-status").value,
          service_type: document.getElementById("ea-filter-service-type").value,
          agent: document.getElementById("ea-filter-agent").value,
          from_date: document.getElementById("ea-filter-from").value,
          to_date: document.getElementById("ea-filter-to").value,
          search: document.getElementById("ea-filter-search").value,
        };
        var orders = await fetchOrders(filters);
        var tableBody = container.querySelector("tbody");
        if (tableBody) {
          var tempDiv = document.createElement("div");
          tempDiv.innerHTML = renderListView(orders);
          var newBody = tempDiv.querySelector("tbody");
          if (newBody) tableBody.innerHTML = newBody.innerHTML;
          attachListeners(container);
        }
      });
    }

    var createBtn = document.getElementById("ea-btn-create");
    if (createBtn) {
      createBtn.addEventListener("click", function () {
        document.body.insertAdjacentHTML("beforeend", renderCreateModal());
        var modal = document.getElementById("ea-create-modal");

        document.getElementById("ea-close-modal").addEventListener("click", function () { modal.remove(); });
        document.getElementById("ea-cancel-create").addEventListener("click", function () { modal.remove(); });

        document.getElementById("ea-submit-create").addEventListener("click", async function () {
          var email = document.getElementById("ea-new-email").value.trim();
          var name = document.getElementById("ea-new-name").value.trim();
          if (!email || !name) {
            showToast("Email y nombre son requeridos", "error");
            return;
          }
          var result = await createNewOrder({
            customer_email: email,
            customer_name: name,
            customer_phone: document.getElementById("ea-new-phone").value.trim(),
            service_type: document.getElementById("ea-new-service-type").value,
            plan_name: document.getElementById("ea-new-plan").value.trim(),
            asset_name: document.getElementById("ea-new-asset").value.trim(),
            type_zone: document.getElementById("ea-new-zone").value.trim(),
            agent_name: document.getElementById("ea-new-agent-name").value.trim(),
            agent_phone: document.getElementById("ea-new-agent-phone").value.trim(),
            origin: "admin",
          });
          if (result.success) {
            modal.remove();
            showToast("Expediente creado: " + result.order_number, "success");
            if (typeof window.logAuditAction === "function") {
              window.logAuditAction("expediente_edit", "expediente", result.order_id, null, { email: email, name: name }, "Expediente #" + result.order_number + " creado");
            }
            window.location.hash = "#expedientes/" + result.order_id;
          } else {
            showToast(result.error || "Error al crear", "error");
          }
        });
      });
    }

    var saveAllBtn = document.getElementById("ea-save-all");
    if (saveAllBtn && currentOrderData) {
      saveAllBtn.addEventListener("click", async function () {
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ea-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Guardando...';

        var orderUpdate = {
          id: currentOrderData.id,
          status: document.getElementById("ea-status-select").value,
          customer_phone: document.getElementById("ea-f-customer_phone").value,
          service_type: document.getElementById("ea-f-service_type").value,
          origin: document.getElementById("ea-f-origin").value,
          plan_name: document.getElementById("ea-f-plan_name").value,
          asset_name: document.getElementById("ea-f-asset_name").value,
          type_zone: document.getElementById("ea-f-type_zone").value,
          requirement_name: document.getElementById("ea-f-requirement_name").value,
          agent_name: document.getElementById("ea-f-agent_name").value,
          agent_phone: document.getElementById("ea-f-agent_phone").value,
          admin_notes: document.getElementById("ea-f-admin_notes").value,
          visible_to_client: document.getElementById("ea-f-visible_to_client").checked ? 1 : 0,
        };

        var r1 = await saveOrder(orderUpdate);

        var linksData = collectLinkData();
        var r2 = await saveLinks(currentOrderData.id, linksData);

        if (r1.success && r2.success) {
          showToast("Expediente guardado exitosamente", "success");
          hasUnsavedChanges = false;
          hideUnsavedBadge();
          if (typeof window.logAuditAction === "function") {
            var oldStatus = currentOrderData.status || "";
            var newStatus = orderUpdate.status || "";
            if (oldStatus !== newStatus) {
              window.logAuditAction("status_change", "expediente", currentOrderData.id, { status: oldStatus }, { status: newStatus }, "Estado cambiado de " + oldStatus + " a " + newStatus);
            }
            window.logAuditAction("expediente_edit", "expediente", currentOrderData.id, null, orderUpdate, "Expediente #" + currentOrderData.order_number + " actualizado");
            window.logAuditAction("link_modification", "links", currentOrderData.id, null, { count: linksData.length }, "Links actualizados para expediente #" + currentOrderData.order_number);
          }
        } else {
          showToast((r1.error || "") + " " + (r2.error || ""), "error");
        }

        saveAllBtn.disabled = false;
        saveAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Todo';
      });
    }

    var deleteOrderBtn = document.getElementById("ea-delete-order");
    if (deleteOrderBtn && currentOrderData) {
      deleteOrderBtn.addEventListener("click", async function () {
        if (!confirm("¿Estas seguro de eliminar el expediente " + currentOrderData.order_number + "?\n\nEsta accion eliminara el expediente y todos sus links asociados. No se puede deshacer.")) return;
        if (!confirm("Confirmar eliminacion definitiva de " + currentOrderData.order_number + "?")) return;
        deleteOrderBtn.disabled = true;
        deleteOrderBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ea-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Eliminando...';
        var result = await deleteOrder(currentOrderData.id);
        if (result.success) {
          if (typeof window.logAuditAction === "function") {
            window.logAuditAction("expediente_edit", "expediente", currentOrderData.id, { order_number: currentOrderData.order_number, customer: currentOrderData.customer_name }, null, "Expediente #" + currentOrderData.order_number + " eliminado");
          }
          showToast("Expediente " + result.order_number + " eliminado", "success");
          window.location.hash = "#expedientes";
        } else {
          showToast(result.error || "Error al eliminar", "error");
          deleteOrderBtn.disabled = false;
          deleteOrderBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Eliminar Expediente';
        }
      });
    }

    var addLinkBtn = document.getElementById("ea-add-link");
    if (addLinkBtn && currentOrderData) {
      addLinkBtn.addEventListener("click", async function () {
        var result = await addNewLink(currentOrderData.id);
        if (result.success) {
          var newLink = {
            id: result.link_id,
            row_index: result.row_index,
            url: "",
            image_url: null,
            value_usa_usd: null,
            value_to_negotiate_usd: null,
            value_chile_clp: null,
            value_chile_negotiated_clp: null,
            selection_order: null,
            comments: null,
          };
          currentLinks.push(newLink);
          var tbody = document.getElementById("ea-links-tbody");
          if (tbody) {
            if (tbody.querySelector("td[colspan]")) tbody.innerHTML = "";
            tbody.insertAdjacentHTML("beforeend", renderLinkRow(newLink, currentLinks.length - 1));
            initDragDrop();
            attachListeners(container);
          }
          showToast("Fila agregada", "success");
        } else {
          showToast(result.error || "Error al agregar fila", "error");
        }
      });
    }

    container.querySelectorAll(".ea-delete-link").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        var linkId = parseInt(this.getAttribute("data-link-id"));
        if (!linkId || !currentOrderData) return;
        if (!confirm("Eliminar esta fila de link?")) return;
        var result = await deleteLink(currentOrderData.id, linkId);
        if (result.success) {
          if (typeof window.logAuditAction === "function") {
            window.logAuditAction("link_modification", "links", currentOrderData.id, { link_id: linkId }, null, "Link #" + linkId + " eliminado del expediente #" + currentOrderData.order_number);
          }
          var row = this.closest("tr");
          if (row) row.remove();
          currentLinks = currentLinks.filter(function (l) { return l.id !== linkId; });
          renumberRows();
          showToast("Fila eliminada", "success");
        } else {
          showToast(result.error || "Error al eliminar", "error");
        }
      });
    });

    initDragDrop();
  }

  function renumberRows() {
    var tbody = document.getElementById("ea-links-tbody");
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr[data-link-id]");
    rows.forEach(function (row, idx) {
      var numCell = row.querySelector(".ea-row-num");
      if (numCell) numCell.textContent = idx + 1;
    });
  }

  function renderSkeleton() {
    return (
      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:28px 32px">' +
      '<div style="width:250px;height:24px;background:rgba(255,255,255,.1);border-radius:6px;margin-bottom:8px"></div>' +
      '<div style="width:180px;height:14px;background:rgba(255,255,255,.06);border-radius:4px"></div></div>' +
      '<div style="padding:20px">' +
      [1, 2, 3, 4].map(function () {
        return '<div style="display:flex;gap:12px;margin-bottom:14px"><div style="flex:1;height:40px;background:#f1f5f9;border-radius:10px;animation:eaPulse 1.5s infinite"></div><div style="flex:2;height:40px;background:#f1f5f9;border-radius:10px;animation:eaPulse 1.5s infinite"></div><div style="flex:1;height:40px;background:#f1f5f9;border-radius:10px;animation:eaPulse 1.5s infinite"></div></div>';
      }).join("") +
      "</div></div>"
    );
  }

  async function renderModule() {
    if (!isExpedientesPage()) return;
    if (moduleHidden) return;

    var mainContent = document.querySelector("main");
    if (!mainContent) return;

    var container = document.getElementById("ea-module-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "ea-module-container";
      container.style.cssText = "max-width:1400px;margin:0 auto;padding:20px;animation:eaFadeIn .3s ease";

      mainContent.querySelectorAll(":scope > *").forEach(function (el) {
        el.style.display = "none";
      });
      mainContent.appendChild(container);
    }

    var orderId = getOrderIdFromHash();
    container.innerHTML = renderSkeleton();

    if (orderId) {
      var order = await fetchOrderDetail(orderId);
      container.innerHTML = renderDetailView(order);
      if (order && order.customer_email) {
        fetchClientPurchases(order.customer_email).then(function(purchaseData) {
          var productsDiv = document.getElementById("ea-client-products");
          if (productsDiv && purchaseData && ((purchaseData.plans && purchaseData.plans.length > 0) || (purchaseData.links && purchaseData.links.length > 0))) {
            productsDiv.innerHTML = renderProductsSection(purchaseData);
          }
        });
      }
    } else {
      var orders = await fetchOrders();
      container.innerHTML = renderListView(orders);
    }

    attachListeners(container);
    updateSidebarActive();
  }

  function hideModule() {
    moduleHidden = true;
    var container = document.getElementById("ea-module-container");
    var mainContent = document.querySelector("main");
    if (container) {
      container.remove();
    }
    if (mainContent) {
      mainContent.querySelectorAll(":scope > *").forEach(function (el) {
        if (el.style.display === "none") {
          el.style.display = "";
        }
      });
    }
    if (window.location.hash === "#expedientes" || window.location.hash.startsWith("#expedientes/")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    currentOrderData = null;
    currentLinks = [];
    updateSidebarActive();
    setTimeout(function () {
      if (mainContent && mainContent.children.length === 0) {
        window.location.reload();
      }
    }, 500);
  }

  function addStyles() {
    if (document.getElementById("ea-styles")) return;
    var style = document.createElement("style");
    style.id = "ea-styles";
    style.textContent =
      "@keyframes eaFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes eaSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes eaPulse{0%,100%{opacity:1}50%{opacity:.5}}" +
      "@keyframes eaSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}" +
      ".ea-spin{animation:eaSpin 1s linear infinite}" +
      "#ea-module-container input:focus,#ea-module-container select:focus,#ea-module-container textarea:focus{border-color:#0891b2!important;box-shadow:0 0 0 3px rgba(8,145,178,.12)!important}" +
      ".ea-link-row:hover{background:#f0f9ff!important}" +
      ".ea-link-row:hover .ea-drag-handle{opacity:1!important}" +
      ".ea-link-row:hover img{border-color:#0891b2!important;box-shadow:0 4px 12px rgba(8,145,178,.15)!important}" +
      ".ea-img-preview:hover{transform:scale(1.05)}" +
      ".ea-link-row.ea-dragging{opacity:.4;box-shadow:0 8px 24px rgba(0,0,0,.12)}" +
      ".ea-drag-handle:active{cursor:grabbing!important}" +
      ".ea-open-url:hover,.ea-copy-url:hover{background:#e2e8f0!important;color:#1e293b!important}" +
      ".ea-delete-link:hover{background:#fee2e2!important}" +
      "#ea-add-link:hover{background:#0891b2!important;color:#fff!important}" +
      "@media(max-width:768px){#ea-module-container table{font-size:12px}#ea-module-container th,#ea-module-container td{padding:4px 3px!important}#ea-filters{grid-template-columns:1fr 1fr!important}}";
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    injectSidebarItem();

    if (isExpedientesPage()) {
      setTimeout(renderModule, 300);
    }

    window.addEventListener("hashchange", function () {
      if (isExpedientesPage()) {
        moduleHidden = false;
        renderModule();
      } else {
        hideModule();
      }
    });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("button, a");
      if (btn && btn.id !== "sidebar-expedientes-admin" && e.target.closest("aside")) {
        hideModule();
      }
    }, true);

    var mainEl = document.querySelector("main");
    if (mainEl) {
      var observer = new MutationObserver(function () {
        if (!document.getElementById("sidebar-expedientes-admin")) {
          injectSidebarItem();
        }
        if (isExpedientesPage() && !moduleHidden && !document.getElementById("ea-module-container")) {
          renderModule();
        }
      });
      observer.observe(mainEl, { childList: true, subtree: false });
    }

    setInterval(function () {
      if (!document.getElementById("sidebar-expedientes-admin")) {
        injectSidebarItem();
      }
    }, 3000);
  }

  function startWhenReady() {
    var aside = document.querySelector("aside");
    if (aside && aside.querySelector("nav")) {
      init();
    } else {
      setTimeout(startWhenReady, 500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(startWhenReady, 1000);
    });
  } else {
    setTimeout(startWhenReady, 1000);
  }
})();
