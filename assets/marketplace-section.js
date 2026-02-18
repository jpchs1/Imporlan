/**
 * Imporlan Marketplace Section
 * Adds a section on the HOME page inviting users to explore used boats in the Marketplace
 * Users who register from this section are redirected to the Marketplace after signup
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

  function addMarketplaceStyles() {
    if (document.getElementById('marketplace-section-styles')) return;

    var style = document.createElement('style');
    style.id = 'marketplace-section-styles';
    style.textContent = '\
      .marketplace-section {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);\
      }\
      .marketplace-section::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 70%);\
        pointer-events: none;\
      }\
      .marketplace-container {\
        max-width: 1100px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .marketplace-header {\
        text-align: center;\
        margin-bottom: 48px;\
      }\
      .marketplace-badge {\
        display: inline-flex;\
        align-items: center;\
        gap: 8px;\
        background: rgba(16, 185, 129, 0.15);\
        border: 1px solid rgba(16, 185, 129, 0.3);\
        border-radius: 24px;\
        padding: 6px 16px;\
        font-size: 13px;\
        font-weight: 600;\
        color: #34d399;\
        margin-bottom: 20px;\
        text-transform: uppercase;\
        letter-spacing: 0.5px;\
      }\
      .marketplace-badge svg {\
        width: 16px;\
        height: 16px;\
      }\
      .marketplace-header h2 {\
        font-size: 2.5rem;\
        font-weight: 700;\
        color: #ffffff;\
        margin-bottom: 16px;\
        line-height: 1.2;\
      }\
      .marketplace-header h2 .highlight-text {\
        background: linear-gradient(135deg, #3b82f6, #06b6d4);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .marketplace-header .subtitle {\
        color: #9ca3af;\
        font-size: 1.1rem;\
        max-width: 600px;\
        margin: 0 auto;\
        line-height: 1.6;\
      }\
      .marketplace-grid {\
        display: grid;\
        grid-template-columns: repeat(3, 1fr);\
        gap: 24px;\
        margin-bottom: 48px;\
      }\
      .marketplace-feature {\
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 16px;\
        padding: 32px 24px;\
        text-align: center;\
        transition: all 0.3s ease;\
      }\
      .marketplace-feature:hover {\
        transform: translateY(-4px);\
        border-color: #3b82f6;\
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15);\
      }\
      .marketplace-feature .feature-icon {\
        width: 56px;\
        height: 56px;\
        border-radius: 14px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        margin: 0 auto 16px;\
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);\
      }\
      .marketplace-feature .feature-icon svg {\
        width: 28px;\
        height: 28px;\
        color: white;\
      }\
      .marketplace-feature .feature-icon.icon-cyan {\
        background: linear-gradient(135deg, #06b6d4, #0891b2);\
      }\
      .marketplace-feature .feature-icon.icon-green {\
        background: linear-gradient(135deg, #10b981, #059669);\
      }\
      .marketplace-feature .feature-icon.icon-orange {\
        background: linear-gradient(135deg, #f59e0b, #d97706);\
      }\
      .marketplace-feature h3 {\
        color: #ffffff;\
        font-size: 1.15rem;\
        font-weight: 600;\
        margin-bottom: 8px;\
      }\
      .marketplace-feature p {\
        color: #9ca3af;\
        font-size: 0.9rem;\
        line-height: 1.5;\
        margin: 0;\
      }\
      .marketplace-cta-wrapper {\
        text-align: center;\
      }\
      .marketplace-cta-btn {\
        display: inline-flex;\
        align-items: center;\
        gap: 10px;\
        background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);\
        color: #ffffff;\
        border: none;\
        border-radius: 14px;\
        padding: 18px 40px;\
        font-size: 1.1rem;\
        font-weight: 700;\
        cursor: pointer;\
        transition: all 0.3s ease;\
        position: relative;\
        overflow: hidden;\
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);\
        text-decoration: none;\
      }\
      .marketplace-cta-btn:hover {\
        transform: translateY(-3px);\
        box-shadow: 0 8px 35px rgba(37, 99, 235, 0.5), 0 4px 15px rgba(8, 145, 178, 0.3);\
      }\
      .marketplace-cta-btn svg {\
        width: 22px;\
        height: 22px;\
        transition: transform 0.3s ease;\
      }\
      .marketplace-cta-btn:hover svg {\
        transform: translateX(4px);\
      }\
      .marketplace-cta-sub {\
        color: #6b7280;\
        font-size: 0.85rem;\
        margin-top: 14px;\
      }\
      .marketplace-cta-sub a {\
        color: #60a5fa;\
        text-decoration: underline;\
        cursor: pointer;\
      }\
      .marketplace-cta-sub a:hover {\
        color: #93c5fd;\
      }\
      @media (max-width: 768px) {\
        .marketplace-section {\
          padding: 60px 16px;\
        }\
        .marketplace-header h2 {\
          font-size: 1.75rem;\
        }\
        .marketplace-grid {\
          grid-template-columns: 1fr;\
          gap: 16px;\
        }\
        .marketplace-feature {\
          padding: 24px 20px;\
        }\
        .marketplace-cta-btn {\
          padding: 16px 32px;\
          font-size: 1rem;\
          width: 100%;\
          justify-content: center;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  function createMarketplaceSection() {
    var section = document.createElement('section');
    section.className = 'marketplace-section';
    section.id = 'marketplace-lanchas';

    var iconSearch = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>';
    var iconShield = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
    var iconTag = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" x2="7.01" y1="7" y2="7"/></svg>';
    var iconStar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var iconArrow = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    var iconBoat = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M12 2v4"/><path d="m4.93 10.93 2.83 2.83"/><path d="m19.07 10.93-2.83 2.83"/></svg>';

    section.innerHTML = '\
      <div class="marketplace-container">\
        <div class="marketplace-header">\
          <div class="marketplace-badge">' + iconBoat + ' Marketplace Imporlan</div>\
          <h2>Encuentra <span class="highlight-text">Lanchas Usadas</span> en Chile</h2>\
          <p class="subtitle">Explora el Marketplace de Imporlan con embarcaciones usadas publicadas por otros usuarios. Compra directo, sin intermediarios y con la confianza de nuestra comunidad.</p>\
        </div>\
        <div class="marketplace-grid">\
          <div class="marketplace-feature">\
            <div class="feature-icon icon-cyan">' + iconSearch + '</div>\
            <h3>Explora Embarcaciones</h3>\
            <p>Navega por lanchas, veleros y motos de agua publicadas por nuestra comunidad</p>\
          </div>\
          <div class="marketplace-feature">\
            <div class="feature-icon icon-green">' + iconShield + '</div>\
            <h3>Compra con Confianza</h3>\
            <p>Todas las publicaciones son verificadas para tu seguridad y tranquilidad</p>\
          </div>\
          <div class="marketplace-feature">\
            <div class="feature-icon icon-orange">' + iconTag + '</div>\
            <h3>Publica Gratis</h3>\
            <p>Vende tu embarcacion sin costo. Registrate y publica en minutos</p>\
          </div>\
        </div>\
          <div id="home-boattrader-carousel" style="display:none;margin-bottom:40px;">\
            <h3 style="color:#fff;font-size:1.25rem;font-weight:600;margin-bottom:4px;text-align:center;">Oportunidades USA del Dia</h3>\
            <p style="color:#6b7280;font-size:0.85rem;text-align:center;margin-bottom:16px;">Importacion personalizada con Imporlan</p>\
            <div id="home-carousel-track" style="display:flex;gap:14px;overflow-x:auto;scroll-behavior:smooth;padding:4px 2px 12px;-ms-overflow-style:none;scrollbar-width:none;"></div>\
          </div>\
          <div class="marketplace-cta-wrapper">\
            <a class="marketplace-cta-btn" href="/marketplace.html" id="marketplace-cta-btn">\
              Ver Lanchas Usadas ' + iconArrow + '\
            </a>\
            <p class="marketplace-cta-sub">Explora el marketplace publico. <a id="marketplace-register-link">Registrate para publicar</a></p>\
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

  function getPanelUrl() {
    if (window.location.pathname.indexOf('/test') !== -1) {
      return '/panel-test/';
    }
    return '/panel/';
  }

  function goToMarketplace() {
    window.location.href = '/marketplace.html';
  }

  function goToRegister() {
    var panelUrl = getPanelUrl();
    sessionStorage.setItem('imporlan_redirect_after_login', panelUrl + '#/marketplace');
    window.location.href = panelUrl + '#/register';
  }

  function insertMarketplaceSection() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;

    var existing = document.getElementById('marketplace-lanchas');
    if (existing) existing.remove();

    var checkInterval = setInterval(function() {
      var planesSection = findSectionByHeading('Planes de Busqueda');
      var videosSection = findSectionByHeading('Videos Imporlan');

      var targetSection = planesSection || videosSection;

      if (targetSection) {
        clearInterval(checkInterval);

        addMarketplaceStyles();

        var marketplaceSection = createMarketplaceSection();
        targetSection.parentNode.insertBefore(marketplaceSection, targetSection);

        var ctaBtn = document.getElementById('marketplace-cta-btn');
        if (ctaBtn && !ctaBtn.getAttribute('href')) {
          ctaBtn.addEventListener('click', goToMarketplace);
        }

        loadHomeCarousel();

        var registerLink = document.getElementById('marketplace-register-link');
        if (registerLink) {
          registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            goToRegister();
          });
        }

        console.log('[Marketplace Section] Successfully inserted marketplace section');
      }
    }, 500);

    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  function loadHomeCarousel() {
    var apiBase = window.location.pathname.indexOf('/test') !== -1 ? '/test/api' : '/api';
    fetch(apiBase + '/boattrader_scraper.php?action=daily_top&limit=10')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data || !data.boats || data.boats.length === 0) return;
        var track = document.getElementById('home-carousel-track');
        var section = document.getElementById('home-boattrader-carousel');
        if (!track || !section) return;

        section.style.display = '';
        var svgCal = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
        track.innerHTML = data.boats.map(function(b) {
          var price = b.price ? 'USD $' + Number(b.price).toLocaleString('en-US') : 'Consultar';
          var title = b.make && b.model ? b.make + ' ' + b.model : b.title;
          if (title && title.length > 35) title = title.substring(0, 32) + '...';
          return '<div style="flex:0 0 220px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;cursor:pointer;transition:all 0.3s;" onclick="window.open(\'' + (b.url || '/marketplace.html').replace(/'/g, "\\'") + '\',\'_blank\')">' +
            (b.image_url ? '<img src="' + b.image_url + '" style="width:100%;height:120px;object-fit:cover;" loading="lazy" onerror="this.style.display=\'none\'">' : '<div style="width:100%;height:120px;background:#1e293b;"></div>') +
            '<div style="padding:10px 12px;">' +
              '<div style="font-size:0.65rem;color:#34d399;font-weight:600;margin-bottom:2px;">IMPORTAR CON IMPORLAN</div>' +
              '<div style="font-size:0.85rem;color:#fff;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (title || '') + '</div>' +
              '<div style="font-size:0.7rem;color:#94a3b8;margin-bottom:6px;">' + (b.year ? svgCal + ' ' + b.year : '') + '</div>' +
              '<div style="font-size:0.95rem;font-weight:700;background:linear-gradient(135deg,#2563eb,#0891b2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + price + '</div>' +
              '<a href="/marketplace.html" style="font-size:0.7rem;color:#60a5fa;text-decoration:none;font-weight:500;" onclick="event.stopPropagation()">Ver en Marketplace &rarr;</a>' +
            '</div>' +
          '</div>';
        }).join('');
      })
      .catch(function() { /* silently fail */ });
  }

  onReady(function() {
    setTimeout(function() {
      insertMarketplaceSection();
    }, 1500);
  });

})();
