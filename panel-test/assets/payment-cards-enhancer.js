/**
 * Payment Cards Enhancer - Imporlan Panel
 * Makes the WebPay, MercadoPago, PayPal cards in the Pagos section
 * clickable, redirecting to /pago/ with pre-filled payment method.
 */
(function () {
  "use strict";

  var enhanced = false;
  var checkInterval = null;

  function getUserData() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
      var raw2 = localStorage.getItem("user");
      if (raw2) return JSON.parse(raw2);
    } catch (e) {}
    return null;
  }

  function isPaymentsPage() {
    return window.location.hash === "#payments" || window.location.hash === "#/payments";
  }

  function enhancePaymentCards() {
    if (!isPaymentsPage()) {
      enhanced = false;
      return;
    }
    if (enhanced) return;

    // Find the 3 payment method cards (WebPay, MercadoPago, PayPal)
    var cards = document.querySelectorAll('[class*="grid-cols-3"] > [class*="rounded-xl"][class*="border-2"][class*="cursor-pointer"]');
    if (cards.length < 3) return;

    // Identify each card by its content
    cards.forEach(function (card) {
      var text = card.textContent || "";
      var method = null;

      if (text.indexOf("WebPay") !== -1 && text.indexOf("Transbank") !== -1) {
        method = "webpay";
      } else if (text.indexOf("MercadoPago") !== -1) {
        method = "mercadopago";
      } else if (text.indexOf("PayPal") !== -1 && text.indexOf("Internacional") !== -1) {
        method = "paypal";
      }

      if (method && !card.getAttribute("data-payment-enhanced")) {
        card.setAttribute("data-payment-enhanced", "1");
        card.style.position = "relative";

        card.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          showQuickPayModal(method);
        });
      }
    });

    // Also enhance the "Realizar Pago" button to go to /pago/
    var realizarBtn = document.querySelector('button');
    var allButtons = document.querySelectorAll('button');
    allButtons.forEach(function (btn) {
      var txt = (btn.textContent || "").trim();
      if (txt.indexOf("Realizar Pago") !== -1 && !btn.getAttribute("data-pago-enhanced")) {
        btn.setAttribute("data-pago-enhanced", "1");
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          showQuickPayModal("webpay");
        });
      }
    });

    // Enhance "Actualizar Tarjeta" link
    var editBtns = document.querySelectorAll('button');
    editBtns.forEach(function (btn) {
      var txt = (btn.textContent || "").trim();
      if ((txt.indexOf("Editar") !== -1 || txt.indexOf("Agregar otra") !== -1) && btn.closest('[class*="from-slate-800"]')) {
        if (!btn.getAttribute("data-pago-enhanced")) {
          btn.setAttribute("data-pago-enhanced", "1");
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.open("/pago/", "_blank");
          });
        }
      }
    });

    enhanced = true;
  }

  function showQuickPayModal(defaultMethod) {
    var existing = document.getElementById("pce-quick-pay-modal");
    if (existing) existing.remove();

    var user = getUserData();
    var userName = user ? (user.name || user.user_name || "") : "";
    var userEmail = user ? (user.email || user.user_email || "") : "";

    var overlay = document.createElement("div");
    overlay.id = "pce-quick-pay-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:pceFadeIn .2s";

    var methods = [
      { id: "webpay", name: "WebPay (Transbank)", desc: "Tarjeta credito o debito chilena", color: "#E31837", border: "#fecaca", bg: "#fef2f2" },
      { id: "mercadopago", name: "MercadoPago", desc: "Cuenta MercadoPago o tarjeta", color: "#00B1EA", border: "#bae6fd", bg: "#f0f9ff" },
      { id: "paypal", name: "PayPal (USD)", desc: "Pago internacional con PayPal", color: "#003087", border: "#bfdbfe", bg: "#eff6ff" },
      { id: "transferencia", name: "Transferencia Bancaria", desc: "Transferencia directa", color: "#059669", border: "#a7f3d0", bg: "#ecfdf5" },
    ];

    var methodsHtml = methods.map(function (m) {
      var selected = m.id === defaultMethod;
      return '<div class="pce-method-card" data-method="' + m.id + '" style="padding:14px 18px;border-radius:12px;border:2px solid ' + (selected ? m.color : "#e2e8f0") + ';background:' + (selected ? m.bg : "#fff") + ';cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px">' +
        '<div style="width:44px;height:30px;background:' + m.color + ';border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:#fff;font-size:10px;font-weight:700">' + m.id.substring(0, 3).toUpperCase() + '</span></div>' +
        '<div style="flex:1"><p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">' + m.name + '</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#64748b">' + m.desc + '</p></div>' +
        '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (selected ? m.color : '#cbd5e1') + ';display:flex;align-items:center;justify-content:center">' +
        (selected ? '<div style="width:12px;height:12px;border-radius:50%;background:' + m.color + '"></div>' : '') + '</div></div>';
    }).join("");

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,.25);overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;display:flex;align-items:center;justify-content:space-between">' +
      '<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;background:rgba(255,255,255,.1);border-radius:10px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>' +
      '<div><h3 style="margin:0;font-size:16px;font-weight:700;color:#fff">Realizar Pago</h3>' +
      '<p style="margin:2px 0 0;font-size:12px;color:#94a3b8">Selecciona metodo e ingresa el monto</p></div></div>' +
      '<button id="pce-close" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center">&times;</button></div>' +

      '<div style="padding:20px 24px">' +
      '<div style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Monto (CLP)</label>' +
      '<input id="pce-amount" type="text" placeholder="Ej: 150.000" style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:18px;font-weight:700;color:#1e293b;outline:none;transition:border-color .2s;box-sizing:border-box" inputmode="numeric"></div>' +

      '<div style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Concepto</label>' +
      '<input id="pce-concept" type="text" placeholder="Ej: Pago inspeccion, Anticipo embarcacion..." style="width:100%;padding:10px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s;box-sizing:border-box"></div>' +

      '<div style="margin-bottom:16px"><label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Metodo de Pago</label>' +
      '<div style="display:flex;flex-direction:column;gap:8px" id="pce-methods">' + methodsHtml + '</div></div>' +

      '<button id="pce-pay-btn" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(8,145,178,.35);transition:all .2s">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pagar Ahora</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    // Add animation style
    if (!document.getElementById("pce-styles")) {
      var st = document.createElement("style");
      st.id = "pce-styles";
      st.textContent = "@keyframes pceFadeIn{from{opacity:0}to{opacity:1}}";
      document.head.appendChild(st);
    }

    var selectedMethod = defaultMethod;

    // Format amount with dots
    var amountInput = document.getElementById("pce-amount");
    amountInput.addEventListener("input", function () {
      var raw = this.value.replace(/\D/g, "");
      this.value = raw ? parseInt(raw).toLocaleString("es-CL") : "";
    });
    amountInput.focus();

    // Method selection
    document.querySelectorAll(".pce-method-card").forEach(function (card) {
      card.addEventListener("click", function () {
        selectedMethod = this.getAttribute("data-method");
        // Update selection UI
        document.querySelectorAll(".pce-method-card").forEach(function (c) {
          var m = methods.find(function (x) { return x.id === c.getAttribute("data-method"); });
          var sel = c.getAttribute("data-method") === selectedMethod;
          c.style.borderColor = sel ? m.color : "#e2e8f0";
          c.style.background = sel ? m.bg : "#fff";
          var dot = c.querySelector("div:last-child");
          dot.style.borderColor = sel ? m.color : "#cbd5e1";
          dot.innerHTML = sel ? '<div style="width:12px;height:12px;border-radius:50%;background:' + m.color + '"></div>' : "";
        });
      });
    });

    // Close
    document.getElementById("pce-close").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    // Pay button
    document.getElementById("pce-pay-btn").addEventListener("click", function () {
      var rawAmount = (amountInput.value || "").replace(/\D/g, "");
      var amount = parseInt(rawAmount);
      var concept = (document.getElementById("pce-concept").value || "").trim() || "Pago Imporlan";

      if (!amount || amount < 1000) {
        amountInput.style.borderColor = "#ef4444";
        amountInput.setAttribute("placeholder", "Ingresa un monto valido (min $1.000)");
        return;
      }

      overlay.remove();
      processDirectPayment(selectedMethod, amount, concept, userName, userEmail);
    });
  }

  function processDirectPayment(method, amount, concept, name, email) {
    var API_BASE = "/api";

    if (method === "webpay") {
      showPaymentLoading("Conectando con WebPay...");
      var buyOrder = "PAGO_" + Date.now();
      fetch(API_BASE + "/webpay.php?action=create_transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          buy_order: buyOrder,
          session_id: "pago_" + Date.now(),
          user_email: email,
          payer_name: name,
          plan_name: concept,
          description: concept,
          type: "pago_directo",
          source: "panel_pagos"
        })
      }).then(function (r) { return r.json(); }).then(function (data) {
        hidePaymentLoading();
        if (data.success && data.url && data.token) {
          var form = document.createElement("form");
          form.method = "POST";
          form.action = data.url;
          form.style.display = "none";
          var input = document.createElement("input");
          input.type = "hidden"; input.name = "token_ws"; input.value = data.token;
          form.appendChild(input);
          document.body.appendChild(form);
          form.submit();
        } else {
          alert("Error: " + (data.error || "No se pudo conectar con WebPay"));
        }
      }).catch(function () { hidePaymentLoading(); alert("Error de conexion con WebPay"); });

    } else if (method === "mercadopago") {
      showPaymentLoading("Conectando con MercadoPago...");
      fetch(API_BASE + "/mercadopago.php?action=create_preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          description: concept,
          plan_name: concept,
          payer_email: email,
          payer_name: name,
          quantity: 1,
          type: "pago_directo",
          source: "panel_pagos"
        })
      }).then(function (r) { return r.json(); }).then(function (data) {
        hidePaymentLoading();
        if (data.success && data.init_point) {
          window.location.href = data.init_point;
        } else {
          alert("Error: " + (data.error || "No se pudo conectar con MercadoPago"));
        }
      }).catch(function () { hidePaymentLoading(); alert("Error de conexion con MercadoPago"); });

    } else if (method === "paypal") {
      showPaymentLoading("Conectando con PayPal...");
      var amountUSD = Math.ceil(amount / 950);
      fetch(API_BASE + "/paypal.php?action=create_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountUSD,
          description: concept,
          plan_name: concept,
          currency: "USD",
          payer_email: email,
          payer_name: name,
          type: "pago_directo",
          source: "panel_pagos"
        })
      }).then(function (r) { return r.json(); }).then(function (data) {
        hidePaymentLoading();
        if (data.success && data.order_id) {
          var approvalUrl = "https://www.paypal.com/checkoutnow?token=" + data.order_id;
          window.location.href = approvalUrl;
        } else {
          alert("Error: " + (data.error || "No se pudo conectar con PayPal"));
        }
      }).catch(function () { hidePaymentLoading(); alert("Error de conexion con PayPal"); });

    } else if (method === "transferencia") {
      showTransferInfo(amount, concept);
    }
  }

  function showPaymentLoading(msg) {
    var el = document.createElement("div");
    el.id = "pce-loading";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)";
    el.innerHTML = '<div style="background:#fff;border-radius:16px;padding:32px 40px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
      '<div style="width:48px;height:48px;border:4px solid #e2e8f0;border-top-color:#0891b2;border-radius:50%;margin:0 auto 16px;animation:pceSpin 1s linear infinite"></div>' +
      '<p style="margin:0;font-size:15px;font-weight:600;color:#1e293b">' + msg + '</p></div>';
    if (!document.getElementById("pce-spin-style")) {
      var st = document.createElement("style"); st.id = "pce-spin-style";
      st.textContent = "@keyframes pceSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
      document.head.appendChild(st);
    }
    document.body.appendChild(el);
  }

  function hidePaymentLoading() {
    var el = document.getElementById("pce-loading");
    if (el) el.remove();
  }

  function showTransferInfo(amount, concept) {
    var existing = document.getElementById("pce-transfer-modal");
    if (existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "pce-transfer-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)";
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:420px;padding:28px;box-shadow:0 25px 60px rgba(0,0,0,.25)">' +
      '<div style="text-align:center;margin-bottom:20px"><div style="width:56px;height:56px;background:linear-gradient(135deg,#059669,#10b981);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>' +
      '<h3 style="margin:0;font-size:18px;font-weight:700;color:#1e293b">Transferencia Bancaria</h3></div>' +
      '<div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="color:#64748b;font-size:13px">Banco</span><span style="color:#1e293b;font-weight:600;font-size:13px">Banco Estado</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="color:#64748b;font-size:13px">Tipo Cuenta</span><span style="color:#1e293b;font-weight:600;font-size:13px">Cuenta Corriente</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="color:#64748b;font-size:13px">N° Cuenta</span><span style="color:#1e293b;font-weight:600;font-size:13px">Por confirmar</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="color:#64748b;font-size:13px">RUT</span><span style="color:#1e293b;font-weight:600;font-size:13px">Por confirmar</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0"><span style="color:#64748b;font-size:13px">Email</span><span style="color:#1e293b;font-weight:600;font-size:13px">contacto@imporlan.cl</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:#64748b;font-size:13px">Monto</span><span style="color:#059669;font-weight:700;font-size:15px">$' + amount.toLocaleString("es-CL") + ' CLP</span></div></div>' +
      '<p style="margin:0 0 16px;font-size:12px;color:#64748b;text-align:center">Envia el comprobante a <strong>contacto@imporlan.cl</strong> o por WhatsApp</p>' +
      '<div style="display:flex;gap:8px">' +
      '<a href="https://wa.me/56940211459?text=' + encodeURIComponent("Hola, realice una transferencia por $" + amount.toLocaleString("es-CL") + " CLP por concepto de: " + concept) + '" target="_blank" rel="noopener" style="flex:1;padding:12px;border-radius:10px;background:#25d366;color:#fff;font-size:13px;font-weight:600;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px">WhatsApp</a>' +
      '<button id="pce-close-transfer" style="flex:1;padding:12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer">Cerrar</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById("pce-close-transfer").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  }

  // Start monitoring
  function startMonitoring() {
    checkInterval = setInterval(function () {
      if (isPaymentsPage()) {
        enhancePaymentCards();
      } else {
        enhanced = false;
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(startMonitoring, 1500); });
  } else {
    setTimeout(startMonitoring, 1500);
  }
})();
