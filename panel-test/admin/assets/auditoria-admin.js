(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }
  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: "Bearer " + getAdminToken() };
  }
  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function fmtDate(s) { if (!s) return "N/A"; var d = new Date(s); return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

  var ACTION_LABELS = {
    status_change: { label: "Cambio de Estado", color: "#f59e0b", icon: "&#8644;" },
    expediente_edit: { label: "Edicion Expediente", color: "#3b82f6", icon: "&#9998;" },
    link_modification: { label: "Modificacion Links", color: "#8b5cf6", icon: "&#128279;" },
    payment_change: { label: "Cambio de Pago", color: "#10b981", icon: "&#36;" }
  };

  var injected = false;
  var currentPage = 1;
  var filters = {};

  function injectSidebarItem() {
    if (injected) return;
    var nav = document.querySelector("aside nav");
    if (!nav) return;
    var buttons = nav.querySelectorAll("button");
    if (buttons.length === 0) return;
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.toLowerCase().includes("auditoria")) {
        injected = true;
        buttons[i].addEventListener("click", function () {
          buttons.forEach(function (b) { b.style.background = ""; b.style.color = ""; });
          this.style.background = "linear-gradient(135deg,#0891b2,#06b6d4)";
          this.style.color = "#fff";
          showAuditSection();
        });
        return;
      }
    }
    var lastBtn = buttons[buttons.length - 1];
    var auditBtn = document.createElement("button");
    auditBtn.className = lastBtn.className;
    auditBtn.innerHTML = lastBtn.innerHTML.replace(/>([^<]+)<\/span>/, '>Auditoria</span>');
    var svgEl = auditBtn.querySelector("svg");
    if (svgEl) {
      svgEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />';
    }
    auditBtn.addEventListener("click", function () {
      buttons.forEach(function (b) {
        b.style.background = "";
        b.style.color = "";
      });
      auditBtn.style.background = "linear-gradient(135deg,#0891b2,#06b6d4)";
      auditBtn.style.color = "#fff";
      showAuditSection();
    });
    lastBtn.parentNode.insertBefore(auditBtn, lastBtn.nextSibling);
    injected = true;
  }

  function showAuditSection() {
    var main = document.querySelector("main");
    if (!main) return;
    main.innerHTML = '';
    var container = document.createElement("div");
    container.style.cssText = "padding:0";
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
        '<div><h1 style="margin:0;font-size:24px;font-weight:800;color:#0f172a">Auditoria</h1>' +
        '<p style="margin:4px 0 0;color:#64748b;font-size:14px">Registro de todas las acciones realizadas en el panel</p></div>' +
      '</div>' +
      '<div id="audit-filters" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">' +
        '<select id="audit-action-type" style="padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569;background:#fff">' +
          '<option value="">Todas las acciones</option>' +
          '<option value="status_change">Cambio de Estado</option>' +
          '<option value="expediente_edit">Edicion Expediente</option>' +
          '<option value="link_modification">Modificacion Links</option>' +
          '<option value="payment_change">Cambio de Pago</option>' +
        '</select>' +
        '<input id="audit-user" type="text" placeholder="Filtrar por usuario..." style="padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569;min-width:180px" />' +
        '<input id="audit-from" type="date" style="padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569" />' +
        '<input id="audit-to" type="date" style="padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569" />' +
        '<button id="audit-search-btn" style="padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Buscar</button>' +
      '</div>' +
      '<div id="audit-table-container"></div>' +
      '<div id="audit-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px"></div>' +
      '<div id="audit-detail-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center"><div id="audit-detail-content" style="background:#fff;border-radius:16px;padding:32px;max-width:600px;width:90%;max-height:80vh;overflow:auto;box-shadow:0 24px 48px rgba(0,0,0,.15)"></div></div>';
    main.appendChild(container);

    document.getElementById("audit-search-btn").addEventListener("click", function () {
      filters = {};
      var at = document.getElementById("audit-action-type").value;
      var ue = document.getElementById("audit-user").value.trim();
      var fd = document.getElementById("audit-from").value;
      var td = document.getElementById("audit-to").value;
      if (at) filters.action_type = at;
      if (ue) filters.user_email = ue;
      if (fd) filters.from_date = fd;
      if (td) filters.to_date = td;
      currentPage = 1;
      loadAuditLogs();
    });

    document.getElementById("audit-detail-modal").addEventListener("click", function (e) {
      if (e.target === this) this.style.display = "none";
    });

    loadAuditLogs();
  }

  function loadAuditLogs() {
    var container = document.getElementById("audit-table-container");
    if (!container) return;
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">Cargando registros de auditoria...</div>';
    var params = "action=list&page=" + currentPage;
    Object.keys(filters).forEach(function (k) { params += "&" + k + "=" + encodeURIComponent(filters[k]); });
    fetch(API_BASE + "/audit_api.php?" + params, { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success || !data.logs || data.logs.length === 0) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron registros de auditoria</div>';
          document.getElementById("audit-pagination").innerHTML = "";
          return;
        }
        var thS = 'padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
        var html = '<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">' +
          '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0"><th style="' + thS + '">Fecha</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Accion</th><th style="' + thS + '">Entidad</th><th style="' + thS + '">Descripcion</th><th style="' + thS + '">Detalle</th></tr></thead><tbody>';
        data.logs.forEach(function (log) {
          var act = ACTION_LABELS[log.action_type] || { label: log.action_type, color: "#64748b", icon: "?" };
          html += '<tr style="border-bottom:1px solid #f1f5f9;transition:background .15s" onmouseenter="this.style.background=\'#f8fafc\'" onmouseleave="this.style.background=\'\'">' +
            '<td style="padding:12px 16px;font-size:12px;color:#64748b;white-space:nowrap">' + fmtDate(log.created_at) + '</td>' +
            '<td style="padding:12px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:13px">' + esc(log.user_name || "Admin") + '</p><p style="margin:1px 0 0;color:#94a3b8;font-size:11px">' + esc(log.user_email) + '</p></div></td>' +
            '<td style="padding:12px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + act.color + '20;color:' + act.color + '">' + act.icon + ' ' + act.label + '</span></td>' +
            '<td style="padding:12px 16px;font-size:12px;color:#475569">' + esc(log.entity_type || "") + (log.entity_id ? ' #' + log.entity_id : '') + '</td>' +
            '<td style="padding:12px 16px;font-size:12px;color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(log.description || "") + '</td>' +
            '<td style="padding:12px 16px"><button onclick="window._showAuditDetail(' + log.id + ')" style="padding:4px 12px;border-radius:6px;border:1px solid #e2e8f0;background:#fff;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Ver</button></td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        var pagEl = document.getElementById("audit-pagination");
        if (data.pages > 1) {
          var pagHtml = "";
          for (var i = 1; i <= data.pages; i++) {
            var active = i === currentPage;
            pagHtml += '<button onclick="window._auditPage(' + i + ')" style="padding:6px 12px;border-radius:6px;border:1px solid ' + (active ? '#0891b2' : '#e2e8f0') + ';background:' + (active ? '#0891b2' : '#fff') + ';color:' + (active ? '#fff' : '#475569') + ';font-size:12px;font-weight:600;cursor:pointer">' + i + '</button>';
          }
          pagEl.innerHTML = pagHtml;
        } else {
          pagEl.innerHTML = "";
        }
      })
      .catch(function (err) {
        console.warn("Error loading audit logs:", err);
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar registros de auditoria</div>';
      });
  }

  window._auditPage = function (p) { currentPage = p; loadAuditLogs(); };

  window._showAuditDetail = function (id) {
    var modal = document.getElementById("audit-detail-modal");
    var content = document.getElementById("audit-detail-content");
    if (!modal || !content) return;
    modal.style.display = "flex";
    content.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Cargando...</div>';
    fetch(API_BASE + "/audit_api.php?action=detail&id=" + id, { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success || !data.log) {
          content.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444">No se encontro el registro</div>';
          return;
        }
        var log = data.log;
        var act = ACTION_LABELS[log.action_type] || { label: log.action_type, color: "#64748b", icon: "?" };
        var oldVal = log.old_value || "";
        var newVal = log.new_value || "";
        try { oldVal = JSON.stringify(JSON.parse(oldVal), null, 2); } catch (e) {}
        try { newVal = JSON.stringify(JSON.parse(newVal), null, 2); } catch (e) {}
        content.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px">' +
            '<div><h2 style="margin:0;font-size:18px;font-weight:700;color:#0f172a">Detalle de Auditoria #' + log.id + '</h2>' +
            '<p style="margin:4px 0 0;color:#64748b;font-size:13px">' + fmtDate(log.created_at) + '</p></div>' +
            '<button onclick="document.getElementById(\'audit-detail-modal\').style.display=\'none\'" style="padding:4px 8px;border:none;background:none;font-size:20px;cursor:pointer;color:#94a3b8">&times;</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">' +
            '<div style="padding:12px;background:#f8fafc;border-radius:8px"><p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Usuario</p><p style="margin:0;font-size:14px;color:#1e293b;font-weight:600">' + esc(log.user_name || "Admin") + '</p><p style="margin:2px 0 0;font-size:12px;color:#94a3b8">' + esc(log.user_email) + '</p></div>' +
            '<div style="padding:12px;background:#f8fafc;border-radius:8px"><p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Accion</p><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + act.color + '20;color:' + act.color + '">' + act.label + '</span></div>' +
          '</div>' +
          (log.description ? '<div style="padding:12px;background:#f8fafc;border-radius:8px;margin-bottom:16px"><p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">Descripcion</p><p style="margin:0;font-size:14px;color:#475569">' + esc(log.description) + '</p></div>' : '') +
          (oldVal || newVal ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div style="padding:12px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca"><p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase">Valor Anterior</p><pre style="margin:0;font-size:12px;color:#475569;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto">' + esc(oldVal || "N/A") + '</pre></div>' +
            '<div style="padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0"><p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase">Valor Nuevo</p><pre style="margin:0;font-size:12px;color:#475569;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto">' + esc(newVal || "N/A") + '</pre></div>' +
          '</div>' : '');
      })
      .catch(function () {
        content.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444">Error al cargar detalle</div>';
      });
  };

  window.logAuditAction = function (actionType, entityType, entityId, oldValue, newValue, description) {
    var user = null;
    try { user = JSON.parse(localStorage.getItem("imporlan_admin_user") || "null"); } catch (e) {}
    var payload = {
      user_email: user ? (user.email || "") : "",
      user_name: user ? (user.name || user.email || "") : "",
      action_type: actionType,
      entity_type: entityType || null,
      entity_id: entityId || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      description: description || null
    };
    fetch(API_BASE + "/audit_api.php?action=log", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    }).catch(function (e) { console.warn("Audit log failed:", e); });
  };

  function tryInjectSidebar() {
    injectSidebarItem();
  }

  function init() {
    new MutationObserver(tryInjectSidebar).observe(document.body, { childList: true, subtree: true });
    setTimeout(tryInjectSidebar, 1000);
    setTimeout(tryInjectSidebar, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
