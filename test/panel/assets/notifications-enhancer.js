/**
 * Notifications Enhancer - Imporlan User Panel
 * Bell icon with dropdown for user notifications
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

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

  function getUserToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_token") || "";
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getUserToken(),
      "X-User-Email": getUserEmail(),
    };
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return "";
    var now = new Date();
    var d = new Date(dateStr);
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "Hace un momento";
    if (diff < 3600) return "Hace " + Math.floor(diff / 60) + " min";
    if (diff < 86400) return "Hace " + Math.floor(diff / 3600) + " hrs";
    if (diff < 604800) return "Hace " + Math.floor(diff / 86400) + " dias";
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  }

  var bellInjected = false;
  var dropdownOpen = false;
  var lastKnownCount = 0;

  function injectBellIcon() {
    if (bellInjected) return;
    var header = document.querySelector("header");
    if (!header) return;

    var bellContainer = document.createElement("div");
    bellContainer.id = "notif-bell-container";
    bellContainer.style.cssText = "position:relative;display:inline-flex;align-items:center;margin-right:12px;z-index:9999";

    bellContainer.innerHTML =
      '<button id="notif-bell-btn" style="position:relative;background:none;border:none;cursor:pointer;padding:8px;border-radius:10px;transition:all .2s;display:flex;align-items:center;justify-content:center" title="Notificaciones">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;min-width:18px;height:18px;background:#ef4444;color:#fff;border-radius:9px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff">0</span>' +
      '</button>' +
      '<div id="notif-dropdown" style="display:none;position:absolute;top:100%;right:0;width:360px;max-height:440px;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.15);border:1px solid #e2e8f0;overflow:hidden;z-index:10000">' +
      '<div style="padding:16px 20px;background:linear-gradient(135deg,#0f172a,#1e3a5f);display:flex;justify-content:space-between;align-items:center">' +
      '<h4 style="margin:0;color:#fff;font-size:15px;font-weight:700">Notificaciones</h4>' +
      '<button id="notif-mark-all" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:11px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all .2s">Marcar todo leido</button></div>' +
      '<div id="notif-list" style="overflow-y:auto;max-height:350px;padding:8px"></div></div>';

    var navRight = header.querySelector("div:last-child") || header.querySelector("nav") || header;
    if (navRight.parentNode === header) {
      header.insertBefore(bellContainer, navRight);
    } else {
      header.appendChild(bellContainer);
    }
    bellInjected = true;

    var bellBtn = document.getElementById("notif-bell-btn");
    bellBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var dd = document.getElementById("notif-dropdown");
      dropdownOpen = !dropdownOpen;
      dd.style.display = dropdownOpen ? "block" : "none";
      if (dropdownOpen) loadNotifications();
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest("#notif-bell-container")) {
        var dd = document.getElementById("notif-dropdown");
        if (dd) dd.style.display = "none";
        dropdownOpen = false;
      }
    });

    var markAllBtn = document.getElementById("notif-mark-all");
    markAllBtn.addEventListener("click", async function () {
      var email = getUserEmail();
      if (!email) return;
      try {
          await fetch(API_BASE + "/notifications_api.php?action=mark_all_read", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ user_email: email }),
          });
        updateBadge(0);
        loadNotifications();
      } catch (e) {
        console.error("Error marking all read:", e);
      }
    });
  }

  function updateBadge(count) {
    var badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (count > 0) {
      badge.style.display = "flex";
      badge.textContent = count > 99 ? "99+" : count;
    } else {
      badge.style.display = "none";
    }
  }

  async function checkUnreadCount() {
    var email = getUserEmail();
    if (!email) return;
    try {
      var resp = await fetch(API_BASE + "/notifications_api.php?action=unread_count&user_email=" + encodeURIComponent(email), {
        headers: authHeaders(),
      });
      var data = await resp.json();
      if (data.success) {
        var newCount = data.count;
        if (newCount > lastKnownCount && lastKnownCount >= 0) {
          playNotifSound();
        }
        lastKnownCount = newCount;
        updateBadge(newCount);
      }
    } catch (e) {}
  }

  function playNotifSound() {
    try {
      var audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAQqTi8NiPJwBBqOT03pMjAD2n4/TekiQAPqjk9N6SIwA9p+P03pIkAD6o5PTekiMAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA=');
      audio.volume = 0.5;
      audio.play().catch(function() {});
    } catch (e) {}
  }

  async function loadNotifications() {
    var listDiv = document.getElementById("notif-list");
    if (!listDiv) return;

    var email = getUserEmail();
    if (!email) {
      listDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px">Inicia sesion para ver notificaciones</div>';
      return;
    }

    try {
      var resp = await fetch(API_BASE + "/notifications_api.php?action=list&user_email=" + encodeURIComponent(email) + "&limit=20", {
        headers: authHeaders(),
      });
      var data = await resp.json();

      if (data.success && data.notifications && data.notifications.length > 0) {
        var html = "";
        data.notifications.forEach(function (n) {
          var isUnread = !n.read_at;
          var bgColor = isUnread ? "#f0f9ff" : "#fff";
          var borderColor = isUnread ? "#bae6fd" : "#f1f5f9";
          var iconBg = n.type === "report" ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "linear-gradient(135deg,#0891b2,#06b6d4)";

          html += '<div class="notif-item" data-id="' + n.id + '" data-link="' + (n.link || '') + '" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid ' + borderColor + ';background:' + bgColor + ';margin-bottom:6px;cursor:pointer;transition:all .15s" onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'' + bgColor + '\'">' +
            '<div style="width:36px;height:36px;min-width:36px;background:' + iconBg + ';border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
            '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:' + (isUnread ? '700' : '500') + ';color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (n.title || 'Notificacion') + '</div>' +
            '<div style="font-size:12px;color:#64748b;margin-top:2px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + (n.message || '') + '</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-top:4px">' + formatTimeAgo(n.created_at) + '</div></div>' +
            (isUnread ? '<div style="width:8px;height:8px;min-width:8px;background:#3b82f6;border-radius:50%;margin-top:6px"></div>' : '') +
            '</div>';
        });
        listDiv.innerHTML = html;

        listDiv.querySelectorAll(".notif-item").forEach(function (item) {
          item.addEventListener("click", async function () {
            var id = this.getAttribute("data-id");
            var link = this.getAttribute("data-link");
            if (id) {
              try {
                await fetch(API_BASE + "/notifications_api.php?action=mark_read", {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify({ id: parseInt(id) }),
                });
              } catch (e) {}
            }
            if (link) {
              window.open(link, "_blank");
            }
            checkUnreadCount();
          });
        });
      } else {
        listDiv.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="display:block;margin:0 auto 10px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><div style="font-size:13px">No tienes notificaciones</div></div>';
      }
    } catch (e) {
      listDiv.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-size:13px">Error al cargar notificaciones</div>';
    }
  }

  function init() {
    var email = getUserEmail();
    if (!email) return;

    injectBellIcon();
    checkUnreadCount();

    setInterval(checkUnreadCount, 30000);

    setInterval(function () {
      if (!document.getElementById("notif-bell-container")) {
        bellInjected = false;
        injectBellIcon();
        checkUnreadCount();
      }
    }, 5000);
  }

  function startWhenReady() {
    var header = document.querySelector("header");
    if (header) {
      init();
    } else {
      setTimeout(startWhenReady, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(startWhenReady, 2000);
    });
  } else {
    setTimeout(startWhenReady, 2000);
  }
})();
