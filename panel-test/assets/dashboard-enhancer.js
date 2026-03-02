/**
 * Dashboard Enhancer - Imporlan Panel Test
 * Handles: user name, last updated date, admin button removal,
 * cotizaciones redirect, cursor fix, importaciones note,
 * phone masking, payment card name, document upload
 */
(function () {
  "use strict";

  var API_BASE = window.location.pathname.includes("/panel-test")
    ? "/test/api"
    : window.location.pathname.includes("/test/")
      ? "/test/api"
      : "/api";

  var enhancedFlags = {};
  var checkTimer = null;

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

  function getUserName() {
    var u = getUserData();
    return u ? u.name || u.user_name || u.displayName || "" : "";
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /* ── 1. Replace dashboard greeting with real user name ── */
  function fixUserName() {
    var main = document.querySelector("main");
    if (!main) return;
    var realName = getUserName();
    if (!realName) return;
    var els = main.querySelectorAll("h1, h2, h3, p, span");
    for (var i = 0; i < els.length; i++) {
      var txt = els[i].textContent || "";
      if (txt.indexOf("Bienvenido") !== -1) {
        var parts = txt.split(",");
        if (parts.length >= 2) {
          els[i].textContent = parts[0].trim() + ", " + realName;
        } else {
          els[i].textContent = "Bienvenido de vuelta, " + realName;
        }
      }
    }
  }

  /* ── 2. Dynamic last updated date from API ── */
  var lastUpdateFetched = false;
  async function fixLastUpdatedDate() {
    if (lastUpdateFetched) return;
    var main = document.querySelector("main");
    if (!main) return;
    var allSpans = main.querySelectorAll("span, p");
    var dateEl = null;
    for (var i = 0; i < allSpans.length; i++) {
      var t = (allSpans[i].textContent || "").trim().toLowerCase();
      if (t.indexOf("ltima actualizaci") !== -1 || t.indexOf("ultima actualizacion") !== -1 || t.indexOf("actualizado") !== -1) {
        dateEl = allSpans[i];
        break;
      }
    }
    if (!dateEl) {
      var h3s = main.querySelectorAll("h3, h4, p");
      for (var j = 0; j < h3s.length; j++) {
        var txt = (h3s[j].textContent || "").trim();
        if (/\d{1,2}\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}/i.test(txt)) {
          dateEl = h3s[j];
          break;
        }
      }
    }
    if (!dateEl) return;
    var email = getUserEmail();
    if (!email) return;
    lastUpdateFetched = true;
    try {
      var resp = await fetch(API_BASE + "/orders_api.php?action=user_list&user_email=" + encodeURIComponent(email));
      var data = await resp.json();
      if (data.success && data.orders && data.orders.length > 0) {
        var latestDate = null;
        data.orders.forEach(function (o) {
          var d = o.updated_at || o.created_at;
          if (d) {
            var parsed = new Date(d);
            if (!latestDate || parsed > latestDate) latestDate = parsed;
          }
        });
        if (latestDate) {
          var months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
          var formatted = latestDate.getDate() + " " + months[latestDate.getMonth()] + " " + latestDate.getFullYear();
          var parentEl = dateEl.closest("[class*='rounded']") || dateEl.parentElement;
          if (parentEl) {
            var allText = parentEl.querySelectorAll("span, p, h3, h4");
            for (var k = 0; k < allText.length; k++) {
              var content = allText[k].textContent || "";
              if (/\d{1,2}\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}/i.test(content)) {
                allText[k].textContent = content.replace(
                  /\d{1,2}\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+\d{4}/i,
                  formatted
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Dashboard: Error fetching last update:", e);
    }
  }

  /* ── 3. Remove Admin button ── */
  function removeAdminButton() {
    var main = document.querySelector("main");
    if (!main) return;
    var buttons = main.querySelectorAll("button, a");
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || "").trim();
      if (txt === "Admin" || txt === "Ir al Admin" || txt === "Panel Admin") {
        buttons[i].style.display = "none";
        var parent = buttons[i].parentElement;
        if (parent && parent.children.length === 1) {
          parent.style.display = "none";
        }
      }
    }
    var aside = document.querySelector("aside");
    if (aside) {
      var sideButtons = aside.querySelectorAll("button, a");
      for (var j = 0; j < sideButtons.length; j++) {
        var stxt = (sideButtons[j].textContent || "").trim();
        if (stxt === "Admin" || stxt === "Panel Admin" || stxt === "Administrador") {
          sideButtons[j].style.display = "none";
          var sparent = sideButtons[j].parentElement;
          if (sparent && sparent.tagName === "LI") sparent.style.display = "none";
        }
      }
    }
  }

  /* ── 4. Cotizaciones button redirect to Mis Expedientes ── */
  function fixCotizacionesButton() {
    var main = document.querySelector("main");
    if (!main) return;
    var allEls = main.querySelectorAll("button, a, div[class*='cursor-pointer']");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim().toLowerCase();
      if (txt.indexOf("cotizaciones listas") !== -1 || txt.indexOf("cotizaciones listas para tu") !== -1) {
        var el = allEls[i];
        if (!el.getAttribute("data-cotiz-fixed")) {
          el.setAttribute("data-cotiz-fixed", "1");
          el.style.cursor = "pointer";
          el.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.hash = "#myproducts";
          });
        }
      }
    }
    var steps = main.querySelectorAll("[class*='flex'][class*='items-center']");
    for (var j = 0; j < steps.length; j++) {
      var stepTxt = (steps[j].textContent || "").trim().toLowerCase();
      if (stepTxt.indexOf("cotizaciones listas para tu revisi") !== -1) {
        var clickable = steps[j].closest("[class*='cursor']") || steps[j];
        if (!clickable.getAttribute("data-cotiz-fixed")) {
          clickable.setAttribute("data-cotiz-fixed", "1");
          clickable.style.cursor = "pointer";
          clickable.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.hash = "#myproducts";
          });
        }
      }
    }
  }

  /* ── 5. Fix cursor jittering ── */
  function fixCursorJitter() {
    if (document.getElementById("de-cursor-fix")) return;
    var style = document.createElement("style");
    style.id = "de-cursor-fix";
    style.textContent =
      "*, *::before, *::after { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }" +
      "button, a, [role='button'] { -webkit-tap-highlight-color: transparent; }" +
      "[class*='hover:']:not(:hover) { transform: none !important; }" +
      ".animate-pulse { animation-duration: 2s !important; }" +
      "main [class*='transition'] { transition-duration: 0.15s !important; }" +
      "main [class*='hover:shadow'] { will-change: auto !important; }" +
      "main [class*='hover:scale'] { will-change: auto !important; transition: transform 0.15s ease !important; }" +
      "main div[class*='hover:'] { backface-visibility: hidden; -webkit-backface-visibility: hidden; }" +
      "body { -webkit-overflow-scrolling: touch; }";
    document.head.appendChild(style);
  }

  /* ── 8. Importaciones informative note ── */
  function addImportacionesNote() {
    var main = document.querySelector("main");
    if (!main) return;
    if (document.getElementById("de-import-note")) return;
    var headings = main.querySelectorAll("h1, h2, h3");
    var importSection = null;
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim().toLowerCase();
      if (t.indexOf("importaciones") !== -1 || t.indexOf("mis importaciones") !== -1) {
        importSection = headings[i].closest("[class*='space-y']") || headings[i].closest("[class*='animate']") || headings[i].parentElement;
        break;
      }
    }
    if (!importSection) return;
    var hasOperations = false;
    var cards = importSection.querySelectorAll("[class*='rounded-xl'], [class*='rounded-lg']");
    for (var j = 0; j < cards.length; j++) {
      var cardText = (cards[j].textContent || "").toLowerCase();
      if (cardText.indexOf("imp-") !== -1 || cardText.indexOf("en transito") !== -1 || cardText.indexOf("aduana") !== -1) {
        hasOperations = true;
        break;
      }
    }
    var note = document.createElement("div");
    note.id = "de-import-note";
    note.style.cssText = "background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:14px;padding:20px 24px;margin-top:16px;display:flex;align-items:flex-start;gap:14px";
    note.innerHTML =
      '<div style="flex-shrink:0;width:40px;height:40px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:10px;display:flex;align-items:center;justify-content:center">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>' +
      '<div><p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e40af">Informacion</p>' +
      '<p style="margin:0;font-size:13px;color:#3b82f6;line-height:1.5">' +
      (hasOperations ? 'Aqui puedes ver el estado en tiempo real de tus importaciones activas.' : 'Asi se visualizara tu panel cuando tengas tu primera importacion con Imporlan.') +
      '</p></div>';
    var lastChild = importSection.lastElementChild;
    if (lastChild) {
      lastChild.parentNode.insertBefore(note, lastChild.nextSibling);
    } else {
      importSection.appendChild(note);
    }
  }

  /* ── 10. Phone masking for non-active plan users ── */
  async function fixPhoneMasking() {
    if (enhancedFlags.phoneDone) return;
    var main = document.querySelector("main");
    if (!main) return;
    var allP = main.querySelectorAll("p, span");
    var phoneEls = [];
    for (var i = 0; i < allP.length; i++) {
      var txt = (allP[i].textContent || "").trim();
      if (/\+56\s*9\s*\*{4}\s*\d{4}/.test(txt) || /\+56\s*9\s*\d{4}\s*\d{4}/.test(txt)) {
        phoneEls.push(allP[i]);
      }
    }
    if (phoneEls.length === 0) return;
    enhancedFlags.phoneDone = true;
    var email = getUserEmail();
    var hasActivePlan = false;
    if (email) {
      try {
        var resp = await fetch(API_BASE + "/purchases.php?action=get&user_email=" + encodeURIComponent(email));
        var data = await resp.json();
        if (data.success && data.plans) {
          hasActivePlan = data.plans.some(function (p) { return p.status === "active"; });
        }
      } catch (e) {}
    }
    for (var j = 0; j < phoneEls.length; j++) {
      if (hasActivePlan) {
        phoneEls[j].textContent = "+56 9 4021 1459";
      } else {
        phoneEls[j].textContent = "+56 9 **** 1459";
      }
    }
  }

  /* ── 11. Payment card - real user name + last 4 digits ── */
  function fixPaymentCard() {
    var main = document.querySelector("main");
    if (!main) return;
    var realName = getUserName();
    if (!realName) return;
    var allEls = main.querySelectorAll("p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (txt === "JUAN PEREZ" || txt === "Juan Perez") {
        var isCardContext = false;
        var parent = allEls[i].closest("[class*='rounded']");
        if (parent) {
          var pTxt = (parent.textContent || "").toLowerCase();
          if (pTxt.indexOf("tarjeta") !== -1 || pTxt.indexOf("pago") !== -1 || pTxt.indexOf("****") !== -1 || pTxt.indexOf("visa") !== -1 || pTxt.indexOf("mastercard") !== -1) {
            isCardContext = true;
          }
        }
        if (isCardContext || allEls[i].closest("[class*='bg-gradient']")) {
          allEls[i].textContent = realName.toUpperCase();
        }
      }
    }
  }

  /* ── 12. Card editing capability ── */
  function addCardEditButton() {
    var main = document.querySelector("main");
    if (!main) return;
    if (document.getElementById("de-card-edit-btn")) return;
    var headings = main.querySelectorAll("h1, h2, h3");
    var isPaymentsPage = false;
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim().toLowerCase();
      if (t.indexOf("pago") !== -1 || t.indexOf("metodos de pago") !== -1) {
        isPaymentsPage = true;
        break;
      }
    }
    if (!isPaymentsPage) return;
    var cardSections = main.querySelectorAll("[class*='rounded']");
    for (var j = 0; j < cardSections.length; j++) {
      var secTxt = (cardSections[j].textContent || "").toLowerCase();
      if ((secTxt.indexOf("****") !== -1 || secTxt.indexOf("tarjeta") !== -1) && secTxt.indexOf("guardar") === -1) {
        if (cardSections[j].querySelector("#de-card-edit-btn")) continue;
        var editBtn = document.createElement("button");
        editBtn.id = "de-card-edit-btn";
        editBtn.style.cssText = "margin-top:12px;padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px";
        editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Actualizar Tarjeta';
        editBtn.addEventListener("click", function () { showCardEditModal(); });
        editBtn.addEventListener("mouseover", function () { this.style.borderColor = "#0891b2"; this.style.color = "#0891b2"; });
        editBtn.addEventListener("mouseout", function () { this.style.borderColor = "#e2e8f0"; this.style.color = "#475569"; });
        var cardContent = cardSections[j].querySelector("[class*='p-']") || cardSections[j];
        cardContent.appendChild(editBtn);
        break;
      }
    }
  }

  function showCardEditModal() {
    if (document.getElementById("de-card-modal")) return;
    var overlay = document.createElement("div");
    overlay.id = "de-card-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;animation:deFadeIn .2s;backdrop-filter:blur(4px)";
    var userName = getUserName();
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;max-width:440px;width:90%;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:deSlideUp .3s ease">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700;color:#1e293b">Actualizar Tarjeta</h3>' +
      '<button id="de-card-close" style="border:none;background:#f1f5f9;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;font-size:18px">&times;</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Nombre en la tarjeta</label>' +
      '<input id="de-card-name" type="text" value="' + escapeHtml(userName) + '" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none" /></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Numero de tarjeta</label>' +
      '<input id="de-card-number" type="text" placeholder="**** **** **** ****" maxlength="19" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;letter-spacing:2px" /></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Vencimiento</label>' +
      '<input id="de-card-expiry" type="text" placeholder="MM/AA" maxlength="5" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none" /></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">CVV</label>' +
      '<input id="de-card-cvv" type="password" placeholder="***" maxlength="4" style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none" /></div></div>' +
      '<p style="margin:0;font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Tu informacion esta protegida. No almacenamos el CVV.</p>' +
      '<button id="de-card-save" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:4px">Guardar Tarjeta</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById("de-card-close").addEventListener("click", function () { overlay.remove(); });
    var numInput = document.getElementById("de-card-number");
    numInput.addEventListener("input", function () {
      var v = this.value.replace(/\D/g, "").substring(0, 16);
      var formatted = v.replace(/(\d{4})/g, "$1 ").trim();
      this.value = formatted;
    });
    var expInput = document.getElementById("de-card-expiry");
    expInput.addEventListener("input", function () {
      var v = this.value.replace(/\D/g, "").substring(0, 4);
      if (v.length >= 3) v = v.substring(0, 2) + "/" + v.substring(2);
      this.value = v;
    });
    document.getElementById("de-card-save").addEventListener("click", function () {
      var name = document.getElementById("de-card-name").value.trim();
      var number = document.getElementById("de-card-number").value.replace(/\s/g, "");
      var expiry = document.getElementById("de-card-expiry").value.trim();
      if (!name || number.length < 13 || !expiry) {
        alert("Por favor completa todos los campos correctamente.");
        return;
      }
      var last4 = number.slice(-4);
      try {
        var cardData = { holder: name, lastFour: last4, expiry: expiry, updatedAt: new Date().toISOString() };
        localStorage.setItem("imporlan_card_data", JSON.stringify(cardData));
      } catch (e) {}
      updateCardDisplay(name, last4, expiry);
      overlay.remove();
      showToast("Tarjeta actualizada correctamente", "success");
    });
  }

  function updateCardDisplay(name, last4, expiry) {
    var main = document.querySelector("main");
    if (!main) return;
    var allEls = main.querySelectorAll("p, span, div");
    for (var i = 0; i < allEls.length; i++) {
      var txt = (allEls[i].textContent || "").trim();
      if (/\*{4}\s*\d{4}/.test(txt) || /\d{4}\s*$/.test(txt)) {
        var parent = allEls[i].closest("[class*='rounded']");
        if (parent) {
          var pTxt = (parent.textContent || "").toLowerCase();
          if (pTxt.indexOf("tarjeta") !== -1 || pTxt.indexOf("visa") !== -1 || pTxt.indexOf("mastercard") !== -1) {
            allEls[i].textContent = "**** **** **** " + last4;
          }
        }
      }
    }
  }

  function loadSavedCard() {
    try {
      var raw = localStorage.getItem("imporlan_card_data");
      if (!raw) return;
      var card = JSON.parse(raw);
      if (card.holder && card.lastFour) {
        setTimeout(function () {
          updateCardDisplay(card.holder, card.lastFour, card.expiry);
        }, 1000);
      }
    } catch (e) {}
  }

  /* ── 9. Document upload functionality ── */
  function enableDocumentUpload() {
    var main = document.querySelector("main");
    if (!main) return;
    if (document.getElementById("de-upload-section")) return;
    var headings = main.querySelectorAll("h1, h2, h3");
    var isDocPage = false;
    var docContainer = null;
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim().toLowerCase();
      if (t.indexOf("documento") !== -1 && t.indexOf("subir") === -1) {
        isDocPage = true;
        docContainer = headings[i].closest("[class*='space-y']") || headings[i].closest("[class*='animate']") || headings[i].parentElement;
        break;
      }
    }
    if (!isDocPage || !docContainer) return;

    var existingBtns = main.querySelectorAll("button");
    for (var j = 0; j < existingBtns.length; j++) {
      var btnTxt = (existingBtns[j].textContent || "").trim().toLowerCase();
      if (btnTxt.indexOf("subir documento") !== -1 || btnTxt.indexOf("subir archivos") !== -1) {
        if (!existingBtns[j].getAttribute("data-upload-enabled")) {
          existingBtns[j].setAttribute("data-upload-enabled", "1");
          existingBtns[j].disabled = false;
          existingBtns[j].style.opacity = "1";
          existingBtns[j].style.cursor = "pointer";
          existingBtns[j].addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            triggerDocUpload();
          });
        }
        return;
      }
    }

    var section = document.createElement("div");
    section.id = "de-upload-section";
    section.style.cssText = "margin-top:20px";
    section.innerHTML =
      '<button id="de-upload-btn" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(8,145,178,.25)">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      'Subir Documentos</button>' +
      '<div id="de-uploaded-list" style="margin-top:16px"></div>';
    docContainer.appendChild(section);
    document.getElementById("de-upload-btn").addEventListener("click", triggerDocUpload);
    loadUploadedDocs();
  }

  function triggerDocUpload() {
    var input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.jpg,.jpeg,.png,.docx,.doc";
    input.addEventListener("change", function () {
      if (!this.files || this.files.length === 0) return;
      for (var i = 0; i < this.files.length; i++) {
        handleFileUpload(this.files[i]);
      }
    });
    input.click();
  }

  function handleFileUpload(file) {
    var maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("El archivo " + file.name + " excede el limite de 10MB", "error");
      return;
    }
    var allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"];
    if (allowed.indexOf(file.type) === -1 && !file.name.match(/\.(pdf|jpg|jpeg|png|docx|doc)$/i)) {
      showToast("Formato no permitido: " + file.name, "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var doc = {
        name: file.name,
        size: file.size,
        type: file.type,
        date: new Date().toISOString(),
        data: reader.result
      };
      saveUploadedDoc(doc);
      renderUploadedDocs();
      showToast("Documento subido: " + file.name, "success");
    };
    reader.readAsDataURL(file);
  }

  function saveUploadedDoc(doc) {
    var email = getUserEmail();
    var key = "imporlan_docs_" + email;
    try {
      var existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push({ name: doc.name, size: doc.size, type: doc.type, date: doc.date });
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (e) {}
  }

  function loadUploadedDocs() {
    setTimeout(renderUploadedDocs, 500);
  }

  function renderUploadedDocs() {
    var container = document.getElementById("de-uploaded-list");
    if (!container) return;
    var email = getUserEmail();
    var key = "imporlan_docs_" + email;
    var docs = [];
    try { docs = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    if (docs.length === 0) { container.innerHTML = ""; return; }
    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    docs.forEach(function (doc, idx) {
      var sizeKb = Math.round(doc.size / 1024);
      var dateStr = new Date(doc.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      var icon = doc.type === "application/pdf" ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' :
        doc.type.startsWith("image/") ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' :
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">' +
        icon +
        '<div style="flex:1;min-width:0"><p style="margin:0;font-size:13px;font-weight:500;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(doc.name) + '</p>' +
        '<p style="margin:2px 0 0;font-size:11px;color:#94a3b8">' + sizeKb + ' KB - ' + dateStr + '</p></div>' +
        '<button class="de-doc-remove" data-idx="' + idx + '" style="border:none;background:#fef2f2;border-radius:6px;padding:6px;cursor:pointer;color:#ef4444;display:flex;align-items:center" title="Eliminar">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll(".de-doc-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(this.getAttribute("data-idx"));
        removeUploadedDoc(idx);
      });
    });
  }

  function removeUploadedDoc(idx) {
    var email = getUserEmail();
    var key = "imporlan_docs_" + email;
    try {
      var docs = JSON.parse(localStorage.getItem(key) || "[]");
      docs.splice(idx, 1);
      localStorage.setItem(key, JSON.stringify(docs));
      renderUploadedDocs();
      showToast("Documento eliminado", "success");
    } catch (e) {}
  }

  /* ── Login page: password toggle eye icon ── */
  function addPasswordToggle() {
    var inputs = document.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (inp.getAttribute('data-eye-added')) continue;
      var parent = inp.parentElement;
      if (!parent) continue;
      if (parent.style.position !== 'absolute' && parent.style.position !== 'relative' && parent.style.position !== 'fixed') {
        parent.style.position = 'relative';
      }
      inp.setAttribute('data-eye-added', '1');
      inp.style.paddingRight = '44px';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:#94a3b8;display:flex;align-items:center;z-index:2';
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      btn.setAttribute('data-target-input', 'eye-' + i);
      inp.setAttribute('data-eye-id', 'eye-' + i);
      (function(toggleBtn, targetInput) {
        toggleBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (targetInput.type === 'password') {
            targetInput.type = 'text';
            toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
          } else {
            targetInput.type = 'password';
            toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
          }
          targetInput.focus();
        });
      })(btn, inp);
      parent.appendChild(btn);
    }
  }

  /* ── Login page: forgot password functionality ── */
  function enableForgotPassword() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || '').trim().toLowerCase();
      if (txt.indexOf('olvidaste') !== -1 || txt.indexOf('olvidaste tu contrase') !== -1) {
        var btn = buttons[i];
        if (btn.getAttribute('data-forgot-fixed')) continue;
        btn.setAttribute('data-forgot-fixed', '1');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          showForgotPasswordModal();
        });
      }
    }
  }

  function showForgotPasswordModal() {
    if (document.getElementById('de-forgot-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'de-forgot-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;animation:deFadeIn .2s ease';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:32px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:deSlideUp .3s ease">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
      '<h3 style="margin:0;font-size:18px;font-weight:700;color:#1e293b">Recuperar Contrasena</h3>' +
      '<button id="de-forgot-close" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:20px">&times;</button></div>' +
      '<p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5">Ingresa tu email y te enviaremos una contrasena temporal para que puedas acceder a tu cuenta.</p>' +
      '<label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#475569">Email</label>' +
      '<input id="de-forgot-email" type="email" placeholder="tu@email.com" style="width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border .2s" />' +
      '<div id="de-forgot-msg" style="margin-top:12px;font-size:13px;display:none"></div>' +
      '<button id="de-forgot-send" style="margin-top:16px;width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s">Enviar Contrasena Temporal</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var emailInput = document.getElementById('de-forgot-email');
    var loginEmailInput = document.querySelector('input[type="email"]');
    if (loginEmailInput && loginEmailInput.value) {
      emailInput.value = loginEmailInput.value;
    }

    document.getElementById('de-forgot-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    document.getElementById('de-forgot-send').addEventListener('click', function() {
      var email = emailInput.value.trim();
      var msgEl = document.getElementById('de-forgot-msg');
      var sendBtn = document.getElementById('de-forgot-send');
      if (!email || email.indexOf('@') === -1) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#ef4444';
        msgEl.textContent = 'Por favor ingresa un email valido.';
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
      sendBtn.style.opacity = '0.7';
      msgEl.style.display = 'none';

      fetch(API_BASE + '/forgot_password.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        msgEl.style.display = 'block';
        if (data.success) {
          msgEl.style.color = '#10b981';
          msgEl.textContent = 'Se ha enviado una contrasena temporal a tu email. Revisalo e inicia sesion.';
          sendBtn.textContent = 'Enviado';
          sendBtn.style.background = '#10b981';
        } else {
          msgEl.style.color = '#ef4444';
          msgEl.textContent = data.error || 'No se pudo procesar la solicitud.';
          sendBtn.disabled = false;
          sendBtn.textContent = 'Enviar Contrasena Temporal';
          sendBtn.style.opacity = '1';
        }
      })
      .catch(function() {
        msgEl.style.display = 'block';
        msgEl.style.color = '#ef4444';
        msgEl.textContent = 'Error de conexion. Intenta nuevamente.';
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar Contrasena Temporal';
        sendBtn.style.opacity = '1';
      });
    });
  }

  /* ── Toast helper ── */
  function showToast(msg, type) {
    var toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981") + ";animation:deSlideUp .3s ease";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; setTimeout(function () { toast.remove(); }, 300); }, 2500);
  }

  /* ── Styles ── */
  function addStyles() {
    if (document.getElementById("de-styles")) return;
    var style = document.createElement("style");
    style.id = "de-styles";
    style.textContent =
      "@keyframes deFadeIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes deSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}";
    document.head.appendChild(style);
  }

  /* ── Main check loop ── */
  function runEnhancements() {
    addPasswordToggle();
    enableForgotPassword();
    fixCursorJitter();
    fixUserName();
    removeAdminButton();
    fixCotizacionesButton();
    fixLastUpdatedDate();
    addImportacionesNote();
    fixPhoneMasking();
    fixPaymentCard();
    addCardEditButton();
    enableDocumentUpload();
    loadSavedCard();
  }

  function init() {
    addStyles();
    runEnhancements();
    var obs = new MutationObserver(function () {
      clearTimeout(checkTimer);
      checkTimer = setTimeout(runEnhancements, 300);
    });
    var root = document.getElementById("root") || document.body;
    obs.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
