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

    return originalFetch.call(this, input, init);
  };

  // ── 2. Intercept PayPal checkout redirects → show Smart Buttons ──
  var _origLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location') ||
    Object.getOwnPropertyDescriptor(Window.prototype, 'location');

  // We can't override window.location directly in all browsers, so we intercept
  // window.location.href assignment by patching the setter
  try {
    var _realLocation = window.location;
    var _hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (_hrefDescriptor && _hrefDescriptor.set) {
      var _originalHrefSet = _hrefDescriptor.set;

      Object.defineProperty(Location.prototype, 'href', {
        get: _hrefDescriptor.get,
        set: function(val) {
          if (typeof val === 'string' && val.indexOf('paypal.com/checkoutnow') !== -1) {
            // Extract token from URL
            var tokenMatch = val.match(/token=([A-Z0-9]+)/i);
            var orderId = tokenMatch ? tokenMatch[1] : null;
            if (orderId) {
              showPayPalSmartButtonsModal(orderId);
              return; // Block the redirect
            }
          }
          return _originalHrefSet.call(this, val);
        },
        enumerable: true,
        configurable: true
      });
    }
  } catch (e) {
    // Fallback: if we can't patch Location.prototype, use beforeunload
    console.log('[fetch-interceptor] Location.href patch not supported, using fallback');
  }

  function showPayPalSmartButtonsModal(orderId) {
    var existing = document.getElementById('fi-paypal-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'fi-paypal-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;width:90%;max-width:440px;box-shadow:0 25px 60px rgba(0,0,0,.25);overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#003087,#0070ba);padding:20px 24px;display:flex;align-items:center;justify-content:space-between">' +
      '<span style="font-size:20px;font-weight:800;color:#fff;font-style:italic">PayPal</span>' +
      '<button id="fi-pp-close" style="width:32px;height:32px;border-radius:8px;border:none;background:rgba(255,255,255,.15);color:#fff;cursor:pointer;font-size:18px">&times;</button></div>' +
      '<div style="padding:20px 24px">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#475569;text-align:center">Selecciona tu metodo de pago</p>' +
      '<div id="fi-paypal-buttons" style="min-height:150px"><div style="text-align:center;padding:30px;color:#64748b;font-size:13px">' +
      '<div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#003087;border-radius:50%;margin:0 auto 12px;animation:fiSpin 1s linear infinite"></div>' +
      'Cargando PayPal...</div></div>' +
      '</div></div>';
    document.body.appendChild(overlay);

    // Add spinner style
    if (!document.getElementById('fi-pp-styles')) {
      var st = document.createElement('style'); st.id = 'fi-pp-styles';
      st.textContent = '@keyframes fiSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }

    document.getElementById('fi-pp-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    function renderButtons() {
      if (typeof paypal === 'undefined' || typeof paypal.Buttons !== 'function') return;
      var container = document.getElementById('fi-paypal-buttons');
      if (!container) return;
      container.innerHTML = '';

      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', tagline: false },
        createOrder: function() {
          // We already have the order ID from the intercepted redirect
          return Promise.resolve(orderId);
        },
        onApprove: function(data) {
          container.innerHTML = '<div style="text-align:center;padding:30px"><div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#003087;border-radius:50%;margin:0 auto 12px;animation:fiSpin 1s linear infinite"></div><p style="color:#475569;font-size:13px">Procesando pago...</p></div>';
          return fetch('/api/paypal.php?action=capture_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: data.orderID })
          }).then(function(r) { return r.json(); }).then(function(result) {
            overlay.remove();
            if (result.success) {
              alert('Pago procesado exitosamente! Recibiras un email de confirmacion.');
              window.location.hash = '#myproducts';
            } else {
              alert('Error al procesar pago: ' + (result.error || 'Intente nuevamente'));
            }
          }).catch(function() {
            overlay.remove();
            alert('Error de conexion al procesar pago');
          });
        },
        onCancel: function() { /* modal stays open */ },
        onError: function(err) {
          console.error('PayPal Smart Buttons error:', err);
          container.innerHTML = '<p style="text-align:center;padding:16px;color:#ef4444;font-size:13px">Error cargando PayPal. <a href="' + 'https://www.paypal.com/checkoutnow?token=' + orderId + '" style="color:#003087;font-weight:600">Pagar directamente</a></p>';
        }
      }).render('#fi-paypal-buttons');
    }

    // Load PayPal SDK if needed
    if (typeof paypal !== 'undefined' && typeof paypal.Buttons === 'function') {
      renderButtons();
    } else {
      fetch('/api/paypal.php?action=get_client_id').then(function(r) { return r.json(); }).then(function(cfg) {
        if (!cfg.client_id) return;
        var sdkDomain = (cfg.environment === 'production') ? 'www.paypal.com' : 'www.sandbox.paypal.com';
        var script = document.createElement('script');
        script.src = 'https://' + sdkDomain + '/sdk/js?client-id=' + cfg.client_id + '&currency=USD&components=buttons&enable-funding=card';
        script.onload = renderButtons;
        document.head.appendChild(script);
      }).catch(function() {
        var c = document.getElementById('fi-paypal-buttons');
        if (c) c.innerHTML = '<p style="text-align:center;color:#ef4444">Error cargando PayPal SDK</p>';
      });
    }
  }
})();
