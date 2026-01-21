/**
 * Responsive Process Section Enhancement
 * Makes the "PROCESO DE COMPRA USA" section responsive for mobile devices
 */

(function() {
  'use strict';

  // Only run on Home page
  if (window.location.pathname.includes('/panel')) return;

  function addResponsiveStyles() {
    // Check if styles already added
    if (document.getElementById('responsive-proceso-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'responsive-proceso-styles';
    style.textContent = `
      /* Responsive Process Section */
      @media (max-width: 1024px) {
        /* Make the step container a responsive grid */
        section:has(h2) > div:has(> div > span:first-child) {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 1.5rem !important;
        }
      }
      
      @media (max-width: 768px) {
        /* 2 columns on tablet */
        section:has(h2) > div:has(> div > span:first-child) {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 1.5rem !important;
        }
        
        /* Hide the animated boat line on mobile */
        section svg[class*="boat"],
        section .boat-animation,
        section > div > svg:not([class]) {
          display: none !important;
        }
      }
      
      @media (max-width: 640px) {
        /* 1 column on mobile */
        section:has(h2) > div:has(> div > span:first-child) {
          grid-template-columns: 1fr !important;
          gap: 1.5rem !important;
          padding-top: 2rem !important;
        }
        
        /* Adjust step card styling for mobile */
        section:has(h2) > div > div {
          margin-bottom: 1rem !important;
        }
      }
    `;
    document.head.appendChild(style);
    console.log('[Responsive Proceso] Styles added');
  }

  function makeProcesoResponsive() {
    const checkInterval = setInterval(function() {
      // Find the PROCESO DE COMPRA USA section
      const sections = document.querySelectorAll('section');
      let procesoSection = null;
      
      sections.forEach(function(section) {
        const heading = section.querySelector('h2');
        if (heading && heading.textContent.includes('PROCESO DE COMPRA USA')) {
          procesoSection = section;
        }
      });
      
      if (procesoSection) {
        clearInterval(checkInterval);
        
        // Find the steps container (the div with 5 step cards)
        const stepsContainer = procesoSection.querySelector('.relative.grid, [class*="grid-cols-5"], div:has(> div > span)');
        
        if (stepsContainer) {
          // Apply responsive classes via inline styles for broader compatibility
          const applyResponsiveLayout = function() {
            const width = window.innerWidth;
            
            if (width <= 640) {
              // Mobile: 1 column
              stepsContainer.style.display = 'grid';
              stepsContainer.style.gridTemplateColumns = '1fr';
              stepsContainer.style.gap = '1.5rem';
              stepsContainer.style.paddingTop = '2rem';
            } else if (width <= 768) {
              // Tablet: 2 columns
              stepsContainer.style.display = 'grid';
              stepsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
              stepsContainer.style.gap = '1.5rem';
              stepsContainer.style.paddingTop = '2rem';
            } else if (width <= 1024) {
              // Medium: 3 columns
              stepsContainer.style.display = 'grid';
              stepsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
              stepsContainer.style.gap = '1rem';
              stepsContainer.style.paddingTop = '1.5rem';
            } else {
              // Desktop: 5 columns (original)
              stepsContainer.style.display = 'grid';
              stepsContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
              stepsContainer.style.gap = '1rem';
              stepsContainer.style.paddingTop = '6rem';
            }
            
            // Hide the boat animation line on mobile/tablet
            const boatLine = procesoSection.querySelector('svg, .absolute.top-1\\/2');
            if (boatLine && width <= 768) {
              boatLine.style.display = 'none';
            } else if (boatLine) {
              boatLine.style.display = '';
            }
          };
          
          // Apply on load
          applyResponsiveLayout();
          
          // Apply on resize
          window.addEventListener('resize', applyResponsiveLayout);
          
          console.log('[Responsive Proceso] Layout applied');
        }
      }
    }, 500);
    
    // Stop checking after 15 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addResponsiveStyles();
      setTimeout(makeProcesoResponsive, 1000);
    });
  } else {
    addResponsiveStyles();
    setTimeout(makeProcesoResponsive, 1000);
  }

})();
