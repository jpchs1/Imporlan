/**
 * Support Form Module - Imporlan Panel
 * Professional support/contact form that sends to contacto@imporlan.cl
 */

(function() {
    'use strict';

    const SUPPORT_SUBJECTS = [
        'Consulta general',
        'Problema con mi cuenta',
        'Consulta sobre importacion',
        'Problema con un pago',
        'Seguimiento de pedido',
        'Problema tecnico',
        'Solicitud de cotizacion',
        'Sugerencia o comentario',
        'Otro'
    ];

    class SupportFormModule {
        constructor() {
            this.isOpen = false;
            this.isSubmitting = false;
            this.overlay = null;
            this.apiBase = this.detectApiBase();
        }

        detectApiBase() {
            const path = window.location.pathname;
            if (path.includes('/test/') || path.includes('/panel-test/')) {
                return '/test/api';
            }
            return '/api';
        }

        init() {
            this.injectStyles();
            this.createTriggerButton();
            this.createFormOverlay();
            this.interceptSupportLinks();
        }

        getUserData() {
            try {
                const raw = localStorage.getItem('imporlan_user') || localStorage.getItem('user');
                if (raw) {
                    const user = JSON.parse(raw);
                    return {
                        name: user.displayName || user.name || user.nombre || '',
                        email: user.email || ''
                    };
                }
            } catch (e) {}
            return { name: '', email: '' };
        }

        interceptSupportLinks() {
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a[href*="mailto:contacto@imporlan.cl"]');
                if (link) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.open();
                }
                const btn = e.target.closest('[data-action="support"]');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.open();
                }
            }, true);
        }

        createTriggerButton() {
            const btn = document.createElement('button');
            btn.id = 'imporlan-support-trigger';
            btn.setAttribute('aria-label', 'Contactar Soporte');
            btn.innerHTML = `
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Soporte</span>
            `;
            btn.addEventListener('click', () => this.open());
            document.body.appendChild(btn);
        }

        createFormOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'imporlan-support-overlay';
            this.overlay.innerHTML = this.getFormHTML();
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });
            document.body.appendChild(this.overlay);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });
        }

        getFormHTML() {
            const userData = this.getUserData();
            const subjectOptions = SUPPORT_SUBJECTS.map(s =>
                `<option value="${s}">${s}</option>`
            ).join('');

            return `
                <div class="sf-modal" role="dialog" aria-modal="true" aria-labelledby="sf-title">
                    <div class="sf-header">
                        <div class="sf-header-content">
                            <div class="sf-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                            </div>
                            <div>
                                <h2 id="sf-title" class="sf-title">Centro de Soporte</h2>
                                <p class="sf-subtitle">Estamos aqui para ayudarte</p>
                            </div>
                        </div>
                        <button class="sf-close-btn" aria-label="Cerrar" id="sf-close-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>

                    <form id="sf-form" class="sf-body" novalidate>
                        <div class="sf-info-banner">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="16" x2="12" y2="12"/>
                                <line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                            <span>Tu mensaje sera enviado a nuestro equipo de soporte. Responderemos en menos de 24 horas.</span>
                        </div>

                        <div class="sf-row">
                            <div class="sf-field">
                                <label for="sf-name" class="sf-label">Nombre completo <span class="sf-required">*</span></label>
                                <input type="text" id="sf-name" name="name" class="sf-input" placeholder="Tu nombre" value="${this.escapeAttr(userData.name)}" required autocomplete="name">
                            </div>
                            <div class="sf-field">
                                <label for="sf-email" class="sf-label">Email <span class="sf-required">*</span></label>
                                <input type="email" id="sf-email" name="email" class="sf-input" placeholder="tu@email.com" value="${this.escapeAttr(userData.email)}" required autocomplete="email">
                            </div>
                        </div>

                        <div class="sf-row">
                            <div class="sf-field">
                                <label for="sf-phone" class="sf-label">Telefono</label>
                                <input type="tel" id="sf-phone" name="phone" class="sf-input" placeholder="+56 9 1234 5678" autocomplete="tel">
                            </div>
                            <div class="sf-field">
                                <label for="sf-subject" class="sf-label">Asunto <span class="sf-required">*</span></label>
                                <select id="sf-subject" name="subject" class="sf-input sf-select" required>
                                    <option value="" disabled selected>Selecciona un asunto</option>
                                    ${subjectOptions}
                                </select>
                            </div>
                        </div>

                        <div class="sf-field">
                            <label for="sf-message" class="sf-label">Mensaje <span class="sf-required">*</span></label>
                            <textarea id="sf-message" name="message" class="sf-input sf-textarea" placeholder="Describe tu consulta o problema con el mayor detalle posible..." rows="5" required></textarea>
                            <div class="sf-char-count"><span id="sf-char-current">0</span> / 2000</div>
                        </div>

                        <div id="sf-error" class="sf-error" style="display:none;"></div>
                        <div id="sf-success" class="sf-success" style="display:none;"></div>

                        <div class="sf-actions">
                            <button type="button" class="sf-btn sf-btn-secondary" id="sf-cancel-btn">Cancelar</button>
                            <button type="submit" class="sf-btn sf-btn-primary" id="sf-submit-btn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"/>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                </svg>
                                <span>Enviar mensaje</span>
                            </button>
                        </div>

                        <div class="sf-footer-info">
                            <div class="sf-footer-item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                <span>Informacion segura y confidencial</span>
                            </div>
                            <div class="sf-footer-item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>Respuesta en menos de 24 horas</span>
                            </div>
                            <div class="sf-footer-item">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                <span>contacto@imporlan.cl</span>
                            </div>
                        </div>
                    </form>
                </div>
            `;
        }

        bindEvents() {
            const form = document.getElementById('sf-form');
            const closeBtn = document.getElementById('sf-close-btn');
            const cancelBtn = document.getElementById('sf-cancel-btn');
            const textarea = document.getElementById('sf-message');
            const charCount = document.getElementById('sf-char-current');

            if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

            if (textarea && charCount) {
                textarea.addEventListener('input', () => {
                    const len = textarea.value.length;
                    charCount.textContent = len;
                    if (len > 2000) {
                        textarea.value = textarea.value.substring(0, 2000);
                        charCount.textContent = '2000';
                    }
                });
            }

            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submit();
                });
            }

            const inputs = this.overlay.querySelectorAll('.sf-input');
            inputs.forEach(input => {
                input.addEventListener('focus', () => input.classList.add('sf-focused'));
                input.addEventListener('blur', () => {
                    input.classList.remove('sf-focused');
                    this.validateField(input);
                });
            });
        }

        validateField(field) {
            const wrapper = field.closest('.sf-field');
            if (!wrapper) return true;
            wrapper.classList.remove('sf-field-error');

            if (field.required && !field.value.trim()) {
                wrapper.classList.add('sf-field-error');
                return false;
            }
            if (field.type === 'email' && field.value.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(field.value.trim())) {
                    wrapper.classList.add('sf-field-error');
                    return false;
                }
            }
            return true;
        }

        open() {
            this.isOpen = true;
            this.overlay.classList.add('sf-visible');
            document.body.style.overflow = 'hidden';
            this.bindEvents();

            const userData = this.getUserData();
            const nameInput = document.getElementById('sf-name');
            const emailInput = document.getElementById('sf-email');
            if (nameInput && !nameInput.value && userData.name) nameInput.value = userData.name;
            if (emailInput && !emailInput.value && userData.email) emailInput.value = userData.email;

            document.getElementById('sf-error').style.display = 'none';
            document.getElementById('sf-success').style.display = 'none';

            setTimeout(() => {
                const modal = this.overlay.querySelector('.sf-modal');
                if (modal) modal.classList.add('sf-modal-enter');
            }, 10);
        }

        close() {
            const modal = this.overlay.querySelector('.sf-modal');
            if (modal) modal.classList.remove('sf-modal-enter');
            setTimeout(() => {
                this.isOpen = false;
                this.overlay.classList.remove('sf-visible');
                document.body.style.overflow = '';
            }, 200);
        }

        async submit() {
            if (this.isSubmitting) return;

            const form = document.getElementById('sf-form');
            const errorEl = document.getElementById('sf-error');
            const successEl = document.getElementById('sf-success');
            const submitBtn = document.getElementById('sf-submit-btn');

            errorEl.style.display = 'none';
            successEl.style.display = 'none';

            const fields = form.querySelectorAll('.sf-input[required]');
            let valid = true;
            fields.forEach(f => {
                if (!this.validateField(f)) valid = false;
            });

            if (!valid) {
                errorEl.textContent = 'Por favor completa todos los campos obligatorios correctamente.';
                errorEl.style.display = 'flex';
                return;
            }

            this.isSubmitting = true;
            submitBtn.disabled = true;
            submitBtn.classList.add('sf-loading');
            submitBtn.querySelector('span').textContent = 'Enviando...';

            const data = {
                name: document.getElementById('sf-name').value.trim(),
                email: document.getElementById('sf-email').value.trim(),
                phone: document.getElementById('sf-phone').value.trim(),
                subject: document.getElementById('sf-subject').value,
                message: document.getElementById('sf-message').value.trim()
            };

            try {
                const response = await fetch(this.apiBase + '/support_api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    successEl.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <div>
                            <strong>Mensaje enviado correctamente</strong>
                            <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Recibiras una confirmacion en tu email. Nuestro equipo te respondera a la brevedad.</p>
                        </div>
                    `;
                    successEl.style.display = 'flex';
                    form.reset();
                    document.getElementById('sf-char-current').textContent = '0';

                    setTimeout(() => this.close(), 4000);
                } else {
                    const msg = result.errors ? result.errors.join(', ') : (result.error || 'Error al enviar el mensaje');
                    errorEl.textContent = msg;
                    errorEl.style.display = 'flex';
                }
            } catch (err) {
                errorEl.textContent = 'Error de conexion. Por favor intenta nuevamente.';
                errorEl.style.display = 'flex';
            } finally {
                this.isSubmitting = false;
                submitBtn.disabled = false;
                submitBtn.classList.remove('sf-loading');
                submitBtn.querySelector('span').textContent = 'Enviar mensaje';
            }
        }

        escapeAttr(str) {
            return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        injectStyles() {
            if (document.getElementById('sf-styles')) return;
            const style = document.createElement('style');
            style.id = 'sf-styles';
            style.textContent = `
                #imporlan-support-trigger {
                    position: fixed;
                    bottom: 90px;
                    right: 24px;
                    z-index: 9998;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: #fff;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0,0,0,0.1);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    letter-spacing: 0.3px;
                }
                #imporlan-support-trigger:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0,0,0,0.15);
                }
                #imporlan-support-trigger:active { transform: translateY(0); }

                #imporlan-support-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10000;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    background: rgba(10, 22, 40, 0.7);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    padding: 20px;
                    overflow-y: auto;
                }
                #imporlan-support-overlay.sf-visible {
                    display: flex;
                }

                .sf-modal {
                    background: #fff;
                    border-radius: 20px;
                    width: 100%;
                    max-width: 640px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
                    transform: translateY(20px) scale(0.97);
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .sf-modal.sf-modal-enter {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }

                .sf-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px;
                    background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .sf-header-content {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .sf-icon-wrapper {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(59, 130, 246, 0.2);
                    border-radius: 12px;
                    color: #60a5fa;
                    flex-shrink: 0;
                }
                .sf-title {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: 0.2px;
                }
                .sf-subtitle {
                    margin: 2px 0 0;
                    font-size: 13px;
                    color: #94a3b8;
                    font-weight: 400;
                }
                .sf-close-btn {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 10px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .sf-close-btn:hover {
                    background: rgba(255,255,255,0.2);
                    color: #fff;
                }

                .sf-body {
                    padding: 24px 28px 20px;
                    overflow-y: auto;
                    flex: 1;
                }

                .sf-info-banner {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 12px 16px;
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 10px;
                    margin-bottom: 22px;
                    font-size: 13px;
                    color: #1e40af;
                    line-height: 1.5;
                }
                .sf-info-banner svg {
                    flex-shrink: 0;
                    margin-top: 2px;
                    color: #3b82f6;
                }

                .sf-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                @media (max-width: 540px) {
                    .sf-row { grid-template-columns: 1fr; gap: 12px; }
                    .sf-modal { max-width: 100%; border-radius: 16px; }
                    .sf-header { padding: 20px; }
                    .sf-body { padding: 20px; }
                    #imporlan-support-trigger span { display: none; }
                    #imporlan-support-trigger { padding: 14px; border-radius: 50%; }
                }

                .sf-field {
                    margin-bottom: 16px;
                    position: relative;
                }
                .sf-row .sf-field { margin-bottom: 0; }

                .sf-label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #374151;
                    letter-spacing: 0.2px;
                }
                .sf-required { color: #ef4444; }

                .sf-input {
                    width: 100%;
                    padding: 11px 14px;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    font-family: inherit;
                    color: #1e293b;
                    background: #f8fafc;
                    transition: all 0.2s;
                    outline: none;
                    box-sizing: border-box;
                }
                .sf-input::placeholder { color: #94a3b8; }
                .sf-input:focus, .sf-input.sf-focused {
                    border-color: #3b82f6;
                    background: #fff;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .sf-select {
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    padding-right: 36px;
                    cursor: pointer;
                }
                .sf-textarea {
                    resize: vertical;
                    min-height: 110px;
                    max-height: 220px;
                    line-height: 1.6;
                }
                .sf-char-count {
                    text-align: right;
                    font-size: 12px;
                    color: #94a3b8;
                    margin-top: 4px;
                }

                .sf-field-error .sf-input {
                    border-color: #ef4444;
                    background: #fef2f2;
                }
                .sf-field-error .sf-input:focus {
                    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
                }

                .sf-error {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 10px;
                    color: #991b1b;
                    font-size: 13px;
                    margin-bottom: 16px;
                    line-height: 1.5;
                }
                .sf-success {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px;
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 10px;
                    color: #166534;
                    font-size: 14px;
                    margin-bottom: 16px;
                    line-height: 1.5;
                }
                .sf-success svg {
                    flex-shrink: 0;
                    margin-top: 1px;
                    color: #22c55e;
                }

                .sf-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 8px;
                }
                .sf-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 11px 24px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    letter-spacing: 0.2px;
                }
                .sf-btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }
                .sf-btn-secondary:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .sf-btn-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: #fff;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }
                .sf-btn-primary:hover {
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                    transform: translateY(-1px);
                }
                .sf-btn-primary:active { transform: translateY(0); }
                .sf-btn-primary:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }
                .sf-loading {
                    position: relative;
                }
                .sf-loading::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    right: 16px;
                    width: 16px;
                    height: 16px;
                    margin-top: -8px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: sf-spin 0.6s linear infinite;
                }
                @keyframes sf-spin {
                    to { transform: rotate(360deg); }
                }

                .sf-footer-info {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    justify-content: center;
                    padding-top: 20px;
                    margin-top: 16px;
                    border-top: 1px solid #f1f5f9;
                }
                .sf-footer-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: #94a3b8;
                }
                .sf-footer-item svg { color: #60a5fa; flex-shrink: 0; }
            `;
            document.head.appendChild(style);
        }
    }

    function initSupportForm() {
        if (window.__imporlanSupportForm) return;
        window.__imporlanSupportForm = new SupportFormModule();
        window.__imporlanSupportForm.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupportForm);
    } else {
        initSupportForm();
    }
})();
