/**
 * Agent Enhancer - Imporlan Admin Panel
 * Provides English translations, price hiding, sidebar restrictions,
 * and competitive options messaging for agent role users (e.g. David Morris).
 *
 * This script reads the logged-in user info from localStorage and applies
 * UI modifications if the user has role=agent with locale=en and no_prices permission.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
   * 1. Detect agent user
   * ------------------------------------------------------------- */
  function getAdminUser() {
    try {
      var raw = localStorage.getItem("imporlan_admin_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function getTokenPayload() {
    var token = localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token");
    if (!token) return null;
    try {
      var parts = token.split(".");
      if (parts.length !== 3) return null;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload;
    } catch (e) { return null; }
  }

  function isAgentUser() {
    var user = getAdminUser();
    if (user && user.role === "agent") return true;
    var payload = getTokenPayload();
    if (payload && payload.role === "agent") return true;
    return false;
  }

  function getUserLocale() {
    var user = getAdminUser();
    if (user && user.locale) return user.locale;
    var payload = getTokenPayload();
    if (payload && payload.locale) return payload.locale;
    return "es";
  }

  function getUserPermissions() {
    var user = getAdminUser();
    var perms = (user && user.permissions) ? user.permissions : null;
    if (!perms) {
      var payload = getTokenPayload();
      perms = payload ? payload.permissions : null;
    }
    if (typeof perms === "string") return perms.split(",");
    if (Array.isArray(perms)) return perms;
    return [];
  }

  function hasPermission(perm) {
    return getUserPermissions().indexOf(perm) !== -1;
  }

  /* ---------------------------------------------------------------
   * 2. English translations dictionary
   * ------------------------------------------------------------- */
  var EN = {
    // Sidebar
    "Dashboard": "Dashboard",
    "Usuarios": "Users",
    "Solicitudes": "Requests",
    "Planes": "Plans",
    "Pagos": "Payments",
    "Contenido": "Content",
    "Auditoria": "Audit",
    "Configuracion": "Settings",
    "Expedientes": "Dossiers",
    "Inspecciones": "Inspections",
    "Tracking": "Tracking",

    // Page titles (h1)
    "Panel de Administracion": "Administration Panel",
    "Panel de Administración": "Administration Panel",

    // Dashboard cards
    "Total Usuarios": "Total Users",
    "Solicitudes Pendientes": "Pending Requests",
    "Ingresos Totales": "Total Revenue",
    "Planes Activos": "Active Plans",

    // Table headers
    "Usuario": "User",
    "Rol": "Role",
    "Estado": "Status",
    "Compras": "Purchases",
    "Creado": "Created",
    "Acciones": "Actions",
    "ID": "ID",
    "Tipo": "Type",
    "Servicio": "Service",
    "Descripcion": "Description",
    "Descripción": "Description",
    "Monto": "Amount",
    "Medio Pago": "Payment Method",
    "Fecha": "Date",
    "Cliente": "Client",

    // Roles
    "Admin": "Admin",
    "Soporte": "Support",
    "Agente": "Agent",

    // Status labels
    "Activo": "Active",
    "Suspendido": "Suspended",
    "Pendiente": "Pending",
    "En Proceso": "In Progress",
    "Completado": "Completed",
    "Vencido": "Expired",
    "Cancelado": "Canceled",
    "Borrador": "Draft",
    "En Progreso": "In Progress",
    "Enviado": "Sent",

    // Expedientes
    "Nuevo Expediente": "New Dossier",
    "Expediente": "Dossier",
    "Buscar por cliente, email...": "Search by client, email...",
    "Buscar...": "Search...",
    "Todos los estados": "All statuses",
    "Todos los agentes": "All agents",
    "Todos los tipos": "All types",
    "Guardar Cambios": "Save Changes",
    "Guardar": "Save",
    "Cancelar": "Cancel",
    "Eliminar": "Delete",
    "Editar": "Edit",
    "Crear": "Create",
    "Cerrar": "Close",
    "Volver": "Back",
    "Agregar Link": "Add Link",
    "Agregar Opcion": "Add Option",
    "Nuevo Link": "New Link",
    "Sin cambios pendientes": "No pending changes",
    "Cambios sin guardar": "Unsaved changes",
    "Guardando...": "Saving...",
    "Cargando...": "Loading...",
    "Error de conexion": "Connection error",
    "Datos del Expediente": "Dossier Details",
    "Informacion del Cliente": "Client Information",
    "Opciones de Embarcaciones": "Vessel Options",
    "Nombre": "Name",
    "Email": "Email",
    "Telefono": "Phone",
    "Pais": "Country",
    "Tipo de Servicio": "Service Type",
    "Agente Asignado": "Assigned Agent",
    "Fecha de Creacion": "Creation Date",
    "Fecha de Actualizacion": "Last Updated",
    "Notas Internas": "Internal Notes",
    "Plan de Busqueda": "Search Plan",
    "Cotizacion por Links": "Quote by Links",
    "Importacion Completa": "Full Import",
    "Inspeccion Pre-Compra": "Pre-Purchase Inspection",
    "Observaciones": "Observations",
    "Marca": "Brand",
    "Modelo": "Model",
    "Ano": "Year",
    "Eslora": "Length",
    "Motor": "Engine",
    "Precio USD": "Price USD",
    "Precio Publicado": "Listed Price",
    "Costo Estimado": "Estimated Cost",
    "Ubicacion": "Location",
    "Link": "Link",
    "Imagen": "Image",
    "Ranking": "Ranking",
    "Subir Imagen": "Upload Image",
    "Re-Scrape": "Re-Scrape",
    "Auto-fetch": "Auto-fetch",
    "Reporte": "Report",
    "Reportes": "Reports",
    "Crear Reporte": "Create Report",
    "Editar Reporte": "Edit Report",
    "Nuevo Reporte": "New Report",
    "Titulo": "Title",
    "Titulo del Reporte": "Report Title",
    "Contenido del Reporte": "Report Content",
    "Enviar Reporte": "Send Report",
    "Eliminar Reporte": "Delete Report",
    "productos contratados": "contracted products",
    "Productos Contratados": "Contracted Products",

    // Inspections
    "Basica": "Basic",
    "Estandar": "Standard",
    "Premium": "Premium",
    "Crear Inspeccion": "Create Inspection",
    "Nueva Inspeccion": "New Inspection",
    "Cliente:": "Client:",
    "Embarcacion:": "Vessel:",
    "Tipo de Inspeccion": "Inspection Type",
    "Estado de Inspeccion": "Inspection Status",
    "Enviar al Cliente": "Send to Client",
    "Calificacion (1-10)": "Rating (1-10)",
    "Casco Exterior": "Exterior Hull",
    "Motor (Visual)": "Engine (Visual)",
    "Motor Completo": "Complete Engine",
    "Sistema Electrico Basico": "Basic Electrical System",
    "Sistema Electrico": "Electrical System",
    "Sistema Electrico Completo": "Complete Electrical System",
    "Interior": "Interior",
    "Interior Completo": "Complete Interior",
    "Trailer": "Trailer",
    "Navegacion y Electronica": "Navigation & Electronics",
    "Seguridad": "Safety",
    "Test-Drive en Agua": "Water Test-Drive",
    "Documentacion": "Documentation",
    "Excelente": "Excellent",
    "Bueno": "Good",
    "Regular": "Fair",
    "Malo": "Poor",
    "N/A": "N/A",
    "Buen estado": "Good condition",
    "Sin danos": "No damage",
    "Danos menores": "Minor damage",
    "Danos moderados": "Moderate damage",
    "Danos severos": "Severe damage",
    "Funcionando": "Working",
    "No funciona": "Not working",
    "No probado": "Not tested",

    // Tracking
    "Crear Embarcacion": "Create Vessel",
    "Buscar por nombre, IMO, MMSI...": "Search by name, IMO, MMSI...",
    "Todos los estados": "All statuses",
    "Activo": "Active",
    "Inactivo": "Inactive",
    "Arribado": "Arrived",
    "Programado": "Scheduled",
    "ordenes": "orders",
    "Destacado": "Featured",
    "Nombre de la Embarcacion": "Vessel Name",
    "Linea Naviera": "Shipping Line",
    "Puerto de Origen": "Port of Origin",
    "Puerto de Destino": "Destination Port",
    "Fecha Estimada de Llegada": "Estimated Arrival Date",

    // General UI
    "Nuevo Usuario": "New User",
    "Nuevo Plan": "New Plan",
    "Nuevo": "New",
    "Si": "Yes",
    "No": "No",
    "Buscar": "Search",
    "Filtrar": "Filter",
    "Exportar": "Export",
    "Imprimir": "Print",
    "Anterior": "Previous",
    "Siguiente": "Next",
    "de": "of",
    "resultados": "results",
    "No hay datos": "No data",
    "No se encontraron resultados": "No results found",

    // Competitive options messaging
    "competitive_banner": "Review this dossier and add competitive vessel options for the client. Your expertise in finding the best deals is valued!",
    "add_competitive_option": "Add Competitive Option",
    "competitive_options_hint": "Help the client by suggesting competitively priced vessels that match their requirements."
  };

  function t(text) {
    if (!text) return text;
    var trimmed = text.trim();
    return EN[trimmed] !== undefined ? EN[trimmed] : text;
  }

  /* ---------------------------------------------------------------
   * 3. DOM text translation engine
   * ------------------------------------------------------------- */
  var translatedNodes = new WeakSet();

  function translateTextNode(node) {
    if (translatedNodes.has(node)) return;
    var text = node.textContent;
    if (!text || !text.trim()) return;
    var trimmed = text.trim();
    if (EN[trimmed] !== undefined) {
      node.textContent = text.replace(trimmed, EN[trimmed]);
      translatedNodes.add(node);
    }
  }

  function translateElement(el) {
    if (!el || !el.querySelectorAll) return;

    // Translate text nodes within the element
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      translateTextNode(node);
    }

    // Translate placeholder attributes
    el.querySelectorAll("[placeholder]").forEach(function (inp) {
      var ph = inp.getAttribute("placeholder");
      if (ph && EN[ph.trim()]) {
        inp.setAttribute("placeholder", EN[ph.trim()]);
      }
    });

    // Translate title attributes
    el.querySelectorAll("[title]").forEach(function (el2) {
      var ti = el2.getAttribute("title");
      if (ti && EN[ti.trim()]) {
        el2.setAttribute("title", EN[ti.trim()]);
      }
    });

    // Translate select options
    el.querySelectorAll("option").forEach(function (opt) {
      var val = opt.textContent.trim();
      if (EN[val]) opt.textContent = EN[val];
    });
  }

  /* ---------------------------------------------------------------
   * 4. Price hiding logic
   * ------------------------------------------------------------- */
  function hidePrices(root) {
    if (!root) root = document.body;

    // Hide CLP formatted prices ($xxx.xxx or $x.xxx.xxx CLP)
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.textContent;
      if (!text) continue;
      // Match CLP prices like $123.456, $1.234.567 CLP, USD $xx.xx
      if (/\$[\d.,]+\s*(CLP|USD)?/i.test(text)) {
        // Only hide if it looks like a price (not an id or code)
        var parent = node.parentElement;
        if (parent) {
          var context = (parent.className || "") + " " + (parent.getAttribute("style") || "");
          // Check if this is in a price context
          var isPrice = /price|precio|monto|amount|cost|costo|clp|usd|revenue|ingreso|spent/i.test(
            context + " " + (parent.closest("[data-enhancer-added]") ? parent.closest("[data-enhancer-added]").textContent.substring(0, 200) : "")
          );
          // Also check nearby labels
          var prevSib = parent.previousElementSibling;
          var parentText = parent.parentElement ? parent.parentElement.textContent.substring(0, 300) : "";
          if (isPrice || /precio|price|monto|amount|costo|cost|clp|usd/i.test(parentText)) {
            node.textContent = text.replace(/\$[\d.,]+\s*(CLP|USD)?/gi, "---");
          }
        }
      }
    }

    // Hide plan price elements specifically
    root.querySelectorAll("[data-enhancer-added='plans'] .enhancer-plan-price, [data-enhancer-added='plans'] [style*='font-weight:700'][style*='color:#059669']").forEach(function (el) {
      el.textContent = "---";
    });
  }

  /* ---------------------------------------------------------------
   * 5. Sidebar restriction - only show Expedientes, Inspecciones, Tracking
   * ------------------------------------------------------------- */
  var sidebarRestricted = false;

  function restrictSidebar() {
    var allowedSections = ["expedientes", "inspecciones", "tracking"];
    var nav = document.querySelector("aside nav");
    if (!nav) return;

    // Hide default React sidebar items that are not in allowed list
    var buttons = nav.querySelectorAll("ul > li > button, ul > li > a");
    buttons.forEach(function (btn) {
      var text = (btn.textContent || "").trim().toLowerCase();
      // Map Spanish sidebar labels to section keys
      var sectionMap = {
        "dashboard": "dashboard",
        "usuarios": "usuarios",
        "solicitudes": "solicitudes",
        "planes": "planes",
        "pagos": "pagos",
        "contenido": "contenido",
        "auditoria": "auditoria"
      };
      var section = sectionMap[text] || text;
      if (allowedSections.indexOf(section) === -1) {
        var li = btn.closest("li");
        if (li) li.style.display = "none";
        else btn.style.display = "none";
      }
    });

    // Hide the Configuracion button injected by admin-data-enhancer
    var configBtn = document.getElementById("sidebar-config-admin");
    if (configBtn) configBtn.style.display = "none";

    sidebarRestricted = true;
  }

  /* ---------------------------------------------------------------
   * 6. Competitive options banner for Expedientes
   * ------------------------------------------------------------- */
  function injectCompetitiveBanner() {
    if (document.getElementById("agent-competitive-banner")) return;

    // Check if we are on an expediente detail view
    var hash = window.location.hash;
    if (!hash || !hash.match(/#expedientes\/\d+/)) return;

    // Find the main content area
    var main = document.querySelector("main");
    if (!main) return;

    // Find the expediente detail container
    var detailContainer = main.querySelector("[data-enhancer-added='ea-detail']") ||
                          main.querySelector("[data-ea-detail]");
    if (!detailContainer) return;

    var banner = document.createElement("div");
    banner.id = "agent-competitive-banner";
    banner.setAttribute("data-enhancer-added", "agent-banner");
    banner.style.cssText = "margin:16px 0;padding:16px 20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:14px;display:flex;align-items:center;gap:14px";
    banner.innerHTML =
      '<div style="width:42px;height:42px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>' +
      '<div style="flex:1"><p style="margin:0;font-size:14px;font-weight:600;color:#1e40af">Logistics Agent Action Required</p>' +
      '<p style="margin:4px 0 0;font-size:13px;color:#3b82f6;line-height:1.5">' + EN["competitive_banner"] + '</p></div>';

    // Insert at top of detail view
    detailContainer.insertBefore(banner, detailContainer.firstChild);
  }

  /* ---------------------------------------------------------------
   * 7. Override status & label translations in expedientes
   * ------------------------------------------------------------- */
  function translateExpedienteLabels() {
    // Translate status badges
    document.querySelectorAll("span").forEach(function (span) {
      var text = span.textContent.trim();
      if (EN[text]) {
        span.textContent = EN[text];
      }
    });
  }

  /* ---------------------------------------------------------------
   * 8. Hide price columns/elements throughout the panel
   * ------------------------------------------------------------- */
  function hidePriceColumns() {
    // Hide Monto column in solicitudes table
    document.querySelectorAll("th").forEach(function (th) {
      var text = th.textContent.trim();
      if (text === "Monto" || text === "Amount" || text === "Compras" || text === "Purchases") {
        var idx = Array.from(th.parentNode.children).indexOf(th);
        if (idx >= 0) {
          th.style.display = "none";
          // Hide corresponding td in all rows
          var table = th.closest("table");
          if (table) {
            table.querySelectorAll("tbody tr").forEach(function (row) {
              var cells = row.querySelectorAll("td");
              if (cells[idx]) cells[idx].style.display = "none";
            });
          }
        }
      }
    });

    // Hide price-related elements in expediente detail (USD prices, CLP costs)
    document.querySelectorAll("label, span").forEach(function (el) {
      var text = el.textContent.trim();
      if (/precio\s*(usd|clp|publicado)|costo\s*estimado|price\s*(usd|clp|listed)|estimated\s*cost/i.test(text)) {
        var container = el.closest("div");
        if (container) {
          // Hide the input/value next to the label
          var input = container.querySelector("input");
          if (input) input.style.visibility = "hidden";
          var valueSpan = container.querySelector("span:not(:first-child)");
          if (valueSpan) valueSpan.style.visibility = "hidden";
        }
      }
    });

    // Hide plan price cards
    document.querySelectorAll("[data-enhancer-added='plans']").forEach(function (section) {
      section.querySelectorAll("span").forEach(function (span) {
        if (/^\$[\d.,]+/.test(span.textContent.trim())) {
          span.textContent = "---";
        }
      });
    });

    // Hide inspection prices
    document.querySelectorAll("[style*='font-weight:700'][style*='color:#059669']").forEach(function (el) {
      if (/^\$[\d.,]+/.test(el.textContent.trim())) {
        el.textContent = "---";
      }
    });
  }

  /* ---------------------------------------------------------------
   * 9. Force redirect to Expedientes on login (agent default view)
   * ------------------------------------------------------------- */
  function redirectToExpedientes() {
    var hash = window.location.hash;
    if (!hash || hash === "" || hash === "#" || hash === "#/") {
      // Click the expedientes sidebar button to navigate there
      var expBtn = document.getElementById("sidebar-expedientes-admin");
      if (expBtn) {
        expBtn.click();
        return true;
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------
   * 10. Main loop - apply all agent modifications
   * ------------------------------------------------------------- */
  var applyTimer = null;

  function applyAgentEnhancements() {
    if (!isAgentUser()) return;

    var locale = getUserLocale();
    var noPrices = hasPermission("no_prices");

    // Restrict sidebar
    restrictSidebar();

    // Translate to English if locale is 'en'
    if (locale === "en") {
      translateElement(document.body);
      translateExpedienteLabels();
    }

    // Hide prices if permission set
    if (noPrices) {
      hidePriceColumns();
    }

    // Inject competitive banner on expediente detail
    if (locale === "en") {
      injectCompetitiveBanner();
    }

    // Redirect to expedientes as default view
    redirectToExpedientes();
  }

  function debouncedApply() {
    if (applyTimer) return;
    applyTimer = setTimeout(function () {
      applyTimer = null;
      applyAgentEnhancements();
    }, 150);
  }

  /* ---------------------------------------------------------------
   * 11. Initialize
   * ------------------------------------------------------------- */
  function init() {
    if (!isAgentUser()) return;

    // Add agent-specific CSS
    var style = document.createElement("style");
    style.id = "agent-enhancer-styles";
    style.textContent =
      "#agent-competitive-banner { animation: agentBannerFade 0.3s ease-in; }" +
      "@keyframes agentBannerFade { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }" +
      ".agent-price-hidden { visibility: hidden !important; }";
    document.head.appendChild(style);

    // Apply immediately and on every DOM change
    applyAgentEnhancements();
    new MutationObserver(debouncedApply).observe(document.body, { childList: true, subtree: true });
    setInterval(applyAgentEnhancements, 1000);

    // Listen for hash changes (navigation)
    window.addEventListener("hashchange", function () {
      setTimeout(applyAgentEnhancements, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
