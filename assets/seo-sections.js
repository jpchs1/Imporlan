/**
 * Imporlan SEO Sections Enhancement
 * Adds SEO-optimized internal linking sections to the HOME page
 * - Guia de Importacion (after "Proceso de Compra USA")
 * - Servicios de Importacion (after "Por que elegir Imporlan")
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
  // CSS STYLES FOR SEO SECTIONS
  // ============================================
  
  function addSEOStyles() {
    if (document.getElementById('seo-sections-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'seo-sections-styles';
    style.textContent = `
      /* Common styles for SEO sections - matching existing HOME section styling */
      /* Dark navy background to match the HOME theme */
      .seo-section {
        position: relative;
        padding: 96px 20px;
        overflow: hidden;
        background-color: #0a1628;
      }
      
      .seo-section-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .seo-section h2 {
        text-align: center;
        font-size: 2.5rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 16px;
      }
      
      .seo-section .section-subtitle {
        text-align: center;
        color: #9ca3af;
        font-size: 1.1rem;
        margin-bottom: 48px;
      }
      
      /* Guide section cards */
      .guide-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
      }
      
      .guide-card {
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);
        border: 1px solid #2d5a87;
        border-radius: 16px;
        padding: 32px 24px;
        text-align: center;
        text-decoration: none;
        transition: all 0.3s ease;
        display: block;
      }
      
      .guide-card:hover {
        transform: translateY(-4px);
        border-color: #3b82f6;
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15);
      }
      
      .guide-card .card-icon {
        font-size: 3rem;
        margin-bottom: 16px;
        display: block;
      }
      
      .guide-card h3 {
        color: #ffffff;
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 12px;
      }
      
      .guide-card p {
        color: #9ca3af;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0;
      }
      
      .guide-card.highlight {
        border-color: #3b82f6;
        background: linear-gradient(145deg, #1e4a6f 0%, #163550 100%);
      }
      
      .guide-card.highlight h3 {
        color: #60a5fa;
      }
      
      /* Services section cards */
      .services-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
      }
      
      .service-card {
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);
        border: 1px solid #2d5a87;
        border-radius: 16px;
        padding: 32px 24px;
        text-decoration: none;
        transition: all 0.3s ease;
        display: block;
        position: relative;
        overflow: hidden;
      }
      
      .service-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #3b82f6, #60a5fa);
        transform: scaleX(0);
        transition: transform 0.3s ease;
      }
      
      .service-card:hover {
        transform: translateY(-4px);
        border-color: #3b82f6;
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15);
      }
      
      .service-card:hover::before {
        transform: scaleX(1);
      }
      
      .service-card .card-icon {
        font-size: 2.5rem;
        margin-bottom: 16px;
        display: block;
      }
      
      .service-card h3 {
        color: #ffffff;
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 12px;
      }
      
      .service-card p {
        color: #9ca3af;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0;
      }
      
      .service-card .card-arrow {
        position: absolute;
        bottom: 24px;
        right: 24px;
        color: #3b82f6;
        font-size: 1.5rem;
        opacity: 0;
        transform: translateX(-10px);
        transition: all 0.3s ease;
      }
      
      .service-card:hover .card-arrow {
        opacity: 1;
        transform: translateX(0);
      }
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        .seo-section {
          padding: 60px 16px;
        }
        
        .seo-section h2 {
          font-size: 1.75rem;
        }
        
        .guide-grid,
        .services-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        .guide-card,
        .service-card {
          padding: 24px 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // GUIA DE IMPORTACION SECTION
  // Insert after "Proceso de Compra USA"
  // ============================================
  
  function createGuiaSection() {
    const section = document.createElement('section');
    section.className = 'seo-section guia-importacion-section';
    section.id = 'guia-importacion';
    
    section.innerHTML = `
      <div class="seo-section-container">
        <h2>Guia de Importacion</h2>
        <p class="section-subtitle">Todo lo que necesitas saber antes de importar tu embarcacion</p>
        
        <div class="guide-grid">
          <a href="/cuanto-cuesta-importar-una-lancha-a-chile/" class="guide-card">
            <span class="card-icon">💰</span>
            <h3>¿Cuanto cuesta importar?</h3>
            <p>Conoce los costos detallados de importar tu lancha o embarcacion desde USA</p>
          </a>
          
          <a href="/requisitos-importar-embarcaciones-chile/" class="guide-card">
            <span class="card-icon">📋</span>
            <h3>Requisitos de Importacion</h3>
            <p>Documentos y tramites necesarios para importar legalmente</p>
          </a>
          
          <a href="/casos-de-importacion/" class="guide-card">
            <span class="card-icon">🏆</span>
            <h3>Casos de Exito</h3>
            <p>Conoce importaciones reales que hemos realizado</p>
          </a>
          
          <a href="/cotizar-importacion/" class="guide-card highlight">
            <span class="card-icon">📝</span>
            <h3>Cotizar Importacion</h3>
            <p>Solicita tu cotizacion personalizada gratis</p>
          </a>
        </div>
      </div>
    `;
    
    return section;
  }

  // ============================================
  // SERVICIOS DE IMPORTACION SECTION
  // Insert after "Por que elegir Imporlan"
  // ============================================
  
  function createServiciosSection() {
    const section = document.createElement('section');
    section.className = 'seo-section servicios-importacion-section';
    section.id = 'servicios-importacion';
    
    section.innerHTML = `
      <div class="seo-section-container">
        <h2>Nuestros Servicios de Importacion</h2>
        <p class="section-subtitle">Especialistas en traer tu embarcacion ideal desde Estados Unidos a Chile</p>
        
        <div class="services-grid">
          <a href="/importacion-lanchas-chile/" class="service-card">
            <span class="card-icon">🚤</span>
            <h3>Importacion de Lanchas</h3>
            <p>Lanchas nuevas y usadas desde USA con servicio integral</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/importacion-embarcaciones-usa-chile/" class="service-card">
            <span class="card-icon">🌎</span>
            <h3>Embarcaciones desde USA</h3>
            <p>Servicio completo de importacion USA-Chile</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/importacion-veleros-chile/" class="service-card">
            <span class="card-icon">⛵</span>
            <h3>Importacion de Veleros</h3>
            <p>Veleros de crucero y regata desde Estados Unidos</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/logistica-maritima-importacion/" class="service-card">
            <span class="card-icon">🚢</span>
            <h3>Logistica Maritima</h3>
            <p>Transporte, documentacion y tramites aduaneros</p>
            <span class="card-arrow">→</span>
          </a>
        </div>
      </div>
    `;
    
    return section;
  }

  // ============================================
  // SECTION INSERTION LOGIC
  // ============================================
  
  function findSectionByHeading(searchText) {
    const sections = document.querySelectorAll('section');
    for (let i = 0; i < sections.length; i++) {
      const heading = sections[i].querySelector('h2');
      if (heading && heading.textContent.toUpperCase().includes(searchText.toUpperCase())) {
        return sections[i];
      }
    }
    return null;
  }

  function insertSEOSections() {
    // Only run on Home page (not panel)
    if (window.location.pathname.includes('/panel')) return;
    
    // Check if already inserted
    if (document.getElementById('guia-importacion') || document.getElementById('servicios-importacion')) {
      return;
    }
    
    const checkInterval = setInterval(function() {
      // Find the "Proceso de Compra USA" section
      const procesoSection = findSectionByHeading('PROCESO DE COMPRA USA');
      
      // Find the "Por que elegir Imporlan" section
      const beneficiosSection = findSectionByHeading('POR QUE ELEGIR') || findSectionByHeading('ELEGIR IMPORLAN');
      
      if (procesoSection && beneficiosSection) {
        clearInterval(checkInterval);
        
        // Add styles
        addSEOStyles();
        
        // Insert Guia section after Proceso
        const guiaSection = createGuiaSection();
        procesoSection.parentNode.insertBefore(guiaSection, procesoSection.nextSibling);
        
        // Insert Servicios section after Beneficios
        const serviciosSection = createServiciosSection();
        beneficiosSection.parentNode.insertBefore(serviciosSection, beneficiosSection.nextSibling);
        
        console.log('[SEO Sections] Successfully inserted Guia and Servicios sections');
      }
    }, 500);
    
    // Stop checking after 15 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
    }, 15000);
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  
  onReady(function() {
    // Wait for React to render
    setTimeout(function() {
      insertSEOSections();
    }, 1500);
  });

})();
