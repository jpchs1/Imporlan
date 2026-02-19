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
  function fmtDate(s) { if (!s) return "N/A"; var d = new Date(s); return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }); }

  function addSkeletonStyles() {
    if (document.getElementById("enhancer-skeleton-styles")) return;
    var style = document.createElement("style");
    style.id = "enhancer-skeleton-styles";
    style.textContent = "@keyframes enhancerPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      " main[data-enhancer-section] > *:not([data-enhancer-added]):not([data-enhancer-keep]) { display: none !important; }";
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
    var actions = isReal
      ? '<span style="color:#94a3b8;font-size:11px;font-style:italic">Cliente</span>'
      : '<div style="display:flex;gap:6px">' +
        '<button class="enhancer-edit-user" data-id="' + u.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #0891b2;background:transparent;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Editar</button>' +
        '<button class="enhancer-delete-user" data-id="' + u.id + '" style="padding:6px 12px;border-radius:8px;border:1px solid #ef4444;background:transparent;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer">Eliminar</button>' +
        '</div>';
    return '<tr style="border-bottom:1px solid #f1f5f9" data-user-id="' + u.id + '">' +
      '<td style="padding:14px 16px"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">' + ini + '</div><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(u.name) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(u.email) + '</p></div></div></td>' +
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
    var phone = isEdit ? user.phone || "" : "";
    var role = isEdit ? user.role || "user" : "user";
    var status = isEdit ? user.status || "active" : "active";
    return '<div id="enhancer-user-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:enhancerFadeIn .2s">' +
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">' +
      '<div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700">' + title + '</h3>' +
      '<button id="enhancer-close-user-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px">&times;</button></div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre *</label>' +
      '<input id="enhancer-usr-name" value="' + esc(name) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="Nombre completo"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email *</label>' +
      '<input id="enhancer-usr-email" type="email" value="' + esc(email) + '" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="email@ejemplo.com"></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Contrasena ' + (isEdit ? '(dejar vacio para no cambiar)' : '*') + '</label>' +
      '<input id="enhancer-usr-pass" type="password" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box" placeholder="********"></div>' +
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
    container.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button id="enhancer-new-user" style="padding:10px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(16,185,129,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Usuario</button></div>' +
      '<div id="enhancer-users-table">' + makeSkeletonTable(6, 4) + '</div>';
    main.appendChild(container);
    loadUsers(container);
    return true;
  }

  var usersMigrationAttempted = false;

  function renderUsersTable(users, tableDiv, container) {
    if (users.length === 0) {
      tableDiv.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No hay usuarios. Crea uno nuevo.</div>';
    } else {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
      html += '<table style="width:100%;border-collapse:collapse"><thead><tr>';
      html += '<th style="' + thS + '">Usuario</th><th style="' + thS + '">Rol</th><th style="' + thS + '">Estado</th><th style="' + thS + ';text-align:center">Compras</th><th style="' + thS + '">Creado</th><th style="' + thS + '">Acciones</th>';
      html += '</tr></thead><tbody>';
      users.forEach(function(u) { html += renderUserRow(u); });
      html += '</tbody></table></div>';
      tableDiv.innerHTML = html;
    }
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

  function openUserModal(user, container) {
    var existing = document.getElementById("enhancer-user-modal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", renderUserModal(user));
    var modal = document.getElementById("enhancer-user-modal");
    document.getElementById("enhancer-close-user-modal").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-cancel-user").onclick = function() { modal.remove(); };
    document.getElementById("enhancer-save-user").onclick = function() {
      var name = document.getElementById("enhancer-usr-name").value.trim();
      var email = document.getElementById("enhancer-usr-email").value.trim();
      var pass = document.getElementById("enhancer-usr-pass").value;
      if (!name || !email) { alert("Nombre y email son requeridos"); return; }
      if (!user && !pass) { alert("Contrasena es requerida para nuevos usuarios"); return; }
      var payload = {
        name: name,
        email: email,
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
          modal.remove();
          var cont = document.querySelector("[data-enhancer-added='users']");
          if (cont) cont.remove();
          enhanced = {};
          enhanceUsers();
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
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        if (!Array.isArray(purchases) || purchases.length === 0) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron solicitudes</div>';
          return;
        }
        var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
        var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);overflow-x:auto">';
        html += '<table style="width:100%;border-collapse:collapse"><thead><tr>';
        html += '<th style="' + thS + '">ID</th><th style="' + thS + '">Tipo</th><th style="' + thS + '">Servicio</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Descripcion</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Medio Pago</th><th style="' + thS + '">Fecha</th>';
        html += '</tr></thead><tbody>';
        purchases.forEach(function (p, idx) {
          var status = p.status || "pending";
          var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Activa", c: "#10b981" }, completed: { l: "Completada", c: "#6366f1" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelada", c: "#ef4444" } };
          var st = stMap[status] || stMap.pending;
          var type = p.type || "link";
          var tipoColor = type === "plan" ? "#7c3aed" : "#0891b2";
          var tipoBg = type === "plan" ? "#8b5cf620" : "#0891b220";
          var servicioLabel = type === "plan" ? "Plan de Busqueda" : "Cotizacion por Links";
          var servicioColor = type === "plan" ? "#7c3aed" : "#0891b2";
          var servicioBg = type === "plan" ? "#7c3aed15" : "#0891b215";
          var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual" };
          var method = mLabels[p.payment_method || p.method] || (p.payment_method || p.method || "N/A");
          var methodColor = (p.payment_method || p.method) === "webpay" ? "#dc2626" : (p.payment_method || p.method) === "mercadopago" ? "#0070ba" : (p.payment_method || p.method) === "paypal" ? "#003087" : "#64748b";
          var email = p.user_email || p.email || "";
          var userName = email.split("@")[0];
          var desc = p.description || p.desc || p.plan_name || "";
          var amount = p.amount_clp || p.amount || 0;
          var date = p.timestamp || p.date || "";
          var displayId = p.id || (idx + 1);
          html += '<tr style="border-bottom:1px solid #f1f5f9">';
          html += '<td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(displayId)) + '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:' + tipoBg + ';color:' + tipoColor + '">' + (type === "plan" ? "Plan" : "Link") + '</span></td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + servicioBg + ';color:' + servicioColor + '">' + servicioLabel + '</span></td>';
          html += '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(email) + '</p></div></td>';
          html += '<td style="padding:14px 16px;font-size:13px;color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(desc) + '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td>';
          html += '<td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(amount) + '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + methodColor + '15;color:' + methodColor + '">' + esc(method) + '</span></td>';
          html += '<td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(date) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
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
        if (!Array.isArray(purchases) || purchases.length === 0) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron pagos</div>';
          return;
        }
        var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
        var html = '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
        html += '<table style="width:100%;border-collapse:collapse"><thead><tr>';
        html += '<th style="' + thS + '">ID</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Proveedor</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Fecha</th><th style="' + thS + '">Detalle</th>';
        html += '</tr></thead><tbody>';
        purchases.forEach(function (p, idx) {
          var status = p.status || "pending";
          var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Pagado", c: "#10b981" }, completed: { l: "Pagado", c: "#10b981" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelado", c: "#ef4444" } };
          var st = stMap[status] || stMap.pending;
          var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual" };
          var method = mLabels[p.payment_method || p.method] || (p.payment_method || p.method || "N/A");
          var email = p.user_email || p.email || "";
          var userName = email.split("@")[0];
          var displayId = p.id || (idx + 1);
          html += '<tr style="border-bottom:1px solid #f1f5f9">';
          html += '<td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(displayId)) + '</td>';
          html += '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(email) + '</p></div></td>';
          html += '<td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(p.amount_clp || p.amount || 0) + '</td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#f1f5f9;color:#475569">' + esc(method) + '</span></td>';
          html += '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td>';
          html += '<td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(p.timestamp || p.date || "") + '</td>';
          html += '<td style="padding:14px 16px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.description || p.desc || p.plan_name || "") + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
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

  function enhanceDashboard() {
    var main = document.querySelector("main");
    if (!main) return true;
    var sidebarBtns = document.querySelectorAll("aside nav button, aside nav a");
    function clickSection(name) {
      sidebarBtns.forEach(function (b) {
        if (b.textContent.trim().toLowerCase().includes(name.toLowerCase())) b.click();
      });
    }
    var linkMap = [
      { match: /total\s*usuarios/i, section: "usuarios" },
      { match: /solicitudes?\s*pendientes?/i, section: "solicitudes" },
      { match: /ingresos?\s*totales?/i, section: "pagos" },
      { match: /planes?\s*activos?/i, section: "planes" }
    ];
    var cards = main.querySelectorAll("div");
    cards.forEach(function (card) {
      var text = card.textContent || "";
      if (card.closest("[data-dash-linked]")) return;
      for (var i = 0; i < linkMap.length; i++) {
        if (linkMap[i].match.test(text) && text.length < 300) {
          card.setAttribute("data-dash-linked", linkMap[i].section);
          card.style.cursor = "pointer";
          card.style.transition = "all .2s";
          card.addEventListener("mouseenter", function () { this.style.transform = "translateY(-2px)"; this.style.boxShadow = "0 8px 24px rgba(8,145,178,.15)"; });
          card.addEventListener("mouseleave", function () { this.style.transform = ""; this.style.boxShadow = ""; });
          (function (sec) {
            card.addEventListener("click", function (e) {
              if (e.target.closest("a, button, input, select")) return;
              clickSection(sec);
            });
          })(linkMap[i].section);
          break;
        }
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
