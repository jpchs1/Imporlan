/**
 * Imporlan - Politica de Transparencia y FEE
 * Adds a Transparency Policy section to the HOME page
 * Communicates the Imporlan FEE (~CLP $3.000.000 per operation)
 * Inserted before footer, after existing sections
 * v1.0
 */

(function () {
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

  function addTransparenciaStyles() {
    if (document.getElementById('transparencia-home-styles')) return;

    var style = document.createElement('style');
    style.id = 'transparencia-home-styles';
    style.textContent = '\
      .transparencia-home {\
        position: relative;\
        padding: 96px 20px;\
        overflow: hidden;\
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);\
      }\
      .transparencia-home::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        bottom: 0;\
        background: radial-gradient(ellipse at 50% 20%, rgba(245, 158, 11, 0.08) 0%, transparent 60%);\
        pointer-events: none;\
      }\
      .transparencia-container {\
        max-width: 1100px;\
        margin: 0 auto;\
        position: relative;\
        z-index: 1;\
      }\
      .transparencia-home h2 {\
        text-align: center;\
        font-size: 2.5rem;\
        font-weight: 700;\
        color: #ffffff;\
        margin-bottom: 16px;\
        line-height: 1.3;\
      }\
      .transparencia-home h2 .kw-highlight {\
        background: linear-gradient(135deg, #f59e0b, #fbbf24);\
        -webkit-background-clip: text;\
        -webkit-text-fill-color: transparent;\
        background-clip: text;\
      }\
      .transparencia-home .section-subtitle {\
        text-align: center;\
        color: #9ca3af;\
        font-size: 1.1rem;\
        max-width: 750px;\
        margin: 0 auto 56px;\
        line-height: 1.6;\
      }\
      .transparencia-card {\
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);\
        border: 1px solid #2d5a87;\
        border-radius: 24px;\
        padding: 56px 48px;\
        position: relative;\
        overflow: hidden;\
      }\
      .transparencia-card::before {\
        content: "";\
        position: absolute;\
        top: 0;\
        left: 0;\
        right: 0;\
        height: 5px;\
        background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b);\
      }\
      .transparencia-grid {\
        display: grid;\
        grid-template-columns: 1fr 1fr;\
        gap: 56px;\
        align-items: center;\
      }\
      .transparencia-text h3 {\
        color: #ffffff;\
        font-size: 1.5rem;\
        font-weight: 700;\
        margin-bottom: 16px;\
        line-height: 1.3;\
      }\
      .transparencia-text p {\
        color: #cbd5e1;\
        font-size: 1rem;\
        line-height: 1.7;\
        margin-bottom: 14px;\
      }\
      .transparencia-text p strong {\
        color: #fbbf24;\
      }\
      .transparencia-fee-box {\
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.06) 100%);\
        border: 1px solid rgba(245, 158, 11, 0.35);\
        border-radius: 18px;\
        padding: 36px 32px;\
        text-align: center;\
      }\
      .transparencia-fee-label {\
        color: #fbbf24;\
        font-size: 0.85rem;\
        font-weight: 700;\
        text-transform: uppercase;\
        letter-spacing: 2px;\
        margin-bottom: 12px;\
      }\
      .transparencia-fee-amount {\
        font-size: 3rem;\
        font-weight: 800;\
        color: #ffffff;\
        margin-bottom: 6px;\
        line-height: 1.1;\
      }\
      .transparencia-fee-amount .currency {\
        font-size: 1.4rem;\
        font-weight: 600;\
        vertical-align: super;\
        color: #fbbf24;\
      }\
      .transparencia-fee-note {\
        color: #9ca3af;\
        font-size: 0.92rem;\
        margin-top: 8px;\
      }\
      .transparencia-fee-detail {\
        margin-top: 24px;\
        padding-top: 24px;\
        border-top: 1px solid rgba(245, 158, 11, 0.25);\
        color: #cbd5e1;\
        font-size: 0.92rem;\
        line-height: 1.6;\
      }\
      .transparencia-pillars {\
        display: grid;\
        grid-template-columns: repeat(3, 1fr);\
        gap: 24px;\
        margin-top: 48px;\
      }\
      .transparencia-pillar {\
        text-align: center;\
        padding: 24px 16px;\
      }\
      .transparencia-pillar-icon {\
        width: 56px;\
        height: 56px;\
        border-radius: 14px;\
        background: linear-gradient(135deg, #f59e0b, #d97706);\
        display: flex;\
        align-items: center;\
        justify-content: center;\
        margin: 0 auto 16px;\
        box-shadow: 0 6px 18px rgba(245, 158, 11, 0.3);\
      }\
      .transparencia-pillar-icon svg {\
        width: 28px;\
        height: 28px;\
        color: white;\
      }\
      .transparencia-pillar h4 {\
        color: #ffffff;\
        font-size: 1.05rem;\
        font-weight: 700;\
        margin-bottom: 8px;\
      }\
      .transparencia-pillar p {\
        color: #9ca3af;\
        font-size: 0.9rem;\
        line-height: 1.5;\
        margin: 0;\
      }\
      @media (max-width: 768px) {\
        .transparencia-home {\
          padding: 60px 16px;\
        }\
        .transparencia-home h2 {\
          font-size: 1.75rem;\
        }\
        .transparencia-card {\
          padding: 36px 24px;\
        }\
        .transparencia-grid {\
          grid-template-columns: 1fr;\
          gap: 32px;\
        }\
        .transparencia-fee-amount {\
          font-size: 2.2rem;\
        }\
        .transparencia-pillars {\
          grid-template-columns: 1fr;\
          gap: 16px;\
        }\
      }\
    ';
    document.head.appendChild(style);
  }

  // ============================================
  // SVG ICONS
  // ============================================

  var iconEye = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var iconHandshake = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>';
  var iconReceipt = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>';

  // ============================================
  // CREATE SECTION
  // ============================================

  function createTransparenciaSection() {
    var section = document.createElement('section');
    section.className = 'transparencia-home';
    section.id = 'politica-transparencia';

    section.innerHTML = '\
      <div class="transparencia-container">\
        <h2><span class="kw-highlight">Politica de Transparencia</span> Imporlan</h2>\
        <p class="section-subtitle">Sin sorpresas ni costos ocultos. Te informamos desde el primer contacto cuanto queda para nosotros y cuanto se destina a gastos reales de la operacion.</p>\
        \
        <div class="transparencia-card">\
          <div class="transparencia-grid">\
            <div class="transparencia-text">\
              <h3>FEE Imporlan claro y conocido desde el inicio</h3>\
              <p>En cada operacion de importacion te entregamos una <strong>cotizacion itemizada</strong> donde separamos cada partida: valor de la embarcacion, gastos de logistica, impuestos y nuestro honorario.</p>\
              <p>Asi sabes exactamente <strong>que es lo que queda para Imporlan</strong> y que se destina a gastos efectivos de la operacion (flete, seguros, aduana, surveyor, traslados, etc.).</p>\
              <p>Esto nos permite construir una relacion de confianza desde el dia 1, sin letra chica.</p>\
            </div>\
            <div class="transparencia-fee-box">\
              <div class="transparencia-fee-label">FEE Imporlan</div>\
              <div class="transparencia-fee-amount"><span class="currency">CLP</span> $3.000.000</div>\
              <div class="transparencia-fee-note">aprox. por operacion</div>\
              <div class="transparencia-fee-detail">\
                Honorario referencial por gestionar la importacion completa: busqueda, negociacion, inspeccion, logistica USA-Chile, desaduanaje y entrega.\
              </div>\
            </div>\
          </div>\
          \
          <div class="transparencia-pillars">\
            <div class="transparencia-pillar">\
              <div class="transparencia-pillar-icon">' + iconEye + '</div>\
              <h4>Cotizacion abierta</h4>\
              <p>Cada partida desglosada y conocida antes de avanzar.</p>\
            </div>\
            <div class="transparencia-pillar">\
              <div class="transparencia-pillar-icon">' + iconReceipt + '</div>\
              <h4>Pagos por hitos</h4>\
              <p>Pagas por etapas reales del proceso, no todo por adelantado.</p>\
            </div>\
            <div class="transparencia-pillar">\
              <div class="transparencia-pillar-icon">' + iconHandshake + '</div>\
              <h4>Honorario fijo</h4>\
              <p>FEE conocido y comunicado desde el primer contacto.</p>\
            </div>\
          </div>\
        </div>\
      </div>\
    ';

    return section;
  }

  // ============================================
  // INSERT SECTION
  // ============================================

  function insertTransparenciaSection() {
    if (window.location.pathname.includes('/panel')) return;
    if (
      window.location.pathname !== '/' &&
      window.location.pathname !== '/index.html' &&
      window.location.pathname !== '/test/' &&
      window.location.pathname !== '/test/index.html'
    ) {
      return;
    }

    var existing = document.getElementById('politica-transparencia');
    if (existing) existing.remove();

    var checkInterval = setInterval(function () {
      var inspeccionSection = document.getElementById('inspeccion-precompra');
      var procesoSection = document.getElementById('proceso-compra');
      var serviciosSection = document.getElementById('servicios-importacion');
      var footer = document.querySelector('footer');

      var insertPoint = null;
      var parentNode = null;

      if (inspeccionSection) {
        insertPoint = inspeccionSection.nextSibling;
        parentNode = inspeccionSection.parentNode;
      } else if (procesoSection) {
        insertPoint = procesoSection.nextSibling;
        parentNode = procesoSection.parentNode;
      } else if (serviciosSection) {
        insertPoint = serviciosSection.nextSibling;
        parentNode = serviciosSection.parentNode;
      } else if (footer) {
        insertPoint = footer;
        parentNode = footer.parentNode;
      }

      if (parentNode) {
        clearInterval(checkInterval);

        addTransparenciaStyles();
        var section = createTransparenciaSection();
        parentNode.insertBefore(section, insertPoint);

        console.log('[Politica Transparencia] Section inserted successfully');
      }
    }, 500);

    setTimeout(function () {
      clearInterval(checkInterval);
    }, 20000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  onReady(function () {
    setTimeout(function () {
      insertTransparenciaSection();
    }, 4000);
  });
})();
