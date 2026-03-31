(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getAdminToken(),
    };
  }

  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function fmtCLP(n) { return "$" + parseInt(n).toLocaleString("es-CL"); }
  function fmtDate(s) {
    if (!s) return "N/A";
    // Parse YYYY-MM-DD directly to avoid timezone shift
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + "-" + m[2] + "-" + m[1];
    // Fallback for other formats (e.g. "09 Mar 2026")
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      return dd + "-" + mm + "-" + d.getFullYear();
    }
    return s;
  }

  function addSkeletonStyles() {
    if (document.getElementById("enhancer-skeleton-styles")) return;
    var style = document.createElement("style");
    style.id = "enhancer-skeleton-styles";
    style.textContent =
      "@keyframes enhancerPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      "@keyframes enhancerFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}" +
      " main[data-enhancer-section] > *:not([data-enhancer-added]):not([data-enhancer-keep]) { display: none !important; }" +
      // Global admin polish
      " main { animation: enhancerFadeIn .3s ease; }" +
      " main table tbody tr { transition: background .15s; }" +
      " main table tbody tr:hover { background: #f8fafc !important; }" +
      " main input:focus, main select:focus, main textarea:focus { border-color: #0891b2 !important; box-shadow: 0 0 0 3px rgba(8,145,178,.1) !important; }" +
      " main button { transition: all .15s; }" +
      " main button:hover:not(:disabled) { filter: brightness(1.05); }" +
      // Scrollbar polish
      " main ::-webkit-scrollbar { width: 6px; height: 6px; }" +
      " main ::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }" +
      " main ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }" +
      " main ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }";
    document.head.appendChild(style);
  }

  var lastSection = "";
  var enhanced = {};
  var isEnhancing = false;
  var checkTimer = null;
  var configActive = false;

  function getSection() {
    if (configActive) return "Configuracion";
    var h = document.querySelector("main h1");
    return h ? h.textContent.trim() : "";
  }

  function hideReactContent(main) {
    var h1 = main.querySelector("h1");
    var subtitle = h1 ? h1.nextElementSibling : null;
    if (h1) h1.setAttribute("data-enhancer-keep", "true");
    if (subtitle && !subtitle.getAttribute("data-enhancer-added")) {
      subtitle.setAttribute("data-enhancer-keep", "true");
    }
    main.setAttribute("data-enhancer-section", "true");
    var children = Array.from(main.children);
    children.forEach(function (ch) {
      if (ch === h1 || ch === subtitle) return;
      if (ch.getAttribute("data-enhancer-added")) return;
      ch.setAttribute("data-enhancer-hidden", "true");
    });
  }

  function makeSkeletonTable(cols, rows) {
    var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
    html += '<table style="width:100%;border-collapse:collapse"><tbody>';
    for (var i = 0; i < (rows || 5); i++) {
      html += '<tr style="border-bottom:1px solid #f1f5f9">';
      for (var j = 0; j < (cols || 4); j++) {
        html += '<td style="padding:14px 16px"><div style="height:16px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;border-radius:6px;animation:enhancerPulse 1.5s ease-in-out infinite"></div></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  var usersCache = null;

  function renderUserRow(u) {
    var stColor = u.status === "active" ? "#10b981" : "#ef4444";
    var stLabel = u.status === "active" ? "Activo" : "Suspendido";
    var roleLabel = u.role === "admin" ? "Admin" : u.role === "support" ? "Soporte" : "Usuario";
    var roleBg = u.role === "admin" ? "#3b82f6" : u.role === "support" ? "#8b5cf6" : "#64748b";
    var ini = (u.name || "?").charAt(0).toUpperCase();
    var avatarBg = u.source === "real" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#0891b2,#06b6d4)";
    var purchasesInfo = (u.total_purchases || 0) > 0 ? '<span style="font-weight:600;color:#1e293b">' + u.total_purchases + '</span><span style="color:#94a3b8;font-size:11px;display:block">$' + Number(u.total_spent || 0).toLocaleString() + ' CLP</span>' : '<span style="color:#cbd5e1;font-size:12px">-</span>';
    var isReal = u.source === "real";
    var chatBtn = '<button class="enhancer-chat-user" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '" style="padding:6px 12px;border-radius:8px;border:1px solid #8b5cf6;background:transparent;color:#8b5cf6;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>Chat</button>';
    var editBtn = isReal
      ? '<button class="enhancer-edit-real-user" data-email="' + esc(u.email) + '" data-name="' + esc(u.name) + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>'
      : '<button class="enhancer-edit-user" data-id="' + u.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>';
    var actions = isReal
      ? '<div style="display:flex;gap:6px">' + editBtn + chatBtn + '</div>'
      : '<div style="display:flex;gap:6px">' +
        editBtn +
        chatBtn +
        '<button class="enhancer-delete-user" data-id="' + u.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button>' +
        '</div>';
    var secEmailHtml = u.secondary_email ? '<p style="margin:1px 0 0;color:#64748b;font-size:11px" title="Email secundario">CC: ' + esc(u.secondary_email) + '</p>' : '';
    return '<tr style="border-bottom:1px solid #f1f5f9" data-user-id="' + u.id + '">' +
      '<td style="padding:14px 16px"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">' + ini + '</div><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(u.name) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(u.email) + '</p>' + secEmailHtml + '</div></div></td>' +
      '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + roleBg + ';color:#fff">' + roleLabel + '</span></td>' +
      '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + stColor + '20;color:' + stColor + '">' + stLabel + '</span></td>' +
      '<td style="padding:14px 16px;text-align:center">' + purchasesInfo + '</td>' +
      '<td style="padding:14px 16px"><span style="color:#94a3b8;font-size:12px">' + fmtDate(u.created_at) + '</span></td>' +
      '<td style="padding:14px 16px">' + actions + '</td></tr>';
  }

  function renderUserModal(user) {
    var isEdit = !!user;
    var title = isEdit ? "Editar Usuario" : "Nuevo Usuario";
    var name = isEdit ? user.name || "" : "";
    var email = isEdit ? user.email || "" : "";
    var secondaryEmail = isEdit ? user.secondary_email || "" : "";
    var phone = isEdit ? user.phone || "" : "";
    var role = isEdit ? user.role || "user" : "user";
    var status = isEdit ? user.status || "active" : "active";
    return '<div id="enhancer-user-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:enhancerFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;max-height:90vh;overflow-y:auto">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">' + title + '</h3>' +
      '<button id="enhancer-close-user-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label>' +
      '<input id="enhancer-usr-name" value="' + esc(name) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email *</label>' +
      '<input id="enhancer-usr-email" type="email" value="' + esc(email) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="email@ejemplo.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email Secundario <span style="font-weight:400;text-transform:none;font-size:11px">(recibira copia de todos los correos)</span></label>' +
      '<input id="enhancer-usr-secondary-email" type="email" value="' + esc(secondaryEmail) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="segundo@email.com (opcional)"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Contrasena ' + (isEdit ? '(dejar vacio para no cambiar)' : '*') + '</label>' +
      '<div style="display:flex;gap:8px;align-items:center"><input id="enhancer-usr-pass" type="password" style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="********">' +
      (isEdit ? '<button id="enhancer-toggle-pass" type="button" style="padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:18px;cursor:pointer;flex-shrink:0" title="Mostrar/ocultar contrasena">&#128065;</button>' : '') + '</div></div>' +
      (isEdit ? '<div style="margin-top:-8px"><button id="enhancer-send-reset" type="button" style="padding:8px 16px;border-radius:8px;border:1px solid #f97316;background:transparent;color:#f97316;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Enviar Reseteo de Contrasena</button></div>' : '') +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Telefono</label>' +
      '<input id="enhancer-usr-phone" value="' + esc(phone) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="+56 9 1234 5678"></div>' +
      '<div style="display:flex;gap:16px">' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Rol</label>' +
      '<select id="enhancer-usr-role" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' +
      '<option value="admin"' + (role === 'admin' ? ' selected' : '') + '>Admin</option>' +
      '<option value="support"' + (role === 'support' ? ' selected' : '') + '>Soporte</option>' +
      '<option value="user"' + (role === 'user' ? ' selected' : '') + '>Usuario</option></select></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Estado</label>' +
      '<select id="enhancer-usr-status" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' +
      '<option value="active"' + (status === 'active' ? ' selected' : '') + '>Activo</option>' +
      '<option value="suspended"' + (status === 'suspended' ? ' selected' : '') + '>Suspendido</option></select></div></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="enhancer-cancel-user" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '<button id="enhancer-save-user" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">' + (isEdit ? 'Guardar Cambios' : 'Crear Usuario') + '</button>' +
      '</div></div></div></div>';
  }

  function enhanceUsers() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (!h1) return false;
    if (main.querySelector("[data-enhancer-added='users']")) return true;
    hideReactContent(main);
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "users");
    container.style.cssText = "padding:20px 0";
    container.innerHTML =
      // Search + filters + new user
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex:1">' +
      '<div style="position:relative;flex:1;min-width:200px;max-width:350px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="enhancer-user-search" placeholder="Buscar por nombre o email..." style="width:100%;padding:10px 14px 10px 38px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color .2s"></div>' +
      '<select id="enhancer-user-role-filter" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#475569;cursor:pointer"><option value="">Todos los roles</option><option value="admin">Admin</option><option value="support">Soporte</option><option value="user">Usuario</option><option value="agent">Agente</option></select>' +
      '</div>' +
      '<button id="enhancer-new-user" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(16,185,129,.3);white-space:nowrap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Usuario</button></div>' +
      // Stats mini cards
      '<div id="enhancer-user-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px"></div>' +
      // Users count
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span id="enhancer-user-count" style="font-size:13px;color:#64748b"></span></div>' +
      '<div id="enhancer-users-table">' + makeSkeletonTable(6, 4) + '</div>';
    main.appendChild(container);
    loadUsers(container);
    return true;
  }

  var usersMigrationAttempted = false;

  function renderUsersTable(users, tableDiv, container) {
    // Render stats mini cards
    var statsDiv = container.querySelector('#enhancer-user-stats');
    if (statsDiv && usersCache) {
      var all = usersCache;
      var admins = all.filter(function(u) { return u.role === 'admin'; }).length;
      var support = all.filter(function(u) { return u.role === 'support'; }).length;
      var agents = all.filter(function(u) { return u.role === 'agent'; }).length;
      var regular = all.filter(function(u) { return u.role === 'user' || (!u.role); }).length;
      var miniStats = [
        { label: 'Total', value: all.length, color: '#3b82f6' },
        { label: 'Admins', value: admins, color: '#8b5cf6' },
        { label: 'Soporte', value: support, color: '#f59e0b' },
        { label: 'Usuarios', value: regular + agents, color: '#10b981' }
      ];
      statsDiv.innerHTML = miniStats.map(function(s) {
        return '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:12px 16px;display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:' + s.color + '12;display:flex;align-items:center;justify-content:center"><span style="font-size:16px;font-weight:800;color:' + s.color + '">' + s.value + '</span></div>' +
          '<span style="font-size:12px;color:#64748b;font-weight:500">' + s.label + '</span></div>';
      }).join('');
    }

    // Update count
    var countEl = container.querySelector('#enhancer-user-count');
    if (countEl) countEl.textContent = 'Mostrando ' + users.length + ' de ' + (usersCache ? usersCache.length : users.length) + ' usuarios';

    if (users.length === 0) {
      tableDiv.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron usuarios con ese filtro.</div>';
    } else {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
      html += '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">';
      html += '<th style="' + thS + '">Usuario</th><th style="' + thS + '">Rol</th><th style="' + thS + '">Estado</th><th style="' + thS + ';text-align:center">Compras</th><th style="' + thS + '">Creado</th><th style="' + thS + '">Acciones</th>';
      html += '</tr></thead><tbody>';
      users.forEach(function(u) { html += renderUserRow(u); });
      html += '</tbody></table></div>';
      tableDiv.innerHTML = html;
    }

    // Attach search + filter logic
    var searchInput = container.querySelector('#enhancer-user-search');
    var roleFilter = container.querySelector('#enhancer-user-role-filter');
    function applyFilters() {
      if (!usersCache) return;
      var q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      var role = roleFilter ? roleFilter.value : '';
      var filtered = usersCache.filter(function(u) {
        var matchSearch = !q || (u.name || '').toLowerCase().indexOf(q) !== -1 || (u.email || '').toLowerCase().indexOf(q) !== -1;
        var matchRole = !role || u.role === role;
        return matchSearch && matchRole;
      });
      renderUsersTable(filtered, tableDiv, container);
    }
    if (searchInput && !searchInput._bound) { searchInput._bound = true; searchInput.addEventListener('input', applyFilters); }
    if (roleFilter && !roleFilter._bound) { roleFilter._bound = true; roleFilter.addEventListener('change', applyFilters); }

    attachUserListeners(container);
  }

  function loadUsers(container) {
    fetch(API_BASE + "/users_api.php?action=list", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) {
        if (!r.ok && !usersMigrationAttempted) {
          usersMigrationAttempted = true;
          return fetch(API_BASE + "/users_api.php?action=migrate", { headers: authHeaders() })
            .then(function() {
              return fetch(API_BASE + "/users_api.php?action=list", { headers: authHeaders(), cache: "no-store" });
            })
            .then(function(r2) { return r2.json(); });
        }
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        var users = data.users || [];
        // Sort users by date descending (newest first)
        users.sort(function(a, b) {
          var dateA = new Date(a.created_at || 0);
          var dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        usersCache = users;
        var tableDiv = container.querySelector("#enhancer-users-table");
        if (!tableDiv) return;
        renderUsersTable(users, tableDiv, container);
      })
      .catch(function(err) {
        console.warn("Error loading users:", err);
        if (!usersMigrationAttempted) {
          usersMigrationAttempted = true;
          fetch(API_BASE + "/users_api.php?action=migrate", { headers: authHeaders() })
            .then(function() { loadUsers(container); })
            .catch(function() {
              var tableDiv = container.querySelector("#enhancer-users-table");
              if (tableDiv) tableDiv.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar usuarios. Verifique la conexion a la base de datos.</div>';
            });
        } else {
          var tableDiv = container.querySelector("#enhancer-users-table");
          if (tableDiv) tableDiv.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar usuarios. Verifique la conexion a la base de datos.</div>';
        }
      });
  }

  function attachUserListeners(container) {
    var newBtn = document.getElementById("enhancer-new-user");
    if (newBtn) { newBtn.onclick = function() { openUserModal(null, container); }; }
    container.querySelectorAll(".enhancer-edit-user").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        var user = usersCache ? usersCache.find(function(u) { return u.id == id; }) : null;
        if (user) openUserModal(user, container);
      };
    });
    container.querySelectorAll(".enhancer-edit-real-user").forEach(function(btn) {
      btn.onclick = function() {
        var email = this.getAttribute("data-email");
        var name = this.getAttribute("data-name");
        openRealUserEmailModal(email, name, container);
      };
    });
    container.querySelectorAll(".enhancer-chat-user").forEach(function(btn) {
      btn.onclick = function() {
        var email = this.getAttribute("data-email");
        var name = this.getAttribute("data-name");
        if (window.ImporlanAdminChat && window.ImporlanAdminChat.openChatWithUser) {
          window.ImporlanAdminChat.openChatWithUser(email, name);
        } else {
          alert("El widget de chat no esta disponible. Recarga la pagina e intenta de nuevo.");
        }
      };
    });
    container.querySelectorAll(".enhancer-delete-user").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        var user = usersCache ? usersCache.find(function(u) { return u.id == id; }) : null;
        var label = user ? user.name + " (" + user.email + ")" : "ID " + id;
        if (!confirm("¿Eliminar usuario " + label + "?")) return;
        fetch(API_BASE + "/users_api.php?action=delete", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ id: id })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.success) {
            var cont = document.querySelector("[data-enhancer-added='users']");
            if (cont) cont.remove();
            enhanced = {};
            enhanceUsers();
          } else { alert(data.error || "Error"); }
        });
      };
    });
  }

  function renderRealUserEmailModal(oldEmail, userName, secondaryEmail) {
    return '<div id="enhancer-real-user-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:enhancerFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">Editar Usuario</h3>' +
      '<button id="enhancer-close-real-user-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
      '<div style="padding:12px 16px;background:#f0f9ff;border-radius:10px;border:1px solid #bae6fd">' +
      '<p style="margin:0;font-size:13px;color:#0369a1"><strong>Usuario:</strong> ' + esc(userName) + '</p>' +
      '<p style="margin:4px 0 0;font-size:13px;color:#0369a1"><strong>Email actual:</strong> ' + esc(oldEmail) + '</p></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email Principal</label>' +
      '<input id="enhancer-real-usr-new-email" type="email" value="' + esc(oldEmail) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="email@ejemplo.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email Secundario <span style="font-weight:400;text-transform:none;font-size:11px">(recibira copia de todos los correos)</span></label>' +
      '<input id="enhancer-real-usr-secondary-email" type="email" value="' + esc(secondaryEmail || '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="segundo@email.com (opcional)"></div>' +
      '<p style="margin:0;font-size:12px;color:#94a3b8">Cambiar el email principal actualizara todas las compras, cotizaciones y expedientes asociados.</p>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="enhancer-cancel-real-user" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '<button id="enhancer-save-real-user" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Guardar Cambios</button>' +
      '</div></div></div></div>';
  }

  function openRealUserEmailModal(oldEmail, userName, container) {
    var existing = document.getElementById("enhancer-real-user-modal");
    if (existing) existing.remove();
    // Find secondary email from cache
    var currentSecondary = '';
    if (usersCache) {
      var cachedUser = usersCache.find(function(u) { return u.email === oldEmail && u.source === 'real'; });
      if (cachedUser) currentSecondary = cachedUser.secondary_email || '';
    }
    document.body.insertAdjacentHTML("beforeend", renderRealUserEmailModal(oldEmail, userName, currentSecondary));
    var modal = document.getElementById("enhancer-real-user-modal");
    document.getElementById("enhancer-close-real-user-modal").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-cancel-real-user").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-save-real-user").onclick = function() {
      var newEmail = document.getElementById("enhancer-real-usr-new-email").value.trim();
      var newSecondaryEmail = document.getElementById("enhancer-real-usr-secondary-email").value.trim();
      if (!newEmail) { alert("El email es requerido"); return; }
      var saveBtn = document.getElementById("enhancer-save-real-user");
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando...";

      // Sequential: first update primary email if changed, then set secondary email
      var updatePrimary;
      if (newEmail !== oldEmail) {
        updatePrimary = fetch(API_BASE + "/users_api.php?action=update_email", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ old_email: oldEmail, new_email: newEmail })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (!data.success) throw new Error(data.error || "Error al actualizar email");
          return data;
        });
      } else {
        updatePrimary = Promise.resolve(null);
      }

      updatePrimary.then(function() {
        // Now save secondary email using the final primary email
        return fetch(API_BASE + "/users_api.php?action=set_secondary_email", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ primary_email: newEmail, secondary_email: newSecondaryEmail, source: "real" })
        }).then(function(r) { return r.json(); });
      }).then(function(data) {
        if (data && !data.success) {
          alert(data.error || "Error");
          saveBtn.disabled = false;
          saveBtn.textContent = "Guardar Cambios";
        } else {
          modal.remove();
          var cont = document.querySelector("[data-enhancer-added='users']");
          if (cont) cont.remove();
          enhanced = {};
          enhanceUsers();
        }
      }).catch(function(err) { alert(err.message || "Error de conexion"); saveBtn.disabled = false; saveBtn.textContent = "Guardar Cambios"; });
    };
  }

  function openUserModal(user, container) {
    var existing = document.getElementById("enhancer-user-modal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", renderUserModal(user));
    var modal = document.getElementById("enhancer-user-modal");
    document.getElementById("enhancer-close-user-modal").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-cancel-user").onclick = function() { modal.remove(); };
    var toggleBtn = document.getElementById("enhancer-toggle-pass");
    if (toggleBtn) {
      toggleBtn.onclick = function() {
        var passInput = document.getElementById("enhancer-usr-pass");
        if (passInput.type === "password") { passInput.type = "text"; } else { passInput.type = "password"; }
      };
    }
    var resetBtn = document.getElementById("enhancer-send-reset");
    if (resetBtn && user) {
      resetBtn.onclick = function() {
        if (!confirm("¿Enviar email de reseteo de contrasena a " + user.email + "?\n\nSe generara una contrasena temporal y se enviara por email.")) return;
        resetBtn.disabled = true;
        resetBtn.innerHTML = "Enviando...";
        fetch(API_BASE + "/users_api.php?action=send_password_reset", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ id: user.id, email: user.email })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.success) {
            alert(data.message);
            resetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Enviado';
            resetBtn.style.borderColor = "#10b981";
            resetBtn.style.color = "#10b981";
          } else {
            alert(data.error || "Error al enviar reseteo");
            resetBtn.disabled = false;
            resetBtn.innerHTML = 'Enviar Reseteo de Contrasena';
          }
        }).catch(function(err) {
          alert("Error de conexion: " + err.message);
          resetBtn.disabled = false;
          resetBtn.innerHTML = 'Enviar Reseteo de Contrasena';
        });
      };
    }
    document.getElementById("enhancer-save-user").onclick = function() {
      var name = document.getElementById("enhancer-usr-name").value.trim();
      var email = document.getElementById("enhancer-usr-email").value.trim();
      var pass = document.getElementById("enhancer-usr-pass").value;
      if (!name || !email) { alert("Nombre y email son requeridos"); return; }
      if (!user && !pass) { alert("Contrasena es requerida para nuevos usuarios"); return; }
      var secondaryEmail = document.getElementById("enhancer-usr-secondary-email").value.trim();
      var payload = {
        name: name,
        email: email,
        secondary_email: secondaryEmail,
        phone: document.getElementById("enhancer-usr-phone").value.trim(),
        role: document.getElementById("enhancer-usr-role").value,
        status: document.getElementById("enhancer-usr-status").value
      };
      if (pass) payload.password = pass;
      var action = user ? "update" : "create";
      if (user) payload.id = user.id;
      fetch(API_BASE + "/users_api.php?action=" + action, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          // Also save secondary email to the lookup table
          fetch(API_BASE + "/users_api.php?action=set_secondary_email", {
            method: "POST", headers: authHeaders(),
            body: JSON.stringify({ primary_email: email, secondary_email: secondaryEmail, source: "admin", user_id: user ? user.id : data.id })
          }).then(function() {
            modal.remove();
            var cont = document.querySelector("[data-enhancer-added='users']");
            if (cont) cont.remove();
            enhanced = {};
            enhanceUsers();
          });
        } else { alert(data.error || "Error"); }
      });
    };
  }

  function enhanceSolicitudes() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (!h1) return false;
    if (main.querySelector("[data-enhancer-added='solicitudes']")) return true;
    hideReactContent(main);
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "solicitudes");
    container.style.cssText = "padding:20px 0";
    container.innerHTML = makeSkeletonTable(9, 5);
    main.appendChild(container);

    var purchasesPromise = fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.purchases || []; })
      .catch(function () { return []; });

    var quotationsPromise = fetch(API_BASE + "/purchases.php?action=quotation_requests", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.requests || []; })
      .catch(function () { return []; });

    Promise.all([purchasesPromise, quotationsPromise])
      .then(function (results) {
        var purchases = results[0];
        var quotationRequests = results[1];

        // Convert quotation requests to a compatible format and check if already in purchases
        var purchaseEmails = {};
        purchases.forEach(function (p) {
          var key = (p.user_email || p.email || "").toLowerCase();
          if (key) purchaseEmails[key] = true;
        });

        var convertedRequests = [];
        quotationRequests.forEach(function (qr) {
          var qrEmail = (qr.email || "").toLowerCase();
          // Only show quotation requests that don't have a matching purchase
          if (!purchaseEmails[qrEmail]) {
            var linksCount = (qr.boat_links && qr.boat_links.length) || 0;
            var linksDesc = linksCount > 0
              ? "Cotizacion Online - " + linksCount + " links"
              : "Solicitud de cotizacion" + (qr.country ? " - " + qr.country : "");
            convertedRequests.push({
              id: qr.id || "qr",
              type: "quotation_request",
              user_email: qr.email || "",
              description: linksDesc,
              status: "nueva_solicitud",
              amount_clp: 0,
              payment_method: "pendiente",
              timestamp: qr.date || "",
              _name: qr.name || "",
              _phone: qr.phone || "",
              _country: qr.country || "",
              _boat_links: qr.boat_links || [],
              _is_quotation_request: true
            });
          }
        });

        var allItems = convertedRequests.concat(purchases);

        // Sort by date descending (newest first)
        allItems.sort(function(a, b) {
          var dateA = new Date(a.timestamp || a.date || 0);
          var dateB = new Date(b.timestamp || b.date || 0);
          return dateB - dateA;
        });

        if (!Array.isArray(allItems) || allItems.length === 0) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron solicitudes</div>';
          return;
        }
        var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
        var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);overflow-x:auto">';
        html += '<table style="width:100%;border-collapse:collapse"><thead><tr>';
        html += '<th style="' + thS + '">ID</th><th style="' + thS + '">Tipo</th><th style="' + thS + '">Servicio</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Descripcion</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Medio Pago</th><th style="' + thS + '">Fecha</th><th style="' + thS + '">Acciones</th>';
        html += '</tr></thead><tbody>';
        allItems.forEach(function (p, idx) {
          var isQR = p._is_quotation_request;
          var status = isQR ? "nueva_solicitud" : (p.status || "pending");
          var stMap = { nueva_solicitud: { l: "Pendiente", c: "#f59e0b" }, pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Activa", c: "#10b981" }, completed: { l: "Completada", c: "#6366f1" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelada", c: "#ef4444" } };
          var st = stMap[status] || stMap.pending;
          var type = p.type || "link";
          var tipoColor = isQR ? "#0891b2" : (type === "plan" ? "#7c3aed" : "#0891b2");
          var tipoBg = isQR ? "#0891b220" : (type === "plan" ? "#8b5cf620" : "#0891b220");
          var tipoLabel = isQR ? "Link" : (type === "plan" ? "Plan" : "Link");
          var servicioLabel = isQR ? "Cotizacion por Links" : (type === "plan" ? "Plan de Busqueda" : "Cotizacion por Links");
          var servicioColor = isQR ? "#0891b2" : (type === "plan" ? "#7c3aed" : "#0891b2");
          var servicioBg = isQR ? "#0891b215" : (type === "plan" ? "#7c3aed15" : "#0891b215");
          var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual", pendiente: "Sin Pago", transferencia_bancaria: "Transferencia Bancaria", transferencia: "Transferencia Bancaria" };
          var method = mLabels[p.payment_method || p.method] || (p.payment_method || p.method || "N/A");
          var methodColor = (p.payment_method || p.method) === "webpay" ? "#dc2626" : (p.payment_method || p.method) === "mercadopago" ? "#0070ba" : (p.payment_method || p.method) === "paypal" ? "#003087" : (p.payment_method || p.method) === "pendiente" ? "#94a3b8" : (p.payment_method || p.method) === "transferencia_bancaria" || (p.payment_method || p.method) === "transferencia" ? "#16a34a" : "#64748b";
          var email = p.user_email || p.email || "";
          var userName = isQR ? (p._name || (email ? email.split("@")[0] : "Sin nombre")) : (p.payer_name || p.user_name || (email ? email.split("@")[0] : "N/A"));
          var desc = p.description || p.desc || p.plan_name || (isQR ? "Solicitud de cotizacion" : "");
          var amount = p.amount_clp || p.amount || 0;
          var date = p.timestamp || p.date || "";
          var displayId = p.id || (idx + 1);
          var hasLinks = (isQR && p._boat_links && p._boat_links.length > 0) || (!isQR && type === "link");
          var rowId = "sol-row-" + idx;
          html += '<tr id="' + rowId + '" style="border-bottom:1px solid #f1f5f9' + (hasLinks ? ';cursor:pointer' : '') + '" ' + (hasLinks ? 'class="enhancer-clickable-row" data-row-idx="' + idx + '"' : '') + '>';
          html += '<td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(displayId)) + '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:' + tipoBg + ';color:' + tipoColor + '">' + tipoLabel + '</span></td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + servicioBg + ';color:' + servicioColor + '">' + servicioLabel + '</span></td>';
          html += '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(email) + '</p></div></td>';
          html += '<td style="padding:14px 16px;font-size:13px;color:#475569;max-width:250px">';
          if (hasLinks) {
            html += '<span style="display:inline-flex;align-items:center;gap:4px;color:#0891b2;font-weight:500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ' + esc(desc) + '</span>';
          } else {
            html += '<span title="' + esc(desc) + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:200px">' + esc(desc) + '</span>';
          }
          html += '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td>';
          html += '<td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(amount) + '</td>';
          var isPendiente = (p.payment_method || p.method) === 'pendiente';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + methodColor + '15;color:' + methodColor + '">' + esc(method) + '</span>';
          if (isPendiente) {
            html += '<p style="margin:4px 0 0;font-size:10px;color:#f59e0b;font-weight:500">Pendiente de pago para procesar solicitud</p>';
          }
          html += '</td>';
          html += '<td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(date) + '</td>';
          html += '<td style="padding:14px 16px;white-space:nowrap">';
          if (isPendiente && email) {
            html += '<button class="enhancer-request-pay" data-sol-id="' + esc(String(displayId)) + '" data-sol-email="' + esc(email) + '" data-sol-name="' + esc(userName) + '" style="padding:6px 10px;border-radius:8px;border:1px solid #f59e0b;background:transparent;color:#f59e0b;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s;margin-right:6px" title="Enviar recordatorio de pago"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Solicitar Pago</button>';
          }
          html += '<button class="enhancer-delete-sol" data-sol-id="' + esc(String(displayId)) + '" data-sol-type="' + (isQR ? 'qr' : 'purchase') + '" style="padding:6px 10px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s" title="Eliminar solicitud"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>';
          html += '</tr>';
          // Hidden detail row for boat links
          if (hasLinks) {
            var links = isQR ? (p._boat_links || []) : [];
            // For purchases, try to extract links from description
            if (!isQR && type === "link") {
              var descText = p.description || "";
              if (descText.indexOf("http") !== -1) {
                var urlRegex = /https?:\/\/[^\s,|]+/g;
                var matches = descText.match(urlRegex);
                if (matches) links = matches;
              }
            }
            html += '<tr id="' + rowId + '-detail" style="display:none;background:#f8fafc">';
            html += '<td colspan="10" style="padding:0 16px 16px 52px">';
            html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:4px">';
            if (isQR) {
              html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px">';
              html += '<div><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Nombre</span><p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#1e293b">' + esc(p._name || "Sin nombre") + '</p></div>';
              html += '<div><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Email</span><p style="margin:4px 0 0;font-size:14px;color:#1e293b">' + (email ? '<a href="mailto:' + esc(email) + '" style="color:#0891b2;text-decoration:none">' + esc(email) + '</a>' : '<span style="color:#94a3b8">No disponible</span>') + '</p></div>';
              html += '<div><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Telefono</span><p style="margin:4px 0 0;font-size:14px;color:#1e293b">' + esc(p._phone || "No disponible") + '</p></div>';
              html += '<div><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Pais</span><p style="margin:4px 0 0;font-size:14px;color:#1e293b">' + esc(p._country || "Chile") + '</p></div>';
              html += '</div>';
            }
            if (links.length > 0) {
              html += '<div style="margin-top:8px"><span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;display:block;margin-bottom:8px">Links Solicitados (' + links.length + ')</span>';
              html += '<div style="display:flex;flex-direction:column;gap:6px">';
              links.forEach(function(link, li) {
                html += '<a href="' + esc(link) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;text-decoration:none;color:#0369a1;font-size:13px;transition:background .15s">';
                html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" style="flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
                html += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Link ' + (li + 1) + ': ' + esc(link) + '</span></a>';
              });
              html += '</div></div>';
            } else if (!isQR) {
              html += '<p style="margin:8px 0 0;font-size:13px;color:#64748b">' + esc(desc) + '</p>';
            }
            html += '</div></td></tr>';
          }
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Attach "Solicitar Pago" handlers
        container.querySelectorAll(".enhancer-request-pay").forEach(function(btn) {
          btn.addEventListener("mouseenter", function() { btn.style.background = "#f59e0b"; btn.style.color = "#fff"; });
          btn.addEventListener("mouseleave", function() { btn.style.background = "transparent"; btn.style.color = "#f59e0b"; });
          btn.addEventListener("click", function(e) {
            e.stopPropagation();
            var solId = btn.getAttribute("data-sol-id");
            var solEmail = btn.getAttribute("data-sol-email");
            var solName = btn.getAttribute("data-sol-name");
            if (!confirm("Enviar recordatorio de pago a " + solEmail + "?")) return;
            btn.disabled = true;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> Enviando...';
            btn.style.opacity = "0.7";
            fetch(API_BASE + "/purchases.php?action=request_payment", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ id: solId })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.success) {
                btn.style.background = "#10b981";
                btn.style.border = "1px solid #10b981";
                btn.style.color = "#fff";
                btn.style.opacity = "1";
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Enviado a ' + solEmail;
              } else {
                alert(data.error || "Error al enviar recordatorio");
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Solicitar Pago';
              }
            })
            .catch(function() {
              alert("Error de conexion al enviar recordatorio");
              btn.disabled = false;
              btn.style.opacity = "1";
              btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Solicitar Pago';
            });
          });
        });

        // Attach click handlers for expandable rows
        container.querySelectorAll(".enhancer-clickable-row").forEach(function(row) {
          row.addEventListener("click", function(e) {
            // Don't toggle if clicking delete button, payment button, or a link
            if (e.target.closest(".enhancer-delete-sol") || e.target.closest(".enhancer-request-pay") || e.target.closest("a")) return;
            var detailId = row.id + "-detail";
            var detail = document.getElementById(detailId);
            if (detail) {
              var isVisible = detail.style.display !== "none";
              detail.style.display = isVisible ? "none" : "table-row";
              row.style.borderBottom = isVisible ? "1px solid #f1f5f9" : "none";
            }
          });
          // Hover effect
          row.addEventListener("mouseenter", function() { row.style.opacity = "0.85"; });
          row.addEventListener("mouseleave", function() { row.style.opacity = "1"; });
        });

        // Attach delete handlers
        container.querySelectorAll(".enhancer-delete-sol").forEach(function(btn) {
          btn.addEventListener("mouseenter", function() { btn.style.background = "#ef4444"; btn.style.color = "#fff"; });
          btn.addEventListener("mouseleave", function() { btn.style.background = "transparent"; btn.style.color = "#ef4444"; });
          btn.addEventListener("click", function(e) {
            e.stopPropagation();
            var solId = btn.getAttribute("data-sol-id");
            if (!confirm("Eliminar solicitud #" + solId + "?")) return;
            btn.disabled = true;
            btn.style.opacity = "0.5";
            fetch(API_BASE + "/purchases.php?action=delete_solicitud", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ id: solId })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.success) {
                var row = btn.closest("tr");
                if (row) {
                  var detailRow = document.getElementById(row.id + "-detail");
                  if (detailRow) detailRow.remove();
                  row.style.transition = "opacity .3s";
                  row.style.opacity = "0";
                  setTimeout(function() { row.remove(); }, 300);
                }
              } else {
                alert(data.error || "Error al eliminar");
                btn.disabled = false;
                btn.style.opacity = "1";
              }
            })
            .catch(function() {
              alert("Error de conexion al eliminar");
              btn.disabled = false;
              btn.style.opacity = "1";
            });
          });
        });
      })
      .catch(function (err) {
        console.warn("Error loading solicitudes:", err);
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar solicitudes</div>';
      });
    return true;
  }

  function cleanupEnhancer() {
    configActive = false;
    var main = document.querySelector("main");
    if (!main) return;
    main.removeAttribute("data-enhancer-section");
    main.querySelectorAll("[data-enhancer-keep]").forEach(function (el) {
      el.removeAttribute("data-enhancer-keep");
    });
    main.querySelectorAll("[data-enhancer-hidden]").forEach(function (el) {
      el.style.display = "";
      el.removeAttribute("data-enhancer-hidden");
    });
    main.querySelectorAll("[data-enhancer-added]").forEach(function (el) {
      el.remove();
    });
  }

  var planesMigrationAttempted = false;
  var planesCache = [];

  function enhancePlanes() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (!h1) return false;
    if (main.querySelector("[data-enhancer-added='plans']")) return true;
    hideReactContent(main);
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "plans");
    container.style.cssText = "padding:20px 0";
    container.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button id="enhancer-new-plan" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(16,185,129,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Plan</button></div>' +
      '<div id="enhancer-plans-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px">' + makeSkeletonTable(3, 3) + '</div>';
    main.appendChild(container);
    loadPlanes(container);
    return true;
  }

  function loadPlanes(container) {
    fetch(API_BASE + "/config_api.php?action=plans_list", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) {
        if (!r.ok && !planesMigrationAttempted) {
          planesMigrationAttempted = true;
          return fetch(API_BASE + "/config_api.php?action=migrate", { headers: authHeaders() })
            .then(function() {
              return fetch(API_BASE + "/config_api.php?action=plans_list", { headers: authHeaders(), cache: "no-store" });
            })
            .then(function(r2) { return r2.json(); });
        }
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        planesCache = data.plans || [];
        var grid = container.querySelector("#enhancer-plans-grid");
        if (!grid) return;
        renderPlanesGrid(planesCache, grid, container);
      })
      .catch(function(err) {
        console.warn("Error loading planes:", err);
        if (!planesMigrationAttempted) {
          planesMigrationAttempted = true;
          fetch(API_BASE + "/config_api.php?action=migrate", { headers: authHeaders() })
            .then(function() { loadPlanes(container); })
            .catch(function() {
              var grid = container.querySelector("#enhancer-plans-grid");
              if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px;grid-column:1/-1">Error al cargar planes. Verifique la conexion a la base de datos.</div>';
            });
        } else {
          var grid = container.querySelector("#enhancer-plans-grid");
          if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px;grid-column:1/-1">Error al cargar planes. Verifique la conexion a la base de datos.</div>';
        }
      });
  }

  function renderPlanCard(p) {
    var activeBg = p.is_active == 1 ? "#10b981" : "#94a3b8";
    var activeLabel = p.is_active == 1 ? "Activo" : "Inactivo";
    var featuresHtml = "";
    if (p.features) {
      featuresHtml = '<div style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:4px">';
      p.features.split(",").forEach(function(f) {
        if (f.trim()) featuresHtml += '<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#ecfdf5;color:#059669;font-size:11px;font-weight:500">' + esc(f.trim()) + '</span>';
      });
      featuresHtml += '</div>';
    }
    return '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,.06)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700;color:#1e293b">' + esc(p.name) + '</h3>' +
      '<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + activeBg + '20;color:' + activeBg + '">' + activeLabel + '</span></div>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.5">' + esc(p.description || '') + '</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
      '<span style="padding:5px 12px;border-radius:8px;background:#f0f9ff;color:#0891b2;font-size:13px;font-weight:700">' + fmtCLP(p.price_clp || 0) + '</span>' +
      '<span style="padding:5px 12px;border-radius:8px;background:#fef3c7;color:#d97706;font-size:13px;font-weight:700">USD $' + (p.price_usd || 0) + '</span></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
      '<span style="padding:4px 10px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600">' + (p.max_links || 0) + ' links</span>' +
      '<span style="padding:4px 10px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600">' + (p.duration_days || 0) + ' dias</span></div>' +
      featuresHtml +
      '<div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #f1f5f9;padding-top:16px">' +
      '<button class="enhancer-edit-plan" data-id="' + p.id + '" style="padding:6px 14px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>' +
      '<button class="enhancer-delete-plan" data-id="' + p.id + '" style="padding:6px 14px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button></div></div>';
  }

  function renderPlanesGrid(plans, grid, container) {
    if (plans.length === 0) {
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;grid-column:1/-1">No hay planes. Crea uno nuevo.</div>';
    } else {
      var html = "";
      plans.forEach(function(p) { html += renderPlanCard(p); });
      grid.innerHTML = html;
    }
    attachPlanListeners(container);
  }

  function attachPlanListeners(container) {
    var newBtn = container.querySelector("#enhancer-new-plan");
    if (newBtn) newBtn.onclick = function() { openPlanModalPlanes(null, container); };
    container.querySelectorAll(".enhancer-edit-plan").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        var plan = planesCache.find(function(p) { return p.id == id; });
        if (plan) openPlanModalPlanes(plan, container);
      };
    });
    container.querySelectorAll(".enhancer-delete-plan").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        if (!confirm("Eliminar este plan?")) return;
        fetch(API_BASE + "/config_api.php?action=plans_delete", { method: "POST", headers: authHeaders(), body: JSON.stringify({ id: id }) })
          .then(function(r) { return r.json(); })
          .then(function(d) { if (d.success) loadPlanes(container); else alert(d.error || "Error"); });
      };
    });
  }

  function openPlanModalPlanes(plan, container) {
    var existing = document.getElementById("enhancer-plan-modal");
    if (existing) existing.remove();
    var isEdit = !!plan;
    var html = '<div id="enhancer-plan-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:enhancerFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">' + (isEdit ? "Editar Plan" : "Nuevo Plan") + '</h3>' +
      '<button id="enhancer-close-plan-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label>' +
      '<input id="enhancer-pl-name" value="' + esc(plan ? plan.name : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Nombre del plan"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Descripcion</label>' +
      '<textarea id="enhancer-pl-desc" rows="2" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;resize:vertical">' + esc(plan ? plan.description : '') + '</textarea></div>' +
      '<div style="display:flex;gap:12px"><div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Precio CLP</label>' +
      '<input id="enhancer-pl-clp" type="number" value="' + (plan ? plan.price_clp || 0 : 0) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Precio USD</label>' +
      '<input id="enhancer-pl-usd" type="number" step="0.01" value="' + (plan ? plan.price_usd || 0 : 0) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div></div>' +
      '<div style="display:flex;gap:12px"><div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Max Links</label>' +
      '<input id="enhancer-pl-links" type="number" value="' + (plan ? plan.max_links || 5 : 5) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Duracion (dias)</label>' +
      '<input id="enhancer-pl-days" type="number" value="' + (plan ? plan.duration_days || 30 : 30) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Caracteristicas (separadas por coma)</label>' +
      '<input id="enhancer-pl-feat" value="' + esc(plan ? plan.features : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Feature 1,Feature 2"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="enhancer-cancel-plan" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '<button id="enhancer-save-plan" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">' + (isEdit ? "Guardar Cambios" : "Crear Plan") + '</button></div></div></div></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("enhancer-plan-modal");
    document.getElementById("enhancer-close-plan-modal").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-cancel-plan").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-save-plan").onclick = function() {
      var name = document.getElementById("enhancer-pl-name").value.trim();
      if (!name) { alert("Nombre requerido"); return; }
      var payload = {
        name: name,
        description: document.getElementById("enhancer-pl-desc").value.trim(),
        price_clp: parseInt(document.getElementById("enhancer-pl-clp").value) || 0,
        price_usd: parseFloat(document.getElementById("enhancer-pl-usd").value) || 0,
        max_links: parseInt(document.getElementById("enhancer-pl-links").value) || 5,
        duration_days: parseInt(document.getElementById("enhancer-pl-days").value) || 30,
        features: document.getElementById("enhancer-pl-feat").value.trim()
      };
      var action = isEdit ? "plans_update" : "plans_create";
      if (isEdit) payload.id = plan.id;
      fetch(API_BASE + "/config_api.php?action=" + action, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.success) { modal.remove(); loadPlanes(container); }
          else alert(d.error || "Error");
        });
    };
  }

  function enhancePagos() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (!h1) return false;
    if (main.querySelector("[data-enhancer-added='pagos']")) return true;
    hideReactContent(main);
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "pagos");
    container.style.cssText = "padding:20px 0";
    container.innerHTML = makeSkeletonTable(7, 5);
    main.appendChild(container);
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        purchases.sort(function(a, b) {
          return new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0);
        });

        // Calculate summary stats
        var paid = purchases.filter(function(p) { return p.status === 'active' || p.status === 'paid' || p.status === 'completed'; });
        var pending = purchases.filter(function(p) { return p.status === 'pending' || p.status === 'en_revision'; });
        var totalRevenue = paid.reduce(function(s, p) { return s + (parseFloat(p.amount_clp || p.amount) || 0); }, 0);
        var pendingAmount = pending.reduce(function(s, p) { return s + (parseFloat(p.amount_clp || p.amount) || 0); }, 0);

        // Summary cards
        var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">';
        var summaryCards = [
          { label: 'Total Recaudado', value: fmtCLP(totalRevenue), color: '#10b981', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
          { label: 'Pagos Completados', value: paid.length, color: '#3b82f6', icon: '<polyline points="20 6 9 17 4 12"/>' },
          { label: 'Pendientes', value: pending.length, color: '#f59e0b', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
          { label: 'Monto Pendiente', value: fmtCLP(pendingAmount), color: '#8b5cf6', icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' }
        ];
        summaryCards.forEach(function(c) {
          html += '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 20px;display:flex;align-items:center;gap:12px">' +
            '<div style="width:42px;height:42px;border-radius:12px;background:' + c.color + '12;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c.color + '" stroke-width="2">' + c.icon + '</svg></div>' +
            '<div><p style="margin:0;font-size:22px;font-weight:800;color:#0f172a">' + c.value + '</p>' +
            '<p style="margin:1px 0 0;font-size:11px;color:#64748b">' + c.label + '</p></div></div>';
        });
        html += '</div>';

        // Search bar
        html += '<div style="display:flex;gap:10px;margin-bottom:14px;align-items:center">' +
          '<div style="position:relative;flex:1;max-width:350px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '<input id="enhancer-pagos-search" placeholder="Buscar por email o descripcion..." style="width:100%;padding:10px 14px 10px 38px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;box-sizing:border-box"></div>' +
          '<span style="font-size:13px;color:#64748b">' + purchases.length + ' transacciones</span></div>';

        if (purchases.length === 0) {
          html += '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron pagos</div>';
        } else {
          var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
          html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
          html += '<table id="enhancer-pagos-table" style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc">';
          html += '<th style="' + thS + '">ID</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Proveedor</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Fecha</th><th style="' + thS + '">Detalle</th>';
          html += '</tr></thead><tbody>';
          purchases.forEach(function (p, idx) {
            var status = p.status || "pending";
            var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Pagado", c: "#10b981" }, completed: { l: "Pagado", c: "#10b981" }, paid: { l: "Pagado", c: "#10b981" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelado", c: "#ef4444" } };
            var st = stMap[status] || stMap.pending;
            var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual", transferencia_bancaria: "Transferencia", transferencia: "Transferencia" };
            var method = mLabels[p.payment_method || p.method] || (p.payment_method || p.method || "N/A");
            var mColors = { WebPay: '#E31837', MercadoPago: '#00B1EA', PayPal: '#003087', Transferencia: '#059669' };
            var mColor = mColors[method] || '#64748b';
            var email = p.user_email || p.email || "";
            var userName = email.split("@")[0];
            html += '<tr style="border-bottom:1px solid #f1f5f9" data-search="' + esc((email + ' ' + (p.description || '') + ' ' + (p.plan_name || '')).toLowerCase()) + '">';
            html += '<td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(p.id || idx + 1)) + '</td>';
            html += '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:13px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:11px">' + esc(email) + '</p></div></td>';
            html += '<td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:14px">' + fmtCLP(p.amount_clp || p.amount || 0) + '</td>';
            html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + mColor + '12;color:' + mColor + ';border:1px solid ' + mColor + '25">' + esc(method) + '</span></td>';
            html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + st.c + '15;color:' + st.c + '">' + st.l + '</span></td>';
            html += '<td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(p.timestamp || p.date || "") + '</td>';
            html += '<td style="padding:14px 16px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(p.description || p.plan_name || '') + '">' + esc(p.description || p.desc || p.plan_name || "") + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        container.innerHTML = html;

        // Search functionality
        var searchInput = container.querySelector('#enhancer-pagos-search');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            var q = this.value.toLowerCase().trim();
            var rows = container.querySelectorAll('#enhancer-pagos-table tbody tr');
            rows.forEach(function(row) {
              var searchText = row.getAttribute('data-search') || '';
              row.style.display = (!q || searchText.indexOf(q) !== -1) ? '' : 'none';
            });
          });
        }
      })
      .catch(function (err) {
        console.warn("Error loading pagos:", err);
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar pagos</div>';
      });
    return true;
  }

  function makeStars(rating) {
    var starOn = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var starOff = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var s = ""; for (var i = 0; i < 5; i++) s += i < rating ? starOn : starOff; return s;
  }

  function renderReviewCard(r) {
    var ini = (r.author_name || "?").charAt(0).toUpperCase();
    var activeLabel = r.is_active == 1 ? "Activa" : "Inactiva";
    var activeBg = r.is_active == 1 ? "#10b981" : "#94a3b8";
    return '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);position:relative" data-review-id="' + r.id + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="display:flex;gap:6px;align-items:center"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#0891b220;color:#0891b2;text-transform:uppercase;letter-spacing:.04em">Resena</span>' +
      '<span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;background:' + activeBg + '20;color:' + activeBg + '">' + activeLabel + '</span></div>' +
      '<div style="display:flex;gap:2px">' + makeStars(r.rating || 5) + '</div></div>' +
      '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;font-style:italic">' + esc(r.review_text) + '</p>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:12px">' +
      '<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + ini + '</div>' +
      '<div><p style="margin:0;font-weight:600;color:#1e293b;font-size:13px">' + esc(r.author_name) + '</p><p style="margin:1px 0 0;color:#94a3b8;font-size:12px">' + esc(r.author_role || '') + '</p></div></div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="enhancer-edit-review" data-id="' + r.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s">Editar</button>' +
      '<button class="enhancer-delete-review" data-id="' + r.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s">Eliminar</button>' +
      '</div></div></div>';
  }

  function renderReviewModal(review) {
    var isEdit = !!review;
    var title = isEdit ? "Editar Resena" : "Nueva Resena";
    var name = isEdit ? review.author_name || "" : "";
    var role = isEdit ? review.author_role || "" : "";
    var text = isEdit ? review.review_text || "" : "";
    var rating = isEdit ? (review.rating || 5) : 5;
    var active = isEdit ? review.is_active : 1;
    return '<div id="enhancer-review-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:enhancerFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">' + title + '</h3>' +
      '<button id="enhancer-close-review-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre del Autor *</label>' +
      '<input id="enhancer-rv-name" value="' + esc(name) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Rol / Ciudad</label>' +
      '<input id="enhancer-rv-role" value="' + esc(role) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Ej: Empresario, Santiago"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Texto de la Resena *</label>' +
      '<textarea id="enhancer-rv-text" rows="4" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box" placeholder="Texto de la resena...">' + esc(text) + '</textarea></div>' +
      '<div style="display:flex;gap:16px">' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Rating (1-5)</label>' +
      '<select id="enhancer-rv-rating" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' +
      [1,2,3,4,5].map(function(n){ return '<option value="' + n + '"' + (n == rating ? ' selected' : '') + '>' + n + ' estrella' + (n > 1 ? 's' : '') + '</option>'; }).join('') +
      '</select></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Estado</label>' +
      '<select id="enhancer-rv-active" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' +
      '<option value="1"' + (active == 1 ? ' selected' : '') + '>Activa</option><option value="0"' + (active == 0 ? ' selected' : '') + '>Inactiva</option></select></div></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="enhancer-cancel-review" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '<button id="enhancer-save-review" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">' + (isEdit ? 'Guardar Cambios' : 'Crear Resena') + '</button>' +
      '</div></div></div></div>';
  }

  var reviewsCache = null;

  function enhanceContenido() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (!h1) return false;
    if (main.querySelector("[data-enhancer-added='contenido']")) return true;
    hideReactContent(main);
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "contenido");
    container.style.cssText = "padding:20px 0";
    container.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button id="enhancer-new-review" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(16,185,129,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva Resena</button></div>' +
      '<div id="enhancer-reviews-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">' + makeSkeletonTable(1, 3) + '</div>';
    main.appendChild(container);

    loadReviews(container);
    return true;
  }

  var reviewsMigrationAttempted = false;

  function loadReviews(container) {
    fetch(API_BASE + "/reviews_api.php?action=list", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) {
        if (!r.ok && !reviewsMigrationAttempted) {
          reviewsMigrationAttempted = true;
          return fetch(API_BASE + "/reviews_api.php?action=migrate", { headers: authHeaders() })
            .then(function() {
              return fetch(API_BASE + "/reviews_api.php?action=list", { headers: authHeaders(), cache: "no-store" });
            })
            .then(function(r2) { return r2.json(); });
        }
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        var reviews = data.reviews || [];
        // Sort reviews by date descending (newest first)
        reviews.sort(function(a, b) {
          var dateA = new Date(a.created_at || 0);
          var dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        reviewsCache = reviews;
        var grid = container.querySelector("#enhancer-reviews-grid");
        if (!grid) return;
        if (reviews.length === 0) {
          grid.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;grid-column:1/-1">No hay resenas. Crea una nueva.</div>';
        } else {
          var html = "";
          reviews.forEach(function(r) { html += renderReviewCard(r); });
          grid.innerHTML = html;
        }
        attachReviewListeners(container);
      })
      .catch(function(err) {
        console.warn("Error loading reviews:", err);
        if (!reviewsMigrationAttempted) {
          reviewsMigrationAttempted = true;
          fetch(API_BASE + "/reviews_api.php?action=migrate", { headers: authHeaders() })
            .then(function() { loadReviews(container); })
            .catch(function() {
              var grid = container.querySelector("#enhancer-reviews-grid");
              if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px;grid-column:1/-1">Error al cargar resenas. Verifique la conexion a la base de datos.</div>';
            });
        } else {
          var grid = container.querySelector("#enhancer-reviews-grid");
          if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px;grid-column:1/-1">Error al cargar resenas. Verifique la conexion a la base de datos.</div>';
        }
      });
  }

  function attachReviewListeners(container) {
    var newBtn = document.getElementById("enhancer-new-review");
    if (newBtn) {
      newBtn.onclick = function() { openReviewModal(null, container); };
    }
    container.querySelectorAll(".enhancer-edit-review").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        var review = reviewsCache ? reviewsCache.find(function(r) { return r.id == id; }) : null;
        if (review) openReviewModal(review, container);
      };
    });
    container.querySelectorAll(".enhancer-delete-review").forEach(function(btn) {
      btn.onclick = function() {
        var id = parseInt(this.getAttribute("data-id"));
        if (!confirm("¿Eliminar esta resena?")) return;
        fetch(API_BASE + "/reviews_api.php?action=delete", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ id: id })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.success) {
            enhanced = {};
            enhanceContenido();
          }
        });
      };
    });
  }

  function openReviewModal(review, container) {
    var existing = document.getElementById("enhancer-review-modal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", renderReviewModal(review));
    var modal = document.getElementById("enhancer-review-modal");
    document.getElementById("enhancer-close-review-modal").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-cancel-review").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-save-review").onclick = function() {
      var name = document.getElementById("enhancer-rv-name").value.trim();
      var text = document.getElementById("enhancer-rv-text").value.trim();
      if (!name || !text) { alert("Nombre y texto son requeridos"); return; }
      var payload = {
        author_name: name,
        author_role: document.getElementById("enhancer-rv-role").value.trim(),
        review_text: text,
        rating: parseInt(document.getElementById("enhancer-rv-rating").value),
        is_active: parseInt(document.getElementById("enhancer-rv-active").value)
      };
      var action = review ? "update" : "create";
      if (review) payload.id = review.id;
      fetch(API_BASE + "/reviews_api.php?action=" + action, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success) {
          modal.remove();
          var cont = document.querySelector("[data-enhancer-added='contenido']");
          if (cont) cont.remove();
          enhanced = {};
          enhanceContenido();
        } else { alert(data.error || "Error"); }
      });
    };
  }

  var configTab = "plans";
  var plansCache = null;
  var agentsCache = null;

  function enhanceConfiguracion() {
    var main = document.querySelector("main");
    if (!main) return false;
    if (main.querySelector("[data-enhancer-added='config']")) return true;
    isEnhancing = true;
    try {
      var children = Array.from(main.children);
      children.forEach(function(ch) {
        if (ch.getAttribute("data-enhancer-added")) return;
        ch.style.display = "none";
        ch.setAttribute("data-enhancer-hidden", "true");
      });
      var container = document.createElement("div");
      container.setAttribute("data-enhancer-added", "config");
      container.style.cssText = "padding:20px 0;max-width:1200px;margin:0 auto";
      container.innerHTML = '<h1 style="font-size:24px;font-weight:700;color:#1e293b;margin:0 0 20px">Configuracion</h1>' +
        '<div style="display:flex;gap:8px;margin-bottom:20px">' +
        '<button class="cfg-tab" data-tab="plans" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#0891b2;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Planes</button>' +
        '<button class="cfg-tab" data-tab="agents" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:600;cursor:pointer">Agentes</button>' +
        '<button class="cfg-tab" data-tab="pricing" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:600;cursor:pointer">Precios</button></div>' +
        '<div id="cfg-content">' + makeSkeletonTable(3, 3) + '</div>';
      main.appendChild(container);
      container.querySelectorAll(".cfg-tab").forEach(function(btn) {
        btn.onclick = function() {
          configTab = this.getAttribute("data-tab");
          container.querySelectorAll(".cfg-tab").forEach(function(b) {
            b.style.background = "#fff"; b.style.color = "#64748b";
          });
          this.style.background = "#0891b2"; this.style.color = "#fff";
          loadConfigTab(container);
        };
      });
      loadConfigTab(container);
    } finally { isEnhancing = false; }
    return true;
  }

  function loadConfigTab(container) {
    var content = container.querySelector("#cfg-content");
    if (!content) return;
    content.innerHTML = makeSkeletonTable(3, 3);
    if (configTab === "plans") loadPlans(content);
    else if (configTab === "agents") loadAgents(content);
    else if (configTab === "pricing") loadPricing(content);
  }

  function loadPlans(content) {
    fetch(API_BASE + "/config_api.php?action=plans_list", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        plansCache = data.plans || [];
        var html = '<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button id="cfg-new-plan" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Plan</button></div>';
        if (plansCache.length === 0) {
          html += '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No hay planes</div>';
        } else {
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">';
          plansCache.forEach(function(p) {
            var activeBg = p.is_active == 1 ? "#10b981" : "#94a3b8";
            html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04)">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
              '<h3 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">' + esc(p.name) + '</h3>' +
              '<span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;background:' + activeBg + '20;color:' + activeBg + '">' + (p.is_active == 1 ? "Activo" : "Inactivo") + '</span></div>' +
              '<p style="margin:0 0 12px;font-size:13px;color:#64748b">' + esc(p.description || '') + '</p>' +
              '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
              '<span style="padding:4px 8px;border-radius:6px;background:#f0f9ff;color:#0891b2;font-size:12px;font-weight:600">' + fmtCLP(p.price_clp || 0) + '</span>' +
              '<span style="padding:4px 8px;border-radius:6px;background:#fef3c7;color:#d97706;font-size:12px;font-weight:600">USD $' + (p.price_usd || 0) + '</span>' +
              '<span style="padding:4px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600">' + (p.max_links || 0) + ' links</span>' +
              '<span style="padding:4px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600">' + (p.duration_days || 0) + ' dias</span></div>' +
              (p.features ? '<div style="margin-bottom:12px">' + p.features.split(',').map(function(f) { return '<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#ecfdf5;color:#059669;font-size:11px;font-weight:500;margin:2px 4px 2px 0">' + esc(f.trim()) + '</span>'; }).join('') + '</div>' : '') +
              '<div style="display:flex;gap:6px;justify-content:flex-end">' +
              '<button class="cfg-edit-plan" data-id="' + p.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>' +
              '<button class="cfg-delete-plan" data-id="' + p.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button></div></div>';
          });
          html += '</div>';
        }
        content.innerHTML = html;
        document.getElementById("cfg-new-plan").onclick = function() { openPlanModal(null, content); };
        content.querySelectorAll(".cfg-edit-plan").forEach(function(btn) {
          btn.onclick = function() {
            var id = parseInt(this.getAttribute("data-id"));
            var plan = plansCache.find(function(p) { return p.id == id; });
            if (plan) openPlanModal(plan, content);
          };
        });
        content.querySelectorAll(".cfg-delete-plan").forEach(function(btn) {
          btn.onclick = function() {
            var id = parseInt(this.getAttribute("data-id"));
            if (!confirm("¿Eliminar este plan?")) return;
            fetch(API_BASE + "/config_api.php?action=plans_delete", { method: "POST", headers: authHeaders(), body: JSON.stringify({ id: id }) })
              .then(function(r) { return r.json(); }).then(function(d) { if (d.success) loadPlans(content); else alert(d.error || "Error"); });
          };
        });
      }).catch(function() { content.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar planes. Ejecute la migracion.</div>'; });
  }

  function openPlanModal(plan, content) {
    var existing = document.getElementById("enhancer-plan-modal");
    if (existing) existing.remove();
    var isEdit = !!plan;
    var html = '<div id="enhancer-plan-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px">' + (isEdit ? "Editar Plan" : "Nuevo Plan") + '</h3>' +
      '<button id="cfg-close-plan" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label><input id="cfg-pl-name" value="' + esc(plan ? plan.name : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Descripcion</label><textarea id="cfg-pl-desc" rows="2" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;resize:vertical">' + esc(plan ? plan.description : '') + '</textarea></div>' +
      '<div style="display:flex;gap:12px"><div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Precio CLP</label><input id="cfg-pl-clp" type="number" value="' + (plan ? plan.price_clp || 0 : 0) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Precio USD</label><input id="cfg-pl-usd" type="number" step="0.01" value="' + (plan ? plan.price_usd || 0 : 0) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div></div>' +
      '<div style="display:flex;gap:12px"><div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Max Links</label><input id="cfg-pl-links" type="number" value="' + (plan ? plan.max_links || 5 : 5) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div style="flex:1"><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Duracion (dias)</label><input id="cfg-pl-days" type="number" value="' + (plan ? plan.duration_days || 30 : 30) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Caracteristicas (separadas por coma)</label><input id="cfg-pl-feat" value="' + esc(plan ? plan.features : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Feature 1,Feature 2"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="cfg-cancel-plan" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;cursor:pointer">Cancelar</button>' +
      '<button id="cfg-save-plan" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">' + (isEdit ? "Guardar" : "Crear") + '</button></div></div></div></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("enhancer-plan-modal");
    document.getElementById("cfg-close-plan").onclick = function() { modal.remove(); };
    document.getElementById("cfg-cancel-plan").onclick = function() { modal.remove(); };
    document.getElementById("cfg-save-plan").onclick = function() {
      var name = document.getElementById("cfg-pl-name").value.trim();
      if (!name) { alert("Nombre requerido"); return; }
      var payload = {
        name: name,
        description: document.getElementById("cfg-pl-desc").value.trim(),
        price_clp: parseInt(document.getElementById("cfg-pl-clp").value) || 0,
        price_usd: parseFloat(document.getElementById("cfg-pl-usd").value) || 0,
        max_links: parseInt(document.getElementById("cfg-pl-links").value) || 5,
        duration_days: parseInt(document.getElementById("cfg-pl-days").value) || 30,
        features: document.getElementById("cfg-pl-feat").value.trim()
      };
      var action = isEdit ? "plans_update" : "plans_create";
      if (isEdit) payload.id = plan.id;
      fetch(API_BASE + "/config_api.php?action=" + action, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) })
        .then(function(r) { return r.json(); }).then(function(d) {
          if (d.success) { modal.remove(); loadPlans(content); }
          else alert(d.error || "Error");
        });
    };
  }

  function loadAgents(content) {
    fetch(API_BASE + "/config_api.php?action=agents_list", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        agentsCache = data.agents || [];
        var html = '<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button id="cfg-new-agent" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Agente</button></div>';
        if (agentsCache.length === 0) {
          html += '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No hay agentes</div>';
        } else {
          var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
          html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden"><table style="width:100%;border-collapse:collapse"><thead><tr>' +
            '<th style="' + thS + '">Agente</th><th style="' + thS + '">Contacto</th><th style="' + thS + '">Especialidad</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Acciones</th></tr></thead><tbody>';
          agentsCache.forEach(function(a) {
            var activeBg = a.is_active == 1 ? "#10b981" : "#94a3b8";
            html += '<tr style="border-bottom:1px solid #f1f5f9">' +
              '<td style="padding:14px 16px"><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + (a.name || "?").charAt(0).toUpperCase() + '</div><span style="font-weight:600;color:#1e293b;font-size:14px">' + esc(a.name) + '</span></div></td>' +
              '<td style="padding:14px 16px"><div><span style="font-size:12px;color:#64748b">' + esc(a.email || '') + '</span><br><span style="font-size:12px;color:#94a3b8">' + esc(a.phone || '') + '</span></div></td>' +
              '<td style="padding:14px 16px"><span style="padding:4px 8px;border-radius:6px;background:#f0f9ff;color:#0891b2;font-size:12px;font-weight:600">' + esc(a.specialization || 'General') + '</span></td>' +
              '<td style="padding:14px 16px"><span style="padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;background:' + activeBg + '20;color:' + activeBg + '">' + (a.is_active == 1 ? "Activo" : "Inactivo") + '</span></td>' +
              '<td style="padding:14px 16px"><div style="display:flex;gap:6px">' +
              '<button class="cfg-edit-agent" data-id="' + a.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>' +
              '<button class="cfg-delete-agent" data-id="' + a.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button></div></td></tr>';
          });
          html += '</tbody></table></div>';
        }
        content.innerHTML = html;
        document.getElementById("cfg-new-agent").onclick = function() { openAgentModal(null, content); };
        content.querySelectorAll(".cfg-edit-agent").forEach(function(btn) {
          btn.onclick = function() {
            var id = parseInt(this.getAttribute("data-id"));
            var agent = agentsCache.find(function(a) { return a.id == id; });
            if (agent) openAgentModal(agent, content);
          };
        });
        content.querySelectorAll(".cfg-delete-agent").forEach(function(btn) {
          btn.onclick = function() {
            var id = parseInt(this.getAttribute("data-id"));
            if (!confirm("¿Eliminar este agente?")) return;
            fetch(API_BASE + "/config_api.php?action=agents_delete", { method: "POST", headers: authHeaders(), body: JSON.stringify({ id: id }) })
              .then(function(r) { return r.json(); }).then(function(d) { if (d.success) loadAgents(content); else alert(d.error || "Error"); });
          };
        });
      }).catch(function() { content.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar agentes. Ejecute la migracion.</div>'; });
  }

  function openAgentModal(agent, content) {
    var existing = document.getElementById("enhancer-agent-modal");
    if (existing) existing.remove();
    var isEdit = !!agent;
    var html = '<div id="enhancer-agent-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px">' + (isEdit ? "Editar Agente" : "Nuevo Agente") + '</h3>' +
      '<button id="cfg-close-agent" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:14px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label><input id="cfg-ag-name" value="' + esc(agent ? agent.name : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email</label><input id="cfg-ag-email" type="email" value="' + esc(agent ? agent.email : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Telefono</label><input id="cfg-ag-phone" value="' + esc(agent ? agent.phone : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Especializacion</label><input id="cfg-ag-spec" value="' + esc(agent ? agent.specialization : '') + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Bio</label><textarea id="cfg-ag-bio" rows="3" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;resize:vertical">' + esc(agent ? agent.bio : '') + '</textarea></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:8px">' +
      '<button id="cfg-cancel-agent" style="padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;cursor:pointer">Cancelar</button>' +
      '<button id="cfg-save-agent" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">' + (isEdit ? "Guardar" : "Crear") + '</button></div></div></div></div>';
    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("enhancer-agent-modal");
    document.getElementById("cfg-close-agent").onclick = function() { modal.remove(); };
    document.getElementById("cfg-cancel-agent").onclick = function() { modal.remove(); };
    document.getElementById("cfg-save-agent").onclick = function() {
      var name = document.getElementById("cfg-ag-name").value.trim();
      if (!name) { alert("Nombre requerido"); return; }
      var payload = {
        name: name,
        email: document.getElementById("cfg-ag-email").value.trim(),
        phone: document.getElementById("cfg-ag-phone").value.trim(),
        specialization: document.getElementById("cfg-ag-spec").value.trim(),
        bio: document.getElementById("cfg-ag-bio").value.trim()
      };
      var action = isEdit ? "agents_update" : "agents_create";
      if (isEdit) payload.id = agent.id;
      fetch(API_BASE + "/config_api.php?action=" + action, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) })
        .then(function(r) { return r.json(); }).then(function(d) {
          if (d.success) { modal.remove(); loadAgents(content); }
          else alert(d.error || "Error");
        });
    };
  }

  function loadPricing(content) {
    fetch(API_BASE + "/config_api.php?action=pricing_get", { headers: authHeaders(), cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var pricing = data.pricing || {};
        var keys = Object.keys(pricing);
        if (keys.length === 0) {
          content.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No hay configuracion de precios</div>';
          return;
        }
        var labels = { default_currency: "Moneda por Defecto", usd_to_clp_rate: "Tipo de Cambio USD/CLP", commission_percent: "Comision (%)", tax_percent: "IVA (%)", min_order_clp: "Monto Minimo CLP" };
        var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.04)">' +
          '<h3 style="margin:0 0 20px;font-size:16px;font-weight:700;color:#1e293b">Configuracion de Precios</h3>' +
          '<div style="display:flex;flex-direction:column;gap:16px">';
        keys.forEach(function(key) {
          var label = labels[key] || key;
          var val = pricing[key].value || '';
          html += '<div style="display:flex;align-items:center;gap:12px"><label style="min-width:180px;font-size:13px;color:#64748b;font-weight:600">' + esc(label) + '</label>' +
            '<input class="cfg-pricing-input" data-key="' + esc(key) + '" value="' + esc(val) + '" style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' +
            '<span style="font-size:11px;color:#94a3b8;min-width:100px">' + esc(pricing[key].description || '') + '</span></div>';
        });
        html += '</div><div style="display:flex;justify-content:flex-end;margin-top:20px">' +
          '<button id="cfg-save-pricing" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Guardar Precios</button></div></div>';
        content.innerHTML = html;
        document.getElementById("cfg-save-pricing").onclick = function() {
          var configs = {};
          content.querySelectorAll(".cfg-pricing-input").forEach(function(inp) {
            configs[inp.getAttribute("data-key")] = inp.value.trim();
          });
          fetch(API_BASE + "/config_api.php?action=pricing_update", { method: "POST", headers: authHeaders(), body: JSON.stringify({ configs: configs }) })
            .then(function(r) { return r.json(); }).then(function(d) {
              if (d.success) alert("Precios actualizados"); else alert(d.error || "Error");
            });
        };
      }).catch(function() { content.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar precios. Ejecute la migracion.</div>'; });
  }

  function injectConfigSidebar() {
    if (document.getElementById("sidebar-config-admin")) return;
    var aside = document.querySelector("aside nav");
    if (!aside) return;
    var btn = document.createElement("button");
    btn.id = "sidebar-config-admin";
    btn.style.cssText = "display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;border:none;background:transparent;color:#94a3b8;font-size:14px;font-weight:500;cursor:pointer;border-radius:8px;transition:all .2s;text-align:left;margin-top:4px";
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Configuracion';
    btn.addEventListener("mouseenter", function() { this.style.background = "rgba(8,145,178,.08)"; this.style.color = "#0891b2"; });
    btn.addEventListener("mouseleave", function() { if (!this.classList.contains("cfg-active")) { this.style.background = "transparent"; this.style.color = "#94a3b8"; } });
    btn.addEventListener("click", function() {
      configActive = true;
      var main = document.querySelector("main");
      if (main) {
        main.querySelectorAll("[data-enhancer-hidden]").forEach(function(el) {
          el.style.display = "";
          el.removeAttribute("data-enhancer-hidden");
        });
        main.querySelectorAll("[data-enhancer-added]").forEach(function(el) {
          el.remove();
        });
      }
      lastSection = "Configuracion";
      enhanced = {};
      enhance("Configuracion");
    });
    aside.appendChild(btn);
  }

  async function enhanceDashboard() {
    var main = document.querySelector("main");
    if (!main) return true;

    // Hide React dashboard content
    hideReactContent(main);

    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "true");
    container.innerHTML = makeSkeletonTable(4, 3);
    main.appendChild(container);

    // Fetch real data
    var users = [], orders = [], purchases = [];
    try {
      var [usersResp, ordersResp, purchasesResp] = await Promise.all([
        fetch(API_BASE + "/users_api.php?action=list", { headers: authHeaders() }).then(function(r) { return r.json(); }),
        fetch(API_BASE + "/orders_api.php?action=admin_list", { headers: authHeaders() }).then(function(r) { return r.json(); }),
        fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() }).then(function(r) { return r.json(); })
      ]);
      users = usersResp.users || [];
      orders = ordersResp.orders || [];
      purchases = (purchasesResp.purchases || []).filter(function(p) { return p.status === 'active' || p.status === 'paid'; });
    } catch (e) { console.error("Dashboard data error:", e); }

    var totalUsers = users.length;
    var activeExpedientes = orders.filter(function(o) { return o.status === 'in_progress'; }).length;
    var pendingExpedientes = orders.filter(function(o) { return o.status === 'pending_admin_fill' || o.status === 'new'; }).length;
    var totalRevenue = purchases.reduce(function(sum, p) { return sum + (parseFloat(p.amount_clp) || 0); }, 0);
    var recentOrders = orders.slice(0, 5);
    var recentPurchases = purchases.slice(0, 5);

    // Navigate helper
    function navTo(section) {
      var btns = document.querySelectorAll("aside nav button, aside nav a");
      btns.forEach(function(b) { if (b.textContent.trim().toLowerCase().includes(section.toLowerCase())) b.click(); });
    }

    var html = '';

    // Stats cards row
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px">';

    var stats = [
      { label: 'Usuarios Registrados', value: totalUsers, icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', color: '#3b82f6', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', nav: 'usuarios' },
      { label: 'Expedientes Activos', value: activeExpedientes, icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>', color: '#0891b2', bg: 'linear-gradient(135deg,#ecfeff,#cffafe)', nav: 'expedientes' },
      { label: 'Pendientes Revision', value: pendingExpedientes, icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', color: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', nav: 'expedientes' },
      { label: 'Ingresos Totales', value: fmtCLP(totalRevenue), icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', color: '#10b981', bg: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', nav: 'pagos' }
    ];

    stats.forEach(function(s) {
      html += '<div class="dash-stat-card" data-nav="' + s.nav + '" style="background:' + s.bg + ';border:1px solid ' + s.color + '20;border-radius:16px;padding:20px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:-15px;right:-15px;width:60px;height:60px;background:' + s.color + '10;border-radius:50%"></div>' +
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<div style="width:48px;height:48px;background:' + s.color + ';border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px ' + s.color + '30"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">' + s.icon + '</svg></div>' +
        '<div><p style="margin:0;font-size:28px;font-weight:800;color:#0f172a">' + s.value + '</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#64748b;font-weight:500">' + s.label + '</p></div></div></div>';
    });
    html += '</div>';

    // Quick actions row
    html += '<div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap">';
    var actions = [
      { label: 'Nuevo Expediente', icon: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', color: '#0891b2', nav: 'expedientes' },
      { label: 'Ver Solicitudes', icon: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>', color: '#8b5cf6', nav: 'solicitudes' },
      { label: 'Chat Soporte', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', color: '#10b981', nav: '' },
    ];
    actions.forEach(function(a) {
      html += '<button class="dash-action-btn" data-nav="' + a.nav + '" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:10px;border:1px solid ' + a.color + '30;background:#fff;color:' + a.color + ';font-size:13px;font-weight:600;cursor:pointer;transition:all .2s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + a.icon + '</svg>' + a.label + '</button>';
    });
    html += '</div>';

    // Two-column layout: Recent Expedientes + Recent Payments
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';

    // Recent Expedientes
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04)">' +
      '<div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Expedientes Recientes</h3>' +
      '<button class="dash-action-btn" data-nav="expedientes" style="padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Ver todos</button></div>';
    if (recentOrders.length > 0) {
      html += '<div style="padding:8px 0">';
      recentOrders.forEach(function(o) {
        var stColor = o.status === 'in_progress' ? '#10b981' : o.status === 'completed' ? '#6366f1' : '#f59e0b';
        var stLabel = o.status === 'in_progress' ? 'En Proceso' : o.status === 'completed' ? 'Completado' : 'Pendiente';
        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid #f8fafc">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + stColor + ';flex-shrink:0"></div>' +
          '<div style="flex:1;min-width:0"><p style="margin:0;font-size:13px;font-weight:600;color:#1e293b">' + esc(o.order_number) + ' - ' + esc(o.customer_name || '') + '</p>' +
          '<p style="margin:1px 0 0;font-size:11px;color:#94a3b8">' + esc(o.plan_name || o.service_type || '') + '</p></div>' +
          '<span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;background:' + stColor + '15;color:' + stColor + '">' + stLabel + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px">Sin expedientes recientes</div>';
    }
    html += '</div>';

    // Recent Payments
    html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04)">' +
      '<div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:15px;font-weight:700;color:#1e293b">Pagos Recientes</h3>' +
      '<button class="dash-action-btn" data-nav="pagos" style="padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#10b981;font-size:12px;font-weight:600;cursor:pointer">Ver todos</button></div>';
    if (recentPurchases.length > 0) {
      html += '<div style="padding:8px 0">';
      recentPurchases.forEach(function(p) {
        var method = p.payment_method || 'N/A';
        var methodColor = method.toLowerCase().includes('webpay') ? '#E31837' : method.toLowerCase().includes('mercado') ? '#00B1EA' : method.toLowerCase().includes('paypal') ? '#003087' : '#64748b';
        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid #f8fafc">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:' + methodColor + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + methodColor + '" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>' +
          '<div style="flex:1;min-width:0"><p style="margin:0;font-size:13px;font-weight:600;color:#1e293b">' + esc(p.user_email || p.description || '') + '</p>' +
          '<p style="margin:1px 0 0;font-size:11px;color:#94a3b8">' + esc(p.description || p.type || '') + '</p></div>' +
          '<span style="font-size:14px;font-weight:700;color:#10b981">' + fmtCLP(p.amount_clp || 0) + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px">Sin pagos recientes</div>';
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Bind clicks
    container.querySelectorAll('.dash-stat-card, .dash-action-btn').forEach(function(el) {
      el.addEventListener('click', function() {
        var nav = this.getAttribute('data-nav');
        if (nav) navTo(nav);
      });
      if (el.classList.contains('dash-stat-card')) {
        el.addEventListener('mouseenter', function() { this.style.transform = 'translateY(-3px)'; this.style.boxShadow = '0 8px 24px rgba(0,0,0,.08)'; });
        el.addEventListener('mouseleave', function() { this.style.transform = ''; this.style.boxShadow = ''; });
      }
    });

    return true;
  }

  function enhance(section) {
    if (enhanced[section]) return;
    addSkeletonStyles();
    var ok = false;
    try {
      switch (section) {
        case "Dashboard": ok = enhanceDashboard(); break;
        case "Usuarios": ok = enhanceUsers(); break;
        case "Solicitudes": ok = enhanceSolicitudes(); break;
        case "Planes": ok = enhancePlanes(); break;
        case "Pagos": ok = enhancePagos(); break;
        case "Contenido": ok = enhanceContenido(); break;
        case "Auditoria": ok = true; break;
        case "Configuracion": ok = enhanceConfiguracion(); break;
      }
    } catch (e) { console.warn("Admin enhancer error:", e); }
    if (ok) enhanced[section] = true;
  }

  function check() {
    if (isEnhancing) return;
    var s = getSection();
    if (!s) return;
    if (s !== lastSection) {
      cleanupEnhancer();
      lastSection = s;
      enhanced = {};
    }
    if (!enhanced[s]) enhance(s);
  }

  function debouncedCheck() {
    if (checkTimer) return;
    checkTimer = setTimeout(function() {
      checkTimer = null;
      injectConfigSidebar();
      check();
    }, 100);
  }

  function init() {
    injectConfigSidebar();
    document.addEventListener("click", function(e) {
      if (!configActive) return;
      var btn = e.target.closest("aside nav ul button, aside nav ul a");
      if (btn) {
        configActive = false;
        cleanupEnhancer();
        lastSection = "";
        enhanced = {};
      }
    }, true);
    new MutationObserver(debouncedCheck).observe(document.body, { childList: true, subtree: true });
    setInterval(function() { injectConfigSidebar(); check(); }, 500);
    check();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
