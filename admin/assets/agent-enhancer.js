/**
 * Agent Enhancer - Imporlan Admin Panel
 * Provides language switcher (ES/EN), price hiding, sidebar restrictions,
 * and competitive options messaging for agent role users (e.g. David Morris).
 *
 * This script reads the logged-in user info from localStorage and applies
 * UI modifications if the user has role=agent.
 * Language preference is stored in localStorage and defaults to English.
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
   * 1b. Language preference (persisted in localStorage, default EN)
   * ------------------------------------------------------------- */
  var LANG_KEY = "imporlan_agent_lang";

  function getAgentLang() {
    var stored = localStorage.getItem(LANG_KEY);
    if (stored === "es" || stored === "en") return stored;
    return "en";
  }

  function setAgentLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  function isEnglish() {
    return getAgentLang() === "en";
  }

  /* ---------------------------------------------------------------
   * 2. English translations dictionary
   * ------------------------------------------------------------- */
  var EN = {
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
    "Panel Admin": "Admin Panel",
    "Panel de Administracion": "Administration Panel",
    "Panel de Administraci\u00f3n": "Administration Panel",
    "Tracking Maritimo": "Maritime Tracking",
    "Tracking Mar\u00edtimo": "Maritime Tracking",
    "Inspecciones Tecnicas": "Technical Inspections",
    "Inspecciones T\u00e9cnicas": "Technical Inspections",
    "Gestion de expedientes de busqueda": "Search dossier management",
    "Gesti\u00f3n de expedientes de b\u00fasqueda": "Search dossier management",
    "Gestion de embarcaciones y seguimiento": "Vessel management and tracking",
    "Gesti\u00f3n de embarcaciones y seguimiento": "Vessel management and tracking",
    "Resumen general del sistema": "General system overview",
    "Total Usuarios": "Total Users",
    "Solicitudes Pendientes": "Pending Requests",
    "Ingresos Totales": "Total Revenue",
    "Planes Activos": "Active Plans",
    "Actividad Reciente": "Recent Activity",
    "Pagos por Proveedor": "Payments by Provider",
    "Usuarios por Rol": "Users by Role",
    "Solicitudes por Estado": "Requests by Status",
    "Resumen de Pagos": "Payment Summary",
    "Cerrar Sesion": "Logout",
    "Cerrar Sesi\u00f3n": "Logout",
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
    "Descripci\u00f3n": "Description",
    "Monto": "Amount",
    "Medio Pago": "Payment Method",
    "Fecha": "Date",
    "Cliente": "Client",
    "Embarcacion": "Vessel",
    "Embarcaci\u00f3n": "Vessel",
    "Pedido N\u00b0": "Order #",
    "Admin": "Admin",
    "Soporte": "Support",
    "Agente": "Agent",
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
    "Nuevo Expediente": "New Dossier",
    "Expediente": "Dossier",
    "Buscar por cliente, email...": "Search by client, email...",
    "Buscar...": "Search...",
    "Buscar cliente...": "Search client...",
    "Todos los estados": "All statuses",
    "Todos los agentes": "All agents",
    "Todos los tipos": "All types",
    "Tipo Servicio": "Service Type",
    "Plan Busqueda": "Search Plan",
    "Plan B\u00fasqueda": "Search Plan",
    "Cotizacion Link": "Quote Link",
    "Cotizaci\u00f3n Link": "Quote Link",
    "Agente...": "Agent...",
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
    "Agregar Opci\u00f3n": "Add Option",
    "Nuevo Link": "New Link",
    "Sin cambios pendientes": "No pending changes",
    "Cambios sin guardar": "Unsaved changes",
    "Guardando...": "Saving...",
    "Cargando...": "Loading...",
    "Error de conexion": "Connection error",
    "Error de conexi\u00f3n": "Connection error",
    "Datos del Expediente": "Dossier Details",
    "Informacion del Cliente": "Client Information",
    "Informaci\u00f3n del Cliente": "Client Information",
    "Opciones de Embarcaciones": "Vessel Options",
    "Nombre": "Name",
    "Email": "Email",
    "Telefono": "Phone",
    "Tel\u00e9fono": "Phone",
    "Pais": "Country",
    "Pa\u00eds": "Country",
    "Tipo de Servicio": "Service Type",
    "Agente Asignado": "Assigned Agent",
    "Fecha de Creacion": "Creation Date",
    "Fecha de Creaci\u00f3n": "Creation Date",
    "Fecha de Actualizacion": "Last Updated",
    "Fecha de Actualizaci\u00f3n": "Last Updated",
    "Notas Internas": "Internal Notes",
    "Plan de Busqueda": "Search Plan",
    "Plan de B\u00fasqueda": "Search Plan",
    "Cotizacion por Links": "Quote by Links",
    "Cotizaci\u00f3n por Links": "Quote by Links",
    "Importacion Completa": "Full Import",
    "Importaci\u00f3n Completa": "Full Import",
    "Inspeccion Pre-Compra": "Pre-Purchase Inspection",
    "Inspecci\u00f3n Pre-Compra": "Pre-Purchase Inspection",
    "Observaciones": "Observations",
    "Marca": "Brand",
    "Modelo": "Model",
    "Ano": "Year",
    "A\u00f1o": "Year",
    "Eslora": "Length",
    "Motor": "Engine",
    "Precio USD": "Price USD",
    "Precio Publicado": "Listed Price",
    "Costo Estimado": "Estimated Cost",
    "Ubicacion": "Location",
    "Ubicaci\u00f3n": "Location",
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
    "T\u00edtulo": "Title",
    "Titulo del Reporte": "Report Title",
    "T\u00edtulo del Reporte": "Report Title",
    "Contenido del Reporte": "Report Content",
    "Enviar Reporte": "Send Report",
    "Eliminar Reporte": "Delete Report",
    "productos contratados": "contracted products",
    "Productos Contratados": "Contracted Products",
    "Desde": "From",
    "Hasta": "To",
    "Ver": "View",
    "Ver Detalle": "View Detail",
    "Ver detalles": "View details",
    "cotizacion_link": "Quote Link",
    "plan_busqueda": "Search Plan",
    "importacion_completa": "Full Import",
    "inspeccion_pre_compra": "Pre-Purchase Inspection",
    "Plan Almirante": "Admiral Plan",
    "Plan Almirante Premium": "Admiral Premium Plan",
    "Plan Capitan": "Captain Plan",
    "Plan Capit\u00e1n": "Captain Plan",
    "Plan Capitan de Navio": "Ship Captain Plan",
    "Plan Capit\u00e1n de Nav\u00edo": "Ship Captain Plan",
    "Plan Fragata": "Frigate Plan",
    "Cotizacion Online": "Online Quote",
    "Cotizaci\u00f3n Online": "Online Quote",
    "Cotizacion Online - 1 link": "Online Quote - 1 link",
    "Cotizaci\u00f3n Online - 1 link": "Online Quote - 1 link",
    "Cotizacion Online - 2 links": "Online Quote - 2 links",
    "Cotizaci\u00f3n Online - 2 links": "Online Quote - 2 links",
    "Cotizacion Online - 2 linksMP": "Online Quote - 2 links MP",
    "Cotizaci\u00f3n Online - 2 linksMP": "Online Quote - 2 links MP",
    "Basica": "Basic",
    "B\u00e1sica": "Basic",
    "Estandar": "Standard",
    "Est\u00e1ndar": "Standard",
    "Premium": "Premium",
    "Crear Inspeccion": "Create Inspection",
    "Crear Inspecci\u00f3n": "Create Inspection",
    "Nueva Inspeccion": "New Inspection",
    "Nueva Inspecci\u00f3n": "New Inspection",
    "Cliente:": "Client:",
    "Embarcacion:": "Vessel:",
    "Embarcaci\u00f3n:": "Vessel:",
    "Tipo de Inspeccion": "Inspection Type",
    "Tipo de Inspecci\u00f3n": "Inspection Type",
    "Estado de Inspeccion": "Inspection Status",
    "Estado de Inspecci\u00f3n": "Inspection Status",
    "Enviar al Cliente": "Send to Client",
    "Calificacion (1-10)": "Rating (1-10)",
    "Calificaci\u00f3n (1-10)": "Rating (1-10)",
    "Casco Exterior": "Exterior Hull",
    "Motor (Visual)": "Engine (Visual)",
    "Motor Completo": "Complete Engine",
    "Sistema Electrico Basico": "Basic Electrical System",
    "Sistema El\u00e9ctrico B\u00e1sico": "Basic Electrical System",
    "Sistema Electrico": "Electrical System",
    "Sistema El\u00e9ctrico": "Electrical System",
    "Sistema Electrico Completo": "Complete Electrical System",
    "Sistema El\u00e9ctrico Completo": "Complete Electrical System",
    "Interior": "Interior",
    "Interior Completo": "Complete Interior",
    "Trailer": "Trailer",
    "Navegacion y Electronica": "Navigation & Electronics",
    "Navegaci\u00f3n y Electr\u00f3nica": "Navigation & Electronics",
    "Seguridad": "Safety",
    "Test-Drive en Agua": "Water Test-Drive",
    "Documentacion": "Documentation",
    "Documentaci\u00f3n": "Documentation",
    "Excelente": "Excellent",
    "Bueno": "Good",
    "Regular": "Fair",
    "Malo": "Poor",
    "N/A": "N/A",
    "Buen estado": "Good condition",
    "Sin danos": "No damage",
    "Sin da\u00f1os": "No damage",
    "Danos menores": "Minor damage",
    "Da\u00f1os menores": "Minor damage",
    "Danos moderados": "Moderate damage",
    "Da\u00f1os moderados": "Moderate damage",
    "Danos severos": "Severe damage",
    "Da\u00f1os severos": "Severe damage",
    "Funcionando": "Working",
    "No funciona": "Not working",
    "No probado": "Not tested",
    "Buscar por email, marca, modelo...": "Search by email, brand, model...",
    "inspecciones registradas": "inspections registered",
    "Crear Embarcacion": "Create Vessel",
    "Crear Embarcaci\u00f3n": "Create Vessel",
    "Buscar por nombre, IMO, MMSI...": "Search by name, IMO, MMSI...",
    "Inactivo": "Inactive",
    "Arribado": "Arrived",
    "Programado": "Scheduled",
    "ordenes": "orders",
    "Destacado": "Featured",
    "Nombre de la Embarcacion": "Vessel Name",
    "Nombre de la Embarcaci\u00f3n": "Vessel Name",
    "Linea Naviera": "Shipping Line",
    "L\u00ednea Naviera": "Shipping Line",
    "Puerto de Origen": "Port of Origin",
    "Puerto de Destino": "Destination Port",
    "Fecha Estimada de Llegada": "Estimated Arrival Date",
    "Configuracion AIS": "AIS Configuration",
    "Configuraci\u00f3n AIS": "AIS Configuration",
    "Guardar Configuracion": "Save Configuration",
    "Guardar Configuraci\u00f3n": "Save Configuration",
    "Ejecutar Migracion": "Run Migration",
    "Ejecutar Migraci\u00f3n": "Run Migration",
    "Actualizar Posiciones Ahora": "Update Positions Now",
    "Configurado (database)": "Configured (database)",
    "Tu API key de aisstream.io": "Your aisstream.io API key",
    "Tu API key de VesselFinder": "Your VesselFinder API key",
    "Token Cron (para trigger HTTP)": "Cron Token (HTTP trigger)",
    "Token secreto aleatorio": "Random secret token",
    "Nuevo Usuario": "New User",
    "Nuevo Plan": "New Plan",
    "Nuevo": "New",
    "Si": "Yes",
    "S\u00ed": "Yes",
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
    "Bienvenido al panel de administracion": "Welcome to the admin panel",
    "Bienvenido al panel de administraci\u00f3n": "Welcome to the admin panel",
    "competitive_banner": "Review this dossier and add competitive vessel options for the client. Your expertise in finding the best deals is valued!",
    "add_competitive_option": "Add Competitive Option",
    "competitive_options_hint": "Help the client by suggesting competitively priced vessels that match their requirements."
  };

  var EN_REGEX = [
    [/^(\d+)\s+inspecciones?\s+registradas?$/i, "$1 inspections registered"],
    [/^(\d+)\s+expedientes?\s+registrados?$/i, "$1 dossiers registered"],
    [/^(\d+)\s+embarcaciones?\s+registradas?$/i, "$1 vessels registered"],
    [/^(\d+)\s+resultados?$/i, "$1 results"],
    [/^P[a\u00e1]gina\s+(\d+)\s+de\s+(\d+)$/i, "Page $1 of $2"],
    [/^Mostrando\s+(\d+)\s+de\s+(\d+)$/i, "Showing $1 of $2"],
    [/^Mostrando\s+(\d+)\s*-\s*(\d+)\s+de\s+(\d+)$/i, "Showing $1-$2 of $3"],
    [/^Cliente:\s*(.+)$/i, "Client: $1"]
  ];

  function t(text) {
    if (!text) return text;
    var trimmed = text.trim();
    if (EN[trimmed] !== undefined) return EN[trimmed];
    return text;
  }

  /* ---------------------------------------------------------------
   * 3. DOM text translation engine
   * ------------------------------------------------------------- */
  var translatedNodes = new WeakSet();
  var originalTexts = new WeakMap();

  function translateTextNode(node) {
    if (!isEnglish()) {
      if (originalTexts.has(node)) {
        node.textContent = originalTexts.get(node);
        translatedNodes.delete(node);
      }
      return;
    }
    if (translatedNodes.has(node)) return;
    var text = node.textContent;
    if (!text || !text.trim()) return;
    var trimmed = text.trim();
    if (EN[trimmed] !== undefined) {
      originalTexts.set(node, text);
      node.textContent = text.replace(trimmed, EN[trimmed]);
      translatedNodes.add(node);
      return;
    }
    for (var i = 0; i < EN_REGEX.length; i++) {
      if (EN_REGEX[i][0].test(trimmed)) {
        originalTexts.set(node, text);
        node.textContent = text.replace(trimmed, trimmed.replace(EN_REGEX[i][0], EN_REGEX[i][1]));
        translatedNodes.add(node);
        return;
      }
    }
  }

  function translateElement(el) {
    if (!el || !el.querySelectorAll) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      translateTextNode(node);
    }
    el.querySelectorAll("[placeholder]").forEach(function (inp) {
      var ph = inp.getAttribute("placeholder");
      if (!ph) return;
      if (isEnglish() && EN[ph.trim()]) {
        if (!inp.hasAttribute("data-orig-placeholder")) inp.setAttribute("data-orig-placeholder", ph);
        inp.setAttribute("placeholder", EN[ph.trim()]);
      } else if (!isEnglish() && inp.hasAttribute("data-orig-placeholder")) {
        inp.setAttribute("placeholder", inp.getAttribute("data-orig-placeholder"));
        inp.removeAttribute("data-orig-placeholder");
      } else if (isEnglish()) {
        for (var i = 0; i < EN_REGEX.length; i++) {
          if (EN_REGEX[i][0].test(ph.trim())) {
            if (!inp.hasAttribute("data-orig-placeholder")) inp.setAttribute("data-orig-placeholder", ph);
            inp.setAttribute("placeholder", ph.trim().replace(EN_REGEX[i][0], EN_REGEX[i][1]));
            break;
          }
        }
      }
    });
    el.querySelectorAll("[title]").forEach(function (el2) {
      var ti = el2.getAttribute("title");
      if (!ti) return;
      if (isEnglish() && EN[ti.trim()]) {
        if (!el2.hasAttribute("data-orig-title")) el2.setAttribute("data-orig-title", ti);
        el2.setAttribute("title", EN[ti.trim()]);
      } else if (!isEnglish() && el2.hasAttribute("data-orig-title")) {
        el2.setAttribute("title", el2.getAttribute("data-orig-title"));
        el2.removeAttribute("data-orig-title");
      }
    });
    el.querySelectorAll("option").forEach(function (opt) {
      var val = opt.textContent.trim();
      if (isEnglish() && EN[val]) {
        if (!opt.hasAttribute("data-orig-text")) opt.setAttribute("data-orig-text", opt.textContent);
        opt.textContent = EN[val];
      } else if (!isEnglish() && opt.hasAttribute("data-orig-text")) {
        opt.textContent = opt.getAttribute("data-orig-text");
        opt.removeAttribute("data-orig-text");
      }
    });
  }

  function revertTranslations() {
    document.querySelectorAll("[data-orig-placeholder]").forEach(function (inp) {
      inp.setAttribute("placeholder", inp.getAttribute("data-orig-placeholder"));
      inp.removeAttribute("data-orig-placeholder");
    });
    document.querySelectorAll("[data-orig-title]").forEach(function (el2) {
      el2.setAttribute("title", el2.getAttribute("data-orig-title"));
      el2.removeAttribute("data-orig-title");
    });
    document.querySelectorAll("[data-orig-text]").forEach(function (opt) {
      opt.textContent = opt.getAttribute("data-orig-text");
      opt.removeAttribute("data-orig-text");
    });
    translatedNodes = new WeakSet();
    originalTexts = new WeakMap();
  }

  /* ---------------------------------------------------------------
   * 4. Price hiding logic
   * ------------------------------------------------------------- */
  function hidePrices(root) {
    if (!root) root = document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.textContent;
      if (!text) continue;
      if (/\$[\d.,]+\s*(CLP|USD)?/i.test(text)) {
        var parent = node.parentElement;
        if (parent) {
          var context = (parent.className || "") + " " + (parent.getAttribute("style") || "");
          var isPrice = /price|precio|monto|amount|cost|costo|clp|usd|revenue|ingreso|spent/i.test(
            context + " " + (parent.closest("[data-enhancer-added]") ? parent.closest("[data-enhancer-added]").textContent.substring(0, 200) : "")
          );
          var parentText = parent.parentElement ? parent.parentElement.textContent.substring(0, 300) : "";
          if (isPrice || /precio|price|monto|amount|costo|cost|clp|usd/i.test(parentText)) {
            node.textContent = text.replace(/\$[\d.,]+\s*(CLP|USD)?/gi, "---");
          }
        }
      }
    }
    root.querySelectorAll("[data-enhancer-added='plans'] .enhancer-plan-price, [data-enhancer-added='plans'] [style*='font-weight:700'][style*='color:#059669']").forEach(function (el) {
      el.textContent = "---";
    });
  }

  /* ---------------------------------------------------------------
   * 5. Sidebar restriction
   * ------------------------------------------------------------- */
  var sidebarRestricted = false;

  function restrictSidebar() {
    var allowedSections = ["expedientes", "inspecciones", "tracking", "dossiers", "inspections", "dashboard"];
    var nav = document.querySelector("aside nav");
    if (!nav) return;
    var hash = window.location.hash;
    var activeClass = "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors bg-blue-50 text-blue-600";
    var inactiveClass = "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50";
    var buttons = nav.querySelectorAll("ul > li > button, ul > li > a");
    buttons.forEach(function (btn) {
      var text = (btn.textContent || "").trim().toLowerCase();
      var li = btn.closest("li");
      if (allowedSections.indexOf(text) === -1) {
        if (li) li.classList.add("agent-sidebar-hidden");
        btn.classList.add("agent-sidebar-hidden");
      } else {
        if (li) li.classList.remove("agent-sidebar-hidden");
        btn.classList.remove("agent-sidebar-hidden");
        if (!btn.className || btn.className.indexOf("flex") === -1) {
          btn.className = inactiveClass;
        }
      }
    });
    nav.querySelectorAll("button").forEach(function (btn) {
      if (!btn.closest("li") && btn.id !== "agent-lang-switcher") {
        btn.classList.add("agent-sidebar-hidden");
      }
    });
    var hasTrackingInUl = false;
    buttons.forEach(function (btn) {
      if ((btn.textContent || "").trim().toLowerCase() === "tracking" && btn.closest("ul")) {
        hasTrackingInUl = true;
      }
    });
    if (!hasTrackingInUl && !document.getElementById("agent-tracking-nav")) {
      var ul = nav.querySelector("ul");
      if (ul) {
        var trackingLi = document.createElement("li");
        var trackingBtn = document.createElement("button");
        trackingBtn.id = "agent-tracking-nav";
        trackingBtn.className = inactiveClass;
        trackingBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map w-5 h-5"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"></path><path d="M15 5.764v15"></path><path d="M9 3.236v15"></path></svg><span class="font-medium">Tracking</span>';
        trackingBtn.addEventListener("click", function () { window.location.hash = "#tracking"; });
        trackingLi.appendChild(trackingBtn);
        ul.appendChild(trackingLi);
      }
    }
    var trackBtn = document.getElementById("agent-tracking-nav");
    if (trackBtn) {
      trackBtn.className = (hash === "#tracking") ? activeClass : inactiveClass;
    }
    var configBtn = document.getElementById("sidebar-config-admin");
    if (configBtn) {
      configBtn.classList.add("agent-sidebar-hidden");
      var configLi = configBtn.closest("li");
      if (configLi) configLi.classList.add("agent-sidebar-hidden");
    }
    translateSidebarHeader();
    injectLanguageSwitcher();
    sidebarRestricted = true;
  }

  function translateSidebarHeader() {
    var aside = document.querySelector("aside");
    if (!aside) return;
    var walker = document.createTreeWalker(aside, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest("nav")) continue;
      var text = node.textContent.trim();
      if (isEnglish() && text === "Panel Admin") {
        node.textContent = node.textContent.replace("Panel Admin", "Admin Panel");
      } else if (!isEnglish() && text === "Admin Panel") {
        node.textContent = node.textContent.replace("Admin Panel", "Panel Admin");
      }
    }
  }

  /* ---------------------------------------------------------------
   * 5b. Language switcher UI
   * ------------------------------------------------------------- */
  function injectLanguageSwitcher() {
    var existing = document.getElementById("agent-lang-switcher");
    if (existing) {
      var currentLang = getAgentLang();
      var labelSpan = existing.querySelector("span");
      if (labelSpan) labelSpan.textContent = currentLang === "en" ? "EN" : "ES";
      return;
    }
    var aside = document.querySelector("aside");
    if (!aside) return;
    var lastBtnArea = null;
    aside.querySelectorAll("button").forEach(function (b) {
      var txt = (b.textContent || "").trim().toLowerCase();
      if (txt === "logout" || txt === "cerrar sesion" || txt === "cerrar sesi\u00f3n") {
        lastBtnArea = b.parentElement;
      }
    });
    var switcher = document.createElement("button");
    switcher.id = "agent-lang-switcher";
    switcher.type = "button";
    var currentLang = getAgentLang();
    switcher.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;cursor:pointer;font-family:inherit;transition:all .2s;margin:8px 12px;width:calc(100% - 24px);justify-content:center;";
    switcher.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg><span style="font-size:12px;font-weight:600">' + (currentLang === "en" ? "EN" : "ES") + '</span>';
    switcher.title = "Switch language / Cambiar idioma";
    switcher.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var current = getAgentLang();
      var newLang = current === "en" ? "es" : "en";
      setAgentLang(newLang);
      var agentDash = document.getElementById("agent-dashboard-custom");
      if (agentDash) agentDash.remove();
      var banner = document.getElementById("agent-competitive-banner");
      if (banner) banner.remove();
      revertTranslations();
      applyAgentEnhancements();
    });
    if (lastBtnArea) {
      lastBtnArea.insertBefore(switcher, lastBtnArea.firstChild);
    } else {
      aside.appendChild(switcher);
    }
  }

  /* ---------------------------------------------------------------
   * 6. Competitive options banner
   * ------------------------------------------------------------- */
  function injectCompetitiveBanner() {
    if (document.getElementById("agent-competitive-banner")) return;
    var hash = window.location.hash;
    if (!hash || !hash.match(/#expedientes\/\d+/)) return;
    var main = document.querySelector("main");
    if (!main) return;
    var detailContainer = main.querySelector("[data-enhancer-added='ea-detail']") || main.querySelector("[data-ea-detail]");
    if (!detailContainer) return;
    var isEn = isEnglish();
    var banner = document.createElement("div");
    banner.id = "agent-competitive-banner";
    banner.setAttribute("data-enhancer-added", "agent-banner");
    banner.style.cssText = "background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:12px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:14px";
    banner.innerHTML = '<div style="width:42px;height:42px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div><div style="flex:1"><p style="margin:0;font-size:14px;font-weight:600;color:#1e40af">' + (isEn ? "Logistics Agent Action Required" : "Acci\u00f3n Requerida del Agente") + '</p><p style="margin:4px 0 0;font-size:13px;color:#3b82f6;line-height:1.5">' + (isEn ? EN["competitive_banner"] : "Revisa este expediente y agrega opciones competitivas de embarcaciones para el cliente.") + '</p></div>';
    detailContainer.insertBefore(banner, detailContainer.firstChild);
  }

  /* ---------------------------------------------------------------
   * 7. Translate expediente labels
   * ------------------------------------------------------------- */
  function translateExpedienteLabels() {
    if (!isEnglish()) return;
    document.querySelectorAll("span").forEach(function (span) {
      var text = span.textContent.trim();
      if (EN[text]) {
        if (!span.hasAttribute("data-orig-text")) span.setAttribute("data-orig-text", span.textContent);
        span.textContent = EN[text];
      }
    });
  }

  /* ---------------------------------------------------------------
   * 8. Hide price columns
   * ------------------------------------------------------------- */
  function hidePriceColumns() {
    document.querySelectorAll("th").forEach(function (th) {
      var text = th.textContent.trim();
      if (text === "Monto" || text === "Amount" || text === "Compras" || text === "Purchases") {
        var idx = Array.from(th.parentNode.children).indexOf(th);
        if (idx >= 0) {
          th.style.display = "none";
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
    document.querySelectorAll("label, span").forEach(function (el) {
      var text = el.textContent.trim();
      if (/precio\s*(usd|clp|publicado)|costo\s*estimado|price\s*(usd|clp|listed)|estimated\s*cost/i.test(text)) {
        var container = el.closest("div");
        if (container) {
          var input = container.querySelector("input");
          if (input) input.style.visibility = "hidden";
          var valueSpan = container.querySelector("span:not(:first-child)");
          if (valueSpan) valueSpan.style.visibility = "hidden";
        }
      }
    });
    document.querySelectorAll("[data-enhancer-added='plans']").forEach(function (section) {
      section.querySelectorAll("span").forEach(function (span) {
        if (/^\$[\d.,]+/.test(span.textContent.trim())) span.textContent = "---";
      });
    });
    document.querySelectorAll("[style*='font-weight:700'][style*='color:#059669']").forEach(function (el) {
      if (/^\$[\d.,]+/.test(el.textContent.trim())) el.textContent = "---";
    });
  }

  /* ---------------------------------------------------------------
   * 8b. Hide AIS configuration section
   * ------------------------------------------------------------- */
  function hideAISConfig() {
    document.querySelectorAll("h3").forEach(function (h3) {
      var text = (h3.textContent || "").trim();
      if (/Configuracion\s+AIS|Configuraci\u00f3n\s+AIS|AIS\s+Configuration/i.test(text)) {
        var parent = h3.closest("div");
        if (parent) parent.classList.add("agent-sidebar-hidden");
        else h3.classList.add("agent-sidebar-hidden");
      }
    });
    document.querySelectorAll("button").forEach(function (btn) {
      var text = (btn.textContent || "").trim();
      if (/^Guardar\s+Configuracion|^Save\s+Configuration|^Ejecutar\s+Migracion|^Run\s+Migration|^Actualizar\s+Posiciones/i.test(text)) {
        var parent = btn.closest("div");
        if (parent && !parent.querySelector("nav")) parent.classList.add("agent-sidebar-hidden");
      }
    });
    document.querySelectorAll("code").forEach(function (code) {
      if (/tracking_api\.php\?action=run_position_update/.test(code.textContent)) {
        var p = code.parentElement;
        if (p) p.classList.add("agent-sidebar-hidden");
      }
    });
  }

  /* ---------------------------------------------------------------
   * 9. Customize dashboard for agent
   * ------------------------------------------------------------- */
  function customizeAgentDashboard() {
    var hash = window.location.hash;
    var isDashboard = !hash || hash === "" || hash === "#" || hash === "#/" || hash === "#dashboard";
    var agentDashStyle = document.getElementById("agent-dashboard-hide-style");
    var agentDashDiv = document.getElementById("agent-dashboard-custom");
    if (!agentDashStyle) {
      agentDashStyle = document.createElement("style");
      agentDashStyle.id = "agent-dashboard-hide-style";
      document.head.appendChild(agentDashStyle);
    }
    if (!isDashboard) {
      agentDashStyle.textContent = ".agent-default-dash-hidden { display: none !important; } #agent-dashboard-custom { display: none !important; }";
      if (agentDashDiv) agentDashDiv.style.display = "none";
      hideDefaultDashboardContent();
      return;
    }
    agentDashStyle.textContent = "main > *:not(#agent-dashboard-custom) { display: none !important; }";
    if (agentDashDiv) { agentDashDiv.style.display = ""; return; }
    var main = document.querySelector("main");
    if (!main) return;
    var isEn = isEnglish();
    var container = document.createElement("div");
    container.id = "agent-dashboard-custom";
    container.innerHTML =
      '<h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#0f172a">' + (isEn ? "Agent Dashboard" : "Panel del Agente") + '</h1>' +
      '<p style="margin:0 0 24px;font-size:14px;color:#64748b">' + (isEn ? "Overview of dossiers, inspections and tracking" : "Resumen de expedientes, inspecciones y tracking") + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">' +
        '<div id="agent-dash-card-exp" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#expedientes\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-size:13px;color:#64748b;font-weight:500">' + (isEn ? "Dossiers" : "Expedientes") + '</span><div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-exp-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? "Active dossiers" : "Expedientes activos") + '</p></div>' +
        '<div id="agent-dash-card-insp" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#inspecciones\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-size:13px;color:#64748b;font-weight:500">' + (isEn ? "Inspections" : "Inspecciones") + '</span><div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#34d399);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-insp-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? "Total inspections" : "Inspecciones totales") + '</p></div>' +
        '<div id="agent-dash-card-track" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px;cursor:pointer;transition:all .2s" onclick="window.location.hash=\'#tracking\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><span style="font-size:13px;color:#64748b;font-weight:500">Tracking</span><div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg></div></div>' +
          '<div style="font-size:28px;font-weight:700;color:#0f172a" id="agent-dash-track-count">...</div>' +
          '<p style="margin:4px 0 0;font-size:12px;color:#64748b">' + (isEn ? "Vessels being tracked" : "Embarcaciones en seguimiento") + '</p></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px"><h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + (isEn ? "Recent Dossier Activity" : "Actividad Reciente de Expedientes") + '</h3><div id="agent-dash-recent-exp" style="color:#64748b;font-size:13px">' + (isEn ? "Loading..." : "Cargando...") + '</div></div>' +
        '<div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:20px"><h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/></svg>' + (isEn ? "Active Vessels" : "Embarcaciones Activas") + '</h3><div id="agent-dash-active-vessels" style="color:#64748b;font-size:13px">' + (isEn ? "Loading..." : "Cargando...") + '</div></div>' +
      '</div>';
    main.appendChild(container);
    loadAgentDashboardData(isEn);
  }

  function hideDefaultDashboardContent() {
    var main = document.querySelector("main");
    if (!main) return;
    var children = main.children;
    var dashPatterns = ["Total Users","Total Revenue","Pending Requests","Active Plans","Usuarios Totales","Ingresos Totales","Solicitudes Pendientes","Planes Activos","General system overview","Panorama general del sistema","Total Usuarios","Resumen general del sistema"];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.id === "agent-dashboard-custom") continue;
      if (child.hasAttribute && child.hasAttribute("data-enhancer-added")) { child.classList.remove("agent-default-dash-hidden"); continue; }
      if (child.id && child.id.indexOf("tracking") !== -1) { child.classList.remove("agent-default-dash-hidden"); continue; }
      var tag = (child.tagName || "").toLowerCase();
      var text = child.textContent || "";
      if (tag === "h1" && /^\s*Dashboard\s*$/i.test(text.trim())) { child.classList.add("agent-default-dash-hidden"); continue; }
      var isDashContent = false;
      for (var j = 0; j < dashPatterns.length; j++) { if (text.indexOf(dashPatterns[j]) !== -1) { isDashContent = true; break; } }
      if (isDashContent) child.classList.add("agent-default-dash-hidden");
      else child.classList.remove("agent-default-dash-hidden");
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function loadAgentDashboardData(isEn) {
    var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test")) ? "/test/api" : "/api";
    var token = localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
    var headers = { "Content-Type": "application/json", "Authorization": "Bearer " + token };
    fetch(API_BASE + "/orders_api.php?action=admin_list", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var exps = data.orders || data.expedientes || data.data || [];
        var countEl = document.getElementById("agent-dash-exp-count");
        if (countEl) countEl.textContent = exps.length || "0";
        var recentEl = document.getElementById("agent-dash-recent-exp");
        if (recentEl && exps.length > 0) {
          var recent = exps.slice(0, 5);
          var html = '<ul style="list-style:none;margin:0;padding:0">';
          recent.forEach(function (exp) {
            var serviceType = exp.service_type || "";
            if (isEn && EN[serviceType]) serviceType = EN[serviceType];
            html += '<li style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:' + (exp.status === "active" || exp.status === "in_progress" || exp.status === "en_proceso" ? "#10b981" : "#f59e0b") + ';flex-shrink:0"></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#0f172a">#' + escapeHtml(String(exp.order_number || exp.tracking_number || exp.id)) + ' - ' + escapeHtml(exp.customer_name || exp.client_name || exp.user_name || "N/A") + '</div><div style="font-size:11px;color:#94a3b8">' + escapeHtml(serviceType) + '</div></div></li>';
          });
          html += '</ul>';
          recentEl.innerHTML = html;
        } else if (recentEl) {
          recentEl.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px 0">' + (isEn ? "No dossiers found" : "No se encontraron expedientes") + '</p>';
        }
      }).catch(function () { var c = document.getElementById("agent-dash-exp-count"); if (c) c.textContent = "-"; });
    fetch(API_BASE + "/tracking_api.php?action=admin_list_vessels", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var vessels = data.vessels || [];
        var trackEl = document.getElementById("agent-dash-track-count");
        if (trackEl) trackEl.textContent = vessels.length || "0";
        var activeEl = document.getElementById("agent-dash-active-vessels");
        if (activeEl && vessels.length > 0) {
          var html = '<ul style="list-style:none;margin:0;padding:0">';
          vessels.slice(0, 5).forEach(function (v) {
            var statusColor = v.status === "active" ? "#10b981" : v.status === "arrived" ? "#3b82f6" : "#f59e0b";
            html += '<li style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';flex-shrink:0"></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:#0f172a">' + escapeHtml(v.display_name || "N/A") + '</div><div style="font-size:11px;color:#94a3b8">' + escapeHtml(v.origin_label || "USA") + ' \u2192 ' + escapeHtml(v.destination_label || "Chile") + '</div></div></li>';
          });
          html += '</ul>';
          activeEl.innerHTML = html;
        } else if (activeEl) {
          activeEl.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px 0">' + (isEn ? "No vessels tracked" : "Sin embarcaciones") + '</p>';
        }
      }).catch(function () { var c = document.getElementById("agent-dash-track-count"); if (c) c.textContent = "-"; });
    fetch(API_BASE + "/inspection_reports_api.php?action=list", { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var reports = data.reports || data.data || [];
        var inspEl = document.getElementById("agent-dash-insp-count");
        if (inspEl) inspEl.textContent = reports.length || "0";
      }).catch(function () { var c = document.getElementById("agent-dash-insp-count"); if (c) c.textContent = "-"; });
  }

  /* ---------------------------------------------------------------
   * 10. Main loop
   * ------------------------------------------------------------- */
  var applyTimer = null;

  function applyAgentEnhancements() {
    if (!isAgentUser()) return;
    var noPrices = hasPermission("no_prices");
    restrictSidebar();
    customizeAgentDashboard();
    hideAISConfig();
    if (isEnglish()) {
      translateElement(document.body);
      translateExpedienteLabels();
    }
    if (noPrices) hidePriceColumns();
    injectCompetitiveBanner();
  }

  function debouncedApply() {
    if (applyTimer) return;
    applyTimer = setTimeout(function () { applyTimer = null; applyAgentEnhancements(); }, 150);
  }

  /* ---------------------------------------------------------------
   * 11. Initialize
   * ------------------------------------------------------------- */
  var agentActivated = false;

  function activate() {
    if (agentActivated) return;
    agentActivated = true;
    var style = document.createElement("style");
    style.id = "agent-enhancer-styles";
    style.textContent = "#agent-competitive-banner { animation: agentBannerFade 0.3s ease-in; } @keyframes agentBannerFade { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } } .agent-price-hidden { visibility: hidden !important; } .agent-sidebar-hidden { display: none !important; } #agent-lang-switcher:hover { background: #e2e8f0 !important; color: #1e293b !important; }";
    document.head.appendChild(style);
    applyAgentEnhancements();
    new MutationObserver(debouncedApply).observe(document.body, { childList: true, subtree: true });
    setInterval(applyAgentEnhancements, 1000);
    window.addEventListener("hashchange", function () { setTimeout(applyAgentEnhancements, 200); });
  }

  function init() {
    if (isAgentUser()) {
      activate();
    } else {
      var pollCount = 0;
      var pollInterval = setInterval(function () {
        pollCount++;
        if (isAgentUser()) { clearInterval(pollInterval); activate(); }
        else if (pollCount > 60) { clearInterval(pollInterval); }
      }, 500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
