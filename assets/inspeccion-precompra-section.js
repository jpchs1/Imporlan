/**
 * Imporlan - Inspeccion Pre-Compra de Embarcacion Section
 * Adds a pricing section for the Pre-Purchase Inspection service to the HOME page
 * Three categories with respective prices
 * Inserted before footer, after existing SEO sections
 * v1.0
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
  // CSS STYLES
  // ============================================

  function addInspeccionStyles() {
    if (document.getElementById('inspeccion-precompra-home-styles')) return;

    var style = document.createElement('style');
    style.id = 'inspeccion-precompra-home-styles';
    style.textContent = '\
      .inspeccion-precompra-home {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);\
      }\
      .inspeccion-precompra-home::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 50% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 60%);\
        pointer-events: none;\
      }\
      .inspeccion-precompra-container {\
        max-width: 1200px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .inspeccion-precompra-home h2 {\
        text-align: center;\
        font-size: 2.5rem;\
        font-weight: 700;\
        color: #ffffff;\
        margin-bottom: 16px;\
        line-height: 1.3;\
      }\
      .inspeccion-precompra-home h2 .kw-highlight {\
        background: linear-gradient(135deg, #3b82f6, #06b6d4);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .inspeccion-precompra-home .section-subtitle {\
        text-align: center;\
        color: #9ca3af;\
        font-size: 1.1rem;\
        max-width: 700px;\
        margin: 0 auto 20px;\
        line-height: 1.6;\
      }\
      .inspeccion-precompra-home .section-intro {\
        text-align: center;\
        color: #9ca3af;\
        font-size: 1rem;\
        max-width: 750px;\
        margin: 0 auto 48px;\
        line-height: 1.7;\
      }\
      .inspeccion-precompra-home .section-intro strong {\
        color: #d1d5db;\
      }\
      .inspeccion-pricing-grid {\
        display: grid;\
        grid-template-columns: repeat(3, 1fr);\
        gap: 28px;\
        max-width: 1100px;\
        margin: 0 auto 40px;\
      }\
      .inspeccion-plan-card {\
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 20px;\
        padding: 36px 28px;\
        text-align: center;\
        transition: all 0.3s ease;\
        position: relative;\
        overflow: hidden;\
      }\
      .inspeccion-plan-card::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        height: 4px;\
        background: linear-gradient(90deg, #3b82f6, #60a5fa);\
        transform: scaleX(0);\
        transition: transform 0.3s ease;\
      }\
      .inspeccion-plan-card:hover {\
        transform: translateY(-6px);\
        border-color: #3b82f6;\
        box-shadow: 0 12px 40px rgba(59, 130, 246, 0.2);\
      }\
      .inspeccion-plan-card:hover::before {\
        transform: scaleX(1);\
      }\
      .inspeccion-plan-card.plan-featured {\
        border-color: #3b82f6;\
        background: linear-gradient(145deg, #1a3a6a 0%, #1e3a5f 100%);\
        box-shadow: 0 8px 30px rgba(59, 130, 246, 0.15);\
      }\
      .inspeccion-plan-card.plan-featured::before {\
        transform: scaleX(1);\
        background: linear-gradient(90deg, #f59e0b, #fbbf24);\
      }\
      .plan-badge {\
        display: inline-block;\
        background: linear-gradient(135deg, #f59e0b, #d97706);\
        color: #ffffff;\
        font-size: 0.75rem;\
        font-weight: 700;\
        text-transform: uppercase;\
        letter-spacing: 1px;\
        padding: 5px 16px;\
        border-radius: 20px;\
        margin-bottom: 16px;\
      }\
      .plan-icon-wrapper {\
        width: 68px;\
        height: 68px;\
        border-radius: 18px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        margin: 0 auto 20px;\
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);\
        transition: transform 0.3s ease;\
      }\
      .inspeccion-plan-card:hover .plan-icon-wrapper {\
        transform: scale(1.1);\
      }\
      .plan-icon-wrapper svg {\
        width: 34px;\
        height: 34px;\
        color: white;\
      }\
      .plan-icon-wrapper.icon-cyan {\
        background: linear-gradient(135deg, #06b6d4, #0891b2);\
      }\
      .plan-icon-wrapper.icon-blue {\
        background: linear-gradient(135deg, #3b82f6, #2563eb);\
      }\
      .plan-icon-wrapper.icon-purple {\
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);\
      }\
      .inspeccion-plan-card h3 {\
        color: #ffffff;\
        font-size: 1.3rem;\
        font-weight: 700;\
        margin-bottom: 8px;\
      }\
      .inspeccion-plan-card.plan-featured h3 {\
        color: #60a5fa;\
      }\
      .plan-description {\
        color: #9ca3af;\
        font-size: 0.92rem;\
        line-height: 1.5;\
        margin-bottom: 20px;\
        min-height: 44px;\
      }\
      .plan-price {\
        font-size: 2.2rem;\
        font-weight: 800;\
        color: #ffffff;\
        margin-bottom: 6px;\
        line-height: 1.2;\
      }\
      .plan-price .currency {\
        font-size: 1.1rem;\
        font-weight: 600;\
        vertical-align: super;\
        color: #60a5fa;\
      }\
      .plan-price-note {\
        font-size: 0.8rem;\
        color: #6b7280;\
        margin-bottom: 24px;\
      }\
      .plan-features {\
        list-style: none;\
        padding: 0;\
        margin: 0 0 28px 0;\
        text-align: left;\
      }\
      .plan-features li {\
        color: #9ca3af;\
        font-size: 0.9rem;\
        padding: 8px 0;\
        padding-left: 28px;\
        position: relative;\
        border-bottom: 1px solid rgba(45, 90, 135, 0.3);\
      }\
      .plan-features li:last-child {\
        border-bottom: none;\
      }\
      .plan-features li::before {\
        content: "";\
        position: absolute;\
        left: 0;\
        top: 12px;\
        width: 18px;\
        height: 18px;\
        background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2310b981\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'20 6 9 17 4 12\'/%3E%3C/svg%3E");\
        background-size: contain;\
        background-repeat: no-repeat;\
      }\
      .plan-cta {\
        display: inline-flex;\
        align-items: center;\
        gap: 10px;\
        width: 100%;\
        justify-content: center;\
        padding: 14px 28px;\
        border-radius: 12px;\
        font-size: 1rem;\
        font-weight: 600;\
        cursor: pointer;\
        transition: all 0.3s ease;\
        text-decoration: none;\
        border: none;\
        font-family: inherit;\
      }\
      .plan-cta svg {\
        width: 20px;\
        height: 20px;\
        flex-shrink: 0;\
      }\
      .plan-cta-primary {\
        background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);\
        color: #ffffff;\
        box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);\
      }\
      .plan-cta-primary:hover {\
        transform: translateY(-2px);\
        box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);\
      }\
      .plan-cta-secondary {\
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);\
        color: #ffffff;\
        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);\
      }\
      .plan-cta-secondary:hover {\
        transform: translateY(-2px);\
        box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);\
      }\
      .inspeccion-disclaimer {\
        text-align: center;\
        color: #6b7280;\
        font-size: 0.85rem;\
        margin-top: 12px;\
        font-style: italic;\
      }\
      .inspeccion-extra-info {\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        gap: 32px;\
        margin-top: 48px;\
        flex-wrap: wrap;\
      }\
      .inspeccion-extra-item {\
        display: flex;\
        align-items: center;\
        gap: 12px;\
        color: #9ca3af;\
        font-size: 0.92rem;\
      }\
      .inspeccion-extra-item svg {\
        width: 24px;\
        height: 24px;\
        color: #3b82f6;\
        flex-shrink: 0;\
      }\
      .inspeccion-extra-item strong {\
        color: #d1d5db;\
      }\
      .inspeccion-cta-bottom {\
        text-align: center;\
        margin-top: 48px;\
      }\
      .inspeccion-cta-bottom a {\
        display: inline-flex;\
        align-items: center;\
        gap: 10px;\
        background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);\
        color: #ffffff;\
        border: none;\
        border-radius: 14px;\
        padding: 16px 36px;\
        font-size: 1.05rem;\
        font-weight: 700;\
        cursor: pointer;\
        transition: all 0.3s ease;\
        text-decoration: none;\
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);\
      }\
      .inspeccion-cta-bottom a:hover {\
        transform: translateY(-3px);\
        box-shadow: 0 8px 35px rgba(37, 99, 235, 0.5);\
      }\
      .inspeccion-cta-bottom a svg {\
        width: 20px;\
        height: 20px;\
      }\
      @media (max-width: 768px) {\
        .inspeccion-precompra-home {\
          padding: 60px 16px;\
        }\
        .inspeccion-precompra-home h2 {\
          font-size: 1.75rem;\
        }\
        .inspeccion-pricing-grid {\
          grid-template-columns: 1fr;\
          gap: 20px;\
          max-width: 420px;\
        }\
        .inspeccion-plan-card {\
          padding: 28px 24px;\
        }\
        .plan-price {\
          font-size: 1.8rem;\
        }\
        .inspeccion-extra-info {\
          flex-direction: column;\
          gap: 16px;\
          align-items: flex-start;\
          padding-left: 20px;\
        }\
      }\
      @media (min-width: 769px) and (max-width: 1024px) {\
        .inspeccion-pricing-grid {\
          grid-template-columns: 1fr 1fr;\
        }\
        .inspeccion-plan-card:last-child {\
          grid-column: 1 / -1;\
          max-width: 420px;\
          margin: 0 auto;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  // ============================================
  // SVG ICONS
  // ============================================

  var iconSearch = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>';
  var iconShield = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  var iconClipboard = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>';
  var iconWhatsApp = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  var iconMapPin = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var iconClock = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  var iconPhone = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var iconArrow = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  // ============================================
  // CREATE SECTION
  // ============================================

  function createInspeccionSection() {
    var section = document.createElement('section');
    section.className = 'inspeccion-precompra-home';
    section.id = 'inspeccion-precompra';

    var waBase = 'https://wa.me/56940211459?text=';

    section.innerHTML = '\
      <div class="inspeccion-precompra-container">\
        <h2><span class="kw-highlight">Inspeccion Pre-Compra</span> de Embarcacion en Chile</h2>\
        <p class="section-subtitle">Servicio profesional de inspeccion nautica antes de comprar. Protege tu inversion con un informe detallado.</p>\
        <p class="section-intro">Antes de cerrar la compra de una embarcacion, nuestros <strong>inspectores nauticos certificados</strong> revisan cada detalle: casco, motor, sistemas electricos, documentacion y mas. Recibe un <strong>informe completo con fotos y recomendaciones</strong> para tomar la mejor decision.</p>\
        \
        <div class="inspeccion-pricing-grid">\
          <!-- Categoria 1 -->\
          <div class="inspeccion-plan-card">\
            <div class="plan-icon-wrapper icon-cyan">' + iconSearch + '</div>\
            <h3>Inspeccion Basica</h3>\
            <p class="plan-description">Revision visual general del estado de la embarcacion y sus componentes principales.</p>\
            <div class="plan-price"><span class="currency">CLP</span> $289.990</div>\
            <p class="plan-price-note">Precio referencial</p>\
            <ul class="plan-features">\
              <li>Inspeccion visual del casco</li>\
              <li>Revision general del motor</li>\
              <li>Estado de sistemas electricos</li>\
              <li>Verificacion de documentacion</li>\
              <li>Informe escrito con fotos</li>\
            </ul>\
            <a href="' + waBase + 'Hola,%20me%20interesa%20la%20Inspeccion%20Basica%20de%20embarcacion%20($289.990)" class="plan-cta plan-cta-secondary" target="_blank" rel="noopener">\
              ' + iconWhatsApp + '\
              Consultar\
            </a>\
          </div>\
          \
          <!-- Categoria 2 (Destacada) -->\
          <div class="inspeccion-plan-card plan-featured">\
            <div class="plan-badge">Mas Solicitada</div>\
            <div class="plan-icon-wrapper icon-blue">' + iconShield + '</div>\
            <h3>Inspeccion Completa</h3>\
            <p class="plan-description">Analisis exhaustivo con pruebas de motor, sistemas y prueba en agua.</p>\
            <div class="plan-price"><span class="currency">CLP</span> $339.990</div>\
            <p class="plan-price-note">Precio referencial</p>\
            <ul class="plan-features">\
              <li>Todo lo de Inspeccion Basica</li>\
              <li>Prueba de compresion del motor</li>\
              <li>Revision completa de sistemas</li>\
              <li>Prueba en agua (navegacion)</li>\
              <li>Informe detallado con recomendaciones</li>\
              <li>Estimacion de costos de reparacion</li>\
            </ul>\
            <a href="' + waBase + 'Hola,%20me%20interesa%20la%20Inspeccion%20Completa%20de%20embarcacion%20($339.990)" class="plan-cta plan-cta-primary" target="_blank" rel="noopener">\
              ' + iconWhatsApp + '\
              Solicitar Ahora\
            </a>\
          </div>\
          \
          <!-- Categoria 3 -->\
          <div class="inspeccion-plan-card">\
            <div class="plan-icon-wrapper icon-purple">' + iconClipboard + '</div>\
            <h3>Inspeccion Premium</h3>\
            <p class="plan-description">Servicio integral con peritaje avanzado, ideal para embarcaciones de alto valor.</p>\
            <div class="plan-price"><span class="currency">CLP</span> $389.600</div>\
            <p class="plan-price-note">Precio referencial</p>\
            <ul class="plan-features">\
              <li>Todo lo de Inspeccion Completa</li>\
              <li>Medicion de humedad en casco</li>\
              <li>Peritaje estructural avanzado</li>\
              <li>Analisis de historial de mantenimiento</li>\
              <li>Valoracion de mercado estimada</li>\
              <li>Informe ejecutivo para negociacion</li>\
              <li>Asesoria post-inspeccion</li>\
            </ul>\
            <a href="' + waBase + 'Hola,%20me%20interesa%20la%20Inspeccion%20Premium%20de%20embarcacion%20($389.600)" class="plan-cta plan-cta-secondary" target="_blank" rel="noopener">\
              ' + iconWhatsApp + '\
              Consultar\
            </a>\
          </div>\
        </div>\
        \
        <p class="inspeccion-disclaimer">* Valores sujetos a variaciones segun la ubicacion geografica.</p>\
        \
        <div class="inspeccion-extra-info">\
          <div class="inspeccion-extra-item">\
            ' + iconMapPin + '\
            <span><strong>Cobertura nacional</strong> en Chile</span>\
          </div>\
          <div class="inspeccion-extra-item">\
            ' + iconClock + '\
            <span>Agenda en <strong>48-72 hrs</strong></span>\
          </div>\
          <div class="inspeccion-extra-item">\
            ' + iconPhone + '\
            <span>Atencion <strong>personalizada</strong></span>\
          </div>\
        </div>\
        \
        <div class="inspeccion-cta-bottom">\
          <a href="/inspeccion-precompra-embarcaciones/" title="Ver guia completa de inspeccion pre-compra">\
            Ver guia completa de inspeccion\
            ' + iconArrow + '\
          </a>\
        </div>\
      </div>\
    ';

    return section;
  }

  // ============================================
  // FIND SECTION HELPER
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
  // INSERT SECTION
  // ============================================

  function insertInspeccionSection() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html' && window.location.pathname !== '/test/' && window.location.pathname !== '/test/index.html') return;

    // Remove existing section if present (for re-insertion)
    var existing = document.getElementById('inspeccion-precompra');
    if (existing) existing.remove();

    var checkInterval = setInterval(function() {
      // Try to insert after "Lanchas Usadas" SEO section, or before footer
      var lanchasSection = document.getElementById('lanchas-usadas-chile');
      var guiasSection = document.getElementById('guias-recursos');
      var serviciosSection = document.getElementById('servicios-importacion');
      var footer = document.querySelector('footer');

      var insertPoint = null;
      var parentNode = null;

      if (lanchasSection) {
        insertPoint = lanchasSection.nextSibling;
        parentNode = lanchasSection.parentNode;
      } else if (guiasSection) {
        insertPoint = guiasSection.nextSibling;
        parentNode = guiasSection.parentNode;
      } else if (serviciosSection) {
        insertPoint = serviciosSection.nextSibling;
        parentNode = serviciosSection.parentNode;
      } else if (footer) {
        insertPoint = footer;
        parentNode = footer.parentNode;
      }

      if (parentNode && insertPoint) {
        clearInterval(checkInterval);

        addInspeccionStyles();
        var section = createInspeccionSection();
        parentNode.insertBefore(section, insertPoint);

        console.log('[Inspeccion Pre-Compra] Section inserted successfully');
      }
    }, 500);

    // Stop checking after 20 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 20000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  onReady(function() {
    // Wait for other sections to be inserted first
    setTimeout(function() {
      insertInspeccionSection();
    }, 3500);
  });

})();
