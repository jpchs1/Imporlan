/**
 * Profile Enhancer - Adds password change to user settings
 * Injects into React's Configuracion page
 */
(function () {
  "use strict";

  var injected = false;

  function isSettingsPage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var headings = main.querySelectorAll("h1, h2, h3");
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim().toLowerCase();
      if (t.indexOf("configuracion") !== -1 || t.indexOf("configuración") !== -1) return true;
    }
    return false;
  }

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      var raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
    } catch (e) {}
    return null;
  }

  function showToast(msg, type) {
    var toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.2);background:" + (type === "error" ? "#ef4444" : "#10b981") + ";animation:profSlideUp .3s ease";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.opacity = "0"; toast.style.transition = "opacity .3s"; setTimeout(function () { toast.remove(); }, 300); }, 3000);
  }

  function injectPasswordSection() {
    if (injected) return;
    var main = document.querySelector("main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (!h1) return;
    var pageText = (h1.textContent || "").toLowerCase();
    if (!pageText.includes("config") && !pageText.includes("ajuste") && !pageText.includes("perfil")) return;
    if (document.getElementById("prof-password-section")) { injected = true; return; }

    var lastCard = null;
    main.querySelectorAll("div").forEach(function (div) {
      var h2orH3 = div.querySelector("h2, h3, h4");
      if (h2orH3) {
        var t = (h2orH3.textContent || "").toLowerCase();
        if (t.includes("notificacion") || t.includes("informacion personal")) {
          lastCard = div;
        }
      }
    });

    var targetParent = null;
    if (lastCard) {
      var p = lastCard;
      while (p && p !== main) {
        if (p.parentElement === main || (p.parentElement && getComputedStyle(p.parentElement).display === "flex")) {
          targetParent = p.parentElement;
          break;
        }
        p = p.parentElement;
      }
    }

    var section = document.createElement("div");
    section.id = "prof-password-section";
    section.style.cssText = "border:1px solid #e2e8f0;border-radius:16px;padding:28px 32px;margin-top:24px;background:#fff;max-width:680px;animation:profSlideUp .3s ease";
    section.innerHTML =
      '<h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:10px">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      'Cambiar Contrasena</h3>' +
      '<p style="margin:0 0 20px;font-size:13px;color:#94a3b8">Actualiza tu contrasena de acceso al panel</p>' +
      '<div style="display:flex;flex-direction:column;gap:16px">' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Nueva Contrasena</label>' +
      '<div style="position:relative"><input id="prof-new-pw" type="password" placeholder="Minimo 6 caracteres" style="width:100%;padding:12px 44px 12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;transition:border-color .2s;outline:none" onfocus="this.style.borderColor=\'#0891b2\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      '<button type="button" class="prof-toggle-pw" data-target="prof-new-pw" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;color:#94a3b8;padding:4px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>' +
      '<div id="prof-pw-strength" style="height:4px;border-radius:2px;background:#e2e8f0;margin-top:8px;overflow:hidden"><div id="prof-pw-bar" style="height:100%;width:0;border-radius:2px;transition:all .3s"></div></div>' +
      '<p id="prof-pw-hint" style="margin:4px 0 0;font-size:11px;color:#94a3b8"></p></div>' +
      '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Confirmar Nueva Contrasena</label>' +
      '<div style="position:relative"><input id="prof-confirm-pw" type="password" placeholder="Repite la nueva contrasena" style="width:100%;padding:12px 44px 12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;transition:border-color .2s;outline:none" onfocus="this.style.borderColor=\'#0891b2\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      '<button type="button" class="prof-toggle-pw" data-target="prof-confirm-pw" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;color:#94a3b8;padding:4px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>' +
      '<p id="prof-pw-match" style="margin:4px 0 0;font-size:11px;color:#94a3b8"></p></div>' +
      '<button id="prof-save-pw" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(8,145,178,.3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
      'Guardar Nueva Contrasena</button></div>';

    if (targetParent && targetParent !== main) {
      targetParent.appendChild(section);
    } else {
      var firstChild = main.querySelector("div");
      if (firstChild && firstChild.parentElement === main) {
        main.insertBefore(section, null);
      } else {
        main.appendChild(section);
      }
    }

    injected = true;
    attachPasswordListeners(section);
  }

  function attachPasswordListeners(section) {
    section.querySelectorAll(".prof-toggle-pw").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = this.getAttribute("data-target");
        var input = document.getElementById(targetId);
        if (!input) return;
        if (input.type === "password") {
          input.type = "text";
          this.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
          input.type = "password";
          this.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      });
    });

    var newPwInput = document.getElementById("prof-new-pw");
    var confirmInput = document.getElementById("prof-confirm-pw");
    if (newPwInput) {
      newPwInput.addEventListener("input", function () {
        var val = this.value;
        var bar = document.getElementById("prof-pw-bar");
        var hint = document.getElementById("prof-pw-hint");
        if (!bar || !hint) return;
        var strength = 0;
        if (val.length >= 6) strength++;
        if (val.length >= 8) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;
        if (/[^a-zA-Z0-9]/.test(val)) strength++;
        var pct = Math.min(strength / 5 * 100, 100);
        var colors = ["#ef4444", "#f59e0b", "#f59e0b", "#10b981", "#10b981"];
        var labels = ["Muy debil", "Debil", "Aceptable", "Buena", "Excelente"];
        bar.style.width = pct + "%";
        bar.style.background = colors[Math.min(strength, 4)];
        hint.textContent = val.length > 0 ? labels[Math.min(strength, 4)] : "";
        hint.style.color = colors[Math.min(strength, 4)];
        checkMatch();
      });
    }
    if (confirmInput) {
      confirmInput.addEventListener("input", checkMatch);
    }

    function checkMatch() {
      var newVal = document.getElementById("prof-new-pw");
      var confVal = document.getElementById("prof-confirm-pw");
      var matchEl = document.getElementById("prof-pw-match");
      if (!newVal || !confVal || !matchEl) return;
      if (confVal.value.length === 0) { matchEl.textContent = ""; return; }
      if (newVal.value === confVal.value) {
        matchEl.textContent = "Las contrasenas coinciden";
        matchEl.style.color = "#10b981";
      } else {
        matchEl.textContent = "Las contrasenas no coinciden";
        matchEl.style.color = "#ef4444";
      }
    }

    var saveBtn = document.getElementById("prof-save-pw");
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        var newPw = document.getElementById("prof-new-pw");
        var confirmPw = document.getElementById("prof-confirm-pw");
        if (!newPw || !confirmPw) return;
        if (newPw.value.length < 6) { showToast("La nueva contrasena debe tener al menos 6 caracteres", "error"); newPw.focus(); return; }
        if (newPw.value !== confirmPw.value) { showToast("Las contrasenas no coinciden", "error"); confirmPw.focus(); return; }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Guardando...';
        try {
          var userData = getUserData();
          var email = userData ? userData.email : null;
          if (!email) { showToast("Sesion no encontrada. Vuelve a iniciar sesion.", "error"); saveBtn.disabled = false; saveBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar Nueva Contrasena'; return; }
          var resp = await fetch("/api/change_password.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, new_password: newPw.value })
          });
          var result = await resp.json();
          if (!resp.ok || result.error) { showToast(result.error || "Error al cambiar la contrasena", "error"); }
          else {
            showToast("Contrasena actualizada correctamente", "success");
            newPw.value = "";
            confirmPw.value = "";
            var bar = document.getElementById("prof-pw-bar");
            var hint = document.getElementById("prof-pw-hint");
            var matchEl = document.getElementById("prof-pw-match");
            if (bar) bar.style.width = "0";
            if (hint) hint.textContent = "";
            if (matchEl) matchEl.textContent = "";
          }
        } catch (e) {
          showToast("Error de conexion. Intenta nuevamente.", "error");
        }
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar Nueva Contrasena';
      });
    }
  }

  function addStyles() {
    if (document.getElementById("prof-styles")) return;
    var style = document.createElement("style");
    style.id = "prof-styles";
    style.textContent = "@keyframes profSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }

  var profCheckTimer = null;
  var lastPageWasSettings = false;

  function checkSettingsPage() {
    var isSett = isSettingsPage();
    if (isSett && !document.getElementById("prof-password-section")) {
      injected = false;
      injectPasswordSection();
    } else if (!isSett && lastPageWasSettings) {
      injected = false;
      var el = document.getElementById("prof-password-section");
      if (el) el.remove();
    }
    lastPageWasSettings = isSett;
  }

  function init() {
    addStyles();
    checkSettingsPage();
    var obs = new MutationObserver(function () {
      clearTimeout(profCheckTimer);
      profCheckTimer = setTimeout(checkSettingsPage, 300);
    });
    var root = document.getElementById("root") || document.body;
    obs.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 500); });
  else setTimeout(init, 500);
})();
