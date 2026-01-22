/**
 * Center Cards Script for "Por que elegir Imporlan" section
 * Consolidated version - replaces multiple duplicate scripts
 * Updated to match production centering behavior
 */
(function() {
  'use strict';

  function centerFeatureCards() {
    // Find all sections
    var sections = document.querySelectorAll('section');
    sections.forEach(function(section) {
      var h2 = section.querySelector('h2');
      if (h2 && h2.textContent && h2.textContent.includes('Por que elegir')) {
        // Navigate to the relative z-10 container first, then find the grid
        var contentDiv = section.querySelector('.relative.z-10') || section;
        var gridContainer = contentDiv.querySelector('.grid') || contentDiv.querySelector('div');
        
        if (gridContainer) {
          // Get all direct child divs (the cards)
          var cards = gridContainer.children;
          for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            // Check if this is a feature card (has svg and h3)
            if (card.querySelector && card.querySelector('svg') && card.querySelector('h3')) {
              card.style.textAlign = 'center';
              
              // Center the icon wrapper (div with rounded-2xl class)
              var iconWrapper = card.querySelector('.rounded-2xl');
              if (iconWrapper) {
                iconWrapper.style.marginLeft = 'auto';
                iconWrapper.style.marginRight = 'auto';
              }
              
              // Center the icon container (first child div or svg)
              var iconContainer = card.querySelector('div:first-child') || card.querySelector('svg');
              if (iconContainer) {
                iconContainer.style.marginLeft = 'auto';
                iconContainer.style.marginRight = 'auto';
              }
              
              // Also try to center direct svg
              var svg = card.querySelector(':scope > svg');
              if (svg) {
                svg.style.marginLeft = 'auto';
                svg.style.marginRight = 'auto';
                svg.style.display = 'block';
              }
              
              // Center h3 elements
              var h3 = card.querySelector('h3');
              if (h3) {
                h3.style.textAlign = 'center';
              }
              
              // Center paragraph/description text
              var paragraphs = card.querySelectorAll('p');
              paragraphs.forEach(function(p) {
                p.style.textAlign = 'center';
              });
            }
          }
        }
      }
    });
  }
  
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(centerFeatureCards, 500);
      setTimeout(centerFeatureCards, 1500);
      setTimeout(centerFeatureCards, 3000);
    });
  } else {
    setTimeout(centerFeatureCards, 500);
    setTimeout(centerFeatureCards, 1500);
    setTimeout(centerFeatureCards, 3000);
  }
  
  // Use MutationObserver for dynamic changes
  var observer = new MutationObserver(function(mutations) {
    centerFeatureCards();
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
