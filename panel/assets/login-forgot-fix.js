/**
 * Imporlan — Panel de clientes · arreglo del botón "¿Olvidaste tu contraseña?"
 * ---------------------------------------------------------------------------
 * El bundle compilado que sirve /panel/ es anterior al arreglo que ya existe en
 * el fuente (admin-react/src/user/pages/Login.jsx). En esa compilación el botón
 * se renderiza sin onClick y, peor, sin type="button": al estar dentro del
 * <form> del login toma el type="submit" por defecto, envía el formulario y la
 * API responde {"detail":"Endpoint not found"}.
 *
 * Este script neutraliza ese comportamiento y muestra las vías reales de
 * recuperación. Es deliberadamente conservador:
 *
 *   - Sólo toca botones cuyo type NO sea "button". La versión corregida del
 *     fuente sí lo declara, así que cuando se recompile el panel este script
 *     deja de intervenir solo, sin necesidad de removerlo.
 *   - No modifica el formulario de login ni ninguna petición.
 *
 * Version 1.0
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__imporlanForgotFix) return;
  window.__imporlanForgotFix = true;

  var WHATSAPP = 'https://wa.me/56940211459?text=' +
    encodeURIComponent('Hola, necesito recuperar mi contraseña del panel Imporlan');
  var EMAIL = 'contacto@imporlan.cl';
  var STYLE_ID = 'imp-forgot-fix-style';

  function isForgotButton(el) {
    if (!el || el.tagName !== 'BUTTON') return false;
    // El fuente ya corregido declara type="button": si lo trae, no intervenimos.
    if ((el.getAttribute('type') || '').toLowerCase() === 'button') return false;
    var t = (el.textContent || '').toLowerCase();
    return t.indexOf('olvidaste') !== -1 && t.indexOf('contrase') !== -1;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.impfg-ov{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'padding:20px;background:rgba(3,8,18,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}',
      '.impfg-box{width:100%;max-width:420px;padding:30px 28px;border-radius:22px;color:#e2e8f0;',
      'background:linear-gradient(180deg,#0f2140 0%,#0a1628 100%);border:1px solid rgba(255,255,255,.10);',
      'box-shadow:0 40px 90px -30px rgba(0,0,0,.8);',
      'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '.impfg-box h3{margin:0 0 8px;font-size:1.22rem;font-weight:800;color:#fff;letter-spacing:-.02em;}',
      '.impfg-box p{margin:0 0 18px;font-size:13.6px;line-height:1.65;color:#94a3b8;}',
      '.impfg-row{display:flex;align-items:center;gap:11px;padding:13px 15px;border-radius:13px;margin-bottom:10px;',
      'text-decoration:none;font-size:13.6px;font-weight:600;transition:background .2s,border-color .2s;}',
      '.impfg-mail{background:rgba(34,211,238,.10);border:1px solid rgba(34,211,238,.26);color:#7dd3fc;}',
      '.impfg-mail:hover{background:rgba(34,211,238,.18);}',
      '.impfg-wa{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.28);color:#86efac;}',
      '.impfg-wa:hover{background:rgba(34,197,94,.20);}',
      '.impfg-adm{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#cbd5e1;}',
      '.impfg-adm:hover{background:rgba(255,255,255,.10);}',
      '.impfg-close{width:100%;margin-top:6px;padding:12px;border:none;border-radius:12px;cursor:pointer;',
      'background:rgba(255,255,255,.06);color:#94a3b8;font-family:inherit;font-size:13px;font-weight:600;}',
      '.impfg-close:hover{background:rgba(255,255,255,.11);color:#e2e8f0;}',
      '@media(prefers-reduced-motion:reduce){.impfg-row{transition:none;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function openDialog() {
    injectStyles();
    if (document.querySelector('.impfg-ov')) return;

    var ov = document.createElement('div');
    ov.className = 'impfg-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = [
      '<div class="impfg-box">',
      '  <h3>Recuperar contraseña</h3>',
      '  <p>Escríbenos y te ayudamos a restablecer el acceso a tu panel.</p>',
      '  <a class="impfg-row impfg-mail" href="mailto:' + EMAIL + '">' + EMAIL + '</a>',
      '  <a class="impfg-row impfg-wa" href="' + WHATSAPP + '" target="_blank" rel="noopener noreferrer">WhatsApp +56 9 4021 1459</a>',
      '  <a class="impfg-row impfg-adm" href="/panel/admin/">¿Eres del equipo Imporlan? Entra al panel de administración</a>',
      '  <button type="button" class="impfg-close">Volver al inicio de sesión</button>',
      '</div>'
    ].join('');

    function close() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.impfg-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  }

  /* Captura en fase de captura: llegamos antes de que el botón sin
     type="button" dispare el submit del formulario de login. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!isForgotButton(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    openDialog();
  }, true);

  /* Refuerzo: si el formulario llegara a enviarse igual, no dejamos que el
     click en ese botón provoque un submit. */
  document.addEventListener('submit', function (e) {
    var active = document.activeElement;
    if (isForgotButton(active)) {
      e.preventDefault();
      openDialog();
    }
  }, true);
})();
