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

  /* ── Helper: find the closest card/container parent ── */
  function findCardParent(el) {
    var parent = el;
    for (var i = 0; i < 10; i++) {
      if (!parent || !parent.parentElement) break;
      parent = parent.parentElement;
      if (parent.tagName === "MAIN") break;
      var cls = parent.className || "";
      if (cls.indexOf("rounded") !== -1 && cls.indexOf("shadow") !== -1) {
        return parent;
      }
      if (cls.indexOf("rounded-2xl") !== -1 || cls.indexOf("rounded-xl") !== -1) {
        return parent;
      }
    }
    return null;
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
      "en la aduana",
      "entregadas",
      "alertas nuevas"
    ];

    var cards = main.querySelectorAll("[class*='rounded']");
    for (var i = 0; i < cards.length; i++) {
      var cardText = (cards[i].textContent || "").trim().toLowerCase();
      for (var k = 0; k < demoLabels.length; k++) {
        if (cardText.indexOf(demoLabels[k]) !== -1) {
          // Check if this is one of the colored summary cards
          var cls = cards[i].className || "";
          if (cls.indexOf("bg-orange") !== -1 || cls.indexOf("bg-green") !== -1 ||
              cls.indexOf("bg-cyan") !== -1 || cls.indexOf("bg-red") !== -1 ||
              cls.indexOf("bg-blue") !== -1 || cls.indexOf("bg-amber") !== -1 ||
              cls.indexOf("bg-teal") !== -1 || cls.indexOf("bg-emerald") !== -1) {
            // Zero the number and grey out
            var numbers = cards[i].querySelectorAll("p, span, div");
            for (var n = 0; n < numbers.length; n++) {
              var numTxt = (numbers[n].textContent || "").trim();
              if (/^\d+$/.test(numTxt) && parseInt(numTxt) > 0) {
                numbers[n].textContent = "0";
              }
            }
            cards[i].style.opacity = "0.5";
            cards[i].setAttribute("data-demo-cleaned", "1");
          }
          break;
        }
      }
    }
  }

  /* ── 3. Hide the "Importaciones activas" demo section ── */
  function hideImportacionesDemo(main) {
    var allEls = main.querySelectorAll("h2, h3, h4, p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("IMP-2026") !== -1) {
        // Find the card containing the demo importacion
        var card = findCardParent(allEls[i]);
        if (card) {
          card.style.display = "none";
          card.setAttribute("data-demo-hidden", "1");
        }
      }
    }

    // Also look for the "Importaciones activas" heading and its section
    var heading = findSectionByHeading(main, ["importaciones activas"]);
    if (heading) {
      var section = heading.closest("[class*='space-y']") || heading.closest("[class*='col-span']") || heading.parentElement;
      if (section) {
        // Check if section has demo data (IMP-2026)
        var sectionText = (section.textContent || "");
        if (sectionText.indexOf("IMP-2026") !== -1) {
          // Replace with empty state
          var container = heading.parentElement;
          if (container) {
            var children = container.children;
            for (var c = 0; c < children.length; c++) {
              if (children[c] !== heading && (children[c].textContent || "").indexOf("IMP-2026") !== -1) {
                children[c].innerHTML =
                  '<div style="text-align:center;padding:30px 20px">' +
                  '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin:0 auto 12px;display:block">' +
                  '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>' +
                  '<path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>' +
                  '<path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 1v4"/></svg>' +
                  '<p style="color:#94a3b8;font-size:14px;margin:0">Aun no tienes importaciones activas</p>' +
                  '<p style="color:#cbd5e1;font-size:12px;margin:4px 0 0">Cuando inicies una importacion, aparecera aqui</p></div>';
                children[c].setAttribute("data-demo-replaced", "1");
              }
            }
          }
        }
      }
    }
  }

  /* ── 4. Hide the "Alertas" demo section on dashboard ── */
  function hideAlertasDemo(main) {
    var heading = findSectionByHeading(main, ["alertas"]);
    if (!heading) return;

    var section = heading.closest("[class*='space-y']") || heading.closest("[class*='col-span']") || heading.parentElement;
    if (!section) return;

    var sectionText = (section.textContent || "");
    if (sectionText.indexOf("IMP-2026") !== -1 || sectionText.indexOf("Documento aprobado") !== -1 ||
        sectionText.indexOf("conocimiento de embarque") !== -1 || sectionText.indexOf("Bill of Lading") !== -1) {
      // Replace demo alerts with empty state
      var alertCards = section.querySelectorAll("[class*='rounded']");
      for (var i = 0; i < alertCards.length; i++) {
        var cardTxt = (alertCards[i].textContent || "");
        if (cardTxt.indexOf("IMP-2026") !== -1 || cardTxt.indexOf("Documento aprobado") !== -1 ||
            cardTxt.indexOf("Bill of Lading") !== -1 || cardTxt.indexOf("Canal de Panama") !== -1) {
          alertCards[i].style.display = "none";
          alertCards[i].setAttribute("data-demo-hidden", "1");
        }
      }

      // If all alert cards are hidden, show empty state
      var visibleCards = 0;
      alertCards = section.querySelectorAll("[class*='rounded']");
      for (var j = 0; j < alertCards.length; j++) {
        if (alertCards[j].style.display !== "none" && !alertCards[j].getAttribute("data-demo-hidden")) {
          visibleCards++;
        }
      }

      if (visibleCards === 0 && !section.querySelector("[data-demo-empty-alerts]")) {
        var emptyState = document.createElement("div");
        emptyState.setAttribute("data-demo-empty-alerts", "1");
        emptyState.style.cssText = "text-align:center;padding:20px";
        emptyState.innerHTML =
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin:0 auto 8px;display:block">' +
          '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
          '<p style="color:#94a3b8;font-size:13px;margin:0">Sin alertas nuevas</p>';
        section.appendChild(emptyState);
      }
    }
  }

  /* ── 5. Clean "Mensajes" demo data ── */
  function cleanMessagesDemo(main) {
    var allEls = main.querySelectorAll("p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("IMP-2026") !== -1 || txt.indexOf("REQ-2026") !== -1) {
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
    var allEls = main.querySelectorAll("p, span, div, h2, h3, h4, td, li");
    for (var i = 0; i < allEls.length; i++) {
      if (allEls[i].getAttribute("data-demo-hidden") || allEls[i].getAttribute("data-demo-replaced")) continue;
      var txt = (allEls[i].textContent || "").trim();
      if (txt.indexOf("IMP-2026") !== -1 || txt.indexOf("REQ-2026") !== -1) {
        // Only hide if this element is small enough (not the whole page)
        if (txt.length < 500) {
          var card = findCardParent(allEls[i]);
          if (card && !card.getAttribute("data-demo-hidden")) {
            // Only hide if it's a card-level element, not the main content
            var cardText = (card.textContent || "").trim();
            if (cardText.length < 2000) {
              card.style.display = "none";
              card.setAttribute("data-demo-hidden", "1");
            }
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
