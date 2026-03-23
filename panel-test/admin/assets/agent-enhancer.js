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
    "Resumen general del sistema": "General system overview",
    "Actividad Reciente": "Recent Activity",
    "Pagos por Proveedor": "Payments by Provider",
    "Usuarios por Rol": "Users by Role",
    "Solicitudes por Estado": "Requests by Status",
    "Resumen de Pagos": "Payment Summary",
    "Cerrar Sesion": "Logout",

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
    var allowedSections = ["expedientes", "inspecciones", "tracking", "dossiers", "inspections"];
    var nav = document.querySelector("aside nav");
    if (!nav) return;

    // Hide default React sidebar items that are not in allowed list (allowlist approach)
    // Use a CSS class + !important to survive React re-renders
    var buttons = nav.querySelectorAll("ul > li > button, ul > li > a");
    buttons.forEach(function (btn) {
      var text = (btn.textContent || "").trim().toLowerCase();
      var li = btn.closest("li");
      // Allowlist: hide anything not explicitly allowed
      if (allowedSections.indexOf(text) === -1) {
        if (li) li.classList.add("agent-sidebar-hidden");
        else btn.classList.add("agent-sidebar-hidden");
      } else {
        // Make sure allowed items are visible (in case previously hidden)
        if (li) li.classList.remove("agent-sidebar-hidden");
        else btn.classList.remove("agent-sidebar-hidden");
      }
    });

    // Also hide any standalone buttons outside <li> not in allowed list
    nav.querySelectorAll("button").forEach(function (btn) {
      var text = (btn.textContent || "").trim().toLowerCase();
      if (allowedSections.indexOf(text) === -1 && !btn.closest("li")) {
        btn.classList.add("agent-sidebar-hidden");
      }
    });

    // Hide the Configuracion button injected by admin-data-enhancer
    var configBtn = document.getElementById("sidebar-config-admin");
    if (configBtn) {
      configBtn.classList.add("agent-sidebar-hidden");
      var configLi = configBtn.closest("li");
      if (configLi) configLi.classList.add("agent-sidebar-hidden");
    }

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
   * 9. Customize dashboard for agent - show only Expedientes/Inspecciones/Tracking info
   * ------------------------------------------------------------- */
  function customizeAgentDashboard() {
    var hash = window.location.hash;
    var isDashboard = !hash || hash === "" || hash === "#" || hash === "#/" || hash === "#dashboard";

    var agentDashStyle = document.getElementById("agent-dashboard-hide-style");
    var agentDashDiv = document.getElementById("agent-dashboard-custom");

    if (!isDashboard) {
      // Not on dashboard - remove hiding CSS so other pages render normally
      if (agentDashStyle) agentDashStyle.remove();
      if (agentDashDiv) agentDashDiv.style.display = "none";
      return;
    }

    // On dashboard - inject CSS with !important to override React re-renders
    if (!agentDashStyle) {
      var style = document.createElement("style");
      style.id = "agent-dashboard-hide-style";
      style.textContent = "main > *:not(#agent-dashboard-custom) { display: none !important; }";
      document.head.appendChild(style);
    }

    // Show existing agent dashboard if it was hidden
    if (agentDashDiv) {
      agentDashDiv.style.display = "";
      return;
    }

    var main = document.querySelector("main");
    if (!main) return;

    var locale = getUserLocale();
    var isEn = locale === "en";

    // Build agent-specific dashboard
    var container = document.createElement("div");
    container.id = "agent-dashboard-custom";
    container.innerHTML =
      '<h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#0f172a">' + (isEn ? 'Agent Dashboard' : 'Panel del Agente') + '</h1>' +
      '<p style="margin:0 0 24px;font-size:14px;color:#64748b">' + (isEn ? 'Overview of dossiers, inspections and tracking' : 'Resumen de expedientes, inspecciones y tracking') + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">' +
        '<div id="agent-dash-card-exp" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#expedientes\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
            '<span style="font-size:13px;color:#64748b;font-weight:500">' + (isEn ? 'Dossiers' : 'Expedientes') + '</span>' +
            '<div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-exp-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? 'Active dossiers' : 'Expedientes activos') + '</p></div>' +
        '<div id="agent-dash-card-insp" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#inspecciones\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
            '<span style="font-size:13px;color:#64748b;font-weight:500">' + (isEn ? 'Inspections' : 'Inspecciones') + '</span>' +
            '<div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#34d399);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-insp-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? 'Total inspections' : 'Inspecciones totales') + '</p></div>' +
        '<div id="agent-dash-card-track" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#tracking\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
            '<span style="font-size:13px;color:#64748b;font-weight:500">Tracking</span>' +
            '<div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-track-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? 'Vessels being tracked' : 'Embarcaciones en seguimiento') + '</p></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px">' +
          '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            (isEn ? 'Recent Dossier Activity' : 'Actividad Reciente de Expedientes') + '</h3>' +
          '<div id="agent-dash-recent-exp" style="color:#64748b;font-size:13px">' + (isEn ? 'Loading...' : 'Cargando...') + '</div></div>' +
        '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px">' +
          '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/></svg>' +
            (isEn ? 'Active Vessels' : 'Embarcaciones Activas') + '</h3>' +
          '<div id="agent-dash-active-vessels" style="color:#64748b;font-size:13px">' + (isEn ? 'Loading...' : 'Cargando...') + '</div></div>' +
      '</div>';

    main.appendChild(container);

    // Load dashboard data
    loadAgentDashboardData(isEn);
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function loadAgentDashboardData(isEn) {
    var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
      ? "/test/api" : "/api";
    var token = localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
    var headers = { "Content-Type": "application/json", "Authorization": "Bearer " + token };

    // Fetch expedientes count
    fetch(API_BASE + "/admin_api.php?action=expedientes", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var exps = data.expedientes || data.data || [];
        var countEl = document.getElementById("agent-dash-exp-count");
        if (countEl) countEl.textContent = exps.length || "0";
        // Show recent activity
        var recentEl = document.getElementById("agent-dash-recent-exp");
        if (recentEl && exps.length > 0) {
          var recent = exps.slice(0, 5);
          var html = '<ul style="list-style:none;margin:0;padding:0">';
          recent.forEach(function (exp) {
            html += '<li style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px">' +
              '<div style="width:8px;height:8px;border-radius:50%;background:' + (exp.status === 'active' || exp.status === 'en_proceso' ? '#10b981' : '#f59e0b') + ';flex-shrink:0"></div>' +
              '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#0f172a">#' + escapeHtml(String(exp.tracking_number || exp.id)) + ' - ' + escapeHtml(exp.client_name || exp.user_name || 'N/A') + '</div>' +
              '<div style="font-size:11px;color:#94a3b8">' + escapeHtml(exp.service_type || '') + '</div></div></li>';
          });
          html += '</ul>';
          recentEl.innerHTML = html;
        } else if (recentEl) {
          recentEl.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px 0">' + (isEn ? 'No dossiers found' : 'No se encontraron expedientes') + '</p>';
        }
      })
      .catch(function () {
        var countEl = document.getElementById("agent-dash-exp-count");
        if (countEl) countEl.textContent = "-";
      });

    // Fetch tracking vessels count
    fetch(API_BASE + "/tracking_api.php?action=admin_list_vessels", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var vessels = data.vessels || [];
        var trackEl = document.getElementById("agent-dash-track-count");
        if (trackEl) trackEl.textContent = vessels.length || "0";
        // Show active vessels
        var activeEl = document.getElementById("agent-dash-active-vessels");
        if (activeEl && vessels.length > 0) {
          var html = '<ul style="list-style:none;margin:0;padding:0">';
          vessels.slice(0, 5).forEach(function (v) {
            var statusColor = v.status === 'active' ? '#10b981' : v.status === 'arrived' ? '#3b82f6' : '#f59e0b';
            html += '<li style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px">' +
              '<div style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';flex-shrink:0"></div>' +
              '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#0f172a">' + escapeHtml(v.display_name || 'N/A') + '</div>' +
              '<div style="font-size:11px;color:#94a3b8">' + escapeHtml(v.origin_label || 'USA') + ' \u2192 ' + escapeHtml(v.destination_label || 'Chile') + '</div></div></li>';
          });
          html += '</ul>';
          activeEl.innerHTML = html;
        } else if (activeEl) {
          activeEl.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px 0">' + (isEn ? 'No vessels tracked' : 'Sin embarcaciones') + '</p>';
        }
      })
      .catch(function () {
        var trackEl = document.getElementById("agent-dash-track-count");
        if (trackEl) trackEl.textContent = "-";
      });

    // Fetch inspections count
    fetch(API_BASE + "/inspection_reports_api.php?action=list", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var reports = data.reports || data.data || [];
        var inspEl = document.getElementById("agent-dash-insp-count");
        if (inspEl) inspEl.textContent = reports.length || "0";
      })
      .catch(function () {
        var inspEl = document.getElementById("agent-dash-insp-count");
        if (inspEl) inspEl.textContent = "-";
      });
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

    // Customize dashboard for agent
    customizeAgentDashboard();

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
      ".agent-price-hidden { visibility: hidden !important; }" +
      ".agent-sidebar-hidden { display: none !important; }";
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
