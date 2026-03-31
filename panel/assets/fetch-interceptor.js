/**
 * Fetch Interceptor - Imporlan Panel
 * 1. Redirects API calls from Fly.dev backend to local PHP API
 * 2. Intercepts PayPal checkout redirects and shows Smart Buttons instead
 * Must load BEFORE the React bundle (index-*.js)
 */
(function() {
  'use strict';

  var FLY_DEV_ORIGIN = 'https://app-bxlfgnkv.fly.dev';
  var LOCAL_API = '/api';

  // ── 1. Fetch interceptor for Fly.dev ──
  var originalFetch = window.fetch;

  window.fetch = function(input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');

    if (url.indexOf(FLY_DEV_ORIGIN) === 0) {
      var newUrl = url.replace(FLY_DEV_ORIGIN, '');
      if (newUrl.indexOf('/api') !== 0) {
        newUrl = LOCAL_API + newUrl;
      }
      return originalFetch.call(this, newUrl, init);
    }

    // Intercept PayPal create_order responses to store order data
    if (url.indexOf('paypal.php') !== -1 && url.indexOf('create_order') !== -1) {
      return originalFetch.call(this, input, init).then(function(response) {
        var cloned = response.clone();
        cloned.json().then(function(data) {
          if (data.success && data.order_id) {
            window.__lastPayPalOrderId = data.order_id;
          }
        }).catch(function() {});
        return response;
      });
    }

    return originalFetch.call(this, input, init);
  };

  // ── 2. Intercept PayPal checkout redirects globally ──
  // Override window.location.assign and window.location.replace
  var origAssign = window.location.assign ? window.location.assign.bind(window.location) : null;
  var origReplace = window.location.replace ? window.location.replace.bind(window.location) : null;

  function isPayPalCheckout(url) {
    return typeof url === 'string' && url.indexOf('paypal.com/checkoutnow') !== -1;
  }

  function extractPayPalToken(url) {
    var m = url.match(/token=([A-Z0-9]+)/i);
    return m ? m[1] : null;
  }

  if (origAssign) {
    window.location.assign = function(url) {
      if (isPayPalCheckout(url)) {
        var token = extractPayPalToken(url);
        if (token) { showPayPalSmartButtonsModal(token); return; }
      }
      origAssign(url);
    };
  }

  if (origReplace) {
    window.location.replace = function(url) {
      if (isPayPalCheckout(url)) {
        var token = extractPayPalToken(url);
        if (token) { showPayPalSmartButtonsModal(token); return; }
      }
      origReplace(url);
    };
  }

  // Intercept window.location.href setter
  // Use a navigation event listener as the most reliable method
  window.addEventListener('beforeunload', function(e) {
    // Can't prevent here, but we use the click interceptor below
  });

  // ── 3. Intercept "Continuar con Pago" / "Procesando" button clicks ──
  // When React creates a PayPal order and tries to redirect, we intercept at click level
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var txt = (btn.textContent || '').trim().toLowerCase();

    // Detect PayPal payment buttons in React modals
    if ((txt.indexOf('continuar') !== -1 || txt.indexOf('pagar') !== -1 || txt.indexOf('procesando') !== -1) && btn.closest('[class*="DialogContent"], [role="dialog"], [class*="modal"]')) {
      // Check if PayPal is selected
      var dialog = btn.closest('[class*="DialogContent"], [role="dialog"], [class*="modal"]');
      if (!dialog) return;
      var dialogText = dialog.textContent || '';
      var hasPayPalSelected = false;

      // Check for PayPal radio/selection
      var selectedItems = dialog.querySelectorAll('[class*="border-blue"], [class*="border-indigo"], [class*="shadow-md"]');
      selectedItems.forEach(function(item) {
        if ((item.textContent || '').indexOf('PayPal') !== -1) hasPayPalSelected = true;
      });

      // Also check for checkmark near PayPal
      dialog.querySelectorAll('svg').forEach(function(svg) {
        var parent = svg.closest('[class*="cursor-pointer"]');
        if (parent && (parent.textContent || '').indexOf('PayPal') !== -1) {
          var hasCheck = parent.querySelector('[class*="text-blue"]') || parent.querySelector('svg[class*="text-blue"]');
          if (hasCheck) hasPayPalSelected = true;
        }
      });

      if (!hasPayPalSelected) return;

      // PayPal is selected - intercept!
      // Wait briefly for the fetch to create the order, then show Smart Buttons
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Reset button state
      btn.disabled = false;
      btn.textContent = btn.textContent.replace('Procesando', 'Continuar con Pago');

      // Get amount from dialog
      var amountMatch = (dialogText).match(/\$([\d.,]+)\s*CLP/);
      var amount = amountMatch ? parseInt(amountMatch[1].replace(/\./g, '').replace(/,/g, '')) : 0;
      var conceptMatch = dialogText.match(/por\s+(.+?)(?:\s*$|\s*Selecciona)/i);
      var concept = conceptMatch ? conceptMatch[1].trim() : 'Pago Imporlan';

      showPayPalSmartButtonsModalDirect(amount, concept);
    }
  }, true); // capturing phase - fires before React

  // ── Smart Buttons Modal (with existing order ID) ──
  function showPayPalSmartButtonsModal(orderId) {
    var existing = document.getElementById('fi-paypal-modal');
    if (existing) existing.remove();

    createPayPalModal(function(container) {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', tagline: false },
        createOrder: function() { return Promise.resolve(orderId); },
        onApprove: function(data) { return capturePayPalOrder(data.orderID, container); },
        onCancel: function() {},
        onError: function(err) { console.error('PayPal error:', err); }
      }).render(container);
    });
  }

  // ── Smart Buttons Modal (creates new order) ──
  function showPayPalSmartButtonsModalDirect(amountCLP, concept) {
    var existing = document.getElementById('fi-paypal-modal');
    if (existing) existing.remove();

    var user = null;
    try { user = JSON.parse(localStorage.getItem('imporlan_user') || localStorage.getItem('user') || '{}'); } catch(e) {}
    var email = (user && (user.email || user.user_email)) || '';
    var name = (user && (user.name || user.user_name)) || '';

    createPayPalModal(function(container) {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', tagline: false },
        createOrder: function() {
          var usdAmount = Math.max(1, Math.round((amountCLP || 100000) / 950 * 100) / 100).toFixed(2);
          return originalFetch('/api/paypal.php?action=create_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parseFloat(usdAmount),
              description: concept,
              plan_name: concept,
              currency: 'USD',
              payer_email: email,
              payer_name: name
            })
          }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.success && data.order_id) return data.order_id;
            throw new Error(data.error || 'Error creando orden PayPal');
          });
        },
        onApprove: function(data) { return capturePayPalOrder(data.orderID, container); },
        onCancel: function() {},
        onError: function(err) { console.error('PayPal error:', err); }
      }).render(container);
    });
  }

  function capturePayPalOrder(orderID, container) {
    if (container) container.innerHTML = '<div style="text-align:center;padding:30px"><div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#003087;border-radius:50%;margin:0 auto 12px;animation:fiSpin 1s linear infinite"></div><p style="color:#475569;font-size:13px">Procesando pago...</p></div>';
    return originalFetch('/api/paypal.php?action=capture_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderID })
    }).then(function(r) { return r.json(); }).then(function(result) {
      var modal = document.getElementById('fi-paypal-modal');
      if (modal) modal.remove();
      // Close any React dialog
      document.querySelectorAll('[class*="DialogOverlay"], [role="dialog"]').forEach(function(d) { try { d.remove(); } catch(e) {} });
      if (result.success) {
        alert('Pago procesado exitosamente! Recibiras un email de confirmacion.');
        window.location.hash = '#myproducts';
      } else {
        alert('Error: ' + (result.error || 'Intente nuevamente'));
      }
    }).catch(function() {
      var modal = document.getElementById('fi-paypal-modal');
      if (modal) modal.remove();
      alert('Error de conexion al procesar pago');
    });
  }

  function createPayPalModal(onReady) {
    var overlay = document.createElement('div');
    overlay.id = 'fi-paypal-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:440px;box-shadow:0 25px 60px rgba(0,0,0,.25);overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#003087,#0070ba);padding:20px 24px;display:flex;align-items:center;justify-content:space-between">' +
      '<span style="font-size:20px;font-weight:800;color:#fff;font-style:italic">PayPal</span>' +
      '<button id="fi-pp-close" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;font-size:18px">&times;</button></div>' +
      '<div style="padding:20px 24px">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#475569;text-align:center">Paga con tarjeta o cuenta PayPal</p>' +
      '<div id="fi-paypal-buttons" style="min-height:150px"><div style="text-align:center;padding:30px;color:#64748b;font-size:13px">' +
      '<div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#003087;border-radius:50%;margin:0 auto 12px;animation:fiSpin 1s linear infinite"></div>' +
      'Cargando opciones de pago...</div></div></div></div>';
    document.body.appendChild(overlay);

    if (!document.getElementById('fi-pp-styles')) {
      var st = document.createElement('style'); st.id = 'fi-pp-styles';
      st.textContent = '@keyframes fiSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }

    document.getElementById('fi-pp-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var container = document.getElementById('fi-paypal-buttons');

    if (typeof paypal !== 'undefined' && typeof paypal.Buttons === 'function') {
      container.innerHTML = '';
      onReady(container);
    } else {
      originalFetch('/api/paypal.php?action=get_client_id').then(function(r) { return r.json(); }).then(function(cfg) {
        if (!cfg.client_id) { container.innerHTML = '<p style="color:#ef4444;text-align:center">PayPal no configurado</p>'; return; }
        var sdkDomain = (cfg.environment === 'production') ? 'www.paypal.com' : 'www.sandbox.paypal.com';
        var script = document.createElement('script');
        script.src = 'https://' + sdkDomain + '/sdk/js?client-id=' + cfg.client_id + '&currency=USD&components=buttons&enable-funding=card';
        script.onload = function() { container.innerHTML = ''; onReady(container); };
        document.head.appendChild(script);
      }).catch(function() { container.innerHTML = '<p style="color:#ef4444;text-align:center">Error cargando PayPal</p>'; });
    }
  }
})();
