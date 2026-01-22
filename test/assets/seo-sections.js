/**
 * Imporlan SEO Sections Enhancement v2
 * Adds SEO-optimized internal linking sections to the HOME page
 * - Guia de Importacion (after "Proceso de Compra USA")
 * - Servicios de Importacion (after "Por que elegir Imporlan")
 * Updated with colorful SVG icons
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
      
      .guide-card .card-icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
      }
      
      .guide-card:hover .card-icon-wrapper {
        transform: scale(1.1);
      }
      
      .guide-card .card-icon-wrapper svg {
        width: 32px;
        height: 32px;
        color: white;
      }
      
      .guide-card .icon-orange { background: linear-gradient(135deg, #f59e0b, #d97706); }
      .guide-card .icon-green { background: linear-gradient(135deg, #10b981, #059669); }
      .guide-card .icon-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
      .guide-card .icon-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
      
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
        text-align: center;
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
      
      .service-card .card-icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px auto;
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
      }
      
      .service-card:hover .card-icon-wrapper {
        transform: scale(1.1);
      }
      
      .service-card .card-icon-wrapper svg {
        width: 32px;
        height: 32px;
        color: white;
      }
      
      .service-card .icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
      .service-card .icon-cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }
      .service-card .icon-green { background: linear-gradient(135deg, #10b981, #059669); }
      .service-card .icon-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
      .service-card .icon-red { background: linear-gradient(135deg, #ef4444, #dc2626); }
      
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
  // SVG ICONS
  // ============================================
  
  const icons = {
    money: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    clipboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>',
    trophy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    quote: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>',
    boat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M12 2v4"/><path d="m4.93 10.93 2.83 2.83"/><path d="m19.07 10.93-2.83 2.83"/></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    sailboat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z"/><path d="M21 14 10 2 3 14h18Z"/><path d="M10 2v16"/></svg>',
    ship: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>',
    anchor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" x2="12" y1="22" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>'
  };

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
            <div class="card-icon-wrapper icon-orange">${icons.money}</div>
            <h3>¿Cuanto cuesta importar?</h3>
            <p>Conoce los costos detallados de importar tu lancha o embarcacion desde USA</p>
          </a>
          
          <a href="/requisitos-importar-embarcaciones-chile/" class="guide-card">
            <div class="card-icon-wrapper icon-green">${icons.clipboard}</div>
            <h3>Requisitos de Importacion</h3>
            <p>Documentos y tramites necesarios para importar legalmente</p>
          </a>
          
          <a href="/casos-de-importacion/" class="guide-card">
            <div class="card-icon-wrapper icon-purple">${icons.trophy}</div>
            <h3>Casos de Exito</h3>
            <p>Conoce importaciones reales que hemos realizado</p>
          </a>
          
          <a href="/cotizar-importacion/" class="guide-card highlight">
            <div class="card-icon-wrapper icon-blue">${icons.quote}</div>
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
            <div class="card-icon-wrapper icon-blue">${icons.boat}</div>
            <h3>Importacion de Lanchas</h3>
            <p>Lanchas nuevas y usadas desde USA con servicio integral</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/importacion-embarcaciones-usa-chile/" class="service-card">
            <div class="card-icon-wrapper icon-cyan">${icons.globe}</div>
            <h3>Embarcaciones desde USA</h3>
            <p>Servicio completo de importacion USA-Chile</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/importacion-veleros-chile/" class="service-card">
            <div class="card-icon-wrapper icon-green">${icons.sailboat}</div>
            <h3>Importacion de Veleros</h3>
            <p>Veleros de crucero y regata desde Estados Unidos</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/logistica-maritima-importacion/" class="service-card">
            <div class="card-icon-wrapper icon-purple">${icons.ship}</div>
            <h3>Logistica Maritima</h3>
            <p>Transporte, documentacion y tramites aduaneros</p>
            <span class="card-arrow">→</span>
          </a>
          
          <a href="/servicios/" class="service-card">
            <div class="card-icon-wrapper icon-red">${icons.anchor}</div>
            <h3>Todos los Servicios</h3>
            <p>Conoce todos nuestros servicios de importacion nautica</p>
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
    
      // Remove existing sections to replace with updated versions
      const existingGuia = document.getElementById('guia-importacion');
      const existingServicios = document.getElementById('servicios-importacion');
      if (existingGuia) existingGuia.remove();
      if (existingServicios) existingServicios.remove();
    
      // Also remove old styles to refresh them
      const existingStyles = document.getElementById('seo-sections-styles');
      if (existingStyles) existingStyles.remove();
    
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
        
        console.log('[SEO Sections v2] Successfully inserted Guia and Servicios sections with colorful icons');
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
