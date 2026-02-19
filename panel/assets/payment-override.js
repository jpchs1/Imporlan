/**
 * Payment Override for Imporlan Panel
 * Intercepts demo payment functions and redirects to real API calls.
 * Uses click interception (capturing phase) to capture payment data
 * BEFORE React's handler fires, solving the timing issue where
 * React closes the modal before async code can read it.
 */

(function() {
  'use strict';

  var API_BASE = 'https://www.imporlan.cl/api';
  var _pendingPaymentData = null;
  var _webpayProcessing = false;

  var originalAlert = window.alert;

  document.addEventListener('click', function(e) {
    var btn = e.target && (e.target.closest ? e.target.closest('button') : null);
    if (!btn) return;
    var btnText = (btn.textContent || '').trim();
    if (btnText.indexOf('Pagar Ahora') === -1 && btnText.indexOf('Pagar ahora') === -1) return;

    var modal = (btn.closest ? btn.closest('[role="dialog"]') : null) || document.querySelector('[role="dialog"]');
    if (!modal) return;

    var modalText = modal.textContent || '';
    var amountMatch = modalText.match(/\$\s*([\d.,]+)\s*CLP/i);
    if (!amountMatch) {
      amountMatch = modalText.match(/([\d.,]+)\s*CLP/i);
    }
    if (!amountMatch) return;

    var rawAmount = amountMatch[1].replace(/[.\s]/g, '').replace(',', '.');
    var amount = parseInt(rawAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    var descMatch = modalText.match(/por\s+(.+?)(?:\s*(?:MercadoPago|PayPal|WebPay|Selecciona|Cancelar|Pagar))/i);
    var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';

    _pendingPaymentData = { amount: amount, description: description, ts: Date.now() };
    console.log('WebPay: Pre-captured payment data from modal:', _pendingPaymentData);
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

      if (_webpayProcessing) {
        console.log('WebPay: Already processing, ignoring duplicate alert');
        return;
      }

      console.log('WebPay: Intercepted alert:', message);

      if (_pendingPaymentData && (Date.now() - _pendingPaymentData.ts < 5000)) {
        console.log('WebPay: Using pre-captured data:', _pendingPaymentData);
        var data = _pendingPaymentData;
        _pendingPaymentData = null;
        processRealWebPay(data.amount, data.description);
        return;
      }

      var modal = document.querySelector('[role="dialog"]');
      if (modal) {
        var modalText = modal.textContent || '';
        var amountMatch = modalText.match(/\$\s*([\d.,]+)\s*CLP/i) || modalText.match(/([\d.,]+)\s*CLP/i);
        if (amountMatch) {
          var rawAmount = amountMatch[1].replace(/[.\s]/g, '').replace(',', '.');
          var amount = parseInt(rawAmount, 10);
          if (!isNaN(amount) && amount > 0) {
            var descMatch = modalText.match(/por\s+(.+?)(?:\s*(?:MercadoPago|PayPal|WebPay|Selecciona|Cancelar|Pagar))/i);
            var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
            console.log('WebPay: Extracted from modal fallback:', { amount: amount, description: description });
            processRealWebPay(amount, description);
            return;
          }
        }
      }

      console.error('WebPay: Could not extract payment data');
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

      var userStr = localStorage.getItem('imporlan_user');
      var userEmail = '';
      var userName = '';
      if (userStr) {
        try {
          var u = JSON.parse(userStr);
          userEmail = u.email || '';
          userName = u.name || '';
        } catch(e) {}
      }

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

      sessionStorage.setItem('webpay_order', JSON.stringify({
        buy_order: buyOrder,
        user_email: userEmail,
        purchase_type: purchaseType,
        purchase_description: description,
        amount_clp: amount,
        plan_name: planName
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
          plan_name: planName,
          description: description,
          type: purchaseType,
          days: planDays,
          return_url: window.location.origin + '/api/webpay.php?action=callback'
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
      showLoadingOverlay('Procesando pago con MercadoPago...');
      var response = await fetch(API_BASE + '/mercadopago.php?action=create_preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(amount),
          description: decodeURIComponent(description || 'Pago Imporlan'),
          plan_name: decodeURIComponent(description || 'Pago Imporlan')
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
      var response = await fetch(API_BASE + '/paypal.php?action=create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          description: description || 'Pago Imporlan',
          plan_name: description || 'Pago Imporlan',
          currency: 'USD'
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
