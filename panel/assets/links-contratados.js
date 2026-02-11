/**
 * Mis Productos Contratados - Unified Module
 * Combines Products + Expedientes into React's #myproducts route
 * No sidebar injection - hooks directly into existing React menu item
 */
(function () {
  "use strict";

  const API_BASE = "/api";

  const STATUS_COLORS = {
    new: { bg: "#3b82f6", text: "#ffffff", label: "Nuevo" },
    pending_admin_fill: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    in_progress: { bg: "#10b981", text: "#ffffff", label: "En Proceso" },
    completed: { bg: "#6366f1", text: "#ffffff", label: "Completado" },
    expired: { bg: "#ef4444", text: "#ffffff", label: "Vencido" },
    canceled: { bg: "#64748b", text: "#ffffff", label: "Cancelado" },
    active: { bg: "#10b981", text: "#ffffff", label: "Activo" },
    en_revision: { bg: "#f59e0b", text: "#ffffff", label: "En Revision" },
    pending: { bg: "#6366f1", text: "#ffffff", label: "Pendiente" },
  };

  var isRendering = false;
  var moduleHidden = false;
  var dragSrcEl = null;
  var plans = [];
  var linksApproved = [];
  var linksReview = [];

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
  function getUserId() { var u = getUserData(); return u ? u.id || u.uid || u.user_id || "" : ""; }

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
    if (amount === null || amount === undefined || amount === "") return null;
    var num = parseFloat(amount);
    if (isNaN(num)) return null;
    if (currency === "USD") return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return "$" + num.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatCurrencyCLP(amount) {
    if (!amount && amount !== 0) return "$0";
    var num = parseInt(amount);
    if (isNaN(num)) return "$0";
    return "$" + num.toLocaleString("es-CL");
  }

  function truncateUrl(url, max) {
    if (!url) return "";
    max = max || 45;
    try { var u = new URL(url); var display = u.hostname + u.pathname; return display.length > max ? display.substring(0, max) + "..." : display; }
    catch (e) { return url.length <= max ? url : url.substring(0, max) + "..."; }
  }

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["new"];
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ';color:' + s.text + ';letter-spacing:.02em"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + '</span>';
  }

  function showToast(msg, type) {
    var toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981") + ";animation:lcSlideUp .3s ease";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; setTimeout(function () { toast.remove(); }, 300); }, 2500);
  }

  /* ── Page detection by DOM content (not hash) ── */
  function isProductsPage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var headings = main.querySelectorAll("h1, h2, h3");
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim();
      if (t === "Mis Productos Contratados") return true;
    }
    return false;
  }
  function getDetailId() {
    return null;
  }

  /* ── Data fetching ── */
  async function fetchOrders() {
    var email = getUserEmail(); var userId = getUserId();
    if (!email && !userId) return [];
    try {
      var params = email ? "user_email=" + encodeURIComponent(email) : "user_id=" + encodeURIComponent(userId);
      var resp = await fetch(API_BASE + "/orders_api.php?action=user_list&" + params);
      var data = await resp.json();
      return data.success ? data.orders || [] : [];
    } catch (e) { console.error("Error fetching orders:", e); return []; }
  }

  async function fetchOrderDetail(orderId) {
    var email = getUserEmail(); var userId = getUserId();
    try {
      var params = "id=" + orderId;
      if (email) params += "&user_email=" + encodeURIComponent(email);
      else if (userId) params += "&user_id=" + encodeURIComponent(userId);
      var resp = await fetch(API_BASE + "/orders_api.php?action=user_detail&" + params);
      var data = await resp.json();
      return data.success ? data.order : null;
    } catch (e) { console.error("Error fetching order detail:", e); return null; }
  }

  async function fetchPurchases() {
    var email = getUserEmail();
    if (!email) return;
    try {
      var resp = await fetch(API_BASE + "/purchases.php?action=get&user_email=" + encodeURIComponent(email));
      var data = await resp.json();
      if (data.success) {
        plans = (data.plans || []).filter(function (p) { return p.status === "active"; });
        linksApproved = (data.links || []).filter(function (l) { return l.status === "active"; });
        linksReview = (data.links || []).filter(function (l) { return l.status === "en_revision" || l.status === "pending"; });
      }
    } catch (e) { console.error("Error fetching purchases:", e); }
  }

  /* ── Products rendering (from mis-productos) ── */
  function renderPlanCard(plan) {
    var progressPct = plan.proposalsTotal > 0 ? Math.round((plan.proposalsReceived / plan.proposalsTotal) * 100) : 0;
    return '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;transition:all .2s">' +
      '<div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);padding:20px 24px;border-bottom:1px solid #e2e8f0">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a">' + escapeHtml(plan.planName) + '</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#64748b">Contratado: ' + escapeHtml(plan.startDate) + '</p></div></div>' +
      getStatusBadge(plan.status) + '</div></div>' +
      '<div style="padding:20px 24px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div style="background:#f8fafc;border-radius:10px;padding:14px"><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Monto</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0891b2">' + formatCurrencyCLP(plan.price) + ' CLP</p></div>' +
      '<div style="background:#f8fafc;border-radius:10px;padding:14px"><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Vigencia</p><p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0f172a">' + (plan.days || 30) + ' dias</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Hasta: ' + escapeHtml(plan.endDate || "N/A") + '</p></div></div>' +
      '<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:#64748b">Propuestas recibidas</span><span style="font-size:12px;font-weight:600;color:#0891b2">' + (plan.proposalsReceived || 0) + ' / ' + (plan.proposalsTotal || 0) + '</span></div>' +
      '<div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + progressPct + '%;background:linear-gradient(90deg,#0891b2,#06b6d4);border-radius:3px;transition:width .3s"></div></div></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:#64748b">Metodo:</span><span style="font-size:12px;font-weight:600;color:#0f172a;text-transform:capitalize">' + escapeHtml(plan.payment_method || "N/A") + '</span></div>' +
      '</div></div>';
  }

  function renderProductLinkCard(link) {
    var urlDisplay = truncateUrl(link.url, 50);
    return '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;transition:all .2s">' +
      '<div style="padding:20px 24px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
      '<div style="width:36px;height:36px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
      '<h3 style="margin:0;font-size:14px;font-weight:600;color:#0f172a">' + escapeHtml(link.title || "Cotizacion Online") + '</h3>' +
      getStatusBadge(link.status) + '</div>' +
      (link.url ? '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#3b82f6;text-decoration:none;word-break:break-all;padding:6px 10px;background:#eff6ff;border-radius:6px;margin-bottom:10px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' + escapeHtml(urlDisplay) + '</a>' : '') +
      '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:12px;border-top:1px solid #f1f5f9">' +
      '<div><p style="margin:0;font-size:11px;color:#64748b">Monto</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0891b2">' + formatCurrencyCLP(link.price) + ' CLP</p></div>' +
      '<div><p style="margin:0;font-size:11px;color:#64748b">Contratado</p><p style="margin:2px 0 0;font-size:13px;font-weight:500;color:#0f172a">' + escapeHtml(link.contractedAt || "N/A") + '</p></div>' +
      '<div><p style="margin:0;font-size:11px;color:#64748b">Metodo</p><p style="margin:2px 0 0;font-size:13px;font-weight:500;color:#0f172a;text-transform:capitalize">' + escapeHtml(link.payment_method || "N/A") + '</p></div>' +
      '</div></div></div>';
  }

  function renderProductsSection() {
    var hasPlans = plans.length > 0;
    var hasLinks = linksApproved.length > 0 || linksReview.length > 0;
    if (!hasPlans && !hasLinks) {
      return '<div style="text-align:center;padding:32px 20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 12px;display:block"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>' +
        '<p style="color:#64748b;font-size:14px;margin:0">Aun no tienes productos contratados</p></div>';
    }
    var html = '';
    if (hasPlans) {
      html += '<div style="display:grid;gap:16px">' + plans.map(renderPlanCard).join("") + '</div>';
    }
    if (linksApproved.length > 0) {
      html += '<div style="margin-top:' + (hasPlans ? '20px' : '0') + '">';
      html += '<h4 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#475569;display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Links Aprobados (' + linksApproved.length + ')</h4>';
      html += '<div style="display:grid;gap:12px">' + linksApproved.map(renderProductLinkCard).join("") + '</div></div>';
    }
    if (linksReview.length > 0) {
      html += '<div style="margin-top:20px">';
      html += '<h4 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#475569;display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>En Revision (' + linksReview.length + ')</h4>';
      html += '<div style="display:grid;gap:12px">' + linksReview.map(renderProductLinkCard).join("") + '</div></div>';
    }
    return html;
  }

  /* ── Expedientes rendering ── */
  function renderExpedientesSection(orders) {
    if (orders.length === 0) {
      return '<div style="text-align:center;padding:32px 20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>' +
        '<p style="color:#64748b;font-size:14px;margin:0">Aun no tienes expedientes de busqueda</p></div>';
    }
    var cards = '';
    orders.forEach(function (o) {
      var si = STATUS_COLORS[o.status] || STATUS_COLORS["new"];
      cards += '<div class="lc-order-card" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px 24px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden" data-id="' + o.id + '">' +
        '<div style="position:absolute;top:0;left:0;bottom:0;width:4px;background:' + si.bg + ';border-radius:4px 0 0 4px"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0">' +
        '<div style="flex-shrink:0;width:48px;height:48px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg></div>' +
        '<div style="min-width:0"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:15px;font-weight:700;color:#0891b2">' + escapeHtml(o.order_number) + '</span>' + getStatusBadge(o.status) + '</div>' +
        '<p style="margin:4px 0 0;font-size:14px;color:#475569;font-weight:500">' + escapeHtml(o.plan_name || "Plan de Busqueda") + '</p>' +
        (o.asset_name ? '<p style="margin:2px 0 0;font-size:13px;color:#94a3b8">' + escapeHtml(o.asset_name) + '</p>' : '') +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:16px;flex-shrink:0"><span style="font-size:13px;color:#94a3b8">' + formatDate(o.created_at) + '</span>' +
        '<button class="lc-btn-detail" data-id="' + o.id + '" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(8,145,178,.25)">Ver Detalle</button></div></div></div>';
    });
    return '<div style="display:flex;flex-direction:column;gap:12px">' + cards + '</div>';
  }

  /* ── Unified main view ── */
  function renderUnifiedView(orders) {
    var productsHtml = renderProductsSection();
    var expedientesHtml = renderExpedientesSection(orders);

    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:28px 32px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(8,145,178,.15);border-radius:50%"></div>' +
      '<div style="display:flex;align-items:center;gap:16px;position:relative">' +
      '<div style="width:52px;height:52px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(8,145,178,.3)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Mis Productos Contratados</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">Tus planes, links y expedientes de busqueda</p></div></div></div>' +
      '<div style="padding:24px 28px">' +

      '<div style="margin-bottom:28px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
      '<div style="width:32px;height:32px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></div>' +
      '<h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Productos y Planes</h3>' +
      '<span style="background:#e0f2fe;color:#0891b2;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">' + (plans.length + linksApproved.length + linksReview.length) + '</span>' +
      '</div>' +
      productsHtml +
      '</div>' +

      '<div style="border-top:2px solid #f1f5f9;padding-top:28px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
      '<div style="width:32px;height:32px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg></div>' +
      '<h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Mis Expedientes</h3>' +
      '<span style="background:#ccfbf1;color:#0d9488;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">' + orders.length + '</span>' +
      '</div>' +
      expedientesHtml +
      '</div>' +

      '</div></div>';
  }

  /* ── Vessel card (for detail view) ── */
  function renderVesselCard(lk, idx) {
    var hasData = lk.url || lk.image_url || lk.value_usa_usd || lk.value_chile_clp;
    if (!hasData) return "";

    var imgHtml = '';
    if (lk.image_url) {
      imgHtml = '<div class="lc-img-preview" style="flex-shrink:0;width:160px;height:120px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer" data-url="' + escapeHtml(lk.image_url) + '">' +
        '<img src="' + escapeHtml(lk.image_url) + '" style="width:100%;height:100%;object-fit:cover;transition:transform .3s" onerror="this.style.display=\'none\'">' +
        '<div class="lc-card-number" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);border-radius:6px;padding:2px 8px;font-size:11px;color:#fff;font-weight:600">#' + (idx + 1) + '</div></div>';
    } else {
      imgHtml = '<div class="lc-img-preview" style="flex-shrink:0;width:160px;height:120px;border-radius:12px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;position:relative">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>' +
        '<div class="lc-card-number" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.3);border-radius:6px;padding:2px 8px;font-size:11px;color:#fff;font-weight:600">#' + (idx + 1) + '</div></div>';
    }

    var locationHoursHtml = '';
    if (lk.location || lk.hours) {
      locationHoursHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">';
      if (lk.location) locationHoursHtml += '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span style="font-size:12px;color:#15803d;font-weight:500">' + escapeHtml(lk.location) + '</span></div>';
      if (lk.hours) locationHoursHtml += '<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#fef9c3;border:1px solid #fde047;border-radius:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span style="font-size:12px;color:#a16207;font-weight:500">' + escapeHtml(lk.hours) + ' hrs</span></div>';
      locationHoursHtml += '</div>';
    }

    var valuesHtml = '';
    var vU = formatCurrency(lk.value_usa_usd, "USD"); var vN = formatCurrency(lk.value_to_negotiate_usd, "USD");
    var vC = formatCurrency(lk.value_chile_clp, "CLP"); var vCN = formatCurrency(lk.value_chile_negotiated_clp, "CLP");
    if (vU || vN || vC || vCN) {
      valuesHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">';
      if (vU) valuesHtml += '<div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;border-radius:8px;padding:6px 12px"><span style="font-size:10px;color:#059669;font-weight:600;text-transform:uppercase;letter-spacing:.05em;display:block">USA</span><span style="font-size:14px;color:#047857;font-weight:700">' + vU + '</span></div>';
      if (vN) valuesHtml += '<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fcd34d;border-radius:8px;padding:6px 12px"><span style="font-size:10px;color:#b45309;font-weight:600;text-transform:uppercase;letter-spacing:.05em;display:block">Negociar</span><span style="font-size:14px;color:#92400e;font-weight:700">' + vN + '</span></div>';
      if (vC) valuesHtml += '<div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:8px;padding:6px 12px"><span style="font-size:10px;color:#2563eb;font-weight:600;text-transform:uppercase;letter-spacing:.05em;display:block">Chile CLP</span><span style="font-size:14px;color:#1d4ed8;font-weight:700">' + vC + '</span></div>';
      if (vCN) valuesHtml += '<div style="background:linear-gradient(135deg,#fdf4ff,#f5d0fe);border:1px solid #d8b4fe;border-radius:8px;padding:6px 12px"><span style="font-size:10px;color:#9333ea;font-weight:600;text-transform:uppercase;letter-spacing:.05em;display:block">Negociado CLP</span><span style="font-size:14px;color:#7e22ce;font-weight:700">' + vCN + '</span></div>';
      valuesHtml += '</div>';
    }

    var urlHtml = '';
    if (lk.url) {
      urlHtml = '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">' +
        '<a href="' + escapeHtml(lk.url) + '" target="_blank" rel="noopener" style="color:#0891b2;text-decoration:none;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(lk.url) + '">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
        escapeHtml(truncateUrl(lk.url)) + '</a>' +
        '<div style="display:flex;gap:2px">' +
        '<button class="lc-open-link" data-url="' + escapeHtml(lk.url) + '" style="border:none;background:#f1f5f9;border-radius:6px;cursor:pointer;color:#475569;padding:6px;display:flex;align-items:center" title="Abrir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>' +
        '<button class="lc-copy-link" data-url="' + escapeHtml(lk.url) + '" style="border:none;background:#f1f5f9;border-radius:6px;cursor:pointer;color:#475569;padding:6px;display:flex;align-items:center" title="Copiar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
        '<button class="lc-whatsapp-share" data-url="' + escapeHtml(lk.url) + '" style="border:none;background:#dcfce7;border-radius:6px;cursor:pointer;color:#16a34a;padding:6px;display:flex;align-items:center" title="WhatsApp"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button></div></div>';
    }

    var commentsHtml = '';
    if (lk.comments) {
      commentsHtml = '<div style="margin-top:10px;padding:8px 12px;background:#fafafa;border-radius:8px;border-left:3px solid #e2e8f0"><p style="margin:0;font-size:13px;color:#64748b;line-height:1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="vertical-align:-1px;margin-right:4px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' + escapeHtml(lk.comments) + '</p></div>';
    }

    var selOrderHtml = '';
    if (lk.selection_order !== null && lk.selection_order !== undefined && lk.selection_order !== '') {
      selOrderHtml = '<div style="position:absolute;top:12px;right:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(245,158,11,.3)" title="Orden de seleccion: ' + lk.selection_order + '">' + lk.selection_order + '</div>';
    }

    return '<div class="lc-vessel-card" draggable="true" data-link-id="' + (lk.id || "") + '" data-idx="' + idx + '" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;transition:all .25s;position:relative;box-shadow:0 1px 4px rgba(0,0,0,.04)">' +
      selOrderHtml +
      '<div class="lc-card-row" style="display:flex;gap:0">' +
      '<div class="lc-drag-handle" style="flex-shrink:0;width:32px;display:flex;align-items:center;justify-content:center;cursor:grab;background:linear-gradient(to right,#f8fafc,#f1f5f9);border-right:1px solid #e2e8f0;opacity:.6;transition:opacity .2s" title="Arrastra para reordenar"><svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></div>' +
      '<div class="lc-card-body" style="flex:1;padding:16px;display:flex;gap:16px;flex-wrap:wrap;min-width:0">' +
      imgHtml +
      '<div class="lc-card-text" style="flex:1;min-width:0">' +
      (lk.title ? '<h4 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1e293b">' + escapeHtml(lk.title) + '</h4>' : '') +
      locationHoursHtml + urlHtml + valuesHtml + commentsHtml +
      (lk.url ? '<div style="margin-top:12px"><button class="lc-inspect-btn" data-url="' + escapeHtml(lk.url) + '" data-idx="' + idx + '" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fef3c7);color:#b45309;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/><path d="M21 3v4h-4"/></svg>Solicitar Inspeccion</button></div>' : '') +
      '</div></div></div></div>';
  }

  /* ── Detail view ── */
  function renderDetailView(order) {
    if (!order) {
      return '<div style="text-align:center;padding:60px 20px;color:#94a3b8"><p style="font-size:16px">Expediente no encontrado</p>' +
        '<button class="lc-btn-back" style="margin-top:16px;padding:10px 24px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;cursor:pointer;font-size:14px;font-weight:500">Volver</button></div>';
    }

    var cardsHtml = "";
    var links = order.links || [];
    var hasAnyLink = false;
    links.forEach(function (lk, idx) {
      var card = renderVesselCard(lk, idx);
      if (card) { hasAnyLink = true; cardsHtml += card; }
    });
    if (!hasAnyLink) {
      cardsHtml = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:14px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Tu agente esta buscando las mejores opciones para ti.</div>';
    }

    var agentName = order.agent_name || "Rodrigo Calder\u00f3n";
    var agentPhone = order.agent_phone || "+56 9 40211459";
    var agentHtml = '<div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;border:1px solid #bae6fd">' +
      '<div style="width:40px;height:40px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
      '<div><p style="margin:0;font-size:14px;color:#0c4a6e;font-weight:600">' + escapeHtml(agentName) + '</p>' +
      '<p style="margin:2px 0 0;font-size:13px;color:#0891b2">' + escapeHtml(agentPhone) + '</p></div></div>';

    var infoGrid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">';
    var infoItems = [
      ["Plan", order.plan_name, "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
      ["Objetivo", order.asset_name, "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"],
      ["Zona", order.type_zone, "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"],
      ["Requerimiento", order.requirement_name, "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6"],
    ];
    infoItems.forEach(function(item) {
      if (item[1]) {
        infoGrid += '<div style="padding:12px 16px;background:#fafafa;border-radius:10px;border:1px solid #f1f5f9">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><path d="' + item[2] + '"/></svg>' +
          '<span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;font-weight:600">' + item[0] + '</span></div>' +
          '<p style="margin:0;font-size:14px;color:#1e293b;font-weight:500">' + escapeHtml(item[1]) + '</p></div>';
      }
    });
    infoGrid += '</div>';

    var whatsappUrl = "https://wa.me/56940211459?text=" + encodeURIComponent("Hola, necesito ayuda con mi expediente " + (order.order_number || ""));

    return '<div style="margin-bottom:16px"><button class="lc-btn-back" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.04)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Volver</button></div>' +
      '<div style="display:block!important;background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(8,145,178,.12);border-radius:50%"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;position:relative">' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Expediente ' + escapeHtml(order.order_number) + '</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">' + escapeHtml(order.customer_name) + ' - ' + formatDate(order.created_at) + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + getStatusBadge(order.status) +
      '<a href="' + whatsappUrl + '" target="_blank" rel="noopener" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(37,211,102,.4);background:rgba(37,211,102,.12);color:#25d366;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Contactar Soporte</a></div></div></div>' +
      '<div style="padding:20px 28px">' + infoGrid + '</div>' +
            (agentHtml ? '<div style="padding:0 28px 20px">' + agentHtml + '</div>' : '') + '</div>' +
            '<div class="lc-detail-wrapper" style="display:block!important;background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:36px;height:36px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Embarcaciones Disponibles</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Arrastra las tarjetas para ordenar por prioridad</p></div></div></div>' +
      '<div id="lc-cards-container" style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">' + cardsHtml + '</div></div>';
  }

  /* ── Event listeners ── */
  function attachListeners(container) {
    container.querySelectorAll(".lc-order-card").forEach(function (card) {
      card.addEventListener("click", function (e) { if (e.target.closest("button")) return; var id = this.getAttribute("data-id"); if (id) showDetailInline(id); });
      card.addEventListener("mouseover", function () { this.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; this.style.borderColor = "#cbd5e1"; this.style.transform = "translateY(-1px)"; });
      card.addEventListener("mouseout", function () { this.style.boxShadow = ""; this.style.borderColor = "#e2e8f0"; this.style.transform = ""; });
    });
    container.querySelectorAll(".lc-btn-detail").forEach(function (btn) { btn.addEventListener("click", function (e) { e.stopPropagation(); showDetailInline(this.getAttribute("data-id")); }); });
    container.querySelectorAll(".lc-btn-back").forEach(function (btn) { btn.addEventListener("click", function () { hideDetailInline(); }); });
    container.querySelectorAll(".lc-open-link").forEach(function (btn) { btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); window.open(this.getAttribute("data-url"), "_blank"); }); });
    container.querySelectorAll(".lc-copy-link").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var url = this.getAttribute("data-url"); var b = this;
        navigator.clipboard.writeText(url).then(function () { b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'; showToast("Link copiado", "success");
          setTimeout(function () { b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'; }, 1500); }); });
    });
    container.querySelectorAll(".lc-whatsapp-share").forEach(function (btn) { btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); window.open("https://wa.me/?text=" + encodeURIComponent("Mira esta embarcacion: " + this.getAttribute("data-url")), "_blank"); }); });
    container.querySelectorAll(".lc-img-preview").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var url = this.getAttribute("data-url"); if (!url) return;
        var overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;animation:lcFadeIn .2s;backdrop-filter:blur(8px)";
        overlay.innerHTML = '<div style="position:relative;max-width:90%;max-height:90%"><img src="' + url + '" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5)"><button style="position:absolute;top:-12px;right:-12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);font-size:18px;font-weight:700">&times;</button></div>';
        overlay.addEventListener("click", function () { overlay.remove(); });
        document.body.appendChild(overlay); });
    });
    container.querySelectorAll(".lc-inspect-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); showInspectionModal(this.getAttribute("data-url"), this.getAttribute("data-idx")); });
    });
    initDragDrop(container);
  }

  function initDragDrop(container) {
    var cc = container.querySelector("#lc-cards-container");
    if (!cc) return;
    cc.querySelectorAll(".lc-vessel-card").forEach(function (card) {
      card.addEventListener("dragstart", function (e) { dragSrcEl = this; this.style.opacity = "0.4"; this.classList.add("lc-dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", this.getAttribute("data-link-id")); });
      card.addEventListener("dragend", function () { this.style.opacity = "1"; this.classList.remove("lc-dragging"); var ind = cc.querySelector(".lc-drop-indicator"); if (ind) ind.remove(); dragSrcEl = null; updateCardNumbers(cc); saveClientOrder(cc); });
      card.addEventListener("dragover", function (e) {
        e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (this === dragSrcEl) return;
        var rect = this.getBoundingClientRect(); var midY = rect.top + rect.height / 2;
        var existing = cc.querySelector(".lc-drop-indicator"); if (existing) existing.remove();
        var indicator = document.createElement("div"); indicator.className = "lc-drop-indicator";
        indicator.style.cssText = "height:3px;background:linear-gradient(90deg,#0891b2,#06b6d4);border-radius:2px;margin:4px 0";
        if (e.clientY < midY) this.parentNode.insertBefore(indicator, this); else this.parentNode.insertBefore(indicator, this.nextSibling);
      });
      card.addEventListener("drop", function (e) { e.preventDefault(); if (dragSrcEl === this) return; var indicator = cc.querySelector(".lc-drop-indicator"); if (indicator) { cc.insertBefore(dragSrcEl, indicator); indicator.remove(); } });
    });
  }

  function updateCardNumbers(container) {
    container.querySelectorAll(".lc-vessel-card").forEach(function (card, idx) {
      var nb = card.querySelector(".lc-card-number"); if (nb) nb.textContent = "#" + (idx + 1);
    });
  }

  function saveClientOrder(container) {
    var order = [];
    container.querySelectorAll(".lc-vessel-card").forEach(function (card) { var id = card.getAttribute("data-link-id"); if (id) order.push(id); });
    try { var oid = getDetailId(); if (oid) { localStorage.setItem("lc_order_" + oid, JSON.stringify(order)); showToast("Orden actualizado", "success"); } } catch (e) {}
  }

  function applyClientOrder(container) {
    var oid = getDetailId(); if (!oid) return;
    try {
      var saved = localStorage.getItem("lc_order_" + oid); if (!saved) return;
      var order = JSON.parse(saved);
      var cc = container.querySelector("#lc-cards-container"); if (!cc) return;
      order.forEach(function (linkId) { var card = cc.querySelector('[data-link-id="' + linkId + '"]'); if (card) cc.appendChild(card); });
      updateCardNumbers(cc);
    } catch (e) {}
  }

  function showInspectionModal(linkUrl, linkIdx) {
    var overlay = document.createElement('div');
    overlay.id = 'lc-inspection-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99998;display:flex;align-items:center;justify-content:center;animation:lcFadeIn .2s;backdrop-filter:blur(4px);overflow-y:auto;padding:20px';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:95%;max-width:640px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:24px 28px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1">' +
      '<div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/></svg></div>' +
      '<h3 style="color:#fff;font-size:18px;font-weight:700;margin:0">Inspeccion de Embarcacion</h3></div>' +
      '<button id="lc-close-inspect" style="border:none;background:rgba(255,255,255,.1);color:#94a3b8;cursor:pointer;padding:8px;border-radius:8px;display:flex;align-items:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
      '<div style="padding:28px">' +
      '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:14px;padding:20px;margin-bottom:24px">' +
      '<h4 style="margin:0 0 12px;font-size:16px;color:#92400e;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>Que incluye la inspeccion?</h4>' +
      '<ul style="margin:0;padding:0 0 0 20px;color:#78350f;font-size:14px;line-height:2">' +
      '<li>Evaluacion visual completa del casco y cubierta</li>' +
      '<li>Revision del motor y sistemas mecanicos</li>' +
      '<li>Inspeccion de sistemas electricos y electronica</li>' +
      '<li>Evaluacion de equipos de navegacion y seguridad</li>' +
      '<li>Verificacion de documentacion y titulos</li>' +
      '<li>Reporte fotografico detallado (50+ fotos)</li></ul></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:24px">' +
      '<h4 style="margin:0 0 16px;font-size:16px;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>Costos de Inspeccion</h4>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;padding:16px;text-align:center"><p style="margin:0;font-size:11px;color:#0369a1;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Embarcacion < 30 ft</p><p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#0891b2">USD $350</p></div>' +
      '<div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:16px;text-align:center"><p style="margin:0;font-size:11px;color:#1d4ed8;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Embarcacion > 30 ft</p><p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#2563eb">USD $500</p></div></div></div>' +
      '<div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:14px;padding:20px;border:1px solid #e2e8f0">' +
      '<h4 style="margin:0 0 12px;font-size:16px;color:#1e293b">Solicitar Inspeccion via WhatsApp</h4>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#64748b">Enviaremos tu solicitud al equipo de inspecciones.</p>' +
      '<button id="lc-send-inspect-wa" data-url="' + escapeHtml(linkUrl || '') + '" data-idx="' + (linkIdx || '0') + '" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(37,211,102,.3)"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Enviar Solicitud por WhatsApp</button></div></div></div>';
    overlay.querySelector('#lc-close-inspect').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#lc-send-inspect-wa').addEventListener('click', function () {
      var u = this.getAttribute('data-url') || '';
      var whatsappMsg = "Hola Imporlan! Quisiera solicitar una inspeccion de embarcacion.\n\n" +
        "Link: " + u + "\n" +
        "Email: " + getUserEmail() + "\n\n" +
        "Por favor indicarme disponibilidad y costos. Gracias!";
      window.open("https://wa.me/56940211459?text=" + encodeURIComponent(whatsappMsg), "_blank");
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  /* ── Skeleton loader ── */
  function renderSkeleton() {
    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:28px 32px"><div style="width:250px;height:24px;background:rgba(255,255,255,.1);border-radius:6px;margin-bottom:8px"></div><div style="width:180px;height:14px;background:rgba(255,255,255,.06);border-radius:4px"></div></div>' +
      '<div style="padding:24px 28px"><div style="height:200px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:lcPulse 1.5s infinite;border-radius:14px;margin-bottom:20px"></div>' +
      '<div style="height:160px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:lcPulse 1.5s infinite;border-radius:14px"></div></div></div>';
  }

  /* ── Update React's native cards with real data ── */
  function updateReactCards(orders) {
    var main = document.querySelector("main");
    if (!main) return;
    var ords = orders || [];
    var orderPlans = ords.filter(function(o) { return o.service_type === "plan_busqueda" && o.status !== "expired" && o.status !== "canceled"; });
    var orderLinks = ords.filter(function(o) { return o.service_type === "cotizacion_link"; });
    var orderLinksActive = orderLinks.filter(function(o) { return o.status === "completed"; });
    var orderLinksReview = orderLinks.filter(function(o) { return o.status !== "completed" && o.status !== "expired" && o.status !== "canceled"; });
    var totalLinks = linksApproved.length + linksReview.length + orderLinks.length;
    var totalPlans = plans.length + orderPlans.length;
    var totalApproved = linksApproved.length + orderLinksActive.length;
    var totalReview = linksReview.length + orderLinksReview.length;
    var cardMap = {
      "Links Contratados": totalLinks,
      "Planes Activos": totalPlans,
      "Links Aprobados": totalApproved,
      "En Revision": totalReview
    };
    var allP = main.querySelectorAll("p");
    for (var i = 0; i < allP.length; i++) {
      var txt = (allP[i].textContent || "").trim();
      if (cardMap.hasOwnProperty(txt)) {
        var numEl = allP[i].parentElement ? allP[i].parentElement.querySelector(".text-2xl") : null;
        if (!numEl) {
          var sib = allP[i].nextElementSibling;
          if (sib && sib.tagName === "P") numEl = sib;
        }
        if (numEl) numEl.textContent = cardMap[txt].toString();
      }
    }
    var h3s = main.querySelectorAll("h3");
    for (var j = 0; j < h3s.length; j++) {
      if ((h3s[j].textContent || "").indexOf("No tienes productos") !== -1) {
        var emptyCard = h3s[j].closest(".rounded-xl") || h3s[j].parentElement.parentElement;
        if (emptyCard && (totalLinks > 0 || plans.length > 0)) {
          emptyCard.innerHTML = '<div style="padding:24px">' + renderProductsSection() + '</div>';
        }
        break;
      }
    }
  }

  /* ── Module lifecycle ── */
  async function renderModule() {
    if (!isProductsPage() || isRendering) return;
    if (document.getElementById("lc-expedientes-inject")) return;
    isRendering = true;
    try {
      var mainContent = document.querySelector("main");
      if (!mainContent) { isRendering = false; return; }
      await injectExpedientesSection(mainContent);
    } catch (e) { console.error("Module renderModule error:", e); }
    isRendering = false;
  }

  async function injectExpedientesSection(mainContent) {
    var existing = document.getElementById("lc-expedientes-inject");
    if (existing) return;
    var wrapper = document.createElement("div");
    wrapper.id = "lc-expedientes-inject";
    wrapper.style.cssText = "max-width:1100px;margin:24px auto 0;padding:0 20px 20px;animation:lcFadeIn .3s ease";
    wrapper.innerHTML = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;padding:24px"><div style="height:120px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:lcPulse 1.5s infinite;border-radius:12px"></div></div>';
    mainContent.appendChild(wrapper);
    var results = await Promise.all([fetchOrders(), fetchPurchases()]);
    var orders = results[0];
    if (!isProductsPage()) { wrapper.remove(); return; }
    updateReactCards(orders);
    var expedientesHtml = renderExpedientesSection(orders);
    wrapper.innerHTML =
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:20px 24px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:44px;height:44px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(8,145,178,.3)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:18px;font-weight:700;color:#fff">Mis Expedientes</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:rgba(148,163,184,.8)">Tus planes de busqueda y embarcaciones</p></div>' +
      '<span style="margin-left:auto;background:rgba(8,145,178,.3);color:#67e8f9;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">' + orders.length + '</span></div>' +
      '<div style="padding:20px 24px">' + expedientesHtml + '</div></div>';
    attachListeners(wrapper);
  }

  function fixMobileLayout() {
    if (window.innerWidth >= 768) return;
    var inject = document.getElementById("lc-expedientes-inject");
    if (inject) {
      inject.style.width = "100%";
      inject.style.maxWidth = "100%";
      inject.style.padding = "0";
      inject.style.boxSizing = "border-box";
      var children = inject.children;
      for (var i = 0; i < children.length; i++) {
        children[i].style.display = "block";
        children[i].style.width = "100%";
        children[i].style.maxWidth = "100%";
        children[i].style.gridTemplateColumns = "none";
        children[i].style.boxSizing = "border-box";
        children[i].style.overflow = "hidden";
      }
    }
    var cc = document.getElementById("lc-cards-container");
    if (cc) {
      cc.style.width = "100%";
      cc.style.maxWidth = "100%";
      cc.style.boxSizing = "border-box";
      if (cc.parentElement) {
        cc.parentElement.style.display = "block";
        cc.parentElement.style.width = "100%";
        cc.parentElement.style.maxWidth = "100%";
        cc.parentElement.style.gridTemplateColumns = "none";
        cc.parentElement.style.boxSizing = "border-box";
      }
    }
    var cards = document.querySelectorAll(".lc-vessel-card");
    for (var j = 0; j < cards.length; j++) {
      cards[j].style.width = "100%";
      cards[j].style.maxWidth = "100%";
      cards[j].style.boxSizing = "border-box";
      cards[j].style.overflow = "hidden";
      var body = cards[j].querySelector(".lc-card-body");
      if (body) {
        body.style.width = "100%";
        body.style.boxSizing = "border-box";
        body.style.overflow = "hidden";
        body.style.padding = "10px";
      }
      var text = cards[j].querySelector(".lc-card-text");
      if (text) {
        text.style.width = "100%";
        text.style.boxSizing = "border-box";
        text.style.overflow = "hidden";
        var flexDivs = text.children;
        for (var k = 0; k < flexDivs.length; k++) {
          var cs = window.getComputedStyle(flexDivs[k]);
          if (cs.display === "flex" && cs.flexWrap === "wrap") {
            flexDivs[k].style.flexDirection = "column";
            flexDivs[k].style.alignItems = "stretch";
            var items = flexDivs[k].children;
            for (var m = 0; m < items.length; m++) {
              items[m].style.width = "100%";
              items[m].style.boxSizing = "border-box";
            }
          }
        }
      }
    }
  }

  async function showDetailInline(orderId) {
    var inject = document.getElementById("lc-expedientes-inject");
    if (!inject) return;
    inject.setAttribute("data-prev", inject.innerHTML);
    inject.innerHTML = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;padding:24px"><div style="height:200px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:lcPulse 1.5s infinite;border-radius:12px"></div></div>';
    var order = await fetchOrderDetail(orderId);
    inject.innerHTML = renderDetailView(order);
    applyClientOrder(inject);
    attachListeners(inject);
    fixMobileLayout();
    inject.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideDetailInline() {
    var inject = document.getElementById("lc-expedientes-inject");
    if (!inject) return;
    isRendering = false;
    inject.remove();
    var mainContent = document.querySelector("main");
    if (mainContent) injectExpedientesSection(mainContent);
  }

  function hideModule() {
    var container = document.getElementById("lc-module-container");
    if (container) container.remove();
    var inject = document.getElementById("lc-expedientes-inject");
    if (inject) inject.remove();
  }

  /* ── Styles ── */
  function addStyles() {
    if (document.getElementById("lc-styles")) return;
    var style = document.createElement("style"); style.id = "lc-styles";
    style.textContent =
      "@keyframes lcFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes lcSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:.5}}" +
      "main.lc-detail-active>*:not(#lc-module-container){display:none!important}" +
      ".lc-vessel-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08)!important;border-color:#cbd5e1!important}" +
      ".lc-vessel-card:hover .lc-drag-handle{opacity:1!important}" +
      ".lc-vessel-card.lc-dragging{box-shadow:0 12px 36px rgba(0,0,0,.15)!important;transform:rotate(1deg)}" +
      ".lc-vessel-card .lc-drag-handle:active{cursor:grabbing}" +
      ".lc-drop-indicator{animation:lcFadeIn .15s}" +
      ".lc-img-preview:hover img{transform:scale(1.05)}" +
      "button.lc-open-link:hover,button.lc-copy-link:hover{background:#e2e8f0!important;color:#1e293b!important}" +
      "button.lc-whatsapp-share:hover{background:#bbf7d0!important}" +
            "@media(max-width:768px){" +
            "#lc-expedientes-inject{width:100%!important;max-width:100%!important;padding:0 8px!important}" +
            "#lc-expedientes-inject>div{display:block!important;width:100%!important;max-width:100%!important;grid-template-columns:1fr!important}" +
            ".lc-detail-wrapper{display:block!important;width:100%!important}" +
            "#lc-cards-container{width:100%!important;max-width:100%!important}" +
            "#lc-module-container{padding:8px!important}" +
            ".lc-vessel-card{max-width:100%!important;width:100%!important}" +
            ".lc-card-row{flex-direction:column!important;align-items:stretch!important}" +
            ".lc-drag-handle{width:100%!important;height:28px!important;border-right:none!important;border-bottom:1px solid #e2e8f0!important;flex-direction:row!important}" +
            ".lc-card-body{flex-direction:column!important;gap:12px!important;padding:12px!important;width:100%!important;box-sizing:border-box!important}" +
            ".lc-img-preview{width:100%!important;height:180px!important;flex-shrink:0!important}" +
            ".lc-card-text{width:100%!important;min-width:0!important}" +
            ".lc-vessel-card a[href]{word-break:break-all!important;white-space:normal!important;max-width:100%!important;font-size:12px!important;overflow:visible!important;text-overflow:unset!important}" +
            ".lc-inspect-btn{width:100%!important;justify-content:center!important}" +
      "}";
    document.head.appendChild(style);
  }

  /* ── Init ── */
  var checkTimer = null;
  var lastPageWasProducts = false;

  function checkPage() {
    var isProducts = isProductsPage();
    if (isProducts && !document.getElementById("lc-expedientes-inject") && !isRendering) {
      renderModule();
    } else if (!isProducts && lastPageWasProducts) {
      hideModule();
    }
    lastPageWasProducts = isProducts;
  }

  function init() {
    addStyles();
    checkPage();
    var obs = new MutationObserver(function () {
      clearTimeout(checkTimer);
      checkTimer = setTimeout(checkPage, 300);
    });
    var root = document.getElementById("root") || document.body;
    obs.observe(root, { childList: true, subtree: true });
  }

  function startWhenReady() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
    else setTimeout(init, 500);
  }

  startWhenReady();
})();
