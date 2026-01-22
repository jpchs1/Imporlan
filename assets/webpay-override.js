/**
 * WebPay Override for Imporlan Main Site
 * This script enables WebPay payments by intercepting the alert and replacing button behavior
 */

(function() {
  'use strict';

  const API_BASE = 'https://www.imporlan.cl/api';
  const originalAlert = window.alert;

  // Override alert to intercept WebPay "proximamente" message
  window.alert = function(message) {
    const msgLower = (message || '').toLowerCase();
    
    // Check if this is the WebPay "coming soon" message
    if (msgLower.includes('webpay') && (msgLower.includes('proximamente') || msgLower.includes('disponible'))) {
      console.log('WebPay alert intercepted:', message);
      
      // Find the payment modal and get payment data
      const modal = document.querySelector('[role="dialog"]') || document.querySelector('[tabindex="-1"]');
      if (modal) {
        const modalText = modal.textContent || '';
        const amountMatch = modalText.match(/\$?([\d,\.]+)\s*CLP/i);
        
        if (amountMatch) {
          const amount = parseInt(amountMatch[1].replace(/[,\.]/g, ''));
          const descMatch = modalText.match(/CLP\s*(?:por\s+)?(.+?)(?:\s*Selecciona|\s*MercadoPago|\s*PayPal|\s*WebPay|$)/i);
          const description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
          
          console.log('Processing WebPay payment:', { amount, description });
          processRealWebPay(amount, description);
          return;
        }
      }
      
      // If we couldn't extract payment data, show a different message
      originalAlert('Procesando pago con WebPay...');
      return;
    }
    
    // For other alerts, use the original function
    originalAlert.apply(this, arguments);
  };

  // Process real Webpay payment
  async function processRealWebPay(amount, description) {
    try {
      const parsedAmount = parseInt(amount);
      console.log('Processing Webpay payment:', { amount, parsedAmount, description });
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.error('Invalid amount for Webpay:', amount);
        originalAlert('Error: Monto de pago invalido.');
        return;
      }
      
      showLoadingOverlay('Conectando con Webpay...');
      
      const sessionId = 'main_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
  }

  function showLoadingOverlay(message) {
    hideLoadingOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'webpay-loading-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.7); display: flex; flex-direction: column;
      align-items: center; justify-content: center; z-index: 99999;
    `;
    overlay.innerHTML = `
      <div style="background: white; padding: 30px 50px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <div style="width: 50px; height: 50px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
        <p style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0;">${message}</p>
        <p style="font-size: 14px; color: #64748b; margin-top: 10px;">Por favor espere...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('webpay-loading-overlay');
    if (overlay) overlay.remove();
  }

  // Store payment data when modal opens
  let pendingPaymentData = null;

  // Watch for modal changes and inject our button handler
  function checkAndInjectButton() {
    // Find the payment modal (could be role="dialog" or tabindex="-1")
    const modal = document.querySelector('[role="dialog"]') || document.querySelector('[tabindex="-1"]');
    if (!modal) return;
    
    const modalText = modal.textContent || '';
    if (!modalText.includes('Selecciona') || !modalText.includes('Pago')) return;
    
    // Check if WebPay is selected (look for various selection indicators)
    const webpayOption = modal.querySelector('[class*="border-red"]') || 
                         modal.querySelector('[class*="ring-red"]') ||
                         modal.querySelector('[class*="bg-red-50"]');
    
    if (!webpayOption) return;
    
    const webpayText = webpayOption.textContent || '';
    if (!webpayText.includes('WebPay')) return;
    
    // WebPay is selected! Extract payment data
    const amountMatch = modalText.match(/\$?([\d,\.]+)\s*CLP/i);
    if (!amountMatch) return;
    
    const amount = parseInt(amountMatch[1].replace(/[,\.]/g, ''));
    const descMatch = modalText.match(/CLP\s*(?:por\s+)?(.+?)(?:\s*Selecciona|\s*MercadoPago|\s*PayPal|\s*WebPay|$)/i);
    const description = descMatch ? descMatch[1].trim() : 'Pago Imporlan';
    
    pendingPaymentData = { amount, description };
    console.log('WebPay selected, payment data:', pendingPaymentData);
    
    // Find the payment button (could be "Pagar Ahora", "Continuar con Pago", etc.)
    const buttons = modal.querySelectorAll('button');
    let payButton = null;
    
    for (const btn of buttons) {
      const btnText = (btn.textContent || '').toLowerCase();
      if (btnText.includes('pagar') || btnText.includes('continuar')) {
        // Skip cancel buttons
        if (btnText.includes('cancelar') || btnText.includes('anular')) continue;
        payButton = btn;
        break;
      }
    }
    
    if (!payButton) return;
    
    // Check if we already replaced this button
    if (payButton.dataset.webpayOverride === 'true') return;
    
    // Clone the button and replace it
    const newButton = payButton.cloneNode(true);
    newButton.dataset.webpayOverride = 'true';
    
    // Remove all existing event listeners by replacing the element
    payButton.parentNode.replaceChild(newButton, payButton);
    
    // Add our click handler
    newButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      console.log('Custom WebPay button clicked!');
      
      if (pendingPaymentData && pendingPaymentData.amount > 0) {
        processRealWebPay(pendingPaymentData.amount, pendingPaymentData.description);
      } else {
        originalAlert('Error: No se pudo obtener los datos del pago.');
      }
      
      return false;
    }, true);
    
    console.log('WebPay button replaced successfully!');
  }

  // Initialize when DOM is ready
  function init() {
    // Run the check periodically
    setInterval(checkAndInjectButton, 100);

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

    console.log('WebPay override for main site loaded - WebPay payments enabled');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
