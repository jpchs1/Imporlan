/**
 * Payment Override for Imporlan Panel - Version 8
 * This script enables WebPay payments by:
 * 1. Intercepting the "Proximamente" alert when WebPay is selected
 * 2. Replacing the payment button when WebPay is selected
 * Fixed: Added alert interception to block "Proximamente" message
 */

(function() {
  'use strict';

  const API_BASE = 'https://www.imporlan.cl/api';
  const originalAlert = window.alert;

  // CRITICAL: Intercept alert() to block "Proximamente" message
  window.alert = function(message) {
    const msgLower = (message || '').toLowerCase();
    
    // Block WebPay "proximamente" alerts
    if (msgLower.includes('proximamente') || 
        msgLower.includes('próximamente') ||
        msgLower.includes('webpay') ||
        msgLower.includes('transbank') ||
        msgLower.includes('configurar la api') ||
        msgLower.includes('esta es una demo') ||
        msgLower.includes('en produccion se integrara')) {
      console.log('Payment override: Blocked alert -', message);
      return; // Don't show the alert
    }
    
    // Allow other alerts to pass through
    return originalAlert.call(window, message);
  };

  console.log('Payment override v8: Alert interception enabled');

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
      console.log('Processing MercadoPago payment:', { amount, description });
      
      // Show loading indicator
      showLoadingOverlay('Procesando pago con MercadoPago...');
      
      const response = await fetch(`${API_BASE}/mercadopago.php?action=create_preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseInt(amount),
          description: decodeURIComponent(description || 'Pago Imporlan'),
          plan_name: decodeURIComponent(description || 'Pago Imporlan')
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
      
      const requestBody = {
        amount: parsedAmount,
        description: description || 'Pago Imporlan',
        plan_name: description || 'Pago Imporlan',
        currency: 'USD'
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

  // Expose processRealWebPay globally for debugging
  window.processRealWebPay = async function(amount, description) {
    try {
      const parsedAmount = parseInt(amount);
      console.log('Processing Webpay payment:', { amount, parsedAmount, description });
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.error('Invalid amount for Webpay:', amount);
        originalAlert('Error: Monto de pago invalido.');
        return;
      }
      
      showLoadingOverlay('Conectando con Webpay...');
      
      const sessionId = 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const buyOrder = 'ORD_' + Date.now();
      
      const requestBody = {
        amount: parsedAmount,
        session_id: sessionId,
        buy_order: buyOrder,
        return_url: window.location.origin + '/api/webpay.php?action=callback'
      };
      
      console.log('Webpay API request:', requestBody);
      
      const response = await fetch(`${API_BASE}/webpay.php?action=create_transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Webpay API response:', data);
      
      hideLoadingOverlay();

      if (data.success && data.url && data.token) {
        console.log('Webpay transaction created, redirecting...');
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.url;
        form.style.display = 'none';
        
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'token_ws';
        tokenInput.value = data.token;
        form.appendChild(tokenInput);
        
        document.body.appendChild(form);
        form.submit();
      } else {
        const errorMsg = data.error || data.message || 'Error desconocido';
        originalAlert(`Error al procesar el pago con Webpay: ${errorMsg}`);
      }
    } catch (error) {
      hideLoadingOverlay();
      console.error('Webpay connection error:', error);
      originalAlert('Error al conectar con Webpay. Por favor intente nuevamente.');
    }
  };

  // Store payment data when modal opens
  let pendingPaymentData = null;
  let buttonReplaced = false;

  // Watch for modal changes and inject our button
  function checkAndInjectButton() {
    // Find the payment modal
    const modal = document.querySelector('[tabindex="-1"]');
    if (!modal) {
      buttonReplaced = false;
      return;
    }
    
    const modalText = modal.textContent || '';
    if (!modalText.includes('Selecciona Metodo de Pago') && !modalText.includes('Metodo de Pago')) {
      buttonReplaced = false;
      return;
    }
    
    // Check if WebPay is selected (has red border - border-red-400 bg-red-50)
    const webpayOption = modal.querySelector('[class*="border-red-400"]');
    if (!webpayOption) {
      buttonReplaced = false;
      return;
    }
    
    const webpayText = webpayOption.textContent || '';
    if (!webpayText.includes('WebPay')) {
      buttonReplaced = false;
      return;
    }
    
    // WebPay is selected! Extract payment data
    const amountMatch = modalText.match(/\$?([\d,\.]+)\s*CLP/i);
    if (!amountMatch) return;
    
    const amount = parseInt(amountMatch[1].replace(/[,\.]/g, ''));
    const descMatch = modalText.match(/CLP por (.+?)(?:\n|Selecciona|WebPay|MercadoPago|PayPal|$)/i);
    const description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
    
    pendingPaymentData = { amount, description };
    
    // Find the payment button - look for "Pagar Ahora" or "Continuar con Pago"
    const buttons = modal.querySelectorAll('button');
    let payButton = null;
    
    for (const btn of buttons) {
      const btnText = (btn.textContent || '').toLowerCase();
      if (btnText.includes('pagar ahora') || btnText.includes('continuar con pago')) {
        payButton = btn;
        break;
      }
    }
    
    if (!payButton) return;
    
    // Check if we already replaced this button
    if (payButton.dataset.webpayOverride === 'true') return;
    if (buttonReplaced) return;
    
    console.log('WebPay selected, payment data:', pendingPaymentData);
    console.log('Replacing button...');
    
    // Clone the button and replace it
    const newButton = payButton.cloneNode(true);
    newButton.dataset.webpayOverride = 'true';
    
    // Remove all existing event listeners by replacing the element
    payButton.parentNode.replaceChild(newButton, payButton);
    buttonReplaced = true;
    
    // Add our click handler
    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      console.log('Custom WebPay button clicked!');
      
      if (pendingPaymentData && pendingPaymentData.amount > 0) {
        window.processRealWebPay(pendingPaymentData.amount, pendingPaymentData.description);
      } else {
        originalAlert('Error: No se pudo obtener los datos del pago.');
      }
      
      return false;
    }, true);
    
    console.log('WebPay button replaced successfully!');
  }

  // Initialize when DOM is ready
  function init() {
    console.log('Payment override v8 initializing...');
    
    // Run the check periodically
    setInterval(checkAndInjectButton, 200);

    // Also use MutationObserver for faster detection
    if (document.body) {
      const observer = new MutationObserver(function(mutations) {
        checkAndInjectButton();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }

    console.log('Payment override v8 loaded - WebPay payments enabled, alerts intercepted');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('Payment override script loaded - demo payments will be redirected to real API');
})();
