/**
 * Login Enhancer - Imporlan Admin Panel
 * Adds password visibility toggle (eye icon) and "forgot password" link to the login form.
 * Works for all users.
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  /* ── Eye icon toggle ── */
  function injectEyeIcon() {
    if (document.getElementById("pwd-eye-toggle")) return;
    var pwdInput = document.querySelector('input[type="password"]');
    if (!pwdInput) return;

    // Ensure parent is relatively positioned
    var wrapper = pwdInput.parentElement;
    if (!wrapper) return;
    wrapper.style.position = "relative";

    // Create toggle button
    var btn = document.createElement("button");
    btn.id = "pwd-eye-toggle";
    btn.type = "button";
    btn.tabIndex = -1;
    btn.setAttribute("aria-label", "Toggle password visibility");
    btn.style.cssText =
      "position:absolute;right:10px;top:50%;transform:translateY(-50%);" +
      "background:none;border:none;cursor:pointer;padding:4px;" +
      "color:#6b7280;display:flex;align-items:center;justify-content:center;";

    // Eye SVG icons
    var eyeOpen =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    var eyeClosed =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
      '<line x1="1" y1="1" x2="23" y2="23"/></svg>';

    btn.innerHTML = eyeClosed;
    var visible = false;

    btn.addEventListener("click", function () {
      visible = !visible;
      pwdInput.type = visible ? "text" : "password";
      btn.innerHTML = visible ? eyeOpen : eyeClosed;
    });

    // Add right padding to input so text doesn't overlap icon
    pwdInput.style.paddingRight = "40px";

    wrapper.appendChild(btn);
  }

  /* ── Forgot password link ── */
  function injectForgotPasswordLink() {
    if (document.getElementById("admin-forgot-link")) return;

    // Find the login button ("Ingresar")
    var loginBtn = null;
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || "").trim().toLowerCase();
      if (txt === "ingresar" || txt === "login" || txt === "iniciar sesion") {
        loginBtn = buttons[i];
        break;
      }
    }
    if (!loginBtn) return;

    // Verify we're on the login form (has email + password inputs)
    var emailInput = document.querySelector('input[type="email"]');
    var pwdInput = document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
    if (!emailInput && !pwdInput) return;

    // Insert the link after the login button
    var container = loginBtn.parentElement;
    if (!container) return;

    var link = document.createElement("button");
    link.id = "admin-forgot-link";
    link.type = "button";
    link.textContent = "\u00bfOlvidaste tu contrasena?";
    link.style.cssText =
      "display:block;margin:16px auto 0;background:none;border:none;color:#3b82f6;" +
      "font-size:13px;cursor:pointer;text-decoration:underline;padding:4px 8px;" +
      "font-family:inherit;transition:color .2s;";

    link.addEventListener("mouseenter", function () { link.style.color = "#2563eb"; });
    link.addEventListener("mouseleave", function () { link.style.color = "#3b82f6"; });

    link.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showForgotPasswordModal();
    });

    container.appendChild(link);
  }

  /* ── Forgot password modal ── */
  function showForgotPasswordModal() {
    if (document.getElementById("admin-forgot-overlay")) return;

    // Add animation styles
    if (!document.getElementById("admin-forgot-styles")) {
      var style = document.createElement("style");
      style.id = "admin-forgot-styles";
      style.textContent =
        "@keyframes adminFadeIn{from{opacity:0}to{opacity:1}}" +
        "@keyframes adminSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}";
      document.head.appendChild(style);
    }

    var overlay = document.createElement("div");
    overlay.id = "admin-forgot-overlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);" +
      "z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "animation:adminFadeIn .2s ease;backdrop-filter:blur(4px);";
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:32px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:adminSlideUp .3s ease">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
          '<h3 style="margin:0;font-size:18px;font-weight:700;color:#1e293b">Recuperar Contrasena</h3>' +
          '<button id="admin-forgot-close" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:24px;line-height:1;padding:4px">&times;</button>' +
        '</div>' +
        '<p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5">' +
          'Ingresa tu email de inicio de sesion (<strong>admin@imporlan.cl</strong>).<br>' +
          'La contrasena temporal sera enviada a <strong>contacto@imporlan.cl</strong>.' +
        '</p>' +
        '<label style="display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#475569">Email de inicio de sesion</label>' +
        '<input id="admin-forgot-email" type="email" value="admin@imporlan.cl" ' +
          'style="width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border .2s" />' +
        '<div id="admin-forgot-msg" style="margin-top:12px;font-size:13px;display:none"></div>' +
        '<button id="admin-forgot-send" style="margin-top:16px;width:100%;padding:12px;border-radius:10px;border:none;' +
          'background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s">' +
          'Enviar Contrasena Temporal</button>' +
      '</div>';
    document.body.appendChild(overlay);

    // Pre-fill with the email from the login form if available
    var emailInput = document.querySelector('input[type="email"]');
    var forgotEmailInput = document.getElementById("admin-forgot-email");
    if (emailInput && emailInput.value) {
      forgotEmailInput.value = emailInput.value;
    }

    // Close handlers
    document.getElementById("admin-forgot-close").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    // Send handler
    document.getElementById("admin-forgot-send").addEventListener("click", function () {
      var email = forgotEmailInput.value.trim();
      var msgEl = document.getElementById("admin-forgot-msg");
      var sendBtn = document.getElementById("admin-forgot-send");

      if (!email || email.indexOf("@") === -1) {
        msgEl.style.display = "block";
        msgEl.style.color = "#ef4444";
        msgEl.textContent = "Por favor ingresa un email valido.";
        return;
      }

      sendBtn.disabled = true;
      sendBtn.textContent = "Enviando...";
      sendBtn.style.opacity = "0.7";
      msgEl.style.display = "none";

      fetch(API_BASE + "/admin_forgot_password.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        msgEl.style.display = "block";
        if (data.success) {
          msgEl.style.color = "#10b981";
          msgEl.textContent = data.message || "Se ha enviado una contrasena temporal al correo de contacto.";
          sendBtn.textContent = "Enviado";
          sendBtn.style.background = "#10b981";
        } else {
          msgEl.style.color = "#ef4444";
          msgEl.textContent = data.error || "No se pudo procesar la solicitud.";
          sendBtn.disabled = false;
          sendBtn.textContent = "Enviar Contrasena Temporal";
          sendBtn.style.opacity = "1";
        }
      })
      .catch(function () {
        msgEl.style.display = "block";
        msgEl.style.color = "#ef4444";
        msgEl.textContent = "Error de conexion. Intenta nuevamente.";
        sendBtn.disabled = false;
        sendBtn.textContent = "Enviar Contrasena Temporal";
        sendBtn.style.opacity = "1";
      });
    });
  }

  function check() {
    injectEyeIcon();
    injectForgotPasswordLink();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", check);
  } else {
    check();
  }

  // Also observe for late-rendering React forms (re-injects after logout/re-render)
  new MutationObserver(function () {
    injectEyeIcon();
    injectForgotPasswordLink();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
