/**
 * Messages Section Enhancer - Imporlan User Panel
 * Replaces the React placeholder Messages page with a full-featured
 * messaging UI connected to the chat API (same backend as chat-widget-user.js).
 */
(function () {
  "use strict";

  var isTestEnv = window.location.pathname.startsWith("/test/") || window.location.pathname.startsWith("/panel-test/");
  var API_BASE = isTestEnv ? "/test/api/chat_api.php" : "/api/chat_api.php";
  var POLL_INTERVAL = 5000;
  var CONTAINER_ID = "messages-enhancer";

  var currentUser = null;
  var conversations = [];
  var currentConversation = null;
  var messages = [];
  var pollTimer = null;
  var lastPollTime = null;
  var enhanced = false;

  // ── Helpers ──────────────────────────────────────────────────────────

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      var token = localStorage.getItem("imporlan_token");
      if (raw && token) {
        var u = JSON.parse(raw);
        u.token = token;
        return u;
      }
    } catch (e) {}
    return null;
  }

  function escHtml(t) {
    if (!t) return "";
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  function getInitials(name) {
    if (!name) return "?";
    return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(function (n) { return n[0].toUpperCase(); }).join("");
  }

  function formatTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var now = new Date();
    var diff = now - d;
    var mins = Math.floor(diff / 60000);
    var hrs = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return mins + "m";
    if (hrs < 24) return hrs + "h";
    if (days < 7) return days + "d";
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
  }

  function formatFullDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) + " " + formatTime(ts);
  }

  // ── API ──────────────────────────────────────────────────────────────

  function apiCall(action, method, body, params) {
    method = method || "GET";
    params = params || {};
    var url = new URL(API_BASE, window.location.origin);
    url.searchParams.set("action", action);
    Object.keys(params).forEach(function (k) { url.searchParams.set(k, params[k]); });

    var opts = {
      method: method,
      headers: {
        "Authorization": "Bearer " + currentUser.token,
        "Content-Type": "application/json",
        "X-User-Email": currentUser.email || "",
        "X-User-Name": currentUser.name || ""
      }
    };
    if (body && method !== "GET") opts.body = JSON.stringify(body);

    return fetch(url.toString(), opts).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return { error: "Request failed" }; }).then(function (e) { throw new Error(e.detail || e.error || "Request failed"); });
      return r.json();
    });
  }

  // ── Page Detection ───────────────────────────────────────────────────

  var hideStyle = document.createElement("style");
  hideStyle.id = "msg-hide-react";
  hideStyle.textContent = "";
  document.head.appendChild(hideStyle);

  function isMessagesPage() {
    var h = document.querySelector("main h1");
    var is = h && h.textContent.trim() === "Mensajes";
    var st = document.getElementById("msg-hide-react");
    if (st) {
      st.textContent = is
        ? "main > *:not(#" + CONTAINER_ID + ") { display: none !important; }"
        : "";
    }
    return is;
  }

  // ── Inject CSS ───────────────────────────────────────────────────────

  function injectCSS() {
    if (document.getElementById("msg-enhancer-css")) return;
    var s = document.createElement("style");
    s.id = "msg-enhancer-css";
    s.textContent = [
      "#messages-enhancer { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }",
      ".msg-container { display: flex; height: calc(100vh - 180px); min-height: 500px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(10,22,40,0.08); border: 1px solid #e2e8f0; }",

      /* Conversations sidebar */
      ".msg-sidebar { width: 340px; min-width: 280px; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; background: #fff; }",
      ".msg-sidebar-header { padding: 20px; background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%); }",
      ".msg-sidebar-header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #fff; }",
      ".msg-sidebar-header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }",
      ".msg-new-btn { margin-top: 14px; width: 100%; padding: 10px 16px; background: #22d3ee; color: #0a1628; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; }",
      ".msg-new-btn:hover { background: #06b6d4; }",
      ".msg-conv-list { flex: 1; overflow-y: auto; padding: 8px; }",

      /* Conversation item */
      ".msg-conv-item { display: flex; align-items: flex-start; padding: 12px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; transition: background 0.15s; }",
      ".msg-conv-item:hover { background: #f1f5f9; }",
      ".msg-conv-item.active { background: #e0f2fe; border-left: 3px solid #22d3ee; }",
      ".msg-conv-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#22d3ee,#3b82f6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 15px; flex-shrink: 0; }",
      ".msg-conv-body { flex: 1; margin-left: 12px; min-width: 0; }",
      ".msg-conv-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }",
      ".msg-conv-name { font-weight: 600; font-size: 14px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".msg-conv-time { font-size: 12px; color: #94a3b8; flex-shrink: 0; margin-left: 8px; }",
      ".msg-conv-preview { font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".msg-conv-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }",
      ".msg-unread { background: #ef4444; color: #fff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }",
      ".msg-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }",
      ".msg-status.open { background: #dcfce7; color: #166534; }",
      ".msg-status.closed { background: #f1f5f9; color: #64748b; }",
      ".msg-assigned { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; background: #dbeafe; color: #1d4ed8; }",

      /* Messages panel */
      ".msg-panel { flex: 1; display: flex; flex-direction: column; background: #f8fafc; min-width: 0; }",
      ".msg-panel-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #fff; }",
      ".msg-panel-hinfo { display: flex; align-items: center; gap: 12px; }",
      ".msg-panel-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#22d3ee,#3b82f6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 14px; }",
      ".msg-panel-hname { margin: 0; font-size: 16px; font-weight: 600; color: #1e293b; }",
      ".msg-panel-hsub { margin: 2px 0 0; font-size: 13px; color: #64748b; }",

      /* Messages list */
      ".msg-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }",

      /* Message bubbles */
      ".msg-bubble-wrap { display: flex; gap: 10px; max-width: 70%; }",
      ".msg-bubble-wrap.user { align-self: flex-end; flex-direction: row-reverse; }",
      ".msg-bubble-wrap.admin, .msg-bubble-wrap.support { align-self: flex-start; }",
      ".msg-bubble-wrap.system { align-self: center; max-width: 85%; flex-direction: column; align-items: center; }",
      ".msg-b-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; flex-shrink: 0; color: #fff; }",
      ".msg-bubble-wrap.user .msg-b-avatar { background: linear-gradient(135deg,#22d3ee,#3b82f6); }",
      ".msg-bubble-wrap.admin .msg-b-avatar { background: linear-gradient(135deg,#3b82f6,#1d4ed8); }",
      ".msg-bubble-wrap.support .msg-b-avatar { background: linear-gradient(135deg,#10b981,#047857); }",
      ".msg-b-content { display: flex; flex-direction: column; }",
      ".msg-b-sender { font-size: 12px; font-weight: 600; margin-bottom: 3px; }",
      ".msg-bubble-wrap.user .msg-b-sender { color: #22d3ee; text-align: right; }",
      ".msg-bubble-wrap.admin .msg-b-sender { color: #3b82f6; }",
      ".msg-bubble-wrap.support .msg-b-sender { color: #10b981; }",
      ".msg-b-bubble { padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }",
      ".msg-bubble-wrap.user .msg-b-bubble { background: linear-gradient(135deg,#22d3ee,#06b6d4); color: #0a1628; border-bottom-right-radius: 4px; }",
      ".msg-bubble-wrap.admin .msg-b-bubble { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }",
      ".msg-bubble-wrap.support .msg-b-bubble { background: #f0fdf4; color: #1e293b; border-bottom-left-radius: 4px; border: 1px solid #bbf7d0; }",
      ".msg-bubble-wrap.system .msg-b-bubble { background: linear-gradient(135deg,#f0f9ff,#e0f2fe); color: #0369a1; border: 1px solid #bae6fd; border-radius: 16px; padding: 14px 18px; font-size: 13px; line-height: 1.6; text-align: center; }",
      ".msg-b-time { font-size: 11px; color: #94a3b8; margin-top: 3px; }",
      ".msg-bubble-wrap.user .msg-b-time { text-align: right; }",
      ".msg-bubble-wrap.system .msg-b-time { text-align: center; }",

      /* Input area */
      ".msg-input-area { padding: 16px 20px; border-top: 1px solid #e2e8f0; background: #fff; }",
      ".msg-input-wrap { display: flex; align-items: flex-end; gap: 12px; background: #f8fafc; border-radius: 24px; padding: 8px 8px 8px 20px; border: 1px solid #e2e8f0; transition: border-color 0.2s, box-shadow 0.2s; }",
      ".msg-input-wrap:focus-within { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,0.1); }",
      ".msg-input-wrap textarea { flex: 1; border: none; background: transparent; resize: none; font-size: 14px; line-height: 1.5; max-height: 120px; min-height: 24px; padding: 4px 0; font-family: inherit; outline: none; }",
      ".msg-input-wrap textarea::placeholder { color: #94a3b8; }",
      ".msg-send-btn { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#22d3ee,#3b82f6); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s, box-shadow 0.2s; }",
      ".msg-send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(34,211,238,0.4); }",
      ".msg-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }",
      ".msg-send-btn svg { width: 20px; height: 20px; color: #fff; }",
      ".msg-closed-bar { padding: 16px 20px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; background: #f8fafc; }",

      /* Empty / loading states */
      ".msg-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; padding: 40px; }",
      ".msg-empty svg { width: 48px; height: 48px; margin-bottom: 16px; color: #cbd5e1; }",
      ".msg-empty h3 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #64748b; }",
      ".msg-empty p { margin: 0; font-size: 14px; }",
      ".msg-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #22d3ee; border-radius: 50%; animation: msg-spin 0.8s linear infinite; }",
      "@keyframes msg-spin { to { transform: rotate(360deg); } }",

      /* New conversation modal */
      ".msg-modal-overlay { position: fixed; inset: 0; background: rgba(10,22,40,0.5); display: flex; align-items: center; justify-content: center; z-index: 10002; opacity: 0; visibility: hidden; transition: all 0.3s; }",
      ".msg-modal-overlay.active { opacity: 1; visibility: visible; }",
      ".msg-modal { width: 90%; max-width: 500px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(10,22,40,0.3); }",
      ".msg-modal-head { padding: 20px; background: linear-gradient(135deg,#0a1628,#1a365d); display: flex; align-items: center; justify-content: space-between; }",
      ".msg-modal-head h3 { margin: 0; font-size: 18px; font-weight: 600; color: #fff; }",
      ".msg-modal-close { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; transition: background 0.2s; }",
      ".msg-modal-close:hover { background: rgba(255,255,255,0.2); }",
      ".msg-modal-body { padding: 20px; }",
      ".msg-modal-body textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; outline: none; }",
      ".msg-modal-body textarea:focus { border-color: #22d3ee; box-shadow: 0 0 0 3px rgba(34,211,238,0.1); }",
      ".msg-modal-body textarea::placeholder { color: #94a3b8; }",
      ".msg-modal-foot { padding: 16px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }",
      ".msg-modal-foot button { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }",
      ".msg-modal-cancel { background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; }",
      ".msg-modal-cancel:hover { background: #f1f5f9; }",
      ".msg-modal-submit { background: linear-gradient(135deg,#22d3ee,#3b82f6); border: none; color: #fff; }",
      ".msg-modal-submit:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34,211,238,0.4); }",
      ".msg-modal-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }",

      /* Mobile back button */
      ".msg-back-btn { display: none; padding: 6px 12px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: #fff; font-size: 13px; cursor: pointer; margin-right: 8px; }",

      /* Responsive */
      "@media (max-width: 768px) {",
      "  .msg-sidebar { width: 100%; min-width: 100%; position: absolute; left: 0; top: 0; bottom: 0; z-index: 10; transition: transform 0.3s; }",
      "  .msg-sidebar.hidden-mobile { transform: translateX(-100%); }",
      "  .msg-container { position: relative; overflow: hidden; }",
      "  .msg-bubble-wrap { max-width: 85%; }",
      "  .msg-back-btn { display: inline-flex; }",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ── SVG Icons ────────────────────────────────────────────────────────

  var ICON_CHAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var ICON_SEND = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var ICON_ARROW_LEFT = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';

  // ── Render ───────────────────────────────────────────────────────────

  function renderContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = CONTAINER_ID;
      var main = document.querySelector("main");
      if (main) main.appendChild(el);
      else return;
    }

    el.innerHTML =
      '<div style="margin-bottom: 6px;">' +
        '<h1 style="font-size: 1.875rem; font-weight: 700; color: #1e293b; margin: 0;">Mensajes</h1>' +
        '<p style="color: #64748b; margin: 4px 0 0;">Comunicacion directa con tu agente Imporlan</p>' +
      '</div>' +
      '<div class="msg-container">' +
        '<div class="msg-sidebar" id="msg-sidebar">' +
          '<div class="msg-sidebar-header">' +
            '<h2>Mis Conversaciones</h2>' +
            '<p>Historial de mensajes</p>' +
            '<button class="msg-new-btn" id="msg-new-btn">' + ICON_PLUS + ' Nueva Conversacion</button>' +
          '</div>' +
          '<div class="msg-conv-list" id="msg-conv-list">' +
            '<div class="msg-empty"><div class="msg-spinner"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="msg-panel" id="msg-panel">' +
          '<div class="msg-empty">' +
            ICON_CHAT +
            '<h3>Selecciona una conversacion</h3>' +
            '<p>O inicia una nueva para contactar con soporte</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    // New conversation modal
    var modal = document.createElement("div");
    modal.className = "msg-modal-overlay";
    modal.id = "msg-new-modal";
    modal.innerHTML =
      '<div class="msg-modal">' +
        '<div class="msg-modal-head">' +
          '<h3>Nueva Conversacion</h3>' +
          '<button class="msg-modal-close" id="msg-modal-close">&times;</button>' +
        '</div>' +
        '<div class="msg-modal-body">' +
          '<textarea id="msg-new-text" placeholder="Escribe tu mensaje aqui... Nuestro equipo de soporte te respondera a la brevedad."></textarea>' +
        '</div>' +
        '<div class="msg-modal-foot">' +
          '<button class="msg-modal-cancel" id="msg-modal-cancel">Cancelar</button>' +
          '<button class="msg-modal-submit" id="msg-modal-send">Enviar Mensaje</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Bind events
    document.getElementById("msg-new-btn").addEventListener("click", openNewModal);
    document.getElementById("msg-modal-close").addEventListener("click", closeNewModal);
    document.getElementById("msg-modal-cancel").addEventListener("click", closeNewModal);
    document.getElementById("msg-modal-send").addEventListener("click", startNewConversation);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeNewModal(); });

    // Initial load
    fetchConversations();
  }

  // ── New Conversation Modal ───────────────────────────────────────────

  function openNewModal() {
    document.getElementById("msg-new-modal").classList.add("active");
    document.getElementById("msg-new-text").focus();
  }

  function closeNewModal() {
    var m = document.getElementById("msg-new-modal");
    m.classList.remove("active");
    document.getElementById("msg-new-text").value = "";
  }

  function startNewConversation() {
    var ta = document.getElementById("msg-new-text");
    var btn = document.getElementById("msg-modal-send");
    var text = ta.value.trim();
    if (!text) { ta.focus(); return; }

    btn.disabled = true;
    btn.textContent = "Enviando...";

    apiCall("user_start_conversation", "POST", { message: text })
      .then(function (res) {
        closeNewModal();
        return fetchConversations().then(function () {
          selectConversation(res.conversation_id);
        });
      })
      .catch(function (err) {
        alert("Error al iniciar conversacion: " + err.message);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Enviar Mensaje";
      });
  }

  // ── Conversations ────────────────────────────────────────────────────

  function fetchConversations() {
    return apiCall("user_conversations").then(function (res) {
      conversations = res.conversations || [];
      renderConversations();
    }).catch(function () {
      var list = document.getElementById("msg-conv-list");
      if (list) list.innerHTML = '<div class="msg-empty"><p>Error al cargar conversaciones</p></div>';
    });
  }

  function renderConversations() {
    var list = document.getElementById("msg-conv-list");
    if (!list) return;

    if (conversations.length === 0) {
      list.innerHTML = '<div class="msg-empty" style="padding:40px 20px;"><p>No tienes conversaciones aun</p><p style="font-size:12px;margin-top:8px;">Inicia una nueva para contactar con soporte</p></div>';
      return;
    }

    conversations.sort(function (a, b) {
      return new Date(b.last_message_time || b.updated_at || 0) - new Date(a.last_message_time || a.updated_at || 0);
    });

    list.innerHTML = conversations.map(function (c) {
      var active = currentConversation && currentConversation.id === c.id;
      var initials = getInitials(c.user_name || c.user_email);
      return '<div class="msg-conv-item' + (active ? " active" : "") + '" data-id="' + c.id + '">' +
        '<div class="msg-conv-avatar">' + escHtml(initials) + '</div>' +
        '<div class="msg-conv-body">' +
          '<div class="msg-conv-top">' +
            '<span class="msg-conv-name">Conversacion #' + c.id + '</span>' +
            '<span class="msg-conv-time">' + formatDate(c.last_message_time || c.updated_at) + '</span>' +
          '</div>' +
          '<div class="msg-conv-preview">' + escHtml(c.last_message || "Sin mensajes") + '</div>' +
          '<div class="msg-conv-meta">' +
            (c.unread_count > 0 ? '<span class="msg-unread">' + c.unread_count + '</span>' : '') +
            (c.assigned_to_name ? '<span class="msg-assigned">' + escHtml(c.assigned_to_name) + '</span>' : '') +
            '<span class="msg-status ' + c.status + '">' + (c.status === "open" ? "Abierta" : "Cerrada") + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    list.querySelectorAll(".msg-conv-item").forEach(function (item) {
      item.addEventListener("click", function () {
        selectConversation(parseInt(item.dataset.id));
      });
    });
  }

  // ── Select & Render Messages ─────────────────────────────────────────

  function selectConversation(id) {
    currentConversation = conversations.find(function (c) { return c.id === id; });
    if (!currentConversation) return;

    // Mark active in sidebar
    document.querySelectorAll(".msg-conv-item").forEach(function (el) {
      el.classList.toggle("active", parseInt(el.dataset.id) === id);
    });

    // Mobile: hide sidebar
    var sidebar = document.getElementById("msg-sidebar");
    if (sidebar && window.innerWidth <= 768) sidebar.classList.add("hidden-mobile");

    var panel = document.getElementById("msg-panel");
    panel.innerHTML = '<div class="msg-empty"><div class="msg-spinner"></div></div>';

    apiCall("user_messages", "GET", null, { conversation_id: id })
      .then(function (res) {
        messages = res.messages || [];
        renderMessages();
        currentConversation.unread_count = 0;
        renderConversations();
      })
      .catch(function () {
        panel.innerHTML = '<div class="msg-empty"><p>Error al cargar mensajes</p></div>';
      });
  }

  function renderMessages() {
    var panel = document.getElementById("msg-panel");
    if (!panel || !currentConversation) return;
    var isClosed = currentConversation.status === "closed";

    var headerHtml =
      '<div class="msg-panel-header">' +
        '<div class="msg-panel-hinfo">' +
          '<button class="msg-back-btn" id="msg-back-btn">' + ICON_ARROW_LEFT + ' Atras</button>' +
          '<div class="msg-panel-avatar">' + getInitials(currentUser.name || currentUser.email) + '</div>' +
          '<div>' +
            '<div class="msg-panel-hname">Conversacion #' + currentConversation.id + '</div>' +
            '<div class="msg-panel-hsub">' + (currentConversation.assigned_to_name ? "Atendido por: " + escHtml(currentConversation.assigned_to_name) : "Esperando asignacion") + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="msg-status ' + currentConversation.status + '">' + (isClosed ? "Cerrada" : "Abierta") + '</span>' +
      '</div>';

    var msgsHtml = '<div class="msg-messages" id="msg-messages-list">';
    if (messages.length === 0) {
      msgsHtml += '<div class="msg-empty"><p>No hay mensajes en esta conversacion</p></div>';
    } else {
      messages.forEach(function (m) { msgsHtml += renderBubble(m); });
    }
    msgsHtml += '</div>';

    var inputHtml;
    if (isClosed) {
      inputHtml = '<div class="msg-closed-bar">Esta conversacion esta cerrada</div>';
    } else {
      inputHtml =
        '<div class="msg-input-area">' +
          '<div class="msg-input-wrap">' +
            '<textarea id="msg-text-input" placeholder="Escribe un mensaje..." rows="1"></textarea>' +
            '<button class="msg-send-btn" id="msg-send-btn">' + ICON_SEND + '</button>' +
          '</div>' +
        '</div>';
    }

    panel.innerHTML = headerHtml + msgsHtml + inputHtml;

    // Scroll to bottom
    var mc = document.getElementById("msg-messages-list");
    if (mc) mc.scrollTop = mc.scrollHeight;

    // Back button (mobile)
    var backBtn = document.getElementById("msg-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        var sidebar = document.getElementById("msg-sidebar");
        if (sidebar) sidebar.classList.remove("hidden-mobile");
      });
    }

    // Input handlers
    if (!isClosed) {
      var ta = document.getElementById("msg-text-input");
      var sendBtn = document.getElementById("msg-send-btn");
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
      ta.addEventListener("input", function () {
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      });
      sendBtn.addEventListener("click", sendMessage);
    }

    // Start polling
    startPolling();
  }

  function renderBubble(m) {
    var role = m.sender_role;
    if (role === "system") {
      return '<div class="msg-bubble-wrap system">' +
        '<div class="msg-b-content">' +
          '<div class="msg-b-bubble">' + escHtml(m.message).replace(/\n/g, "<br>") + '</div>' +
          '<span class="msg-b-time">' + formatTime(m.timestamp) + '</span>' +
        '</div>' +
      '</div>';
    }
    return '<div class="msg-bubble-wrap ' + role + '">' +
      '<div class="msg-b-avatar">' + getInitials(m.sender_name) + '</div>' +
      '<div class="msg-b-content">' +
        '<span class="msg-b-sender">' + escHtml(m.sender_name) + '</span>' +
        '<div class="msg-b-bubble">' + escHtml(m.message).replace(/\n/g, "<br>") + '</div>' +
        '<span class="msg-b-time">' + formatTime(m.timestamp) + '</span>' +
      '</div>' +
    '</div>';
  }

  // ── Send Message ─────────────────────────────────────────────────────

  function sendMessage() {
    var ta = document.getElementById("msg-text-input");
    var btn = document.getElementById("msg-send-btn");
    if (!ta || !currentConversation) return;
    var text = ta.value.trim();
    if (!text) return;

    ta.disabled = true;
    btn.disabled = true;

    apiCall("user_send", "POST", { conversation_id: currentConversation.id, message: text })
      .then(function () {
        ta.value = "";
        ta.style.height = "auto";
        messages.push({
          id: Date.now(),
          conversation_id: currentConversation.id,
          sender_id: currentUser.id,
          sender_role: "user",
          sender_name: currentUser.name || currentUser.email.split("@")[0],
          message: text,
          timestamp: new Date().toISOString(),
          read_status: 0
        });
        renderMessages();
        currentConversation.last_message = text;
        currentConversation.updated_at = new Date().toISOString();
        renderConversations();
      })
      .catch(function (err) {
        alert("Error al enviar mensaje: " + err.message);
      })
      .finally(function () {
        ta.disabled = false;
        btn.disabled = false;
        if (ta) ta.focus();
      });
  }

  // ── Polling ──────────────────────────────────────────────────────────

  function startPolling() {
    stopPolling();
    lastPollTime = new Date().toISOString();
    pollTimer = setInterval(function () {
      if (!currentConversation) return;
      apiCall("poll", "GET", null, { last_check: lastPollTime, conversation_id: currentConversation.id })
        .then(function (res) {
          lastPollTime = res.server_time;
          if (res.new_messages && res.new_messages.length > 0) {
            res.new_messages.forEach(function (msg) {
              if (!messages.find(function (m) { return m.id === msg.id; })) {
                messages.push(msg);
              }
            });
            renderMessages();
          }
          fetchConversations();
        })
        .catch(function () {});
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  function cleanup() {
    stopPolling();
    var modal = document.getElementById("msg-new-modal");
    if (modal) modal.remove();
    var el = document.getElementById(CONTAINER_ID);
    if (el) el.remove();
    enhanced = false;
    currentConversation = null;
    messages = [];
  }

  // ── Main Loop ────────────────────────────────────────────────────────

  function check() {
    currentUser = getUserData();
    if (!currentUser) return;

    if (isMessagesPage()) {
      if (!enhanced) {
        enhanced = true;
        injectCSS();
        renderContainer();
      }
    } else {
      if (enhanced) cleanup();
    }
  }

  // Observe DOM changes for SPA navigation
  var observer = new MutationObserver(function () { check(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also check on hashchange
  window.addEventListener("hashchange", function () {
    setTimeout(check, 100);
  });

  // Initial check with delay for React to render
  setTimeout(check, 500);
  setTimeout(check, 1500);
})();
