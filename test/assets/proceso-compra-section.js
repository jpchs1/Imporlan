/**
 * Imporlan - Proceso de Compra USA Enhancement
 * Replaces the broken React-rendered process section with a clean, responsive design
 * Version 1.0
 */

(function() {
  'use strict';

  function addProcesoStyles() {
    if (document.getElementById('proceso-compra-styles')) return;

    var style = document.createElement('style');
    style.id = 'proceso-compra-styles';
    style.textContent = '\
      .pc-section {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);\
      }\
      .pc-section::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.06) 0%, transparent 60%);\
        pointer-events: none;\
      }\
      .pc-container {\
        max-width: 1200px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .pc-header {\
        text-align: center;\
        margin-bottom: 64px;\
      }\
      .pc-badge {\
        display: inline-flex;\
        align-items: center;\
        gap: 8px;\
        background: rgba(6, 182, 212, 0.12);\
        border: 1px solid rgba(6, 182, 212, 0.25);\
        border-radius: 24px;\
        padding: 8px 20px;\
        font-size: 13px;\
        font-weight: 600;\
        color: #22d3ee;\
        margin-bottom: 24px;\
        text-transform: uppercase;\
        letter-spacing: 0.8px;\
      }\
      .pc-badge svg {\
        width: 16px;\
        height: 16px;\
      }\
      .pc-header h2 {\
        font-size: 2.8rem;\
        font-weight: 800;\
        color: #ffffff;\
        margin: 0 0 16px;\
        line-height: 1.15;\
      }\
      .pc-header h2 .pc-highlight {\
        background: linear-gradient(135deg, #06b6d4, #3b82f6);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .pc-header p {\
        color: #94a3b8;\
        font-size: 1.1rem;\
        max-width: 600px;\
        margin: 0 auto;\
        line-height: 1.6;\
      }\
      /* Timeline */\
      .pc-timeline {\
        position: relative;\
        display: flex;\
        justify-content: space-between;\
        max-width: 1100px;\
        margin: 0 auto;\
      }\
      /* Horizontal connector line */\
      .pc-timeline::before {\
        content: "";\
        position: absolute;\
        top: 40px;\
        left: 40px;\
        right: 40px;\
        height: 3px;\
        background: linear-gradient(90deg, #0891b2, #3b82f6, #8b5cf6, #06b6d4, #10b981);\
        border-radius: 2px;\
        opacity: 0.3;\
      }\
      .pc-timeline::after {\
        content: "";\
        position: absolute;\
        top: 39px;\
        left: 40px;\
        right: 40px;\
        height: 5px;\
        background: linear-gradient(90deg, #0891b2, #3b82f6, #8b5cf6, #06b6d4, #10b981);\
        border-radius: 3px;\
        opacity: 0.15;\
        filter: blur(4px);\
      }\
      .pc-step {\
        flex: 1;\
        display: flex;\
        flex-direction: column;\
        align-items: center;\
        text-align: center;\
        position: relative;\
        padding: 0 8px;\
      }\
      /* Step number circle */\
      .pc-step-circle {\
        width: 80px;\
        height: 80px;\
        border-radius: 50%;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        position: relative;\
        z-index: 2;\
        margin-bottom: 24px;\
        transition: transform 0.3s ease, box-shadow 0.3s ease;\
      }\
      .pc-step:hover .pc-step-circle {\
        transform: scale(1.1);\
      }\
      .pc-step-circle-inner {\
        width: 64px;\
        height: 64px;\
        border-radius: 50%;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        font-size: 22px;\
        font-weight: 800;\
        color: #fff;\
        position: relative;\
      }\
      .pc-step-circle-ring {\
        position: absolute;\
        inset: 0;\
        border-radius: 50%;\
        border: 2px solid rgba(255,255,255,0.1);\
        animation: pc-pulse 3s ease-in-out infinite;\
      }\
      .pc-step:nth-child(1) .pc-step-circle-inner { background: linear-gradient(135deg, #0891b2, #06b6d4); }\
      .pc-step:nth-child(1) .pc-step-circle { box-shadow: 0 8px 32px rgba(8,145,178,0.3); }\
      .pc-step:nth-child(2) .pc-step-circle-inner { background: linear-gradient(135deg, #3b82f6, #2563eb); }\
      .pc-step:nth-child(2) .pc-step-circle { box-shadow: 0 8px 32px rgba(59,130,246,0.3); }\
      .pc-step:nth-child(3) .pc-step-circle-inner { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }\
      .pc-step:nth-child(3) .pc-step-circle { box-shadow: 0 8px 32px rgba(139,92,246,0.3); }\
      .pc-step:nth-child(4) .pc-step-circle-inner { background: linear-gradient(135deg, #06b6d4, #0891b2); }\
      .pc-step:nth-child(4) .pc-step-circle { box-shadow: 0 8px 32px rgba(6,182,212,0.3); }\
      .pc-step:nth-child(5) .pc-step-circle-inner { background: linear-gradient(135deg, #10b981, #059669); }\
      .pc-step:nth-child(5) .pc-step-circle { box-shadow: 0 8px 32px rgba(16,185,129,0.3); }\
      .pc-step:hover:nth-child(1) .pc-step-circle { box-shadow: 0 12px 40px rgba(8,145,178,0.5); }\
      .pc-step:hover:nth-child(2) .pc-step-circle { box-shadow: 0 12px 40px rgba(59,130,246,0.5); }\
      .pc-step:hover:nth-child(3) .pc-step-circle { box-shadow: 0 12px 40px rgba(139,92,246,0.5); }\
      .pc-step:hover:nth-child(4) .pc-step-circle { box-shadow: 0 12px 40px rgba(6,182,212,0.5); }\
      .pc-step:hover:nth-child(5) .pc-step-circle { box-shadow: 0 12px 40px rgba(16,185,129,0.5); }\
      /* Step icon */\
      .pc-step-icon {\
        width: 28px;\
        height: 28px;\
      }\
      /* Step content */\
      .pc-step-label {\
        font-size: 11px;\
        font-weight: 700;\
        color: #64748b;\
        text-transform: uppercase;\
        letter-spacing: 1.5px;\
        margin-bottom: 8px;\
      }\
      .pc-step-title {\
        font-size: 1.05rem;\
        font-weight: 700;\
        color: #f1f5f9;\
        margin-bottom: 8px;\
      }\
      .pc-step-desc {\
        font-size: 0.85rem;\
        color: #94a3b8;\
        line-height: 1.5;\
        max-width: 180px;\
        margin: 0 auto 12px;\
      }\
      .pc-step-payment {\
        display: inline-flex;\
        align-items: center;\
        gap: 4px;\
        padding: 4px 12px;\
        border-radius: 20px;\
        font-size: 11px;\
        font-weight: 700;\
        background: rgba(245, 158, 11, 0.12);\
        color: #fbbf24;\
        border: 1px solid rgba(245, 158, 11, 0.2);\
      }\
      .pc-step-duration {\
        display: inline-flex;\
        align-items: center;\
        gap: 4px;\
        padding: 4px 12px;\
        border-radius: 20px;\
        font-size: 11px;\
        font-weight: 600;\
        background: rgba(6, 182, 212, 0.08);\
        color: #67e8f9;\
        border: 1px solid rgba(6, 182, 212, 0.15);\
        margin-top: 4px;\
      }\
      /* Bottom summary */\
      .pc-summary {\
        display: flex;\
        justify-content: center;\
        gap: 40px;\
        margin-top: 56px;\
        flex-wrap: wrap;\
      }\
      .pc-summary-item {\
        display: flex;\
        align-items: center;\
        gap: 12px;\
        padding: 16px 24px;\
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 16px;\
        transition: all 0.3s ease;\
      }\
      .pc-summary-item:hover {\
        border-color: #3b82f6;\
        transform: translateY(-2px);\
        box-shadow: 0 8px 24px rgba(59,130,246,0.15);\
      }\
      .pc-summary-icon {\
        width: 44px;\
        height: 44px;\
        border-radius: 12px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        flex-shrink: 0;\
      }\
      .pc-summary-icon svg {\
        width: 22px;\
        height: 22px;\
      }\
      .pc-summary-icon.pc-si-time { background: rgba(6, 182, 212, 0.15); }\
      .pc-summary-icon.pc-si-secure { background: rgba(16, 185, 129, 0.15); }\
      .pc-summary-icon.pc-si-support { background: rgba(59, 130, 246, 0.15); }\
      .pc-summary-text strong {\
        display: block;\
        font-size: 0.95rem;\
        font-weight: 700;\
        color: #f1f5f9;\
        margin-bottom: 2px;\
      }\
      .pc-summary-text span {\
        font-size: 0.8rem;\
        color: #94a3b8;\
      }\
      @keyframes pc-pulse {\
        0%, 100% { transform: scale(1); opacity: 0.3; }\
        50% { transform: scale(1.15); opacity: 0.1; }\
      }\
      /* Animated boat */\
      .pc-boat-track {\
        position: absolute;\
        top: 22px;\
        left: 40px;\
        right: 40px;\
        height: 36px;\
        z-index: 3;\
        pointer-events: none;\
        overflow: hidden;\
      }\
      .pc-boat-wrapper {\
        position: absolute;\
        top: 0;\
        left: 0;\
        animation: pc-boat-move 8s ease-in-out infinite;\
      }\
      .pc-boat-wrapper svg {\
        width: 48px;\
        height: 36px;\
        filter: drop-shadow(0 4px 12px rgba(6,182,212,0.4));\
      }\
      .pc-boat-wake {\
        position: absolute;\
        top: 26px;\
        left: -60px;\
        width: 60px;\
        height: 3px;\
        background: linear-gradient(90deg, transparent, rgba(6,182,212,0.5));\
        border-radius: 2px;\
      }\
      @keyframes pc-boat-move {\
        0% { left: 0%; }\
        20% { left: 22%; }\
        25% { left: 22%; }\
        45% { left: 47%; }\
        50% { left: 47%; }\
        70% { left: 72%; }\
        75% { left: 72%; }\
        95% { left: 95%; }\
        100% { left: 95%; }\
      }\
      /* Responsive */\
      @media (max-width: 960px) {\
        .pc-timeline {\
          flex-wrap: wrap;\
          justify-content: center;\
          gap: 32px;\
        }\
        .pc-timeline::before,\
        .pc-timeline::after {\
          display: none;\
        }\
        .pc-boat-track {\
          display: none;\
        }\
        .pc-step {\
          flex: 0 0 calc(33.333% - 24px);\
          max-width: 220px;\
        }\
      }\
      @media (max-width: 768px) {\
        .pc-section {\
          padding: 60px 16px;\
        }\
        .pc-header h2 {\
          font-size: 1.85rem;\
        }\
        .pc-step {\
          flex: 0 0 calc(50% - 16px);\
        }\
        .pc-step-circle {\
          width: 70px;\
          height: 70px;\
        }\
        .pc-step-circle-inner {\
          width: 56px;\
          height: 56px;\
          font-size: 18px;\
        }\
        .pc-summary {\
          gap: 16px;\
        }\
        .pc-summary-item {\
          flex: 1 1 100%;\
          max-width: 340px;\
        }\
      }\
      @media (max-width: 480px) {\
        .pc-step {\
          flex: 0 0 100%;\
          max-width: 280px;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  var steps = [
    {
      label: 'Paso 1',
      title: 'Busqueda',
      desc: 'Encuentra tu lancha ideal en los principales portales de USA',
      payment: null,
      duration: '7-21 dias',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    },
    {
      label: 'Paso 2',
      title: 'Inspeccion',
      desc: 'Nuestros expertos verifican el estado de la embarcacion',
      payment: '1er Pago - 10%',
      duration: '5-7 dias',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.48 0 2.88.36 4.11.99"/><path d="M21 3v4h-4"/></svg>'
    },
    {
      label: 'Paso 3',
      title: 'Compra',
      desc: 'Gestionamos la compra de forma segura y transparente',
      payment: '2do Pago - 90%',
      duration: '3-5 dias',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
    },
    {
      label: 'Paso 4',
      title: 'En Camino',
      desc: 'Tu lancha viaja desde USA hacia Chile por via maritima',
      payment: null,
      duration: '~25 dias',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M5 14h14l2 4H3l2-4z"/><path d="M8 14V9l4-3 4 3v5"/></svg>'
    },
    {
      label: 'Paso 5',
      title: 'Entrega',
      desc: 'Recibe tu embarcacion donde tu quieras en Chile',
      payment: null,
      duration: 'Coordinado',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    }
  ];

  function buildStepsHtml() {
    var html = '';
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var paymentHtml = s.payment ? '<div class="pc-step-payment">' + s.payment + '</div>' : '';
      var durationHtml = s.duration ? '<div class="pc-step-duration"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + s.duration + '</div>' : '';

      html += '<div class="pc-step">' +
        '<div class="pc-step-circle"><div class="pc-step-circle-inner"><div class="pc-step-circle-ring"></div><span class="pc-step-icon">' + s.icon + '</span></div></div>' +
        '<div class="pc-step-label">' + s.label + '</div>' +
        '<div class="pc-step-title">' + s.title + '</div>' +
        '<div class="pc-step-desc">' + s.desc + '</div>' +
        paymentHtml + durationHtml +
        '</div>';
    }
    return html;
  }

  function createProcesoSection() {
    var section = document.createElement('section');
    section.className = 'pc-section';
    section.id = 'proceso-compra-enhanced';

    section.innerHTML = '\
      <div class="pc-container">\
        <div class="pc-header">\
          <div class="pc-badge">\
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>\
            Importacion Simple\
          </div>\
          <h2>Proceso de <span class="pc-highlight">Compra USA</span></h2>\
          <p>Un proceso simple y transparente en 5 pasos. Aproximadamente 58 dias desde la busqueda hasta la entrega.</p>\
        </div>\
        <div class="pc-timeline">\
          <div class="pc-boat-track">\
            <div class="pc-boat-wrapper">\
              <div class="pc-boat-wake"></div>\
              <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg">\
                <path d="M8 28 L16 28 L20 22 L44 22 L52 16 L56 16 L56 28 L8 28 Z" fill="url(#boatHull)" />\
                <path d="M24 22 L24 12 L28 10 L28 22" fill="#e2e8f0" />\
                <path d="M28 10 L48 18 L28 18 Z" fill="url(#boatSail)" opacity="0.9" />\
                <path d="M4 30 Q16 26 32 30 Q48 34 60 30" stroke="#06b6d4" stroke-width="1.5" fill="none" opacity="0.5" />\
                <path d="M2 33 Q18 29 34 33 Q50 37 62 33" stroke="#06b6d4" stroke-width="1" fill="none" opacity="0.3" />\
                <defs>\
                  <linearGradient id="boatHull" x1="0" y1="0" x2="1" y2="1">\
                    <stop offset="0%" stop-color="#f1f5f9" />\
                    <stop offset="100%" stop-color="#cbd5e1" />\
                  </linearGradient>\
                  <linearGradient id="boatSail" x1="0" y1="0" x2="1" y2="0">\
                    <stop offset="0%" stop-color="#0891b2" />\
                    <stop offset="100%" stop-color="#06b6d4" />\
                  </linearGradient>\
                </defs>\
              </svg>\
            </div>\
          </div>\
          ' + buildStepsHtml() + '\
        </div>\
        <div class="pc-summary">\
          <div class="pc-summary-item">\
            <div class="pc-summary-icon pc-si-time">\
              <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>\
            </div>\
            <div class="pc-summary-text">\
              <strong>~58 dias en total</strong>\
              <span>Desde busqueda hasta entrega</span>\
            </div>\
          </div>\
          <div class="pc-summary-item">\
            <div class="pc-summary-icon pc-si-secure">\
              <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>\
            </div>\
            <div class="pc-summary-text">\
              <strong>Pagos seguros</strong>\
              <span>10% inspeccion + 90% compra</span>\
            </div>\
          </div>\
          <div class="pc-summary-item">\
            <div class="pc-summary-icon pc-si-support">\
              <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>\
            </div>\
            <div class="pc-summary-text">\
              <strong>Soporte continuo</strong>\
              <span>Te acompanamos en cada paso</span>\
            </div>\
          </div>\
        </div>\
      </div>\
    ';

    return section;
  }

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

  /* Hide original section instantly as soon as it appears in the DOM */
  function hideOriginalSection(section) {
    if (section && !section.getAttribute('data-pc-hidden')) {
      section.style.display = 'none';
      section.setAttribute('data-pc-hidden', '1');
    }
  }

  function findOriginalSection() {
    var sections = document.querySelectorAll('section');
    for (var i = 0; i < sections.length; i++) {
      var heading = sections[i].querySelector('h2');
      if (heading && heading.textContent.toUpperCase().indexOf('PROCESO DE') !== -1) {
        return sections[i];
      }
      if (heading && heading.textContent.toUpperCase().indexOf('COMPRA USA') !== -1) {
        return sections[i];
      }
    }
    return null;
  }

  function replaceProcesoSection() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;

    var existing = document.getElementById('proceso-compra-enhanced');
    if (existing) return;

    /* Use MutationObserver to catch & hide the old section the instant React renders it */
    var observer = new MutationObserver(function() {
      var oldSection = findOriginalSection();
      if (oldSection) {
        hideOriginalSection(oldSection);
        observer.disconnect();

        addProcesoStyles();
        var newSection = createProcesoSection();
        oldSection.parentNode.insertBefore(newSection, oldSection);

        console.log('[Proceso Compra] Successfully replaced process section');
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    /* Safety timeout: stop observing after 15s */
    setTimeout(function() {
      observer.disconnect();
    }, 15000);
  }

  /* Start immediately - no delay */
  if (document.body) {
    replaceProcesoSection();
  } else {
    document.addEventListener('DOMContentLoaded', replaceProcesoSection);
  }

})();
