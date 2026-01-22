/**
 * Image Optimizer for Core Web Vitals
 * - Converts images to WebP format when supported
 * - Implements lazy loading for images
 * - Adds width/height attributes to prevent CLS
 */

(function() {
  'use strict';

  // Check WebP support
  function supportsWebP() {
    var canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  }

  var webpSupported = supportsWebP();

  // WebP image mappings
  var webpMappings = {
    'BOATIMPORLAN.jpg': 'BOATIMPORLAN.webp',
    'bandera-chile-usa.png': 'bandera-chile-usa.webp',
    'lancha-towing.jpeg': 'lancha-towing.webp',
    'loader.png': 'loader.webp',
    'thumb1.png': 'thumb1.webp',
    'thumb2.png': 'thumb2.webp',
    'logo.png': 'logo.webp',
    'logo-imporlan-azul.png': 'logo-imporlan-azul.webp'
  };

  // Convert image src to WebP if available
  function convertToWebP(src) {
    if (!webpSupported || !src) return src;
    
    for (var original in webpMappings) {
      if (src.indexOf(original) !== -1) {
        return src.replace(original, webpMappings[original]);
      }
    }
    return src;
  }

  // Apply lazy loading and WebP conversion to images
  function optimizeImages() {
    var images = document.querySelectorAll('img');
    
    images.forEach(function(img) {
      // Skip already processed images
      if (img.dataset.optimized) return;
      
      // Add lazy loading for images below the fold
      if (!img.loading) {
        img.loading = 'lazy';
      }
      
      // Add decoding async for better performance
      if (!img.decoding) {
        img.decoding = 'async';
      }
      
      // Convert to WebP if supported
      if (webpSupported && img.src) {
        var newSrc = convertToWebP(img.src);
        if (newSrc !== img.src) {
          // Preload WebP image
          var preload = new Image();
          preload.onload = function() {
            img.src = newSrc;
          };
          preload.onerror = function() {
            // Keep original if WebP fails
          };
          preload.src = newSrc;
        }
      }
      
      // Mark as optimized
      img.dataset.optimized = 'true';
    });
  }

  // Observe DOM for dynamically added images
  function observeImages() {
    if (!window.MutationObserver) return;
    
    var observer = new MutationObserver(function(mutations) {
      var hasNewImages = mutations.some(function(mutation) {
        return Array.from(mutation.addedNodes).some(function(node) {
          return node.nodeName === 'IMG' || 
                 (node.querySelectorAll && node.querySelectorAll('img').length > 0);
        });
      });
      
      if (hasNewImages) {
        optimizeImages();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize when DOM is ready
  function init() {
    // Initial optimization
    optimizeImages();
    
    // Watch for new images
    observeImages();
    
    // Re-run after React renders (for SPA)
    setTimeout(optimizeImages, 1000);
    setTimeout(optimizeImages, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.imageOptimizer = {
    webpSupported: webpSupported,
    optimizeImages: optimizeImages
  };

})();
