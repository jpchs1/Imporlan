/**
 * Dolar Rate Updater
 * Fetches the current dollar rate from the API and updates the display
 */

(function() {
  'use strict';

  // Only run on Home page
  if (window.location.pathname.includes('/panel')) return;

  const API_URL = '/api/dolar.php';
  
  function formatCurrency(value) {
    // Format as Chilean currency: $XXX or $X.XXX
    const rounded = Math.round(value);
    if (rounded >= 1000) {
      return '$' + rounded.toLocaleString('es-CL');
    }
    return '$' + rounded;
  }
  
  function updateDolarDisplay(dolarObservado, dolarCompra) {
    console.log('[Dolar Updater] Updating display with:', dolarObservado, dolarCompra);
    
    // Wait for the page to render
    const checkInterval = setInterval(function() {
      let foundObservado = false;
      let foundCompra = false;
      let foundLabel = false;
      
      // Simple approach: find all DIV elements and check their text content
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(function(div) {
        const text = div.textContent.trim();
        
        // Update Dolar Observado value ($985)
        if (text === '$985' && !foundObservado) {
          div.textContent = formatCurrency(dolarObservado);
          foundObservado = true;
          console.log('[Dolar Updater] Updated Dolar Observado to:', formatCurrency(dolarObservado));
        }
        
        // Update Dolar Compra value ($1.005 or $1,005)
        if ((text === '$1.005' || text === '$1,005') && !foundCompra) {
          div.textContent = formatCurrency(dolarCompra);
          foundCompra = true;
          console.log('[Dolar Updater] Updated Dolar Compra to:', formatCurrency(dolarCompra));
        }
        
        // Update label from "Dolar Imporlan" to "Dolar Compra"
        if (text === 'Dolar Imporlan' && !foundLabel) {
          div.textContent = 'Dolar Compra';
          foundLabel = true;
          console.log('[Dolar Updater] Updated label to Dolar Compra');
        }
      });
      
      // Check if we found and updated all elements
      if (foundObservado && foundCompra) {
        clearInterval(checkInterval);
        console.log('[Dolar Updater] Display update complete');
      }
    }, 500);
    
    // Stop checking after 15 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
      console.log('[Dolar Updater] Timeout reached, stopping checks');
    }, 15000);
  }
  
  function fetchDolarRate() {
    console.log('[Dolar Updater] Fetching rate from API...');
    fetch(API_URL)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('API request failed');
        }
        return response.json();
      })
      .then(function(data) {
        console.log('[Dolar Updater] API response:', data);
        if (data.success) {
          updateDolarDisplay(data.dolar_observado, data.dolar_compra);
        }
      })
      .catch(function(error) {
        console.warn('[Dolar Updater] Could not fetch dollar rate:', error);
      });
  }
  
  // Fetch on page load with delay to let React render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(fetchDolarRate, 2000);
    });
  } else {
    setTimeout(fetchDolarRate, 2000);
  }
  
})();
