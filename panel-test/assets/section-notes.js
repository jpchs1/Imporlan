(function () {
  "use strict";

  var NOTE_TEXT = "Asi podras visualizar esta seccion cuando contrates una importacion";
  var NOTE_CLASS = "imporlan-section-note";

  var SECTION_HEADINGS = [
    "Dashboard",
    "Mis Importaciones",
    "Mis Documentos",
    "Documentos",
    "Alertas y Notificaciones",
    "Alertas"
  ];

  function createNoteBanner() {
    var div = document.createElement("div");
    div.className = NOTE_CLASS;
    div.style.cssText =
      "background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);" +
      "color: #fff;" +
      "padding: 12px 20px;" +
      "border-radius: 12px;" +
      "margin: 12px 0 16px;" +
      "font-size: 14px;" +
      "font-weight: 500;" +
      "display: flex;" +
      "align-items: center;" +
      "gap: 10px;" +
      "box-shadow: 0 2px 8px rgba(37,99,235,0.2);";

    var icon = document.createElement("span");
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="16" x2="12" y2="12"/>' +
      '<line x1="12" y1="8" x2="12.01" y2="8"/>' +
      "</svg>";
    icon.style.flexShrink = "0";

    var text = document.createElement("span");
    text.textContent = NOTE_TEXT;

    div.appendChild(icon);
    div.appendChild(text);
    return div;
  }

  function findSectionHeadings() {
    var headings = document.querySelectorAll("h1, h2");
    var found = [];
    for (var i = 0; i < headings.length; i++) {
      var txt = headings[i].textContent.trim();
      for (var j = 0; j < SECTION_HEADINGS.length; j++) {
        if (txt === SECTION_HEADINGS[j]) {
          found.push({ heading: headings[i], text: txt });
          break;
        }
      }
    }
    return found;
  }

  function isLoginPage() {
    var h2 = document.querySelector("h2");
    if (h2 && (h2.textContent.trim() === "Iniciar Sesion" || h2.textContent.trim() === "Registrarse")) return true;
    var cardTitle = document.querySelector('[class*="CardTitle"]');
    if (cardTitle && (cardTitle.textContent.trim() === "Iniciar Sesion" || cardTitle.textContent.trim() === "Registrarse")) return true;
    return false;
  }

  function injectNotes() {
    if (isLoginPage()) return;

    var matches = findSectionHeadings();
    var injected = 0;

    for (var i = 0; i < matches.length; i++) {
      var heading = matches[i].heading;
      var parent = heading.parentElement;
      if (!parent) continue;

      var alreadyHas = false;
      var siblings = parent.parentElement ? parent.parentElement.children : parent.children;
      for (var k = 0; k < siblings.length; k++) {
        if (siblings[k].classList && siblings[k].classList.contains(NOTE_CLASS)) {
          alreadyHas = true;
          break;
        }
      }
      var nextSib = parent.nextElementSibling;
      if (nextSib && nextSib.classList && nextSib.classList.contains(NOTE_CLASS)) {
        alreadyHas = true;
      }
      if (heading.nextElementSibling && heading.nextElementSibling.classList && heading.nextElementSibling.classList.contains(NOTE_CLASS)) {
        alreadyHas = true;
      }

      if (alreadyHas) continue;

      var note = createNoteBanner();
      var container = parent.closest(".space-y-6, .space-y-4, [class*='space-y']") || parent.parentElement;

      if (container) {
        var headerDiv = parent;
        if (headerDiv.nextSibling) {
          container.insertBefore(note, headerDiv.nextSibling);
        } else {
          container.appendChild(note);
        }
      } else {
        heading.parentElement.insertBefore(note, heading.nextSibling);
      }
      injected++;
    }
    return injected;
  }

  function startObserving() {
    injectNotes();

    var observer = new MutationObserver(function () {
      injectNotes();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(startObserving, 1500);
    });
  } else {
    setTimeout(startObserving, 1500);
  }
})();
