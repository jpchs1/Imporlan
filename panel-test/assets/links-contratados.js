/**
 * Links Contratados / Mis Expedientes - Imporlan Panel Cliente
 * Modern card-based UI with drag & drop reordering
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/test/")
    ? "/test/api"
    : window.location.pathname.includes("/panel-test")
      ? "/test/api"
      : "/api";

  const STATUS_COLORS = {
    new: { bg: "#3b82f6", text: "#ffffff", label: "Nuevo" },
    pending_admin_fill: { bg: "#f59e0b", text: "#ffffff", label: "Pendiente" },
    in_progress: { bg: "#10b981", text: "#ffffff", label: "En Proceso" },
    completed: { bg: "#6366f1", text: "#ffffff", label: "Completado" },
    expired: { bg: "#ef4444", text: "#ffffff", label: "Vencido" },
    canceled: { bg: "#64748b", text: "#ffffff", label: "Cancelado" },
  };

  var isRendering = false;
  var moduleHidden = false;
  var dragSrcEl = null;

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      var raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
    } catch (e) {}
    return null;
  }

  function getUserEmail() {
    var u = getUserData();
    return u ? u.email || u.user_email || "" : "";
  }

  function getUserId() {
    var u = getUserData();
    return u ? u.id || u.uid || u.user_id || "" : "";
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
    if (amount === null || amount === undefined || amount === "") return null;
    var num = parseFloat(amount);
    if (isNaN(num)) return null;
    if (currency === "USD") return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return "$" + num.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function truncateUrl(url, max) {
    if (!url) return "";
    max = max || 45;
    try {
      var u = new URL(url);
      var display = u.hostname + u.pathname;
      return display.length > max ? display.substring(0, max) + "..." : display;
    } catch (e) {
      return url.length <= max ? url : url.substring(0, max) + "...";
    }
  }

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["new"];
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:9999px;font-size:12px;font-weight:600;background:' + s.bg + ';color:' + s.text + ';letter-spacing:.02em"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + '</span>';
  }

  function isLinksPage() {
    var hash = window.location.hash;
    return hash === "#links-contratados" || hash.startsWith("#links-contratados/");
  }

  function getOrderIdFromHash() {
    var match = window.location.hash.match(/#links-contratados\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  function showToast(msg, type) {
    var toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981") + ";animation:lcSlideUp .3s ease";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; setTimeout(function () { toast.remove(); }, 300); }, 2500);
  }

  function injectSidebarItem() {
    var asideEl = document.querySelector("aside");
    if (!asideEl) return;
    var refLi = null;
    asideEl.querySelectorAll("li").forEach(function (li) {
      var text = (li.textContent || "").trim().toLowerCase();
      if (text.includes("mis productos")) refLi = li;
    });
    if (!refLi || !refLi.parentNode) return;
    var existing = document.getElementById("sidebar-links-contratados");
    if (existing) {
      var existingLi = existing.closest("li");
      if (existingLi && refLi.nextElementSibling === existingLi) return;
      if (existingLi) existingLi.remove();
    }
    var refChild = refLi.querySelector("a, button, span, div");
    var li = document.createElement("li");
    var btn = document.createElement("button");
    btn.id = "sidebar-links-contratados";
    if (refChild && refChild.className) btn.className = refChild.className.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400|bg-blue-50|text-blue-600/g, "");
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg> Mis Expedientes';
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); moduleHidden = false; if (window.location.hash === "#links-contratados") renderModule(); else window.location.hash = "#links-contratados"; });
    li.appendChild(btn);
    refLi.parentNode.insertBefore(li, refLi.nextSibling);
    updateSidebarActive();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-links-contratados");
    if (!item) return;
    if (isLinksPage()) { item.style.background = "rgba(0,212,255,0.15)"; item.style.color = "#00d4ff"; item.style.borderRight = "4px solid #00d4ff"; item.style.fontWeight = "600"; }
    else { item.style.background = "transparent"; item.style.color = ""; item.style.borderRight = "none"; item.style.fontWeight = ""; }
  }

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

  function renderListView(orders) {
    var cards = "";
    if (orders.length === 0) {
      cards = '<div style="text-align:center;padding:60px 20px">' +
        '<div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:20px;display:flex;align-items:center;justify-content:center"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg></div>' +
        '<h3 style="color:#1e293b;font-size:18px;font-weight:600;margin:0 0 8px">No tienes expedientes aun</h3>' +
        '<p style="color:#94a3b8;font-size:14px;max-width:360px;margin:0 auto">Cuando contrates un plan de busqueda, tus expedientes apareceran aqui.</p></div>';
    } else {
      orders.forEach(function (o) {
        var si = STATUS_COLORS[o.status] || STATUS_COLORS["new"];
        cards += '<div class="lc-order-card" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:12px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden" data-id="' + o.id + '">' +
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
    }
    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:28px 32px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(8,145,178,.15);border-radius:50%"></div>' +
      '<div style="display:flex;align-items:center;gap:16px;position:relative">' +
      '<div style="width:52px;height:52px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(8,145,178,.3)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Mis Expedientes</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">Tus planes de busqueda y embarcaciones</p></div></div></div>' +
      '<div style="padding:20px 24px">' + cards +
      '<div style="text-align:center;padding:16px 0 4px;border-top:1px solid #f1f5f9;margin-top:8px">' +
      '<a href="#mis-productos" class="lc-goto-products" style="display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>Ver Mis Productos Contratados</a></div>' +
      '</div></div>';
  }

  function renderVesselCard(lk, idx) {
    var hasData = lk.url || lk.image_url || lk.value_usa_usd || lk.value_chile_clp;
    if (!hasData) return "";

    var imgHtml = '';
    if (lk.image_url) {
      imgHtml = '<div style="flex-shrink:0;width:160px;height:120px;border-radius:12px;overflow:hidden;position:relative;cursor:pointer" class="lc-img-preview" data-url="' + escapeHtml(lk.image_url) + '">' +
        '<img src="' + escapeHtml(lk.image_url) + '" style="width:100%;height:100%;object-fit:cover;transition:transform .3s" onerror="this.style.display=\'none\'">' +
        '<div class="lc-card-number" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);border-radius:6px;padding:2px 8px;font-size:11px;color:#fff;font-weight:600">#' + (idx + 1) + '</div></div>';
    } else {
      imgHtml = '<div style="flex-shrink:0;width:160px;height:120px;border-radius:12px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0);display:flex;align-items:center;justify-content:center;position:relative">' +
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
    var vU = formatCurrency(lk.value_usa_usd, "USD");
    var vN = formatCurrency(lk.value_to_negotiate_usd, "USD");
    var vC = formatCurrency(lk.value_chile_clp, "CLP");
    var vCN = formatCurrency(lk.value_chile_negotiated_clp, "CLP");
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
      '<div style="display:flex;gap:0">' +
      '<div class="lc-drag-handle" style="flex-shrink:0;width:32px;display:flex;align-items:center;justify-content:center;cursor:grab;background:linear-gradient(to right,#f8fafc,#f1f5f9);border-right:1px solid #e2e8f0;opacity:.6;transition:opacity .2s" title="Arrastra para reordenar"><svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></div>' +
      '<div style="flex:1;padding:16px;display:flex;gap:16px;flex-wrap:wrap;min-width:0">' +
      imgHtml +
      '<div style="flex:1;min-width:200px">' +
      (lk.title ? '<h4 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1e293b">' + escapeHtml(lk.title) + '</h4>' : '') +
      locationHoursHtml + urlHtml + valuesHtml + commentsHtml +
      (lk.url ? '<div style="margin-top:12px"><button class="lc-inspect-btn" data-url="' + escapeHtml(lk.url) + '" data-idx="' + idx + '" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fef3c7);color:#b45309;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/><path d="M21 3v4h-4"/></svg>Solicitar Inspeccion</button></div>' : '') +
      '</div></div></div></div>';
  }

  function renderDetailView(order) {
    if (!order) {
      return '<div style="text-align:center;padding:60px 20px;color:#94a3b8"><p style="font-size:16px">Expediente no encontrado</p>' +
        '<button class="lc-btn-back" style="margin-top:16px;padding:10px 24px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;cursor:pointer;font-size:14px;font-weight:500">Volver al listado</button></div>';
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
      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:24px 28px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(8,145,178,.12);border-radius:50%"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;position:relative">' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Expediente ' + escapeHtml(order.order_number) + '</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">' + escapeHtml(order.customer_name) + ' - ' + formatDate(order.created_at) + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + getStatusBadge(order.status) +
      '<a href="' + whatsappUrl + '" target="_blank" rel="noopener" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(37,211,102,.4);background:rgba(37,211,102,.12);color:#25d366;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Contactar Soporte</a></div></div></div>' +
      '<div style="padding:20px 28px">' + infoGrid + '</div>' +
      (agentHtml ? '<div style="padding:0 28px 20px">' + agentHtml + '</div>' : '') + '</div>' +
      '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="width:36px;height:36px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b">Embarcaciones Disponibles</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Arrastra las tarjetas para ordenar por prioridad</p></div></div></div>' +
      '<div id="lc-cards-container" style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">' + cardsHtml + '</div></div>';
  }

  function attachListeners(container) {
    container.querySelectorAll(".lc-order-card").forEach(function (card) {
      card.addEventListener("click", function (e) { if (e.target.closest("button")) return; var id = this.getAttribute("data-id"); if (id) window.location.hash = "#links-contratados/" + id; });
      card.addEventListener("mouseover", function () { this.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; this.style.borderColor = "#cbd5e1"; this.style.transform = "translateY(-1px)"; });
      card.addEventListener("mouseout", function () { this.style.boxShadow = ""; this.style.borderColor = "#e2e8f0"; this.style.transform = ""; });
    });
    container.querySelectorAll(".lc-btn-detail").forEach(function (btn) { btn.addEventListener("click", function (e) { e.stopPropagation(); window.location.hash = "#links-contratados/" + this.getAttribute("data-id"); }); });
    container.querySelectorAll(".lc-btn-back").forEach(function (btn) { btn.addEventListener("click", function () { window.location.hash = "#links-contratados"; }); });
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
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        showInspectionModal(this.getAttribute("data-url"), this.getAttribute("data-idx"));
      });
    });
    container.querySelectorAll(".lc-goto-products").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        hideModule();
        window.location.hash = "#mis-productos";
      });
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
      var nb = card.querySelector(".lc-card-number");
      if (nb) nb.textContent = "#" + (idx + 1);
    });
  }

  function saveClientOrder(container) {
    var order = [];
    container.querySelectorAll(".lc-vessel-card").forEach(function (card) { var id = card.getAttribute("data-link-id"); if (id) order.push(id); });
    try { var oid = getOrderIdFromHash(); if (oid) { localStorage.setItem("lc_order_" + oid, JSON.stringify(order)); showToast("Orden actualizado", "success"); } } catch (e) {}
  }

  function applyClientOrder(container) {
    var oid = getOrderIdFromHash(); if (!oid) return;
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
      '<div style="padding:16px;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border-radius:10px;border:1px solid #bbf7d0;text-align:center"><div style="font-size:11px;color:#059669;font-weight:600;text-transform:uppercase;margin-bottom:4px">Hasta 25 pies</div><div style="font-size:22px;font-weight:700;color:#047857">USD $350</div></div>' +
      '<div style="padding:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;border:1px solid #93c5fd;text-align:center"><div style="font-size:11px;color:#2563eb;font-weight:600;text-transform:uppercase;margin-bottom:4px">26-35 pies</div><div style="font-size:22px;font-weight:700;color:#1d4ed8">USD $500</div></div>' +
      '<div style="padding:16px;background:linear-gradient(135deg,#fdf4ff,#f5d0fe);border-radius:10px;border:1px solid #d8b4fe;text-align:center"><div style="font-size:11px;color:#9333ea;font-weight:600;text-transform:uppercase;margin-bottom:4px">36-50 pies</div><div style="font-size:22px;font-weight:700;color:#7e22ce">USD $750</div></div>' +
      '<div style="padding:16px;background:linear-gradient(135deg,#fff7ed,#ffedd5);border-radius:10px;border:1px solid #fed7aa;text-align:center"><div style="font-size:11px;color:#c2410c;font-weight:600;text-transform:uppercase;margin-bottom:4px">Mayor a 50 pies</div><div style="font-size:22px;font-weight:700;color:#9a3412">Consultar</div></div></div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:24px">' +
      '<h4 style="margin:0 0 8px;font-size:16px;color:#1e293b">Reporte de Inspeccion</h4>' +
      '<p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Recibiras un reporte profesional que incluye: fotografias detalladas, evaluacion de condicion general (escala 1-10), lista de defectos encontrados, estimacion de costos de reparacion, y recomendacion de compra/no compra. <strong style="color:#1e293b">Tiempo de entrega: 3-5 dias habiles.</strong></p></div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px">' +
      '<h4 style="margin:0 0 16px;font-size:16px;color:#1e293b;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>Solicitar Inspeccion</h4>' +
      '<div style="display:grid;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label><input id="lc-insp-name" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Tu nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email *</label><input id="lc-insp-email" type="email" value="' + escapeHtml(getUserEmail()) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="tu@email.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase">Telefono</label><input id="lc-insp-phone" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="+56 9 XXXX XXXX"></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase">Link de la embarcacion</label><input id="lc-insp-link" value="' + escapeHtml(linkUrl || '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;background:#f8fafc;color:#64748b" readonly></div>' +
      '<div><label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;font-weight:600;text-transform:uppercase">Comentarios adicionales</label><textarea id="lc-insp-comments" rows="3" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box" placeholder="Detalles adicionales sobre la embarcacion..."></textarea></div>' +
      '<button id="lc-submit-inspect" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(245,158,11,.3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Enviar Solicitud de Inspeccion</button>' +
      '</div></div></div></div>';
    overlay.querySelector('#lc-close-inspect').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#lc-submit-inspect').addEventListener('click', function() {
      var name = document.getElementById('lc-insp-name').value.trim();
      var email = document.getElementById('lc-insp-email').value.trim();
      if (!name || !email) { showToast('Nombre y email son requeridos', 'error'); return; }
      var phone = document.getElementById('lc-insp-phone').value.trim();
      var link = document.getElementById('lc-insp-link').value.trim();
      var comments = document.getElementById('lc-insp-comments').value.trim();
      var whatsappMsg = 'Hola, quiero solicitar una inspeccion de embarcacion.%0A%0A' +
        'Nombre: ' + encodeURIComponent(name) + '%0A' +
        'Email: ' + encodeURIComponent(email) + '%0A' +
        (phone ? 'Telefono: ' + encodeURIComponent(phone) + '%0A' : '') +
        'Link: ' + encodeURIComponent(link) + '%0A' +
        (comments ? 'Comentarios: ' + encodeURIComponent(comments) : '');
      window.open('https://wa.me/56940211459?text=' + whatsappMsg, '_blank');
      showToast('Solicitud enviada por WhatsApp', 'success');
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function renderSkeleton() {
    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:28px 32px"><div style="width:250px;height:24px;background:rgba(255,255,255,.1);border-radius:6px;margin-bottom:8px"></div><div style="width:180px;height:14px;background:rgba(255,255,255,.06);border-radius:4px"></div></div>' +
      '<div style="padding:20px"><div style="display:flex;gap:16px;margin-bottom:16px;padding:16px;border-radius:14px;background:#fafafa"><div style="width:160px;height:120px;background:#f1f5f9;border-radius:12px;animation:lcPulse 1.5s infinite;flex-shrink:0"></div><div style="flex:1"><div style="height:16px;width:70%;background:#f1f5f9;border-radius:6px;margin-bottom:10px;animation:lcPulse 1.5s infinite"></div><div style="display:flex;gap:8px"><div style="height:40px;width:100px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div><div style="height:40px;width:100px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div></div></div></div>' +
      '<div style="display:flex;gap:16px;margin-bottom:16px;padding:16px;border-radius:14px;background:#fafafa"><div style="width:160px;height:120px;background:#f1f5f9;border-radius:12px;animation:lcPulse 1.5s infinite;flex-shrink:0"></div><div style="flex:1"><div style="height:16px;width:60%;background:#f1f5f9;border-radius:6px;margin-bottom:10px;animation:lcPulse 1.5s infinite"></div><div style="display:flex;gap:8px"><div style="height:40px;width:100px;background:#f1f5f9;border-radius:8px;animation:lcPulse 1.5s infinite"></div></div></div></div></div></div>';
  }

  async function renderModule() {
    if (!isLinksPage() || moduleHidden || isRendering) return;
    isRendering = true;
    try {
      var mainContent = document.querySelector("main");
      if (!mainContent) { isRendering = false; return; }
      var container = document.getElementById("lc-module-container");
      if (!container) { container = document.createElement("div"); container.id = "lc-module-container"; container.style.cssText = "max-width:1100px;margin:0 auto;padding:20px;animation:lcFadeIn .3s ease;position:relative;z-index:10"; mainContent.appendChild(container); }
      mainContent.classList.add("lc-active");
      container.innerHTML = renderSkeleton();
      var orderId = getOrderIdFromHash();
      if (orderId) {
        var order = await fetchOrderDetail(orderId);
        if (!isLinksPage()) { hideModule(); isRendering = false; return; }
        container.innerHTML = renderDetailView(order);
        applyClientOrder(container);
      } else {
        var orders = await fetchOrders();
        if (!isLinksPage()) { hideModule(); isRendering = false; return; }
        container.innerHTML = renderListView(orders);
      }
      attachListeners(container);
      updateSidebarActive();
    } catch (e) { console.error("Links Contratados renderModule error:", e); }
    isRendering = false;
  }

  function hideModule() {
    moduleHidden = true;
    var container = document.getElementById("lc-module-container");
    if (container) container.remove();
    var mainContent = document.querySelector("main");
    if (mainContent) mainContent.classList.remove("lc-active");
    updateSidebarActive();
  }

  function addStyles() {
    if (document.getElementById("lc-styles")) return;
    var style = document.createElement("style"); style.id = "lc-styles";
    style.textContent =
      "@keyframes lcFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes lcSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:.5}}" +
      "main.lc-active>*:not(#lc-module-container){display:none!important}" +
      ".lc-vessel-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08)!important;border-color:#cbd5e1!important}" +
      ".lc-vessel-card:hover .lc-drag-handle{opacity:1!important}" +
      ".lc-vessel-card.lc-dragging{box-shadow:0 12px 36px rgba(0,0,0,.15)!important;transform:rotate(1deg)}" +
      ".lc-vessel-card .lc-drag-handle:active{cursor:grabbing}" +
      ".lc-drop-indicator{animation:lcFadeIn .15s}" +
      ".lc-img-preview:hover img{transform:scale(1.05)}" +
      "button.lc-open-link:hover,button.lc-copy-link:hover{background:#e2e8f0!important;color:#1e293b!important}" +
      "button.lc-whatsapp-share:hover{background:#bbf7d0!important}" +
      "@media(max-width:768px){#lc-module-container{padding:12px!important}.lc-vessel-card>div>div:last-child{flex-direction:column!important}}";
    document.head.appendChild(style);
  }

  function init() {
    addStyles(); injectSidebarItem();
    if (isLinksPage()) setTimeout(renderModule, 300);
    window.addEventListener("hashchange", function () { if (isLinksPage()) { moduleHidden = false; renderModule(); } else hideModule(); });
    document.addEventListener("click", function (e) { var btn = e.target.closest("button, a"); if (btn && btn.id !== "sidebar-links-contratados" && e.target.closest("aside")) hideModule(); }, true);
    var aside = document.querySelector("aside");
    if (aside) {
      var sideObs = new MutationObserver(function () { if (!document.getElementById("sidebar-links-contratados")) injectSidebarItem(); });
      sideObs.observe(aside, { childList: true, subtree: true });
    }
    var mainEl = document.querySelector("main");
    if (mainEl) {
      var observer = new MutationObserver(function () { if (!document.getElementById("sidebar-links-contratados")) injectSidebarItem(); if (isLinksPage() && !moduleHidden && !document.getElementById("lc-module-container")) renderModule(); });
      observer.observe(mainEl, { childList: true, subtree: false });
    }
  }

  function startWhenReady() {
    var aside = document.querySelector("aside");
    if (aside && aside.querySelector("nav")) init();
    else if (document.querySelector("nav")) init();
    else {
      var bodyObs = new MutationObserver(function () {
        var a = document.querySelector("aside");
        if (a && a.querySelector("nav")) { bodyObs.disconnect(); init(); }
      });
      bodyObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWhenReady);
  else startWhenReady();
})();
