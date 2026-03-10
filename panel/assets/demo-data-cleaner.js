/**
 * Demo Data Cleaner - Imporlan User Panel
 * Removes hardcoded demo/referential data from the panel
 * and replaces it with real user data from APIs.
 * 
 * Demo sections removed:
 * - "Estado de tu Requerimiento" (REQ-2026-001 progress tracker)
 * - Summary cards (En transito, En la aduana, Entregadas, Alertas nuevas)
 * - "Importaciones activas" (IMP-2026-001 demo card)
 * - "Alertas" sidebar (Documento aprobado demo alerts)
 * - Any IMP-2026-xxx or REQ-2026-xxx references
 */
(function () {
  "use strict";

  var API_BASE = window.location.pathname.includes("/panel-test")
    ? "/test/api"
    : window.location.pathname.includes("/test/")
      ? "/test/api"
      : "/api";

  var cleaned = false;
  var lastHash = "";

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      var raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
    } catch (e) {}
    return null;
  }

  function getUserEmail() {
    var u = getUserData();
    return u ? u.email || u.user_email || "" : "";
  }

  function isDashboard() {
    var hash = window.location.hash.replace("#", "");
    return hash === "" || hash === "dashboard";
  }

  function isImportacionesPage() {
    var hash = window.location.hash.replace("#", "");
    return hash === "tracking" || hash === "importaciones";
  }

  function isAlertsPage() {
    var hash = window.location.hash.replace("#", "");
    return hash === "alerts" || hash === "alertas";
  }

  function isDocumentsPage() {
    var hash = window.location.hash.replace("#", "");
    return hash === "documents" || hash === "documentos";
  }

  function isMessagesPage() {
    var hash = window.location.hash.replace("#", "");
    return hash === "messages" || hash === "mensajes";
  }

  /* ── Helper: find a container element by text content in its heading ── */
  function findSectionByHeading(main, keywords) {
    var headings = main.querySelectorAll("h1, h2, h3, h4");
    for (var i = 0; i < headings.length; i++) {
      var txt = (headings[i].textContent || "").trim().toLowerCase();
      for (var k = 0; k < keywords.length; k++) {
        if (txt.indexOf(keywords[k]) !== -1) {
          return headings[i];
        }
      }
    }
    return null;
  }

  /* ── Helper: check if element is a protected layout container ── */
  function isProtectedElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === "MAIN" || tag === "ASIDE" || tag === "BODY" || tag === "HTML" || tag === "NAV") return true;
    var cls = el.className || "";
    if (cls.indexOf("max-w-7xl") !== -1 || cls.indexOf("max-w-6xl") !== -1 || cls.indexOf("max-w-5xl") !== -1) return true;
    if (cls.indexOf("transition-all") !== -1 && cls.indexOf("duration-") !== -1 && tag === "MAIN") return true;
    // Direct children of MAIN that are layout wrappers
    if (el.parentElement && el.parentElement.tagName === "MAIN") return true;
    return false;
  }

  /* ── Helper: find the closest card/container parent ── */
  function findCardParent(el) {
    var parent = el;
    for (var i = 0; i < 8; i++) {
      if (!parent || !parent.parentElement) break;
      parent = parent.parentElement;
      if (isProtectedElement(parent)) return null;
      var cls = parent.className || "";
      // A valid card: has rounded corners AND (border or shadow)
      var isCard = (cls.indexOf("rounded-xl") !== -1 || cls.indexOf("rounded-2xl") !== -1 || cls.indexOf("rounded-lg") !== -1);
      var hasVisualBoundary = cls.indexOf("border") !== -1 || cls.indexOf("shadow") !== -1;
      if (isCard && hasVisualBoundary) {
        // Safety: don't return if parent is also protected
        if (isProtectedElement(parent.parentElement)) {
          // This card is a direct child of a layout container - OK to hide
          return parent;
        }
        return parent;
      }
    }
    return null;
  }

  /* ── Safety: ensure layout elements are never hidden ── */
  function protectLayoutElements() {
    var main = document.querySelector("main");
    if (main && main.style.display === "none") {
      main.style.display = "";
      main.removeAttribute("data-demo-hidden");
    }
    // Protect max-w-7xl wrappers
    var wrappers = document.querySelectorAll("[class*='max-w-']");
    for (var i = 0; i < wrappers.length; i++) {
      if (wrappers[i].style.display === "none") {
        wrappers[i].style.display = "";
        wrappers[i].removeAttribute("data-demo-hidden");
      }
    }
    // Protect grid layout containers
    var grids = document.querySelectorAll("[class*='grid-cols']");
    for (var j = 0; j < grids.length; j++) {
      if (grids[j].style.display === "none") {
        grids[j].style.display = "";
        grids[j].removeAttribute("data-demo-hidden");
      }
    }
  }

  /* ── 1. Hide the "Estado de tu Requerimiento" progress tracker ── */
  function hideRequerimientoTracker(main) {
    var allEls = main.querySelectorAll("h2, h3, h4, p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("REQ-2026") !== -1 || txt.indexOf("Estado de tu Requerimiento") !== -1) {
        var card = findCardParent(allEls[i]);
        if (card) {
          card.style.display = "none";
          card.setAttribute("data-demo-hidden", "1");
        }
        return true;
      }
    }
    return false;
  }

  /* ── 2. Hide/zero the summary stat cards (En transito, En la aduana, Entregadas, Alertas nuevas) ── */
  function cleanSummaryCards(main) {
    var demoLabels = [
      "en tr\u00e1nsito", "en transito",
      "en aduana",
      "entregadas",
      "alertas nuevas"
    ];

    var cards = main.querySelectorAll("[class*='rounded']");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-demo-cleaned")) continue;
      var cardText = (cards[i].textContent || "").trim().toLowerCase();
      for (var k = 0; k < demoLabels.length; k++) {
        if (cardText.indexOf(demoLabels[k]) !== -1) {
          var cls = cards[i].className || "";
          // Match gradient cards (bg-gradient-to-br from-blue-500, from-amber-500, etc.)
          // Also match simple bg-color cards for backwards compatibility
          var isColoredCard = cls.indexOf("bg-gradient") !== -1 ||
              cls.indexOf("bg-orange") !== -1 || cls.indexOf("bg-green") !== -1 ||
              cls.indexOf("bg-cyan") !== -1 || cls.indexOf("bg-red") !== -1 ||
              cls.indexOf("bg-blue") !== -1 || cls.indexOf("bg-amber") !== -1 ||
              cls.indexOf("bg-teal") !== -1 || cls.indexOf("bg-emerald") !== -1 ||
              cls.indexOf("bg-purple") !== -1;
          if (isColoredCard) {
            // Zero the number and grey out
            var numbers = cards[i].querySelectorAll("p, span, div");
            for (var n = 0; n < numbers.length; n++) {
              var numTxt = (numbers[n].textContent || "").trim();
              if (/^\d+$/.test(numTxt) && parseInt(numTxt) > 0) {
                numbers[n].textContent = "0";
              }
            }
            cards[i].style.opacity = "0.4";
            cards[i].setAttribute("data-demo-cleaned", "1");
          }
          break;
        }
      }
    }
  }

  /* ── 3. Hide the "Importaciones activas" demo section ── */
  function hideImportacionesDemo(main) {
    // Target specific demo importation items (IMP-2026-001, IMP-2026-002)
    var allEls = main.querySelectorAll("[class*='rounded-xl']");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("IMP-2026") !== -1 && txt.length < 300) {
        var cls = allEls[i].className || "";
        // Only hide leaf-level cards (bg-gradient-to-r from-slate-50, p-5 hover cards)
        if (cls.indexOf("from-slate-50") !== -1 || cls.indexOf("hover:") !== -1 || cls.indexOf("p-5") !== -1) {
          allEls[i].style.display = "none";
          allEls[i].setAttribute("data-demo-hidden", "1");
        }
      }
    }

    // Find the "Importaciones activas" container and add empty state if all items hidden
    var heading = findSectionByHeading(main, ["importaciones activas"]);
    if (heading) {
      var container = heading.closest("[class*='shadow-lg']") || heading.closest("[class*='rounded-xl'][class*='border']");
      if (container && !container.querySelector("[data-demo-empty-imports]")) {
        var sectionText = (container.textContent || "");
        if (sectionText.indexOf("IMP-2026") !== -1) {
          // Check if there are any visible import items left
          var items = container.querySelectorAll("[class*='from-slate-50'], [class*='p-5'][class*='hover']");
          var allHidden = true;
          for (var j = 0; j < items.length; j++) {
            if (items[j].style.display !== "none") { allHidden = false; break; }
          }
          if (allHidden || items.length === 0) {
            var emptyDiv = document.createElement("div");
            emptyDiv.setAttribute("data-demo-empty-imports", "1");
            emptyDiv.style.cssText = "text-align:center;padding:30px 20px";
            emptyDiv.innerHTML =
              '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin:0 auto 12px;display:block">' +
              '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>' +
              '<path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>' +
              '<path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg>' +
              '<p style="color:#94a3b8;font-size:14px;margin:0">Aun no tienes importaciones activas</p>' +
              '<p style="color:#cbd5e1;font-size:12px;margin:4px 0 0">Cuando inicies una importacion, aparecera aqui</p>';
            container.appendChild(emptyDiv);
          }
        }
      }
    }
  }

  /* ── 4. Hide the "Alertas" demo section on dashboard ── */
  function hideAlertasDemo(main) {
    var heading = findSectionByHeading(main, ["alertas"]);
    if (!heading) return;

    var container = heading.closest("[class*='shadow-lg']") || heading.closest("[class*='rounded-xl'][class*='border']") || heading.parentElement;
    if (!container) return;

    var sectionText = (container.textContent || "");
    var hasDemoAlerts = sectionText.indexOf("IMP-2026") !== -1 || sectionText.indexOf("Documento Aprobado") !== -1 ||
        sectionText.indexOf("Documento aprobado") !== -1 || sectionText.indexOf("conocimiento de embarque") !== -1 ||
        sectionText.indexOf("Bill of Lading") !== -1 || sectionText.indexOf("Accion Requerida") !== -1 ||
        sectionText.indexOf("Actualizacion de Ubicacion") !== -1;

    if (hasDemoAlerts) {
      // Hide individual demo alert cards (p-3 rounded-xl border items)
      var alertCards = container.querySelectorAll("[class*='rounded-xl'][class*='border'][class*='p-3']");
      for (var i = 0; i < alertCards.length; i++) {
        var cardTxt = (alertCards[i].textContent || "");
        if (cardTxt.indexOf("IMP-2026") !== -1 || cardTxt.indexOf("Documento Aprobado") !== -1 ||
            cardTxt.indexOf("Documento aprobado") !== -1 || cardTxt.indexOf("Bill of Lading") !== -1 ||
            cardTxt.indexOf("Canal de Panama") !== -1 || cardTxt.indexOf("Accion Requerida") !== -1 ||
            cardTxt.indexOf("firma digital") !== -1 || cardTxt.indexOf("Actualizacion de Ubicacion") !== -1) {
          alertCards[i].style.display = "none";
          alertCards[i].setAttribute("data-demo-hidden", "1");
        }
      }

      // Add empty state if not already present
      if (!container.querySelector("[data-demo-empty-alerts]")) {
        var emptyState = document.createElement("div");
        emptyState.setAttribute("data-demo-empty-alerts", "1");
        emptyState.style.cssText = "text-align:center;padding:20px";
        emptyState.innerHTML =
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin:0 auto 8px;display:block">' +
          '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
          '<p style="color:#94a3b8;font-size:13px;margin:0">Sin alertas nuevas</p>';
        container.appendChild(emptyState);
      }
    }
  }

  /* ── 5. Clean "Mensajes" demo data ── */
  function cleanMessagesDemo(main) {
    var allEls = main.querySelectorAll("p, span, h3, h4");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if ((txt.indexOf("IMP-2026") !== -1 || txt.indexOf("REQ-2026") !== -1) && txt.length < 300) {
        var card = findCardParent(allEls[i]);
        if (card) {
          card.style.display = "none";
          card.setAttribute("data-demo-hidden", "1");
        }
      }
    }
  }

  /* ── 6. Clean sidebar notification badges with demo counts ── */
  function cleanSidebarBadges() {
    var aside = document.querySelector("aside");
    if (!aside) return;

    var buttons = aside.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || "").trim().toLowerCase();
      // Look for "Mensajes" and "Alertas" sidebar items with demo badge counts
      if (txt.indexOf("mensajes") !== -1 || txt.indexOf("alertas") !== -1) {
        var badges = buttons[i].querySelectorAll("span, div");
        for (var j = 0; j < badges.length; j++) {
          var badgeTxt = (badges[j].textContent || "").trim();
          var cls = badges[j].className || "";
          // Detect numeric badges (e.g., "3", "2")
          if (/^\d+$/.test(badgeTxt) && parseInt(badgeTxt) > 0) {
            // Check if it looks like a badge (small, colored background)
            if (cls.indexOf("bg-") !== -1 || cls.indexOf("rounded") !== -1 ||
                (badges[j].style && badges[j].style.background)) {
              badges[j].textContent = "0";
              badges[j].style.display = "none";
              badges[j].setAttribute("data-demo-badge-hidden", "1");
            }
          }
        }
      }
    }
  }

  /* ── 7. Clean documents page demo data ── */
  function cleanDocumentsDemo(main) {
    var allEls = main.querySelectorAll("p, span, div, td");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("IMP-2026") !== -1 || txt.indexOf("REQ-2026") !== -1) {
        // Find the row or card containing demo document
        var row = allEls[i].closest("tr") || findCardParent(allEls[i]);
        if (row) {
          row.style.display = "none";
          row.setAttribute("data-demo-hidden", "1");
        }
      }
    }
  }

  /* ── 8. Clean "Cotizaciones listas para su revision" demo text ── */
  function cleanCotizacionesDemo(main) {
    var allEls = main.querySelectorAll("p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim().toLowerCase();
      if (txt.indexOf("listas de cotizaciones para su revisi") !== -1 ||
          txt.indexOf("cotizaciones listas para su revisi") !== -1 ||
          txt.indexOf("listas de cotizaciones para tu revisi") !== -1 ||
          txt.indexOf("cotizaciones listas para tu revisi") !== -1) {
        // This is the progress step indicator - check if it contains REQ-2026
        var parent = allEls[i].closest("[class*='rounded']") || allEls[i].parentElement;
        if (parent) {
          var parentText = (parent.textContent || "");
          if (parentText.indexOf("REQ-2026") !== -1 || parentText.indexOf("Lancha Deportiva") !== -1) {
            var card = findCardParent(parent) || parent;
            card.style.display = "none";
            card.setAttribute("data-demo-hidden", "1");
          }
        }
      }
    }
  }

  /* ── 9. Generic: hide any remaining IMP-2026/REQ-2026 references ── */
  function hideAllDemoReferences(main) {
    // Only target leaf-level elements (not containers) to avoid hiding layout
    var allEls = main.querySelectorAll("p, span, h2, h3, h4, td, li");
    for (var i = 0; i < allEls.length; i++) {
      if (allEls[i].getAttribute("data-demo-hidden") || allEls[i].getAttribute("data-demo-replaced")) continue;
      // Only check the element's OWN direct text, not all descendant text
      var ownText = "";
      for (var c = 0; c < allEls[i].childNodes.length; c++) {
        if (allEls[i].childNodes[c].nodeType === 3) ownText += allEls[i].childNodes[c].textContent;
      }
      var txt = (allEls[i].textContent || "").trim();
      if ((ownText.indexOf("IMP-2026") !== -1 || ownText.indexOf("REQ-2026") !== -1) ||
          (txt.indexOf("IMP-2026") !== -1 || txt.indexOf("REQ-2026") !== -1)) {
        // Only hide if this element is a small leaf (not a big section)
        if (txt.length < 300) {
          var card = findCardParent(allEls[i]);
          if (card && !card.getAttribute("data-demo-hidden")) {
            card.style.display = "none";
            card.setAttribute("data-demo-hidden", "1");
          }
        }
      }
    }
  }

  /* ── 10. Clean support page demo operation selector ── */
  function cleanSupportDemo(main) {
    // The support page has a dropdown with IMP-2026-001 and IMP-2026-002
    var selects = main.querySelectorAll("select, [role='listbox'], [role='combobox']");
    for (var i = 0; i < selects.length; i++) {
      var options = selects[i].querySelectorAll("option, [role='option']");
      for (var j = 0; j < options.length; j++) {
        var optTxt = (options[j].textContent || "").trim();
        if (optTxt.indexOf("IMP-2026") !== -1 || optTxt.indexOf("REQ-2026") !== -1) {
          options[j].style.display = "none";
        }
      }
    }
  }

  /* ── Main cleaning function ── */
  function cleanDemoData() {
    var email = getUserEmail();
    if (!email) return; // Only clean for logged-in users

    var main = document.querySelector("main");
    if (!main) return;

    if (isDashboard()) {
      hideRequerimientoTracker(main);
      cleanSummaryCards(main);
      hideImportacionesDemo(main);
      hideAlertasDemo(main);
      cleanCotizacionesDemo(main);
    }

    if (isImportacionesPage()) {
      hideImportacionesDemo(main);
    }

    if (isAlertsPage()) {
      hideAlertasDemo(main);
    }

    if (isDocumentsPage()) {
      cleanDocumentsDemo(main);
    }

    if (isMessagesPage()) {
      cleanMessagesDemo(main);
    }

    // Always clean sidebar badges and generic references
    cleanSidebarBadges();
    hideAllDemoReferences(main);
    cleanSupportDemo(main);

    // CRITICAL: Always ensure layout elements are visible
    protectLayoutElements();
  }

  /* ── Init ── */
  function init() {
    var email = getUserEmail();
    if (!email) return;

    // Run cleaning on initial load
    cleanDemoData();

    // Watch for route changes (hash changes)
    window.addEventListener("hashchange", function () {
      cleaned = false;
      setTimeout(cleanDemoData, 300);
      setTimeout(cleanDemoData, 800);
      setTimeout(cleanDemoData, 1500);
    });

    // MutationObserver to catch React re-renders
    var observer = new MutationObserver(function () {
      var currentHash = window.location.hash;
      if (currentHash !== lastHash) {
        lastHash = currentHash;
        cleaned = false;
      }
      // Throttled cleaning
      if (!cleaned) {
        cleaned = true;
        setTimeout(function () {
          cleanDemoData();
          cleaned = false;
        }, 200);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also run periodically for first 10 seconds after page load
    var runs = 0;
    var interval = setInterval(function () {
      cleanDemoData();
      runs++;
      if (runs >= 10) clearInterval(interval);
    }, 1000);
  }

  function startWhenReady() {
    var main = document.querySelector("main");
    var email = getUserEmail();
    if (main && email) {
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
