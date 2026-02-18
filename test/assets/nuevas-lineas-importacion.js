/**
 * Imporlan - Nuevas Lineas de Importacion Section
 * Adds a new section on the HOME page showcasing import categories beyond boats
 * Inserted after "Planes de Busqueda en USA" and before "Lo que dicen nuestros Clientes"
 * Version 1.0
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

  function addNuevasLineasStyles() {
    if (document.getElementById('nuevas-lineas-styles')) return;

    var style = document.createElement('style');
    style.id = 'nuevas-lineas-styles';
    style.textContent = '\
      .nuevas-lineas-section {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background-color: #0a1628;\
      }\
      .nuevas-lineas-section::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.06) 0%, transparent 70%);\
        pointer-events: none;\
      }\
      .nuevas-lineas-container {\
        max-width: 1200px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .nuevas-lineas-header {\
        text-align: center;\
        margin-bottom: 48px;\
      }\
      .nuevas-lineas-badge {\
        display: inline-flex;\
        align-items: center;\
        gap: 8px;\
        background: rgba(59, 130, 246, 0.15);\
        border: 1px solid rgba(59, 130, 246, 0.3);\
        border-radius: 24px;\
        padding: 6px 16px;\
        font-size: 13px;\
        font-weight: 600;\
        color: #60a5fa;\
        margin-bottom: 20px;\
        text-transform: uppercase;\
        letter-spacing: 0.5px;\
      }\
      .nuevas-lineas-badge svg {\
        width: 16px;\
        height: 16px;\
      }\
      .nuevas-lineas-header h2 {\
        font-size: 2.5rem;\
        font-weight: 700;\
        color: #ffffff;\
        margin-bottom: 16px;\
        line-height: 1.2;\
      }\
      .nuevas-lineas-header h2 .highlight-text {\
        background: linear-gradient(135deg, #3b82f6, #06b6d4);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .nuevas-lineas-header .subtitle {\
        color: #9ca3af;\
        font-size: 1.1rem;\
        max-width: 700px;\
        margin: 0 auto;\
        line-height: 1.6;\
      }\
      .nuevas-lineas-grid {\
        display: grid;\
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));\
        gap: 24px;\
        max-width: 1100px;\
        margin: 0 auto 48px;\
      }\
      .nuevas-lineas-card {\
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 16px;\
        padding: 32px 24px;\
        text-align: center;\
        text-decoration: none;\
        transition: all 0.3s ease;\
        display: block;\
        position: relative;\
        overflow: hidden;\
      }\
      .nuevas-lineas-card::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        height: 3px;\
        background: linear-gradient(90deg, #3b82f6, #60a5fa);\
        transform: scaleX(0);\
        transition: transform 0.3s ease;\
      }\
      .nuevas-lineas-card:hover {\
        transform: translateY(-4px);\
        border-color: #3b82f6;\
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15);\
      }\
      .nuevas-lineas-card:hover::before {\
        transform: scaleX(1);\
      }\
      .nuevas-lineas-card .nl-icon-wrapper {\
        width: 64px;\
        height: 64px;\
        border-radius: 16px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        margin: 0 auto 16px;\
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);\
        transition: transform 0.3s ease;\
      }\
      .nuevas-lineas-card:hover .nl-icon-wrapper {\
        transform: scale(1.1);\
      }\
      .nuevas-lineas-card .nl-icon-wrapper svg {\
        width: 32px;\
        height: 32px;\
        color: white;\
      }\
      .nuevas-lineas-card .nl-icon-wrapper.icon-orange { background: linear-gradient(135deg, #f59e0b, #d97706); }\
      .nuevas-lineas-card .nl-icon-wrapper.icon-green { background: linear-gradient(135deg, #10b981, #059669); }\
      .nuevas-lineas-card .nl-icon-wrapper.icon-red { background: linear-gradient(135deg, #ef4444, #dc2626); }\
      .nuevas-lineas-card .nl-icon-wrapper.icon-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }\
      .nuevas-lineas-card .nl-icon-wrapper.icon-cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }\
      .nuevas-lineas-card h3 {\
        color: #ffffff;\
        font-size: 1.25rem;\
        font-weight: 600;\
        margin-bottom: 12px;\
      }\
      .nuevas-lineas-card p {\
        color: #9ca3af;\
        font-size: 0.95rem;\
        line-height: 1.5;\
        margin: 0 0 16px 0;\
      }\
      .nuevas-lineas-card .nl-cta {\
        display: inline-flex;\
        align-items: center;\
        gap: 6px;\
        color: #3b82f6;\
        font-size: 0.9rem;\
        font-weight: 600;\
        transition: all 0.3s ease;\
      }\
      .nuevas-lineas-card .nl-cta svg {\
        width: 16px;\
        height: 16px;\
        transition: transform 0.3s ease;\
      }\
      .nuevas-lineas-card:hover .nl-cta svg {\
        transform: translateX(4px);\
      }\
      .nuevas-lineas-bottom {\
        text-align: center;\
      }\
      .nuevas-lineas-bottom-text {\
        color: #9ca3af;\
        font-size: 0.95rem;\
        max-width: 600px;\
        margin: 0 auto 24px;\
        line-height: 1.6;\
      }\
      .nuevas-lineas-cta-btn {\
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
        position: relative;\
        overflow: hidden;\
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);\
        text-decoration: none;\
      }\
      .nuevas-lineas-cta-btn:hover {\
        transform: translateY(-3px);\
        box-shadow: 0 8px 35px rgba(37, 99, 235, 0.5), 0 4px 15px rgba(8, 145, 178, 0.3);\
      }\
      .nuevas-lineas-cta-btn svg {\
        width: 20px;\
        height: 20px;\
        transition: transform 0.3s ease;\
      }\
      .nuevas-lineas-cta-btn:hover svg {\
        transform: translateX(4px);\
      }\
      @media (max-width: 768px) {\
        .nuevas-lineas-section {\
          padding: 60px 16px;\
        }\
        .nuevas-lineas-header h2 {\
          font-size: 1.75rem;\
        }\
        .nuevas-lineas-grid {\
          grid-template-columns: 1fr;\
          gap: 16px;\
        }\
        .nuevas-lineas-card {\
          padding: 24px 20px;\
        }\
        .nuevas-lineas-cta-btn {\
          padding: 14px 28px;\
          font-size: 1rem;\
          width: 100%;\
          justify-content: center;\
        }\
      }\
      @media (min-width: 640px) and (max-width: 767px) {\
        .nuevas-lineas-grid {\
          grid-template-columns: repeat(2, 1fr) !important;\
        }\
      }\
      @media (min-width: 768px) and (max-width: 1023px) {\
        .nuevas-lineas-grid {\
          grid-template-columns: repeat(3, 1fr) !important;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  var iconCar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
  var iconTruck = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>';
  var iconAmbulance = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M6 7h2"/><path d="M7 6v2"/></svg>';
  var iconRV = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M6 8h4"/><path d="M6 11h3"/></svg>';
  var iconJetski = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M5 14h14l2 4H3l2-4z"/><path d="M8 14V9l4-3 4 3v5"/><circle cx="12" cy="7" r="1"/></svg>';
  var iconArrow = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  var iconGlobe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  function getBaseUrl() {
    if (window.location.pathname.indexOf('/test') !== -1) {
      return '/test/importaciones';
    }
    return '/importaciones';
  }

  function createNuevasLineasSection() {
    var section = document.createElement('section');
    section.className = 'nuevas-lineas-section';
    section.id = 'nuevas-lineas-importacion';

    var base = getBaseUrl();

    section.innerHTML = '\
      <div class="nuevas-lineas-container">\
        <div class="nuevas-lineas-header">\
          <div class="nuevas-lineas-badge">' + iconGlobe + ' Nuevas Lineas</div>\
          <h2>Importamos <span class="highlight-text">Mucho Mas</span> que Embarcaciones</h2>\
          <p class="subtitle">Expandimos nuestros servicios de importacion desde USA. Ahora puedes traer vehiculos, maquinaria y equipos especiales con el mismo servicio integral y profesionalismo que nos caracteriza.</p>\
        </div>\
        <div class="nuevas-lineas-grid">\
          <a href="' + base + '/importacion-autos-chile/" class="nuevas-lineas-card">\
            <div class="nl-icon-wrapper icon-orange">' + iconCar + '</div>\
            <h3>Autos Nuevos y Clasicos</h3>\
            <p>Importa autos de lujo, electricos, muscle cars y vehiculos clasicos desde Estados Unidos.</p>\
            <span class="nl-cta">Mas informacion ' + iconArrow + '</span>\
          </a>\
          <a href="' + base + '/importacion-maquinaria-chile/" class="nuevas-lineas-card">\
            <div class="nl-icon-wrapper icon-green">' + iconTruck + '</div>\
            <h3>Maquinaria Industrial</h3>\
            <p>Retroexcavadoras, equipos de mineria, agricultura e industria. Inspeccion y certificaciones incluidas.</p>\
            <span class="nl-cta">Mas informacion ' + iconArrow + '</span>\
          </a>\
          <a href="' + base + '/importacion-ambulancias-chile/" class="nuevas-lineas-card">\
            <div class="nl-icon-wrapper icon-red">' + iconAmbulance + '</div>\
            <h3>Ambulancias</h3>\
            <p>Vehiculos de emergencia equipados desde USA. Para clinicas, municipalidades y organizaciones.</p>\
            <span class="nl-cta">Mas informacion ' + iconArrow + '</span>\
          </a>\
          <a href="' + base + '/importacion-motorhomes-chile/" class="nuevas-lineas-card">\
            <div class="nl-icon-wrapper icon-purple">' + iconRV + '</div>\
            <h3>RV, Motorhomes y Campervans</h3>\
            <p>Tu casa sobre ruedas. Ideal para turismo, inversiones en Airbnb o estilo de vida nomada.</p>\
            <span class="nl-cta">Mas informacion ' + iconArrow + '</span>\
          </a>\
          <a href="' + base + '/importacion-motos-agua-chile/" class="nuevas-lineas-card">\
            <div class="nl-icon-wrapper icon-cyan">' + iconJetski + '</div>\
            <h3>Motos de Agua</h3>\
            <p>Sea-Doo, Yamaha, Kawasaki y mas. Para turismo, rental o uso personal en lagos y costas.</p>\
            <span class="nl-cta">Mas informacion ' + iconArrow + '</span>\
          </a>\
        </div>\
        <div class="nuevas-lineas-bottom">\
          <p class="nuevas-lineas-bottom-text">Todas nuestras importaciones incluyen cotizacion completa con costos de compra, logistica, aduana, impuestos y entrega en Chile.</p>\
          <a href="https://wa.me/56940211459?text=Hola,%20quiero%20cotizar%20una%20importacion%20desde%20USA" class="nuevas-lineas-cta-btn" target="_blank" rel="noopener">\
            Cotizar Importacion ' + iconArrow + '\
          </a>\
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

  function insertNuevasLineasSection() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;

    var existing = document.getElementById('nuevas-lineas-importacion');
    if (existing) existing.remove();

    var checkInterval = setInterval(function() {
      var planesSection = findSectionByHeading('Planes de Busqueda');
      var clientesSection = findSectionByHeading('Lo que dicen');
      var videosSection = findSectionByHeading('Videos Imporlan');

      var targetSection = planesSection || videosSection;

      if (targetSection) {
        clearInterval(checkInterval);

        addNuevasLineasStyles();

        var nuevasLineasSection = createNuevasLineasSection();

        if (planesSection && planesSection.nextSibling) {
          planesSection.parentNode.insertBefore(nuevasLineasSection, planesSection.nextSibling);
        } else if (clientesSection) {
          clientesSection.parentNode.insertBefore(nuevasLineasSection, clientesSection);
        } else if (videosSection) {
          videosSection.parentNode.insertBefore(nuevasLineasSection, videosSection);
        }

        console.log('[Nuevas Lineas] Successfully inserted nuevas lineas de importacion section');
      }
    }, 500);

    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  onReady(function() {
    setTimeout(function() {
      insertNuevasLineasSection();
    }, 1500);
  });

})();
