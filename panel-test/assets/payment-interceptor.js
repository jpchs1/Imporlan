/**
 * Payment Interceptor for Panel-Test
 * 
 * Fixes:
 * 1. Redirects API calls from /api/ to /test/api/ for test environment
 * 2. Injects cotizador form data (boat_links, payer_phone, country) into payment API requests
 * 3. Enables WebPay payments (replaces "proximamente" alert with real Transbank integration)
 */
(function() {
  'use strict';

  const TEST_API_BASE = 'https://www.imporlan.cl/test/api';
  const PROD_API_BASE = 'https://www.imporlan.cl/api';

  function getCotizadorData() {
    var data = { boat_links: [], payer_phone: '', country: 'Chile', payer_name: '' };
    try {
      var inputs = document.querySelectorAll('input[placeholder*="boattrader"], input[placeholder*="yachtworld"], input[placeholder*="boats.com"]');
      inputs.forEach(function(input) {
        var val = (input.value || '').trim();
        if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
          data.boat_links.push(val);
        }
      });

      var phoneInput = document.querySelector('input[placeholder*="XXXX"], input[placeholder*="telefono"], input[placeholder*="phone"]');
      if (phoneInput && phoneInput.value) data.payer_phone = phoneInput.value.trim();

      var nameInput = document.querySelector('input[placeholder*="Tu nombre"], input[placeholder="Tu nombre"]');
      var lastNameInput = document.querySelector('input[placeholder*="Tus apellidos"], input[placeholder="Tus apellidos"]');
      if (nameInput && nameInput.value) {
        data.payer_name = nameInput.value.trim();
        if (lastNameInput && lastNameInput.value) {
          data.payer_name += ' ' + lastNameInput.value.trim();
        }
      }

      var countryBtn = document.querySelector('button[aria-expanded]');
      if (countryBtn) {
        var countryText = (countryBtn.textContent || '').trim().split('\n')[0].trim();
        if (countryText && countryText.length < 30) data.country = countryText;
      }
    } catch(e) {
      console.warn('Payment interceptor: error reading form data', e);
    }
    return data;
  }

  var originalFetch = window.fetch;
  window.fetch = function(url, options) {
    var urlStr = (typeof url === 'string') ? url : (url && url.url ? url.url : '');

    var isMercadoPago = urlStr.indexOf('/api/mercadopago.php') !== -1;
    var isPayPal = urlStr.indexOf('/api/paypal.php') !== -1;
    var isWebPay = urlStr.indexOf('/api/webpay.php') !== -1;
    var isPaymentAPI = isMercadoPago || isPayPal || isWebPay;

    if (isPaymentAPI) {
      var newUrl = urlStr.replace(PROD_API_BASE, TEST_API_BASE);
      if (newUrl === urlStr && urlStr.indexOf('/test/api/') === -1) {
        newUrl = urlStr.replace('/api/', '/test/api/');
      }
      console.log('Payment interceptor: redirecting', urlStr, '->', newUrl);

      if (options && options.body) {
        try {
          var body = JSON.parse(options.body);
          var formData = getCotizadorData();

          if (formData.boat_links.length > 0 && (!body.boat_links || body.boat_links.length === 0)) {
            body.boat_links = formData.boat_links;
          }
          if (formData.payer_phone && !body.payer_phone) {
            body.payer_phone = formData.payer_phone;
          }
          if (formData.country && !body.country) {
            body.country = formData.country;
          }
          if (formData.payer_name && !body.payer_name) {
            body.payer_name = formData.payer_name;
          }

          var userEmail = body.payer_email || body.user_email || '';
          if (!userEmail) {
            userEmail = localStorage.getItem('userEmail') ||
                        sessionStorage.getItem('userEmail') ||
                        (window.currentUser && window.currentUser.email) || '';
            if (userEmail) {
              if (!body.payer_email) body.payer_email = userEmail;
              if (!body.user_email) body.user_email = userEmail;
            }
          }

          options = Object.assign({}, options, { body: JSON.stringify(body) });
          console.log('Payment interceptor: enriched body', body);
        } catch(e) {
          console.warn('Payment interceptor: could not parse body', e);
        }
      }

      return originalFetch.call(this, newUrl, options);
    }

    return originalFetch.apply(this, arguments);
  };

  var originalAlert = window.alert;
  window.alert = function(message) {
    var msgLower = (message || '').toLowerCase();
    if (msgLower.indexOf('webpay') !== -1 && (msgLower.indexOf('proximamente') !== -1 || msgLower.indexOf('disponible') !== -1)) {
      console.log('Payment interceptor: WebPay alert intercepted');

      var modal = document.querySelector('[role="dialog"]') || document.querySelector('[tabindex="-1"]');
      if (modal) {
        var modalText = modal.textContent || '';
        var amountMatch = modalText.match(/\$?([\d,\.]+)\s*CLP/i);
        if (amountMatch) {
          var amount = parseInt(amountMatch[1].replace(/[,\.]/g, ''));
          var descMatch = modalText.match(/CLP\s*(?:por\s+)?(.+?)(?:\s*Selecciona|\s*MercadoPago|\s*PayPal|\s*WebPay|$)/i);
          var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
          processWebPay(amount, description);
          return;
        }
      }
      originalAlert('Procesando pago con WebPay...');
      return;
    }
    originalAlert.apply(this, arguments);
  };

  function showLoadingOverlay(message) {
    hideLoadingOverlay();
    var overlay = document.createElement('div');
    overlay.id = 'webpay-loading-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;';
    overlay.innerHTML = '<div style="background:white;padding:30px 50px;border-radius:16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);"><div style="width:50px;height:50px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div><p style="font-size:18px;font-weight:600;color:#1e293b;margin:0;">' + message + '</p><p style="font-size:14px;color:#64748b;margin-top:10px;">Por favor espere...</p></div><style>@keyframes spin{to{transform:rotate(360deg);}}</style>';
    document.body.appendChild(overlay);
  }

  function hideLoadingOverlay() {
    var overlay = document.getElementById('webpay-loading-overlay');
    if (overlay) overlay.remove();
  }

  async function processWebPay(amount, description) {
    try {
      var parsedAmount = parseInt(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        originalAlert('Error: Monto de pago invalido.');
        return;
      }

      showLoadingOverlay('Conectando con WebPay...');

      var formData = getCotizadorData();
      var userEmail = localStorage.getItem('userEmail') ||
                      sessionStorage.getItem('userEmail') ||
                      (window.currentUser && window.currentUser.email) || '';

      var sessionId = 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      var buyOrder = 'ORD_' + Date.now();

      var purchaseType = 'link';
      var planName = '';
      var planDays = 7;
      if (description.toLowerCase().indexOf('fragata') !== -1 || parsedAmount >= 60000) {
        purchaseType = 'plan'; planName = 'Plan Fragata'; planDays = 7;
      } else if (description.toLowerCase().indexOf('capitan') !== -1 || parsedAmount >= 25000) {
        purchaseType = 'plan'; planName = 'Plan Capitan'; planDays = 14;
      }

      var requestBody = {
        amount: parsedAmount,
        session_id: sessionId,
        buy_order: buyOrder,
        user_email: userEmail,
        payer_name: formData.payer_name || userEmail,
        payer_phone: formData.payer_phone,
        country: formData.country,
        boat_links: formData.boat_links,
        plan_name: planName || description,
        description: description,
        type: purchaseType,
        days: planDays
      };

      console.log('Payment interceptor: WebPay request', requestBody);

      var response = await originalFetch(TEST_API_BASE + '/webpay.php?action=create_transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      var data = await response.json();
      console.log('Payment interceptor: WebPay response', data);

      hideLoadingOverlay();

      if (data.success && data.url && data.token) {
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
        originalAlert('Error al procesar el pago con WebPay: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      hideLoadingOverlay();
      console.error('Payment interceptor: WebPay error', error);
      originalAlert('Error al conectar con WebPay. Por favor intente nuevamente.');
    }
  }

  var pendingPaymentData = null;
  function checkAndInjectWebPayButton() {
    var modal = document.querySelector('[role="dialog"]') || document.querySelector('[tabindex="-1"]');
    if (!modal) return;
    var modalText = modal.textContent || '';
    if (modalText.indexOf('Selecciona') === -1 || modalText.indexOf('Pago') === -1) return;

    var webpayOption = modal.querySelector('[class*="border-red"]') ||
                       modal.querySelector('[class*="ring-red"]') ||
                       modal.querySelector('[class*="bg-red-50"]');
    if (!webpayOption) return;
    if ((webpayOption.textContent || '').indexOf('WebPay') === -1) return;

    var amountMatch = modalText.match(/\$?([\d,\.]+)\s*CLP/i);
    if (!amountMatch) return;
    var amount = parseInt(amountMatch[1].replace(/[,\.]/g, ''));
    var descMatch = modalText.match(/CLP\s*(?:por\s+)?(.+?)(?:\s*Selecciona|\s*MercadoPago|\s*PayPal|\s*WebPay|$)/i);
    var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
    pendingPaymentData = { amount: amount, description: description };

    var buttons = modal.querySelectorAll('button');
    var payButton = null;
    for (var i = 0; i < buttons.length; i++) {
      var btnText = (buttons[i].textContent || '').toLowerCase();
      if ((btnText.indexOf('pagar') !== -1 || btnText.indexOf('continuar') !== -1) &&
          btnText.indexOf('cancelar') === -1 && btnText.indexOf('anular') === -1) {
        payButton = buttons[i];
        break;
      }
    }
    if (!payButton || payButton.dataset.webpayOverride === 'true') return;

    var newButton = payButton.cloneNode(true);
    newButton.dataset.webpayOverride = 'true';
    payButton.parentNode.replaceChild(newButton, payButton);

    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (pendingPaymentData && pendingPaymentData.amount > 0) {
        processWebPay(pendingPaymentData.amount, pendingPaymentData.description);
      } else {
        originalAlert('Error: No se pudo obtener los datos del pago.');
      }
      return false;
    }, true);
  }

  function init() {
    setInterval(checkAndInjectWebPayButton, 100);
    if (document.body) {
      var observer = new MutationObserver(function() { checkAndInjectWebPayButton(); });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    console.log('Payment interceptor loaded: API redirect /api/ -> /test/api/, cotizador data injection, WebPay enabled');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
