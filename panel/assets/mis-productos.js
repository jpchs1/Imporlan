/**
 * Mis Productos/Servicios Module - Imporlan Panel
 * Standalone JavaScript module for displaying user's contracted products/services
 */

(function() {
    'use strict';

    const API_BASE = '/api';
    const PANEL_URL = 'https://www.imporlan.cl/panel';

    // Status badge colors
    const STATUS_COLORS = {
        'activo': { bg: '#10b981', text: '#ffffff' },
        'en_proceso': { bg: '#f59e0b', text: '#ffffff' },
        'finalizado': { bg: '#6366f1', text: '#ffffff' },
        'vencido': { bg: '#ef4444', text: '#ffffff' }
    };

    const STATUS_LABELS = {
        'activo': 'Activo',
        'en_proceso': 'En proceso',
        'finalizado': 'Finalizado',
        'vencido': 'Vencido'
    };

    // Payment method icons
    const PAYMENT_ICONS = {
        'PayPal': 'paypal',
        'MercadoPago': 'mercadopago',
        'WebPay': 'webpay',
        'Transferencia': 'bank'
    };

    class MisProductosModule {
        constructor() {
            this.products = [];
            this.viewMode = 'cards'; // 'cards' or 'table'
            this.container = null;
            this.userId = null;
        }

        async init() {
            // Get user ID from localStorage or session
            this.userId = this.getUserId();
            
            if (!this.userId) {
                console.log('MisProductos: No user logged in');
                return;
            }

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.render());
            } else {
                this.render();
            }
        }

        getUserId() {
            // Try to get user ID from various sources
            try {
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    return user.id || user.uid || user.user_id;
                }
                
                // Try Firebase auth
                if (window.firebase && window.firebase.auth) {
                    const currentUser = window.firebase.auth().currentUser;
                    if (currentUser) {
                        return currentUser.uid;
                    }
                }
            } catch (e) {
                console.error('Error getting user ID:', e);
            }
            return null;
        }

        async fetchProducts() {
            try {
                const response = await fetch(`${API_BASE}/user_products.php?action=list&user_id=${this.userId}`);
                const data = await response.json();
                
                if (data.success) {
                    this.products = data.products || [];
                } else {
                    console.error('Error fetching products:', data.error);
                    this.products = [];
                }
            } catch (error) {
                console.error('Error fetching products:', error);
                this.products = [];
            }
        }

        async render() {
            // Find or create container
            this.container = document.getElementById('mis-productos-container');
            
            if (!this.container) {
                // Try to inject into the main content area
                const mainContent = document.querySelector('.main-content, main, #root > div > div');
                if (mainContent) {
                    this.container = document.createElement('div');
                    this.container.id = 'mis-productos-container';
                    mainContent.insertBefore(this.container, mainContent.firstChild);
                } else {
                    console.log('MisProductos: Could not find container');
                    return;
                }
            }

            // Show loading state
            this.container.innerHTML = this.renderSkeleton();

            // Fetch products
            await this.fetchProducts();

            // Render content
            this.container.innerHTML = this.renderContent();

            // Attach event listeners
            this.attachEventListeners();
        }

        renderSkeleton() {
            return `
                <div class="mis-productos-section" style="${this.getSectionStyles()}">
                    <div class="mis-productos-header" style="${this.getHeaderStyles()}">
                        <h2 style="${this.getTitleStyles()}">Mis Productos / Servicios Contratados</h2>
                    </div>
                    <div class="mis-productos-grid" style="${this.getGridStyles()}">
                        ${[1, 2, 3].map(() => `
                            <div class="skeleton-card" style="${this.getSkeletonCardStyles()}">
                                <div class="skeleton-line" style="${this.getSkeletonLineStyles('60%')}"></div>
                                <div class="skeleton-line" style="${this.getSkeletonLineStyles('40%')}"></div>
                                <div class="skeleton-line" style="${this.getSkeletonLineStyles('80%')}"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        renderContent() {
            if (this.products.length === 0) {
                return this.renderEmptyState();
            }

            return `
                <div class="mis-productos-section" style="${this.getSectionStyles()}">
                    <div class="mis-productos-header" style="${this.getHeaderStyles()}">
                        <h2 style="${this.getTitleStyles()}">Mis Productos / Servicios Contratados</h2>
                        <div class="view-toggle" style="${this.getToggleContainerStyles()}">
                            <button class="toggle-btn ${this.viewMode === 'cards' ? 'active' : ''}" data-view="cards" style="${this.getToggleBtnStyles(this.viewMode === 'cards')}">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
                            </button>
                            <button class="toggle-btn ${this.viewMode === 'table' ? 'active' : ''}" data-view="table" style="${this.getToggleBtnStyles(this.viewMode === 'table')}">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/></svg>
                            </button>
                        </div>
                    </div>
                    ${this.viewMode === 'cards' ? this.renderCards() : this.renderTable()}
                </div>
            `;
        }

        renderEmptyState() {
            return `
                <div class="mis-productos-section" style="${this.getSectionStyles()}">
                    <div class="mis-productos-header" style="${this.getHeaderStyles()}">
                        <h2 style="${this.getTitleStyles()}">Mis Productos / Servicios Contratados</h2>
                    </div>
                    <div class="empty-state" style="${this.getEmptyStateStyles()}">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
                            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                        <h3 style="margin: 20px 0 10px; color: #1a365d; font-size: 20px;">No tienes productos contratados</h3>
                        <p style="margin: 0 0 25px; color: #64748b; font-size: 16px;">Explora nuestros planes y servicios para comenzar</p>
                        <a href="${PANEL_URL}/planes" class="cta-button" style="${this.getCtaButtonStyles()}">
                            Explorar planes
                        </a>
                    </div>
                </div>
            `;
        }

        renderCards() {
            return `
                <div class="mis-productos-grid" style="${this.getGridStyles()}">
                    ${this.products.map(product => this.renderCard(product)).join('')}
                </div>
            `;
        }

        renderCard(product) {
            const statusColor = STATUS_COLORS[product.status] || STATUS_COLORS['en_proceso'];
            const statusLabel = STATUS_LABELS[product.status] || product.status;
            
            return `
                <div class="product-card" style="${this.getCardStyles()}" data-product-id="${product.id}">
                    <div class="card-header" style="${this.getCardHeaderStyles()}">
                        <h3 style="${this.getCardTitleStyles()}">${this.escapeHtml(product.product_name)}</h3>
                        <span class="status-badge" style="${this.getBadgeStyles(statusColor)}">${statusLabel}</span>
                    </div>
                    <div class="card-body" style="${this.getCardBodyStyles()}">
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Tipo:</span>
                            <span class="value" style="${this.getValueStyles()}">${this.escapeHtml(product.product_type)}</span>
                        </div>
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Fecha contratación:</span>
                            <span class="value" style="${this.getValueStyles()}">${this.formatDate(product.start_date)}</span>
                        </div>
                        ${product.end_date ? `
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Fecha expiración:</span>
                            <span class="value" style="${this.getValueStyles()}">${this.formatDate(product.end_date)}</span>
                        </div>
                        ` : ''}
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Monto:</span>
                            <span class="value amount" style="${this.getAmountStyles()}">${this.formatCurrency(product.price, product.currency)}</span>
                        </div>
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Método de pago:</span>
                            <span class="value" style="${this.getValueStyles()}">${this.escapeHtml(product.payment_method)}</span>
                        </div>
                        <div class="info-row" style="${this.getInfoRowStyles()}">
                            <span class="label" style="${this.getLabelStyles()}">Referencia:</span>
                            <span class="value mono" style="${this.getMonoStyles()}">${this.escapeHtml(product.payment_reference || 'N/A')}</span>
                        </div>
                    </div>
                    <div class="card-actions" style="${this.getCardActionsStyles()}">
                        <button class="action-btn" data-action="detail" data-id="${product.id}" style="${this.getActionBtnStyles()}">
                            Ver detalle
                        </button>
                        <button class="action-btn" data-action="tracking" data-id="${product.id}" style="${this.getActionBtnStyles()}">
                            Seguimiento
                        </button>
                        <button class="action-btn secondary" data-action="support" style="${this.getActionBtnStyles(true)}">
                            Soporte
                        </button>
                    </div>
                </div>
            `;
        }

        renderTable() {
            return `
                <div class="table-container" style="${this.getTableContainerStyles()}">
                    <table style="${this.getTableStyles()}">
                        <thead>
                            <tr>
                                <th style="${this.getThStyles()}">Producto</th>
                                <th style="${this.getThStyles()}">Tipo</th>
                                <th style="${this.getThStyles()}">Estado</th>
                                <th style="${this.getThStyles()}">Fecha</th>
                                <th style="${this.getThStyles()}">Monto</th>
                                <th style="${this.getThStyles()}">Método</th>
                                <th style="${this.getThStyles()}">Referencia</th>
                                <th style="${this.getThStyles()}">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.products.map(product => this.renderTableRow(product)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        renderTableRow(product) {
            const statusColor = STATUS_COLORS[product.status] || STATUS_COLORS['en_proceso'];
            const statusLabel = STATUS_LABELS[product.status] || product.status;
            
            return `
                <tr style="${this.getTrStyles()}" data-product-id="${product.id}">
                    <td style="${this.getTdStyles()}">${this.escapeHtml(product.product_name)}</td>
                    <td style="${this.getTdStyles()}">${this.escapeHtml(product.product_type)}</td>
                    <td style="${this.getTdStyles()}">
                        <span class="status-badge" style="${this.getBadgeStyles(statusColor)}">${statusLabel}</span>
                    </td>
                    <td style="${this.getTdStyles()}">${this.formatDate(product.start_date)}</td>
                    <td style="${this.getTdStyles()}; ${this.getAmountStyles()}">${this.formatCurrency(product.price, product.currency)}</td>
                    <td style="${this.getTdStyles()}">${this.escapeHtml(product.payment_method)}</td>
                    <td style="${this.getTdStyles()}; font-family: monospace; font-size: 12px;">${this.escapeHtml(product.payment_reference || 'N/A')}</td>
                    <td style="${this.getTdStyles()}">
                        <div style="display: flex; gap: 8px;">
                            <button class="action-btn small" data-action="detail" data-id="${product.id}" style="${this.getSmallActionBtnStyles()}">Ver</button>
                            <button class="action-btn small" data-action="tracking" data-id="${product.id}" style="${this.getSmallActionBtnStyles()}">Seguir</button>
                        </div>
                    </td>
                </tr>
            `;
        }

        attachEventListeners() {
            // View toggle buttons
            const toggleBtns = this.container.querySelectorAll('.toggle-btn');
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const view = e.currentTarget.dataset.view;
                    if (view !== this.viewMode) {
                        this.viewMode = view;
                        this.container.innerHTML = this.renderContent();
                        this.attachEventListeners();
                    }
                });
            });

            // Action buttons
            const actionBtns = this.container.querySelectorAll('.action-btn');
            actionBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.action;
                    const productId = e.currentTarget.dataset.id;
                    this.handleAction(action, productId);
                });
            });
        }

        handleAction(action, productId) {
            switch (action) {
                case 'detail':
                    window.location.href = `${PANEL_URL}/mis-productos/${productId}`;
                    break;
                case 'tracking':
                    window.location.href = `${PANEL_URL}/seguimiento/${productId}`;
                    break;
                case 'support':
                    window.location.href = 'mailto:contacto@imporlan.cl?subject=Soporte - Mis Productos';
                    break;
                default:
                    console.log('Unknown action:', action);
            }
        }

        // Utility methods
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        formatCurrency(amount, currency) {
            const num = parseFloat(amount);
            if (currency === 'USD') {
                return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
            }
            return `$${num.toLocaleString('es-CL')} CLP`;
        }

        // Styles
        getSectionStyles() {
            return `
                background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%);
                border-radius: 16px;
                padding: 30px;
                margin: 20px 0;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;
        }

        getHeaderStyles() {
            return `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
                flex-wrap: wrap;
                gap: 15px;
            `;
        }

        getTitleStyles() {
            return `
                margin: 0;
                color: #00d4ff;
                font-size: 24px;
                font-weight: 700;
            `;
        }

        getToggleContainerStyles() {
            return `
                display: flex;
                gap: 8px;
                background: rgba(255, 255, 255, 0.1);
                padding: 4px;
                border-radius: 8px;
            `;
        }

        getToggleBtnStyles(isActive) {
            return `
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${isActive ? '#00d4ff' : 'transparent'};
                color: ${isActive ? '#0a1628' : '#94a3b8'};
            `;
        }

        getGridStyles() {
            return `
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 20px;
            `;
        }

        getCardStyles() {
            return `
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                overflow: hidden;
                transition: transform 0.2s, box-shadow 0.2s;
            `;
        }

        getCardHeaderStyles() {
            return `
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding: 20px;
                background: rgba(0, 212, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            `;
        }

        getCardTitleStyles() {
            return `
                margin: 0;
                color: #ffffff;
                font-size: 18px;
                font-weight: 600;
                flex: 1;
                padding-right: 10px;
            `;
        }

        getBadgeStyles(color) {
            return `
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                background: ${color.bg};
                color: ${color.text};
                white-space: nowrap;
            `;
        }

        getCardBodyStyles() {
            return `
                padding: 20px;
            `;
        }

        getInfoRowStyles() {
            return `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            `;
        }

        getLabelStyles() {
            return `
                color: #94a3b8;
                font-size: 14px;
            `;
        }

        getValueStyles() {
            return `
                color: #ffffff;
                font-size: 14px;
                font-weight: 500;
                text-align: right;
            `;
        }

        getAmountStyles() {
            return `
                color: #00d4ff;
                font-size: 16px;
                font-weight: 700;
            `;
        }

        getMonoStyles() {
            return `
                color: #ffffff;
                font-size: 12px;
                font-family: monospace;
                text-align: right;
            `;
        }

        getCardActionsStyles() {
            return `
                display: flex;
                gap: 10px;
                padding: 15px 20px;
                background: rgba(0, 0, 0, 0.2);
                flex-wrap: wrap;
            `;
        }

        getActionBtnStyles(isSecondary = false) {
            return `
                flex: 1;
                min-width: 80px;
                padding: 10px 15px;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                background: ${isSecondary ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)'};
                color: ${isSecondary ? '#94a3b8' : '#ffffff'};
            `;
        }

        getSmallActionBtnStyles() {
            return `
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
                color: #ffffff;
            `;
        }

        getTableContainerStyles() {
            return `
                overflow-x: auto;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
            `;
        }

        getTableStyles() {
            return `
                width: 100%;
                border-collapse: collapse;
                min-width: 800px;
            `;
        }

        getThStyles() {
            return `
                padding: 15px;
                text-align: left;
                color: #00d4ff;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                background: rgba(0, 212, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            `;
        }

        getTrStyles() {
            return `
                transition: background 0.2s;
            `;
        }

        getTdStyles() {
            return `
                padding: 15px;
                color: #ffffff;
                font-size: 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            `;
        }

        getEmptyStateStyles() {
            return `
                text-align: center;
                padding: 60px 20px;
            `;
        }

        getCtaButtonStyles() {
            return `
                display: inline-block;
                padding: 14px 30px;
                background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 14px rgba(0, 212, 255, 0.4);
            `;
        }

        getSkeletonCardStyles() {
            return `
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                padding: 25px;
                min-height: 200px;
            `;
        }

        getSkeletonLineStyles(width) {
            return `
                height: 20px;
                background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
                border-radius: 4px;
                margin-bottom: 15px;
                width: ${width};
            `;
        }
    }

    // Add shimmer animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .product-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 30px rgba(0, 212, 255, 0.2);
        }
        
        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
        }
        
        .toggle-btn:hover {
            background: rgba(0, 212, 255, 0.2);
            color: #00d4ff;
        }
        
        .toggle-btn.active:hover {
            background: #00d4ff;
            color: #0a1628;
        }
        
        tr:hover {
            background: rgba(0, 212, 255, 0.05);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 212, 255, 0.5);
        }
        
        @media (max-width: 768px) {
            .mis-productos-grid {
                grid-template-columns: 1fr !important;
            }
            
            .mis-productos-header {
                flex-direction: column;
                align-items: flex-start !important;
            }
            
            .card-actions {
                flex-direction: column;
            }
            
            .action-btn {
                width: 100% !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize module
    window.MisProductosModule = MisProductosModule;
    
    // Auto-initialize if on the right page
    if (window.location.pathname.includes('/panel') || window.location.pathname.includes('/mis-productos')) {
        const module = new MisProductosModule();
        module.init();
    }
})();
