/**
 * Expedientes Admin Module - Imporlan Admin Panel
 * Standalone JS module for managing expedition orders (admin side)
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/test/")
    ? "/test/api"
    : "/api";

  const STATUS_COLORS = {
    new: { bg: "#3b82f6", text: "#ffffff", label: "Nuevo" },
    pending_admin_fill: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente Completar" },
    in_progress: { bg: "#10b981", text: "#ffffff", label: "En Proceso" },
    completed: { bg: "#6366f1", text: "#ffffff", label: "Completado" },
    expired: { bg: "#ef4444", text: "#ffffff", label: "Vencido" },
    canceled: { bg: "#64748b", text: "#ffffff", label: "Cancelado" },
  };

  const STATUS_OPTIONS = [
    { value: "new", label: "Nuevo" },
    { value: "pending_admin_fill", label: "Pendiente Completar" },
    { value: "in_progress", label: "En Proceso" },
    { value: "completed", label: "Completado" },
    { value: "expired", label: "Vencido" },
    { value: "canceled", label: "Cancelado" },
  ];

  let currentOrderData = null;
  let currentLinks = [];
  let hasUnsavedChanges = false;

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
    return '<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ";color:" + s.text + '">' + escapeHtml(s.label) + "</span>";
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
        window.location.hash = "#expedientes";
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

  function showToast(msg, type) {
    var toast = document.createElement("div");
    var bgColor = type === "error" ? "#ef4444" : "#10b981";
    toast.style.cssText = "position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;z-index:99999;animation:eaFadeIn .3s;box-shadow:0 4px 12px rgba(0,0,0,.2);background:" + bgColor;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .3s";
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function inputStyle() {
    return "width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1e293b;background:#fff;outline:none;transition:border-color .2s;box-sizing:border-box";
  }

  function renderFilters() {
    return (
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0" id="ea-filters">' +
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
      '<button id="ea-filter-btn" style="padding:8px 16px;border-radius:8px;border:none;background:#0891b2;color:#fff;font-size:14px;font-weight:500;cursor:pointer;transition:background .2s" onmouseover="this.style.background=\'#0e7490\'" onmouseout="this.style.background=\'#0891b2\'">Filtrar</button>' +
      "</div>"
    );
  }

  function renderListView(orders) {
    var rows = "";
    if (orders.length === 0) {
      rows = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;font-size:15px">No se encontraron expedientes</td></tr>';
    } else {
      orders.forEach(function (o) {
        rows +=
          "<tr style=\"border-bottom:1px solid #e2e8f0;transition:background .15s\" onmouseover=\"this.style.background='#f8fafc'\" onmouseout=\"this.style.background='transparent'\">" +
          '<td style="padding:12px 14px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:rgba(0,212,255,0.1);color:#0891b2;font-size:13px;font-weight:600">' + escapeHtml(o.order_number) + "</span></td>" +
          '<td style="padding:12px 14px;font-size:14px;color:#334155">' + escapeHtml(o.customer_name) + '<br><span style="font-size:12px;color:#94a3b8">' + escapeHtml(o.customer_email) + "</span></td>" +
          '<td style="padding:12px 14px;font-size:14px;color:#334155">' + escapeHtml(o.plan_name || "-") + "</td>" +
          '<td style="padding:12px 14px">' + getStatusBadge(o.status) + "</td>" +
          '<td style="padding:12px 14px;font-size:13px;color:#64748b">' + formatDate(o.created_at) + "</td>" +
          '<td style="padding:12px 14px;font-size:14px;color:#334155">' + escapeHtml(o.agent_name || "-") + "</td>" +
          '<td style="padding:12px 14px"><button class="ea-btn-edit" data-id="' + o.id + '" style="padding:6px 16px;border-radius:8px;border:none;background:#0891b2;color:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:background .2s" onmouseover="this.style.background=\'#0e7490\'" onmouseout="this.style.background=\'#0891b2\'">Editar</button></td>' +
          "</tr>";
      });
    }

    return (
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;display:flex;align-items:center;justify-content:center">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:20px;font-weight:700;margin:0">Expedientes</h2>' +
      '<p style="color:#94a3b8;font-size:13px;margin:4px 0 0">Gestion de expedientes de busqueda</p></div></div>' +
      '<button id="ea-btn-create" style="padding:8px 20px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .2s" onmouseover="this.style.background=\'#059669\'" onmouseout="this.style.background=\'#10b981\'">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Expediente</button></div>' +
      renderFilters() +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      "<thead><tr>" +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Pedido N°</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Cliente</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Plan</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Estado</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Fecha</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Agente</th>' +
      '<th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Acciones</th>' +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div></div>"
    );
  }

  function renderDetailView(order) {
    if (!order) {
      return (
        '<div style="text-align:center;padding:60px;color:#94a3b8"><p>Expediente no encontrado</p>' +
        '<button class="ea-btn-back" style="margin-top:16px;padding:8px 20px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;cursor:pointer">Volver</button></div>'
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
      linksRows = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#94a3b8">No hay links. Agrega uno con el boton de abajo.</td></tr>';
    }

    return (
      '<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<button class="ea-btn-back" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'#0891b2\';this.style.color=\'#0891b2\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Volver</button>' +
      '<button id="ea-save-all" style="padding:8px 20px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .2s" onmouseover="this.style.background=\'#059669\'" onmouseout="this.style.background=\'#10b981\'">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Todo</button></div>' +
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:20px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<h2 style="color:#fff;font-size:18px;font-weight:700;margin:0">Expediente ' + escapeHtml(order.order_number) + "</h2>" +
      '<select id="ea-status-select" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:13px;font-weight:500;cursor:pointer">' + statusOptions + "</select></div>" +
      '<div style="padding:20px 28px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Cliente</label><input id="ea-f-customer_name" value="' + escapeHtml(order.customer_name || "") + '" style="' + inputStyle() + '" disabled></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Email</label><input id="ea-f-customer_email" value="' + escapeHtml(order.customer_email || "") + '" style="' + inputStyle() + '" disabled></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Telefono Cliente</label><input id="ea-f-customer_phone" value="' + escapeHtml(order.customer_phone || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Tipo Servicio</label><select id="ea-f-service_type" style="' + inputStyle() + '"><option value="plan_busqueda"' + (order.service_type === 'plan_busqueda' ? ' selected' : '') + '>Plan Busqueda</option><option value="cotizacion_link"' + (order.service_type === 'cotizacion_link' ? ' selected' : '') + '>Cotizacion Link</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Origen</label><select id="ea-f-origin" style="' + inputStyle() + '"><option value="web"' + (order.origin === 'web' ? ' selected' : '') + '>Web</option><option value="admin"' + (order.origin === 'admin' ? ' selected' : '') + '>Admin</option><option value="whatsapp"' + (order.origin === 'whatsapp' ? ' selected' : '') + '>WhatsApp</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Plan</label><input id="ea-f-plan_name" value="' + escapeHtml(order.plan_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Embarcacion/Objetivo</label><input id="ea-f-asset_name" value="' + escapeHtml(order.asset_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Tipo/Zona</label><input id="ea-f-type_zone" value="' + escapeHtml(order.type_zone || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Requerimiento</label><input id="ea-f-requirement_name" value="' + escapeHtml(order.requirement_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Agente</label><input id="ea-f-agent_name" value="' + escapeHtml(order.agent_name || "") + '" style="' + inputStyle() + '"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Telefono Agente</label><input id="ea-f-agent_phone" value="' + escapeHtml(order.agent_phone || "") + '" style="' + inputStyle() + '"></div>' +
      '<div style="grid-column:1/-1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Notas Admin (internas)</label><textarea id="ea-f-admin_notes" rows="3" style="' + inputStyle() + ';resize:vertical">' + escapeHtml(order.admin_notes || "") + '</textarea></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px"><input type="checkbox" id="ea-f-visible_to_client"' + (order.visible_to_client == 1 ? ' checked' : '') + ' style="margin-right:6px">Visible para cliente</label></div>' +
      "</div></div></div>" +
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="padding:16px 28px;background:linear-gradient(to right,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '<h3 style="margin:0;font-size:16px;font-weight:600;color:#1e293b">Links Opciones en USA</h3></div>' +
      '<button id="ea-add-link" style="padding:6px 14px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .2s" onmouseover="this.style.background=\'#0891b2\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#0891b2\'">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar Fila</button></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse" id="ea-links-table">' +
      "<thead><tr>" +
      '<th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:36px">#</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;min-width:200px">Link Opcion (USA)</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:110px">Valor USA (USD)</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:110px">Negociar (USD)</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:110px">Chile (CLP)</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:110px">Negociado (CLP)</th>' +
      '<th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:70px">N° Sel.</th>' +
      '<th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;min-width:120px">Comentarios</th>' +
      '<th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;background:#f8fafc;width:60px">Acc.</th>' +
      "</tr></thead><tbody id=\"ea-links-tbody\">" +
      linksRows +
      "</tbody></table></div></div>"
    );
  }

  function renderLinkRow(lk, idx) {
    var cellInput = "padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;color:#1e293b;width:100%;box-sizing:border-box;outline:none;background:#fff";
    return (
      '<tr data-link-id="' + (lk.id || "") + '" style="border-bottom:1px solid #f1f5f9">' +
      '<td style="padding:6px 8px;text-align:center;font-size:13px;color:#64748b;font-weight:600">' + (idx + 1) + "</td>" +
      '<td style="padding:6px 8px"><div style="display:flex;align-items:center;gap:4px"><input class="ea-link-url" value="' + escapeHtml(lk.url || "") + '" placeholder="https://..." style="' + cellInput + ';flex:1">' +
      (lk.url ? '<button class="ea-open-url" data-url="' + escapeHtml(lk.url) + '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px;flex-shrink:0" title="Abrir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
        '<button class="ea-copy-url" data-url="' + escapeHtml(lk.url) + '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px;flex-shrink:0" title="Copiar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' : "") +
      "</div></td>" +
      '<td style="padding:6px 8px"><input class="ea-link-value_usa_usd" type="number" step="0.01" value="' + (lk.value_usa_usd || "") + '" placeholder="0.00" style="' + cellInput + '"></td>' +
      '<td style="padding:6px 8px"><input class="ea-link-value_to_negotiate_usd" type="number" step="0.01" value="' + (lk.value_to_negotiate_usd || "") + '" placeholder="0.00" style="' + cellInput + '"></td>' +
      '<td style="padding:6px 8px"><input class="ea-link-value_chile_clp" type="number" step="1" value="' + (lk.value_chile_clp || "") + '" placeholder="0" style="' + cellInput + '"></td>' +
      '<td style="padding:6px 8px"><input class="ea-link-value_chile_negotiated_clp" type="number" step="1" value="' + (lk.value_chile_negotiated_clp || "") + '" placeholder="0" style="' + cellInput + '"></td>' +
      '<td style="padding:6px 8px"><input class="ea-link-selection_order" type="number" value="' + (lk.selection_order || "") + '" placeholder="-" style="' + cellInput + ';text-align:center"></td>' +
      '<td style="padding:6px 8px"><input class="ea-link-comments" value="' + escapeHtml(lk.comments || "") + '" placeholder="..." style="' + cellInput + '"></td>' +
      '<td style="padding:6px 8px;text-align:center;white-space:nowrap">' +
      '<button class="ea-move-up" data-link-id="' + (lk.id || "") + '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px" title="Subir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>' +
      '<button class="ea-move-down" data-link-id="' + (lk.id || "") + '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px" title="Bajar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>' +
      '<button class="ea-delete-link" data-link-id="' + (lk.id || "") + '" style="border:none;background:none;cursor:pointer;color:#ef4444;padding:2px" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>' +
      "</tr>"
    );
  }

  function renderCreateModal() {
    return (
      '<div id="ea-create-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;animation:eaFadeIn .2s">' +
      '<div style="background:#fff;border-radius:16px;width:90%;max-width:500px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="color:#fff;font-size:18px;font-weight:600;margin:0">Nuevo Expediente</h3>' +
      '<button id="ea-close-modal" style="border:none;background:none;color:#94a3b8;cursor:pointer;padding:4px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
      '<div style="padding:24px">' +
      '<div style="display:grid;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Email Cliente *</label><input id="ea-new-email" style="' + inputStyle() + '" placeholder="cliente@email.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Nombre Cliente *</label><input id="ea-new-name" style="' + inputStyle() + '" placeholder="Nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Telefono Cliente</label><input id="ea-new-phone" style="' + inputStyle() + '" placeholder="+56 9 1234 5678"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Tipo Servicio</label><select id="ea-new-service-type" style="' + inputStyle() + '"><option value="plan_busqueda">Plan Busqueda</option><option value="cotizacion_link">Cotizacion Link</option></select></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Plan</label><input id="ea-new-plan" style="' + inputStyle() + '" placeholder="Plan Fragata, etc."></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Embarcacion/Objetivo</label><input id="ea-new-asset" style="' + inputStyle() + '" placeholder="Tipo de embarcacion"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px">Zona/Tipo</label><input id="ea-new-zone" style="' + inputStyle() + '" placeholder="Costa Este USA, etc."></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">' +
      '<button id="ea-cancel-create" style="padding:8px 20px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:14px;cursor:pointer">Cancelar</button>' +
      '<button id="ea-submit-create" style="padding:8px 20px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:500;cursor:pointer">Crear Expediente</button>' +
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
        value_usa_usd: parseFloat((row.querySelector(".ea-link-value_usa_usd") || {}).value) || null,
        value_to_negotiate_usd: parseFloat((row.querySelector(".ea-link-value_to_negotiate_usd") || {}).value) || null,
        value_chile_clp: parseInt((row.querySelector(".ea-link-value_chile_clp") || {}).value) || null,
        value_chile_negotiated_clp: parseInt((row.querySelector(".ea-link-value_chile_negotiated_clp") || {}).value) || null,
        selection_order: parseInt((row.querySelector(".ea-link-selection_order") || {}).value) || null,
        comments: (row.querySelector(".ea-link-comments") || {}).value || null,
      });
    });
    return links;
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

  function attachListeners(container) {
    container.querySelectorAll(".ea-btn-edit").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = "#expedientes/" + this.getAttribute("data-id");
      });
    });

    container.querySelectorAll(".ea-btn-back").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = "#expedientes";
      });
    });

    container.querySelectorAll(".ea-open-url").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.open(this.getAttribute("data-url"), "_blank");
      });
    });

    container.querySelectorAll(".ea-copy-url").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = this.getAttribute("data-url");
        navigator.clipboard.writeText(url);
        showToast("Link copiado", "success");
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
            origin: "admin",
          });
          if (result.success) {
            modal.remove();
            showToast("Expediente creado: " + result.order_number, "success");
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
        saveAllBtn.textContent = "Guardando...";

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
        } else {
          showToast((r1.error || "") + " " + (r2.error || ""), "error");
        }

        saveAllBtn.disabled = false;
        saveAllBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Todo';
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
            attachListeners(container);
          }
          showToast("Fila agregada", "success");
        } else {
          showToast(result.error || "Error al agregar fila", "error");
        }
      });
    }

    container.querySelectorAll(".ea-delete-link").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var linkId = parseInt(this.getAttribute("data-link-id"));
        if (!linkId || !currentOrderData) return;
        if (!confirm("Eliminar esta fila de link?")) return;
        var result = await deleteLink(currentOrderData.id, linkId);
        if (result.success) {
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

    container.querySelectorAll(".ea-move-up").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = this.closest("tr");
        var prev = row.previousElementSibling;
        if (prev) {
          row.parentNode.insertBefore(row, prev);
          renumberRows();
          hasUnsavedChanges = true;
        }
      });
    });

    container.querySelectorAll(".ea-move-down").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = this.closest("tr");
        var next = row.nextElementSibling;
        if (next) {
          row.parentNode.insertBefore(next, row);
          renumberRows();
          hasUnsavedChanges = true;
        }
      });
    });
  }

  function renumberRows() {
    var tbody = document.getElementById("ea-links-tbody");
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr[data-link-id]");
    rows.forEach(function (row, idx) {
      var numCell = row.querySelector("td:first-child");
      if (numCell) numCell.textContent = idx + 1;
    });
  }

  function renderSkeleton() {
    return (
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:24px 28px">' +
      '<div style="width:200px;height:20px;background:rgba(255,255,255,.1);border-radius:4px;margin-bottom:8px"></div>' +
      '<div style="width:150px;height:14px;background:rgba(255,255,255,.07);border-radius:4px"></div></div>' +
      '<div style="padding:20px">' +
      [1, 2, 3, 4].map(function () {
        return '<div style="display:flex;gap:12px;margin-bottom:14px"><div style="flex:1;height:36px;background:#f1f5f9;border-radius:8px;animation:eaPulse 1.5s infinite"></div><div style="flex:2;height:36px;background:#f1f5f9;border-radius:8px;animation:eaPulse 1.5s infinite"></div><div style="flex:1;height:36px;background:#f1f5f9;border-radius:8px;animation:eaPulse 1.5s infinite"></div></div>';
      }).join("") +
      "</div></div>"
    );
  }

  async function renderModule() {
    if (!isExpedientesPage()) return;

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
    } else {
      var orders = await fetchOrders();
      container.innerHTML = renderListView(orders);
    }

    attachListeners(container);
    updateSidebarActive();
  }

  function hideModule() {
    var container = document.getElementById("ea-module-container");
    if (container) {
      container.remove();
      var mainContent = document.querySelector("main");
      if (mainContent) {
        mainContent.querySelectorAll(":scope > *").forEach(function (el) {
          el.style.display = "";
        });
      }
    }
    currentOrderData = null;
    currentLinks = [];
    updateSidebarActive();
  }

  function addStyles() {
    if (document.getElementById("ea-styles")) return;
    var style = document.createElement("style");
    style.id = "ea-styles";
    style.textContent =
      "@keyframes eaFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes eaPulse{0%,100%{opacity:1}50%{opacity:.5}}" +
      "#ea-module-container input:focus,#ea-module-container select:focus{border-color:#0891b2;box-shadow:0 0 0 2px rgba(8,145,178,.15)}" +
      "@media(max-width:768px){#ea-module-container table{font-size:12px}#ea-module-container th,#ea-module-container td{padding:6px 4px!important}#ea-filters{grid-template-columns:1fr 1fr!important}}";
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
        renderModule();
      } else {
        hideModule();
      }
    });

    var mainEl = document.querySelector("main");
    if (mainEl) {
      var observer = new MutationObserver(function () {
        if (!document.getElementById("sidebar-expedientes-admin")) {
          injectSidebarItem();
        }
        if (isExpedientesPage() && !document.getElementById("ea-module-container")) {
          renderModule();
        }
      });
      observer.observe(mainEl, { childList: true, subtree: false });
    }
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
