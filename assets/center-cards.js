/**
 * Center Cards Script for "Por que elegir Imporlan" section
 * Consolidated version - replaces multiple duplicate scripts
 * Updated to match production centering behavior
 * v4 - Added logging and improved timing
 */
(function() {
  'use strict';
  
  var centered = false;

  function centerFeatureCards() {
    // Find all sections
    var sections = document.querySelectorAll('section');
    var found = false;
    
    sections.forEach(function(section) {
      var h2 = section.querySelector('h2');
      if (h2 && h2.textContent && h2.textContent.includes('Por que elegir')) {
        found = true;
        // Navigate to the relative z-10 container first, then find the grid
        var contentDiv = section.querySelector('.relative.z-10') || section;
        var gridContainer = contentDiv.querySelector('.grid') || contentDiv.querySelector('div');
        
        if (gridContainer && gridContainer.children.length >= 4) {
          // Get all direct child divs (the cards)
          var cards = gridContainer.children;
          var cardsProcessed = 0;
          
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
              
              // Center the first div (icon container)
              var firstDiv = card.querySelector('div:first-child');
              if (firstDiv) {
                firstDiv.style.marginLeft = 'auto';
                firstDiv.style.marginRight = 'auto';
              }
              
              // Also try to center direct svg
              var svg = card.querySelector('svg');
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
              
              cardsProcessed++;
            }
          }
          
          if (cardsProcessed >= 4 && !centered) {
            centered = true;
            console.log('[Center Cards] Successfully centered ' + cardsProcessed + ' cards');
          }
        }
      }
    });
    
    return found && centered;
  }
  
  // Run multiple times to catch React rendering
  function runCentering() {
    var delays = [100, 300, 500, 1000, 1500, 2000, 3000, 5000];
    delays.forEach(function(delay) {
      setTimeout(function() {
        if (!centered) {
          centerFeatureCards();
        }
      }, delay);
    });
  }
  
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCentering);
  } else {
    runCentering();
  }
  
  // Use MutationObserver for dynamic changes
  var observer = new MutationObserver(function(mutations) {
    if (!centered) {
      centerFeatureCards();
    }
  });
  
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
})();
