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
  // LANCHAS USADAS SEO CONTENT SECTION
  // Visible keyword-rich content for Google ranking
  // Target: "lanchas usadas", "importacion de lanchas"
  // ============================================

  function addLanchasUsadasStyles() {
    if (document.getElementById('lanchas-usadas-seo-styles')) return;

    const style = document.createElement('style');
    style.id = 'lanchas-usadas-seo-styles';
    style.textContent = `
      .lanchas-usadas-seo {
        position: relative;
        padding: 80px 20px;
        overflow: hidden;
        background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%);
      }
      .lanchas-usadas-seo::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 60%);
        pointer-events: none;
      }
      .lanchas-usadas-container {
        max-width: 1100px;
        margin: 0 auto;
        position: relative;
        z-index: 1;
      }
      .lanchas-usadas-seo h2 {
        text-align: center;
        font-size: 2.2rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 16px;
        line-height: 1.3;
      }
      .lanchas-usadas-seo h2 .kw-highlight {
        background: linear-gradient(135deg, #3b82f6, #06b6d4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .lanchas-usadas-seo .section-intro {
        text-align: center;
        color: #9ca3af;
        font-size: 1.05rem;
        max-width: 750px;
        margin: 0 auto 48px;
        line-height: 1.7;
      }
      .lanchas-usadas-seo .section-intro strong {
        color: #d1d5db;
      }
      .lanchas-content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-bottom: 48px;
      }
      .lanchas-content-block {
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);
        border: 1px solid #2d5a87;
        border-radius: 16px;
        padding: 32px 28px;
        transition: all 0.3s ease;
      }
      .lanchas-content-block:hover {
        border-color: #3b82f6;
        box-shadow: 0 4px 24px rgba(59, 130, 246, 0.1);
      }
      .lanchas-content-block h3 {
        color: #ffffff;
        font-size: 1.3rem;
        font-weight: 600;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .lanchas-content-block h3 .block-icon {
        width: 40px;
        height: 40px;
        min-width: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .lanchas-content-block h3 .block-icon svg {
        width: 22px;
        height: 22px;
        color: white;
      }
      .lanchas-content-block h3 .icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
      .lanchas-content-block h3 .icon-cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }
      .lanchas-content-block h3 .icon-green { background: linear-gradient(135deg, #10b981, #059669); }
      .lanchas-content-block h3 .icon-orange { background: linear-gradient(135deg, #f59e0b, #d97706); }
      .lanchas-content-block p {
        color: #9ca3af;
        font-size: 0.95rem;
        line-height: 1.7;
        margin: 0 0 12px 0;
      }
      .lanchas-content-block p strong {
        color: #d1d5db;
      }
      .lanchas-content-block ul {
        list-style: none;
        padding: 0;
        margin: 12px 0 0 0;
      }
      .lanchas-content-block ul li {
        color: #9ca3af;
        font-size: 0.9rem;
        padding: 6px 0;
        padding-left: 20px;
        position: relative;
      }
      .lanchas-content-block ul li::before {
        content: '';
        position: absolute;
        left: 0;
        top: 12px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #3b82f6;
      }
      .lanchas-faq-section {
        margin-top: 48px;
      }
      .lanchas-faq-section h3 {
        text-align: center;
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 24px;
      }
      .lanchas-faq-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }
      .lanchas-faq-item {
        background: rgba(30, 58, 95, 0.5);
        border: 1px solid rgba(45, 90, 135, 0.5);
        border-radius: 12px;
        padding: 24px;
      }
      .lanchas-faq-item h4 {
        color: #60a5fa;
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 10px;
      }
      .lanchas-faq-item p {
        color: #9ca3af;
        font-size: 0.9rem;
        line-height: 1.6;
        margin: 0;
      }
      .lanchas-cta-wrapper {
        text-align: center;
        margin-top: 48px;
      }
      .lanchas-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #2563eb 0%, #0891b2 100%);
        color: #ffffff;
        border: none;
        border-radius: 14px;
        padding: 16px 36px;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
      }
      .lanchas-cta-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 35px rgba(37, 99, 235, 0.5);
      }
      .lanchas-cta-btn svg {
        width: 20px;
        height: 20px;
        transition: transform 0.3s ease;
      }
      .lanchas-cta-btn:hover svg {
        transform: translateX(4px);
      }
      @media (max-width: 768px) {
        .lanchas-usadas-seo {
          padding: 60px 16px;
        }
        .lanchas-usadas-seo h2 {
          font-size: 1.6rem;
        }
        .lanchas-content-grid {
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .lanchas-faq-grid {
          grid-template-columns: 1fr;
        }
        .lanchas-content-block {
          padding: 24px 20px;
        }
        .lanchas-cta-btn {
          width: 100%;
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createLanchasUsadasSection() {
    const section = document.createElement('section');
    section.className = 'lanchas-usadas-seo';
    section.id = 'lanchas-usadas-chile';
    section.setAttribute('itemscope', '');
    section.setAttribute('itemtype', 'https://schema.org/Service');

    const arrowIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

    section.innerHTML = `
      <div class="lanchas-usadas-container">
        <h2><span class="kw-highlight">Lanchas Usadas</span> en Chile: Compra, Venta e <span class="kw-highlight">Importacion de Lanchas</span></h2>
        <p class="section-intro">
          <span itemprop="name">Imporlan</span> es la plataforma lider en Chile para encontrar <strong>lanchas usadas en venta</strong> y realizar la <strong>importacion de lanchas</strong> desde Estados Unidos. 
          Conectamos compradores con las mejores oportunidades del mercado nautico nacional e internacional.
        </p>
        <meta itemprop="serviceType" content="Importacion de lanchas y venta de lanchas usadas en Chile">
        <meta itemprop="areaServed" content="Chile">
        
        <div class="lanchas-content-grid">
          <div class="lanchas-content-block">
            <h3>
              <span class="block-icon icon-blue">${icons.boat}</span>
              Lanchas Usadas en Venta
            </h3>
            <p>En nuestro <strong>marketplace de lanchas usadas</strong> encontraras embarcaciones verificadas publicadas por particulares y dealers en todo Chile. Desde <strong>lanchas de pesca usadas</strong>, lanchas deportivas, hasta cabinadas y pontones.</p>
            <p>Comprar una <strong>lancha usada</strong> es la forma mas inteligente de acceder a la navegacion recreativa. En Imporlan te ayudamos a encontrar la lancha perfecta al mejor precio del mercado.</p>
            <ul>
              <li>Lanchas de pesca usadas desde $3.000.000</li>
              <li>Lanchas deportivas y wakeboard usadas</li>
              <li>Lanchas cabinadas y crucero usadas</li>
              <li>Motos de agua y Jet Ski usados</li>
              <li>Veleros y yates usados en Chile</li>
            </ul>
          </div>
          
          <div class="lanchas-content-block">
            <h3>
              <span class="block-icon icon-cyan">${icons.globe}</span>
              Importacion de Lanchas desde USA
            </h3>
            <p>Somos expertos en la <strong>importacion de lanchas</strong> desde Estados Unidos a Chile. Nuestro servicio integral cubre todo el proceso: busqueda, inspeccion, compra, transporte maritimo, internacion aduanera y entrega en tu puerto.</p>
            <p><strong>Importar una lancha usada</strong> desde USA te permite acceder a embarcaciones de alta calidad a precios significativamente menores que en el mercado local, con ahorros de hasta un 40%.</p>
            <ul>
              <li>Cotizacion gratuita y sin compromiso</li>
              <li>Busqueda personalizada en BoatTrader y YachtWorld</li>
              <li>Inspeccion pre-compra profesional</li>
              <li>Transporte maritimo y tramites aduaneros</li>
              <li>Entrega puerta a puerta en Chile</li>
            </ul>
          </div>
          
          <div class="lanchas-content-block">
            <h3>
              <span class="block-icon icon-green">${icons.sailboat}</span>
              Tipos de Lanchas Usadas Disponibles
            </h3>
            <p>Ya sea que busques <strong>lanchas usadas</strong> para pesca, paseo familiar o deportes acuaticos, en Imporlan tenemos opciones para todos los presupuestos y necesidades.</p>
            <ul>
              <li><strong>Lanchas de pesca:</strong> Center console, bass boats y walkaround</li>
              <li><strong>Lanchas deportivas:</strong> Bowrider, runabout y ski boats</li>
              <li><strong>Lanchas familiares:</strong> Deck boats y pontones</li>
              <li><strong>Lanchas cabinadas:</strong> Cuddy cabin y cruiser</li>
              <li><strong>Motos de agua:</strong> Yamaha, Sea-Doo y Kawasaki</li>
            </ul>
          </div>
          
          <div class="lanchas-content-block">
            <h3>
              <span class="block-icon icon-orange">${icons.anchor}</span>
              Por que Elegir Imporlan para tu Lancha
            </h3>
            <p>Con anos de experiencia en la <strong>importacion de lanchas</strong> y <strong>venta de lanchas usadas</strong>, Imporlan se ha posicionado como el referente del mercado nautico en Chile.</p>
            <ul>
              <li><strong>+200 embarcaciones</strong> importadas exitosamente</li>
              <li>Servicio integral <strong>puerta a puerta</strong></li>
              <li>Precios transparentes sin costos ocultos</li>
              <li>Marketplace con <strong>lanchas usadas verificadas</strong></li>
              <li>Asesoria nautica profesional gratuita</li>
              <li>Financiamiento y seguros nauticos</li>
            </ul>
          </div>
        </div>
        
        <div class="lanchas-faq-section" itemscope itemtype="https://schema.org/FAQPage">
          <h3>Preguntas Frecuentes sobre Lanchas Usadas e Importacion</h3>
          <div class="lanchas-faq-grid">
            <div class="lanchas-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
              <h4 itemprop="name">¿Cuanto cuesta una lancha usada en Chile?</h4>
              <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
                <p itemprop="text">Las <strong>lanchas usadas</strong> en Chile tienen precios desde $3.000.000 CLP para modelos basicos de pesca, hasta $80.000.000+ para lanchas cabinadas premium. El precio depende del tamano, marca, motor y estado general.</p>
              </div>
            </div>
            <div class="lanchas-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
              <h4 itemprop="name">¿Cuanto cuesta importar una lancha desde USA?</h4>
              <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
                <p itemprop="text">La <strong>importacion de lanchas</strong> desde USA tiene costos que incluyen: precio de compra, transporte maritimo ($2.000-$5.000 USD), internacion aduanera (6% arancel + 19% IVA) y logistica local. Cotiza gratis con Imporlan.</p>
              </div>
            </div>
            <div class="lanchas-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
              <h4 itemprop="name">¿Conviene importar una lancha usada o comprar en Chile?</h4>
              <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
                <p itemprop="text"><strong>Importar lanchas usadas</strong> desde USA suele ser más conveniente, con ahorros de 10% a 20% respecto al mercado local chileno en compras sobre USD $25.000 (allá), además de mayor variedad de modelos y marcas disponibles. La gracia es que podrás elegir entre muchas más opciones.</p>
              </div>
            </div>
            <div class="lanchas-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
              <h4 itemprop="name">¿Que documentos necesito para importar una lancha?</h4>
              <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
                <p itemprop="text">Para la <strong>importacion de lanchas</strong> necesitas: Bill of Sale, titulo de propiedad, factura comercial, Bill of Lading y documentos aduaneros. Imporlan gestiona todos los tramites por ti.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="lanchas-cta-wrapper">
          <a class="lanchas-cta-btn" href="/marketplace/">
            Ver Lanchas Usadas en Venta ${arrowIcon}
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
      const existingLanchas = document.getElementById('lanchas-usadas-chile');
      if (existingGuia) existingGuia.remove();
      if (existingServicios) existingServicios.remove();
      if (existingLanchas) existingLanchas.remove();
    
      // Also remove old styles to refresh them
      const existingStyles = document.getElementById('seo-sections-styles');
      const existingLanchasStyles = document.getElementById('lanchas-usadas-seo-styles');
      if (existingStyles) existingStyles.remove();
      if (existingLanchasStyles) existingLanchasStyles.remove();
    
    const checkInterval = setInterval(function() {
      // Find the "Proceso de Compra USA" section
      const procesoSection = findSectionByHeading('PROCESO DE COMPRA USA');
      
      // Find the "Por que elegir Imporlan" section
      const beneficiosSection = findSectionByHeading('POR QUE ELEGIR') || findSectionByHeading('ELEGIR IMPORLAN');
      
      if (procesoSection && beneficiosSection) {
        clearInterval(checkInterval);
        
        // Add styles
        addSEOStyles();
        addLanchasUsadasStyles();
        
        // Insert Guia section after Proceso
        const guiaSection = createGuiaSection();
        procesoSection.parentNode.insertBefore(guiaSection, procesoSection.nextSibling);
        
        // Insert Servicios section after Beneficios
        const serviciosSection = createServiciosSection();
        beneficiosSection.parentNode.insertBefore(serviciosSection, beneficiosSection.nextSibling);
        
        // Insert Lanchas Usadas SEO section at the end of main content (before footer)
        const lanchasSection = createLanchasUsadasSection();
        const footer = document.querySelector('footer');
        if (footer) {
          footer.parentNode.insertBefore(lanchasSection, footer);
        } else {
          // If no footer found, append to root or last section
          const root = document.getElementById('root');
          if (root) {
            root.appendChild(lanchasSection);
          }
        }
        
        console.log('[SEO Sections v2] Successfully inserted Guia, Servicios and Lanchas Usadas sections');
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
