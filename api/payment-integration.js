/**
 * Imporlan Payment Integration
 * 
 * Este archivo proporciona funciones para integrar PayPal y MercadoPago
 * en las aplicaciones de Imporlan.
 * 
 * Uso:
 * 1. Incluir este script en el HTML
 * 2. Llamar a ImporlanPayments.init() para inicializar
 * 3. Usar ImporlanPayments.payWithPayPal() o ImporlanPayments.payWithMercadoPago()
 */

const ImporlanPayments = {
    // URL base de la API (ajustar según la ubicación de los archivos PHP)
    apiBaseUrl: '/api',
    
    // Configuración cargada desde el servidor
    paypalClientId: null,
    mpPublicKey: null,
    environment: 'sandbox',
    
    // Estado de inicialización
    initialized: false,
    paypalLoaded: false,
    mpLoaded: false,

    /**
     * Inicializar el sistema de pagos
     */
    async init(options = {}) {
        if (this.initialized) return;
        
        this.apiBaseUrl = options.apiBaseUrl || this.apiBaseUrl;
        
        try {
            // Cargar configuración de PayPal
            const paypalConfig = await this.fetchJson(`${this.apiBaseUrl}/paypal.php?action=get_client_id`);
            this.paypalClientId = paypalConfig.client_id;
            this.environment = paypalConfig.environment;
            
            // Cargar configuración de MercadoPago
            const mpConfig = await this.fetchJson(`${this.apiBaseUrl}/mercadopago.php?action=get_public_key`);
            this.mpPublicKey = mpConfig.public_key;
            
            this.initialized = true;
            console.log('ImporlanPayments inicializado correctamente');
            console.log('Ambiente:', this.environment);
            
            return true;
        } catch (error) {
            console.error('Error al inicializar ImporlanPayments:', error);
            return false;
        }
    },

    /**
     * Cargar el SDK de PayPal
     */
    async loadPayPalSDK() {
        if (this.paypalLoaded) return true;
        if (!this.paypalClientId) {
            console.error('PayPal Client ID no configurado');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${this.paypalClientId}&currency=USD`;
            script.onload = () => {
                this.paypalLoaded = true;
                resolve(true);
            };
            script.onerror = () => reject(new Error('Error al cargar PayPal SDK'));
            document.head.appendChild(script);
        });
    },

    /**
     * Cargar el SDK de MercadoPago
     */
    async loadMercadoPagoSDK() {
        if (this.mpLoaded) return true;
        if (!this.mpPublicKey) {
            console.error('MercadoPago Public Key no configurada');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://sdk.mercadopago.com/js/v2';
            script.onload = () => {
                this.mpLoaded = true;
                resolve(true);
            };
            script.onerror = () => reject(new Error('Error al cargar MercadoPago SDK'));
            document.head.appendChild(script);
        });
    },

    /**
     * Renderizar botón de PayPal en un contenedor
     * @param {string} containerId - ID del elemento donde renderizar el botón
     * @param {object} paymentData - Datos del pago (amount, description, plan_name)
     * @param {function} onSuccess - Callback cuando el pago es exitoso
     * @param {function} onError - Callback cuando hay un error
     */
    async renderPayPalButton(containerId, paymentData, onSuccess, onError) {
        await this.loadPayPalSDK();
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Contenedor no encontrado:', containerId);
            return;
        }
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'blue',
                shape: 'rect',
                label: 'paypal'
            },
            createOrder: async () => {
                try {
                    const response = await this.fetchJson(`${this.apiBaseUrl}/paypal.php?action=create_order`, {
                        method: 'POST',
                        body: JSON.stringify(paymentData)
                    });
                    
                    if (response.success) {
                        return response.order_id;
                    } else {
                        throw new Error(response.error || 'Error al crear orden');
                    }
                } catch (error) {
                    console.error('Error creando orden PayPal:', error);
                    if (onError) onError(error);
                    throw error;
                }
            },
            onApprove: async (data) => {
                try {
                    const response = await this.fetchJson(`${this.apiBaseUrl}/paypal.php?action=capture_order`, {
                        method: 'POST',
                        body: JSON.stringify({ order_id: data.orderID })
                    });
                    
                    if (response.success) {
                        console.log('Pago PayPal exitoso:', response.payment);
                        if (onSuccess) onSuccess(response.payment);
                    } else {
                        throw new Error(response.error || 'Error al capturar pago');
                    }
                } catch (error) {
                    console.error('Error capturando pago PayPal:', error);
                    if (onError) onError(error);
                }
            },
            onError: (err) => {
                console.error('Error en PayPal:', err);
                if (onError) onError(err);
            },
            onCancel: () => {
                console.log('Pago PayPal cancelado');
            }
        }).render(`#${containerId}`);
    },

    /**
     * Iniciar pago con MercadoPago
     * @param {object} paymentData - Datos del pago (amount, description, plan_name)
     * @param {function} onSuccess - Callback cuando el pago es exitoso
     * @param {function} onError - Callback cuando hay un error
     */
    async payWithMercadoPago(paymentData, onSuccess, onError) {
        await this.loadMercadoPagoSDK();
        
        try {
            // Crear preferencia de pago
            const response = await this.fetchJson(`${this.apiBaseUrl}/mercadopago.php?action=create_preference`, {
                method: 'POST',
                body: JSON.stringify(paymentData)
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Error al crear preferencia');
            }
            
            // Inicializar MercadoPago
            const mp = new MercadoPago(this.mpPublicKey, {
                locale: 'es-CL'
            });
            
            // Usar el init_point según el ambiente
            const initPoint = this.environment === 'production' 
                ? response.init_point 
                : response.sandbox_init_point;
            
            // Redirigir al checkout de MercadoPago
            window.location.href = initPoint;
            
        } catch (error) {
            console.error('Error iniciando pago MercadoPago:', error);
            if (onError) onError(error);
        }
    },

    /**
     * Renderizar botón de MercadoPago en un contenedor
     * @param {string} containerId - ID del elemento donde renderizar el botón
     * @param {object} paymentData - Datos del pago
     * @param {function} onSuccess - Callback cuando el pago es exitoso
     * @param {function} onError - Callback cuando hay un error
     */
    async renderMercadoPagoButton(containerId, paymentData, onSuccess, onError) {
        await this.loadMercadoPagoSDK();
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Contenedor no encontrado:', containerId);
            return;
        }
        
        try {
            // Crear preferencia de pago
            const response = await this.fetchJson(`${this.apiBaseUrl}/mercadopago.php?action=create_preference`, {
                method: 'POST',
                body: JSON.stringify(paymentData)
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Error al crear preferencia');
            }
            
            // Inicializar MercadoPago
            const mp = new MercadoPago(this.mpPublicKey, {
                locale: 'es-CL'
            });
            
            // Limpiar contenedor
            container.innerHTML = '';
            
            // Crear el botón de checkout
            mp.checkout({
                preference: {
                    id: response.preference_id
                },
                render: {
                    container: `#${containerId}`,
                    label: 'Pagar con MercadoPago'
                }
            });
            
        } catch (error) {
            console.error('Error renderizando botón MercadoPago:', error);
            if (onError) onError(error);
        }
    },

    /**
     * Verificar estado de un pago de MercadoPago
     * @param {string} paymentId - ID del pago
     */
    async checkMercadoPagoPayment(paymentId) {
        try {
            const response = await this.fetchJson(
                `${this.apiBaseUrl}/mercadopago.php?action=get_payment&payment_id=${paymentId}`
            );
            return response;
        } catch (error) {
            console.error('Error verificando pago:', error);
            return null;
        }
    },

    /**
     * Helper para hacer peticiones fetch
     */
    async fetchJson(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        return response.json();
    }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImporlanPayments;
}

// Hacer disponible globalmente
window.ImporlanPayments = ImporlanPayments;