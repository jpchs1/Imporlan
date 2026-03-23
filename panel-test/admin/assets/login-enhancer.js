/**
 * Login Enhancer - Imporlan Admin Panel
 * Adds password visibility toggle (eye icon) to the login form.
 * Works for all users.
 */
(function () {
  "use strict";

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

  function check() {
    injectEyeIcon();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", check);
  } else {
    check();
  }

  // Also observe for late-rendering React forms (re-injects after logout/re-render)
  new MutationObserver(function () {
    injectEyeIcon();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
