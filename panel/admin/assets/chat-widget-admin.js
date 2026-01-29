/**
 * Chat Widget - Admin Panel
 * Imporlan Admin Panel Chat System
 * 
 * This widget provides chat functionality for admin/support staff
 * to manage and respond to user conversations.
 */

(function() {
    'use strict';

    // Configuration - Auto-detect TEST environment
    const isTestEnv = window.location.pathname.startsWith('/test/');
    const API_BASE = isTestEnv ? '/test/api/chat_api.php' : '/api/chat_api.php';
    const POLL_INTERVAL = 3000; // 3 seconds for admin (faster updates)
    const NOTIFICATION_SOUND_ENABLED_KEY = 'imporlan_admin_chat_sound_enabled';

    // State
    let currentAdmin = null;
    let conversations = [];
    let currentConversation = null;
    let messages = [];
    let userDetails = null;
    let pollTimer = null;
    let lastPollTime = null;
    let unreadCount = 0;
    let notificationSoundEnabled = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY) !== 'false';
    let currentFilter = { status: 'all', assigned: 'all' };

    // DOM Elements
    let chatContainer = null;

    // Initialize - with retry mechanism for auth detection
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 30; // Try for 30 seconds
    let initTimer = null;
    let isInitialized = false;

    function init() {
        // Get admin from localStorage (set by the admin panel app)
        // The admin panel uses 'token' key directly, not 'imporlan_admin_token'
        // Also try the user panel keys as fallback
        let userStr = localStorage.getItem('imporlan_admin_user') || localStorage.getItem('imporlan_user');
        let token = localStorage.getItem('token') || localStorage.getItem('imporlan_admin_token') || localStorage.getItem('imporlan_token');
        
        // If we have a token but no user data, try to decode the JWT to get user info
        if (token && !userStr) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                // Create a minimal user object from the JWT payload
                if (payload.role === 'admin' || payload.role === 'support') {
                    userStr = JSON.stringify({
                        id: payload.sub,
                        email: payload.email || (payload.role === 'admin' ? 'admin@imporlan.cl' : 'soporte@imporlan.cl'),
                        role: payload.role,
                        name: payload.role === 'admin' ? 'Administrador Imporlan' : 'Soporte Imporlan'
                    });
                }
            } catch (e) {
                console.log('Chat: Could not decode JWT');
            }
        }
        
        if (!userStr || !token) {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Retry after 1 second - React may not have saved auth yet
                initTimer = setTimeout(init, 1000);
                if (initAttempts === 1) {
                    console.log('Chat: Waiting for admin authentication...');
                }
                return;
            }
            console.log('Chat: Admin not authenticated after ' + MAX_INIT_ATTEMPTS + ' attempts');
            return;
        }

        // Clear any pending retry
        if (initTimer) {
            clearTimeout(initTimer);
            initTimer = null;
        }

        // Prevent double initialization
        if (isInitialized) {
            console.log('Chat: Already initialized');
            return;
        }

        try {
            currentAdmin = JSON.parse(userStr);
            currentAdmin.token = token;
        } catch (e) {
            console.error('Chat: Failed to parse admin data');
            return;
        }

        isInitialized = true;

        // Always load CSS and create floating button
        loadCSS();
        createFloatingButton();
        fetchUnreadCount();
        setInterval(fetchUnreadCount, 30000);
        
        // Check if we're on the chat page to show full interface
        if (window.location.hash === '#/chat' || window.location.pathname.includes('/chat')) {
            createChatInterface();
            fetchConversations();
            startPolling();
        }

        // Listen for hash changes
        window.addEventListener('hashchange', handleRouteChange);

        console.log('Admin chat widget initialized for:', currentAdmin.email);
    }

    // Handle route changes
    function handleRouteChange() {
        if (window.location.hash === '#/chat') {
            if (!chatContainer) {
                loadCSS();
                createChatInterface();
            }
            fetchConversations();
            startPolling();
        } else {
            stopPolling();
        }
    }

    // Load CSS
    function loadCSS() {
        if (document.getElementById('chat-widget-css')) return;
        
        const link = document.createElement('link');
        link.id = 'chat-widget-css';
        link.rel = 'stylesheet';
        // Auto-detect TEST environment for CSS path
        link.href = isTestEnv ? '/test/panel/assets/chat-widget.css' : '/panel/assets/chat-widget.css';
        document.head.appendChild(link);
    }

    // Create floating chat button for admin
    let floatingButton = null;
    let chatModal = null;
    let isModalOpen = false;
    
    function createFloatingButton() {
        if (floatingButton) return;
        
        floatingButton = document.createElement('div');
        floatingButton.id = 'admin-chat-floating-btn';
        floatingButton.className = 'chat-floating-btn';
        floatingButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-unread-badge" style="display: none;">0</span>
        `;
        floatingButton.onclick = toggleChatModal;
        document.body.appendChild(floatingButton);
    }
    
    function toggleChatModal() {
        if (isModalOpen) {
            closeChatModal();
        } else {
            openChatModal();
        }
    }
    
    function openChatModal() {
        if (!chatModal) {
            createChatModal();
        }
        chatModal.style.display = 'flex';
        isModalOpen = true;
        fetchConversations();
        startPolling();
    }
    
    function closeChatModal() {
        if (chatModal) {
            chatModal.style.display = 'none';
        }
        isModalOpen = false;
        stopPolling();
    }
    
    function createChatModal() {
        chatModal = document.createElement('div');
        chatModal.id = 'admin-chat-modal';
        chatModal.className = 'chat-modal';
        // Apply inline styles to ensure modal displays correctly
        chatModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(10, 22, 40, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;
        chatModal.innerHTML = `
            <div class="chat-modal-content admin-chat-modal" style="width: 90%; max-width: 1000px; height: 80vh; max-height: 700px; background: #ffffff; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(10, 22, 40, 0.3);">
                <div class="chat-modal-header" style="padding: 16px 20px; background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%); display: flex; align-items: center; justify-content: space-between;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">Centro de Mensajes</h2>
                    <button class="chat-close-btn" onclick="window.ImporlanAdminChat.closeModal()" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 24px;">&times;</button>
                </div>
                <div class="chat-modal-body" style="flex: 1; display: flex; overflow: hidden;">
                    <div class="chat-conversations-panel" style="width: 350px; min-width: 350px; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; background: #ffffff;">
                        <div class="chat-conversations-header" style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                            <p class="subtitle" style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Conversaciones de usuarios</p>
                            <div class="chat-sound-toggle" style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="admin-chat-sound-toggle-modal" ${notificationSoundEnabled ? 'checked' : ''}>
                                <label for="admin-chat-sound-toggle-modal" style="font-size: 13px; color: #64748b;">Sonido</label>
                            </div>
                        </div>
                        <div class="chat-filters" style="padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="chat-filter-btn active" data-filter="status" data-value="all" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid #0a1628; background: #0a1628; color: #ffffff;">Todas</button>
                            <button class="chat-filter-btn" data-filter="status" data-value="open" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b;">Abiertas</button>
                            <button class="chat-filter-btn" data-filter="assigned" data-value="unassigned" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b;">Sin asignar</button>
                        </div>
                        <div class="chat-conversations-list" id="admin-modal-conversations-list" style="flex: 1; overflow-y: auto; padding: 8px;">
                            <div class="chat-loading" style="padding: 40px; text-align: center; color: #64748b;">Cargando conversaciones...</div>
                        </div>
                    </div>
                    <div class="chat-messages-panel" id="admin-modal-messages-panel" style="flex: 1; display: flex; flex-direction: column; background: #f8fafc;">
                        <div class="chat-empty-state" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <p style="margin-top: 16px;">Selecciona una conversacion para ver los mensajes</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(chatModal);
        
        // Add event listeners for filters
        chatModal.querySelectorAll('.chat-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                const value = btn.dataset.value;
                
                chatModal.querySelectorAll('.chat-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                currentFilter[filter] = value;
                renderConversationsInModal();
            });
        });
        
        // Sound toggle
        const soundToggle = chatModal.querySelector('#admin-chat-sound-toggle-modal');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                notificationSoundEnabled = e.target.checked;
                localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, notificationSoundEnabled);
            });
        }
    }
    
    function renderConversationsInModal() {
        const listContainer = document.getElementById('admin-modal-conversations-list');
        if (!listContainer) return;
        
        let filtered = conversations;
        if (currentFilter.status !== 'all') {
            filtered = filtered.filter(c => c.status === currentFilter.status);
        }
        if (currentFilter.assigned === 'me') {
            filtered = filtered.filter(c => c.assigned_to_id === currentAdmin.id);
        } else if (currentFilter.assigned === 'unassigned') {
            filtered = filtered.filter(c => !c.assigned_to_id);
        }
        
        if (filtered.length === 0) {
            listContainer.innerHTML = '<div class="chat-empty-state"><p>No hay conversaciones</p></div>';
            return;
        }
        
        listContainer.innerHTML = filtered.map(conv => `
            <div class="chat-conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}" 
                 onclick="window.ImporlanAdminChat.selectConv(${conv.id})">
                <div class="chat-conversation-avatar">${getInitials(conv.user_email)}</div>
                <div class="chat-conversation-info">
                    <div class="chat-conversation-name">${escapeHtml(conv.user_email)}</div>
                    <div class="chat-conversation-preview">${escapeHtml(conv.last_message || 'Sin mensajes')}</div>
                </div>
                <div class="chat-conversation-meta">
                    <span class="chat-conversation-time">${formatTimeAgo(conv.updated_at)}</span>
                    ${conv.unread_count > 0 ? `<span class="chat-unread-count">${conv.unread_count}</span>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    async function selectConversationInModal(convId) {
        currentConversation = conversations.find(c => c.id === convId);
        if (!currentConversation) return;
        
        renderConversationsInModal();
        
        const messagesPanel = document.getElementById('admin-modal-messages-panel');
        if (!messagesPanel) return;
        
        messagesPanel.innerHTML = '<div class="chat-loading">Cargando mensajes...</div>';
        
        try {
            const result = await apiCall('admin_messages', 'GET', null, { conversation_id: convId });
            messages = result.messages || [];
            renderMessagesPanelInModal();
        } catch (e) {
            messagesPanel.innerHTML = `<div class="chat-error">Error: ${e.message}</div>`;
        }
    }
    
    function renderMessagesPanelInModal() {
        const messagesPanel = document.getElementById('admin-modal-messages-panel');
        if (!messagesPanel) return;
        
        messagesPanel.innerHTML = `
            <div class="chat-messages-header">
                <div class="chat-user-info">
                    <div class="chat-user-avatar">${getInitials(currentConversation.user_email)}</div>
                    <div>
                        <div class="chat-user-name">${escapeHtml(currentConversation.user_email)}</div>
                        <div class="chat-user-status">${currentConversation.status === 'open' ? 'Conversacion abierta' : 'Conversacion cerrada'}</div>
                    </div>
                </div>
                <div class="chat-actions">
                    ${!currentConversation.assigned_to_id ? 
                        `<button class="chat-action-btn" onclick="window.adminChatAssign(${currentConversation.id})">Asignarme</button>` : 
                        `<span class="chat-assigned-badge">Asignado a: ${currentConversation.assigned_to_name || 'Admin'}</span>`
                    }
                    ${currentConversation.status === 'open' ? 
                        `<button class="chat-action-btn secondary" onclick="window.adminChatClose(${currentConversation.id})">Cerrar</button>` :
                        `<button class="chat-action-btn" onclick="window.adminChatReopen(${currentConversation.id})">Reabrir</button>`
                    }
                </div>
            </div>
            <div class="chat-messages-list" id="admin-modal-messages-list">
                ${messages.map(msg => renderMessage(msg)).join('')}
            </div>
            <div class="chat-input-container">
                <textarea id="admin-modal-message-input" placeholder="Escribe tu respuesta..." rows="2"></textarea>
                <button class="chat-send-btn" onclick="window.ImporlanAdminChat.sendMsg()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        `;
        
        // Scroll to bottom
        const messagesList = document.getElementById('admin-modal-messages-list');
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
        
        // Enter key to send
        const input = document.getElementById('admin-modal-message-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessageFromModal();
                }
            });
        }
    }
    
    async function sendMessageFromModal() {
        const input = document.getElementById('admin-modal-message-input');
        if (!input || !currentConversation) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        input.value = '';
        input.disabled = true;
        
        try {
            await apiCall('admin_send', 'POST', {
                conversation_id: currentConversation.id,
                message: message
            });
            
            // Refresh messages
            const result = await apiCall('admin_messages', 'GET', null, { conversation_id: currentConversation.id });
            messages = result.messages || [];
            renderMessagesPanelInModal();
        } catch (e) {
            alert('Error al enviar mensaje: ' + e.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    }
    
    // Update floating button badge
    function updateFloatingBadge() {
        if (!floatingButton) return;
        const badge = floatingButton.querySelector('.chat-unread-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Handle token authentication errors
    // The React panel may generate tokens with a different JWT configuration
    let tokenRefreshAttempted = false;
    async function refreshAdminToken() {
        if (tokenRefreshAttempted) return false;
        tokenRefreshAttempted = true;
        
        // Show message to user that they need to re-login
        console.log('Chat: Token validation failed. Please re-login to use chat.');
        alert('Tu sesion de chat ha expirado. Por favor, cierra sesion y vuelve a iniciar sesion para usar el chat.');
        return false;
    }

    // API Helper
    async function apiCall(action, method = 'GET', body = null, params = {}, retryOnAuth = true) {
        const url = new URL(API_BASE, window.location.origin);
        url.searchParams.set('action', action);
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${currentAdmin.token}`,
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), options);
        
        // If we get a 401, try to refresh the token and retry once
        if (response.status === 401 && retryOnAuth) {
            console.log('Chat: Got 401, attempting to refresh token...');
            const refreshed = await refreshAdminToken();
            if (refreshed) {
                // Retry with new token
                return apiCall(action, method, body, params, false);
            }
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }

        return response.json();
    }

    // Create chat interface
    function createChatInterface() {
        // Find or create container
        const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.body;
        
        chatContainer = document.createElement('div');
        chatContainer.id = 'admin-chat-container';
        chatContainer.className = 'imporlan-chat-container';
        chatContainer.innerHTML = `
            <div class="chat-conversations-panel">
                <div class="chat-conversations-header">
                    <h2>Conversaciones</h2>
                    <p class="subtitle">Centro de mensajes</p>
                    <div class="chat-sound-toggle">
                        <input type="checkbox" id="admin-chat-sound-toggle" ${notificationSoundEnabled ? 'checked' : ''}>
                        <label for="admin-chat-sound-toggle">Sonido de notificacion</label>
                    </div>
                </div>
                <div class="chat-filters">
                    <button class="chat-filter-btn active" data-filter="status" data-value="all">Todas</button>
                    <button class="chat-filter-btn" data-filter="status" data-value="open">Abiertas</button>
                    <button class="chat-filter-btn" data-filter="status" data-value="closed">Cerradas</button>
                    <button class="chat-filter-btn" data-filter="assigned" data-value="me">Mis chats</button>
                    <button class="chat-filter-btn" data-filter="assigned" data-value="unassigned">Sin asignar</button>
                </div>
                <div class="chat-conversations-list">
                    <div class="chat-loading">
                        <div class="chat-loading-spinner"></div>
                    </div>
                </div>
            </div>
            <div class="chat-messages-panel">
                <div class="chat-empty-state">
                    <div class="chat-empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <h3>Selecciona una conversacion</h3>
                    <p>Elige una conversacion de la lista para ver los mensajes</p>
                </div>
            </div>
            <div class="chat-details-panel">
                <div class="chat-details-header">
                    <h3>Detalles del Usuario</h3>
                </div>
                <div class="chat-details-content">
                    <div class="chat-empty-state" style="padding: 40px 20px;">
                        <p>Selecciona una conversacion para ver los detalles del usuario</p>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        chatContainer.querySelector('#admin-chat-sound-toggle').addEventListener('change', (e) => {
            notificationSoundEnabled = e.target.checked;
            localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, notificationSoundEnabled);
        });

        chatContainer.querySelectorAll('.chat-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                const value = btn.dataset.value;
                
                // Update filter state
                if (filter === 'status') {
                    currentFilter.status = value;
                    // Reset status buttons
                    chatContainer.querySelectorAll('.chat-filter-btn[data-filter="status"]').forEach(b => b.classList.remove('active'));
                } else if (filter === 'assigned') {
                    currentFilter.assigned = currentFilter.assigned === value ? 'all' : value;
                    // Reset assigned buttons
                    chatContainer.querySelectorAll('.chat-filter-btn[data-filter="assigned"]').forEach(b => b.classList.remove('active'));
                }
                
                btn.classList.add('active');
                fetchConversations();
            });
        });

        // Insert into page
        mainContent.innerHTML = '';
        mainContent.appendChild(chatContainer);
    }

    // Fetch conversations
    async function fetchConversations() {
        // Try to get list container from modal first, then from full interface
        const listContainer = document.getElementById('admin-modal-conversations-list') || 
                              (chatContainer ? chatContainer.querySelector('.chat-conversations-list') : null);
        
        if (!listContainer) {
            console.log('Chat: No list container found');
            return;
        }
        
        try {
            const result = await apiCall('admin_conversations', 'GET', null, {
                status: currentFilter.status,
                assigned: currentFilter.assigned
            });
            conversations = result.conversations || [];
            
            // Render in modal if it exists
            if (document.getElementById('admin-modal-conversations-list')) {
                renderConversationsInModal();
            }
            // Render in full interface if it exists
            if (chatContainer) {
                renderConversations();
            }
        } catch (error) {
            console.error('Chat: Error fetching conversations', error);
            listContainer.innerHTML = `
                <div class="chat-empty-state">
                    <p>Error al cargar conversaciones</p>
                </div>
            `;
        }
    }

    // Render conversations list
    function renderConversations() {
        const listContainer = chatContainer.querySelector('.chat-conversations-list');
        
        if (conversations.length === 0) {
            listContainer.innerHTML = `
                <div class="chat-empty-state" style="padding: 40px 20px;">
                    <p>No hay conversaciones</p>
                    <p style="font-size: 12px; margin-top: 8px;">Las conversaciones de usuarios apareceran aqui</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = conversations.map(conv => {
            const initials = getInitials(conv.user_name || conv.user_email);
            const isActive = currentConversation && currentConversation.id === conv.id;
            const timeAgo = formatTimeAgo(conv.last_message_time || conv.updated_at);
            
            return `
                <div class="chat-conversation-item ${isActive ? 'active' : ''}" data-id="${conv.id}">
                    <div class="chat-conversation-avatar">${initials}</div>
                    <div class="chat-conversation-content">
                        <div class="chat-conversation-header">
                            <span class="chat-conversation-name">${escapeHtml(conv.user_name || conv.user_email)}</span>
                            <span class="chat-conversation-time">${timeAgo}</span>
                        </div>
                        <div class="chat-conversation-preview">${escapeHtml(conv.last_message || 'Sin mensajes')}</div>
                        <div class="chat-conversation-meta">
                            ${conv.unread_count > 0 ? `<span class="chat-unread-badge">${conv.unread_count}</span>` : ''}
                            ${conv.assigned_to_name ? `<span class="chat-assigned-badge ${conv.assigned_to_role}">${conv.assigned_to_name}</span>` : '<span class="chat-assigned-badge" style="background: #fef3c7; color: #92400e;">Sin asignar</span>'}
                            <span class="chat-status-badge ${conv.status}">${conv.status === 'open' ? 'Abierta' : 'Cerrada'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        listContainer.querySelectorAll('.chat-conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                selectConversation(id);
            });
        });
    }

    // Select conversation
    async function selectConversation(id) {
        currentConversation = conversations.find(c => c.id === id);
        
        if (!currentConversation) return;

        // Update active state in list
        chatContainer.querySelectorAll('.chat-conversation-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.id) === id);
        });

        // Show loading in messages panel
        const messagesPanel = chatContainer.querySelector('.chat-messages-panel');
        messagesPanel.innerHTML = `
            <div class="chat-loading" style="flex: 1;">
                <div class="chat-loading-spinner"></div>
            </div>
        `;

        // Show loading in details panel
        const detailsPanel = chatContainer.querySelector('.chat-details-content');
        detailsPanel.innerHTML = `
            <div class="chat-loading">
                <div class="chat-loading-spinner"></div>
            </div>
        `;

        try {
            // Fetch messages and user details in parallel
            const [messagesResult, detailsResult] = await Promise.all([
                apiCall('admin_messages', 'GET', null, { conversation_id: id }),
                apiCall('admin_user_details', 'GET', null, { email: currentConversation.user_email })
            ]);

            messages = messagesResult.messages || [];
            userDetails = detailsResult;
            
            renderMessagesPanel();
            renderDetailsPanel();
            
            // Update unread count in conversation list
            currentConversation.unread_count = 0;
            renderConversations();
            fetchUnreadCount();
        } catch (error) {
            messagesPanel.innerHTML = `
                <div class="chat-empty-state">
                    <p>Error al cargar mensajes</p>
                </div>
            `;
        }
    }

    // Render messages panel
    function renderMessagesPanel() {
        const messagesPanel = chatContainer.querySelector('.chat-messages-panel');
        const isClosed = currentConversation.status === 'closed';
        const isAssignedToMe = currentConversation.assigned_to_id == currentAdmin.sub;
        
        messagesPanel.innerHTML = `
            <div class="chat-messages-header">
                <div class="chat-messages-header-info">
                    <div class="chat-messages-header-avatar">${getInitials(currentConversation.user_name || currentConversation.user_email)}</div>
                    <div class="chat-messages-header-details">
                        <h3>${escapeHtml(currentConversation.user_name || currentConversation.user_email)}</h3>
                        <p>${currentConversation.user_email}</p>
                    </div>
                </div>
                <div class="chat-messages-header-actions">
                    ${!currentConversation.assigned_to_id ? `
                        <button class="chat-action-btn primary" onclick="window.adminChatAssign()">
                            Asignarme
                        </button>
                    ` : ''}
                    ${isClosed ? `
                        <button class="chat-action-btn" onclick="window.adminChatReopen()">
                            Reabrir
                        </button>
                    ` : `
                        <button class="chat-action-btn danger" onclick="window.adminChatClose()">
                            Cerrar
                        </button>
                    `}
                </div>
            </div>
            <div class="chat-messages-container">
                ${messages.length === 0 ? `
                    <div class="chat-empty-state">
                        <p>No hay mensajes en esta conversacion</p>
                    </div>
                ` : messages.map(msg => renderMessage(msg)).join('')}
            </div>
            ${!isClosed ? `
                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea placeholder="Escribe una respuesta..." rows="1"></textarea>
                        <button class="chat-send-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="chat-input-container" style="text-align: center; color: #64748b; font-size: 14px;">
                    Esta conversacion esta cerrada
                </div>
            `}
        `;

        // Scroll to bottom
        const container = messagesPanel.querySelector('.chat-messages-container');
        container.scrollTop = container.scrollHeight;

        // Add input handlers
        if (!isClosed) {
            const textarea = messagesPanel.querySelector('textarea');
            const sendBtn = messagesPanel.querySelector('.chat-send-btn');

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            });

            sendBtn.addEventListener('click', sendMessage);
        }
    }

    // Render single message
    function renderMessage(msg) {
        const initials = getInitials(msg.sender_name);
        const time = formatTime(msg.timestamp);

        return `
            <div class="chat-message ${msg.sender_role}">
                <div class="chat-message-avatar">${initials}</div>
                <div class="chat-message-content">
                    <span class="chat-message-sender">${escapeHtml(msg.sender_name)}</span>
                    <div class="chat-message-bubble">${escapeHtml(msg.message)}</div>
                    <span class="chat-message-time">${time}</span>
                </div>
            </div>
        `;
    }

    // Render details panel
    function renderDetailsPanel() {
        const detailsContent = chatContainer.querySelector('.chat-details-content');
        
        if (!userDetails) {
            detailsContent.innerHTML = `
                <div class="chat-empty-state" style="padding: 40px 20px;">
                    <p>No se encontraron detalles del usuario</p>
                </div>
            `;
            return;
        }

        const purchases = userDetails.purchases || [];
        
        detailsContent.innerHTML = `
            <div class="chat-details-section">
                <h4>Informacion del Usuario</h4>
                <div class="chat-details-card">
                    <div class="chat-details-row">
                        <span class="chat-details-label">Email</span>
                        <span class="chat-details-value">${escapeHtml(userDetails.email)}</span>
                    </div>
                    <div class="chat-details-row">
                        <span class="chat-details-label">Nombre</span>
                        <span class="chat-details-value">${escapeHtml(userDetails.name || 'No especificado')}</span>
                    </div>
                    <div class="chat-details-row">
                        <span class="chat-details-label">Total compras</span>
                        <span class="chat-details-value">${userDetails.total_purchases || 0}</span>
                    </div>
                    <div class="chat-details-row">
                        <span class="chat-details-label">Total gastado</span>
                        <span class="chat-details-value">$${formatNumber(userDetails.total_spent || 0)} CLP</span>
                    </div>
                </div>
            </div>
            
            <div class="chat-details-section">
                <h4>Estadisticas de Chat</h4>
                <div class="chat-details-card">
                    <div class="chat-details-row">
                        <span class="chat-details-label">Conversaciones totales</span>
                        <span class="chat-details-value">${userDetails.conversation_stats?.total_conversations || 0}</span>
                    </div>
                    <div class="chat-details-row">
                        <span class="chat-details-label">Conversaciones abiertas</span>
                        <span class="chat-details-value">${userDetails.conversation_stats?.open_conversations || 0}</span>
                    </div>
                </div>
            </div>
            
            ${purchases.length > 0 ? `
                <div class="chat-details-section">
                    <h4>Historial de Compras</h4>
                    ${purchases.slice(0, 5).map(p => `
                        <div class="chat-purchase-item">
                            <div class="chat-purchase-name">${escapeHtml(p.plan_name || p.description || 'Compra')}</div>
                            <div class="chat-purchase-details">
                                ${p.payment_method || 'N/A'} - ${formatDate(p.timestamp || p.date)}
                            </div>
                            <div class="chat-purchase-amount">$${formatNumber(p.amount_clp || p.amount || 0)} CLP</div>
                            <span class="chat-status-badge ${p.status === 'completed' || p.status === 'paid' || p.status === 'active' ? 'open' : 'closed'}">${p.status}</span>
                        </div>
                    `).join('')}
                    ${purchases.length > 5 ? `
                        <p style="text-align: center; font-size: 12px; color: #64748b; margin-top: 12px;">
                            +${purchases.length - 5} compras mas
                        </p>
                    ` : ''}
                </div>
            ` : `
                <div class="chat-details-section">
                    <h4>Historial de Compras</h4>
                    <div class="chat-details-card">
                        <p style="text-align: center; color: #64748b; font-size: 13px;">
                            Sin compras registradas
                        </p>
                    </div>
                </div>
            `}
        `;
    }

    // Send message
    async function sendMessage() {
        const textarea = chatContainer.querySelector('.chat-messages-panel textarea');
        const sendBtn = chatContainer.querySelector('.chat-send-btn');
        const message = textarea.value.trim();

        if (!message || !currentConversation) return;

        textarea.disabled = true;
        sendBtn.disabled = true;

        try {
            await apiCall('admin_send', 'POST', {
                conversation_id: currentConversation.id,
                message
            });

            textarea.value = '';
            textarea.style.height = 'auto';

            // Add message to local state and re-render
            const adminName = currentAdmin.role === 'admin' ? 'Administrador Imporlan' : 'Soporte Imporlan';
            messages.push({
                id: Date.now(),
                conversation_id: currentConversation.id,
                sender_id: currentAdmin.sub,
                sender_role: currentAdmin.role,
                sender_name: adminName,
                message,
                timestamp: new Date().toISOString(),
                read_status: 0
            });

            renderMessagesPanel();
            
            // Update conversation in list
            currentConversation.last_message = message;
            currentConversation.updated_at = new Date().toISOString();
            
            // Auto-assign if not assigned
            if (!currentConversation.assigned_to_id) {
                currentConversation.assigned_to_id = currentAdmin.sub;
                currentConversation.assigned_to_role = currentAdmin.role;
                currentConversation.assigned_to_name = adminName;
            }
            
            renderConversations();
        } catch (error) {
            alert('Error al enviar mensaje: ' + error.message);
        } finally {
            textarea.disabled = false;
            sendBtn.disabled = false;
            textarea.focus();
        }
    }

    // Assign conversation to current admin
    window.adminChatAssign = async function(convId) {
        // Support both modal mode (with convId parameter) and full interface mode
        if (convId && !currentConversation) {
            currentConversation = conversations.find(c => c.id === convId);
        }
        if (!currentConversation) return;

        try {
            await apiCall('admin_assign', 'POST', {
                conversation_id: currentConversation.id
            });

            const adminName = currentAdmin.role === 'admin' ? 'Administrador Imporlan' : 'Soporte Imporlan';
            currentConversation.assigned_to_id = currentAdmin.sub || currentAdmin.id;
            currentConversation.assigned_to_role = currentAdmin.role;
            currentConversation.assigned_to_name = adminName;

            // Check if we're in modal mode or full interface mode
            if (chatContainer) {
                renderMessagesPanel();
                renderConversations();
            } else {
                renderMessagesPanelInModal();
                renderConversationsInModal();
            }
        } catch (error) {
            alert('Error al asignar conversacion: ' + error.message);
        }
    };

    // Close conversation
    window.adminChatClose = async function(convId) {
        // Support both modal mode (with convId parameter) and full interface mode
        if (convId && !currentConversation) {
            currentConversation = conversations.find(c => c.id === convId);
        }
        if (!currentConversation) return;

        if (!confirm('¿Estas seguro de cerrar esta conversacion?')) return;

        try {
            await apiCall('admin_close', 'POST', {
                conversation_id: currentConversation.id
            });

            currentConversation.status = 'closed';
            
            // Check if we're in modal mode or full interface mode
            if (chatContainer) {
                renderMessagesPanel();
                renderConversations();
            } else {
                renderMessagesPanelInModal();
                renderConversationsInModal();
            }
        } catch (error) {
            alert('Error al cerrar conversacion: ' + error.message);
        }
    };

    // Reopen conversation
    window.adminChatReopen = async function(convId) {
        // Support both modal mode (with convId parameter) and full interface mode
        if (convId && !currentConversation) {
            currentConversation = conversations.find(c => c.id === convId);
        }
        if (!currentConversation) return;

        try {
            await apiCall('admin_reopen', 'POST', {
                conversation_id: currentConversation.id
            });

            currentConversation.status = 'open';
            
            // Check if we're in modal mode or full interface mode
            if (chatContainer) {
                renderMessagesPanel();
                renderConversations();
            } else {
                renderMessagesPanelInModal();
                renderConversationsInModal();
            }
        } catch (error) {
            alert('Error al reabrir conversacion: ' + error.message);
        }
    };

    // Fetch unread count
    async function fetchUnreadCount() {
        try {
            const result = await apiCall('admin_unread_count');
            const newCount = result.unread_count || 0;
            
            if (newCount > unreadCount && notificationSoundEnabled) {
                playNotificationSound();
            }
            
            unreadCount = newCount;
            updateNavBadge();
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    }

    // Update navigation badge and floating button badge
    function updateNavBadge() {
        // Update floating button badge
        updateFloatingBadge();
        
        // Try to find and update any chat navigation badge
        const navBadge = document.querySelector('.chat-nav-badge');
        if (navBadge) {
            if (unreadCount > 0) {
                navBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                navBadge.style.display = 'inline-flex';
            } else {
                navBadge.style.display = 'none';
            }
        }
    }

    // Start polling
    function startPolling() {
        stopPolling();
        lastPollTime = new Date().toISOString();
        
        pollTimer = setInterval(async () => {
            try {
                const params = { last_check: lastPollTime };
                if (currentConversation) {
                    params.conversation_id = currentConversation.id;
                }
                
                const result = await apiCall('poll', 'GET', null, params);

                lastPollTime = result.server_time;

                // Handle new messages
                if (result.new_messages && result.new_messages.length > 0 && currentConversation) {
                    result.new_messages.forEach(msg => {
                        if (!messages.find(m => m.id === msg.id)) {
                            messages.push(msg);
                        }
                    });
                    
                    // Check if we're in modal mode or full interface mode
                    if (chatContainer) {
                        renderMessagesPanel();
                    } else {
                        renderMessagesPanelInModal();
                    }
                    
                    if (notificationSoundEnabled) {
                        playNotificationSound();
                    }
                }

                // Handle updated conversations
                if (result.updated_conversations && result.updated_conversations.length > 0) {
                    result.updated_conversations.forEach(updatedConv => {
                        const index = conversations.findIndex(c => c.id === updatedConv.id);
                        if (index >= 0) {
                            conversations[index] = updatedConv;
                        } else {
                            conversations.unshift(updatedConv);
                        }
                    });
                    
                    // Check if we're in modal mode or full interface mode
                    if (chatContainer) {
                        renderConversations();
                    } else {
                        renderConversationsInModal();
                    }
                }

                fetchUnreadCount();
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, POLL_INTERVAL);
    }

    // Stop polling
    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // Play notification sound
    function playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAQqTi8NiPJwBBqOT03pMjAD2n4/TekiQAPqjk9N6SIwA9p+P03pIkAD6o5PTekiMAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA7peHy3JAiADul4fLckCIAO6Xh8tyQIgA=');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    // Utility functions
    function getInitials(name) {
        if (!name) return '?';
        return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Ahora';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('es-CL').format(num);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for external access
    window.ImporlanAdminChat = {
        init,
        fetchConversations,
        fetchUnreadCount,
        closeModal: closeChatModal,
        selectConv: selectConversationInModal,
        sendMsg: sendMessageFromModal
    };
})();
