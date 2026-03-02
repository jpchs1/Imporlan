/**
 * Payment Override for Imporlan Panel (TEST environment)
 * Intercepts demo payment functions and redirects to real API calls.
 * Uses click interception (capturing phase) to DIRECTLY handle WebPay
 * payments, bypassing React's handler entirely. This avoids all timing
 * issues with alert overrides and modal closures.
 */

(function() {
  'use strict';

  var API_BASE = 'https://www.imporlan.cl/test/api';
  var _webpayProcessing = false;

  function extractBoatLinksFromPage() {
    var links = [];
    var inputs = document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])');
    inputs.forEach(function(input) {
      var val = (input.value || '').trim();
      var ph = (input.placeholder || '').toLowerCase();
      if (val && (val.match(/^https?:\/\//i) || ph.includes('boattrader') || ph.includes('yacht') || ph.includes('boats.com'))) {
        links.push(val);
      }
    });
    if (links.length > 0) {
      try { sessionStorage.setItem('imporlan_boat_links', JSON.stringify(links)); } catch(e) {}
    }
    if (links.length === 0) {
      try {
        var stored = sessionStorage.getItem('imporlan_boat_links');
        if (stored) links = JSON.parse(stored);
      } catch(e) {}
    }
    return links;
  }

  function extractUserInfo() {
    var info = { email: '', name: '', phone: '' };

    // Try multiple localStorage keys where user data may be stored
    var keys = ['imporlan_user', 'user', 'userData', 'imporlan_userData'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (raw) {
          var u = JSON.parse(raw);
          if (!info.email) info.email = u.email || u.user_email || u.correo || '';
          if (!info.name) info.name = u.name || u.full_name || u.nombre || u.firstName || '';
          if (!info.phone) info.phone = u.phone || u.telefono || u.tel || '';
        }
      } catch(e) {}
    }

    // Fallback: try to decode JWT token for email/name
    if (!info.email) {
      try {
        var token = localStorage.getItem('token') || localStorage.getItem('imporlan_token') || '';
        if (token) {
          var parts = token.split('.');
          if (parts.length === 3) {
            var payload = JSON.parse(atob(parts[1]));
            if (!info.email) info.email = payload.email || payload.sub || '';
            if (!info.name) info.name = payload.name || payload.user_name || '';
          }
        }
      } catch(e) {}
    }

    // Fallback: try sessionStorage
    if (!info.email) {
      try {
        var sessRaw = sessionStorage.getItem('imporlan_user') || sessionStorage.getItem('user');
        if (sessRaw) {
          var su = JSON.parse(sessRaw);
          if (!info.email) info.email = su.email || su.user_email || '';
          if (!info.name) info.name = su.name || su.full_name || '';
          if (!info.phone) info.phone = su.phone || su.telefono || '';
        }
      } catch(e) {}
    }

    // Fallback: try to find email in the DOM (some pages display user email)
    if (!info.email) {
      try {
        var emailEls = document.querySelectorAll('[data-user-email], .user-email, .profile-email');
        for (var j = 0; j < emailEls.length; j++) {
          var val = (emailEls[j].getAttribute('data-user-email') || emailEls[j].textContent || '').trim();
          if (val && val.indexOf('@') !== -1) { info.email = val; break; }
        }
      } catch(e) {}
    }

    return info;
  }

  var originalAlert = window.alert;

  function isWebPaySelected(modal) {
    var texts = modal.querySelectorAll('h3, span, div, p, label');
    for (var i = 0; i < texts.length; i++) {
      var el = texts[i];
      var text = (el.textContent || '').trim();
      if (text === 'WebPay' || text === 'Tarjeta') {
        var container = el.closest('[class*="border-red"], [class*="bg-red"], [class*="ring-red"], [class*="border-indigo"], [class*="bg-indigo"], [class*="ring-indigo"]');
        if (container) return true;
        var parent = el.parentElement;
        while (parent && parent !== modal) {
          var cls = parent.className || '';
          if (typeof cls === 'string' && (
            cls.indexOf('border-red') !== -1 || cls.indexOf('bg-red') !== -1 || cls.indexOf('ring') !== -1 ||
            cls.indexOf('border-indigo') !== -1 || cls.indexOf('bg-indigo') !== -1
          )) {
            return true;
          }
          parent = parent.parentElement;
        }
      }
    }
    var checked = modal.querySelectorAll('input[type="radio"]:checked, [data-state="checked"], [aria-checked="true"]');
    for (var j = 0; j < checked.length; j++) {
      var radio = checked[j];
      var radioParent = radio.closest('[role="dialog"] > div, [role="dialog"] div');
      if (radioParent) {
        var txt = radioParent.textContent || '';
        if (txt.indexOf('WebPay') !== -1 || txt.indexOf('Tarjeta') !== -1) {
          return true;
        }
      }
    }
    var allOptions = modal.querySelectorAll('[class*="cursor-pointer"], [role="option"], [role="radio"]');
    for (var k = 0; k < allOptions.length; k++) {
      var opt = allOptions[k];
      var optText = opt.textContent || '';
      if (optText.indexOf('WebPay') !== -1 || optText.indexOf('Tarjeta') !== -1) {
        var cls2 = opt.className || '';
        if (typeof cls2 === 'string' && (cls2.indexOf('border-red') !== -1 || cls2.indexOf('selected') !== -1 || cls2.indexOf('ring') !== -1 || cls2.indexOf('border-indigo') !== -1)) {
          return true;
        }
      }
    }
    return false;
  }

  function extractPaymentData(modal) {
    var modalText = modal.textContent || '';
    var amountMatch = modalText.match(/\$\s*([\d.,]+)\s*CLP/i);
    if (!amountMatch) {
      amountMatch = modalText.match(/([\d.,]+)\s*CLP/i);
    }
    if (!amountMatch) return null;
    var rawAmount = amountMatch[1].replace(/[^0-9]/g, '');
    var amount = parseInt(rawAmount, 10);
    if (isNaN(amount) || amount <= 0) return null;
    var descMatch = modalText.match(/por\s+(.+?)(?:\s*(?:MercadoPago|PayPal|WebPay|Tarjeta|Selecciona|Cancelar|Pagar))/i);
    var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
    return { amount: amount, description: description };
  }

  function replaceWebPayLabelWithTarjeta(modal) {
    try {
      var els = modal.querySelectorAll('h3, span, div, p, label');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var t = (el.textContent || '').trim();
        if (!t) continue;

        if (t === 'WebPay') {
          el.textContent = 'Tarjeta';
        } else if (t.indexOf('WebPay') !== -1 && t.length <= 40) {
          // E.g. "WebPay (Transbank)" -> "Tarjeta (Transbank)"
          el.textContent = t.replace('WebPay', 'Tarjeta');
        }
      }
    } catch (e) {}
  }

  function ensureTarjetaLabel() {
    var modal = document.querySelector('[role="dialog"]');
    if (!modal) return;
    replaceWebPayLabelWithTarjeta(modal);
  }

  try {
    var _tarjetaObs = new MutationObserver(function () {
      ensureTarjetaLabel();
    });
    _tarjetaObs.observe(document.body, { childList: true, subtree: true });
    setTimeout(ensureTarjetaLabel, 800);
  } catch (e) {}

  document.addEventListener('click', function(e) {
    var btn = e.target && (e.target.closest ? e.target.closest('button') : null);
    if (!btn) return;
    var btnText = (btn.textContent || '').trim();
    if (btnText.indexOf('Pagar Ahora') === -1 && btnText.indexOf('Pagar ahora') === -1) return;

    var modal = (btn.closest ? btn.closest('[role="dialog"]') : null) || document.querySelector('[role="dialog"]');
    if (!modal) return;

    if (!isWebPaySelected(modal)) {
      console.log('WebPay override: Not WebPay selected, letting React handle');
      return;
    }

    if (_webpayProcessing) {
      console.log('WebPay: Already processing');
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }

    var paymentData = extractPaymentData(modal);
    if (!paymentData) {
      console.error('WebPay: Could not extract payment data from modal');
      return;
    }

    console.log('WebPay: Intercepted click, processing payment directly:', paymentData);
    e.stopImmediatePropagation();
    e.preventDefault();

    processRealWebPay(paymentData.amount, paymentData.description);
  }, true);

  window.alert = function(message) {
    if (!message || typeof message !== 'string') {
      return originalAlert.apply(this, arguments);
    }
    var msgLower = message.toLowerCase();

    if (msgLower.indexOf('proximamente') !== -1 || msgLower.indexOf('pr\u00f3ximamente') !== -1 ||
        msgLower.indexOf('configurar la api') !== -1 || msgLower.indexOf('requiere configuracion') !== -1 ||
        (msgLower.indexOf('webpay') !== -1 && msgLower.indexOf('transbank') !== -1) ||
        (msgLower.indexOf('webpay') !== -1 && msgLower.indexOf('disponible') !== -1)) {
      console.log('WebPay: Blocked demo alert');
      return;
    }

    if (msgLower.indexOf('esta es una demo') !== -1 || msgLower.indexOf('en produccion se integrara') !== -1) {
      console.log('Intercepted demo alert');
      return;
    }

    return originalAlert.apply(this, arguments);
  };

  async function processRealWebPay(amount, description) {
    if (_webpayProcessing) return;
    _webpayProcessing = true;

    try {
      showLoadingOverlay('Conectando con WebPay...');

      var userInfo = extractUserInfo();
      var userEmail = userInfo.email;
      var userName = userInfo.name;
      var boatLinks = extractBoatLinksFromPage();

      var buyOrder = 'ORD_' + Date.now();
      var sessionId = 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      var purchaseType = 'link';
      var planName = description;
      var planDays = 7;
      if (description.toLowerCase().indexOf('fragata') !== -1 || amount >= 60000) {
        purchaseType = 'plan';
        planName = 'Plan Fragata';
      } else if (description.toLowerCase().indexOf('capitan') !== -1 || amount >= 25000) {
        purchaseType = 'plan';
        planName = 'Plan Capitan';
        planDays = 14;
      }

      console.log('WebPay: boat_links extracted:', boatLinks);

      sessionStorage.setItem('webpay_order', JSON.stringify({
        buy_order: buyOrder,
        user_email: userEmail,
        purchase_type: purchaseType,
        purchase_description: description,
        amount_clp: amount,
        plan_name: planName,
        boat_links: boatLinks
      }));

      console.log('WebPay: Creating transaction...', { amount: amount, buyOrder: buyOrder });

      var response = await fetch(API_BASE + '/webpay.php?action=create_transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          session_id: sessionId,
          buy_order: buyOrder,
          user_email: userEmail,
          payer_name: userName,
          payer_phone: userInfo.phone,
          country: 'Chile',
          boat_links: boatLinks,
          plan_name: planName,
          description: description,
          type: purchaseType,
          days: planDays,
          return_url: window.location.origin + '/test/api/webpay.php?action=callback'
        })
      });

      var data = await response.json();
      console.log('WebPay: API response:', data);
      hideLoadingOverlay();

      if (data.success && data.url && data.token) {
        console.log('WebPay: Redirecting to Transbank...');
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = data.url;
        form.style.display = 'none';
        var tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'token_ws';
        tokenInput.value = data.token;
        form.appendChild(tokenInput);
        document.body.appendChild(form);
        form.submit();
      } else {
        var errorMsg = data.error || data.message || 'Error desconocido';
        console.error('WebPay: Transaction failed:', errorMsg);
        _webpayProcessing = false;
        originalAlert('Error al procesar el pago con WebPay: ' + errorMsg);
      }
    } catch (error) {
      hideLoadingOverlay();
      _webpayProcessing = false;
      console.error('WebPay: Connection error:', error);
      originalAlert('Error al conectar con WebPay. Por favor intente nuevamente.');
    }
  }

  var originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
      if (url.indexOf('mercadopago.cl') !== -1 && (url.indexOf('pref_id=demo') !== -1 || url.indexOf('redirect') !== -1)) {
        console.log('Intercepted MercadoPago demo URL');
        var urlParams = new URLSearchParams(url.split('?')[1]);
        processRealMercadoPago(urlParams.get('amount'), urlParams.get('description'));
        return null;
      }
      if (url.indexOf('paypal.com') !== -1 && url.indexOf('token=demo') !== -1) {
        console.log('Intercepted PayPal demo URL');
        var urlParams2 = new URLSearchParams(url.split('?')[1]);
        var paypalAmount = urlParams2.get('amount');
        if (paypalAmount && !isNaN(parseFloat(paypalAmount)) && parseFloat(paypalAmount) > 0) {
          processRealPayPal(paypalAmount, 'Pago Imporlan');
        } else {
          originalAlert('Error: Monto de pago invalido.');
        }
        return null;
      }
    }
    return originalOpen.apply(this, arguments);
  };

  async function processRealMercadoPago(amount, description) {
    try {
      var userInfo = extractUserInfo();
      var boatLinks = extractBoatLinksFromPage();
      console.log('Processing MercadoPago payment:', { amount: amount, description: description, boatLinks: boatLinks });

      showLoadingOverlay('Procesando pago con MercadoPago...');
      var response = await fetch(API_BASE + '/mercadopago.php?action=create_preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(amount),
          description: decodeURIComponent(description || 'Pago Imporlan'),
          plan_name: decodeURIComponent(description || 'Pago Imporlan'),
          payer_email: userInfo.email,
          payer_name: userInfo.name,
          payer_phone: userInfo.phone,
          country: 'Chile',
          boat_links: boatLinks
        })
      });
      var data = await response.json();
      hideLoadingOverlay();
      if (data.success && data.init_point) {
        window.location.href = data.init_point;
      } else {
        originalAlert('Error al procesar el pago con MercadoPago. Por favor intente nuevamente.');
      }
    } catch (error) {
      hideLoadingOverlay();
      originalAlert('Error al conectar con MercadoPago. Por favor intente nuevamente.');
    }
  }

  async function processRealPayPal(amountUSD, description) {
    try {
      var parsedAmount = parseFloat(amountUSD);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        originalAlert('Error: Monto de pago invalido.');
        return;
      }
      showLoadingOverlay('Procesando pago con PayPal...');

      var userInfo = extractUserInfo();
      var boatLinks = extractBoatLinksFromPage();
      console.log('PayPal: boat_links extracted:', boatLinks);

      var response = await fetch(API_BASE + '/paypal.php?action=create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          description: description || 'Pago Imporlan',
          plan_name: description || 'Pago Imporlan',
          currency: 'USD',
          payer_email: userInfo.email,
          payer_name: userInfo.name,
          payer_phone: userInfo.phone,
          country: 'Chile',
          boat_links: boatLinks
        })
      });
      var data = await response.json();
      hideLoadingOverlay();
      if (data.success && data.order_id) {
        var approvalUrl = data.approval_url ||
          (data.links && data.links.find(function(l) { return l.rel === 'approve'; }) && data.links.find(function(l) { return l.rel === 'approve'; }).href) ||
          'https://www.paypal.com/checkoutnow?token=' + data.order_id;
        window.location.href = approvalUrl;
      } else {
        var errorMsg = data.error || data.message || 'Error desconocido';
        originalAlert('Error al procesar el pago con PayPal: ' + errorMsg);
      }
    } catch (error) {
      hideLoadingOverlay();
      originalAlert('Error al conectar con PayPal. Por favor intente nuevamente.');
    }
  }

  function showLoadingOverlay(message) {
    hideLoadingOverlay();
    var overlay = document.createElement('div');
    overlay.id = 'payment-loading-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = '<div style="background:white;padding:30px 50px;border-radius:16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
      '<div style="width:50px;height:50px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>' +
      '<p style="font-size:18px;font-weight:600;color:#1e293b;margin:0;">' + message + '</p>' +
      '<p style="font-size:14px;color:#64748b;margin-top:10px;">Por favor espere...</p>' +
      '</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);
  }

  function hideLoadingOverlay() {
    var overlay = document.getElementById('payment-loading-overlay');
    if (overlay) overlay.remove();
  }

  console.log('Payment override loaded - click interception + alert override active');
})();
