/**
 * Payment Override for Imporlan Panel
 * This script overrides the demo payment functions with real API calls
 * It intercepts the payment modal and redirects to real payment gateways
 */

(function() {
  'use strict';

  const API_BASE = 'https://www.imporlan.cl/api';

  // Override the window.alert function to intercept demo messages
  const originalAlert = window.alert;
  window.alert = function(message) {
    // Check if this is a demo payment message
    if (message && typeof message === 'string') {
      if (message.includes('Esta es una demo') || message.includes('En produccion se integrara') ||
          message.toLowerCase().includes('proximamente') ||
          message.toLowerCase().includes('transbank') ||
          message.toLowerCase().includes('configurar la api') ||
          message.toLowerCase().includes('requiere configuracion')) {
        console.log('Intercepted payment alert, processing real payment...');
        return;
      }
    }
    // For other alerts, show them normally
    return originalAlert.apply(this, arguments);
  };

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

  console.log('Payment override script loaded - demo payments will be redirected to real API');
})();
