/**
 * Imporlan - Ranking Preview Section
 * Adds a promotional section on the HOME page showing a preview of the User Panel Ranking feature
 * Inserted after "Planes de Busqueda" section to incentivize plan purchases
 * Uses demo data inspired by a real user ranking (anonymized)
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

  function addRankingPreviewStyles() {
    if (document.getElementById('ranking-preview-styles')) return;

    var style = document.createElement('style');
    style.id = 'ranking-preview-styles';
    style.textContent = '\
      .ranking-preview-section {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);\
      }\
      .ranking-preview-section::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(6, 182, 212, 0.06) 0%, transparent 60%);\
        pointer-events: none;\
      }\
      .ranking-preview-container {\
        max-width: 1200px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .ranking-preview-header {\
        text-align: center;\
        margin-bottom: 48px;\
      }\
      .ranking-preview-badge {\
        display: inline-flex;\
        align-items: center;\
        gap: 8px;\
        background: rgba(245, 158, 11, 0.15);\
        border: 1px solid rgba(245, 158, 11, 0.3);\
        border-radius: 24px;\
        padding: 6px 16px;\
        font-size: 13px;\
        font-weight: 600;\
        color: #fbbf24;\
        margin-bottom: 20px;\
        text-transform: uppercase;\
        letter-spacing: 0.5px;\
      }\
      .ranking-preview-badge svg {\
        width: 16px;\
        height: 16px;\
      }\
      .ranking-preview-header h2 {\
        font-size: 2.5rem;\
        font-weight: 700;\
        color: #ffffff;\
        margin-bottom: 16px;\
        line-height: 1.2;\
      }\
      .ranking-preview-header h2 .rp-highlight {\
        background: linear-gradient(135deg, #f59e0b, #06b6d4);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .ranking-preview-header .rp-subtitle {\
        color: #9ca3af;\
        font-size: 1.1rem;\
        max-width: 750px;\
        margin: 0 auto;\
        line-height: 1.6;\
      }\
      .ranking-preview-layout {\
        display: grid;\
        grid-template-columns: 1fr 1fr;\
        gap: 40px;\
        align-items: start;\
        max-width: 1100px;\
        margin: 0 auto 48px;\
      }\
      /* Left: Mock panel */\
      .ranking-preview-panel {\
        background: #ffffff;\
        border-radius: 20px;\
        overflow: hidden;\
        box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05);\
        transform: perspective(1000px) rotateY(-2deg) rotateX(1deg);\
        transition: transform 0.4s ease;\
      }\
      .ranking-preview-panel:hover {\
        transform: perspective(1000px) rotateY(0deg) rotateX(0deg);\
      }\
      .ranking-preview-panel-header {\
        background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1a365d 100%);\
        padding: 20px 24px;\
        position: relative;\
        overflow: hidden;\
      }\
      .ranking-preview-panel-header::after {\
        content: "";\
        position: absolute;\
        top: -15px;\
        right: -15px;\
        width: 80px;\
        height: 80px;\
        background: rgba(8,145,178,0.12);\
        border-radius: 50%;\
      }\
      .ranking-preview-panel-header h3 {\
        color: #fff;\
        font-size: 18px;\
        font-weight: 700;\
        margin: 0;\
      }\
      .ranking-preview-panel-header p {\
        color: rgba(148,163,184,0.8);\
        font-size: 12px;\
        margin: 4px 0 0;\
      }\
      .ranking-preview-ranking-header {\
        padding: 16px 24px;\
        border-bottom: 1px solid #f1f5f9;\
        display: flex;\
        align-items: center;\
        gap: 12px;\
      }\
      .ranking-preview-ranking-icon {\
        width: 36px;\
        height: 36px;\
        background: linear-gradient(135deg, #0891b2, #06b6d4);\
        border-radius: 10px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        flex-shrink: 0;\
      }\
      .ranking-preview-ranking-icon svg {\
        width: 16px;\
        height: 16px;\
      }\
      .ranking-preview-info-bar {\
        padding: 10px 24px;\
        background: linear-gradient(135deg, #ecfdf5, #d1fae5);\
        border-bottom: 1px solid #a7f3d0;\
        display: flex;\
        align-items: center;\
        gap: 8px;\
      }\
      .ranking-preview-info-bar svg {\
        flex-shrink: 0;\
      }\
      .ranking-preview-info-bar span {\
        font-size: 12px;\
        color: #065f46;\
        font-weight: 500;\
      }\
      .ranking-preview-tip-bar {\
        padding: 10px 24px;\
        background: #eff6ff;\
        border-bottom: 1px solid #bfdbfe;\
        display: flex;\
        align-items: center;\
        gap: 8px;\
      }\
      .ranking-preview-tip-bar svg {\
        flex-shrink: 0;\
      }\
      .ranking-preview-tip-bar span {\
        font-size: 12px;\
        color: #1e40af;\
        font-weight: 500;\
        flex: 1;\
      }\
      .rp-notify-btn {\
        padding: 6px 14px;\
        border-radius: 8px;\
        border: none;\
        background: linear-gradient(135deg, #f59e0b, #d97706);\
        color: #fff;\
        font-size: 11px;\
        font-weight: 600;\
        cursor: default;\
        display: inline-flex;\
        align-items: center;\
        gap: 4px;\
        white-space: nowrap;\
      }\
      .ranking-preview-cards {\
        padding: 16px 20px;\
        display: flex;\
        flex-direction: column;\
        gap: 12px;\
      }\
      /* Individual boat card */\
      .rp-boat-card {\
        background: #fff;\
        border-radius: 14px;\
        border: 1px solid #e2e8f0;\
        overflow: hidden;\
        position: relative;\
        box-shadow: 0 1px 4px rgba(0,0,0,0.04);\
        transition: all 0.25s;\
      }\
      .rp-boat-card:hover {\
        box-shadow: 0 4px 16px rgba(0,0,0,0.08);\
        border-color: #cbd5e1;\
      }\
      .rp-boat-card-row {\
        display: flex;\
        gap: 0;\
      }\
      .rp-drag-handle {\
        flex-shrink: 0;\
        width: 32px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        background: linear-gradient(to right, #f8fafc, #f1f5f9);\
        border-right: 1px solid #e2e8f0;\
        opacity: 0.6;\
      }\
      .rp-boat-card:hover .rp-drag-handle {\
        opacity: 1;\
      }\
      .rp-card-body {\
        flex: 1;\
        padding: 14px 16px;\
        display: flex;\
        gap: 14px;\
        min-width: 0;\
      }\
      .rp-card-img {\
        width: 90px;\
        height: 68px;\
        border-radius: 10px;\
        object-fit: cover;\
        flex-shrink: 0;\
        background: #f1f5f9;\
      }\
      .rp-card-text {\
        flex: 1;\
        min-width: 0;\
      }\
      .rp-card-text h4 {\
        margin: 0 0 4px;\
        font-size: 14px;\
        font-weight: 600;\
        color: #1e293b;\
        white-space: nowrap;\
        overflow: hidden;\
        text-overflow: ellipsis;\
      }\
      .rp-card-meta {\
        display: flex;\
        gap: 12px;\
        flex-wrap: wrap;\
        margin-bottom: 6px;\
      }\
      .rp-card-meta span {\
        font-size: 11px;\
        color: #64748b;\
        display: inline-flex;\
        align-items: center;\
        gap: 3px;\
      }\
      .rp-card-meta svg {\
        width: 12px;\
        height: 12px;\
      }\
      .rp-card-prices {\
        display: flex;\
        gap: 12px;\
        flex-wrap: wrap;\
      }\
      .rp-price-tag {\
        padding: 3px 8px;\
        border-radius: 6px;\
        font-size: 11px;\
        font-weight: 600;\
      }\
      .rp-price-usd {\
        background: #eff6ff;\
        color: #1e40af;\
      }\
      .rp-price-clp {\
        background: #ecfdf5;\
        color: #065f46;\
      }\
      .rp-ranking-number {\
        position: absolute;\
        top: 10px;\
        right: 10px;\
        background: linear-gradient(135deg, #fbbf24, #f59e0b);\
        color: #fff;\
        width: 28px;\
        height: 28px;\
        border-radius: 50%;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        font-size: 12px;\
        font-weight: 700;\
        box-shadow: 0 2px 8px rgba(245,158,11,0.3);\
      }\
      /* Right side: features list */\
      .ranking-preview-features {\
        padding-top: 20px;\
      }\
      .rp-feature-item {\
        display: flex;\
        gap: 16px;\
        margin-bottom: 28px;\
        align-items: flex-start;\
      }\
      .rp-feature-icon {\
        width: 48px;\
        height: 48px;\
        border-radius: 14px;\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        flex-shrink: 0;\
      }\
      .rp-feature-icon svg {\
        width: 24px;\
        height: 24px;\
      }\
      .rp-feature-icon.rp-icon-amber { background: rgba(245, 158, 11, 0.15); }\
      .rp-feature-icon.rp-icon-cyan { background: rgba(6, 182, 212, 0.15); }\
      .rp-feature-icon.rp-icon-green { background: rgba(16, 185, 129, 0.15); }\
      .rp-feature-icon.rp-icon-blue { background: rgba(59, 130, 246, 0.15); }\
      .rp-feature-text h4 {\
        margin: 0 0 6px;\
        font-size: 1.05rem;\
        font-weight: 600;\
        color: #ffffff;\
      }\
      .rp-feature-text p {\
        margin: 0;\
        font-size: 0.9rem;\
        color: #9ca3af;\
        line-height: 1.5;\
      }\
      .ranking-preview-cta {\
        text-align: center;\
        padding-top: 8px;\
      }\
      .rp-cta-btn {\
        display: inline-flex;\
        align-items: center;\
        gap: 10px;\
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);\
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
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);\
        text-decoration: none;\
      }\
      .rp-cta-btn:hover {\
        transform: translateY(-3px);\
        box-shadow: 0 8px 35px rgba(245, 158, 11, 0.5), 0 4px 15px rgba(217, 119, 6, 0.3);\
      }\
      .rp-cta-btn svg {\
        width: 20px;\
        height: 20px;\
        transition: transform 0.3s ease;\
      }\
      .rp-cta-btn:hover svg {\
        transform: translateX(4px);\
      }\
      .rp-blur-overlay {\
        position: relative;\
      }\
      .rp-blur-overlay::after {\
        content: "";\
        position: absolute;\
        bottom: 0;\
        left: 0;\
        right: 0;\
        height: 80px;\
        background: linear-gradient(to bottom, transparent, #ffffff);\
        pointer-events: none;\
        border-radius: 0 0 20px 20px;\
      }\
      .rp-demo-label {\
        position: absolute;\
        top: 16px;\
        right: 16px;\
        background: rgba(245, 158, 11, 0.9);\
        color: #fff;\
        padding: 4px 12px;\
        border-radius: 20px;\
        font-size: 11px;\
        font-weight: 700;\
        letter-spacing: 0.5px;\
        z-index: 2;\
        text-transform: uppercase;\
      }\
      @media (max-width: 900px) {\
        .ranking-preview-layout {\
          grid-template-columns: 1fr;\
          gap: 32px;\
        }\
        .ranking-preview-panel {\
          transform: none;\
        }\
        .ranking-preview-panel:hover {\
          transform: none;\
        }\
        .ranking-preview-features {\
          padding-top: 0;\
        }\
      }\
      @media (max-width: 768px) {\
        .ranking-preview-section {\
          padding: 60px 16px;\
        }\
        .ranking-preview-header h2 {\
          font-size: 1.75rem;\
        }\
        .rp-card-img {\
          width: 70px;\
          height: 54px;\
        }\
        .rp-card-body {\
          padding: 10px 12px;\
          gap: 10px;\
        }\
        .rp-card-text h4 {\
          font-size: 13px;\
        }\
        .rp-cta-btn {\
          padding: 14px 28px;\
          font-size: 1rem;\
          width: 100%;\
          justify-content: center;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  /* Demo boat data - inspired by a real user ranking, anonymized */
  var demoBoats = [
    {
      title: 'Chaparral 246 SSi Sport 2019',
      location: 'Florida, USA',
      hours: '120 hrs',
      priceUsd: '$38,500',
      priceClp: '$36.190.000',
      img: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="136" viewBox="0 0 180 136"><rect width="180" height="136" fill="#e0f2fe"/><path d="M20 95 L50 70 L80 85 L110 55 L140 75 L160 60 L160 95 Z" fill="#0891b2" opacity="0.3"/><path d="M30 100 L90 80 L150 100 Z" fill="#0891b2" opacity="0.5"/><circle cx="140" cy="35" r="15" fill="#fbbf24" opacity="0.6"/><text x="90" y="115" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0891b2">Chaparral 246</text></svg>')
    },
    {
      title: 'Yamaha AR210 2020',
      location: 'Texas, USA',
      hours: '85 hrs',
      priceUsd: '$32,000',
      priceClp: '$30.080.000',
      img: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="136" viewBox="0 0 180 136"><rect width="180" height="136" fill="#ecfdf5"/><path d="M20 90 L60 65 L100 80 L140 55 L160 70 L160 90 Z" fill="#059669" opacity="0.3"/><path d="M25 98 L85 78 L155 98 Z" fill="#059669" opacity="0.5"/><circle cx="145" cy="30" r="14" fill="#fbbf24" opacity="0.5"/><text x="90" y="115" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#059669">Yamaha AR210</text></svg>')
    },
    {
      title: 'Sea Ray SPX 190 2021',
      location: 'California, USA',
      hours: '65 hrs',
      priceUsd: '$41,200',
      priceClp: '$38.728.000',
      img: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="136" viewBox="0 0 180 136"><rect width="180" height="136" fill="#fef3c7"/><path d="M15 88 L55 63 L95 78 L135 52 L165 68 L165 88 Z" fill="#b45309" opacity="0.3"/><path d="M28 96 L88 76 L152 96 Z" fill="#b45309" opacity="0.5"/><circle cx="142" cy="32" r="13" fill="#fbbf24" opacity="0.6"/><text x="90" y="115" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#b45309">Sea Ray SPX 190</text></svg>')
    }
  ];

  var iconArrow = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  function buildBoatCard(boat, index) {
    return '<div class="rp-boat-card">' +
      '<div class="rp-ranking-number">' + (index + 1) + '</div>' +
      '<div class="rp-boat-card-row">' +
      '<div class="rp-drag-handle"><svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg></div>' +
      '<div class="rp-card-body">' +
      '<img class="rp-card-img" src="' + boat.img + '" alt="' + boat.title + '">' +
      '<div class="rp-card-text">' +
      '<h4>' + boat.title + '</h4>' +
      '<div class="rp-card-meta">' +
      '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + boat.location + '</span>' +
      '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + boat.hours + '</span></div>' +
      '<div class="rp-card-prices">' +
      '<span class="rp-price-tag rp-price-usd">' + boat.priceUsd + ' USD</span>' +
      '<span class="rp-price-tag rp-price-clp">' + boat.priceClp + ' CLP</span>' +
      '</div></div></div></div></div>';
  }

  function createRankingPreviewSection() {
    var section = document.createElement('section');
    section.className = 'ranking-preview-section';
    section.id = 'ranking-preview';

    var cardsHtml = '';
    demoBoats.forEach(function(boat, i) {
      cardsHtml += buildBoatCard(boat, i);
    });

    section.innerHTML = '\
      <div class="ranking-preview-container">\
        <div class="ranking-preview-header">\
          <div class="ranking-preview-badge">\
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>\
            Panel de Usuario\
          </div>\
          <h2>Arma tu <span class="rp-highlight">Ranking de Embarcaciones</span></h2>\
          <p class="rp-subtitle">Con nuestros Planes de Busqueda accedes a tu Panel de Usuario donde podras ver todas las opciones encontradas por tu agente, ordenarlas segun tu preferencia y notificar tus favoritas con un solo click.</p>\
        </div>\
        <div class="ranking-preview-layout">\
          <div class="ranking-preview-panel rp-blur-overlay">\
            <span class="rp-demo-label">Vista Previa</span>\
            <div class="ranking-preview-panel-header">\
              <h3>Expediente #EXP-2025-047</h3>\
              <p>Cliente Premium - Plan Almirante</p>\
            </div>\
            <div class="ranking-preview-ranking-header">\
              <div class="ranking-preview-ranking-icon">\
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>\
              </div>\
              <div>\
                <h4 style="margin:0;font-size:16px;font-weight:700;color:#1e293b">Ranking de Embarcaciones</h4>\
                <p style="margin:2px 0 0;font-size:11px;color:#94a3b8">Ordena de la que mas te gusta a la que menos</p>\
              </div>\
              <span style="margin-left:auto;font-size:12px;color:#64748b;font-weight:500">3 resultados</span>\
            </div>\
            <div class="ranking-preview-info-bar">\
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>\
              <span>Ranking armado por <strong>J. M.</strong> (Usuario) - 28 mar 2026</span>\
            </div>\
            <div class="ranking-preview-tip-bar">\
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>\
              <span>Arrastra las tarjetas para armar tu ranking</span>\
              <span class="rp-notify-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Notificar</span>\
            </div>\
            <div class="ranking-preview-cards">\
              ' + cardsHtml + '\
            </div>\
          </div>\
          <div class="ranking-preview-features">\
            <div class="rp-feature-item">\
              <div class="rp-feature-icon rp-icon-amber">\
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>\
              </div>\
              <div class="rp-feature-text">\
                <h4>Ranking con Drag & Drop</h4>\
                <p>Arrastra y ordena las embarcaciones segun tu preferencia. Tu agente sabra exactamente cual te interesa mas.</p>\
              </div>\
            </div>\
            <div class="rp-feature-item">\
              <div class="rp-feature-icon rp-icon-cyan">\
                <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>\
              </div>\
              <div class="rp-feature-text">\
                <h4>Notificacion Instantanea</h4>\
                <p>Con un click notificas al agente tu ranking actualizado. El recibe un email con tus preferencias y actua de inmediato.</p>\
              </div>\
            </div>\
            <div class="rp-feature-item">\
              <div class="rp-feature-icon rp-icon-green">\
                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>\
              </div>\
              <div class="rp-feature-text">\
                <h4>Monitoreo en Tiempo Real</h4>\
                <p>Ve nuevas embarcaciones agregadas por tu agente en tiempo real. El panel se actualiza automaticamente mientras navegas.</p>\
              </div>\
            </div>\
            <div class="rp-feature-item">\
              <div class="rp-feature-icon rp-icon-blue">\
                <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>\
              </div>\
              <div class="rp-feature-text">\
                <h4>Fotos, Precios y Detalles</h4>\
                <p>Cada embarcacion incluye fotos, precios en USD y CLP, ubicacion, horas de motor y link directo a la publicacion original.</p>\
              </div>\
            </div>\
          </div>\
        </div>\
        <div class="ranking-preview-cta">\
          <a href="#pricing" class="rp-cta-btn" onclick="document.querySelector(\'[class*=pricing], section h2\') && (function(){ var secs = document.querySelectorAll(\'section\'); for(var i=0;i<secs.length;i++){var h=secs[i].querySelector(\'h2\');if(h && h.textContent.indexOf(\'Planes de Busqueda\')!==-1){secs[i].scrollIntoView({behavior:\'smooth\'});return;}} })()">\
            Ver Planes de Busqueda ' + iconArrow + '\
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

  function insertRankingPreviewSection() {
    if (window.location.pathname.indexOf('/panel') !== -1) return;

    var existing = document.getElementById('ranking-preview');
    if (existing) existing.remove();

    var checkInterval = setInterval(function() {
      var planesSection = findSectionByHeading('Planes de Busqueda');

      if (planesSection) {
        clearInterval(checkInterval);

        addRankingPreviewStyles();

        var rankingSection = createRankingPreviewSection();

        /* Insert right after Planes de Busqueda */
        if (planesSection.nextSibling) {
          planesSection.parentNode.insertBefore(rankingSection, planesSection.nextSibling);
        } else {
          planesSection.parentNode.appendChild(rankingSection);
        }

        console.log('[Ranking Preview] Successfully inserted ranking preview section');
      }
    }, 500);

    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  onReady(function() {
    setTimeout(function() {
      insertRankingPreviewSection();
    }, 1200);
  });

})();
