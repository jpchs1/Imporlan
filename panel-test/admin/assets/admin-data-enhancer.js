(function () {
  "use strict";

  var REAL_USERS = [
    { name: "Nicolas Chaparro", email: "nchaparro@gmail.com", role: "user", status: "active", purchases: 2, spent: 19800 },
    { name: "Clases de Ski", email: "info@clasesdeski.cl", role: "user", status: "active", purchases: 4, spent: 127000 },
    { name: "Alberto Lathrop", email: "alathrop@lontue.com", role: "user", status: "active", purchases: 1, spent: 67600 },
    { name: "Dr. Vigueras", email: "drsvigueras@gmail.com", role: "user", status: "active", purchases: 1, spent: 39600 },
    { name: "Juan Pablo Chaparro", email: "jpchs1@gmail.com", role: "user", status: "active", purchases: 4, spent: 165000 },
    { name: "Administrador Imporlan", email: "admin@imporlan.cl", role: "admin", status: "active", purchases: 0, spent: 0 },
    { name: "Soporte Imporlan", email: "soporte@imporlan.cl", role: "support", status: "active", purchases: 0, spent: 0 }
  ];

  var REAL_PURCHASES = [
    { id: 1, email: "nchaparro@gmail.com", type: "link", desc: "Cotizacion Online - 1 link", amount: 9900, method: "mercadopago", status: "pending", date: "2026-01-19 20:42:47" },
    { id: 2, email: "info@clasesdeski.cl", type: "link", desc: "Cotizacion Online - 1 link", amount: 9900, method: "mercadopago", status: "pending", date: "2026-01-21 14:54:04" },
    { id: 3, email: "info@clasesdeski.cl", type: "link", desc: "Cotizacion Online - WebPay", amount: 19800, method: "webpay", status: "pending", date: "2026-01-21 20:28:44" },
    { id: 4, email: "info@clasesdeski.cl", type: "plan", desc: "Plan Capitan - WebPay", amount: 29700, method: "webpay", status: "pending", date: "2026-01-23 10:45:38" },
    { id: 5, email: "nchaparro@gmail.com", type: "link", desc: "Cotizacion Online - WebPay", amount: 9900, method: "webpay", status: "pending", date: "2026-01-25 19:46:02" },
    { id: 6, email: "alathrop@lontue.com", type: "plan", desc: "Plan Fragata - WebPay", amount: 67600, method: "webpay", status: "pending", date: "2026-01-28 11:52:37" },
    { id: 7, email: "info@clasesdeski.cl", type: "plan", desc: "Plan Fragata - WebPay", amount: 67600, method: "webpay", status: "pending", date: "2026-01-28 21:03:12" },
    { id: 8, email: "drsvigueras@gmail.com", type: "link", desc: "Cotizacion Online - 4 links", amount: 39600, method: "mercadopago", status: "pending", date: "2026-02-08 21:57:12" },
    { id: 9, email: "jpchs1@gmail.com", type: "plan", desc: "Plan Almirante Premium - WebPay", amount: 135200, method: "webpay", status: "active", date: "2026-02-10 07:10:09" },
    { id: 10, email: "jpchs1@gmail.com", type: "link", desc: "Cotizacion Online - 1 link", amount: 9900, method: "webpay", status: "active", date: "2026-02-10 07:10:18" },
    { id: 11, email: "jpchs1@gmail.com", type: "link", desc: "Cotizacion Online - 1 link", amount: 9900, method: "mercadopago", status: "active", date: "2026-02-10 07:10:26" },
    { id: 12, email: "jpchs1@gmail.com", type: "link", desc: "Cotizacion Online - 1 link", amount: 9900, method: "webpay", status: "en_revision", date: "2026-02-10 07:10:34" }
  ];

  var REAL_PLANS = [
    { name: "Plan Fragata", price: 67600, usd: 68, old: 89900, days: 7, proposals: 5, features: ["1 Requerimiento especifico", "5 propuestas/cotizaciones", "Analisis ofertas y recomendacion"], popular: false },
    { name: "Plan Capitan de Navio", price: 119600, usd: 120, old: null, days: 14, proposals: 9, features: ["1 Requerimiento especifico", "9 propuestas/cotizaciones", "Analisis ofertas y recomendacion"], popular: true },
    { name: "Plan Almirante", price: 189600, usd: 190, old: 219600, days: 21, proposals: 15, features: ["1 Requerimiento especifico", "15 propuestas/cotizaciones", "Analisis ofertas y recomendacion"], popular: false }
  ];

  var REAL_REVIEWS = [
    { name: "Carlos Rodriguez", role: "Empresario, Santiago", text: "Excelente servicio. Importaron mi Cobalt R30 sin ningun problema. Todo el proceso fue transparente y profesional." },
    { name: "Maria Gonzalez", role: "Medico, Vina del Mar", text: "Muy recomendable. El equipo de Imporlan me ayudo a encontrar la lancha perfecta para mi familia." },
    { name: "Pedro Martinez", role: "Ingeniero, Concepcion", text: "Proceso impecable de principio a fin. La comunicacion fue excelente y cumplieron con todos los plazos." },
    { name: "Roberto Silva", role: "Abogado, Valparaiso", text: "Increible experiencia. Desde la busqueda hasta la entrega, todo fue perfecto. Mi Sea Ray llego en excelentes condiciones." },
    { name: "Ana Fernandez", role: "Arquitecta, La Serena", text: "Profesionalismo de primer nivel. Me asesoraron en cada paso y el precio final fue exactamente el cotizado. Sin sorpresas." },
    { name: "Diego Morales", role: "Empresario, Temuco", text: "Segunda lancha que importo con Imporlan. La confianza que generan es invaluable. Totalmente recomendados." },
    { name: "Claudia Vargas", role: "Dentista, Puerto Montt", text: "El seguimiento en tiempo real me dio mucha tranquilidad. Siempre supe donde estaba mi embarcacion." },
    { name: "Francisco Rojas", role: "Contador, Antofagasta", text: "Ahorre mas de 3 millones comparado con comprar en Chile. El servicio de Imporlan vale cada peso." },
    { name: "Valentina Soto", role: "Ingeniera Civil, Rancagua", text: "La inspeccion previa fue muy detallada. Me enviaron fotos y videos de todo. Compre con total seguridad." },
    { name: "Andres Munoz", role: "Medico, Iquique", text: "Atencion personalizada de principio a fin. Resolvieron todas mis dudas rapidamente. Excelente equipo." }
  ];

  function esc(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function fmtCLP(n) { return "$" + parseInt(n).toLocaleString("es-CL"); }
  function fmtDate(s) { if (!s) return "N/A"; var d = new Date(s); return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }); }

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
    var rows = "";
    REAL_USERS.forEach(function (u) {
      var stColor = u.status === "active" ? "#10b981" : "#ef4444";
      var stLabel = u.status === "active" ? "Activo" : "Suspendido";
      var roleLabel = u.role === "admin" ? "Admin" : u.role === "support" ? "Soporte" : "Usuario";
      var roleBg = u.role === "admin" ? "#3b82f6" : u.role === "support" ? "#8b5cf6" : "#64748b";
      var ini = (u.name || "?").charAt(0).toUpperCase();
      rows += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:14px 16px"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">' + ini + '</div><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(u.name) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(u.email) + '</p></div></div></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + roleBg + ';color:#fff">' + roleLabel + '</span></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + stColor + '20;color:' + stColor + '">' + stLabel + '</span></td><td style="padding:14px 16px"><div style="display:flex;gap:6px;flex-wrap:wrap"><span style="padding:4px 8px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:600">' + u.purchases + ' compras</span>' + (u.spent > 0 ? '<span style="padding:4px 8px;border-radius:6px;background:#ecfdf5;color:#059669;font-size:11px;font-weight:600">' + fmtCLP(u.spent) + '</span>' : '') + '</div></td></tr>';
    });
    tbody.innerHTML = rows;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">Usuario</th><th style="' + thS + '">Rol</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Info</th>';
    }
    main.querySelectorAll("*").forEach(function (el) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && /Mostrando \d+ de \d+ usuarios/.test(el.textContent)) {
        el.textContent = "Mostrando " + REAL_USERS.length + " de " + REAL_USERS.length + " usuarios";
      }
    });
  }

  function enhanceSolicitudes() {
    var main = document.querySelector("main");
    if (!main) return;
    var table = main.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var rows = "";
    REAL_PURCHASES.forEach(function (p) {
      var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Activa", c: "#10b981" }, completed: { l: "Completada", c: "#6366f1" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelada", c: "#ef4444" } };
      var st = stMap[p.status] || stMap.pending;
      var tipoColor = p.type === "plan" ? "#7c3aed" : "#0891b2";
      var tipoBg = p.type === "plan" ? "#8b5cf620" : "#0891b220";
      var userName = p.email.split("@")[0];
      rows += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + p.id + '</td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:' + tipoBg + ';color:' + tipoColor + '">' + (p.type === "plan" ? "Plan" : "Link") + '</span></td><td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(p.email) + '</p></div></td><td style="padding:14px 16px;font-size:13px;color:#475569">' + esc(p.desc) + '</td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td><td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(p.amount) + '</td><td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(p.date) + '</td></tr>';
    });
    tbody.innerHTML = rows;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">ID</th><th style="' + thS + '">Tipo</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Descripcion</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Fecha</th>';
    }
    main.querySelectorAll("*").forEach(function (el) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && /Mostrando \d+ de \d+ solicitudes/.test(el.textContent)) {
        el.textContent = "Mostrando " + REAL_PURCHASES.length + " de " + REAL_PURCHASES.length + " solicitudes";
      }
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
    var html = "";
    REAL_PLANS.forEach(function (p) {
      var oldHtml = p.old ? '<span style="text-decoration:line-through;color:#94a3b8;font-size:14px;margin-left:8px">' + fmtCLP(p.old) + '</span>' : '';
      var badge = p.popular ? '<div style="position:absolute;top:12px;right:12px;padding:4px 12px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:11px;font-weight:700;letter-spacing:.03em">MAS POPULAR</div>' : '';
      var feats = p.features.map(function (f) { return '<li style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#475569"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' + f + '</li>'; }).join("");
      html += '<div style="background:#fff;border-radius:16px;border:' + (p.popular ? '2px solid #f59e0b' : '1px solid #e2e8f0') + ';padding:28px;position:relative;box-shadow:0 4px 16px rgba(0,0,0,.06);flex:1;min-width:280px">' + badge + '<h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b">' + p.name + '</h3><p style="margin:0 0 16px;font-size:13px;color:#94a3b8">Monitoreo por ' + p.days + ' dias - ' + p.proposals + ' propuestas</p><div style="margin-bottom:16px"><span style="font-size:28px;font-weight:800;color:#0891b2">' + fmtCLP(p.price) + '</span><span style="font-size:13px;color:#94a3b8;margin-left:4px">CLP</span>' + oldHtml + '</div><p style="margin:0 0 4px;font-size:12px;color:#64748b">US$' + p.usd + '</p><ul style="list-style:none;padding:0;margin:16px 0 0">' + feats + '</ul></div>';
    });
    container.innerHTML = html;
    main.appendChild(container);
  }

  function enhancePagos() {
    var main = document.querySelector("main");
    if (!main) return;
    var table = main.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    var rows = "";
    REAL_PURCHASES.forEach(function (p) {
      var stMap = { pending: { l: "Pendiente", c: "#f59e0b" }, active: { l: "Pagado", c: "#10b981" }, completed: { l: "Pagado", c: "#10b981" }, en_revision: { l: "En Revision", c: "#3b82f6" }, canceled: { l: "Cancelado", c: "#ef4444" } };
      var st = stMap[p.status] || stMap.pending;
      var mLabels = { webpay: "WebPay", mercadopago: "MercadoPago", paypal: "PayPal", manual: "Manual" };
      var method = mLabels[p.method] || p.method;
      var userName = p.email.split("@")[0];
      rows += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:14px 16px;font-weight:600;color:#475569;font-size:13px">#' + p.id + '</td><td style="padding:14px 16px"><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:14px">' + esc(userName) + '</p><p style="margin:2px 0 0;color:#94a3b8;font-size:12px">' + esc(p.email) + '</p></div></td><td style="padding:14px 16px;font-weight:700;color:#1e293b;font-size:13px">' + fmtCLP(p.amount) + '</td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#f1f5f9;color:#475569">' + method + '</span></td><td style="padding:14px 16px"><span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:' + st.c + '20;color:' + st.c + '">' + st.l + '</span></td><td style="padding:14px 16px;font-size:12px;color:#64748b">' + fmtDate(p.date) + '</td><td style="padding:14px 16px;font-size:12px;color:#64748b">' + esc(p.desc) + '</td></tr>';
    });
    tbody.innerHTML = rows;
    var thead = table.querySelector("thead tr");
    if (thead) {
      var thS = 'padding:14px 16px;text-align:left;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em';
      thead.innerHTML = '<th style="' + thS + '">ID</th><th style="' + thS + '">Usuario</th><th style="' + thS + '">Monto</th><th style="' + thS + '">Proveedor</th><th style="' + thS + '">Estado</th><th style="' + thS + '">Fecha</th><th style="' + thS + '">Detalle</th>';
    }
    main.querySelectorAll("*").forEach(function (el) {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && /Mostrando \d+ de \d+ pagos/.test(el.textContent)) {
        el.textContent = "Mostrando " + REAL_PURCHASES.length + " de " + REAL_PURCHASES.length + " pagos";
      }
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
    var starSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var stars = ""; for (var i = 0; i < 5; i++) stars += starSvg;
    var html = "";
    REAL_REVIEWS.forEach(function (r) {
      var ini = r.name.charAt(0);
      html += '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:#0891b220;color:#0891b2;text-transform:uppercase;letter-spacing:.04em">Resena Real</span><div style="display:flex;gap:2px">' + stars + '</div></div><p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;font-style:italic">' + esc(r.text) + '</p><div style="display:flex;align-items:center;gap:10px;border-top:1px solid #f1f5f9;padding-top:12px"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0891b2,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + ini + '</div><div><p style="margin:0;font-weight:600;color:#1e293b;font-size:13px">' + esc(r.name) + '</p><p style="margin:1px 0 0;color:#94a3b8;font-size:12px">' + esc(r.role) + '</p></div></div></div>';
    });
    contentArea.innerHTML = html;
    contentArea.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:0";
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
      { match: /planes?\s*activos?/i, section: "planes" },
      { match: /actividad\s*reciente/i, section: "solicitudes" },
      { match: /pagos?\s*por\s*proveedor/i, section: "pagos" },
      { match: /usuarios?\s*por\s*rol/i, section: "usuarios" },
      { match: /solicitudes?\s*por\s*estado/i, section: "solicitudes" },
      { match: /resumen\s*de\s*pagos?/i, section: "pagos" }
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
          card.title = "Ir a " + linkMap[i].section.charAt(0).toUpperCase() + linkMap[i].section.slice(1);
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
