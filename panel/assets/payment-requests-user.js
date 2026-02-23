/**
 * Payment Requests User Enhancer - Imporlan Panel
 * Displays pending payment requests created by admin in the user's Pagos section
 * and adds notifications in the Alertas section.
 * Provides payment buttons that trigger WebPay, MercadoPago, or PayPal.
 */
(function () {
  "use strict";

  var API_BASE = window.location.pathname.includes("/panel-test")
    ? "/test/api"
    : "/api";

  var PAYMENT_API_BASE = "https://www.imporlan.cl/api";

  var injected = false;
  var alertsInjected = false;
  var paymentRequests = [];
  var lastFetchTime = 0;
  var FETCH_INTERVAL = 30000; // 30 seconds

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function getUserEmail() {
    var u = getUserData();
    return u ? (u.email || u.user_email || "") : "";
  }

  function getUserName() {
    var u = getUserData();
    return u ? (u.name || u.full_name || "") : "";
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatCLP(amount) {
    if (!amount && amount !== 0) return "$0";
    var num = parseInt(amount);
    if (isNaN(num)) return "$0";
    return "$" + num.toLocaleString("es-CL");
  }

  function formatUSD(amount) {
    if (!amount) return null;
    var num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return null;
    return "USD $" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    var d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function isPaymentsPage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (h1) {
      var text = h1.textContent.trim();
      if (text === "Pagos" || text === "Payments") return true;
    }
    return false;
  }

  function isAlertsPage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var headings = main.querySelectorAll("h1, h2");
    for (var i = 0; i < headings.length; i++) {
      var t = (headings[i].textContent || "").trim();
      if (t === "Alertas y Notificaciones" || t === "Alertas" || t === "Notifications") return true;
    }
    return false;
  }

  // ── Fetch payment requests from API ──
  async function fetchPaymentRequests() {
    var email = getUserEmail();
    if (!email) return [];
    var now = Date.now();
    if (now - lastFetchTime < FETCH_INTERVAL && paymentRequests.length > 0) {
      return paymentRequests;
    }
    try {
      var resp = await fetch(API_BASE + "/payment_requests_api.php?action=user_list_public&user_email=" + encodeURIComponent(email) + "&status=all");
      var data = await resp.json();
      if (data.success && data.requests) {
        paymentRequests = data.requests;
        lastFetchTime = now;
      }
    } catch (e) {
      console.error("[PaymentRequests] Error fetching:", e);
    }
    return paymentRequests;
  }

  // ── Build payment request card HTML ──
  function buildRequestCard(req) {
    var isPending = req.status === "pending";
    var isPaid = req.status === "paid";
    var isCancelled = req.status === "cancelled";

    var statusBadge = "";
    if (isPending) {
      statusBadge = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:#fef3c7;color:#92400e"><span style="width:6px;height:6px;border-radius:50%;background:#f59e0b"></span>Pendiente</span>';
    } else if (isPaid) {
      statusBadge = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:#d1fae5;color:#065f46"><span style="width:6px;height:6px;border-radius:50%;background:#10b981"></span>Pagado</span>';
    } else if (isCancelled) {
      statusBadge = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;background:#fee2e2;color:#991b1b"><span style="width:6px;height:6px;border-radius:50%;background:#ef4444"></span>Cancelado</span>';
    }

    var usdLine = formatUSD(req.amount_usd);
    var usdHtml = usdLine ? '<span style="font-size:13px;color:#64748b;margin-left:8px">(' + usdLine + ')</span>' : '';

    var descHtml = req.description
      ? '<p style="color:#475569;font-size:13px;margin:8px 0 0;line-height:1.5">' + escapeHtml(req.description) + '</p>'
      : '';

    var payBtnHtml = '';
    if (isPending) {
      payBtnHtml = '<button onclick="window.__prUserPay(\'' + escapeHtml(req.id) + '\')" style="background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Pagar Ahora</button>';
    }

    var paidInfoHtml = '';
    if (isPaid) {
      paidInfoHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">' +
        '<div><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Metodo</p><p style="margin:2px 0 0;font-size:13px;font-weight:600;color:#0f172a;text-transform:capitalize">' + escapeHtml(req.payment_method || "N/A") + '</p></div>' +
        '<div><p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Fecha Pago</p><p style="margin:2px 0 0;font-size:13px;font-weight:600;color:#0f172a">' + formatDate(req.paid_at) + '</p></div>' +
        '</div>';
    }

    var cancelledInfoHtml = '';
    if (isCancelled && req.cancelled_reason) {
      cancelledInfoHtml = '<div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca"><p style="margin:0;font-size:12px;color:#991b1b"><strong>Razon:</strong> ' + escapeHtml(req.cancelled_reason) + '</p></div>';
    }

    return '<div style="background:#fff;border-radius:14px;border:1px solid ' + (isPending ? '#fbbf24' : '#e2e8f0') + ';overflow:hidden;transition:all .2s;' + (isPending ? 'box-shadow:0 0 0 1px #fbbf24,0 4px 12px rgba(251,191,36,0.15)' : '') + '">' +
      '<div style="padding:20px 24px">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
      '<div style="width:40px;height:40px;background:linear-gradient(135deg,' + (isPending ? '#f59e0b,#eab308' : isPaid ? '#10b981,#059669' : '#94a3b8,#64748b') + ');border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
      '<div>' +
      '<h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a">' + escapeHtml(req.title) + '</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Creado: ' + formatDate(req.created_at) + '</p>' +
      '</div></div>' +
      descHtml +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
      statusBadge +
      '<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:' + (isPending ? '#d97706' : isPaid ? '#059669' : '#64748b') + '">' + formatCLP(req.amount_clp) + ' CLP</p>' +
      usdHtml +
      '</div>' +
      '</div>' +
      paidInfoHtml +
      cancelledInfoHtml +
      (isPending ? '<div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9">' + payBtnHtml + '</div>' : '') +
      '</div></div>';
  }

  // ── Build the full payment requests section ──
  function buildPaymentRequestsSection(requests) {
    if (!requests || requests.length === 0) return "";

    var pendingRequests = requests.filter(function (r) { return r.status === "pending"; });
    var otherRequests = requests.filter(function (r) { return r.status !== "pending"; });

    var html = '<div id="pr-user-section" style="margin-bottom:24px">';

    // Pending section
    if (pendingRequests.length > 0) {
      html += '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fbbf24;border-radius:16px;padding:20px 24px;margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
        '<div style="width:44px;height:44px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
        '<div><h2 style="margin:0;font-size:18px;font-weight:700;color:#92400e">Solicitudes de Pago Pendientes</h2>' +
        '<p style="margin:2px 0 0;font-size:13px;color:#a16207">Tienes ' + pendingRequests.length + ' solicitud' + (pendingRequests.length > 1 ? 'es' : '') + ' de pago pendiente' + (pendingRequests.length > 1 ? 's' : '') + '</p></div></div>' +
        '<div style="display:grid;gap:12px">';
      pendingRequests.forEach(function (req) {
        html += buildRequestCard(req);
      });
      html += '</div></div>';
    }

    // History section (paid/cancelled)
    if (otherRequests.length > 0) {
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px 24px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<h3 style="margin:0;font-size:16px;font-weight:600;color:#475569">Historial de Solicitudes</h3></div>' +
        '<div style="display:grid;gap:12px">';
      otherRequests.forEach(function (req) {
        html += buildRequestCard(req);
      });
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  // ── Inject payment requests into Pagos page ──
  async function injectPaymentRequests() {
    if (!isPaymentsPage()) {
      injected = false;
      return;
    }
    if (document.getElementById("pr-user-section")) return;

    var email = getUserEmail();
    if (!email) return;

    var requests = await fetchPaymentRequests();
    if (!requests || requests.length === 0) return;

    var html = buildPaymentRequestsSection(requests);
    if (!html) return;

    // Find the main content area - inject before the first card
    var main = document.querySelector("main");
    if (!main) return;

    // Find the first "space-y-6" div (the Pagos page container)
    var container = main.querySelector(".space-y-6");
    if (!container) {
      // Fallback: inject at the top of main
      container = main;
    }

    var wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    // Insert at the very top of the container (before the first child)
    if (container.firstChild) {
      container.insertBefore(wrapper.firstElementChild, container.firstChild);
    } else {
      container.appendChild(wrapper.firstElementChild);
    }

    injected = true;
    console.log("[PaymentRequests] Injected " + requests.length + " payment request(s) into Pagos page");
  }

  // ── Inject notifications into Alertas page ──
  async function injectAlertNotifications() {
    if (!isAlertsPage()) {
      alertsInjected = false;
      return;
    }
    if (document.getElementById("pr-alerts-section")) return;

    var email = getUserEmail();
    if (!email) return;

    var requests = await fetchPaymentRequests();
    var pendingRequests = requests.filter(function (r) { return r.status === "pending"; });
    if (pendingRequests.length === 0) return;

    var main = document.querySelector("main");
    if (!main) return;

    var alertHtml = '<div id="pr-alerts-section" style="margin-bottom:16px">';
    pendingRequests.forEach(function (req) {
      alertHtml += '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fbbf24;border-radius:12px;padding:16px 20px;margin-bottom:8px;display:flex;align-items:center;gap:14px;cursor:pointer" onclick="window.location.hash=\'#payments\'">' +
        '<div style="width:40px;height:40px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>' +
        '<div style="flex:1;min-width:0">' +
        '<p style="margin:0;font-size:14px;font-weight:600;color:#92400e">Solicitud de pago: ' + escapeHtml(req.title) + '</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#a16207">Monto: ' + formatCLP(req.amount_clp) + ' CLP - Haz clic para pagar</p>' +
        '</div>' +
        '<span style="padding:4px 10px;background:#f59e0b;color:#fff;border-radius:6px;font-size:11px;font-weight:600;flex-shrink:0">Pendiente</span>' +
        '</div>';
    });
    alertHtml += '</div>';

    // Find container in alerts page
    var container = main.querySelector(".space-y-6") || main.querySelector(".space-y-4") || main;
    var wrapper = document.createElement("div");
    wrapper.innerHTML = alertHtml;

    if (container.firstChild) {
      container.insertBefore(wrapper.firstElementChild, container.firstChild);
    } else {
      container.appendChild(wrapper.firstElementChild);
    }

    alertsInjected = true;
    console.log("[PaymentRequests] Injected " + pendingRequests.length + " alert(s) into Alertas page");
  }

  // ── Payment modal ──
  window.__prUserPay = function (requestId) {
    var req = paymentRequests.find(function (r) { return r.id === requestId; });
    if (!req) {
      console.error("[PaymentRequests] Request not found:", requestId);
      return;
    }

    var usdLine = formatUSD(req.amount_usd);
    var usdInfo = usdLine ? ' <span style="font-size:14px;color:#64748b">(' + usdLine + ')</span>' : '';

    var overlay = document.createElement("div");
    overlay.id = "pr-pay-modal";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:prFadeIn .2s ease";
    overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = '<div style="background:#fff;border-radius:20px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;animation:prSlideUp .3s ease">' +
      '<div style="padding:24px 28px;border-bottom:1px solid #e2e8f0">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
      '<h2 style="margin:0;font-size:20px;font-weight:700;color:#0f172a">Selecciona Metodo de Pago</h2>' +
      '<button onclick="document.getElementById(\'pr-pay-modal\').remove()" style="background:none;border:none;font-size:24px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button>' +
      '</div>' +
      '<p style="margin:8px 0 0;font-size:14px;color:#64748b">' + escapeHtml(req.title) + '</p>' +
      '<p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#0f172a">' + formatCLP(req.amount_clp) + ' CLP' + usdInfo + '</p>' +
      '</div>' +
      '<div style="padding:20px 28px">' +
      '<div style="display:grid;gap:12px">' +

      // WebPay
      '<div onclick="window.__prProcessPayment(\'' + escapeHtml(requestId) + '\',\'webpay\')" style="padding:16px 20px;border:2px solid #fecaca;background:#fef2f2;border-radius:14px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:14px" onmouseover="this.style.borderColor=\'#f87171\';this.style.boxShadow=\'0 4px 12px rgba(239,68,68,0.15)\'" onmouseout="this.style.borderColor=\'#fecaca\';this.style.boxShadow=\'none\'">' +
      '<div style="width:48px;height:36px;background:#E31837;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-weight:700;font-size:11px">WebPay</span></div>' +
      '<div><h4 style="margin:0;font-size:15px;font-weight:600;color:#0f172a">WebPay (Transbank)</h4><p style="margin:2px 0 0;font-size:12px;color:#64748b">Tarjeta credito o debito chilena</p></div></div>' +

      // MercadoPago
      '<div onclick="window.__prProcessPayment(\'' + escapeHtml(requestId) + '\',\'mercadopago\')" style="padding:16px 20px;border:2px solid #bae6fd;background:#f0f9ff;border-radius:14px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:14px" onmouseover="this.style.borderColor=\'#38bdf8\';this.style.boxShadow=\'0 4px 12px rgba(56,189,248,0.15)\'" onmouseout="this.style.borderColor=\'#bae6fd\';this.style.boxShadow=\'none\'">' +
      '<div style="width:48px;height:36px;background:#00B1EA;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-weight:700;font-size:8px">MercadoPago</span></div>' +
      '<div><h4 style="margin:0;font-size:15px;font-weight:600;color:#0f172a">MercadoPago</h4><p style="margin:2px 0 0;font-size:12px;color:#64748b">Cuenta MercadoPago o tarjeta</p></div></div>' +

      // PayPal
      '<div onclick="window.__prProcessPayment(\'' + escapeHtml(requestId) + '\',\'paypal\')" style="padding:16px 20px;border:2px solid #bfdbfe;background:#eff6ff;border-radius:14px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:14px" onmouseover="this.style.borderColor=\'#60a5fa\';this.style.boxShadow=\'0 4px 12px rgba(96,165,250,0.15)\'" onmouseout="this.style.borderColor=\'#bfdbfe\';this.style.boxShadow=\'none\'">' +
      '<div style="width:48px;height:36px;background:#003087;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-weight:700;font-size:10px">PayPal</span></div>' +
      '<div><h4 style="margin:0;font-size:15px;font-weight:600;color:#0f172a">PayPal</h4><p style="margin:2px 0 0;font-size:12px;color:#64748b">Pago internacional en USD</p></div></div>' +

      '</div>' +
      '<button onclick="document.getElementById(\'pr-pay-modal\').remove()" style="width:100%;margin-top:16px;padding:12px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer">Cancelar</button>' +
      '</div></div>';

    document.body.appendChild(overlay);
  };

  // ── Process payment with selected gateway ──
  window.__prProcessPayment = async function (requestId, method) {
    var req = paymentRequests.find(function (r) { return r.id === requestId; });
    if (!req) return;

    // Close the modal
    var modal = document.getElementById("pr-pay-modal");
    if (modal) modal.remove();

    var userInfo = getUserData() || {};
    var userEmail = getUserEmail();
    var userName = getUserName();

    if (method === "webpay") {
      await processWebPayPayment(req, userEmail, userName, userInfo);
    } else if (method === "mercadopago") {
      await processMercadoPagoPayment(req, userEmail, userName, userInfo);
    } else if (method === "paypal") {
      await processPayPalPayment(req, userEmail, userName, userInfo);
    }
  };

  // ── Show/hide loading overlay ──
  function showLoading(msg) {
    hideLoading();
    var overlay = document.createElement("div");
    overlay.id = "pr-loading-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999";
    overlay.innerHTML = '<div style="background:#fff;padding:30px 50px;border-radius:16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3)">' +
      '<div style="width:50px;height:50px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:prSpin 1s linear infinite;margin:0 auto 20px"></div>' +
      '<p style="font-size:18px;font-weight:600;color:#1e293b;margin:0">' + escapeHtml(msg) + '</p>' +
      '<p style="font-size:14px;color:#64748b;margin-top:10px">Por favor espere...</p></div>';
    document.body.appendChild(overlay);
  }

  function hideLoading() {
    var el = document.getElementById("pr-loading-overlay");
    if (el) el.remove();
  }

  // ── WebPay payment ──
  async function processWebPayPayment(req, userEmail, userName, userInfo) {
    try {
      showLoading("Conectando con WebPay...");
      var buyOrder = "ORD_PR_" + Date.now();
      var sessionId = "pr_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      var response = await fetch(PAYMENT_API_BASE + "/webpay.php?action=create_transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: req.amount_clp,
          session_id: sessionId,
          buy_order: buyOrder,
          user_email: userEmail,
          payer_name: userName,
          payer_phone: userInfo.phone || "",
          country: "Chile",
          plan_name: req.title,
          description: req.description || req.title,
          type: "payment_request",
          payment_request_id: req.id,
          return_url: window.location.origin + "/api/webpay.php?action=callback"
        })
      });
      var data = await response.json();
      hideLoading();
      if (data.success && data.url && data.token) {
        var form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;
        form.style.display = "none";
        var tokenInput = document.createElement("input");
        tokenInput.type = "hidden";
        tokenInput.name = "token_ws";
        tokenInput.value = data.token;
        form.appendChild(tokenInput);
        document.body.appendChild(form);
        form.submit();
      } else {
        alert("Error al procesar con WebPay: " + (data.error || data.message || "Error desconocido"));
      }
    } catch (error) {
      hideLoading();
      console.error("[PaymentRequests] WebPay error:", error);
      alert("Error al conectar con WebPay. Por favor intente nuevamente.");
    }
  }

  // ── MercadoPago payment ──
  async function processMercadoPagoPayment(req, userEmail, userName, userInfo) {
    try {
      showLoading("Procesando con MercadoPago...");
      var response = await fetch(PAYMENT_API_BASE + "/mercadopago.php?action=create_preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: req.amount_clp,
          description: req.title + (req.description ? " - " + req.description : ""),
          plan_name: req.title,
          payer_email: userEmail,
          payer_name: userName,
          payer_phone: userInfo.phone || "",
          country: "Chile",
          payment_request_id: req.id
        })
      });
      var data = await response.json();
      hideLoading();
      if (data.success && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert("Error al procesar con MercadoPago: " + (data.error || data.message || "Error desconocido"));
      }
    } catch (error) {
      hideLoading();
      console.error("[PaymentRequests] MercadoPago error:", error);
      alert("Error al conectar con MercadoPago. Por favor intente nuevamente.");
    }
  }

  // ── PayPal payment ──
  async function processPayPalPayment(req, userEmail, userName, userInfo) {
    try {
      var amountUSD = req.amount_usd;
      if (!amountUSD || amountUSD <= 0) {
        // Convert CLP to USD approximately if not provided
        amountUSD = Math.ceil(req.amount_clp / 950);
      }
      showLoading("Procesando con PayPal...");
      var response = await fetch(PAYMENT_API_BASE + "/paypal.php?action=create_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountUSD,
          description: req.title + (req.description ? " - " + req.description : ""),
          plan_name: req.title,
          currency: "USD",
          payer_email: userEmail,
          payer_name: userName,
          payer_phone: userInfo.phone || "",
          country: "Chile",
          payment_request_id: req.id
        })
      });
      var data = await response.json();
      hideLoading();
      if (data.success && data.order_id) {
        var approvalUrl = data.approval_url ||
          (data.links && data.links.find(function (l) { return l.rel === "approve"; }) || {}).href ||
          "https://www.paypal.com/checkoutnow?token=" + data.order_id;
        window.location.href = approvalUrl;
      } else {
        alert("Error al procesar con PayPal: " + (data.error || data.message || "Error desconocido"));
      }
    } catch (error) {
      hideLoading();
      console.error("[PaymentRequests] PayPal error:", error);
      alert("Error al conectar con PayPal. Por favor intente nuevamente.");
    }
  }

  // ── Add CSS animations ──
  function addStyles() {
    if (document.getElementById("pr-user-styles")) return;
    var style = document.createElement("style");
    style.id = "pr-user-styles";
    style.textContent =
      "@keyframes prFadeIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes prSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes prSpin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }

  // ── Main check loop ──
  function runChecks() {
    injectPaymentRequests();
    injectAlertNotifications();
  }

  function init() {
    addStyles();
    runChecks();
    var obs = new MutationObserver(function () {
      clearTimeout(window.__prCheckTimer);
      window.__prCheckTimer = setTimeout(runChecks, 400);
    });
    var root = document.getElementById("root") || document.body;
    obs.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }

  console.log("[PaymentRequests] User payment requests enhancer loaded");
})();
