/**
 * Payment Override for Imporlan Panel
 * This script overrides the demo payment functions with real API calls
 * It intercepts the payment modal and redirects to real payment gateways
 */

(function() {
  'use strict';

  const API_BASE = 'https://www.imporlan.cl/test/api';

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

  // Override the window.alert function to intercept demo messages
  const originalAlert = window.alert;
  window.alert = function(message) {
    if (message && typeof message === 'string') {
      var msgLower = message.toLowerCase();
      if (msgLower.includes('proximamente') || msgLower.includes('próximamente') ||
          msgLower.includes('configurar la api') || msgLower.includes('requiere configuracion') ||
          (msgLower.includes('webpay') && msgLower.includes('transbank'))) {
        console.log('Intercepted WebPay alert, launching real payment...');
        extractAndProcessWebPay();
        return;
      }
      if (message.includes('Esta es una demo') || message.includes('En produccion se integrara')) {
        console.log('Intercepted demo alert');
        return;
      }
    }
    return originalAlert.apply(this, arguments);
  };

  function extractAndProcessWebPay() {
    var modal = document.querySelector('[role="dialog"]');
    if (!modal) {
      console.error('WebPay: No payment modal found');
      return;
    }
    var modalText = modal.textContent || '';
    var amountMatch = modalText.match(/\$?([\d.,]+)\s*CLP/i);
    if (!amountMatch) {
      console.error('WebPay: Could not extract amount from modal');
      return;
    }
    var amount = parseInt(amountMatch[1].replace(/[^0-9]/g, ''));
    var descMatch = modalText.match(/por\s+(.+?)(?:\s*MercadoPago|\s*PayPal|\s*WebPay|\s*Cancelar|$)/i);
    var description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
    if (isNaN(amount) || amount <= 0) {
      console.error('WebPay: Invalid amount', amount);
      return;
    }
    console.log('WebPay: Extracted payment data', { amount: amount, description: description });
    processRealWebPay(amount, description);
  }

  async function processRealWebPay(amount, description) {
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
      if (description.toLowerCase().includes('fragata') || amount >= 60000) {
        purchaseType = 'plan';
        planName = 'Plan Fragata';
      } else if (description.toLowerCase().includes('capitan') || amount >= 25000) {
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
      hideLoadingOverlay();
      if (data.success && data.url && data.token) {
        console.log('WebPay transaction created, redirecting to Transbank...');
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
        originalAlert('Error al procesar el pago con WebPay: ' + errorMsg);
      }
    } catch (error) {
      hideLoadingOverlay();
      console.error('WebPay connection error:', error);
      originalAlert('Error al conectar con WebPay. Por favor intente nuevamente.');
    }
  }

  // Override window.open to intercept demo payment URLs
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log('window.open intercepted:', url);
    if (url && typeof url === 'string') {
      // Intercept MercadoPago demo URLs
      if (url.includes('mercadopago.cl') && (url.includes('pref_id=demo') || url.includes('redirect'))) {
        console.log('Intercepted MercadoPago demo URL, redirecting to real payment...');
        // Extract amount and description from URL
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const amount = urlParams.get('amount');
        const description = urlParams.get('description');
        
        console.log('MercadoPago params:', { amount, description });
        
        // Call real API
        processRealMercadoPago(amount, description);
        return null;
      }
      
      // Intercept PayPal demo URLs
      if (url.includes('paypal.com') && url.includes('token=demo')) {
        console.log('Intercepted PayPal demo URL, redirecting to real payment...');
        // Extract amount from URL
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const amount = urlParams.get('amount');
        const currency = urlParams.get('currency') || 'USD';
        const description = 'Pago Imporlan';
        
        console.log('PayPal params:', { amount, currency, description });
        
        // Validate amount
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          console.error('Invalid PayPal amount:', amount);
          originalAlert('Error: Monto de pago invalido. Por favor intente nuevamente.');
          return null;
        }
        
        // Call real API
        processRealPayPal(amount, description);
        return null;
      }
    }
    // For other URLs, open them normally
    return originalOpen.apply(this, arguments);
  };

  // Process real MercadoPago payment
  async function processRealMercadoPago(amount, description) {
    try {
      var userInfo = extractUserInfo();
      var boatLinks = extractBoatLinksFromPage();
      console.log('Processing MercadoPago payment:', { amount, description, boatLinks: boatLinks });
      
      showLoadingOverlay('Procesando pago con MercadoPago...');
      
      const response = await fetch(`${API_BASE}/mercadopago.php?action=create_preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      const data = await response.json();
      hideLoadingOverlay();

      if (data.success && data.init_point) {
        console.log('MercadoPago preference created, redirecting to:', data.init_point);
        window.location.href = data.init_point;
      } else {
        console.error('MercadoPago error:', data);
        originalAlert('Error al procesar el pago con MercadoPago. Por favor intente nuevamente.');
      }
    } catch (error) {
      hideLoadingOverlay();
      console.error('MercadoPago error:', error);
      originalAlert('Error al conectar con MercadoPago. Por favor intente nuevamente.');
    }
  }

  // Process real PayPal payment
  async function processRealPayPal(amountUSD, description) {
    try {
      const parsedAmount = parseFloat(amountUSD);
      console.log('Processing PayPal payment:', { amountUSD, parsedAmount, description });
      
      // Validate amount
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.error('Invalid amount for PayPal:', amountUSD);
        originalAlert('Error: Monto de pago invalido.');
        return;
      }
      
      // Show loading indicator
      showLoadingOverlay('Procesando pago con PayPal...');
      
      var userInfo = extractUserInfo();
      var boatLinks = extractBoatLinksFromPage();
      console.log('PayPal: boat_links extracted:', boatLinks);
      const requestBody = {
        amount: parsedAmount,
        description: description || 'Pago Imporlan',
        plan_name: description || 'Pago Imporlan',
        currency: 'USD',
        payer_email: userInfo.email,
        payer_name: userInfo.name,
        payer_phone: userInfo.phone,
        country: 'Chile',
        boat_links: boatLinks
      };
      
      console.log('PayPal API request:', requestBody);
      
      const response = await fetch(`${API_BASE}/paypal.php?action=create_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('PayPal API response status:', response.status);
      
      const data = await response.json();
      console.log('PayPal API response data:', data);
      
      hideLoadingOverlay();

      if (data.success && data.order_id) {
        // Check for approval URL in different possible locations
        const approvalUrl = data.approval_url || 
          (data.links && data.links.find(l => l.rel === 'approve')?.href) ||
          `https://www.paypal.com/checkoutnow?token=${data.order_id}`;
        
        console.log('PayPal order created, redirecting to:', approvalUrl);
        window.location.href = approvalUrl;
      } else {
        console.error('PayPal error response:', data);
        const errorMsg = data.error || data.message || 'Error desconocido';
        originalAlert(`Error al procesar el pago con PayPal: ${errorMsg}`);
      }
    } catch (error) {
      hideLoadingOverlay();
      console.error('PayPal connection error:', error);
      originalAlert('Error al conectar con PayPal. Por favor intente nuevamente.');
    }
  }

  // Show loading overlay
  function showLoadingOverlay(message) {
    // Remove existing overlay if any
    hideLoadingOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = 'payment-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: white;
        padding: 30px 50px;
        border-radius: 16px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 50px;
          height: 50px;
          border: 4px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        "></div>
        <p style="
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        ">${message}</p>
        <p style="
          font-size: 14px;
          color: #64748b;
          margin-top: 10px;
        ">Por favor espere...</p>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(overlay);
  }

  // Hide loading overlay
  function hideLoadingOverlay() {
    const overlay = document.getElementById('payment-loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  console.log('Payment override script loaded - demo payments will be redirected to real API');
})();
