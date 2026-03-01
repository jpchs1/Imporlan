/**
 * Inspection Pre-Purchase Form - Imporlan
 * Multi-step form with Chile/USA country selection
 * @version 1.0
 */
(function() {
    'use strict';

    // API endpoint - detect environment
    const isTest = window.location.pathname.includes('/test/');
    const API_URL = isTest ? '/test/api/inspection_api.php' : '/api/inspection_api.php';
    const WHATSAPP_LINK = 'https://wa.me/56940211459';

    let currentStep = 1;
    let selectedCountry = null;

    // ===== Initialize =====
    document.addEventListener('DOMContentLoaded', function() {
        const contentArea = document.getElementById('formContent');
        if (!contentArea) return;

        // Ensure stepper starts at step 1 and country buttons work
        updateStepper();
        initCountryButtons();
    });

    // ===== Country Selection =====
    function initCountryButtons() {
        document.querySelectorAll('.country-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                selectedCountry = this.dataset.country;

                // Update UI
                document.querySelectorAll('.country-btn').forEach(function(b) { b.classList.remove('selected'); });
                this.classList.add('selected');

                // Show step 2
                setTimeout(function() {
                    goToStep(2);
                }, 300);
            });
        });
    }

    // ===== Broker toggle (USA) =====
    function initBrokerToggle() {
        // Will be initialized when form renders
    }

    function setupBrokerToggle() {
        var brokerRadios = document.querySelectorAll('input[name="has_broker"]');
        var brokerFields = document.getElementById('brokerFields');
        if (!brokerRadios.length || !brokerFields) return;

        brokerRadios.forEach(function(radio) {
            radio.addEventListener('change', function() {
                if (this.value === 'si') {
                    brokerFields.classList.add('visible');
                } else {
                    brokerFields.classList.remove('visible');
                }
            });
        });
    }

    // ===== Step Navigation =====
    function goToStep(step) {
        currentStep = step;
        updateStepper();
        renderCurrentStep();
        // Scroll to form
        var section = document.querySelector('.inspection-form-section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function updateStepper() {
        for (var i = 1; i <= 3; i++) {
            var stepEl = document.querySelector('.stepper-step[data-step="' + i + '"]');
            var connector = document.querySelector('.stepper-connector[data-after="' + i + '"]');

            if (!stepEl) continue;

            stepEl.classList.remove('active', 'completed');
            if (i < currentStep) {
                stepEl.classList.add('completed');
            } else if (i === currentStep) {
                stepEl.classList.add('active');
            }

            if (connector) {
                connector.classList.toggle('active', i < currentStep);
            }
        }
    }

    // ===== Render Steps =====
    function renderCurrentStep() {
        var contentArea = document.getElementById('formContent');
        if (!contentArea) return;

        if (currentStep === 1) {
            renderStep1(contentArea);
        } else if (currentStep === 2) {
            renderStep2(contentArea);
        }
    }

    function renderStep1(container) {
        container.innerHTML = '\
            <div class="country-selector">\
                <button type="button" class="country-btn" data-country="chile">\
                    <span class="country-flag">\ud83c\udde8\ud83c\uddf1</span>\
                    <div>\
                        <div class="country-label">Inspecci\u00f3n en Chile</div>\
                        <div class="country-sublabel">Embarcaciones en territorio nacional</div>\
                    </div>\
                </button>\
                <button type="button" class="country-btn" data-country="usa">\
                    <span class="country-flag">\ud83c\uddfa\ud83c\uddf8</span>\
                    <div>\
                        <div class="country-label">Inspecci\u00f3n en USA</div>\
                        <div class="country-sublabel">Embarcaciones en Estados Unidos</div>\
                    </div>\
                </button>\
            </div>';

        selectedCountry = null;
        initCountryButtons();
    }

    function renderStep2(container) {
        var locationFields = selectedCountry === 'usa' ? getUSALocationFields() : getChileLocationFields();
        var countrySpecificFields = selectedCountry === 'usa' ? getUSASpecificFields() : getChileSpecificFields();

        container.innerHTML = '\
            <form id="inspectionForm" novalidate>\
                <div class="form-error-banner" id="errorBanner">\
                    <p>Por favor corrige los siguientes errores:</p>\
                    <ul id="errorList"></ul>\
                </div>\
                \
                <div class="hp-field">\
                    <label for="website_url">Website</label>\
                    <input type="text" id="website_url" name="website_url" tabindex="-1" autocomplete="off">\
                </div>\
                \
                ' + getSectionA() + '\
                ' + getSectionB() + '\
                ' + getSectionC() + '\
                ' + getSectionD() + '\
                ' + locationFields + '\
                ' + countrySpecificFields + '\
                \
                <div class="form-actions">\
                    <button type="button" class="btn-back" onclick="window.inspectionForm.goBack()">\
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>\
                        Volver\
                    </button>\
                    <button type="submit" class="btn-submit" id="submitBtn">\
                        <span class="btn-text">Solicitar Cotizaci\u00f3n</span>\
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>\
                        <div class="spinner"></div>\
                    </button>\
                </div>\
                <p class="privacy-text">Al enviar aceptas ser contactado por Imporlan para darte seguimiento a tu solicitud.</p>\
            </form>';

        setupBrokerToggle();
        initFormSubmit();
    }

    // ===== Section Generators =====
    function getSectionA() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>\
                <h3>Datos del Cliente</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Nombre completo <span class="required">*</span></label>\
                    <input type="text" name="full_name" required placeholder="Ej: Juan P\u00e9rez">\
                    <span class="field-error">Este campo es obligatorio</span>\
                </div>\
                <div class="form-group">\
                    <label>Email <span class="required">*</span></label>\
                    <input type="email" name="email" required placeholder="tu@email.com">\
                    <span class="field-error">Ingresa un email v\u00e1lido</span>\
                </div>\
                <div class="form-group">\
                    <label>WhatsApp / Tel\u00e9fono <span class="required">*</span></label>\
                    <input type="tel" name="phone" required placeholder="+56 9 1234 5678">\
                    <span class="field-error">Este campo es obligatorio</span>\
                </div>\
                <div class="form-group">\
                    <label>Pa\u00eds/ciudad de residencia</label>\
                    <input type="text" name="city_residence" placeholder="Ej: Santiago, Chile">\
                </div>\
                <div class="form-group">\
                    <label>\u00bfC\u00f3mo nos conociste?</label>\
                    <select name="how_found">\
                        <option value="">Seleccionar...</option>\
                        <option value="Google">Google</option>\
                        <option value="Instagram">Instagram</option>\
                        <option value="Recomendaci\u00f3n">Recomendaci\u00f3n</option>\
                        <option value="Broker">Broker</option>\
                        <option value="Otro">Otro</option>\
                    </select>\
                </div>\
                <div class="form-group full-width">\
                    <label>Comentarios adicionales</label>\
                    <textarea name="comments" placeholder="Cu\u00e9ntanos m\u00e1s sobre lo que necesitas..."></textarea>\
                </div>\
            </div>\
        </div>';
    }

    function getSectionB() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg>\
                <h3>Datos de la Embarcaci\u00f3n</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Tipo de embarcaci\u00f3n <span class="required">*</span></label>\
                    <select name="vessel_type" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="Lancha">Lancha</option>\
                        <option value="Yate">Yate</option>\
                        <option value="Velero">Velero</option>\
                        <option value="Catamaran">Catamar\u00e1n</option>\
                        <option value="Jet ski">Jet ski</option>\
                        <option value="Otro">Otro</option>\
                    </select>\
                    <span class="field-error">Selecciona un tipo</span>\
                </div>\
                <div class="form-group">\
                    <label>Marca <span class="required">*</span></label>\
                    <input type="text" name="brand" required placeholder="Ej: Boston Whaler">\
                    <span class="field-error">La marca es obligatoria</span>\
                </div>\
                <div class="form-group">\
                    <label>Modelo <span class="required">*</span></label>\
                    <input type="text" name="model" required placeholder="Ej: Outrage 280">\
                    <span class="field-error">El modelo es obligatorio</span>\
                </div>\
                <div class="form-group">\
                    <label>A\u00f1o <span class="required">*</span></label>\
                    <input type="number" name="vessel_year" required min="1900" max="2028" placeholder="Ej: 2022">\
                    <span class="field-error">Ingresa un a\u00f1o v\u00e1lido</span>\
                </div>\
                <div class="form-group">\
                    <label>Eslora <span class="required">*</span></label>\
                    <div class="inline-group">\
                        <input type="number" name="length_value" required min="1" step="0.1" placeholder="Ej: 28">\
                        <select name="length_unit">\
                            <option value="pies">Pies</option>\
                            <option value="metros">Metros</option>\
                        </select>\
                    </div>\
                    <span class="field-error">La eslora es obligatoria</span>\
                </div>\
                <div class="form-group">\
                    <label>Material del casco <span class="required">*</span></label>\
                    <select name="hull_material" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="Fibra">Fibra</option>\
                        <option value="Aluminio">Aluminio</option>\
                        <option value="Acero">Acero</option>\
                        <option value="Otro">Otro</option>\
                    </select>\
                    <span class="field-error">Selecciona el material</span>\
                </div>\
                <div class="form-group">\
                    <label>Precio publicado</label>\
                    <div class="inline-group">\
                        <input type="number" name="published_price" min="0" placeholder="Ej: 85000">\
                        <select name="price_currency">\
                            <option value="USD">USD</option>\
                            <option value="CLP">CLP</option>\
                            <option value="EUR">EUR</option>\
                        </select>\
                    </div>\
                </div>\
                <div class="form-group">\
                    <label>Link del aviso</label>\
                    <input type="url" name="listing_url" placeholder="https://...">\
                </div>\
            </div>\
        </div>';
    }

    function getSectionC() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>\
                <h3>Motores y Sistemas</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>N\u00famero de motores <span class="required">*</span></label>\
                    <select name="num_engines" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="1">1</option>\
                        <option value="2">2</option>\
                        <option value="3">3</option>\
                        <option value="4+">4+</option>\
                    </select>\
                    <span class="field-error">Selecciona el n\u00famero de motores</span>\
                </div>\
                <div class="form-group">\
                    <label>Marca/modelo del motor</label>\
                    <input type="text" name="engine_brand_model" placeholder="Ej: Mercury 300hp Verado">\
                </div>\
                <div class="form-group">\
                    <label>Horas de motor</label>\
                    <input type="number" name="engine_hours" min="0" placeholder="Ej: 350">\
                </div>\
                <div class="form-group">\
                    <label>\u00bfCuenta con generador?</label>\
                    <select name="has_generator">\
                        <option value="">Seleccionar...</option>\
                        <option value="si">S\u00ed</option>\
                        <option value="no">No</option>\
                    </select>\
                </div>\
                <div class="form-group full-width">\
                    <label>Electr\u00f3nica relevante</label>\
                    <input type="text" name="electronics" placeholder="Ej: GPS Garmin, Radar, Sonar...">\
                </div>\
            </div>\
        </div>';
    }

    function getSectionD() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>\
                <h3>Tipo de Inspecci\u00f3n</h3>\
            </div>\
            <div class="checkbox-grid">\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Inspecci\u00f3n b\u00e1sica visual">\
                    <span>Inspecci\u00f3n b\u00e1sica visual</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Inspecci\u00f3n completa / Survey">\
                    <span>Inspecci\u00f3n completa / Survey</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Prueba de navegaci\u00f3n (Sea Trial)">\
                    <span>Prueba de navegaci\u00f3n (Sea Trial)</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Inspecci\u00f3n de motores">\
                    <span>Inspecci\u00f3n de motores</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Diagn\u00f3stico electr\u00f3nico">\
                    <span>Diagn\u00f3stico electr\u00f3nico</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Revisi\u00f3n estructural del casco">\
                    <span>Revisi\u00f3n estructural del casco</span>\
                </label>\
                <label class="checkbox-item">\
                    <input type="checkbox" name="inspection_types" value="Revisi\u00f3n de documentaci\u00f3n">\
                    <span>Revisi\u00f3n de documentaci\u00f3n</span>\
                </label>\
            </div>\
            <div class="toggle-item">\
                <label class="toggle-switch">\
                    <input type="checkbox" name="wants_recommendation">\
                    <span class="toggle-slider"></span>\
                </label>\
                <span class="toggle-text">Quiero recomendaci\u00f3n del tipo de inspecci\u00f3n</span>\
            </div>\
        </div>';
    }

    // ===== Country-Specific: USA =====
    function getUSALocationFields() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>\
                <h3>Ubicaci\u00f3n en USA</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Estado <span class="required">*</span></label>\
                    <input type="text" name="state_usa" required placeholder="Ej: Florida">\
                    <span class="field-error">El estado es obligatorio</span>\
                </div>\
                <div class="form-group">\
                    <label>Ciudad <span class="required">*</span></label>\
                    <input type="text" name="city" required placeholder="Ej: Miami">\
                    <span class="field-error">La ciudad es obligatoria</span>\
                </div>\
                <div class="form-group">\
                    <label>Marina / ubicaci\u00f3n</label>\
                    <input type="text" name="marina" placeholder="Ej: Miami Beach Marina">\
                </div>\
                <div class="form-group">\
                    <label>\u00bfEst\u00e1 en agua o en seco? <span class="required">*</span></label>\
                    <select name="water_status" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="En agua">En agua</option>\
                        <option value="En seco">En seco</option>\
                    </select>\
                    <span class="field-error">Este campo es obligatorio</span>\
                </div>\
            </div>\
        </div>';
    }

    function getUSASpecificFields() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>\
                <h3>Objetivo e Importaci\u00f3n</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Objetivo de compra</label>\
                    <select name="purchase_objective">\
                        <option value="">Seleccionar...</option>\
                        <option value="Uso personal">Uso personal</option>\
                        <option value="Charter">Charter</option>\
                        <option value="Reventa">Reventa</option>\
                        <option value="Inversi\u00f3n">Inversi\u00f3n</option>\
                    </select>\
                </div>\
                <div class="form-group">\
                    <label>\u00bfPlaneas importar a Chile? <span class="required">*</span></label>\
                    <div class="radio-group">\
                        <label class="radio-item">\
                            <input type="radio" name="import_to_chile" value="S\u00ed" required>\
                            <span>S\u00ed</span>\
                        </label>\
                        <label class="radio-item">\
                            <input type="radio" name="import_to_chile" value="No">\
                            <span>No</span>\
                        </label>\
                        <label class="radio-item">\
                            <input type="radio" name="import_to_chile" value="A\u00fan no lo s\u00e9">\
                            <span>A\u00fan no lo s\u00e9</span>\
                        </label>\
                    </div>\
                    <span class="field-error">Selecciona una opci\u00f3n</span>\
                </div>\
            </div>\
        </div>\
        \
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>\
                <h3>Plazos</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>\u00bfCu\u00e1ndo deseas la inspecci\u00f3n? <span class="required">*</span></label>\
                    <select name="inspection_timeline" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="Urgente (<7 d\u00edas)">Urgente (&lt;7 d\u00edas)</option>\
                        <option value="2 semanas">2 semanas</option>\
                        <option value="1 mes">1 mes</option>\
                        <option value="Flexible">Flexible</option>\
                    </select>\
                    <span class="field-error">Selecciona el plazo</span>\
                </div>\
            </div>\
        </div>\
        \
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>\
                <h3>Broker</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group full-width">\
                    <label>\u00bfEst\u00e1s trabajando con un broker?</label>\
                    <div class="radio-group">\
                        <label class="radio-item">\
                            <input type="radio" name="has_broker" value="si">\
                            <span>S\u00ed</span>\
                        </label>\
                        <label class="radio-item">\
                            <input type="radio" name="has_broker" value="no">\
                            <span>No</span>\
                        </label>\
                    </div>\
                </div>\
            </div>\
            <div class="conditional-fields" id="brokerFields">\
                <div class="form-grid" style="margin-top: 14px;">\
                    <div class="form-group">\
                        <label>Nombre del broker</label>\
                        <input type="text" name="broker_name" placeholder="Nombre completo">\
                    </div>\
                    <div class="form-group">\
                        <label>Email/WhatsApp del broker</label>\
                        <input type="text" name="broker_contact" placeholder="Email o tel\u00e9fono">\
                    </div>\
                </div>\
            </div>\
        </div>';
    }

    // ===== Country-Specific: Chile =====
    function getChileLocationFields() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>\
                <h3>Ubicaci\u00f3n en Chile</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Regi\u00f3n <span class="required">*</span></label>\
                    <select name="region_chile" required>\
                        <option value="">Seleccionar regi\u00f3n...</option>\
                        <option value="Arica y Parinacota">Arica y Parinacota</option>\
                        <option value="Tarapac\u00e1">Tarapac\u00e1</option>\
                        <option value="Antofagasta">Antofagasta</option>\
                        <option value="Atacama">Atacama</option>\
                        <option value="Coquimbo">Coquimbo</option>\
                        <option value="Valpara\u00edso">Valpara\u00edso</option>\
                        <option value="Metropolitana">Metropolitana</option>\
                        <option value="O\'Higgins">O\'Higgins</option>\
                        <option value="Maule">Maule</option>\
                        <option value="Biob\u00edo">Biob\u00edo</option>\
                        <option value="\u00d1uble">\u00d1uble</option>\
                        <option value="Araucan\u00eda">Araucan\u00eda</option>\
                        <option value="Los R\u00edos">Los R\u00edos</option>\
                        <option value="Los Lagos">Los Lagos</option>\
                        <option value="Ays\u00e9n">Ays\u00e9n</option>\
                        <option value="Magallanes">Magallanes</option>\
                    </select>\
                    <span class="field-error">La regi\u00f3n es obligatoria</span>\
                </div>\
                <div class="form-group">\
                    <label>Ciudad <span class="required">*</span></label>\
                    <input type="text" name="city" required placeholder="Ej: Algarrobo">\
                    <span class="field-error">La ciudad es obligatoria</span>\
                </div>\
                <div class="form-group">\
                    <label>Marina / Club / ubicaci\u00f3n</label>\
                    <input type="text" name="marina" placeholder="Ej: Club de Yates Algarrobo">\
                </div>\
                <div class="form-group">\
                    <label>Lago o mar</label>\
                    <select name="lake_or_sea">\
                        <option value="">Seleccionar...</option>\
                        <option value="Mar">Mar</option>\
                        <option value="Lago">Lago</option>\
                        <option value="R\u00edo">R\u00edo</option>\
                        <option value="Otro">Otro</option>\
                    </select>\
                </div>\
                <div class="form-group">\
                    <label>\u00bfEst\u00e1 en agua o en seco? <span class="required">*</span></label>\
                    <select name="water_status" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="En agua">En agua</option>\
                        <option value="En seco">En seco</option>\
                    </select>\
                    <span class="field-error">Este campo es obligatorio</span>\
                </div>\
            </div>\
        </div>';
    }

    function getChileSpecificFields() {
        return '\
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>\
                <h3>Tipo de Motor</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Tipo de motor</label>\
                    <select name="engine_type_chile">\
                        <option value="">Seleccionar...</option>\
                        <option value="Fuera de borda">Fuera de borda</option>\
                        <option value="Dentro de borda">Dentro de borda</option>\
                        <option value="Stern drive">Stern drive</option>\
                        <option value="Otro">Otro</option>\
                    </select>\
                </div>\
            </div>\
        </div>\
        \
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>\
                <h3>Objetivo</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>Objetivo de compra</label>\
                    <select name="purchase_objective">\
                        <option value="">Seleccionar...</option>\
                        <option value="Uso personal">Uso personal</option>\
                        <option value="Charter">Charter</option>\
                        <option value="Reventa">Reventa</option>\
                        <option value="Inversi\u00f3n">Inversi\u00f3n</option>\
                    </select>\
                </div>\
            </div>\
        </div>\
        \
        <div class="form-section">\
            <div class="form-section-title">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>\
                <h3>Plazos</h3>\
            </div>\
            <div class="form-grid">\
                <div class="form-group">\
                    <label>\u00bfCu\u00e1ndo deseas la inspecci\u00f3n? <span class="required">*</span></label>\
                    <select name="inspection_timeline" required>\
                        <option value="">Seleccionar...</option>\
                        <option value="Urgente (<7 d\u00edas)">Urgente (&lt;7 d\u00edas)</option>\
                        <option value="2 semanas">2 semanas</option>\
                        <option value="1 mes">1 mes</option>\
                        <option value="Flexible">Flexible</option>\
                    </select>\
                    <span class="field-error">Selecciona el plazo</span>\
                </div>\
            </div>\
        </div>';
    }

    // ===== Form Submission =====
    function initFormSubmit() {
        var form = document.getElementById('inspectionForm');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSubmit(form);
        });
    }

    function handleSubmit(form) {
        // Clear previous errors
        clearErrors();

        // Validate
        var errors = validateForm(form);
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }

        // Collect data
        var formData = collectFormData(form);

        // Show loading
        var submitBtn = document.getElementById('submitBtn');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Send request
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;

            if (data.success) {
                goToStep(3);
                showSuccess(formData);
            } else {
                if (data.errors) {
                    showErrors(data.errors);
                } else {
                    showErrors([data.error || 'Error al enviar. Intenta de nuevo.']);
                }
            }
        })
        .catch(function(err) {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            showErrors(['Error de conexi\u00f3n. Verifica tu internet e intenta de nuevo.']);
            console.error('Inspection form error:', err);
        });
    }

    // ===== Validation =====
    function validateForm(form) {
        var errors = [];
        var requiredFields = form.querySelectorAll('[required]');

        requiredFields.forEach(function(field) {
            var group = field.closest('.form-group');

            if (field.type === 'radio') {
                // Check if any radio in the group is checked
                var name = field.name;
                var checked = form.querySelector('input[name="' + name + '"]:checked');
                if (!checked) {
                    if (group) group.classList.add('has-error');
                    var label = group ? group.querySelector('label') : null;
                    var fieldName = label ? label.textContent.replace('*', '').trim() : name;
                    errors.push(fieldName + ' es obligatorio');
                }
                return;
            }

            if (!field.value || !field.value.trim()) {
                if (group) group.classList.add('has-error');
                var label = group ? group.querySelector('label') : null;
                var fieldName = label ? label.textContent.replace('*', '').trim() : field.name;
                errors.push(fieldName + ' es obligatorio');
            }
        });

        // Email validation
        var emailField = form.querySelector('[name="email"]');
        if (emailField && emailField.value) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailField.value)) {
                var group = emailField.closest('.form-group');
                if (group) group.classList.add('has-error');
                errors.push('Ingresa un email v\u00e1lido');
            }
        }

        // URL validation
        var urlField = form.querySelector('[name="listing_url"]');
        if (urlField && urlField.value && urlField.value.trim()) {
            try {
                new URL(urlField.value);
            } catch (e) {
                errors.push('El link del aviso no es una URL v\u00e1lida');
            }
        }

        return errors;
    }

    function clearErrors() {
        document.querySelectorAll('.form-group.has-error').forEach(function(g) {
            g.classList.remove('has-error');
        });
        var banner = document.getElementById('errorBanner');
        if (banner) banner.classList.remove('visible');
    }

    function showErrors(errors) {
        var banner = document.getElementById('errorBanner');
        var list = document.getElementById('errorList');
        if (!banner || !list) return;

        list.innerHTML = '';
        errors.forEach(function(err) {
            var li = document.createElement('li');
            li.textContent = err;
            list.appendChild(li);
        });
        banner.classList.add('visible');

        // Scroll to error
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ===== Data Collection =====
    function collectFormData(form) {
        var data = {
            country: selectedCountry,
            website_url: form.querySelector('[name="website_url"]') ? form.querySelector('[name="website_url"]').value : ''
        };

        // Text/select/textarea fields
        var fields = ['full_name', 'email', 'phone', 'city_residence', 'how_found', 'comments',
            'vessel_type', 'brand', 'model', 'vessel_year', 'length_value', 'length_unit',
            'hull_material', 'published_price', 'price_currency', 'listing_url',
            'num_engines', 'engine_brand_model', 'engine_hours', 'has_generator', 'electronics',
            'state_usa', 'city', 'marina', 'water_status', 'region_chile', 'lake_or_sea',
            'engine_type_chile', 'purchase_objective', 'inspection_timeline',
            'broker_name', 'broker_contact'];

        fields.forEach(function(name) {
            var field = form.querySelector('[name="' + name + '"]');
            if (field) {
                data[name] = field.value ? field.value.trim() : '';
            }
        });

        // Radio fields
        ['import_to_chile', 'has_broker'].forEach(function(name) {
            var checked = form.querySelector('input[name="' + name + '"]:checked');
            data[name] = checked ? checked.value : '';
        });

        // Checkboxes - inspection types
        var inspectionChecks = form.querySelectorAll('input[name="inspection_types"]:checked');
        data.inspection_types = [];
        inspectionChecks.forEach(function(cb) {
            data.inspection_types.push(cb.value);
        });

        // Toggle
        var recToggle = form.querySelector('[name="wants_recommendation"]');
        data.wants_recommendation = recToggle ? recToggle.checked : false;

        return data;
    }

    // ===== Success Screen =====
    function showSuccess(formData) {
        var contentArea = document.getElementById('formContent');
        if (!contentArea) return;

        var countryLabel = formData.country === 'usa' ? 'Estados Unidos' : 'Chile';
        var location = formData.country === 'usa'
            ? (formData.city || '') + ', ' + (formData.state_usa || '')
            : (formData.city || '') + ', ' + (formData.region_chile || '');
        var inspectionList = (formData.inspection_types || []).join(', ') || 'No seleccionado';
        var importLine = '';
        if (formData.country === 'usa') {
            importLine = '<div class="summary-row"><span class="summary-label">Importar a Chile</span><span class="summary-value">' + escapeHtml(formData.import_to_chile || 'No indicado') + '</span></div>';
        }

        contentArea.innerHTML = '\
            <div class="success-screen">\
                <div class="success-icon">\
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>\
                </div>\
                <h2>\u00a1Solicitud Enviada!</h2>\
                <p>Tu solicitud de inspecci\u00f3n pre-compra ha sido recibida. Te contactaremos pronto.</p>\
                \
                <div class="success-summary">\
                    <h3>Resumen de tu solicitud</h3>\
                    <div class="summary-row"><span class="summary-label">Pa\u00eds</span><span class="summary-value">' + escapeHtml(countryLabel) + '</span></div>\
                    <div class="summary-row"><span class="summary-label">Embarcaci\u00f3n</span><span class="summary-value">' + escapeHtml((formData.vessel_type || '') + ' ' + (formData.brand || '') + ' ' + (formData.model || '') + ' (' + (formData.vessel_year || '') + ')') + '</span></div>\
                    <div class="summary-row"><span class="summary-label">Eslora</span><span class="summary-value">' + escapeHtml((formData.length_value || '') + ' ' + (formData.length_unit || '')) + '</span></div>\
                    <div class="summary-row"><span class="summary-label">Ubicaci\u00f3n</span><span class="summary-value">' + escapeHtml(location) + '</span></div>\
                    <div class="summary-row"><span class="summary-label">Inspecci\u00f3n</span><span class="summary-value">' + escapeHtml(inspectionList) + '</span></div>\
                    <div class="summary-row"><span class="summary-label">Plazo</span><span class="summary-value">' + escapeHtml(formData.inspection_timeline || '') + '</span></div>\
                    ' + importLine + '\
                </div>\
                \
                <div class="success-cta">\
                    <a href="' + WHATSAPP_LINK + '?text=Hola,%20acabo%20de%20enviar%20una%20solicitud%20de%20inspecci%C3%B3n%20pre-compra" class="btn btn-whatsapp" target="_blank" rel="noopener">\
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>\
                        Contactar por WhatsApp\
                    </a>\
                    <a href="/" class="btn btn-primary">Volver al Inicio</a>\
                </div>\
            </div>';
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // ===== Public API (for back button) =====
    window.inspectionForm = {
        goBack: function() {
            goToStep(1);
        }
    };

})();
