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

