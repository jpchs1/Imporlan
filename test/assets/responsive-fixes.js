/**
 * Responsive Fixes for Imporlan Landing Page
 * This script applies responsive design fixes and updates step 5 text
 * Version: 20260119
 */

(function() {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // ============================================
  // 1. UPDATE STEP 5 TEXT
  // Change "Recibe tu lancha en el puerto de San Antonio, Chile"
  // to "Recibe la embarcacion donde tu quieras!"
  // ============================================
  
  function updateStep5Text() {
    const checkInterval = setInterval(function() {
      // Find all text nodes that contain the old text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      let found = false;
      while (node = walker.nextNode()) {
        if (node.textContent.includes('Recibe tu lancha en el puerto de San Antonio')) {
          node.textContent = node.textContent.replace(
            'Recibe tu lancha en el puerto de San Antonio, Chile',
            'Recibe la embarcacion donde tu quieras!'
          );
          found = true;
        }
        // Also check for variations
        if (node.textContent.includes('puerto de San Antonio')) {
          node.textContent = node.textContent.replace(
            /Recibe tu (lancha|embarcacion) en el puerto de San Antonio,? Chile/gi,
            'Recibe la embarcacion donde tu quieras!'
          );
          found = true;
        }
      }
      
      if (found) {
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Stop checking after 15 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  // ============================================
  // 2. APPLY RESPONSIVE STYLES
  // Make the journey section responsive
  // ============================================
  
  function applyResponsiveStyles() {
    // Add responsive CSS
    const existingStyle = document.getElementById('responsive-fixes-style');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'responsive-fixes-style';
      style.textContent = `
        /* Responsive fixes for PROCESO DE COMPRA USA section */
        
        /* Hide animated boat line on mobile */
        @media (max-width: 767px) {
          /* Hide the animated path line on mobile */
          section:has(h2) .absolute.top-1\\/2,
          section:has(h2) [class*="absolute"][class*="top-1/2"][class*="h-1"] {
            display: none !important;
          }
          
          /* Make the grid responsive */
          section:has(h2) .grid.grid-cols-5,
          section:has(h2) [class*="grid"][class*="grid-cols-5"] {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
            padding-top: 2rem !important;
          }
          
          /* Adjust step boxes for mobile */
          section:has(h2) .grid > div {
            text-align: center;
          }
        }
        
        /* Tablet styles */
        @media (min-width: 640px) and (max-width: 767px) {
          section:has(h2) .grid.grid-cols-5,
          section:has(h2) [class*="grid"][class*="grid-cols-5"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1023px) {
          section:has(h2) .grid.grid-cols-5,
          section:has(h2) [class*="grid"][class*="grid-cols-5"] {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        
        /* Ensure all step descriptions are visible (no opacity animation) */
        section:has(h2) .grid p,
        section:has(h2) [class*="grid"] p {
          opacity: 1 !important;
          color: #d1d5db !important;
        }
        
        /* Fix image paths for /test/ subdirectory */
        img[src="/images/BOATIMPORLAN.jpg"] {
          content: url("/test/images/BOATIMPORLAN.jpg");
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ============================================
  // 3. FIX IMAGE PATHS FOR /test/ SUBDIRECTORY
  // ============================================
  
  function fixImagePaths() {
    const checkInterval = setInterval(function() {
      const images = document.querySelectorAll('img');
      images.forEach(function(img) {
        if (img.src.includes('/images/') && !img.src.includes('/test/images/')) {
          const newSrc = img.src.replace('/images/', '/test/images/');
          img.src = newSrc;
        }
      });
      
      // Also check for background images
      const allElements = document.querySelectorAll('*');
      allElements.forEach(function(el) {
        const bgImage = window.getComputedStyle(el).backgroundImage;
        if (bgImage && bgImage.includes('/images/') && !bgImage.includes('/test/images/')) {
          el.style.backgroundImage = bgImage.replace('/images/', '/test/images/');
        }
      });
    }, 1000);
    
    // Stop after 10 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  onReady(function() {
    // Small delay to let React render
    setTimeout(function() {
      applyResponsiveStyles();
      updateStep5Text();
      fixImagePaths();
    }, 1500);
    
    // Run again after a longer delay to catch any late renders
    setTimeout(function() {
      updateStep5Text();
      fixImagePaths();
    }, 5000);
  });
  
})();
