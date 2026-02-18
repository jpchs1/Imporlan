/**
 * Imporlan Production Enhancements
 * This script runs after the React app loads to add production-ready features
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  // ============================================
  // 1.2 COTIZADOR LINK PERSISTENCE
  // Save links from Home cotizador to sessionStorage
  // Restore them in Panel cotizador after login
  // ============================================
  
  const STORAGE_KEY = 'imporlan_cotizador_links';
  const STORAGE_KEY_FORM = 'imporlan_cotizador_form';
  
  function saveCotizadorLinks() {
    var linkInputs = document.querySelectorAll('input[type="url"][placeholder*="Link"], input[type="url"][placeholder*="link"]');
    if (linkInputs.length > 0) {
      var links = [];
      linkInputs.forEach(function(input) {
        if (input.value && input.value.trim()) {
          links.push(input.value.trim());
        }
      });
      if (links.length > 0) {
        var formData = { links: links };
        var nameInput = document.querySelector('input[placeholder="Tu nombre"]');
        var emailInput = document.querySelector('input[type="email"][placeholder*="email"]');
        var phoneInput = document.querySelector('input[type="tel"][placeholder*="56"]');
        var countrySelect = document.querySelector('select');
        if (nameInput && nameInput.value) formData.name = nameInput.value.trim();
        if (emailInput && emailInput.value) formData.email = emailInput.value.trim();
        if (phoneInput && phoneInput.value) formData.phone = phoneInput.value.trim();
        if (countrySelect && countrySelect.value) formData.country = countrySelect.value;
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(links));
          sessionStorage.setItem(STORAGE_KEY_FORM, JSON.stringify(formData));
        } catch (e) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
            localStorage.setItem(STORAGE_KEY_FORM, JSON.stringify(formData));
          } catch (e2) {
            console.warn('Could not save cotizador links:', e2);
          }
        }
      }
    }
  }
  
  function setReactInputValue(input, value) {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function restoreCotizadorLinks() {
    if (!window.location.pathname.includes('/panel')) return;
    
    var formDataStr = null;
    var linksStr = null;
    try {
      formDataStr = sessionStorage.getItem(STORAGE_KEY_FORM) || localStorage.getItem(STORAGE_KEY_FORM);
      linksStr = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    
    var linksArray = null;
    var formData = null;
    try {
      if (formDataStr) formData = JSON.parse(formDataStr);
      if (linksStr) linksArray = JSON.parse(linksStr);
      if (formData && formData.links) linksArray = formData.links;
    } catch (e) {
      return;
    }
    
    if (!linksArray || !Array.isArray(linksArray) || linksArray.length === 0) return;
    
    if (window.location.hash !== '#quotation') {
      window.location.hash = '#quotation';
    }
    
    var attempts = 0;
    var maxAttempts = 40;
    var checkInterval = setInterval(function() {
      attempts++;
      var linkInputs = document.querySelectorAll('input[placeholder*="boattrader.com"], input[placeholder*="yachtworld.com"], input[placeholder*="boats.com"]');
      if (linkInputs.length === 0) {
        var allInputs = document.querySelectorAll('input');
        var candidates = [];
        allInputs.forEach(function(inp) {
          if (inp.placeholder && inp.placeholder.indexOf('https://') === 0 && inp.type !== 'email') {
            candidates.push(inp);
          }
        });
        if (candidates.length > 0) linkInputs = candidates;
      }
      
      if (linkInputs.length > 0) {
        clearInterval(checkInterval);
        
        linksArray.forEach(function(link, index) {
          if (index < linkInputs.length) {
            setReactInputValue(linkInputs[index], link);
          }
        });
        
        if (formData) {
          if (formData.name) {
            var nameInput = document.querySelector('input[placeholder="Tu nombre"]');
            if (nameInput) setReactInputValue(nameInput, formData.name);
          }
          if (formData.email) {
            var emailInput = document.querySelector('input[type="email"][placeholder*="email"]');
            if (emailInput) setReactInputValue(emailInput, formData.email);
          }
          if (formData.phone) {
            var phoneInput = document.querySelector('input[placeholder*="XXXX"]');
            if (phoneInput) setReactInputValue(phoneInput, formData.phone);
          }
        }
        
        try {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY_FORM);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_FORM);
        } catch (e) {}
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
      }
    }, 500);
  }
  
  // ============================================
  // 2.4 SOLICITAR COTIZACION FORM UPDATE
  // Update form text and redirect to login
  // ============================================
  
  function updateCotizacionForm() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    const checkInterval = setInterval(function() {
      // Find the form section
      const formHeading = document.querySelector('h3');
      const forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        // Check if this is the cotizacion form
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.textContent.includes('Cotizacion')) {
          clearInterval(checkInterval);
          
          // Add info text before the form
          const existingInfo = form.parentElement.querySelector('.cotizacion-info-text');
          if (!existingInfo) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'cotizacion-info-text';
            infoDiv.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: #93c5fd;';
            infoDiv.innerHTML = 'Para solicitar una cotizacion online debes <a href="/panel/" style="color: #60a5fa; text-decoration: underline;">registrarte</a> e ingresar al Cotizador Online del Panel de Usuario.';
            form.parentElement.insertBefore(infoDiv, form);
          }
          
          // Save links before redirecting
          form.addEventListener('submit', function(e) {
            saveCotizadorLinks();
          });
        }
      });
    }, 500);
    
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }
  
  // ============================================
  // 2.5 PLANES DE BUSQUEDA MESSAGE
  // Add registration message to plans section
  // ============================================
  
  function updatePlanesSection() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    const checkInterval = setInterval(function() {
      // Find the plans section by looking for plan buttons
      const planButtons = document.querySelectorAll('button');
      planButtons.forEach(function(btn) {
        if (btn.textContent.includes('Contratar Ahora')) {
          clearInterval(checkInterval);
          
          // Find the parent section
          let section = btn.closest('section');
          if (section) {
            const existingInfo = section.querySelector('.planes-info-text');
            if (!existingInfo) {
              // Find the section heading
              const heading = section.querySelector('h2');
              if (heading && heading.textContent.includes('Planes')) {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'planes-info-text';
                infoDiv.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 12px 16px; margin: 16px auto; max-width: 600px; font-size: 14px; color: #93c5fd; text-align: center;';
                infoDiv.innerHTML = 'Para contratar un Plan de Busqueda debes estar <a href="/panel/" style="color: #60a5fa; text-decoration: underline;">registrado</a> e ingresar a tu panel.';
                heading.parentElement.insertBefore(infoDiv, heading.nextSibling);
              }
            }
          }
        }
      });
    }, 500);
    
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }
  
  // ============================================
  // 3.1 PROCESO MENU REDIRECT
  // Make Proceso menu item scroll to section
  // ============================================
  
  function scrollToProcesoSection() {
    var sections = document.querySelectorAll('section');
    sections.forEach(function(section) {
      var heading = section.querySelector('h2');
      if (heading && heading.textContent.includes('PROCESO DE COMPRA USA')) {
        setTimeout(function() {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }
    });
  }

  function setupProcesoMenuRedirect() {
    if (window.location.pathname.includes('/panel')) return;

    window.addEventListener('hashchange', function() {
      if (window.location.hash === '#proceso') {
        scrollToProcesoSection();
      }
    });

    if (window.location.hash === '#proceso') {
      scrollToProcesoSection();
    }
  }
  
  // ============================================
  // 3.2 PUBLICAR BUTTON
  // Add Publicar button to menu - redirects to Marketplace
  // ============================================
  
  function addPublicarButton() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    var panelUrl = window.location.pathname.includes('/test') ? '/panel-test/' : '/panel/';
    
    const checkInterval = setInterval(function() {
      const nav = document.querySelector('nav');
      if (nav) {
        const existingPublicar = nav.querySelector('.publicar-btn');
        if (!existingPublicar) {
          // Find the menu items container
          const menuItems = nav.querySelectorAll('a');
          if (menuItems.length > 0) {
            clearInterval(checkInterval);
            
            // Find the last menu item before the login buttons
            let lastMenuItem = null;
            menuItems.forEach(function(item) {
              if (!item.querySelector('button') && item.textContent.trim() !== 'Iniciar Sesion' && item.textContent.trim() !== 'Registrarse') {
                lastMenuItem = item;
              }
            });
            
            if (lastMenuItem && lastMenuItem.parentElement) {
              // Add CSS animations for the button
              if (!document.getElementById('publicar-animations')) {
                const animStyle = document.createElement('style');
                animStyle.id = 'publicar-animations';
                animStyle.textContent = `
                  @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 5px rgba(37, 99, 235, 0.3), 0 0 10px rgba(8, 145, 178, 0.2); }
                    50% { box-shadow: 0 0 15px rgba(37, 99, 235, 0.5), 0 0 25px rgba(8, 145, 178, 0.3); }
                  }
                  @keyframes textPulse {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                  }
                  @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                  }
                  .publicar-btn-modern {
                    background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
                    color: #ffffff;
                    border: 1px solid rgba(37, 99, 235, 0.4);
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    animation: pulseGlow 2.5s ease-in-out infinite;
                    position: relative;
                    overflow: hidden;
                  }
                  .publicar-btn-modern:hover {
                    border-color: rgba(37, 99, 235, 0.6);
                    transform: translateY(-1px);
                    opacity: 0.9;
                  }
                  .publicar-btn-modern::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                    background-size: 200% 100%;
                    animation: shimmer 3s ease-in-out infinite;
                  }
                  .gratis-animated {
                    font-size: 11px;
                    font-weight: 600;
                    color: #10b981;
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    animation: textPulse 1.5s ease-in-out infinite;
                    text-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
                  }
                `;
                document.head.appendChild(animStyle);
              }
              
              // Create container for button and text
              const publicarContainer = document.createElement('div');
              publicarContainer.className = 'publicar-container';
              publicarContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; margin-left: 16px;';
              
              const publicarBtn = document.createElement('button');
              publicarBtn.className = 'publicar-btn publicar-btn-modern';
              publicarBtn.title = 'Publica tu embarcacion gratis';
              publicarBtn.innerHTML = '<span style="position: relative; z-index: 1;">Publicar</span>';
              
              publicarBtn.addEventListener('click', function() {
                var token = localStorage.getItem('imporlan_token');
                if (token) {
                  window.location.href = panelUrl + '#/marketplace/publicar';
                } else {
                  sessionStorage.setItem('imporlan_redirect_after_login', panelUrl + '#/marketplace/publicar');
                  window.location.href = panelUrl;
                }
              });
              
              // Add animated "Gratis" text below the button
              const gratisText = document.createElement('span');
              gratisText.className = 'gratis-animated';
              gratisText.textContent = 'Gratis';
              
              publicarContainer.appendChild(publicarBtn);
              publicarContainer.appendChild(gratisText);
              
              // Insert after the last menu item
              lastMenuItem.parentElement.insertBefore(publicarContainer, lastMenuItem.nextSibling);
            }
          }
        }
      }
    }, 500);
    
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }
  
  // ============================================
  // 4.1 & 4.2 PROCESO UI IMPROVEMENTS
  // Align step numbers and unify box styles
  // ============================================
  
  function improveProcesoUI() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    const checkInterval = setInterval(function() {
      // Find the process section
      const sections = document.querySelectorAll('section');
      sections.forEach(function(section) {
        const heading = section.querySelector('h2');
        if (heading && heading.textContent.includes('PROCESO DE COMPRA USA')) {
          clearInterval(checkInterval);
          
          // Add CSS for alignment
          const existingStyle = document.getElementById('proceso-ui-style');
          if (!existingStyle) {
            const style = document.createElement('style');
            style.id = 'proceso-ui-style';
            style.textContent = `
              /* Align step numbers horizontally */
              section:has(h2:contains("PROCESO")) [class*="step"],
              section:has(h2:contains("PROCESO")) [class*="Step"] {
                display: flex;
                align-items: center;
              }
              
              /* Unify info box styles */
              .proceso-step-box {
                min-height: 180px !important;
                padding: 24px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-start !important;
              }
            `;
            document.head.appendChild(style);
          }
          
          // Find step boxes and apply uniform styling
          const stepBoxes = section.querySelectorAll('[class*="rounded"], [class*="card"], [class*="bg-"]');
          stepBoxes.forEach(function(box) {
            if (box.textContent.includes('PASO') || box.textContent.includes('01') || box.textContent.includes('02')) {
              box.classList.add('proceso-step-box');
            }
          });
        }
      });
    }, 500);
    
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }
  
  // ============================================
  // 4.3 FIX REGISTRARSE BUTTON HREF
  // Point "Registrarse" nav button to register form
  // ============================================

  function fixRegistrarseButton() {
    if (window.location.pathname.includes('/panel')) return;
    var panelBase = window.location.pathname.includes('/test') ? '/panel-test/' : '/panel/';
    var checkInterval = setInterval(function() {
      var nav = document.querySelector('nav');
      if (!nav) return;
      var links = nav.querySelectorAll('a');
      links.forEach(function(a) {
        var btn = a.querySelector('button');
        if (btn && btn.textContent.trim() === 'Registrarse') {
          a.href = panelBase + '#/register';
          clearInterval(checkInterval);
        }
      });
    }, 500);
    setTimeout(function() { clearInterval(checkInterval); }, 10000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  onReady(function() {
    // Small delay to let React render
    setTimeout(function() {
      // Home page enhancements
      if (!window.location.pathname.includes('/panel')) {
        updateCotizacionForm();
        updatePlanesSection();
        setupProcesoMenuRedirect();
        addPublicarButton();
        improveProcesoUI();
        fixRegistrarseButton();
        
        // Set up link saving on form interactions
        document.addEventListener('input', function(e) {
          if (e.target.type === 'url') {
            saveCotizadorLinks();
          }
        });
      }
      
      // Panel page enhancements
      if (window.location.pathname.includes('/panel')) {
        restoreCotizadorLinks();
      }
    }, 1000);
  });
  
})();
