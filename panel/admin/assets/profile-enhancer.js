/**
 * Profile Enhancer - Imporlan Admin Panel
 * Makes the sidebar user area clickable to open a profile editing modal.
 * Allows admin users to update their photo, name, and password.
 */
(function () {
  "use strict";

  var API_BASE = (window.location.pathname.includes("/test/") || window.location.pathname.includes("/panel-test"))
    ? "/test/api"
    : "/api";

  function getAdminToken() {
    return localStorage.getItem("token") || localStorage.getItem("imporlan_admin_token") || "";
  }

  function getAdminUser() {
    try {
      var raw = localStorage.getItem("imporlan_admin_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function getTokenPayload() {
    var token = getAdminToken();
    if (!token) return null;
    try {
      var parts = token.split(".");
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) { return null; }
  }

  function esc(t) {
    if (!t) return "";
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  /* ── Profile data cache ── */
  var profileCache = null;

  function loadProfile(callback) {
    fetch(API_BASE + "/admin_profile.php", {
      method: "GET",
      headers: { "Authorization": "Bearer " + getAdminToken() }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success && data.profile) {
        profileCache = data.profile;
      }
      if (callback) callback(profileCache);
    })
    .catch(function () {
      if (callback) callback(null);
    });
  }

  /* ── Update sidebar avatar with profile photo ── */
  function updateSidebarAvatar() {
    var userSection = findUserSection();
    if (!userSection) return;

    var avatarDiv = userSection.querySelector("div.rounded-full, div[class*='rounded-full']");
    if (!avatarDiv) return;

    if (profileCache && profileCache.avatar_url) {
      // Replace initial letter with actual image
      var existingImg = avatarDiv.querySelector("img.profile-avatar-img");
      if (!existingImg) {
        avatarDiv.innerHTML = "";
        var img = document.createElement("img");
        img.className = "profile-avatar-img";
        img.src = profileCache.avatar_url;
        img.alt = "Avatar";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
        avatarDiv.appendChild(img);
      } else {
        existingImg.src = profileCache.avatar_url;
      }
    }

    // Update name if customized
    if (profileCache && profileCache.name) {
      var nameEl = userSection.querySelector("p.text-sm, p[class*='text-sm']");
      if (nameEl && nameEl.classList.contains("truncate")) {
        nameEl.textContent = profileCache.name;
      }
    }
  }

  /* ── Find the sidebar user section ── */
  function findUserSection() {
    var aside = document.querySelector("aside");
    if (!aside) return null;
    var borderT = aside.querySelector("div.border-t, div[class*='border-t']");
    if (!borderT) return null;
    return borderT;
  }

  /* ── Make user section clickable ── */
  function injectProfileClickable() {
    var userSection = findUserSection();
    if (!userSection) return;
    if (userSection.getAttribute("data-profile-enhanced")) return;
    userSection.setAttribute("data-profile-enhanced", "true");

    // Find the avatar + name container (first child div with flex items-center)
    var userInfo = userSection.querySelector("div.flex.items-center");
    if (!userInfo) return;

    // Make it clickable
    userInfo.style.cursor = "pointer";
    userInfo.style.borderRadius = "10px";
    userInfo.style.padding = "8px 12px";
    userInfo.style.margin = "0 0 12px 0";
    userInfo.style.transition = "background .2s";

    userInfo.addEventListener("mouseenter", function () {
      userInfo.style.background = "#f0f9ff";
    });
    userInfo.addEventListener("mouseleave", function () {
      userInfo.style.background = "transparent";
    });

    userInfo.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openProfileModal();
    });

    // Add a small edit icon hint
    var editHint = document.createElement("div");
    editHint.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editHint.style.cssText = "flex-shrink:0;opacity:0.5;transition:opacity .2s;";
    userInfo.appendChild(editHint);

    userInfo.addEventListener("mouseenter", function () { editHint.style.opacity = "1"; });
    userInfo.addEventListener("mouseleave", function () { editHint.style.opacity = "0.5"; });
  }

  /* ── Profile Modal ── */
  function openProfileModal() {
    if (document.getElementById("profile-modal-overlay")) return;

    var user = getAdminUser();
    var payload = getTokenPayload();
    var email = (user && user.email) || (payload && payload.email) || "";
    var name = (profileCache && profileCache.name) || (user && user.name) || (payload && payload.name) || "";
    var avatarUrl = (profileCache && profileCache.avatar_url) || null;
    var role = (user && user.role) || (payload && payload.role) || "admin";
    var roleLabel = role === "admin" ? "Administrador" : role === "support" ? "Soporte" : role === "agent" ? "Agente" : "Usuario";

    // Inject styles
    if (!document.getElementById("profile-modal-styles")) {
      var style = document.createElement("style");
      style.id = "profile-modal-styles";
      style.textContent =
        "@keyframes profileFadeIn{from{opacity:0}to{opacity:1}}" +
        "@keyframes profileSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}" +
        ".profile-tab{padding:10px 20px;border:none;background:none;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s}" +
        ".profile-tab:hover{color:#3b82f6}" +
        ".profile-tab.active{color:#3b82f6;border-bottom-color:#3b82f6}" +
        ".profile-input{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;transition:border .2s}" +
        ".profile-input:focus{border-color:#3b82f6}" +
        ".profile-btn-primary{padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s}" +
        ".profile-btn-primary:hover{opacity:0.9}" +
        ".profile-btn-primary:disabled{opacity:0.5;cursor:not-allowed}" +
        ".profile-btn-secondary{padding:10px 20px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s}" +
        ".profile-btn-secondary:hover{background:#f8fafc}" +
        ".profile-msg{margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;display:none}" +
        ".profile-msg.success{display:block;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0}" +
        ".profile-msg.error{display:block;background:#fef2f2;color:#dc2626;border:1px solid #fecaca}";
      document.head.appendChild(style);
    }

    var avatarHtml = avatarUrl
      ? '<img src="' + esc(avatarUrl) + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : '<span style="color:#fff;font-weight:700;font-size:32px">' + esc((name || email || "A").charAt(0).toUpperCase()) + '</span>';

    var overlay = document.createElement("div");
    overlay.id = "profile-modal-overlay";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);" +
      "z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "animation:profileFadeIn .2s ease;backdrop-filter:blur(4px);";

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;max-height:90vh;overflow-y:auto;animation:profileSlideUp .3s ease">' +
        // Header
        '<div style="padding:24px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;text-align:center;position:relative">' +
          '<button id="profile-close" style="position:absolute;top:12px;right:16px;background:none;border:none;color:rgba(255,255,255,.7);font-size:24px;cursor:pointer;padding:4px 8px;transition:color .2s">&times;</button>' +
          '<div id="profile-avatar-container" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;border:3px solid rgba(255,255,255,.3);overflow:hidden;cursor:pointer;position:relative">' +
            avatarHtml +
            '<div id="profile-avatar-hover" style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;border-radius:50%">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '</div>' +
          '</div>' +
          '<h3 id="profile-display-name" style="margin:0;font-size:18px;font-weight:700">' + esc(name) + '</h3>' +
          '<p style="margin:4px 0 0;font-size:13px;opacity:.7">' + esc(email) + '</p>' +
          '<span style="display:inline-block;margin-top:8px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(255,255,255,.15);color:rgba(255,255,255,.9)">' + esc(roleLabel) + '</span>' +
        '</div>' +
        // Tabs
        '<div style="display:flex;border-bottom:1px solid #e2e8f0">' +
          '<button class="profile-tab active" data-tab="info">Datos Personales</button>' +
          '<button class="profile-tab" data-tab="password">Cambiar Contrasena</button>' +
        '</div>' +
        // Tab content
        '<div id="profile-tab-content" style="padding:24px">' +
          // Info tab (default)
          '<div id="profile-tab-info">' +
            '<div style="margin-bottom:16px">' +
              '<label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nombre</label>' +
              '<input id="profile-name" class="profile-input" type="text" value="' + esc(name) + '" placeholder="Tu nombre completo">' +
            '</div>' +
            '<div style="margin-bottom:16px">' +
              '<label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Email</label>' +
              '<input class="profile-input" type="email" value="' + esc(email) + '" disabled style="background:#f8fafc;color:#94a3b8">' +
              '<p style="margin:4px 0 0;font-size:11px;color:#94a3b8">El email no se puede cambiar</p>' +
            '</div>' +
            '<div id="profile-info-msg" class="profile-msg"></div>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
              '<button id="profile-save-info" class="profile-btn-primary">Guardar Cambios</button>' +
            '</div>' +
          '</div>' +
          // Password tab (hidden by default)
          '<div id="profile-tab-password" style="display:none">' +
            '<div style="margin-bottom:16px">' +
              '<label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Contrasena Actual</label>' +
              '<div style="position:relative">' +
                '<input id="profile-current-pass" class="profile-input" type="password" placeholder="Ingresa tu contrasena actual" style="padding-right:40px">' +
                '<button type="button" class="profile-toggle-pass" data-target="profile-current-pass" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div style="margin-bottom:16px">' +
              '<label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Nueva Contrasena</label>' +
              '<div style="position:relative">' +
                '<input id="profile-new-pass" class="profile-input" type="password" placeholder="Minimo 6 caracteres" style="padding-right:40px">' +
                '<button type="button" class="profile-toggle-pass" data-target="profile-new-pass" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div style="margin-bottom:16px">' +
              '<label style="display:block;font-size:12px;color:#64748b;margin-bottom:6px;font-weight:600;text-transform:uppercase">Confirmar Nueva Contrasena</label>' +
              '<div style="position:relative">' +
                '<input id="profile-confirm-pass" class="profile-input" type="password" placeholder="Repite la nueva contrasena" style="padding-right:40px">' +
                '<button type="button" class="profile-toggle-pass" data-target="profile-confirm-pass" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div id="profile-pass-msg" class="profile-msg"></div>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
              '<button id="profile-save-pass" class="profile-btn-primary">Cambiar Contrasena</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Hidden file input for avatar upload
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/gif,image/webp";
    fileInput.style.display = "none";
    fileInput.id = "profile-avatar-file";
    overlay.appendChild(fileInput);

    // Event: Close modal
    document.getElementById("profile-close").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    // Event: Avatar hover
    var avatarContainer = document.getElementById("profile-avatar-container");
    var avatarHoverEl = document.getElementById("profile-avatar-hover");
    avatarContainer.addEventListener("mouseenter", function () { avatarHoverEl.style.opacity = "1"; });
    avatarContainer.addEventListener("mouseleave", function () { avatarHoverEl.style.opacity = "0"; });

    // Event: Avatar click -> upload
    avatarContainer.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      if (!fileInput.files || !fileInput.files[0]) return;
      uploadAvatar(fileInput.files[0]);
    });

    // Event: Tab switching
    var tabs = overlay.querySelectorAll(".profile-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove("active");
        this.classList.add("active");
        var tab = this.getAttribute("data-tab");
        document.getElementById("profile-tab-info").style.display = tab === "info" ? "block" : "none";
        document.getElementById("profile-tab-password").style.display = tab === "password" ? "block" : "none";
      });
    }

    // Event: Toggle password visibility
    var toggleBtns = overlay.querySelectorAll(".profile-toggle-pass");
    for (var k = 0; k < toggleBtns.length; k++) {
      toggleBtns[k].addEventListener("click", function () {
        var targetId = this.getAttribute("data-target");
        var input = document.getElementById(targetId);
        if (input) {
          var isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          this.style.color = isPassword ? "#3b82f6" : "#94a3b8";
        }
      });
    }

    // Event: Save info
    document.getElementById("profile-save-info").addEventListener("click", function () {
      var btn = this;
      var nameVal = document.getElementById("profile-name").value.trim();
      var msgEl = document.getElementById("profile-info-msg");

      if (!nameVal) {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "El nombre no puede estar vacio.";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Guardando...";
      msgEl.className = "profile-msg";
      msgEl.style.display = "none";

      fetch(API_BASE + "/admin_profile.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getAdminToken()
        },
        body: JSON.stringify({ action: "update_profile", name: nameVal })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          msgEl.className = "profile-msg success";
          msgEl.textContent = data.message || "Perfil actualizado.";
          // Update cache and sidebar
          if (profileCache) profileCache.name = nameVal;
          else profileCache = { name: nameVal, avatar_url: null };
          updateSidebarAvatar();
          // Update modal header name
          var displayName = document.getElementById("profile-display-name");
          if (displayName) displayName.textContent = nameVal;
          // Update localStorage
          var adminUser = getAdminUser();
          if (adminUser) {
            adminUser.name = nameVal;
            localStorage.setItem("imporlan_admin_user", JSON.stringify(adminUser));
          }
        } else {
          msgEl.className = "profile-msg error";
          msgEl.textContent = data.error || "Error al actualizar el perfil.";
        }
        btn.disabled = false;
        btn.textContent = "Guardar Cambios";
      })
      .catch(function () {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "Error de conexion.";
        btn.disabled = false;
        btn.textContent = "Guardar Cambios";
      });
    });

    // Event: Change password
    document.getElementById("profile-save-pass").addEventListener("click", function () {
      var btn = this;
      var currentPass = document.getElementById("profile-current-pass").value;
      var newPass = document.getElementById("profile-new-pass").value;
      var confirmPass = document.getElementById("profile-confirm-pass").value;
      var msgEl = document.getElementById("profile-pass-msg");

      if (!currentPass || !newPass || !confirmPass) {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "Todos los campos son obligatorios.";
        return;
      }

      if (newPass !== confirmPass) {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "Las contrasenas no coinciden.";
        return;
      }

      if (newPass.length < 6) {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "La contrasena debe tener al menos 6 caracteres.";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Cambiando...";
      msgEl.className = "profile-msg";
      msgEl.style.display = "none";

      fetch(API_BASE + "/admin_profile.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getAdminToken()
        },
        body: JSON.stringify({
          action: "change_password",
          current_password: currentPass,
          new_password: newPass,
          confirm_password: confirmPass
        })
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          msgEl.className = "profile-msg success";
          msgEl.textContent = data.message || "Contrasena actualizada.";
          // Clear inputs
          document.getElementById("profile-current-pass").value = "";
          document.getElementById("profile-new-pass").value = "";
          document.getElementById("profile-confirm-pass").value = "";
        } else {
          msgEl.className = "profile-msg error";
          msgEl.textContent = data.error || "Error al cambiar la contrasena.";
        }
        btn.disabled = false;
        btn.textContent = "Cambiar Contrasena";
      })
      .catch(function () {
        msgEl.className = "profile-msg error";
        msgEl.textContent = "Error de conexion.";
        btn.disabled = false;
        btn.textContent = "Cambiar Contrasena";
      });
    });
  }

  /* ── Upload avatar ── */
  function uploadAvatar(file) {
    var formData = new FormData();
    formData.append("action", "update_photo");
    formData.append("avatar", file);

    // Show loading state on avatar
    var avatarContainer = document.getElementById("profile-avatar-container");
    if (avatarContainer) {
      var hoverEl = document.getElementById("profile-avatar-hover");
      if (hoverEl) {
        hoverEl.style.opacity = "1";
        hoverEl.innerHTML = '<div style="width:24px;height:24px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite"></div>';
        if (!document.getElementById("profile-spin-style")) {
          var spinStyle = document.createElement("style");
          spinStyle.id = "profile-spin-style";
          spinStyle.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
          document.head.appendChild(spinStyle);
        }
      }
    }

    fetch(API_BASE + "/admin_profile.php", {
      method: "POST",
      headers: { "Authorization": "Bearer " + getAdminToken() },
      body: formData
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success && data.avatar_url) {
        // Update profile cache
        if (!profileCache) profileCache = { name: "", avatar_url: null };
        profileCache.avatar_url = data.avatar_url;

        // Update modal avatar
        if (avatarContainer) {
          avatarContainer.innerHTML =
            '<img src="' + data.avatar_url + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' +
            '<div id="profile-avatar-hover" style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;border-radius:50%">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '</div>';
          // Re-attach hover events
          var newHover = document.getElementById("profile-avatar-hover");
          avatarContainer.addEventListener("mouseenter", function () { newHover.style.opacity = "1"; });
          avatarContainer.addEventListener("mouseleave", function () { newHover.style.opacity = "0"; });
        }

        // Update sidebar avatar
        updateSidebarAvatar();

        // Show success on info tab
        var msgEl = document.getElementById("profile-info-msg");
        if (msgEl) {
          msgEl.className = "profile-msg success";
          msgEl.textContent = "Foto de perfil actualizada.";
        }
      } else {
        var msgEl2 = document.getElementById("profile-info-msg");
        if (msgEl2) {
          msgEl2.className = "profile-msg error";
          msgEl2.textContent = data.error || "Error al subir la imagen.";
        }
      }
    })
    .catch(function () {
      var msgEl3 = document.getElementById("profile-info-msg");
      if (msgEl3) {
        msgEl3.className = "profile-msg error";
        msgEl3.textContent = "Error de conexion al subir la imagen.";
      }
    });
  }

  /* ── Fix sidebar layout: pin user section at bottom ── */
  function fixSidebarLayout() {
    var aside = document.querySelector("aside");
    if (!aside) return;
    if (aside.getAttribute("data-sidebar-fixed")) return;
    aside.setAttribute("data-sidebar-fixed", "true");

    // Constrain aside to viewport height
    aside.style.height = "100vh";
    aside.style.maxHeight = "100vh";
    aside.style.overflow = "hidden";
    aside.style.position = "sticky";
    aside.style.top = "0";

    // Make nav scrollable so menu items don't push user section out
    var nav = aside.querySelector("nav");
    if (nav) {
      nav.style.overflowY = "auto";
      nav.style.minHeight = "0";
      // Hide scrollbar but keep functionality
      nav.style.scrollbarWidth = "thin";
      nav.style.scrollbarColor = "transparent transparent";
    }

    // Pin user section at bottom (border-t div + logout button)
    var borderT = aside.querySelector("div.border-t, div[class*='border-t']");
    if (borderT) {
      borderT.style.flexShrink = "0";
    }

    // Also pin logout button
    var logoutBtns = aside.querySelectorAll("button");
    for (var i = 0; i < logoutBtns.length; i++) {
      if (logoutBtns[i].textContent.trim().indexOf("Cerrar") !== -1) {
        logoutBtns[i].style.flexShrink = "0";
        break;
      }
    }
  }

  /* ── Main check ── */
  function check() {
    var token = getAdminToken();
    if (!token) return; // Not logged in

    fixSidebarLayout();
    injectProfileClickable();

    // Load profile data and update sidebar
    if (!profileCache) {
      loadProfile(function () {
        updateSidebarAvatar();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", check);
  } else {
    check();
  }

  // Observe for React re-renders
  var profileObserverThrottle = null;
  new MutationObserver(function () {
    if (profileObserverThrottle) return;
    profileObserverThrottle = setTimeout(function () {
      profileObserverThrottle = null;
      check();
    }, 500);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
