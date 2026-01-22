/**
 * Center Cards Script for "Por que elegir Imporlan" section
 * Consolidated version - replaces multiple duplicate scripts
 */
(function() {
  'use strict';

  function centerCards() {
    var h2s = document.querySelectorAll('h2');
    h2s.forEach(function(h2) {
      if (h2.textContent && h2.textContent.includes('Por que elegir')) {
        var section = h2.closest('section');
        if (section) {
          // Try multiple selectors to find the grid container
          var gridDiv = section.querySelector('div.relative > div') || 
                        section.querySelector('div');
          
          if (gridDiv && gridDiv.children.length >= 4) {
            for (var i = 0; i < gridDiv.children.length; i++) {
              var card = gridDiv.children[i];
              // Check if this looks like a feature card
              if (card.querySelector('svg') && card.querySelector('h3')) {
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.textAlign = 'center';
                
                // Center the icon container
                var iconDiv = card.querySelector('div');
                if (iconDiv) {
                  iconDiv.style.marginLeft = 'auto';
                  iconDiv.style.marginRight = 'auto';
                }
              }
            }
          }
        }
      }
    });
  }
  
  // Run multiple times to catch React renders
  setTimeout(centerCards, 100);
  setTimeout(centerCards, 500);
  setTimeout(centerCards, 1000);
  setTimeout(centerCards, 2000);
  setTimeout(centerCards, 3000);
  
  // Use MutationObserver for dynamic changes
  var observer = new MutationObserver(function(mutations) {
    centerCards();
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
