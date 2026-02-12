/**
 * Post-Payment Popup for Imporlan Panel
 * Shows a congratulations message after a successful payment.
 * Appears once per purchase, can be closed manually or auto-closes after 10 seconds.
 */

(function() {
  'use strict';

  var POPUP_SHOWN_KEY = 'imporlan_payment_popup_shown_';
  var AUTO_CLOSE_MS = 10000;

  function getPaymentParams() {
    var params = new URLSearchParams(window.location.search);
    var hash = window.location.hash || '';
    var hashParams = {};
    if (hash.indexOf('?') !== -1) {
      hashParams = Object.fromEntries(new URLSearchParams(hash.split('?')[1]));
    }

    var payment = params.get('payment') || hashParams.payment || null;
    var plan = params.get('plan') || hashParams.plan || null;
    var order = params.get('order') || hashParams.order || null;
    var source = params.get('source') || hashParams.source || null;

    return { payment: payment, plan: plan, order: order, source: source };
  }

  function getPlanDisplayName(planId) {
    var names = {
      'fragata': 'Plan Fragata',
      'capitan': 'Plan Capitan de Navio',
      'almirante': 'Plan Almirante'
    };
    return names[planId] || planId || 'tu plan';
  }

  function isPlanDeBusqueda(planId) {
    return planId === 'fragata' || planId === 'capitan' || planId === 'almirante';
  }

  function getPopupKey(params) {
    var key = params.order || params.plan || 'general';
    return POPUP_SHOWN_KEY + key;
  }

  function wasAlreadyShown(params) {
    try {
      return localStorage.getItem(getPopupKey(params)) === 'true';
    } catch (e) {
      return false;
    }
  }

  function markAsShown(params) {
    try {
      localStorage.setItem(getPopupKey(params), 'true');
    } catch (e) {}
  }

  function showPopup(params) {
    if (document.getElementById('imporlan-payment-popup-overlay')) return;

    var planName = getPlanDisplayName(params.plan);
    var isBusqueda = isPlanDeBusqueda(params.plan);

    var title = isBusqueda
      ? 'Tu Plan de Busqueda ya esta activo!'
      : 'Tu Cotizacion por Links ya esta activa!';

    var message = isBusqueda
      ? 'Nuestro equipo ya comenzo a trabajar en tu busqueda personalizada. Revisa tu panel para ver el estado de tu plan.'
      : 'Ya puedes gestionar tus embarcaciones desde tu panel. Revisa tus productos contratados para ver los detalles.';

    var overlay = document.createElement('div');
    overlay.id = 'imporlan-payment-popup-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;animation:imporlanPopupFadeIn 0.3s ease;';

    overlay.innerHTML = '<div id="imporlan-payment-popup" style="' +
      'background:linear-gradient(135deg,#0a1628 0%,#1a365d 100%);' +
      'border-radius:20px;max-width:440px;width:90%;padding:36px 28px 28px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;text-align:center;' +
      'animation:imporlanPopupSlideIn 0.4s ease;' +
      '">' +
        '<button id="imporlan-popup-close" style="' +
          'position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.1);' +
          'border:none;color:#94a3b8;font-size:22px;cursor:pointer;width:36px;height:36px;' +
          'border-radius:50%;display:flex;align-items:center;justify-content:center;' +
          'transition:all 0.2s;line-height:1;' +
        '">&times;</button>' +

        '<div style="' +
          'width:72px;height:72px;margin:0 auto 20px;background:linear-gradient(135deg,#22c55e,#16a34a);' +
          'border-radius:50%;display:flex;align-items:center;justify-content:center;' +
          'box-shadow:0 8px 24px rgba(34,197,94,0.3);' +
        '">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"></polyline>' +
          '</svg>' +
        '</div>' +

        '<h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.3;">' +
          title +
        '</h2>' +

        (params.plan ? '<p style="color:#22d3ee;font-size:14px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;">' +
          planName +
        '</p>' : '') +

        '<p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">' +
          message +
        '</p>' +

        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<a href="/panel/#myproducts" style="' +
            'display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);' +
            'color:white;padding:13px 28px;border-radius:12px;font-size:15px;font-weight:600;' +
            'text-decoration:none;transition:transform 0.2s,box-shadow 0.2s;' +
            'box-shadow:0 4px 12px rgba(59,130,246,0.3);' +
          '">Ver Mis Productos Contratados</a>' +
        '</div>' +

        '<div id="imporlan-popup-timer" style="' +
          'margin-top:20px;display:flex;align-items:center;justify-content:center;gap:6px;' +
        '">' +
          '<div style="width:100%;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">' +
            '<div id="imporlan-popup-progress" style="' +
              'height:100%;background:linear-gradient(90deg,#22d3ee,#3b82f6);border-radius:2px;' +
              'width:100%;transition:width 0.1s linear;' +
            '"></div>' +
          '</div>' +
          '<span style="color:#64748b;font-size:11px;white-space:nowrap;" id="imporlan-popup-countdown">10s</span>' +
        '</div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = '@keyframes imporlanPopupFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes imporlanPopupSlideIn{from{opacity:0;transform:translateY(30px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    var closeBtn = document.getElementById('imporlan-popup-close');
    var progressBar = document.getElementById('imporlan-popup-progress');
    var countdownEl = document.getElementById('imporlan-popup-countdown');

    var startTime = Date.now();
    var timerInterval = setInterval(function() {
      var elapsed = Date.now() - startTime;
      var remaining = Math.max(0, AUTO_CLOSE_MS - elapsed);
      var pct = (remaining / AUTO_CLOSE_MS) * 100;
      if (progressBar) progressBar.style.width = pct + '%';
      if (countdownEl) countdownEl.textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining <= 0) {
        clearInterval(timerInterval);
        closePopup();
      }
    }, 100);

    function closePopup() {
      clearInterval(timerInterval);
      var ov = document.getElementById('imporlan-payment-popup-overlay');
      if (ov) {
        ov.style.opacity = '0';
        ov.style.transition = 'opacity 0.3s ease';
        setTimeout(function() { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
      }
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closePopup);
      closeBtn.addEventListener('mouseenter', function() { this.style.background = 'rgba(255,255,255,0.2)'; this.style.color = '#ffffff'; });
      closeBtn.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,0.1)'; this.style.color = '#94a3b8'; });
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closePopup();
    });

    markAsShown(params);
  }

  function init() {
    var params = getPaymentParams();
    if (params.payment !== 'success') return;
    if (wasAlreadyShown(params)) return;
    setTimeout(function() { showPopup(params); }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
