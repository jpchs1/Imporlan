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

    // Collect all siblings from Inspecciones h3 onward until the YouTube button link
    var wrapper = document.createElement('div');
    wrapper.className = 'tr-videos-hidden';

    var current = inspeccionesH3;
    var elementsToMove = [];
    while (current) {
      var next = current.nextElementSibling;
      // Stop before the YouTube "Ver Todos" button (it's an <a> with a <button> inside)
      if (current.tagName === 'A' && current.querySelector('button')) {
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

    // Find all <ul> elements inside pricing cards
    var allUls = planesSection.querySelectorAll('ul');
    if (allUls.length === 0) return false;

    var processed = 0;
    for (var i = 0; i < allUls.length; i++) {
      var ul = allUls[i];
      // Wrap each UL in collapsible container
      var wrapper = document.createElement('div');
      wrapper.className = 'tr-collapsible-body';
      ul.parentNode.insertBefore(wrapper, ul);
      wrapper.appendChild(ul);

      // Find the price or h3 heading before this wrapper to make it toggle
      var prevEl = wrapper.previousElementSibling;
      while (prevEl && prevEl.tagName !== 'H3' && !prevEl.textContent.match(/CLP/)) {
        prevEl = prevEl.previousElementSibling;
      }

      // Add a small "Ver detalles" link below the wrapper
      var detailBtn = document.createElement('button');
      detailBtn.className = 'tr-toggle-btn';
      detailBtn.style.cssText = 'margin:10px auto 0;padding:8px 20px;font-size:0.8rem;';
      detailBtn.setAttribute('aria-expanded', 'false');
      detailBtn.innerHTML = '<span>Ver detalles</span>' + chevronSvg;
      detailBtn._labelCollapsed = 'Ver detalles';
      detailBtn._labelExpanded = 'Ocultar detalles';
      wrapper.parentNode.insertBefore(detailBtn, wrapper.nextSibling);
      attachToggle(detailBtn, wrapper, null);
      processed++;
    }

    return processed > 0;
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
