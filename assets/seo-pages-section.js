/**
 * Imporlan SEO Pages Section
 * Dynamically loads and displays all SEO pages from seo-pages.json
 * Creates a "Guias y Recursos" section in the HOME page
 * Version 1.0
 */

(function() {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  const icons = {
    boat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M12 2v4"/><path d="m4.93 10.93 2.83 2.83"/><path d="m19.07 10.93-2.83 2.83"/></svg>',
    jetski: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M5 14h14l2 4H3l2-4z"/><path d="M8 14V9l4-3 4 3v5"/><circle cx="12" cy="7" r="1"/></svg>',
    money: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    document: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>',
    ship: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>',
    globe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>',
    question: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    anchor: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" x2="12" y1="22" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>',
    truck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'
  };

  const categoryColors = {
    'Compra': 'icon-blue',
    'Venta': 'icon-green',
    'Importacion': 'icon-cyan',
    'Documentacion': 'icon-purple',
    'Costos': 'icon-gold',
    'Seguros': 'icon-red',
    'Logistica': 'icon-orange',
    'Guias': 'icon-blue',
    'FAQ': 'icon-purple',
    'Catalogo': 'icon-cyan'
  };

  function addStyles() {
    if (document.getElementById('seo-pages-section-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'seo-pages-section-styles';
    style.textContent = `
      .seo-pages-section {
        position: relative;
        padding: 96px 20px;
        overflow: hidden;
        background: linear-gradient(180deg, #0a1628 0%, #0f1d32 50%, #0a1628 100%);
      }
      
      .seo-pages-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .seo-pages-section h2 {
        text-align: center;
        font-size: 2.5rem;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 16px;
      }
      
      .seo-pages-section .section-subtitle {
        text-align: center;
        color: #9ca3af;
        font-size: 1.1rem;
        margin-bottom: 48px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .seo-pages-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        max-width: 1100px;
        margin: 0 auto;
      }
      
      .seo-page-card {
        background: linear-gradient(145deg, #1e3a5f 0%, #152a45 100%);
        border: 1px solid #2d5a87;
        border-radius: 16px;
        padding: 28px 24px;
        text-decoration: none;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }
      
      .seo-page-card::before {
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
      
      .seo-page-card:hover {
        transform: translateY(-4px);
        border-color: #3b82f6;
        box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15);
      }
      
      .seo-page-card:hover::before {
        transform: scaleX(1);
      }
      
      .seo-page-card-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 12px;
      }
      
      .seo-page-card .card-icon-wrapper {
        width: 48px;
        height: 48px;
        min-width: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: transform 0.3s ease;
      }
      
      .seo-page-card:hover .card-icon-wrapper {
        transform: scale(1.1);
      }
      
      .seo-page-card .card-icon-wrapper svg {
        width: 24px;
        height: 24px;
        color: white;
      }
      
      .seo-page-card .icon-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
      .seo-page-card .icon-green { background: linear-gradient(135deg, #10b981, #059669); }
      .seo-page-card .icon-gold { background: linear-gradient(135deg, #f59e0b, #d97706); }
      .seo-page-card .icon-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
      .seo-page-card .icon-cyan { background: linear-gradient(135deg, #06b6d4, #0891b2); }
      .seo-page-card .icon-red { background: linear-gradient(135deg, #ef4444, #dc2626); }
      .seo-page-card .icon-orange { background: linear-gradient(135deg, #f97316, #ea580c); }
      
      .seo-page-card h3 {
        color: #ffffff;
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
        line-height: 1.3;
        flex: 1;
      }
      
      .seo-page-card p {
        color: #9ca3af;
        font-size: 0.9rem;
        line-height: 1.5;
        margin: 0 0 16px 0;
        flex: 1;
      }
      
      .seo-page-card .card-category {
        display: inline-block;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        font-size: 0.75rem;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .seo-page-card .card-cta {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #3b82f6;
        font-size: 0.85rem;
        font-weight: 500;
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid rgba(45, 90, 135, 0.5);
      }
      
      .seo-page-card .card-cta svg {
        width: 16px;
        height: 16px;
        transition: transform 0.3s ease;
      }
      
      .seo-page-card:hover .card-cta svg {
        transform: translateX(4px);
      }
      
      .seo-pages-count {
        text-align: center;
        color: #6b7280;
        font-size: 0.85rem;
        margin-top: 32px;
      }
      
      @media (max-width: 768px) {
        .seo-pages-section {
          padding: 60px 16px;
        }
        
        .seo-pages-section h2 {
          font-size: 1.75rem;
        }
        
        .seo-pages-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        
        .seo-page-card {
          padding: 20px 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createPageCard(page) {
    const iconSvg = icons[page.icon] || icons.anchor;
    const colorClass = categoryColors[page.category] || 'icon-blue';
    
    return `
      <a href="${page.url}" class="seo-page-card">
        <div class="seo-page-card-header">
          <div class="card-icon-wrapper ${colorClass}">${iconSvg}</div>
          <h3>${page.title}</h3>
        </div>
        <p>${page.description}</p>
        <div class="card-cta">
          <span>Leer guia</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </a>
    `;
  }

  function createSection(pages) {
    const section = document.createElement('section');
    section.className = 'seo-pages-section';
    section.id = 'guias-recursos';
    
    const cardsHtml = pages.map(createPageCard).join('');
    
    section.innerHTML = `
      <div class="seo-pages-container">
        <h2>Guias y Recursos</h2>
        <p class="section-subtitle">Todo lo que necesitas saber sobre embarcaciones, importacion y el mundo nautico en Chile</p>
        
        <div class="seo-pages-grid">
          ${cardsHtml}
        </div>
        
        <p class="seo-pages-count">${pages.length} guias disponibles</p>
      </div>
    `;
    
    return section;
  }

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

  async function loadAndInsertSection() {
    if (window.location.pathname.includes('/panel')) return;
    
    const existingSection = document.getElementById('guias-recursos');
    if (existingSection) existingSection.remove();
    
    try {
      const response = await fetch('/assets/seo/seo-pages.json');
      if (!response.ok) throw new Error('Failed to load seo-pages.json');
      
      const data = await response.json();
      if (!data.pages || data.pages.length === 0) {
        console.warn('[SEO Pages Section] No pages found in seo-pages.json');
        return;
      }
      
      const checkInterval = setInterval(function() {
        const contactoSection = findSectionByHeading('CONTACTO') || findSectionByHeading('CONTACTANOS');
        const footerElement = document.querySelector('footer');
        
        let insertPoint = null;
        
        if (contactoSection) {
          insertPoint = contactoSection;
        } else if (footerElement) {
          insertPoint = footerElement;
        }
        
        if (insertPoint) {
          clearInterval(checkInterval);
          
          addStyles();
          const section = createSection(data.pages);
          insertPoint.parentNode.insertBefore(section, insertPoint);
          
          console.log('[SEO Pages Section] Successfully inserted with ' + data.pages.length + ' pages');
        }
      }, 500);
      
      setTimeout(function() {
        clearInterval(checkInterval);
      }, 15000);
      
    } catch (error) {
      console.error('[SEO Pages Section] Error loading pages:', error);
    }
  }

  onReady(function() {
    setTimeout(function() {
      loadAndInsertSection();
    }, 2000);
  });

})();
