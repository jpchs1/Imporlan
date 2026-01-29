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
  
  function saveCotizadorLinks() {
    // Find all link inputs in the cotizador form on Home
    const linkInputs = document.querySelectorAll('input[type="url"][placeholder*="Link"]');
    if (linkInputs.length > 0) {
      const links = [];
      linkInputs.forEach(function(input) {
        if (input.value && input.value.trim()) {
          links.push(input.value.trim());
        }
      });
      if (links.length > 0) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(links));
        } catch (e) {
          // Fallback to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
          } catch (e2) {
            console.warn('Could not save cotizador links:', e2);
          }
        }
      }
    }
  }
  
  function restoreCotizadorLinks() {
    // Only run on panel page
    if (!window.location.pathname.includes('/panel')) return;
    
    let links = null;
    try {
      links = sessionStorage.getItem(STORAGE_KEY);
      if (!links) {
        links = localStorage.getItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Could not retrieve cotizador links:', e);
      return;
    }
    
    if (!links) return;
    
    try {
      const linksArray = JSON.parse(links);
      if (!Array.isArray(linksArray) || linksArray.length === 0) return;
      
      // Wait for panel cotizador to render
      const checkInterval = setInterval(function() {
        const linkInputs = document.querySelectorAll('input[type="url"][placeholder*="Link"], input[placeholder*="link"]');
        if (linkInputs.length > 0) {
          clearInterval(checkInterval);
          
          // Fill in the links
          linksArray.forEach(function(link, index) {
            if (linkInputs[index]) {
              linkInputs[index].value = link;
              // Trigger React's onChange
              const event = new Event('input', { bubbles: true });
              linkInputs[index].dispatchEvent(event);
            }
          });
          
          // Clear storage after successful restore
          try {
            sessionStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY);
          } catch (e) {}
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(function() {
        clearInterval(checkInterval);
      }, 10000);
      
    } catch (e) {
      console.warn('Could not restore cotizador links:', e);
    }
  }
  
  // ============================================
  // 2.4 SOLICITAR COTIZACION FORM UPDATE
  // Update form text, title, and add Google Cloud-style visual effects
  // ============================================
  
  function addGoogleCloudInputStyles() {
    if (document.getElementById('google-cloud-input-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'google-cloud-input-styles';
    style.textContent = `
      /* Google Cloud AI Input Box Effect - Enhanced Contrast Version */
      @keyframes borderGradientAnimation {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      @keyframes glowPulse {
        0%, 100% { 
          box-shadow: 0 0 30px rgba(66, 133, 244, 0.4), 
                      0 0 60px rgba(52, 168, 83, 0.3), 
                      0 0 90px rgba(251, 188, 5, 0.2);
        }
        50% { 
          box-shadow: 0 0 40px rgba(66, 133, 244, 0.5), 
                      0 0 80px rgba(234, 67, 53, 0.4), 
                      0 0 120px rgba(52, 168, 83, 0.3);
        }
      }
      
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      .cotizacion-form-container {
        position: relative;
        background: linear-gradient(145deg, rgba(8, 15, 30, 0.98) 0%, rgba(20, 30, 48, 0.98) 100%);
        border-radius: 24px;
        padding: 32px;
        margin: 20px 0;
        animation: glowPulse 3s ease-in-out infinite;
      }
      
      .cotizacion-form-container::before {
        content: '';
        position: absolute;
        top: -3px;
        left: -3px;
        right: -3px;
        bottom: -3px;
        background: linear-gradient(90deg, 
          #4285f4, #34a853, #fbbc05, #ea4335, 
          #4285f4, #34a853, #fbbc05, #ea4335, #4285f4);
        background-size: 400% 400%;
        border-radius: 27px;
        z-index: -1;
        animation: borderGradientAnimation 3s linear infinite;
        filter: blur(1px);
      }
      
      .cotizacion-form-container::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(145deg, rgba(8, 15, 30, 0.99) 0%, rgba(20, 30, 48, 0.99) 100%);
        border-radius: 24px;
        z-index: -1;
      }
      
      .cotizacion-title-gcloud {
        font-size: 26px;
        font-weight: 700;
        color: #ffffff;
        text-align: center;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
        text-shadow: 0 2px 10px rgba(66, 133, 244, 0.3);
      }
      
      .cotizacion-subtitle-gcloud {
        font-size: 15px;
        color: rgba(180, 195, 210, 0.95);
        text-align: center;
        margin-bottom: 24px;
      }
      
      .gcloud-input-wrapper {
        position: relative;
        margin-bottom: 16px;
      }
      
      .gcloud-input-wrapper::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(90deg, 
          #4285f4, #34a853, #fbbc05, #ea4335, 
          #4285f4, #34a853, #fbbc05, #ea4335, #4285f4);
        background-size: 400% 400%;
        border-radius: 18px;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 0;
      }
      
      .gcloud-input-wrapper:focus-within::before {
        opacity: 1;
        animation: borderGradientAnimation 2s linear infinite;
      }
      
      .gcloud-input-wrapper input,
      .gcloud-input-wrapper textarea {
        position: relative;
        width: 100%;
        padding: 16px 20px;
        background: rgba(15, 25, 40, 0.95);
        border: 2px solid rgba(100, 130, 170, 0.4);
        border-radius: 16px;
        color: #ffffff;
        font-size: 15px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1;
      }
      
      .gcloud-input-wrapper input::placeholder,
      .gcloud-input-wrapper textarea::placeholder {
        color: rgba(160, 175, 195, 0.7);
      }
      
      .gcloud-input-wrapper input:focus,
      .gcloud-input-wrapper textarea:focus {
        outline: none;
        border-color: transparent;
        background: rgba(15, 25, 40, 0.98);
        box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.6), 
                    0 4px 25px rgba(66, 133, 244, 0.25),
                    0 8px 40px rgba(52, 168, 83, 0.15);
      }
      
      .gcloud-input-wrapper input:hover:not(:focus),
      .gcloud-input-wrapper textarea:hover:not(:focus) {
        border-color: rgba(100, 130, 170, 0.6);
        background: rgba(15, 25, 40, 0.97);
        box-shadow: 0 2px 15px rgba(66, 133, 244, 0.1);
      }
      
      .gcloud-submit-btn {
        width: 100%;
        padding: 18px 24px;
        background: linear-gradient(135deg, #4285f4 0%, #1a73e8 50%, #0d47a1 100%);
        border: none;
        border-radius: 16px;
        color: #ffffff;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        margin-top: 12px;
        box-shadow: 0 4px 20px rgba(66, 133, 244, 0.4);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }
      
      .gcloud-submit-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 200%;
        height: 100%;
        background: linear-gradient(90deg, 
          transparent, 
          rgba(255, 255, 255, 0.3), 
          transparent);
        transition: left 0.6s ease;
      }
      
      .gcloud-submit-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 35px rgba(66, 133, 244, 0.5),
                    0 4px 15px rgba(52, 168, 83, 0.3);
        background: linear-gradient(135deg, #5a9cf5 0%, #2b85f0 50%, #1565c0 100%);
      }
      
      .gcloud-submit-btn:hover::before {
        left: 100%;
      }
      
      .gcloud-submit-btn:active {
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(66, 133, 244, 0.4);
      }
      
      .gcloud-powered-by {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
        font-size: 13px;
        color: rgba(160, 175, 195, 0.7);
      }
      
      .gcloud-powered-by svg {
        width: 18px;
        height: 18px;
        color: #4285f4;
      }
      
      .gcloud-suggestion-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
        justify-content: center;
      }
      
      .gcloud-chip {
        padding: 8px 16px;
        background: rgba(66, 133, 244, 0.15);
        border: 1px solid rgba(66, 133, 244, 0.4);
        border-radius: 20px;
        color: #93c5fd;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .gcloud-chip:hover {
        background: rgba(66, 133, 244, 0.25);
        border-color: rgba(66, 133, 244, 0.6);
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(66, 133, 244, 0.2);
      }
      
      /* Enhanced info text styling */
      .cotizacion-info-text {
        background: rgba(66, 133, 244, 0.15) !important;
        border: 1px solid rgba(66, 133, 244, 0.4) !important;
        border-radius: 12px !important;
        padding: 14px 18px !important;
        margin-bottom: 20px !important;
        font-size: 14px !important;
        color: #a5d6ff !important;
        text-align: center !important;
      }
      
      .cotizacion-info-text a {
        color: #60a5fa !important;
        text-decoration: underline !important;
        font-weight: 600 !important;
      }
      
      .cotizacion-info-text a:hover {
        color: #93c5fd !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  function updateCotizacionForm() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    // Add Google Cloud input styles
    addGoogleCloudInputStyles();
    
    const checkInterval = setInterval(function() {
      // Find the form section
      const forms = document.querySelectorAll('form');
      
      forms.forEach(function(form) {
        // Check if this is the cotizacion form
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && submitBtn.textContent.includes('Cotizacion')) {
          clearInterval(checkInterval);
          
          // Check if already enhanced
          if (form.parentElement.querySelector('.cotizacion-form-container')) return;
          
          // Find and update the form title
          const formSection = form.closest('section') || form.parentElement;
          const headings = formSection.querySelectorAll('h2, h3');
          headings.forEach(function(heading) {
            if (heading.textContent.includes('Solicitar Cotizacion') || heading.textContent.includes('Cotizacion')) {
              heading.textContent = 'Solicitar Cotizacion por Links Online';
              heading.className = 'cotizacion-title-gcloud';
            }
          });
          
          // Create container with Google Cloud style
          const container = document.createElement('div');
          container.className = 'cotizacion-form-container';
          
          // Add title if not found
          if (!formSection.querySelector('.cotizacion-title-gcloud')) {
            const title = document.createElement('h3');
            title.className = 'cotizacion-title-gcloud';
            title.textContent = 'Solicitar Cotizacion por Links Online';
            container.appendChild(title);
          }
          
          // Add subtitle
          const subtitle = document.createElement('p');
          subtitle.className = 'cotizacion-subtitle-gcloud';
          subtitle.textContent = 'Pega los links de las embarcaciones que te interesan';
          container.appendChild(subtitle);
          
          // Wrap existing inputs with Google Cloud style
          const inputs = form.querySelectorAll('input, textarea');
          inputs.forEach(function(input) {
            if (!input.closest('.gcloud-input-wrapper')) {
              const wrapper = document.createElement('div');
              wrapper.className = 'gcloud-input-wrapper';
              input.parentNode.insertBefore(wrapper, input);
              wrapper.appendChild(input);
            }
          });
          
          // Style the submit button
          if (submitBtn) {
            submitBtn.classList.add('gcloud-submit-btn');
          }
          
          // Add info text
          const existingInfo = form.parentElement.querySelector('.cotizacion-info-text');
          if (!existingInfo) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'cotizacion-info-text';
            infoDiv.style.cssText = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; color: #93c5fd; text-align: center;';
            infoDiv.innerHTML = 'Para solicitar una cotizacion online debes <a href="/panel/" style="color: #60a5fa; text-decoration: underline;">registrarte</a> e ingresar al Cotizador Online del Panel de Usuario.';
            form.insertBefore(infoDiv, form.firstChild);
          }
          
          // Add powered by text
          const poweredBy = document.createElement('div');
          poweredBy.className = 'gcloud-powered-by';
          poweredBy.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> Cotizador Imporlan';
          form.appendChild(poweredBy);
          
          // Wrap form in container
          form.parentNode.insertBefore(container, form);
          container.appendChild(form);
          
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
  
  function setupProcesoMenuRedirect() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
    const checkInterval = setInterval(function() {
      const navLinks = document.querySelectorAll('nav a, header a');
      navLinks.forEach(function(link) {
        if (link.textContent.trim() === 'Proceso') {
          clearInterval(checkInterval);
          
          link.addEventListener('click', function(e) {
            e.preventDefault();
            // Find the PROCESO DE COMPRA USA section
            const sections = document.querySelectorAll('section');
            sections.forEach(function(section) {
              const heading = section.querySelector('h2');
              if (heading && heading.textContent.includes('PROCESO DE COMPRA USA')) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            });
          });
        }
      });
    }, 500);
    
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 10000);
  }
  
  // ============================================
  // 3.2 PUBLICAR BUTTON (DISABLED)
  // Add disabled Publicar button to menu
  // ============================================
  
  function addPublicarButton() {
    // Only run on Home page
    if (window.location.pathname.includes('/panel')) return;
    
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
                    0%, 100% { box-shadow: 0 0 5px rgba(255, 100, 100, 0.3), 0 0 10px rgba(255, 100, 100, 0.2); }
                    50% { box-shadow: 0 0 15px rgba(255, 100, 100, 0.5), 0 0 25px rgba(255, 100, 100, 0.3); }
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
                    background: linear-gradient(135deg, rgba(80, 80, 90, 0.6) 0%, rgba(60, 60, 70, 0.8) 100%);
                    color: rgba(255, 255, 255, 0.85);
                    border: 1px solid rgba(255, 120, 120, 0.4);
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: not-allowed;
                    transition: all 0.3s ease;
                    animation: pulseGlow 2.5s ease-in-out infinite;
                    position: relative;
                    overflow: hidden;
                  }
                  .publicar-btn-modern:hover {
                    border-color: rgba(255, 120, 120, 0.6);
                    transform: translateY(-1px);
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
                  .proximamente-animated {
                    font-size: 11px;
                    font-weight: 600;
                    color: #ff6b6b;
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    animation: textPulse 1.5s ease-in-out infinite;
                    text-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
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
              publicarBtn.disabled = true;
              publicarBtn.title = 'Disponible proximamente';
              publicarBtn.innerHTML = '<span style="position: relative; z-index: 1;">Publicar</span>';
              
              // Add animated "proximamente" text below the button
              const proximamenteText = document.createElement('span');
              proximamenteText.className = 'proximamente-animated';
              proximamenteText.textContent = 'proximamente';
              
              publicarContainer.appendChild(publicarBtn);
              publicarContainer.appendChild(proximamenteText);
              
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
