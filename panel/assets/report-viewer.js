/**
 * Report Viewer - Imporlan User Panel
 * Allows clients to view and download reports from their expedientes
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  function getUserToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_token") || "";
  }

  function getUserEmail() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) {
        var u = JSON.parse(raw);
        return u.email || "";
      }
    } catch (e) {}
    return "";
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getUserToken(),
    };
  }

  function formatDate(d) {
    if (!d) return "-";
    var dt = new Date(d);
    return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function isExpedientePage() {
    var hash = window.location.hash;
    return hash.startsWith("#expediente") || hash.startsWith("#mis-expedientes") || hash.startsWith("#links-contratados");
  }

  async function loadUserReports() {
    var email = getUserEmail();
    if (!email) return;

    try {
      var resp = await fetch(API_BASE + "/reports_api.php?action=user_list&user_email=" + encodeURIComponent(email), {
        headers: authHeaders(),
      });
      var data = await resp.json();
      if (data.success && data.reports && data.reports.length > 0) {
        renderReportsWidget(data.reports);
      }
    } catch (e) {
      console.error("Error loading user reports:", e);
    }
  }

  function renderReportsWidget(reports) {
    var existing = document.getElementById("rv-reports-widget");
    if (existing) existing.remove();

    var widget = document.createElement("div");
    widget.id = "rv-reports-widget";
    widget.style.cssText = "max-width:900px;margin:20px auto;padding:0 20px;animation:rvFadeIn .3s ease";

    var html = '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="padding:20px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);display:flex;align-items:center;gap:14px">' +
      '<div style="width:40px;height:40px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:18px;font-weight:700;color:#fff">Mis Reportes</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.6)">Reportes de busqueda generados por tu asesor</p></div></div>' +
      '<div style="padding:16px 28px">';

    reports.forEach(function (r) {
      var planLabel = r.plan_type || "Reporte";
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-radius:12px;border:1px solid #f1f5f9;margin-bottom:10px;transition:all .2s;background:#fafafa" onmouseover="this.style.background=\'#f0f9ff\';this.style.borderColor=\'#bae6fd\'" onmouseout="this.style.background=\'#fafafa\';this.style.borderColor=\'#f1f5f9\'">' +
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<div style="width:42px;height:42px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
        '<div><div style="font-size:14px;font-weight:600;color:#1e293b">' + planLabel + ' <span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:6px">v' + r.version + '</span></div>' +
        '<div style="font-size:12px;color:#94a3b8;margin-top:2px">' + formatDate(r.created_at) + '</div></div></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="rv-view-btn" data-token="' + (r.access_token || '') + '" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;box-shadow:0 2px 8px rgba(139,92,246,.25)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Ver Reporte</button>' +
        '<button class="rv-download-btn" data-token="' + (r.access_token || '') + '" style="padding:8px 16px;border-radius:10px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> PDF</button>' +
        '</div></div>';
    });

    html += '</div></div>';
    widget.innerHTML = html;

    var main = document.querySelector("main");
    if (main) {
      main.appendChild(widget);
    }

    widget.querySelectorAll(".rv-view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var token = this.getAttribute("data-token");
        if (token) {
          window.open(API_BASE + "/reports_api.php?action=view&token=" + token, "_blank");
        }
      });
    });

    widget.querySelectorAll(".rv-download-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var token = this.getAttribute("data-token");
        if (token) {
          window.open(API_BASE + "/reports_api.php?action=download&token=" + token, "_blank");
        }
      });
    });
  }

  function addStyles() {
    if (document.getElementById("rv-styles")) return;
    var style = document.createElement("style");
    style.id = "rv-styles";
    style.textContent = "@keyframes rvFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}";
    document.head.appendChild(style);
  }

  function init() {
    addStyles();
    loadUserReports();

    window.addEventListener("hashchange", function () {
      var w = document.getElementById("rv-reports-widget");
      if (w) w.remove();
      setTimeout(loadUserReports, 500);
    });

    setInterval(function () {
      var email = getUserEmail();
      if (email && !document.getElementById("rv-reports-widget")) {
        loadUserReports();
      }
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 2000);
    });
  } else {
    setTimeout(init, 2000);
  }
})();
