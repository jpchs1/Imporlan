(function () {
  "use strict";

  var NOTE_TEXT = "Asi podras visualizar esta seccion cuando contrates una importacion";
  var NOTE_CLASS = "imporlan-section-note";

  var SECTION_TITLES = [
    "Bienvenido",
    "Mis Importaciones",
    "Documentos",
    "Alertas",
    "Notificaciones"
  ];

  function createNoteElement() {
    var note = document.createElement("div");
    note.className = NOTE_CLASS;
    note.style.cssText =
      "background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);" +
      "border: 1px solid #93c5fd;" +
      "border-left: 4px solid #3b82f6;" +
      "border-radius: 12px;" +
      "padding: 16px 20px;" +
      "margin: 16px 0 24px 0;" +
      "display: flex;" +
      "align-items: center;" +
      "gap: 12px;" +
      "animation: sectionNoteIn 0.4s ease;";

    var iconWrap = document.createElement("div");
    iconWrap.style.cssText =
      "flex-shrink: 0;" +
      "width: 36px;" +
      "height: 36px;" +
      "background: linear-gradient(135deg, #3b82f6, #60a5fa);" +
      "border-radius: 50%;" +
      "display: flex;" +
      "align-items: center;" +
      "justify-content: center;";
    iconWrap.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="16" x2="12" y2="12"/>' +
      '<line x1="12" y1="8" x2="12.01" y2="8"/>' +
      "</svg>";

    var text = document.createElement("p");
    text.style.cssText =
      "margin: 0;" +
      "color: #1e40af;" +
      "font-size: 14px;" +
      "font-weight: 500;" +
      "line-height: 1.5;";
    text.textContent = NOTE_TEXT;

    note.appendChild(iconWrap);
    note.appendChild(text);
    return note;
  }

  function injectStyle() {
    if (document.getElementById("section-notes-style")) return;
    var style = document.createElement("style");
    style.id = "section-notes-style";
    style.textContent =
      "@keyframes sectionNoteIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }";
    document.head.appendChild(style);
  }

  function matchesSection(h1) {
    var text = h1.textContent || "";
    for (var i = 0; i < SECTION_TITLES.length; i++) {
      if (text.indexOf(SECTION_TITLES[i]) !== -1) return true;
    }
    return false;
  }

  function processHeadings() {
    var headings = document.querySelectorAll("h1");
    for (var i = 0; i < headings.length; i++) {
      var h1 = headings[i];
      if (!matchesSection(h1)) continue;

      var container = h1.closest("div.space-y-6") || h1.closest("div");
      if (!container) continue;

      if (container.querySelector("." + NOTE_CLASS)) continue;

      var headerBlock = h1.closest("div.flex.items-center") || h1.parentElement;
      if (!headerBlock) continue;

      var wrapper = headerBlock.parentElement || headerBlock;
      var note = createNoteElement();
      if (wrapper.nextSibling) {
        wrapper.parentNode.insertBefore(note, wrapper.nextSibling);
      } else {
        wrapper.parentNode.appendChild(note);
      }
    }
  }

  function init() {
    injectStyle();
    processHeadings();

    var observer = new MutationObserver(function () {
      processHeadings();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
