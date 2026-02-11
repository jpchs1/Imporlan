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

  function showTableSkeleton(table, cols) {
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    if (!cols) {
      var thead = table.querySelector("thead tr");
      cols = thead ? thead.children.length : 7;
    }
    var rows = "";
    for (var i = 0; i < 5; i++) {
      rows += '<tr style="border-bottom:1px solid #f1f5f9">';
      for (var j = 0; j < cols; j++) {
        rows += '<td style="padding:14px 16px"><div style="height:16px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;border-radius:6px;animation:enhancerPulse 1.5s ease-in-out infinite"></div></td>';
      }
      rows += '</tr>';
    }
    tbody.innerHTML = rows;
  }

  function addSkeletonStyles() {
    if (document.getElementById("enhancer-skeleton-styles")) return;
    var style = document.createElement("style");
    style.id = "enhancer-skeleton-styles";
    style.textContent = "@keyframes enhancerPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}";
    document.head.appendChild(style);
  }

  var lastSection = "";
  var enhanced = {};

  function getSection() {
    var h = document.querySelector("main h1");
    return h ? h.textContent.trim() : "";
  }

  function enhanceUsers() {
    var main = document.querySelector("main");
    if (!main) return;
    var table = main.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">Usuario</th><th style="' + thS + '">Rol</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Info</th>';
    }
    showTableSkeleton(table, 4);
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        var userMap = {};
        purchases.forEach(function (p) {
          var email = (p.user_email || p.email || "").toLowerCase();
          if (!email) return;
          if (!userMap[email]) {
            userMap[email] = { name: email.split("@")[0], email: email, role: "user", status: "active", purchases: 0, spent: 0 };
          }
          userMap[email].purchases++;
          userMap[email].spent += parseInt(p.amount_clp || p.amount || 0);
          if (p.user_name) userMap[email].name = p.user_name;
        });
        var users = Object.values(userMap);
        if (users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron usuarios con compras</td></tr>';
          return;
        }
        users.sort(function (a, b) { return b.spent - a.spent; });
        var rows = "";
        users.forEach(function (u) {
          var stColor = u.status === "active" ? "#10b981" : "#ef4444";
          var stLabel = u.status === "active" ? "Activo" : "Suspendido";
          var roleLabel = u.role === "admin" ? "Admin" : u.role === "support" ? "Soporte" : "Usuario";
          var roleBg = u.role === "admin" ? "#3b82f6" : u.role === "support" ? "#8b5cf6" : "#64748b";
          var ini = (u.name || "?").charAt(0).toUpperCase();
          rows += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:14px 16px"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">' + ini + '</div><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(u.name) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(u.email) + '</p></div></div></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + roleBg + ';color:#fff">' + roleLabel + '</span></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + stColor + '20;color:' + stColor + '">' + stLabel + '</span></td><td style="padding:14px 16px"><div style="display:flex;gap:6px;flex-wrap:wrap"><span style="padding:4px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:600">' + (u.purchases || 0) + ' compras</span>' + ((u.spent || 0) > 0 ? '<span style="padding:4px 8px;border-radius:6px;background:#ecfdf5;color:#059669;font-size:11px;font-weight:600">' + fmtCLP(u.spent) + '</span>' : '') + '</div></td></tr>';
        });
        tbody.innerHTML = rows;
      })
      .catch(function (err) {
        console.warn("Error loading users:", err);
        tbody.innerHTML = '<tr><td colspan="4" style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar usuarios</td></tr>';
      });
  }

  function enhanceSolicitudes() {
    var main = document.querySelector("main");
    if (!main) return;
    var table = main.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">ID</th><th style="' + thS + '">Tipo</th><th style="' + thS + '">Servicio</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Descripcion</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Medio Pago</th><th style="' + thS + '">Fecha</th>';
    }
    showTableSkeleton(table, 9);
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        if (!Array.isArray(purchases) || purchases.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron solicitudes</td></tr>';
          return;
        }
        var rows = "";
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
          rows += '<tr style="border-bottom:1px solid #f1f5f9">' +
            '<td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(displayId)) + '</td>' +
            '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:' + tipoBg + ';color:' + tipoColor + '">' + (type === "plan" ? "Plan" : "Link") + '</span></td>' +
            '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + servicioBg + ';color:' + servicioColor + '">' + servicioLabel + '</span></td>' +
            '<td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(email) + '</p></div></td>' +
            '<td style="padding:14px 16px;font-size:13px;color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(desc) + '</td>' +
            '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td>' +
            '<td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(amount) + '</td>' +
            '<td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:' + methodColor + '15;color:' + methodColor + '">' + esc(method) + '</span></td>' +
            '<td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(date) + '</td></tr>';
        });
        tbody.innerHTML = rows;
      })
      .catch(function (err) {
        console.warn("Error loading solicitudes:", err);
        tbody.innerHTML = '<tr><td colspan="9" style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar solicitudes</td></tr>';
      });
  }

  function cleanupEnhancer() {
    var main = document.querySelector("main");
    if (!main) return;
    main.querySelectorAll("[data-enhancer-hidden]").forEach(function (el) {
      el.style.display = "";
      el.removeAttribute("data-enhancer-hidden");
    });
    main.querySelectorAll("[data-enhancer-added]").forEach(function (el) {
      el.remove();
    });
  }

  function enhancePlanes() {
    var main = document.querySelector("main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (!h1) return;
    var subtitle = h1.nextElementSibling;
    var children = Array.from(main.children);
    children.forEach(function (ch) {
      if (ch !== h1 && ch !== subtitle && !ch.getAttribute("data-enhancer-added")) {
        ch.style.display = "none";
        ch.setAttribute("data-enhancer-hidden", "true");
      }
    });
    if (main.querySelector("[data-enhancer-added='plans']")) return;
    var container = document.createElement("div");
    container.setAttribute("data-enhancer-added", "plans");
    container.style.cssText = "display:flex;gap:20px;flex-wrap:wrap;padding:20px 0";
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;width:100%;color:#94a3b8;font-size:14px">Cargando planes...</div>';
    main.appendChild(container);
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        var planTypes = {};
        purchases.forEach(function (p) {
          if (p.type === "plan") {
            var name = p.plan_name || p.description || "Plan";
            if (!planTypes[name]) planTypes[name] = { name: name, count: 0, revenue: 0 };
            planTypes[name].count++;
            planTypes[name].revenue += parseInt(p.amount_clp || p.amount || 0);
          }
        });
        var plans = Object.values(planTypes);
        if (plans.length === 0) {
          container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;width:100%">No se encontraron planes contratados</div>';
          return;
        }
        var html = "";
        plans.forEach(function (p) {
          html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,.06);flex:1;min-width:280px"><h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b">' + esc(p.name) + '</h3><p style="margin:0 0 16px;font-size:13px;color:#94a3b8">' + p.count + ' contrataciones</p><div><span style="font-size:28px;font-weight:800;color:#0891b2">' + fmtCLP(p.revenue) + '</span><span style="font-size:13px;color:#94a3b8;margin-left:4px">CLP total</span></div></div>';
        });
        container.innerHTML = html;
      })
      .catch(function () {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px;width:100%">Error al cargar planes</div>';
      });
  }

  function enhancePagos() {
    var main = document.querySelector("main");
    if (!main) return;
    var table = main.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">ID</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Proveedor</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Fecha</th><th style="' + thS + '">Detalle</th>';
    }
    showTableSkeleton(table, 7);
    fetch(API_BASE + "/purchases.php?action=all", { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var purchases = data.purchases || [];
        if (!Array.isArray(purchases) || purchases.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:#94a3b8;font-size:14px">No se encontraron pagos</td></tr>';
          return;
        }
        var rows = "";
        purchases.forEach(function (p, idx) {
          var status = p.status || "pending";
          var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Pagado", c: "#10b981" }, completed: { l: "Pagado", c: "#10b981" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelado", c: "#ef4444" } };
          var st = stMap[status] || stMap.pending;
          var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual" };
          var method = mLabels[p.payment_method || p.method] || (p.payment_method || p.method || "N/A");
          var email = p.user_email || p.email || "";
          var userName = email.split("@")[0];
          var displayId = p.id || (idx + 1);
          rows += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + esc(String(displayId)) + '</td><td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(email) + '</p></div></td><td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(p.amount_clp || p.amount || 0) + '</td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#f1f5f9;color:#475569">' + esc(method) + '</span></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td><td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(p.timestamp || p.date || "") + '</td><td style="padding:14px 16px;font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.description || p.desc || p.plan_name || "") + '</td></tr>';
        });
        tbody.innerHTML = rows;
      })
      .catch(function (err) {
        console.warn("Error loading pagos:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:#ef4444;font-size:14px">Error al cargar pagos</td></tr>';
      });
  }

  function enhanceContenido() {
    var main = document.querySelector("main");
    if (!main) return;
    var contentArea = null;
    main.querySelectorAll("div").forEach(function (el) {
      if (el.children.length >= 3 && el.querySelector("h3")) contentArea = el;
    });
    if (!contentArea) return;
    contentArea.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:0";
    contentArea.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;grid-column:1/-1">No hay resenas disponibles por el momento</div>';
  }

  function enhanceDashboard() {
    var main = document.querySelector("main");
    if (!main) return;
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
  }

  function enhance(section) {
    if (enhanced[section]) return;
    enhanced[section] = true;
    addSkeletonStyles();
    try {
      switch (section) {
        case "Dashboard": setTimeout(enhanceDashboard, 400); break;
        case "Usuarios": enhanceUsers(); break;
        case "Solicitudes": enhanceSolicitudes(); break;
        case "Planes": setTimeout(enhancePlanes, 200); break;
        case "Pagos": enhancePagos(); break;
        case "Contenido": setTimeout(enhanceContenido, 200); break;
      }
    } catch (e) { console.warn("Admin enhancer error:", e); }
  }

  function check() {
    var s = getSection();
    if (s && s !== lastSection) {
      cleanupEnhancer();
      lastSection = s;
      enhanced = {};
      setTimeout(function () { enhance(s); }, 300);
    }
  }

  function init() {
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
    setInterval(check, 1000);
    setTimeout(check, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
