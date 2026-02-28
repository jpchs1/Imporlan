/**
 * Imporlan Mobile UX Optimizer
 * SEO-safe mobile optimization for the HOME page
 * 
 * Strategy:
 * - On mobile (<= 768px): Collapse long text sections with "Leer mas" buttons
 * - All content remains in the DOM for SEO crawlability
 * - Uses CSS max-height + overflow:hidden for visual truncation
 * - Desktop experience remains completely unchanged
 * - No content is removed, only visually collapsed on mobile
 * 
 * Targets:
 * 1. Lanchas Usadas SEO content blocks (long paragraphs + lists)
 * 2. Lanchas FAQ section (accordion treatment)
 * 3. Marketplace section subtitle
 * 4. Nuevas Lineas bottom text
 * 5. Cotiza section benefits
 * 6. General performance improvements
 * 
 * Version: 1.0
 */

(function() {
  'use strict';

  // Only run on Home page
  if (window.location.pathname.indexOf('/panel') !== -1) return;

  var MOBILE_BREAKPOINT = 768;
  var initialized = false;

  // ============================================
  // CSS STYLES
  // ============================================

  function addMobileUXStyles() {
    if (document.getElementById('mobile-ux-optimizer-styles')) return;

    var style = document.createElement('style');
    style.id = 'mobile-ux-optimizer-styles';
    style.textContent = [
      '/* ============================================ */',
      '/* Mobile UX Optimizer - SEO Safe Collapsibles  */',
      '/* ============================================ */',
      '',
      '/* Collapsible container base styles */',
      '.mux-collapsible {',
      '  position: relative;',
      '  overflow: hidden;',
      '  transition: max-height 0.4s ease;',
      '}',
      '',
      '/* Gradient fade overlay when collapsed */',
      '.mux-collapsible::after {',
      '  content: "";',
      '  position: absolute;',
      '  bottom: 0;',
      '  left: 0;',
      '  right: 0;',
      '  height: 60px;',
      '  background: linear-gradient(to bottom, transparent, #152a45);',
      '  pointer-events: none;',
      '  opacity: 1;',
      '  transition: opacity 0.3s ease;',
      '}',
      '',
      '.mux-collapsible.mux-expanded::after {',
      '  opacity: 0;',
      '}',
      '',
      '/* For dark section backgrounds */',
      '.lanchas-usadas-seo .mux-collapsible::after {',
      '  background: linear-gradient(to bottom, transparent, #152a45);',
      '}',
      '',
      '.marketplace-section .mux-collapsible::after,',
      '.nuevas-lineas-section .mux-collapsible::after {',
      '  background: linear-gradient(to bottom, transparent, #0d1f3c);',
      '}',
      '',
      '.lanchas-faq-item .mux-collapsible::after {',
      '  background: linear-gradient(to bottom, transparent, rgba(30, 58, 95, 0.8));',
      '}',
      '',
      '/* Toggle button styles */',
      '.mux-toggle-btn {',
      '  display: none;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '  background: rgba(59, 130, 246, 0.12);',
      '  border: 1px solid rgba(59, 130, 246, 0.25);',
      '  color: #60a5fa;',
      '  font-size: 0.85rem;',
      '  font-weight: 600;',
      '  padding: 8px 20px;',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  margin-top: 12px;',
      '  width: 100%;',
      '  transition: all 0.2s ease;',
      '  -webkit-tap-highlight-color: transparent;',
      '  touch-action: manipulation;',
      '}',
      '',
      '.mux-toggle-btn:active {',
      '  background: rgba(59, 130, 246, 0.2);',
      '}',
      '',
      '.mux-toggle-btn svg {',
      '  width: 16px;',
      '  height: 16px;',
      '  transition: transform 0.3s ease;',
      '}',
      '',
      '.mux-toggle-btn.mux-expanded svg {',
      '  transform: rotate(180deg);',
      '}',
      '',
      '/* FAQ Accordion styles */',
      '.mux-faq-question {',
      '  cursor: pointer;',
      '  -webkit-tap-highlight-color: transparent;',
      '  touch-action: manipulation;',
      '  position: relative;',
      '  padding-right: 28px;',
      '}',
      '',
      '.mux-faq-indicator {',
      '  position: absolute;',
      '  right: 0;',
      '  top: 50%;',
      '  transform: translateY(-50%);',
      '  width: 20px;',
      '  height: 20px;',
      '  display: none;',
      '  align-items: center;',
      '  justify-content: center;',
      '  color: #60a5fa;',
      '  transition: transform 0.3s ease;',
      '}',
      '',
      '.mux-faq-indicator.mux-expanded {',
      '  transform: translateY(-50%) rotate(180deg);',
      '}',
      '',
      '/* ============================================ */',
      '/* MOBILE ONLY STYLES (max-width: 768px)       */',
      '/* ============================================ */',
      '@media (max-width: 768px) {',
      '',
      '  /* Show toggle buttons on mobile */',
      '  .mux-toggle-btn {',
      '    display: flex;',
      '  }',
      '',
      '  /* Show FAQ indicators on mobile */',
      '  .mux-faq-indicator {',
      '    display: flex;',
      '  }',
      '',
      '  /* Collapsed state on mobile */',
      '  .mux-collapsible:not(.mux-expanded) {',
      '    /* max-height set via JS based on content */',
      '  }',
      '',
      '  /* Expanded state */',
      '  .mux-collapsible.mux-expanded {',
      '    max-height: none !important;',
      '  }',
      '',
      '  /* ---- Performance: content-visibility for below-fold sections ---- */',
      '  .lanchas-usadas-seo,',
      '  .seo-section,',
      '  .seo-pages-section,',
      '  .nuevas-lineas-section {',
      '    content-visibility: auto;',
      '    contain-intrinsic-size: auto 600px;',
      '  }',
      '',
      '  /* ---- Improved mobile spacing ---- */',
      '  .lanchas-content-block {',
      '    padding: 20px 16px;',
      '  }',
      '',
      '  .lanchas-content-block h3 {',
      '    font-size: 1.1rem;',
      '  }',
      '',
      '  .lanchas-faq-item {',
      '    padding: 18px 16px;',
      '  }',
      '',
      '  .lanchas-faq-item h4 {',
      '    font-size: 0.95rem;',
      '    line-height: 1.4;',
      '  }',
      '',
      '  .lanchas-faq-item p {',
      '    font-size: 0.85rem;',
      '  }',
      '',
      '  /* Improve CTA button touch targets on mobile */',
      '  .lanchas-cta-btn,',
      '  .marketplace-cta-btn,',
      '  .nuevas-lineas-cta-btn {',
      '    min-height: 48px;',
      '    padding: 14px 28px;',
      '  }',
      '',
      '  /* Reduce hero section text size slightly for better mobile fit */',
      '  .lanchas-usadas-seo h2 {',
      '    font-size: 1.5rem;',
      '    line-height: 1.3;',
      '  }',
      '',
      '  .lanchas-usadas-seo .section-intro {',
      '    font-size: 0.95rem;',
      '    line-height: 1.6;',
      '  }',
      '',
      '  /* Better list spacing on mobile */',
      '  .lanchas-content-block ul li {',
      '    font-size: 0.85rem;',
      '    padding: 5px 0;',
      '    padding-left: 18px;',
      '  }',
      '',
      '  .lanchas-content-block ul li::before {',
      '    width: 6px;',
      '    height: 6px;',
      '    top: 11px;',
      '  }',
      '',
      '  /* Marketplace section mobile text */',
      '  .marketplace-header .subtitle {',
      '    font-size: 0.95rem;',
      '  }',
      '',
      '  /* Improve readability of feature descriptions */',
      '  .marketplace-feature p,',
      '  .nuevas-lineas-card p {',
      '    font-size: 0.85rem;',
      '    line-height: 1.5;',
      '  }',
      '',
      '}',
      '',
      '/* ============================================ */',
      '/* DESKTOP: Ensure everything visible           */',
      '/* ============================================ */',
      '@media (min-width: 769px) {',
      '  .mux-collapsible {',
      '    max-height: none !important;',
      '    overflow: visible !important;',
      '  }',
      '',
      '  .mux-collapsible::after {',
      '    display: none !important;',
      '  }',
      '',
      '  .mux-toggle-btn {',
      '    display: none !important;',
      '  }',
      '',
      '  .mux-faq-question {',
      '    cursor: default;',
      '    padding-right: 0;',
      '  }',
      '',
      '  .mux-faq-indicator {',
      '    display: none !important;',
      '  }',
      '}',
      ''
    ].join('\n');

    document.head.appendChild(style);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  var chevronDownSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  /**
   * Wraps child elements of a container in a collapsible div.
   * Shows the first `visibleCount` children, collapses the rest.
   * All content stays in DOM for SEO.
   * @param {Element} container
   * @param {number} visibleCount
   * @param {number} [collapsedHeight]
   * @returns {Object|undefined}
   */
  /* exported makeCollapsible */
  function makeCollapsible(container, visibleCount, collapsedHeight) { // eslint-disable-line no-unused-vars
    if (!container || container.querySelector('.mux-collapsible')) return;

    var children = Array.prototype.slice.call(container.children);
    if (children.length <= visibleCount) return;

    // Create wrapper for collapsible content
    var wrapper = document.createElement('div');
    wrapper.className = 'mux-collapsible';
    wrapper.setAttribute('aria-hidden', 'false');

    // Move children after visibleCount into the wrapper
    var hiddenChildren = children.slice(visibleCount);
    hiddenChildren.forEach(function(child) {
      wrapper.appendChild(child);
    });

    container.appendChild(wrapper);

    // Set collapsed height on mobile
    if (isMobile() && collapsedHeight !== undefined) {
      wrapper.style.maxHeight = collapsedHeight + 'px';
    } else if (isMobile()) {
      wrapper.style.maxHeight = '0px';
    }

    // Create toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mux-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.innerHTML = '<span>Leer mas</span>' + chevronDownSVG;
    container.appendChild(toggleBtn);

    // Toggle handler
    toggleBtn.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('mux-expanded');

      if (isExpanded) {
        // Collapse
        wrapper.classList.remove('mux-expanded');
        wrapper.style.maxHeight = (collapsedHeight || 0) + 'px';
        toggleBtn.classList.remove('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.querySelector('span').textContent = 'Leer mas';
        wrapper.setAttribute('aria-hidden', 'false');
      } else {
        // Expand
        wrapper.classList.add('mux-expanded');
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        toggleBtn.classList.add('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('span').textContent = 'Ver menos';
        wrapper.setAttribute('aria-hidden', 'false');
      }
    });

    return { wrapper: wrapper, toggleBtn: toggleBtn };
  }

  /**
   * Makes a single block collapsible by setting a max-height on the block itself.
   * Useful for content blocks where we want to show a preview.
   */
  function makeBlockCollapsible(block, collapsedHeight) {
    if (!block || block.classList.contains('mux-processed')) return;
    block.classList.add('mux-processed');

    // Wrap the content that should collapse
    var wrapper = document.createElement('div');
    wrapper.className = 'mux-collapsible';
    wrapper.setAttribute('aria-hidden', 'false');

    // Move all children into wrapper
    while (block.firstChild) {
      wrapper.appendChild(block.firstChild);
    }
    block.appendChild(wrapper);

    // Set collapsed height on mobile
    if (isMobile()) {
      wrapper.style.maxHeight = collapsedHeight + 'px';
    }

    // Create toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mux-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.innerHTML = '<span>Leer mas</span>' + chevronDownSVG;
    block.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('mux-expanded');

      if (isExpanded) {
        wrapper.classList.remove('mux-expanded');
        wrapper.style.maxHeight = collapsedHeight + 'px';
        toggleBtn.classList.remove('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.querySelector('span').textContent = 'Leer mas';
      } else {
        wrapper.classList.add('mux-expanded');
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        toggleBtn.classList.add('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('span').textContent = 'Ver menos';
      }
    });

    return { wrapper: wrapper, toggleBtn: toggleBtn };
  }

  // ============================================
  // 1. LANCHAS USADAS CONTENT BLOCKS
  // Collapse paragraphs and lists, show only h3 + first paragraph
  // ============================================

  function optimizeLanchasUsadasSection() {
    var section = document.getElementById('lanchas-usadas-chile');
    if (!section || section.classList.contains('mux-optimized')) return false;

    var contentBlocks = section.querySelectorAll('.lanchas-content-block');
    if (contentBlocks.length === 0) return false;

    contentBlocks.forEach(function(block) {
      // Each block has: h3, p, p (optional), ul
      // Show h3 + first p, collapse rest
      var paragraphs = block.querySelectorAll('p');
      var list = block.querySelector('ul');

      if (paragraphs.length <= 1 && !list) return;

      // Calculate collapsed height: h3 height + first p + some padding
      // We'll use a fixed collapsed height that shows the heading + first paragraph
      makeBlockCollapsible(block, 120);
    });

    section.classList.add('mux-optimized');
    return true;
  }

  // ============================================
  // 2. LANCHAS FAQ ACCORDION
  // Show questions, collapse answers on mobile
  // ============================================

  function optimizeLanchasFAQ() {
    var section = document.getElementById('lanchas-usadas-chile');
    if (!section) return false;

    var faqSection = section.querySelector('.lanchas-faq-section');
    if (!faqSection || faqSection.classList.contains('mux-optimized')) return false;

    var faqItems = faqSection.querySelectorAll('.lanchas-faq-item');
    if (faqItems.length === 0) return false;

    faqItems.forEach(function(item) {
      var question = item.querySelector('h4');
      var answer = item.querySelector('p');
      if (!question || !answer) return;

      // Add clickable question styling
      question.classList.add('mux-faq-question');

      // Add expand/collapse indicator
      var indicator = document.createElement('span');
      indicator.className = 'mux-faq-indicator';
      indicator.innerHTML = chevronDownSVG;
      question.style.position = 'relative';
      question.appendChild(indicator);

      // Wrap answer in collapsible
      var wrapper = document.createElement('div');
      wrapper.className = 'mux-collapsible';
      wrapper.setAttribute('aria-hidden', 'false');

      // Move answer into wrapper
      answer.parentNode.insertBefore(wrapper, answer);
      wrapper.appendChild(answer);

      // Set collapsed height on mobile
      if (isMobile()) {
        wrapper.style.maxHeight = '0px';
      }

      // Toggle on question click
      question.addEventListener('click', function() {
        if (!isMobile()) return;

        var isExpanded = wrapper.classList.contains('mux-expanded');

        if (isExpanded) {
          wrapper.classList.remove('mux-expanded');
          wrapper.style.maxHeight = '0px';
          indicator.classList.remove('mux-expanded');
        } else {
          wrapper.classList.add('mux-expanded');
          wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
          indicator.classList.add('mux-expanded');
        }
      });
    });

    faqSection.classList.add('mux-optimized');
    return true;
  }

  // ============================================
  // 3. MARKETPLACE SECTION
  // Collapse long subtitle on mobile
  // ============================================

  function optimizeMarketplaceSection() {
    var section = document.getElementById('marketplace-lanchas');
    if (!section || section.classList.contains('mux-optimized')) return false;

    var subtitle = section.querySelector('.marketplace-header .subtitle');
    if (!subtitle) return false;

    // Only collapse if text is long enough
    if (subtitle.textContent.length < 80) return false;

    // Wrap subtitle content
    var wrapper = document.createElement('div');
    wrapper.className = 'mux-collapsible';
    wrapper.setAttribute('aria-hidden', 'false');

    subtitle.parentNode.insertBefore(wrapper, subtitle);
    wrapper.appendChild(subtitle);

    if (isMobile()) {
      wrapper.style.maxHeight = '50px';
    }

    // Create toggle
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mux-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.innerHTML = '<span>Leer mas</span>' + chevronDownSVG;
    wrapper.parentNode.insertBefore(toggleBtn, wrapper.nextSibling);

    toggleBtn.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('mux-expanded');

      if (isExpanded) {
        wrapper.classList.remove('mux-expanded');
        wrapper.style.maxHeight = '50px';
        toggleBtn.classList.remove('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.querySelector('span').textContent = 'Leer mas';
      } else {
        wrapper.classList.add('mux-expanded');
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        toggleBtn.classList.add('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('span').textContent = 'Ver menos';
      }
    });

    section.classList.add('mux-optimized');
    return true;
  }

  // ============================================
  // 4. COTIZA SECTION
  // Collapse benefits list on mobile
  // ============================================

  function optimizeCotizaSection() {
    var sections = document.querySelectorAll('section');
    var cotizaSection = null;

    for (var i = 0; i < sections.length; i++) {
      var h2 = sections[i].querySelector('h2');
      if (h2 && h2.textContent.indexOf('Cotiza tu Lancha') !== -1) {
        cotizaSection = sections[i];
        break;
      }
    }

    if (!cotizaSection || cotizaSection.classList.contains('mux-optimized')) return false;

    // Find the benefits section (h3 with "Beneficios")
    var h3s = cotizaSection.querySelectorAll('h3');
    var benefitsH3 = null;

    for (var j = 0; j < h3s.length; j++) {
      if (h3s[j].textContent.indexOf('Beneficios') !== -1) {
        benefitsH3 = h3s[j];
        break;
      }
    }

    if (!benefitsH3) return false;

    // Find the UL that follows the benefits heading
    var benefitsList = benefitsH3.nextElementSibling;
    if (!benefitsList || benefitsList.tagName !== 'UL') {
      // Search siblings
      var sibling = benefitsH3.parentElement;
      if (sibling) {
        var lists = sibling.querySelectorAll('ul');
        if (lists.length > 0) {
          benefitsList = lists[0];
        }
      }
    }

    if (!benefitsList) return false;

    // Wrap benefits heading + list in collapsible
    var wrapper = document.createElement('div');
    wrapper.className = 'mux-collapsible';
    wrapper.setAttribute('aria-hidden', 'false');

    benefitsH3.parentNode.insertBefore(wrapper, benefitsH3);
    wrapper.appendChild(benefitsH3);
    wrapper.appendChild(benefitsList);

    if (isMobile()) {
      wrapper.style.maxHeight = '0px';
    }

    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mux-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.innerHTML = '<span>Ver beneficios</span>' + chevronDownSVG;
    wrapper.parentNode.insertBefore(toggleBtn, wrapper.nextSibling);

    toggleBtn.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('mux-expanded');

      if (isExpanded) {
        wrapper.classList.remove('mux-expanded');
        wrapper.style.maxHeight = '0px';
        toggleBtn.classList.remove('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.querySelector('span').textContent = 'Ver beneficios';
      } else {
        wrapper.classList.add('mux-expanded');
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        toggleBtn.classList.add('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('span').textContent = 'Ocultar beneficios';
      }
    });

    cotizaSection.classList.add('mux-optimized');
    return true;
  }

  // ============================================
  // 5. SEO SECTION INTRO TEXT
  // Collapse the long intro paragraph
  // ============================================

  function optimizeSEOIntro() {
    var section = document.getElementById('lanchas-usadas-chile');
    if (!section) return false;

    var intro = section.querySelector('.section-intro');
    if (!intro || intro.classList.contains('mux-processed')) return false;

    // Only collapse if text is long
    if (intro.textContent.length < 100) return false;

    intro.classList.add('mux-processed');

    var wrapper = document.createElement('div');
    wrapper.className = 'mux-collapsible';
    wrapper.setAttribute('aria-hidden', 'false');

    intro.parentNode.insertBefore(wrapper, intro);
    wrapper.appendChild(intro);

    if (isMobile()) {
      wrapper.style.maxHeight = '70px';
    }

    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mux-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.style.maxWidth = '200px';
    toggleBtn.style.margin = '8px auto 0';
    toggleBtn.innerHTML = '<span>Leer mas</span>' + chevronDownSVG;
    wrapper.parentNode.insertBefore(toggleBtn, wrapper.nextSibling);

    toggleBtn.addEventListener('click', function() {
      var isExpanded = wrapper.classList.contains('mux-expanded');

      if (isExpanded) {
        wrapper.classList.remove('mux-expanded');
        wrapper.style.maxHeight = '70px';
        toggleBtn.classList.remove('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.querySelector('span').textContent = 'Leer mas';
      } else {
        wrapper.classList.add('mux-expanded');
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        toggleBtn.classList.add('mux-expanded');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('span').textContent = 'Ver menos';
      }
    });

    return true;
  }

  // ============================================
  // 6. RESPONSIVE VIEWPORT HANDLER
  // Update collapsible states on resize
  // ============================================

  function handleResize() {
    var collapsibles = document.querySelectorAll('.mux-collapsible');
    var toggleBtns = document.querySelectorAll('.mux-toggle-btn');
    var faqIndicators = document.querySelectorAll('.mux-faq-indicator');

    if (!isMobile()) {
      // Desktop: expand everything
      collapsibles.forEach(function(el) {
        el.style.maxHeight = 'none';
        el.classList.add('mux-expanded');
      });
      toggleBtns.forEach(function(btn) {
        btn.classList.add('mux-expanded');
      });
      faqIndicators.forEach(function(ind) {
        ind.classList.add('mux-expanded');
      });
    } else {
      // Mobile: collapse non-expanded items
      collapsibles.forEach(function(el) {
        if (!el.classList.contains('mux-expanded') || el.dataset.muxAutoExpanded) {
          el.classList.remove('mux-expanded');
          // Restore collapsed height from data attribute
          var collapsedH = el.dataset.muxCollapsedHeight;
          if (collapsedH) {
            el.style.maxHeight = collapsedH + 'px';
          }
        }
      });
    }
  }

  var resizeTimeout;
  function onResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 150);
  }

  // ============================================
  // 7. PERFORMANCE IMPROVEMENTS
  // ============================================

  function addPerformanceOptimizations() {
    // Add font-display: swap for any @font-face (if loaded via CSS)
    var perfStyle = document.createElement('style');
    perfStyle.id = 'mobile-perf-styles';
    perfStyle.textContent = [
      '/* Performance: Reduce layout shifts */',
      'img:not([width]):not([height]) {',
      '  aspect-ratio: attr(width) / attr(height);',
      '}',
      '',
      '/* Performance: Reduce paint on scroll */',
      '@media (max-width: 768px) {',
      '  .guide-card,',
      '  .service-card,',
      '  .seo-page-card,',
      '  .nuevas-lineas-card,',
      '  .marketplace-feature {',
      '    will-change: auto;',
      '    transform: translateZ(0);',
      '  }',
      '',
      '  /* Disable hover effects on mobile for performance */',
      '  .guide-card:hover,',
      '  .service-card:hover,',
      '  .seo-page-card:hover,',
      '  .nuevas-lineas-card:hover,',
      '  .marketplace-feature:hover {',
      '    transform: none;',
      '    box-shadow: none;',
      '  }',
      '',
      '  /* Reduce animation overhead on mobile */',
      '  .publicar-btn-modern {',
      '    animation: none;',
      '  }',
      '',
      '  .publicar-btn-modern::before {',
      '    animation: none;',
      '  }',
      '',
      '  .gratis-animated {',
      '    animation: none;',
      '    opacity: 1;',
      '  }',
      '',
      '  .marketplace-badge-arriendo {',
      '    animation: none;',
      '  }',
      '}',
      ''
    ].join('\n');

    if (!document.getElementById('mobile-perf-styles')) {
      document.head.appendChild(perfStyle);
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function runOptimizations() {
    if (initialized) return;

    // Track which optimizations succeeded
    var lanchasOk = optimizeLanchasUsadasSection();
    var faqOk = optimizeLanchasFAQ();
    var marketplaceOk = optimizeMarketplaceSection();
    var cotizaOk = optimizeCotizaSection();
    var introOk = optimizeSEOIntro();

    // Store collapsed heights for resize handling
    var collapsibles = document.querySelectorAll('.mux-collapsible');
    collapsibles.forEach(function(el) {
      if (el.style.maxHeight && el.style.maxHeight !== 'none') {
        el.dataset.muxCollapsedHeight = parseInt(el.style.maxHeight, 10);
      }
    });

    if (lanchasOk || faqOk || marketplaceOk || cotizaOk || introOk) {
      initialized = true;
      console.log('[Mobile UX Optimizer] Optimizations applied:', {
        lanchasUsadas: lanchasOk,
        faq: faqOk,
        marketplace: marketplaceOk,
        cotiza: cotizaOk,
        seoIntro: introOk
      });
    }
  }

  function init() {
    addMobileUXStyles();
    addPerformanceOptimizations();

    // Add resize listener
    window.addEventListener('resize', onResize);

    // Run optimizations with delays to catch dynamically injected content
    // seo-sections.js runs at 1500ms, marketplace-section.js at 1500ms,
    // seo-pages-section.js at 2500ms, so we wait longer
    var delays = [3000, 4000, 5000, 7000, 10000];
    delays.forEach(function(delay) {
      setTimeout(function() {
        if (!initialized) {
          runOptimizations();
        }
      }, delay);
    });

    // Also use MutationObserver for dynamic content
    if (window.MutationObserver) {
      var observerTimer = null;
      var observer = new MutationObserver(function() {
        if (initialized) {
          observer.disconnect();
          return;
        }
        clearTimeout(observerTimer);
        observerTimer = setTimeout(function() {
          runOptimizations();
        }, 500);
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          observer.observe(document.body, { childList: true, subtree: true });
        });
      }

      // Disconnect observer after 15 seconds regardless
      setTimeout(function() {
        observer.disconnect();
      }, 15000);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
