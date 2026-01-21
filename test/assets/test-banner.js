/**
 * TEST Environment Banner - Imporlan
 * Shows a visible banner indicating this is a test environment
 */
(function() {
    // Only show in /test/ paths
    if (!window.location.pathname.startsWith('/test')) {
        return;
    }
    
    // Create banner element
    const banner = document.createElement('div');
    banner.id = 'test-environment-banner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(90deg, #ff6b00, #ff8c00, #ff6b00);
            color: white;
            text-align: center;
            padding: 8px 15px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            z-index: 999999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        ">
            <span style="font-size: 16px;">⚠️</span>
            <span>AMBIENTE DE PRUEBA – CAMBIOS NO DEFINITIVOS</span>
            <span style="font-size: 16px;">⚠️</span>
        </div>
    `;
    
    // Add banner to page
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Add padding to body to prevent content overlap
    document.body.style.paddingTop = '40px';
    
    // Also add to any fixed headers
    const style = document.createElement('style');
    style.textContent = `
        #test-environment-banner + * {
            margin-top: 0 !important;
        }
        header, nav, .navbar, .header {
            top: 40px !important;
        }
    `;
    document.head.appendChild(style);
    
    console.log('[TEST MODE] Ambiente de prueba activo - Los cambios aquí no afectan producción');
})();