/**
 * Support Page Enhancer for Imporlan Panel
 * Replaces the default Soporte page with a professional redesigned version
 * that submits to the support_api.php endpoint (contacto@imporlan.cl)
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/test/")
    ? "/test/api"
    : window.location.pathname.includes("/panel-test")
      ? "/test/api"
      : "/api";

  let lastEnhancedContent = null;
  let isSubmitting = false;

  function getUserData() {
    try {
      const raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function isSoportePage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (h1 && h1.textContent.trim() === "Soporte") return true;
    return false;
  }

  function buildPageHTML(user) {
    const userName = user ? user.name || "" : "";
    const userEmail = user ? user.email || "" : "";

    return `
<div class="sp-enhanced" style="max-width:1200px;margin:0 auto;animation:spFadeIn .4s ease">

  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a365d 100%);border-radius:20px;padding:40px 44px 36px;margin-bottom:28px;position:relative;overflow:hidden">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(59,130,246,.15) 0%,transparent 70%);border-radius:50%"></div>
    <div style="position:absolute;bottom:-60px;left:-30px;width:180px;height:180px;background:radial-gradient(circle,rgba(96,165,250,.1) 0%,transparent 70%);border-radius:50%"></div>
    <div style="position:relative;z-index:1;display:flex;align-items:center;gap:20px">
      <div style="width:56px;height:56px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div>
        <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 4px">Centro de Soporte</h1>
        <p style="color:#94a3b8;font-size:15px;margin:0">Estamos aqui para ayudarte con tu importacion</p>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px">
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;transition:all .2s;cursor:default" onmouseover="this.style.boxShadow='0 8px 25px rgba(59,130,246,.12)';this.style.borderColor='#3b82f6'" onmouseout="this.style.boxShadow='none';this.style.borderColor='#e2e8f0'">
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      </div>
      <h3 style="font-size:16px;font-weight:600;color:#1e293b;margin:0 0 6px">Email</h3>
      <a href="mailto:contacto@imporlan.cl" style="color:#3b82f6;font-size:14px;text-decoration:none;font-weight:500">contacto@imporlan.cl</a>
      <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Respuesta en menos de 24 hrs</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;transition:all .2s;cursor:default" onmouseover="this.style.boxShadow='0 8px 25px rgba(59,130,246,.12)';this.style.borderColor='#3b82f6'" onmouseout="this.style.boxShadow='none';this.style.borderColor='#e2e8f0'">
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#10b981,#34d399);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </div>
      <h3 style="font-size:16px;font-weight:600;color:#1e293b;margin:0 0 6px">Telefono</h3>
      <p style="color:#334155;font-size:14px;font-weight:500;margin:0">+56 2 XXXX XXXX</p>
      <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Lun-Vie 09:00 - 18:00</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;transition:all .2s;cursor:default" onmouseover="this.style.boxShadow='0 8px 25px rgba(59,130,246,.12)';this.style.borderColor='#3b82f6'" onmouseout="this.style.boxShadow='none';this.style.borderColor='#e2e8f0'">
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <h3 style="font-size:16px;font-weight:600;color:#1e293b;margin:0 0 6px">Horario</h3>
      <p style="color:#334155;font-size:14px;font-weight:500;margin:0">Lun - Vie: 09:00 - 18:00</p>
      <p style="color:#94a3b8;font-size:12px;margin:8px 0 0">Sab - Dom: 10:00 - 14:00</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

    <div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;display:flex;align-items:center;gap:12px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h2 style="color:#fff;font-size:17px;font-weight:600;margin:0">Preguntas Frecuentes</h2>
      </div>
      <div style="padding:8px 16px" id="sp-faq-list">
        <div class="sp-faq-item" style="border-bottom:1px solid #f1f5f9">
          <button class="sp-faq-btn" onclick="this.parentElement.classList.toggle('sp-open')" style="width:100%;text-align:left;background:none;border:none;padding:16px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;color:#334155">
            <span>Cuanto demora una importacion?</span>
            <svg class="sp-faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sp-faq-answer" style="max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 8px">
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;padding:0 0 16px">El tiempo promedio de una importacion completa es de 45 a 90 dias dependiendo del origen, tipo de embarcacion y tramites aduaneros. Te mantendremos informado en cada etapa del proceso.</p>
          </div>
        </div>
        <div class="sp-faq-item" style="border-bottom:1px solid #f1f5f9">
          <button class="sp-faq-btn" onclick="this.parentElement.classList.toggle('sp-open')" style="width:100%;text-align:left;background:none;border:none;padding:16px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;color:#334155">
            <span>Que incluye el servicio puerta a puerta?</span>
            <svg class="sp-faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sp-faq-answer" style="max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 8px">
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;padding:0 0 16px">Nuestro servicio incluye: inspeccion pre-compra, compra de la embarcacion, transporte maritimo, seguros, tramites aduaneros, internacion y entrega en el destino que indiques.</p>
          </div>
        </div>
        <div class="sp-faq-item" style="border-bottom:1px solid #f1f5f9">
          <button class="sp-faq-btn" onclick="this.parentElement.classList.toggle('sp-open')" style="width:100%;text-align:left;background:none;border:none;padding:16px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;color:#334155">
            <span>Como funciona la inspeccion pre-compra?</span>
            <svg class="sp-faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sp-faq-answer" style="max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 8px">
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;padding:0 0 16px">Coordinamos con inspectores certificados en el pais de origen. Revisan el estado mecanico, estructural y estetico de la embarcacion, entregandote un informe detallado con fotos y video antes de concretar la compra.</p>
          </div>
        </div>
        <div class="sp-faq-item" style="border-bottom:1px solid #f1f5f9">
          <button class="sp-faq-btn" onclick="this.parentElement.classList.toggle('sp-open')" style="width:100%;text-align:left;background:none;border:none;padding:16px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;color:#334155">
            <span>Que documentos necesito para importar?</span>
            <svg class="sp-faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sp-faq-answer" style="max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 8px">
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;padding:0 0 16px">Necesitas: cedula de identidad vigente, titulo de la embarcacion (Bill of Sale), factura comercial y documentos de exportacion del pais de origen. Nosotros nos encargamos de toda la tramitacion.</p>
          </div>
        </div>
        <div class="sp-faq-item">
          <button class="sp-faq-btn" onclick="this.parentElement.classList.toggle('sp-open')" style="width:100%;text-align:left;background:none;border:none;padding:16px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;color:#334155">
            <span>Puedo hacer seguimiento de mi importacion?</span>
            <svg class="sp-faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sp-faq-answer" style="max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 8px">
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;padding:0 0 16px">Si, desde tu WebPanel puedes ver el estado en tiempo real de tu importacion, incluyendo ubicacion del envio, documentos asociados y proximos pasos. Tambien recibiras notificaciones automaticas en cada cambio de estado.</p>
          </div>
        </div>
      </div>
    </div>

    <div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;display:flex;align-items:center;gap:12px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <h2 style="color:#fff;font-size:17px;font-weight:600;margin:0">Enviar Consulta</h2>
      </div>
      <form id="sp-support-form" style="padding:24px" onsubmit="return false">
        <div id="sp-form-alert" style="display:none;padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:13px;font-weight:500"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:6px">Nombre *</label>
            <input id="sp-name" type="text" value="${userName}" placeholder="Tu nombre completo" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s;box-sizing:border-box" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:6px">Email *</label>
            <input id="sp-email" type="email" value="${userEmail}" placeholder="tu@email.com" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s;box-sizing:border-box" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:6px">Asunto *</label>
            <select id="sp-subject" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;background:#fff;transition:border-color .2s;box-sizing:border-box;cursor:pointer" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
              <option value="">Selecciona un asunto</option>
              <option value="Consulta general">Consulta general</option>
              <option value="Estado de importacion">Estado de importacion</option>
              <option value="Cotizacion">Cotizacion</option>
              <option value="Documentos">Documentos</option>
              <option value="Pagos y facturacion">Pagos y facturacion</option>
              <option value="Problema tecnico">Problema tecnico</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:6px">Operacion <span style="color:#94a3b8;font-weight:400">(opcional)</span></label>
            <input id="sp-operation" type="text" placeholder="Ej: IMP-2026-001" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s;box-sizing:border-box" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
          </div>
        </div>

        <div style="margin-bottom:20px">
          <label style="display:block;font-size:13px;font-weight:500;color:#475569;margin-bottom:6px">Mensaje *</label>
          <textarea id="sp-message" rows="5" maxlength="2000" placeholder="Describe tu consulta con el mayor detalle posible..." style="width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#1e293b;outline:none;resize:vertical;font-family:inherit;transition:border-color .2s;box-sizing:border-box;min-height:100px" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" oninput="document.getElementById('sp-char-count').textContent=this.value.length+' / 2000'"></textarea>
          <p id="sp-char-count" style="text-align:right;font-size:11px;color:#94a3b8;margin:4px 0 0">0 / 2000</p>
        </div>

        <button id="sp-submit-btn" type="button" style="width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(59,130,246,.35)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Enviar Consulta
        </button>
      </form>
    </div>

  </div>

</div>

<style>
@keyframes spFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.sp-faq-item .sp-faq-arrow{transition:transform .3s ease}
.sp-faq-item.sp-open .sp-faq-arrow{transform:rotate(180deg)}
.sp-faq-item.sp-open .sp-faq-answer{max-height:200px!important;padding-bottom:0}
.sp-faq-btn:hover{background:rgba(59,130,246,.04)!important;border-radius:8px}
#sp-submit-btn:active{transform:scale(.98)!important}
@media(max-width:768px){
  .sp-enhanced>div:nth-child(2){grid-template-columns:1fr!important}
  .sp-enhanced>div:nth-child(3){grid-template-columns:1fr!important}
  #sp-support-form>div:first-of-type,#sp-support-form>div:nth-of-type(2){grid-template-columns:1fr!important}
}
</style>`;
  }

  function showAlert(type, msg) {
    var el = document.getElementById("sp-form-alert");
    if (!el) return;
    el.style.display = "block";
    if (type === "success") {
      el.style.background = "#f0fdf4";
      el.style.color = "#166534";
      el.style.border = "1px solid #bbf7d0";
    } else if (type === "error") {
      el.style.background = "#fef2f2";
      el.style.color = "#991b1b";
      el.style.border = "1px solid #fecaca";
    }
    el.innerHTML = msg;
  }

  function resetForm() {
    var user = getUserData();
    var nameEl = document.getElementById("sp-name");
    var emailEl = document.getElementById("sp-email");
    if (nameEl) nameEl.value = user ? user.name || "" : "";
    if (emailEl) emailEl.value = user ? user.email || "" : "";
    var subj = document.getElementById("sp-subject");
    if (subj) subj.value = "";
    var op = document.getElementById("sp-operation");
    if (op) op.value = "";
    var msgEl = document.getElementById("sp-message");
    if (msgEl) msgEl.value = "";
    var cc = document.getElementById("sp-char-count");
    if (cc) cc.textContent = "0 / 2000";
  }

  function handleSubmit() {
    if (isSubmitting) return;

    var name = (document.getElementById("sp-name").value || "").trim();
    var email = (document.getElementById("sp-email").value || "").trim();
    var subject = (document.getElementById("sp-subject").value || "").trim();
    var operation = (
      document.getElementById("sp-operation").value || ""
    ).trim();
    var message = (document.getElementById("sp-message").value || "").trim();

    if (!name || !email || !subject || !message) {
      showAlert("error", "Por favor completa todos los campos obligatorios.");
      return;
    }
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert("error", "Por favor ingresa un email valido.");
      return;
    }

    isSubmitting = true;
    var btn = document.getElementById("sp-submit-btn");
    btn.disabled = true;
    btn.innerHTML =
      '<svg style="animation:spin 1s linear infinite" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Enviando...';
    btn.style.opacity = "0.7";

    var fullSubject = subject;
    if (operation) fullSubject += " - Op: " + operation;

    var payload = JSON.stringify({
      name: name,
      email: email,
      subject: fullSubject,
      message: message,
    });

    fetch(API_BASE + "/support_api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        isSubmitting = false;
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Consulta';

        if (data.success) {
          showAlert(
            "success",
            '<div style="display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Tu consulta fue enviada exitosamente. Recibiras una confirmacion en tu email.</div>'
          );
          setTimeout(resetForm, 2000);
        } else {
          showAlert(
            "error",
            data.message || "Error al enviar la consulta. Intenta nuevamente."
          );
        }
      })
      .catch(function () {
        isSubmitting = false;
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Consulta';
        showAlert(
          "error",
          "Error de conexion. Verifica tu internet e intenta nuevamente."
        );
      });
  }

  function enhanceSoportePage() {
    if (!isSoportePage()) return;

    var main = document.querySelector("main");
    if (!main) return;
    var container = main.querySelector(".animate-fade-in") || main.querySelector(".space-y-6");
    if (!container) return;

    if (container.querySelector(".sp-enhanced")) return;

    var user = getUserData();
    container.innerHTML = buildPageHTML(user);

    var style = document.createElement("style");
    style.textContent =
      "@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";
    container.appendChild(style);

    var submitBtn = document.getElementById("sp-submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", handleSubmit);
    }

    lastEnhancedContent = container;
  }

  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else {
      cb();
    }
  }

  onReady(function () {
    setTimeout(enhanceSoportePage, 500);
    setTimeout(enhanceSoportePage, 1500);
    setTimeout(enhanceSoportePage, 3000);

    var observer = new MutationObserver(function () {
      setTimeout(enhanceSoportePage, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
