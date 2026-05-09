/**
 * Cotizador Bridge: Home -> Panel
 *
 * The home React bundle saves the quotation form to
 *   localStorage.imporlan_quotation_data = {name,email,phone,country,links,timestamp,type}
 * and redirects to /panel/. After the user logs in/registers, this script
 * navigates to the Cotizador Online section (#quotation) and pre-fills the
 * link inputs so they can review and pay.
 *
 * Flow:
 *   1. On every panel page load, read imporlan_quotation_data.
 *   2. Wait until the user is authenticated (imporlan_token exists).
 *   3. Force the hash to #quotation (one time, only if not already there).
 *   4. Poll for the link inputs and set their values via the React-compatible
 *      setter, then clear the payload so it doesn't fire twice.
 *   5. Show a confirmation toast.
 */
(function () {
  'use strict';

  var KEY = 'imporlan_quotation_data';
  var TOKEN_KEY = 'imporlan_token';
  var POLL_MS = 500;
  var MAX_TICKS = 240; // 2 minutes

  function readPayload() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.links)) return null;
      var links = data.links.filter(function (s) { return typeof s === 'string' && s.trim(); });
      if (!links.length) return null;
      data.links = links;
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearPayload() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function isAuthed() {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return false; }
  }

  function setReactInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findLinkInputs() {
    // Panel cotizador inputs share placeholder "https://www.boattrader.com/boat/...".
    var nodes = document.querySelectorAll('input[placeholder*="boattrader.com"]');
    if (nodes.length) return Array.from(nodes);
    // Fallback only when we are on the cotizador route.
    if (window.location.hash.indexOf('quotation') === -1) return [];
    var fallback = document.querySelectorAll('input.font-mono, input[placeholder^="https://"]');
    return Array.from(fallback).filter(function (n) { return n.type !== 'email'; });
  }

  var hashForced = false;
  function ensureHash() {
    if (hashForced) return;
    if (window.location.hash.indexOf('quotation') !== -1) { hashForced = true; return; }
    hashForced = true;
    try {
      history.replaceState(null, '', window.location.pathname + '#quotation');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      window.location.hash = '#quotation';
    }
  }

  var toastShown = false;
  function showToast(msg) {
    if (toastShown) return;
    toastShown = true;
    if (!document.getElementById('imp-bridge-toast-style')) {
      var s = document.createElement('style');
      s.id = 'imp-bridge-toast-style';
      s.textContent = '@keyframes imp-bridge-pop{from{transform:translate(-50%,-12px);opacity:0}to{transform:translate(-50%,0);opacity:1}}';
      document.head.appendChild(s);
    }
    var t = document.createElement('div');
    t.id = 'imp-bridge-toast';
    t.textContent = msg;
    t.style.cssText = [
      'position:fixed', 'left:50%', 'top:18px', 'transform:translateX(-50%)',
      'background:linear-gradient(135deg,#059669,#10b981)', 'color:#fff',
      'padding:12px 18px', 'border-radius:12px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)', 'z-index:99999',
      'font-weight:600', 'font-size:14px',
      'max-width:90vw', 'text-align:center',
      'animation:imp-bridge-pop .35s ease-out'
    ].join(';');
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .4s';
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 500);
    }, 5000);
  }

  // Some Cotizador implementations seed slot 0 with a demo URL. If our payload
  // covers fewer slots than exist, blank out the leftover demo so the user
  // doesn't pay for it by mistake.
  var DEMO_MARKER = 'boattrader.com/boat/2021-cobalt';
  function clearDemoSlots(inputs, fromIndex) {
    for (var i = fromIndex; i < inputs.length; i++) {
      var v = inputs[i].value || '';
      if (v.indexOf(DEMO_MARKER) !== -1) setReactInputValue(inputs[i], '');
    }
  }

  function tryRestore(payload) {
    if (!isAuthed()) return false;
    ensureHash();
    var inputs = findLinkInputs();
    if (!inputs.length) return false;

    payload.links.forEach(function (link, i) {
      if (i < inputs.length) setReactInputValue(inputs[i], link);
    });
    clearDemoSlots(inputs, payload.links.length);

    // Bring the form into view so the user immediately sees the prefilled state.
    if (inputs[0] && inputs[0].scrollIntoView) {
      try { inputs[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }

    showToast('Tus links de cotizacion estan listos. Revisa y procede al pago.');
    clearPayload();
    return true;
  }

  function start() {
    var payload = readPayload();
    if (!payload) return;
    var ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      var done = false;
      try { done = tryRestore(payload); } catch (e) { /* keep polling */ }
      if (done || ticks >= MAX_TICKS) clearInterval(iv);
    }, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
