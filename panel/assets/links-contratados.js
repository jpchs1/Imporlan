/**
 * Links Contratados / Mis Expedientes - Imporlan Panel Cliente
 * Standalone JS module for displaying user's contracted expedition links
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/test/")
    ? "/test/api"
    : window.location.pathname.includes("/panel-test")
      ? "/test/api"
      : "/api";

  const PANEL_BASE = window.location.pathname.includes("/panel-test")
    ? "/panel-test"
    : "/panel";

  const STATUS_COLORS = {
    new: { bg: "#3b82f6", text: "#ffffff", label: "Nuevo" },
    pending_admin_fill: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    in_progress: { bg: "#10b981", text: "#ffffff", label: "En Proceso" },
    completed: { bg: "#6366f1", text: "#ffffff", label: "Completado" },
    expired: { bg: "#ef4444", text: "#ffffff", label: "Vencido" },
    canceled: { bg: "#64748b", text: "#ffffff", label: "Cancelado" },
  };

  let currentView = "list";
  let currentOrderId = null;

  function getUserData() {
    try {
      const raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      const raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
    } catch (e) {}
    return null;
  }

  function getUserEmail() {
    const u = getUserData();
    return u ? u.email || u.user_email || "" : "";
  }

  function getUserId() {
    const u = getUserData();
    return u ? u.id || u.uid || u.user_id || "" : "";
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatCurrency(amount, currency) {
    if (amount === null || amount === undefined || amount === "") return "-";
    const num = parseFloat(amount);
    if (isNaN(num)) return "-";
    if (currency === "USD") {
      return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " USD";
    }
    return "$" + num.toLocaleString("es-CL") + " CLP";
  }

  function truncateUrl(url, max) {
    if (!url) return "";
    max = max || 40;
    if (url.length <= max) return url;
    return url.substring(0, max) + "...";
  }

  function getStatusBadge(status) {
    const s = STATUS_COLORS[status] || STATUS_COLORS["new"];
    return '<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ";color:" + s.text + '">' + escapeHtml(s.label) + "</span>";
  }

  function isLinksPage() {
    var hash = window.location.hash;
    return hash === "#links-contratados" || hash.startsWith("#links-contratados/");
  }

  function getOrderIdFromHash() {
    var hash = window.location.hash;
    var match = hash.match(/#links-contratados\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  function injectSidebarItem() {
    var checkCount = 0;
    var maxChecks = 40;

    function tryInject() {
      checkCount++;
      if (checkCount > maxChecks) return;

      var nav = document.querySelector("nav");
      if (!nav) {
        setTimeout(tryInject, 500);
        return;
      }

      if (document.getElementById("sidebar-links-contratados")) return;

      var navLinks = nav.querySelectorAll("a, button");
      var refItem = null;
      navLinks.forEach(function (el) {
        var text = el.textContent.trim().toLowerCase();
        if (
          text.includes("producto") ||
          text.includes("servicio") ||
          text.includes("mis producto") ||
          text.includes("importaciones") ||
          text.includes("soporte")
        ) {
          refItem = el;
        }
      });

      if (!refItem && navLinks.length > 0) {
        refItem = navLinks[navLinks.length - 1];
      }

      if (!refItem) {
        setTimeout(tryInject, 500);
        return;
      }

      var sidebarItem = document.createElement("a");
      sidebarItem.id = "sidebar-links-contratados";
      sidebarItem.href = "#links-contratados";
      sidebarItem.style.cssText = refItem.style.cssText || "";

      var classes = refItem.className;
      if (classes) {
        sidebarItem.className = classes.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400/g, "");
      }

      sidebarItem.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-right:12px"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>' +
        '<span>Mis Expedientes</span>';

      sidebarItem.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.hash = "#links-contratados";
      });

      if (refItem.parentNode) {
        refItem.parentNode.insertBefore(sidebarItem, refItem.nextSibling);
      }

      updateSidebarActive();
    }

    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-links-contratados");
    if (!item) return;

    if (isLinksPage()) {
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

  async function fetchOrders() {
    var email = getUserEmail();
    var userId = getUserId();
    if (!email && !userId) return [];

    try {
      var params = email ? "user_email=" + encodeURIComponent(email) : "user_id=" + encodeURIComponent(userId);
      var resp = await fetch(API_BASE + "/orders_api.php?action=user_list&" + params);
      var data = await resp.json();
      return data.success ? data.orders || [] : [];
    } catch (e) {
      console.error("Error fetching orders:", e);
      return [];
    }
  }

  async function fetchOrderDetail(orderId) {
    var email = getUserEmail();
    var userId = getUserId();

    try {
      var params = "id=" + orderId;
      if (email) params += "&user_email=" + encodeURIComponent(email);
      else if (userId) params += "&user_id=" + encodeURIComponent(userId);
      var resp = await fetch(API_BASE + "/orders_api.php?action=user_detail&" + params);
      var data = await resp.json();
      return data.success ? data.order : null;
    } catch (e) {
      console.error("Error fetching order detail:", e);
      return null;
    }
  }

  function renderListView(orders) {
    var rows = "";
    if (orders.length === 0) {
      rows =
        '<tr><td colspan="6" style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:15px">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>' +
        "No tienes expedientes de busqueda aun</td></tr>";
    } else {
      orders.forEach(function (o) {
        rows +=
          "<tr style=\"border-bottom:1px solid #e2e8f0;transition:background .15s\" onmouseover=\"this.style.background='#f8fafc'\" onmouseout=\"this.style.background='transparent'\">" +
          '<td style="padding:14px 16px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:rgba(0,212,255,0.1);color:#0891b2;font-size:13px;font-weight:600">' +
          escapeHtml(o.order_number) +
          "</span></td>" +
          '<td style="padding:14px 16px;font-size:14px;color:#334155">' +
          escapeHtml(o.plan_name || "-") +
          "</td>" +
          '<td style="padding:14px 16px;font-size:14px;color:#334155">' +
          escapeHtml(o.asset_name || "-") +
          "</td>" +
          '<td style="padding:14px 16px">' +
          getStatusBadge(o.status) +
          "</td>" +
          '<td style="padding:14px 16px;font-size:13px;color:#64748b">' +
          formatDate(o.created_at) +
          "</td>" +
          '<td style="padding:14px 16px"><button class="lc-btn-detail" data-id="' +
          o.id +
          '" style="padding:6px 16px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s" onmouseover="this.style.background=\'#0891b2\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'#0891b2\'">Ver Detalle</button></td>' +
          "</tr>";
      });
    }

    return (
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;display:flex;align-items:center;justify-content:center">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:20px;font-weight:700;margin:0">Mis Expedientes de Busqueda</h2>' +
      '<p style="color:#94a3b8;font-size:13px;margin:4px 0 0">Expedientes y links de embarcaciones contratados</p></div></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      "<thead><tr>" +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Pedido N°</th>' +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Plan/Servicio</th>' +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Objetivo</th>' +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Estado</th>' +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Fecha</th>' +
      '<th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(to right,#f8fafc,#f1f5f9)">Accion</th>' +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div></div>"
    );
  }

  function renderDetailView(order) {
    if (!order) {
      return (
        '<div style="text-align:center;padding:60px 20px;color:#94a3b8">' +
        "<p>Expediente no encontrado</p>" +
        '<button class="lc-btn-back" style="margin-top:16px;padding:8px 20px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;cursor:pointer;font-size:14px">Volver al listado</button></div>'
      );
    }

    var linksHtml = "";
    var links = order.links || [];
    if (links.length === 0) {
      linksHtml = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;font-size:14px">No hay links registrados aun</td></tr>';
    } else {
      links.forEach(function (lk, idx) {
        var urlCell = "";
        if (lk.url) {
          urlCell =
            '<div style="display:flex;align-items:center;gap:6px">' +
            '<a href="' +
            escapeHtml(lk.url) +
            '" target="_blank" rel="noopener" style="color:#0891b2;text-decoration:none;font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block" title="' +
            escapeHtml(lk.url) +
            '">' +
            escapeHtml(truncateUrl(lk.url, 35)) +
            "</a>" +
            '<button class="lc-open-link" data-url="' +
            escapeHtml(lk.url) +
            '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px" title="Abrir en nueva pestana">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
            '<button class="lc-copy-link" data-url="' +
            escapeHtml(lk.url) +
            '" style="border:none;background:none;cursor:pointer;color:#64748b;padding:2px" title="Copiar link">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
            "</div>";
        } else {
          urlCell = '<span style="color:#cbd5e1;font-size:13px">-</span>';
        }

        linksHtml +=
          "<tr style=\"border-bottom:1px solid #f1f5f9;transition:background .15s\" onmouseover=\"this.style.background='#f8fafc'\" onmouseout=\"this.style.background='transparent'\">" +
          '<td style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;font-weight:600">' +
          (idx + 1) +
          "</td>" +
          '<td style="padding:10px 12px">' +
          urlCell +
          "</td>" +
          '<td style="padding:10px 12px;text-align:right;font-size:13px;color:#334155;font-family:monospace">' +
          formatCurrency(lk.value_usa_usd, "USD") +
          "</td>" +
          '<td style="padding:10px 12px;text-align:right;font-size:13px;color:#334155;font-family:monospace">' +
          formatCurrency(lk.value_to_negotiate_usd, "USD") +
          "</td>" +
          '<td style="padding:10px 12px;text-align:right;font-size:13px;color:#334155;font-family:monospace">' +
          formatCurrency(lk.value_chile_clp, "CLP") +
          "</td>" +
          '<td style="padding:10px 12px;text-align:right;font-size:13px;color:#334155;font-family:monospace">' +
          formatCurrency(lk.value_chile_negotiated_clp, "CLP") +
          "</td>" +
          '<td style="padding:10px 12px;text-align:center;font-size:13px;color:#334155">' +
          (lk.selection_order || "-") +
          "</td>" +
          '<td style="padding:10px 12px;font-size:13px;color:#64748b;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' +
          escapeHtml(lk.comments || "") +
          '">' +
          escapeHtml(lk.comments || "-") +
          "</td></tr>";
      });
    }

    var agentHtml = "";
    if (order.agent_name) {
      agentHtml =
        '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:10px 14px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '<span style="font-size:13px;color:#0c4a6e;font-weight:500">' +
        escapeHtml(order.agent_name) +
        "</span>" +
        (order.agent_phone
          ? '<span style="font-size:13px;color:#0891b2;margin-left:8px">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ' +
            escapeHtml(order.agent_phone) +
            "</span>"
          : "") +
        "</div>";
    }

    return (
      '<div style="margin-bottom:20px">' +
      '<button class="lc-btn-back" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'#0891b2\';this.style.color=\'#0891b2\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Volver</button></div>' +
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div><h2 style="color:#fff;font-size:20px;font-weight:700;margin:0">Expediente ' +
      escapeHtml(order.order_number) +
      "</h2>" +
      '<p style="color:#94a3b8;font-size:13px;margin:4px 0 0">' +
      escapeHtml(order.customer_name) +
      " - " +
      formatDate(order.created_at) +
      "</p></div>" +
      '<div style="display:flex;align-items:center;gap:12px">' +
      getStatusBadge(order.status) +
      "</div></div></div>" +
      '<div style="padding:20px 28px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">' +
      '<div><p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Plan</p><p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:500">' +
      escapeHtml(order.plan_name || "-") +
      "</p></div>" +
      '<div><p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Objetivo</p><p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:500">' +
      escapeHtml(order.asset_name || "-") +
      "</p></div>" +
      '<div><p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Zona/Tipo</p><p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:500">' +
      escapeHtml(order.type_zone || "-") +
      "</p></div>" +
      '<div><p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Requerimiento</p><p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:500">' +
      escapeHtml(order.requirement_name || "-") +
      "</p></div></div>" +
      agentHtml +
      "</div></div>" +
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="padding:16px 28px;background:linear-gradient(to right,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '<h3 style="margin:0;font-size:16px;font-weight:600;color:#1e293b">Links Opciones en USA</h3></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      "<thead><tr>" +
      '<th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc;width:40px">#</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc;min-width:200px">Link Opcion (USA)</th>' +
      '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">Valor USA (USD)</th>' +
      '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">Valor a Negociar (USD)</th>' +
      '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">Valor Chile (CLP)</th>' +
      '<th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">Valor Negociado (CLP)</th>' +
      '<th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">N° Seleccion</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc">Comentarios</th>' +
      "</tr></thead><tbody>" +
      linksHtml +
      "</tbody></table></div></div>"
    );
  }

  function attachListeners(container) {
    container.querySelectorAll(".lc-btn-detail").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-id");
        window.location.hash = "#links-contratados/" + id;
      });
    });

    container.querySelectorAll(".lc-btn-back").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = "#links-contratados";
      });
    });

    container.querySelectorAll(".lc-open-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.open(this.getAttribute("data-url"), "_blank");
      });
    });

    container.querySelectorAll(".lc-copy-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var url = this.getAttribute("data-url");
        navigator.clipboard.writeText(url).then(function () {
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(function () {
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1500);
        });
      });
    });
  }

  function renderSkeleton() {
    return (
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:24px 28px">' +
      '<div style="width:250px;height:20px;background:rgba(255,255,255,.1);border-radius:4px;margin-bottom:8px"></div>' +
      '<div style="width:180px;height:14px;background:rgba(255,255,255,.07);border-radius:4px"></div></div>' +
      '<div style="padding:20px">' +
      [1, 2, 3]
        .map(function () {
          return '<div style="display:flex;gap:16px;margin-bottom:16px"><div style="flex:1;height:40px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div><div style="flex:2;height:40px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div><div style="flex:1;height:40px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div></div>';
        })
        .join("") +
      "</div></div>"
    );
  }

  async function renderModule() {
    if (!isLinksPage()) return;

    var mainContent = document.querySelector("main");
    if (!mainContent) return;

    var container = document.getElementById("lc-module-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "lc-module-container";
      container.style.cssText = "max-width:1200px;margin:0 auto;padding:20px;animation:lcFadeIn .3s ease";

      var existingContent = mainContent.querySelectorAll(":scope > *");
      existingContent.forEach(function (el) {
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
    var container = document.getElementById("lc-module-container");
    if (container) {
      container.remove();
      var mainContent = document.querySelector("main");
      if (mainContent) {
        mainContent.querySelectorAll(":scope > *").forEach(function (el) {
          el.style.display = "";
        });
      }
    }
    updateSidebarActive();
  }

  function addStyles() {
    if (document.getElementById("lc-styles")) return;
    var style = document.createElement("style");
    style.id = "lc-styles";
    style.textContent =
      "@keyframes lcFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:.5}}" +
      "@media(max-width:768px){#lc-module-container table{font-size:12px}#lc-module-container th,#lc-module-container td{padding:8px 6px!important}}";
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    injectSidebarItem();

    if (isLinksPage()) {
      setTimeout(renderModule, 300);
    }

    window.addEventListener("hashchange", function () {
      if (isLinksPage()) {
        renderModule();
      } else {
        hideModule();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 1000);
    });
  } else {
    setTimeout(init, 1000);
  }
})();
