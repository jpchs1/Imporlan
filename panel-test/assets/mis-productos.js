/**
 * Mis Productos Contratados - Imporlan Panel Cliente
 * Fetches real purchases and displays with tabs: Planes Activos, Links Aprobados, En Revisión
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/panel-test")
    ? "/test/api"
    : window.location.pathname.includes("/test/")
      ? "/test/api"
      : "/api";

  const STATUS_COLORS = {
    active: { bg: "#10b981", text: "#ffffff", label: "Activo" },
    en_revision: { bg: "#f59e0b", text: "#ffffff", label: "En Revisión" },
    pending: { bg: "#6366f1", text: "#ffffff", label: "Pendiente" },
    expired: { bg: "#ef4444", text: "#ffffff", label: "Vencido" },
    canceled: { bg: "#64748b", text: "#ffffff", label: "Cancelado" },
  };

  var container = null;
  var plans = [];
  var linksApproved = [];
  var linksReview = [];
  var activeTab = "planes";
  var moduleHidden = false;

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

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    if (!amount && amount !== 0) return "$0";
    var num = parseInt(amount);
    if (isNaN(num)) return "$0";
    return "$" + num.toLocaleString("es-CL");
  }

  function getStatusBadge(status) {
    var s = STATUS_COLORS[status] || STATUS_COLORS["pending"];
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:600;background:' + s.bg + ';color:' + s.text + '"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.7"></span>' + escapeHtml(s.label) + "</span>";
  }

  function truncateUrl(url, max) {
    if (!url) return "";
    max = max || 40;
    try {
      var u = new URL(url);
      var display = u.hostname + u.pathname;
      return display.length > max ? display.substring(0, max) + "..." : display;
    } catch (e) {
      return url.length <= max ? url : url.substring(0, max) + "...";
    }
  }

  function isProductsPage() {
    return window.location.hash === "#mis-productos" || window.location.hash.startsWith("#mis-productos/");
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
    } catch (e) {}
  }

  function injectSidebarItem() {
    var checkCount = 0;
    function tryInject() {
      if (++checkCount > 60) return;
      if (document.getElementById("sidebar-mis-productos")) return;
      var nav = document.querySelector("aside nav") || document.querySelector("nav");
      if (!nav) { setTimeout(tryInject, 500); return; }
      var refBtn = null;
      nav.querySelectorAll("a, button").forEach(function (el) {
        var text = el.textContent.trim().toLowerCase();
        if (text.includes("producto") || text.includes("servicio") || text.includes("importaciones")) refBtn = el;
      });
      if (!refBtn) { var btns = nav.querySelectorAll("a, button"); if (btns.length > 2) refBtn = btns[btns.length - 2]; }
      if (!refBtn) { setTimeout(tryInject, 500); return; }
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.id = "sidebar-mis-productos";
      if (refBtn.className) btn.className = refBtn.className.replace(/bg-cyan-500\/20|text-cyan-400|border-r-4|border-cyan-400|bg-blue-50|text-blue-600/g, "");
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg> Mis Productos';
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        moduleHidden = false;
        if (window.location.hash === "#mis-productos") renderModule();
        else window.location.hash = "#mis-productos";
      });
      li.appendChild(btn);
      var refLi = refBtn.closest("li");
      if (refLi && refLi.parentNode) refLi.parentNode.insertBefore(li, refLi.nextSibling);
      else { var ul = nav.querySelector("ul"); if (ul) ul.appendChild(li); else nav.appendChild(li); }
      updateSidebarActive();
    }
    tryInject();
  }

  function updateSidebarActive() {
    var item = document.getElementById("sidebar-mis-productos");
    if (!item) return;
    if (isProductsPage()) {
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

  function renderTabButton(id, label, count, icon) {
    var isActive = activeTab === id;
    return '<button data-tab="' + id + '" style="display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;' +
      (isActive ? 'background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;box-shadow:0 4px 12px rgba(8,145,178,.3)' : 'background:rgba(255,255,255,.06);color:#94a3b8') + '">' +
      icon + ' ' + escapeHtml(label) +
      '<span style="background:' + (isActive ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.1)') + ';padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">' + count + '</span></button>';
  }

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
      '<div style="background:#f8fafc;border-radius:10px;padding:14px"><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Monto</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0891b2">' + formatCurrency(plan.price) + ' CLP</p></div>' +
      '<div style="background:#f8fafc;border-radius:10px;padding:14px"><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.05em">Vigencia</p><p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0f172a">' + (plan.days || 30) + ' dias</p><p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Hasta: ' + escapeHtml(plan.endDate || "N/A") + '</p></div></div>' +
      '<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;color:#64748b">Propuestas recibidas</span><span style="font-size:12px;font-weight:600;color:#0891b2">' + (plan.proposalsReceived || 0) + ' / ' + (plan.proposalsTotal || 0) + '</span></div>' +
      '<div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + progressPct + '%;background:linear-gradient(90deg,#0891b2,#06b6d4);border-radius:3px;transition:width .3s"></div></div></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:#64748b">Metodo:</span><span style="font-size:12px;font-weight:600;color:#0f172a;text-transform:capitalize">' + escapeHtml(plan.payment_method || "N/A") + '</span></div>' +
      '</div></div>';
  }

  function renderLinkCard(link) {
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
      '<div><p style="margin:0;font-size:11px;color:#64748b">Monto</p><p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0891b2">' + formatCurrency(link.price) + ' CLP</p></div>' +
      '<div><p style="margin:0;font-size:11px;color:#64748b">Contratado</p><p style="margin:2px 0 0;font-size:13px;font-weight:500;color:#0f172a">' + escapeHtml(link.contractedAt || "N/A") + '</p></div>' +
      '<div><p style="margin:0;font-size:11px;color:#64748b">Metodo</p><p style="margin:2px 0 0;font-size:13px;font-weight:500;color:#0f172a;text-transform:capitalize">' + escapeHtml(link.payment_method || "N/A") + '</p></div>' +
      '</div></div></div>';
  }

  function renderContent() {
    var tabsHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      renderTabButton("planes", "Planes Activos", plans.length, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>') +
      renderTabButton("links", "Links Aprobados", linksApproved.length, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>') +
      renderTabButton("revision", "En Revision", linksReview.length, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>') +
      '</div>';

    var contentHtml = "";
    if (activeTab === "planes") {
      if (plans.length === 0) {
        contentHtml = '<div style="text-align:center;padding:40px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 16px;display:block"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><p style="color:#64748b;font-size:14px;margin:0">No tienes planes activos</p></div>';
      } else {
        contentHtml = '<div style="display:grid;gap:16px">' + plans.map(renderPlanCard).join("") + '</div>';
      }
    } else if (activeTab === "links") {
      if (linksApproved.length === 0) {
        contentHtml = '<div style="text-align:center;padding:40px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 16px;display:block"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><p style="color:#64748b;font-size:14px;margin:0">No tienes links aprobados</p></div>';
      } else {
        contentHtml = '<div style="display:grid;gap:12px">' + linksApproved.map(renderLinkCard).join("") + '</div>';
      }
    } else {
      if (linksReview.length === 0) {
        contentHtml = '<div style="text-align:center;padding:40px 20px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 16px;display:block"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><p style="color:#64748b;font-size:14px;margin:0">No tienes links en revision</p></div>';
      } else {
        contentHtml = '<div style="display:grid;gap:12px">' + linksReview.map(renderLinkCard).join("") + '</div>';
      }
    }

    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);padding:28px 32px;position:relative;overflow:hidden">' +
      '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(8,145,178,.15);border-radius:50%"></div>' +
      '<div style="display:flex;align-items:center;gap:16px;position:relative">' +
      '<div style="width:52px;height:52px;background:linear-gradient(135deg,#0891b2,#06b6d4);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(8,145,178,.3)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg></div>' +
      '<div><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0">Mis Productos Contratados</h2>' +
      '<p style="color:rgba(148,163,184,.8);font-size:13px;margin:4px 0 0">Planes de busqueda y <a href="#links-contratados" style="color:#22d3ee;text-decoration:underline;cursor:pointer">Links Contratados</a></p></div></div></div>' +
      '<div style="padding:24px 28px">' +
      tabsHtml +
      '<div style="margin-top:20px">' + contentHtml + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid #f1f5f9">' +
      '<a href="#links-contratados" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s;box-shadow:0 4px 14px rgba(8,145,178,.3)">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.4 11.4 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>Ver Mis Expedientes</a></div>' +
      '</div></div>';
  }

  function renderSkeleton() {
    return '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;padding:32px">' +
      '<div style="height:24px;width:60%;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:mpShimmer 1.5s infinite;border-radius:6px;margin-bottom:16px"></div>' +
      '<div style="height:16px;width:40%;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:mpShimmer 1.5s infinite;border-radius:6px;margin-bottom:24px"></div>' +
      '<div style="display:grid;gap:12px">' +
      [1, 2].map(function () { return '<div style="height:120px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:mpShimmer 1.5s infinite;border-radius:12px"></div>'; }).join("") +
      '</div></div>';
  }

  function attachListeners() {
    if (!container) return;
    container.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTab = btn.dataset.tab;
        container.querySelector("#mp-content-area").innerHTML = renderContent();
        attachListeners();
      });
    });
  }

  async function renderModule() {
    if (moduleHidden) return;
    if (!isProductsPage()) return;

    var mainEl = document.querySelector("main");
    if (!mainEl) return;

    var children = mainEl.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].id !== "mis-productos-root") {
        children[i].style.display = "none";
        children[i].setAttribute("data-mp-hidden", "true");
      }
    }

    container = document.getElementById("mis-productos-root");
    if (!container) {
      container = document.createElement("div");
      container.id = "mis-productos-root";
      container.style.cssText = "padding:24px;max-width:900px;margin:0 auto";
      mainEl.appendChild(container);
    }
    container.style.display = "block";
    container.innerHTML = '<div id="mp-content-area">' + renderSkeleton() + '</div>';

    await fetchPurchases();

    if (!document.getElementById("mis-productos-root")) return;
    container.querySelector("#mp-content-area").innerHTML = renderContent();
    attachListeners();
    updateSidebarActive();
  }

  function hideModule() {
    moduleHidden = true;
    var root = document.getElementById("mis-productos-root");
    if (root) root.style.display = "none";
    document.querySelectorAll("[data-mp-hidden]").forEach(function (el) {
      el.style.display = "";
      el.removeAttribute("data-mp-hidden");
    });
    updateSidebarActive();
  }

  function addStyles() {
    if (document.getElementById("mp-styles")) return;
    var style = document.createElement("style");
    style.id = "mp-styles";
    style.textContent = '@keyframes mpShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    injectSidebarItem();

    document.addEventListener("click", function (e) {
      var target = e.target.closest("a, button");
      if (!target) return;
      var text = (target.textContent || "").trim().toLowerCase();
      var href = target.getAttribute("href") || "";
      if (href === "#mis-productos" || (text.includes("producto") && target.closest("aside"))) {
        return;
      }
      if (isProductsPage() && !href.includes("mis-productos") && (target.closest("aside") || target.closest("nav"))) {
        hideModule();
      }
    }, true);

    window.addEventListener("hashchange", function () {
      if (isProductsPage()) {
        moduleHidden = false;
        renderModule();
      } else {
        hideModule();
      }
    });

    if (isProductsPage()) {
      moduleHidden = false;
      renderModule();
    }
  }

  function startWhenReady() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 800); });
    } else {
      setTimeout(init, 800);
    }
  }

  startWhenReady();
})();
