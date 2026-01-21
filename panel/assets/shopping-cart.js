/**
 * Shopping Cart for Imporlan Panel
 * Allows users to add multiple plans and products to a cart
 * Integrates with PayPal and MercadoPago for checkout
 */

(function() {
  'use strict';

  // Cart state
  let cart = {
    items: [],
    total: 0,
    totalUSD: 0
  };

  // Products/Plans catalog
  const CATALOG = {
    plans: [
      {
        id: 'fragata',
        name: 'Plan Fragata',
        description: 'Monitoreo por 7 dias - 5 propuestas',
        price: 67600,
        priceUSD: 67.60,
        currency: 'CLP',
        type: 'plan'
      },
      {
        id: 'capitan',
        name: 'Plan Capitan de Navio',
        description: 'Monitoreo por 14 dias - 9 propuestas',
        price: 119600,
        priceUSD: 119.60,
        currency: 'CLP',
        type: 'plan'
      },
      {
        id: 'almirante',
        name: 'Plan Almirante',
        description: 'Monitoreo por 21 dias - 15 propuestas',
        price: 189600,
        priceUSD: 189.60,
        currency: 'CLP',
        type: 'plan'
      }
    ],
    services: [
      {
        id: 'inspeccion',
        name: 'Inspeccion Adicional',
        description: 'Inspeccion detallada de embarcacion',
        price: 50000,
        priceUSD: 50.00,
        currency: 'CLP',
        type: 'service'
      },
      {
        id: 'asesoria',
        name: 'Asesoria Premium',
        description: 'Asesoria personalizada 1 hora',
        price: 35000,
        priceUSD: 35.00,
        currency: 'CLP',
        type: 'service'
      }
    ]
  };

  // API Base URL
  const API_BASE = 'https://www.imporlan.cl/api';

  // Load cart from localStorage
  function loadCart() {
    try {
      const saved = localStorage.getItem('imporlan_cart');
      if (saved) {
        cart = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading cart:', e);
    }
    updateCartUI();
  }

  // Save cart to localStorage
  function saveCart() {
    try {
      localStorage.setItem('imporlan_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }

  // Calculate totals
  function calculateTotals() {
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.totalUSD = cart.items.reduce((sum, item) => sum + (item.priceUSD * item.quantity), 0);
  }

  // Add item to cart
  function addToCart(item) {
    const existingIndex = cart.items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += 1;
    } else {
      cart.items.push({ ...item, quantity: 1 });
    }
    calculateTotals();
    saveCart();
    updateCartUI();
    showNotification(`${item.name} agregado al carrito`);
  }

  // Remove item from cart
  function removeFromCart(itemId) {
    cart.items = cart.items.filter(item => item.id !== itemId);
    calculateTotals();
    saveCart();
    updateCartUI();
  }

  // Update item quantity
  function updateQuantity(itemId, quantity) {
    const item = cart.items.find(i => i.id === itemId);
    if (item) {
      if (quantity <= 0) {
        removeFromCart(itemId);
      } else {
        item.quantity = quantity;
        calculateTotals();
        saveCart();
        updateCartUI();
      }
    }
  }

  // Clear cart
  function clearCart() {
    cart.items = [];
    cart.total = 0;
    cart.totalUSD = 0;
    saveCart();
    updateCartUI();
  }

  // Format price
  function formatPrice(price, currency = 'CLP') {
    if (currency === 'USD') {
      return `$${price.toFixed(2)} USD`;
    }
    return `$${price.toLocaleString('es-CL')} CLP`;
  }

  // Show notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'imporlan-cart-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  // Create cart UI
  function createCartUI() {
    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      .imporlan-cart-icon {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(8, 145, 178, 0.4);
        z-index: 9999;
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .imporlan-cart-icon:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(8, 145, 178, 0.6);
      }
      .imporlan-cart-icon svg {
        width: 28px;
        height: 28px;
        fill: white;
      }
      .imporlan-cart-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        font-size: 12px;
        font-weight: bold;
        min-width: 22px;
        height: 22px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
      }
      .imporlan-cart-panel {
        position: fixed;
        top: 0;
        right: -420px;
        width: 400px;
        max-width: 100vw;
        height: 100vh;
        background: #0f172a;
        box-shadow: -5px 0 30px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      .imporlan-cart-panel.open {
        right: 0;
      }
      .imporlan-cart-header {
        padding: 20px;
        background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .imporlan-cart-header h2 {
        color: white;
        font-size: 20px;
        font-weight: bold;
        margin: 0;
      }
      .imporlan-cart-close {
        background: none;
        border: none;
        color: white;
        font-size: 28px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .imporlan-cart-items {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
      }
      .imporlan-cart-item {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .imporlan-cart-item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .imporlan-cart-item-name {
        color: white;
        font-weight: 600;
        font-size: 16px;
      }
      .imporlan-cart-item-remove {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
      }
      .imporlan-cart-item-desc {
        color: #94a3b8;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .imporlan-cart-item-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .imporlan-cart-item-price {
        color: #22d3ee;
        font-weight: bold;
        font-size: 16px;
      }
      .imporlan-cart-quantity {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .imporlan-cart-quantity button {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .imporlan-cart-quantity button:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .imporlan-cart-quantity span {
        color: white;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
      }
      .imporlan-cart-empty {
        text-align: center;
        padding: 40px 20px;
        color: #94a3b8;
      }
      .imporlan-cart-empty svg {
        width: 60px;
        height: 60px;
        fill: #475569;
        margin-bottom: 15px;
      }
      .imporlan-cart-footer {
        padding: 20px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      .imporlan-cart-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      .imporlan-cart-total-label {
        color: #94a3b8;
        font-size: 16px;
      }
      .imporlan-cart-total-value {
        color: white;
        font-size: 24px;
        font-weight: bold;
      }
      .imporlan-cart-total-usd {
        color: #22d3ee;
        font-size: 14px;
        text-align: right;
      }
      .imporlan-cart-checkout {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .imporlan-cart-btn {
        padding: 14px 20px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: transform 0.2s, opacity 0.2s;
      }
      .imporlan-cart-btn:hover {
        transform: translateY(-2px);
      }
      .imporlan-cart-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .imporlan-cart-btn-paypal {
        background: #0070ba;
        color: white;
      }
      .imporlan-cart-btn-mercadopago {
        background: #009ee3;
        color: white;
      }
      .imporlan-cart-btn-clear {
        background: transparent;
        color: #ef4444;
        border: 1px solid #ef4444;
        padding: 10px;
        font-size: 14px;
      }
      .imporlan-cart-notification {
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10001;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s, transform 0.3s;
      }
      .imporlan-cart-notification.show {
        opacity: 1;
        transform: translateY(0);
      }
      .imporlan-cart-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
      }
      .imporlan-cart-overlay.show {
        opacity: 1;
        visibility: visible;
      }
      .imporlan-add-to-cart-btn {
        background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .imporlan-add-to-cart-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(8, 145, 178, 0.4);
      }
      .imporlan-add-to-cart-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .imporlan-products-section {
        padding: 20px;
        background: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 10px;
      }
      .imporlan-products-title {
        color: #22d3ee;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .imporlan-product-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .imporlan-product-info {
        flex: 1;
      }
      .imporlan-product-name {
        color: white;
        font-weight: 500;
        font-size: 14px;
      }
      .imporlan-product-price {
        color: #22d3ee;
        font-size: 13px;
      }
    `;
    document.head.appendChild(styles);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'imporlan-cart-overlay';
    overlay.onclick = closeCartPanel;
    document.body.appendChild(overlay);

    // Create cart icon
    const cartIcon = document.createElement('div');
    cartIcon.className = 'imporlan-cart-icon';
    cartIcon.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
      <span class="imporlan-cart-badge" id="cart-badge">0</span>
    `;
    cartIcon.onclick = toggleCartPanel;
    document.body.appendChild(cartIcon);

    // Create cart panel
    const cartPanel = document.createElement('div');
    cartPanel.className = 'imporlan-cart-panel';
    cartPanel.id = 'cart-panel';
    cartPanel.innerHTML = `
      <div class="imporlan-cart-header">
        <h2>Carrito de Compras</h2>
        <button class="imporlan-cart-close" onclick="window.ImporlanCart.close()">&times;</button>
      </div>
      <div class="imporlan-cart-items" id="cart-items">
        <!-- Items will be rendered here -->
      </div>
      <div class="imporlan-products-section">
        <div class="imporlan-products-title">Agregar Servicios</div>
        <div id="cart-products">
          <!-- Products will be rendered here -->
        </div>
      </div>
      <div class="imporlan-cart-footer">
        <div class="imporlan-cart-total">
          <span class="imporlan-cart-total-label">Total:</span>
          <div>
            <div class="imporlan-cart-total-value" id="cart-total">$0 CLP</div>
            <div class="imporlan-cart-total-usd" id="cart-total-usd">~$0.00 USD</div>
          </div>
        </div>
        <div class="imporlan-cart-checkout">
          <button class="imporlan-cart-btn imporlan-cart-btn-mercadopago" id="btn-mercadopago" onclick="window.ImporlanCart.checkoutMercadoPago()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Pagar con MercadoPago
          </button>
          <button class="imporlan-cart-btn imporlan-cart-btn-paypal" id="btn-paypal" onclick="window.ImporlanCart.checkoutPayPal()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.93 12.99h2.06c2.44 0 4.32-1.63 4.87-3.87.07-.27.11-.55.11-.84 0-2.34-1.9-4.24-4.24-4.24H7.97c-.48 0-.89.35-.97.82L5.5 16.73c-.05.29.17.55.47.55h2.11l1.85-4.29z"/>
            </svg>
            Pagar con PayPal
          </button>
          <button class="imporlan-cart-btn imporlan-cart-btn-clear" id="btn-clear" onclick="window.ImporlanCart.clear()">
            Vaciar Carrito
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(cartPanel);

    // Render products in the panel
    renderProducts();
  }

  // Render products section
  function renderProducts() {
    const container = document.getElementById('cart-products');
    if (!container) return;

    let html = '';
    
    // Add plans
    CATALOG.plans.forEach(plan => {
      html += `
        <div class="imporlan-product-card">
          <div class="imporlan-product-info">
            <div class="imporlan-product-name">${plan.name}</div>
            <div class="imporlan-product-price">${formatPrice(plan.price)}</div>
          </div>
          <button class="imporlan-add-to-cart-btn" onclick="window.ImporlanCart.addPlan('${plan.id}')">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Agregar
          </button>
        </div>
      `;
    });

    // Add services
    CATALOG.services.forEach(service => {
      html += `
        <div class="imporlan-product-card">
          <div class="imporlan-product-info">
            <div class="imporlan-product-name">${service.name}</div>
            <div class="imporlan-product-price">${formatPrice(service.price)}</div>
          </div>
          <button class="imporlan-add-to-cart-btn" onclick="window.ImporlanCart.addService('${service.id}')">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Agregar
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Toggle cart panel
  function toggleCartPanel() {
    const panel = document.getElementById('cart-panel');
    const overlay = document.querySelector('.imporlan-cart-overlay');
    if (panel) {
      panel.classList.toggle('open');
      overlay.classList.toggle('show');
    }
  }

  // Close cart panel
  function closeCartPanel() {
    const panel = document.getElementById('cart-panel');
    const overlay = document.querySelector('.imporlan-cart-overlay');
    if (panel) {
      panel.classList.remove('open');
      overlay.classList.remove('show');
    }
  }

  // Update cart UI
  function updateCartUI() {
    // Update badge
    const badge = document.getElementById('cart-badge');
    if (badge) {
      const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      badge.textContent = totalItems;
      badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // Update items list
    const itemsContainer = document.getElementById('cart-items');
    if (itemsContainer) {
      if (cart.items.length === 0) {
        itemsContainer.innerHTML = `
          <div class="imporlan-cart-empty">
            <svg viewBox="0 0 24 24">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <p>Tu carrito esta vacio</p>
            <p style="font-size: 13px;">Agrega planes o servicios para comenzar</p>
          </div>
        `;
      } else {
        let html = '';
        cart.items.forEach(item => {
          html += `
            <div class="imporlan-cart-item">
              <div class="imporlan-cart-item-header">
                <span class="imporlan-cart-item-name">${item.name}</span>
                <button class="imporlan-cart-item-remove" onclick="window.ImporlanCart.remove('${item.id}')">&times;</button>
              </div>
              <div class="imporlan-cart-item-desc">${item.description}</div>
              <div class="imporlan-cart-item-footer">
                <span class="imporlan-cart-item-price">${formatPrice(item.price * item.quantity)}</span>
                <div class="imporlan-cart-quantity">
                  <button onclick="window.ImporlanCart.updateQty('${item.id}', ${item.quantity - 1})">-</button>
                  <span>${item.quantity}</span>
                  <button onclick="window.ImporlanCart.updateQty('${item.id}', ${item.quantity + 1})">+</button>
                </div>
              </div>
            </div>
          `;
        });
        itemsContainer.innerHTML = html;
      }
    }

    // Update totals
    const totalEl = document.getElementById('cart-total');
    const totalUsdEl = document.getElementById('cart-total-usd');
    if (totalEl) {
      totalEl.textContent = formatPrice(cart.total);
    }
    if (totalUsdEl) {
      totalUsdEl.textContent = `~${formatPrice(cart.totalUSD, 'USD')}`;
    }

    // Update button states
    const btnMercadoPago = document.getElementById('btn-mercadopago');
    const btnPayPal = document.getElementById('btn-paypal');
    const btnClear = document.getElementById('btn-clear');
    const hasItems = cart.items.length > 0;
    
    if (btnMercadoPago) btnMercadoPago.disabled = !hasItems;
    if (btnPayPal) btnPayPal.disabled = !hasItems;
    if (btnClear) btnClear.disabled = !hasItems;
  }

  // Checkout with MercadoPago
  async function checkoutMercadoPago() {
    if (cart.items.length === 0) return;

    const btn = document.getElementById('btn-mercadopago');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Procesando...</span>';
    }

    try {
      // Create cart preference
      const response = await fetch(`${API_BASE}/cart/mercadopago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items,
          total: cart.total
        })
      });

      const data = await response.json();
      
      if (data.success && data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || 'Error al procesar el pago');
      }
    } catch (error) {
      console.error('MercadoPago checkout error:', error);
      showNotification('Error al procesar el pago. Intenta de nuevo.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Pagar con MercadoPago
        `;
      }
    }
  }

  // Checkout with PayPal
  async function checkoutPayPal() {
    if (cart.items.length === 0) return;

    const btn = document.getElementById('btn-paypal');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Procesando...</span>';
    }

    try {
      // Create cart order
      const response = await fetch(`${API_BASE}/cart/paypal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items,
          totalUSD: cart.totalUSD
        })
      });

      const data = await response.json();
      
      if (data.success && data.approval_url) {
        window.location.href = data.approval_url;
      } else {
        throw new Error(data.error || 'Error al procesar el pago');
      }
    } catch (error) {
      console.error('PayPal checkout error:', error);
      showNotification('Error al procesar el pago. Intenta de nuevo.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.93 12.99h2.06c2.44 0 4.32-1.63 4.87-3.87.07-.27.11-.55.11-.84 0-2.34-1.9-4.24-4.24-4.24H7.97c-.48 0-.89.35-.97.82L5.5 16.73c-.05.29.17.55.47.55h2.11l1.85-4.29z"/>
          </svg>
          Pagar con PayPal
        `;
      }
    }
  }

  // Add plan to cart
  function addPlan(planId) {
    const plan = CATALOG.plans.find(p => p.id === planId);
    if (plan) {
      addToCart(plan);
    }
  }

  // Add service to cart
  function addService(serviceId) {
    const service = CATALOG.services.find(s => s.id === serviceId);
    if (service) {
      addToCart(service);
    }
  }

  // Initialize
  function init() {
    createCartUI();
    loadCart();
    
    // Expose global API
    window.ImporlanCart = {
      add: addToCart,
      addPlan: addPlan,
      addService: addService,
      remove: removeFromCart,
      updateQty: updateQuantity,
      clear: clearCart,
      toggle: toggleCartPanel,
      close: closeCartPanel,
      getCart: () => cart,
      CATALOG: CATALOG,
      checkoutMercadoPago: checkoutMercadoPago,
      checkoutPayPal: checkoutPayPal
    };

    console.log('Imporlan Shopping Cart initialized');
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();