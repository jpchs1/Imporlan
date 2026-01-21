/**
 * Panel Enhancements for Imporlan
 * This script runs after the React app loads to modify button behavior
 */

(function() {
  'use strict';

  // Wait for DOM to be ready and React to render
  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // Find and modify the Registrarse button to redirect to registration form
  function setupRegistrarseButton() {
    // Look for the button with text "Registrarse" or "Demo" next to the "Entrar" button
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach(button => {
      const text = button.textContent.trim();
      // Find the Registrarse/Demo button (outline variant next to Entrar)
      if ((text === 'Registrarse' || text === 'Demo') && 
          button.className.includes('outline') || 
          (button.className.includes('rounded-xl') && !button.className.includes('gradient'))) {
        
        // Check if this is the login form button (not the registration submit button)
        const parent = button.closest('form') || button.closest('div');
        const hasEntrarButton = parent && parent.querySelector('button[class*="gradient"]');
        
        if (hasEntrarButton && (text === 'Registrarse' || text === 'Demo')) {
          console.log('Found Registrarse/Demo button, adding click handler');
          
          // Override the click handler
          button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Find and click the "Registrate" link to switch to registration form
            const registrateLink = document.querySelector('button.text-blue-600, button[class*="text-blue-600"]');
            if (registrateLink && registrateLink.textContent.includes('Registrate')) {
              registrateLink.click();
            } else {
              // Alternative: look for any button that toggles to registration
              const allButtons = document.querySelectorAll('button');
              allButtons.forEach(btn => {
                if (btn.textContent.trim() === 'Registrate') {
                  btn.click();
                }
              });
            }
          }, true); // Use capture phase to intercept before React handler
          
          // Change button text to "Registrarse" if it's still "Demo"
          if (text === 'Demo') {
            button.textContent = 'Registrarse';
          }
        }
      }
    });
  }

  // Run setup when DOM is ready
  onReady(function() {
    // Initial setup with delay to wait for React to render
    setTimeout(setupRegistrarseButton, 500);
    setTimeout(setupRegistrarseButton, 1000);
    setTimeout(setupRegistrarseButton, 2000);
    
    // Also observe for dynamic changes
    const observer = new MutationObserver(function(mutations) {
      setupRegistrarseButton();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
})();
