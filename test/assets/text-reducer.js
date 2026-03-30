/**
 * Imporlan Text Reducer - Production Home
 * Reduces visible text on Home page without affecting SEO.
 * Uses max-height:0 / overflow:hidden (NOT display:none) so content stays in DOM for crawlers.
 * 
 * Targets:
 * 1. Videos section - collapses "Inspecciones" and "Videos Explicativos" sub-sections
 * 2. Cotiza tu Lancha - collapses "Beneficios de Cotizar" list
 * 3. Planes de Busqueda - collapses feature lists inside pricing cards
 * 
 * Version 1.0
 */

(function() {
  'use strict';

  // ============================================
  // STYLES
  // ============================================

  function addTextReducerStyles() {
    if (document.getElementById('text-reducer-styles')) return;

    var style = document.createElement('style');
    style.id = 'text-reducer-styles';
    style.textContent = '\
      /* ---- Collapsible wrapper ---- */\
      .tr-collapsible-body {\
        max-height: 0;\
        overflow: hidden;\
        transition: max-height 0.45s ease, opacity 0.3s ease;\
        opacity: 0;\
      }\
      .tr-collapsible-body.tr-expanded {\
        max-height: 2000px;\
        opacity: 1;\
      }\
      \
      /* ---- Toggle button ---- */\
      .tr-toggle-btn {\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        gap: 8px;\
        margin: 20px auto 0;\
        background: linear-gradient(135deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 12px;\
        padding: 12px 28px;\
        color: #60a5fa;\
        font-size: 0.9rem;\
        font-weight: 600;\
        cursor: pointer;\
        transition: all 0.3s ease;\
        font-family: inherit;\
      }\
      .tr-toggle-btn:hover {\
        border-color: #3b82f6;\
        background: linear-gradient(135deg, #253f6a 0%, #1a3050 100%);\
        transform: translateY(-2px);\
        box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);\
      }\
      .tr-toggle-btn svg {\
        width: 16px;\
        height: 16px;\
        transition: transform 0.3s ease;\
      }\
      .tr-toggle-btn.tr-btn-expanded svg {\
        transform: rotate(180deg);\
      }\
      \
      /* ---- Videos section: hide sub-categories ---- */\
      .tr-videos-hidden {\
        max-height: 0;\
        overflow: hidden;\
        opacity: 0;\
        transition: max-height 0.45s ease, opacity 0.3s ease;\
      }\
      .tr-videos-hidden.tr-expanded {\
        max-height: 3000px;\
        opacity: 1;\
      }\
      \
      /* ---- Planes de Busqueda: equal-height cards fix ---- */\
      .tr-planes-grid {\
        display: grid !important;\
        grid-template-columns: repeat(3, 1fr) !important;\
        gap: 24px !important;\
        align-items: stretch !important;\
      }\
      .tr-planes-grid > div {\
        display: flex !important;\
        flex-direction: column !important;\
      }\
      .tr-planes-card-inner {\
        display: flex !important;\
        flex-direction: column !important;\
        flex: 1 !important;\
        justify-content: space-between !important;\
      }\
      .tr-planes-card-bottom {\
        margin-top: auto !important;\
        padding-top: 16px !important;\
      }\
      @media (max-width: 768px) {\
        .tr-planes-grid {\
          grid-template-columns: 1fr !important;\
        }\
      }\
      @media (min-width: 769px) and (max-width: 1023px) {\
        .tr-planes-grid {\
          grid-template-columns: repeat(3, 1fr) !important;\
          gap: 16px !important;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  var chevronSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  // ============================================
  // HELPER: Create toggle button
  // ============================================

  function createToggleBtn(labelCollapsed, labelExpanded) {
    var btn = document.createElement('button');
    btn.className = 'tr-toggle-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span>' + labelCollapsed + '</span>' + chevronSvg;
    btn._labelCollapsed = labelCollapsed;
    btn._labelExpanded = labelExpanded;
    return btn;
  }

  function attachToggle(btn, targetEl, scrollBackEl) {
    btn.addEventListener('click', function() {
      var isExpanded = targetEl.classList.contains('tr-expanded');
      if (isExpanded) {
        targetEl.classList.remove('tr-expanded');
        btn.classList.remove('tr-btn-expanded');
        btn.querySelector('span').textContent = btn._labelCollapsed;
        btn.setAttribute('aria-expanded', 'false');
        if (scrollBackEl) {
          scrollBackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        targetEl.classList.add('tr-expanded');
        btn.classList.add('tr-btn-expanded');
        btn.querySelector('span').textContent = btn._labelExpanded;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // ============================================
  // HELPER: Find section by heading text
  // ============================================

  function findSectionByHeading(searchText) {
    var sections = document.querySelectorAll('section');
    for (var i = 0; i < sections.length; i++) {
      var heading = sections[i].querySelector('h2');
      if (heading && heading.textContent.toUpperCase().indexOf(searchText.toUpperCase()) !== -1) {
        return sections[i];
      }
    }
    return null;
  }

  // ============================================
  // 1. VIDEOS SECTION: Collapse Inspecciones + Videos Explicativos
  // ============================================

  function reduceVideosSection() {
    var videosSection = findSectionByHeading('Videos Imporlan');
    if (!videosSection) return false;

    // Already processed
    if (videosSection.querySelector('.tr-videos-hidden')) return true;

    // Find all h3 sub-headings in the Videos section
    var allH3 = videosSection.querySelectorAll('h3');
    if (allH3.length < 3) return false; // Need at least "Ultimas importaciones", "Clientes Contentos", "Inspecciones"

    // Find "Inspecciones" heading - everything from it onward (except the YouTube button) should be collapsed
    var inspeccionesH3 = null;
    for (var i = 0; i < allH3.length; i++) {
      if (allH3[i].textContent.trim().toLowerCase().indexOf('inspecciones') !== -1) {
        inspeccionesH3 = allH3[i];
        break;
      }
    }

    if (!inspeccionesH3) return false;

    // The h3 is nested inside div.max-w-[1400px] inside div.mb-10
    // We need to walk at the div.mb-10 container level
    var inspeccionesContainer = inspeccionesH3.closest('.mb-10') || inspeccionesH3.parentElement.parentElement;
    if (!inspeccionesContainer || !inspeccionesContainer.parentElement) return false;

    // Collect all div.mb-10 siblings from Inspecciones onward
    var wrapper = document.createElement('div');
    wrapper.className = 'tr-videos-hidden';

    var current = inspeccionesContainer;
    var elementsToMove = [];
    while (current) {
      var next = current.nextElementSibling;
      // Stop before the YouTube "Ver Todos" button container (div.text-center with an <a><button>)
      if (current.querySelector && current.querySelector('a > button')) {
        break;
      }
      elementsToMove.push(current);
      current = next;
    }

    if (elementsToMove.length === 0) return false;

    // Insert wrapper before the first element to move
    var parent = elementsToMove[0].parentNode;
    parent.insertBefore(wrapper, elementsToMove[0]);

    // Move elements into wrapper
    for (var j = 0; j < elementsToMove.length; j++) {
      wrapper.appendChild(elementsToMove[j]);
    }

    // Add toggle button
    var btn = createToggleBtn('Ver mas videos', 'Ver menos videos');
    parent.insertBefore(btn, wrapper.nextSibling);
    attachToggle(btn, wrapper, videosSection);

    return true;
  }

  // ============================================
  // 2. COTIZA TU LANCHA: Collapse "Beneficios de Cotizar" list
  // ============================================

  function reduceCotizaSection() {
    var cotizaSection = findSectionByHeading('Cotiza tu Lancha');
    if (!cotizaSection) return false;

    // Already processed
    if (cotizaSection.querySelector('.tr-collapsible-body')) return true;

    // Find the "Beneficios de Cotizar" h3
    var allH3 = cotizaSection.querySelectorAll('h3');
    var beneficiosH3 = null;
    for (var i = 0; i < allH3.length; i++) {
      if (allH3[i].textContent.toLowerCase().indexOf('beneficios') !== -1) {
        beneficiosH3 = allH3[i];
        break;
      }
    }
    if (!beneficiosH3) return false;

    // Find the <ul> that follows this h3
    var ul = beneficiosH3.nextElementSibling;
    while (ul && ul.tagName !== 'UL') {
      ul = ul.nextElementSibling;
    }
    if (!ul) return false;

    // Wrap the UL in a collapsible container
    var wrapper = document.createElement('div');
    wrapper.className = 'tr-collapsible-body';
    ul.parentNode.insertBefore(wrapper, ul);
    wrapper.appendChild(ul);

    // Make the h3 clickable to toggle
    beneficiosH3.style.cursor = 'pointer';
    beneficiosH3.style.userSelect = 'none';

    // Add a small chevron to the h3
    var toggleIcon = document.createElement('span');
    toggleIcon.innerHTML = chevronSvg;
    toggleIcon.style.cssText = 'display:inline-flex;margin-left:8px;width:18px;height:18px;transition:transform 0.3s ease;color:#60a5fa;vertical-align:middle;';
    beneficiosH3.appendChild(toggleIcon);

    beneficiosH3.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('tr-expanded');
      if (isExpanded) {
        wrapper.classList.remove('tr-expanded');
        toggleIcon.style.transform = 'rotate(0deg)';
      } else {
        wrapper.classList.add('tr-expanded');
        toggleIcon.style.transform = 'rotate(180deg)';
      }
    });

    return true;
  }

  // ============================================
  // 3. PLANES DE BUSQUEDA: Collapse feature lists in pricing cards
  // ============================================

  function reducePlanesSection() {
    var planesSection = findSectionByHeading('Planes de Busqueda');
    if (!planesSection) return false;

    // Already processed
    if (planesSection.querySelector('.tr-collapsible-body')) return true;

    // Find the grid container (md:grid-cols-3) that holds the plan cards
    var gridContainer = planesSection.querySelector('.grid.md\\:grid-cols-3, [class*="grid"][class*="md:grid-cols-3"]');
    if (!gridContainer) {
      // Fallback: find by structure - a div with 3 direct card children
      var divs = planesSection.querySelectorAll('div');
      for (var d = 0; d < divs.length; d++) {
        var cls = divs[d].className || '';
        if (cls.indexOf('grid') !== -1 && cls.indexOf('grid-cols-3') !== -1) {
          gridContainer = divs[d];
          break;
        }
      }
    }

    // Apply equal-height grid fix
    if (gridContainer) {
      gridContainer.classList.add('tr-planes-grid');

      // Fix each card's internal layout
      var cards = gridContainer.children;
      for (var c = 0; c < cards.length; c++) {
        var card = cards[c];
        // Find the button (Contratar Ahora) and the UL inside each card
        var btn = card.querySelector('button');
        var ul = card.querySelector('ul');

        if (ul) {
          // Wrap content above button as top section, button area as bottom
          var wrapper = document.createElement('div');
          wrapper.className = 'tr-collapsible-body';
          ul.parentNode.insertBefore(wrapper, ul);
          wrapper.appendChild(ul);

          // Add "Ver detalles" toggle
          var detailBtn = document.createElement('button');
          detailBtn.className = 'tr-toggle-btn';
          detailBtn.style.cssText = 'margin:10px auto 0;padding:8px 20px;font-size:0.8rem;';
          detailBtn.setAttribute('aria-expanded', 'false');
          detailBtn.innerHTML = '<span>Ver detalles</span>' + chevronSvg;
          detailBtn._labelCollapsed = 'Ver detalles';
          detailBtn._labelExpanded = 'Ocultar detalles';
          wrapper.parentNode.insertBefore(detailBtn, wrapper.nextSibling);
          attachToggle(detailBtn, wrapper, null);
        }

        // Wrap the "Contratar Ahora" button area to push it to the bottom
        if (btn && btn.textContent.indexOf('Contratar') !== -1) {
          var bottomWrap = btn.closest('div');
          if (bottomWrap && !bottomWrap.classList.contains('tr-planes-card-bottom')) {
            bottomWrap.classList.add('tr-planes-card-bottom');
          }
        }

        // Make the card's inner content flex-column
        var innerContent = card.querySelector('[class*="p-8"], [class*="p-6"]');
        if (innerContent) {
          innerContent.classList.add('tr-planes-card-inner');
        } else {
          card.classList.add('tr-planes-card-inner');
        }
      }
    } else {
      // Fallback: just collapse ULs without grid fix
      var allUls = planesSection.querySelectorAll('ul');
      if (allUls.length === 0) return false;

      for (var i = 0; i < allUls.length; i++) {
        var ulEl = allUls[i];
        var wrapperEl = document.createElement('div');
        wrapperEl.className = 'tr-collapsible-body';
        ulEl.parentNode.insertBefore(wrapperEl, ulEl);
        wrapperEl.appendChild(ulEl);

        var detailBtnEl = document.createElement('button');
        detailBtnEl.className = 'tr-toggle-btn';
        detailBtnEl.style.cssText = 'margin:10px auto 0;padding:8px 20px;font-size:0.8rem;';
        detailBtnEl.setAttribute('aria-expanded', 'false');
        detailBtnEl.innerHTML = '<span>Ver detalles</span>' + chevronSvg;
        detailBtnEl._labelCollapsed = 'Ver detalles';
        detailBtnEl._labelExpanded = 'Ocultar detalles';
        wrapperEl.parentNode.insertBefore(detailBtnEl, wrapperEl.nextSibling);
        attachToggle(detailBtnEl, wrapperEl, null);
      }
    }

    return true;
  }

  // ============================================
  // MAIN: Run after React renders
  // ============================================

  function applyTextReductions() {
    // Don't run on panel pages
    if (window.location.pathname.indexOf('/panel') !== -1) return;

    addTextReducerStyles();

    var videosOk = reduceVideosSection();
    var cotizaOk = reduceCotizaSection();
    var planesOk = reducePlanesSection();

    // If not all sections are ready, retry (React may still be rendering)
    if (!videosOk || !cotizaOk || !planesOk) {
      var retryCount = 0;
      var maxRetries = 20;
      var retryInterval = setInterval(function() {
        retryCount++;
        if (!videosOk) videosOk = reduceVideosSection();
        if (!cotizaOk) cotizaOk = reduceCotizaSection();
        if (!planesOk) planesOk = reducePlanesSection();

        if ((videosOk && cotizaOk && planesOk) || retryCount >= maxRetries) {
          clearInterval(retryInterval);
          if (videosOk && cotizaOk && planesOk) {
            console.log('[Text Reducer] All sections reduced successfully');
          } else {
            console.log('[Text Reducer] Applied reductions to available sections (videos=' + videosOk + ', cotiza=' + cotizaOk + ', planes=' + planesOk + ')');
          }
        }
      }, 500);
    } else {
      console.log('[Text Reducer] All sections reduced successfully');
    }
  }

  // Wait for DOM + React
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(applyTextReductions, 2000);
    });
  } else {
    setTimeout(applyTextReductions, 2000);
  }

})();
