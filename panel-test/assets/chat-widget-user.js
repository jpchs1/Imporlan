/**
 * Chat Widget - User Panel
 * Imporlan Panel Chat System
 * 
 * This widget provides chat functionality for authenticated users
 * to communicate with admin/support staff.
 */

(function() {
    'use strict';

    // Configuration - Auto-detect TEST environment
    const isTestEnv = window.location.pathname.startsWith('/test/') || window.location.pathname.startsWith('/panel-test/');
    const API_BASE = isTestEnv ? '/test/api/chat_api.php' : '/api/chat_api.php';
    const POLL_INTERVAL = 5000; // 5 seconds
    const NOTIFICATION_SOUND_ENABLED_KEY = 'imporlan_chat_sound_enabled';

    // State
    let currentUser = null;
    let conversations = [];
    let currentConversation = null;
    let messages = [];
    let pollTimer = null;
    let lastPollTime = null;
    let unreadCount = 0;
    let notificationSoundEnabled = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY) !== 'false';

    // DOM Elements
    let chatModal = null;
    let floatingBtn = null;

    // Initialize - with retry mechanism for auth detection
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 30; // Try for 30 seconds
    let initTimer = null;

    function init() {
        console.log('Chat: init() called, attempt:', initAttempts + 1);
        
        // Get user from localStorage (set by the panel app)
        const userStr = localStorage.getItem('imporlan_user');
        const token = localStorage.getItem('imporlan_token');
        
        console.log('Chat: userStr exists:', !!userStr, ', token exists:', !!token);
        
        if (!userStr || !token) {
            initAttempts++;
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Retry after 1 second - React may not have saved auth yet
                initTimer = setTimeout(init, 1000);
                if (initAttempts === 1) {
                    console.log('Chat: Waiting for authentication...');
                }
                return;
            }
            console.log('Chat: User not authenticated after ' + MAX_INIT_ATTEMPTS + ' attempts');
            return;
        }

        // Clear any pending retry
        if (initTimer) {
            clearTimeout(initTimer);
            initTimer = null;
        }

        try {
            currentUser = JSON.parse(userStr);
            currentUser.token = token;
            console.log('Chat: User parsed successfully:', currentUser.email);
        } catch (e) {
            console.error('Chat: Failed to parse user data', e);
            return;
        }

        // Prevent double initialization
        if (floatingBtn) {
            console.log('Chat: Already initialized');
            return;
        }

        console.log('Chat: Creating UI elements...');
        
        // Load CSS
        loadCSS();
        console.log('Chat: CSS loaded');
        
        // Create floating button
        createFloatingButton();
        console.log('Chat: Floating button created:', !!floatingBtn);
        
        // Create modal
        createChatModal();
        console.log('Chat: Modal created');
        
        // Get initial unread count
        fetchUnreadCount();
        
        // Start polling for unread count
        setInterval(fetchUnreadCount, 30000);

        console.log('Chat widget initialized for user:', currentUser.email);
    }

    // Load CSS
    function loadCSS() {
        if (document.getElementById('chat-widget-css')) return;
        
        const link = document.createElement('link');
        link.id = 'chat-widget-css';
        link.rel = 'stylesheet';
        // Auto-detect TEST environment for CSS path
        link.href = window.location.pathname.startsWith('/panel-test/') ? '/panel-test/assets/chat-widget.css' : (isTestEnv ? '/test/panel/assets/chat-widget.css' : '/panel/assets/chat-widget.css');
        document.head.appendChild(link);
    }

    // API Helper
    async function apiCall(action, method = 'GET', body = null, params = {}) {
        const url = new URL(API_BASE, window.location.origin);
        url.searchParams.set('action', action);
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json',
                'X-User-Email': currentUser.email || '',
                'X-User-Name': currentUser.name || ''
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }

        return response.json();
    }

    // Create floating chat button
    function createFloatingButton() {
        floatingBtn = document.createElement('button');
        floatingBtn.className = 'chat-floating-btn';
        floatingBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-floating-badge" style="display: none;">0</span>
        `;
        floatingBtn.addEventListener('click', openChat);
        document.body.appendChild(floatingBtn);
    }

    // Update floating button badge
    function updateFloatingBadge() {
        const badge = floatingBtn.querySelector('.chat-floating-badge');
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Create chat modal
    function createChatModal() {
        chatModal = document.createElement('div');
        chatModal.className = 'user-chat-modal-overlay';
        chatModal.id = 'user-chat-modal-overlay';
        // Apply inline styles to ensure modal displays correctly
        chatModal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(10, 22, 40, 0.5) !important;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001 !important;
        `;
        chatModal.innerHTML = `
            <div class="user-chat-modal-content" id="user-chat-modal-content" style="position: absolute !important; width: 800px !important; height: 550px !important; min-width: 450px !important; min-height: 350px !important; max-width: none !important; max-height: none !important; background: #ffffff !important; border-radius: 16px !important; overflow: visible !important; display: flex !important; flex-direction: column !important; box-shadow: 0 20px 60px rgba(10, 22, 40, 0.3) !important;">
                <div class="user-chat-modal-header" id="user-chat-modal-header" style="padding: 16px 20px !important; background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%) !important; display: flex !important; align-items: center !important; justify-content: space-between !important; cursor: move !important; user-select: none !important; flex-shrink: 0 !important; border-radius: 16px 16px 0 0 !important;">
                    <h2 style="margin: 0 !important; font-size: 18px !important; font-weight: 600 !important; color: #ffffff !important; pointer-events: none !important;">Chat con Soporte</h2>
                    <button class="user-chat-close-btn" style="width: 32px !important; height: 32px !important; border-radius: 8px !important; background: rgba(255, 255, 255, 0.1) !important; border: none !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #ffffff !important; font-size: 24px !important;">&times;</button>
                </div>
                <div class="user-chat-modal-body" style="flex: 1 !important; display: flex !important; overflow: hidden !important; min-height: 0 !important;">
                    <div class="user-chat-conversations-panel" style="width: 300px !important; min-width: 250px !important; max-width: 300px !important; border-right: 1px solid #e2e8f0 !important; display: flex !important; flex-direction: column !important; background: #ffffff !important; flex-shrink: 0 !important;">
                        <div style="padding: 16px !important; border-bottom: 1px solid #e2e8f0 !important; background: linear-gradient(135deg, #0a1628 0%, #1a365d 100%) !important;">
                            <h2 style="margin: 0 !important; font-size: 18px !important; font-weight: 600 !important; color: #ffffff !important;">Mis Conversaciones</h2>
                            <p style="margin: 4px 0 0 0 !important; font-size: 13px !important; color: #94a3b8 !important;">Historial de mensajes</p>
                            <button class="user-chat-new-conversation-btn" style="margin-top: 12px !important; width: 100% !important; padding: 10px 16px !important; background: #22d3ee !important; color: #0a1628 !important; border: none !important; border-radius: 8px !important; font-size: 14px !important; font-weight: 600 !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Nueva Conversacion
                            </button>
                            <div style="display: flex !important; align-items: center !important; gap: 8px !important; margin-top: 12px !important; background: rgba(255,255,255,0.1) !important; padding: 8px 12px !important; border-radius: 8px !important;">
                                <input type="checkbox" id="chat-sound-toggle" ${notificationSoundEnabled ? 'checked' : ''}>
                                <label for="chat-sound-toggle" style="font-size: 13px !important; color: #94a3b8 !important; cursor: pointer !important;">Sonido de notificacion</label>
                            </div>
                        </div>
                        <div class="chat-conversations-list" style="flex: 1 !important; overflow-y: auto !important; padding: 8px !important; min-height: 0 !important;">
                            <div style="padding: 40px !important; text-align: center !important; color: #64748b !important;">Cargando...</div>
                        </div>
                    </div>
                    <div class="chat-messages-panel" style="flex: 1 !important; display: flex !important; flex-direction: column !important; background: #f8fafc !important; min-width: 0 !important; overflow: hidden !important;">
                        <div style="flex: 1 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; color: #94a3b8 !important;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <h3 style="margin: 16px 0 8px 0 !important; font-size: 18px !important; font-weight: 600 !important; color: #64748b !important;">Selecciona una conversacion</h3>
                            <p style="margin: 0 !important; font-size: 14px !important;">O inicia una nueva para contactar con soporte</p>
                        </div>
                    </div>
                </div>
                <!-- Resize handles -->
                <div class="user-resize-handle user-resize-handle-e" style="position: absolute !important; right: -4px !important; top: 60px !important; bottom: 20px !important; width: 8px !important; cursor: ew-resize !important; background: transparent !important; z-index: 10 !important;"></div>
                <div class="user-resize-handle user-resize-handle-s" style="position: absolute !important; bottom: -4px !important; left: 20px !important; right: 20px !important; height: 8px !important; cursor: ns-resize !important; background: transparent !important; z-index: 10 !important;"></div>
                <div class="user-resize-handle user-resize-handle-se" style="position: absolute !important; right: -4px !important; bottom: -4px !important; width: 16px !important; height: 16px !important; cursor: nwse-resize !important; background: transparent !important; z-index: 11 !important;"></div>
            </div>
        `;

        document.body.appendChild(chatModal);
        
        // Get modal content element
        const modalContent = chatModal.querySelector('#user-chat-modal-content');
        const modalHeader = chatModal.querySelector('#user-chat-modal-header');
        
        // Center the modal initially
        const centerModal = () => {
            const width = modalContent.offsetWidth || 800;
            const height = modalContent.offsetHeight || 550;
            modalContent.style.left = `${Math.max(0, (window.innerWidth - width) / 2)}px`;
            modalContent.style.top = `${Math.max(0, (window.innerHeight - height) / 2)}px`;
        };
        
        // Drag functionality
        let isDragging = false;
        let dragStartX, dragStartY, modalStartX, modalStartY;
        
        modalHeader.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('user-chat-close-btn')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = modalContent.getBoundingClientRect();
            modalStartX = rect.left;
            modalStartY = rect.top;
            modalContent.style.transition = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;
                
                let newX = modalStartX + deltaX;
                let newY = modalStartY + deltaY;
                
                // Keep modal within viewport
                const rect = modalContent.getBoundingClientRect();
                newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
                newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));
                
                modalContent.style.left = `${newX}px`;
                modalContent.style.top = `${newY}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            modalContent.style.transition = '';
        });
        
        // Resize functionality
        let isResizing = false;
        let resizeDirection = '';
        let resizeStartX, resizeStartY, startWidth, startHeight, startLeft, startTop;
        
        chatModal.querySelectorAll('.user-resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                resizeDirection = handle.classList.contains('user-resize-handle-e') ? 'e' : 
                                  handle.classList.contains('user-resize-handle-s') ? 's' : 'se';
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                const rect = modalContent.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                startLeft = rect.left;
                startTop = rect.top;
                modalContent.style.transition = 'none';
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;
                
                if (resizeDirection === 'e' || resizeDirection === 'se') {
                    const newWidth = Math.max(450, Math.min(startWidth + deltaX, window.innerWidth - startLeft - 20));
                    modalContent.style.width = `${newWidth}px`;
                }
                if (resizeDirection === 's' || resizeDirection === 'se') {
                    const newHeight = Math.max(350, Math.min(startHeight + deltaY, window.innerHeight - startTop - 20));
                    modalContent.style.height = `${newHeight}px`;
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
            modalContent.style.transition = '';
        });
        
        // Close modal when clicking on backdrop
        chatModal.addEventListener('click', (e) => {
            if (e.target === chatModal) {
                closeChat();
            }
        });

        // Event listeners
        chatModal.querySelector('.user-chat-close-btn').addEventListener('click', closeChat);
        chatModal.querySelector('.user-chat-new-conversation-btn').addEventListener('click', showNewConversationModal);
        chatModal.querySelector('#chat-sound-toggle').addEventListener('change', (e) => {
            notificationSoundEnabled = e.target.checked;
            localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, notificationSoundEnabled);
        });

        // Create new conversation modal
        createNewConversationModal();
    }

    // Create new conversation modal
    function createNewConversationModal() {
        const modal = document.createElement('div');
        modal.className = 'chat-new-modal';
        modal.id = 'chat-new-conversation-modal';
        modal.innerHTML = `
            <div class="chat-new-modal-content">
                <div class="chat-new-modal-header">
                    <h3>Nueva Conversacion</h3>
                    <button class="chat-modal-close">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="chat-new-modal-body">
                    <textarea placeholder="Escribe tu mensaje aqui... Nuestro equipo de soporte te respondera a la brevedad."></textarea>
                </div>
                <div class="chat-new-modal-footer">
                    <button class="cancel-btn">Cancelar</button>
                    <button class="submit-btn">Enviar Mensaje</button>
                </div>
            </div>
        `;

        modal.querySelector('.chat-modal-close').addEventListener('click', hideNewConversationModal);
        modal.querySelector('.cancel-btn').addEventListener('click', hideNewConversationModal);
        modal.querySelector('.submit-btn').addEventListener('click', startNewConversation);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideNewConversationModal();
        });

        document.body.appendChild(modal);
    }

    // Show new conversation modal
    function showNewConversationModal() {
        const modal = document.getElementById('chat-new-conversation-modal');
        modal.classList.add('active');
        modal.querySelector('textarea').focus();
    }

    // Hide new conversation modal
    function hideNewConversationModal() {
        const modal = document.getElementById('chat-new-conversation-modal');
        modal.classList.remove('active');
        modal.querySelector('textarea').value = '';
    }

    // Start new conversation
    async function startNewConversation() {
        const modal = document.getElementById('chat-new-conversation-modal');
        const textarea = modal.querySelector('textarea');
        const submitBtn = modal.querySelector('.submit-btn');
        const message = textarea.value.trim();

        if (!message) {
            textarea.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            const result = await apiCall('user_start_conversation', 'POST', { message });
            hideNewConversationModal();
            await fetchConversations();
            selectConversation(result.conversation_id);
        } catch (error) {
            alert('Error al iniciar conversacion: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Mensaje';
        }
    }

    // Open chat modal
    async function openChat() {
        chatModal.style.display = 'flex';
        
        // Center the modal after it's visible
        requestAnimationFrame(() => {
            const modalContent = chatModal.querySelector('#user-chat-modal-content');
            if (modalContent) {
                const width = modalContent.offsetWidth || 800;
                const height = modalContent.offsetHeight || 550;
                modalContent.style.left = `${Math.max(0, (window.innerWidth - width) / 2)}px`;
                modalContent.style.top = `${Math.max(0, (window.innerHeight - height) / 2)}px`;
            }
        });
        
        await fetchConversations();
        startPolling();
    }

    // Close chat modal
    function closeChat() {
        chatModal.style.display = 'none';
        stopPolling();
    }

    // Fetch conversations
    async function fetchConversations() {
        const listContainer = chatModal.querySelector('.chat-conversations-list');
        
        try {
            const result = await apiCall('user_conversations');
            conversations = result.conversations || [];
            renderConversations();
        } catch (error) {
            listContainer.innerHTML = `
                <div class="chat-empty-state">
                    <p>Error al cargar conversaciones</p>
                </div>
            `;
        }
    }

    // Render conversations list
    function renderConversations() {
        const listContainer = chatModal.querySelector('.chat-conversations-list');
        
        if (conversations.length === 0) {
            listContainer.innerHTML = `
                <div class="chat-empty-state" style="padding: 40px 20px;">
                    <p>No tienes conversaciones aun</p>
                    <p style="font-size: 12px; margin-top: 8px;">Inicia una nueva para contactar con soporte</p>
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
                            <span class="chat-conversation-name">Conversacion #${conv.id}</span>
                            <span class="chat-conversation-time">${timeAgo}</span>
                        </div>
                        <div class="chat-conversation-preview">${escapeHtml(conv.last_message || 'Sin mensajes')}</div>
                        <div class="chat-conversation-meta">
                            ${conv.unread_count > 0 ? `<span class="chat-unread-badge">${conv.unread_count}</span>` : ''}
                            ${conv.assigned_to_name ? `<span class="chat-assigned-badge ${conv.assigned_to_role}">${conv.assigned_to_name}</span>` : ''}
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
        chatModal.querySelectorAll('.chat-conversation-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.id) === id);
        });

        // Show loading in messages panel
        const messagesPanel = chatModal.querySelector('.chat-messages-panel');
        messagesPanel.innerHTML = `
            <div class="chat-loading" style="flex: 1;">
                <div class="chat-loading-spinner"></div>
            </div>
        `;

        try {
            const result = await apiCall('user_messages', 'GET', null, { conversation_id: id });
            messages = result.messages || [];
            renderMessagesPanel();
            
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
        const messagesPanel = chatModal.querySelector('.chat-messages-panel');
        const isClosed = currentConversation.status === 'closed';
        
        messagesPanel.innerHTML = `
            <div class="chat-messages-header">
                <div class="chat-messages-header-info">
                    <div class="chat-messages-header-avatar">${getInitials(currentUser.name || currentUser.email)}</div>
                    <div class="chat-messages-header-details">
                        <h3>Conversacion #${currentConversation.id}</h3>
                        <p>${currentConversation.assigned_to_name ? `Atendido por: ${currentConversation.assigned_to_name}` : 'Esperando asignacion'}</p>
                    </div>
                </div>
                <div class="chat-messages-header-actions">
                    <span class="chat-status-badge ${currentConversation.status}">${isClosed ? 'Cerrada' : 'Abierta'}</span>
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
                        <textarea placeholder="Escribe un mensaje..." rows="1"></textarea>
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
        const isUser = msg.sender_role === 'user';
        const isSystem = msg.sender_role === 'system';
        const initials = getInitials(msg.sender_name);
        const time = formatTime(msg.timestamp);

        // System messages have a different layout (centered, no avatar)
        if (isSystem) {
            return `
                <div class="chat-message system">
                    <div class="chat-message-content">
                        <div class="chat-message-bubble">${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
                        <span class="chat-message-time">${time}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="chat-message ${msg.sender_role}">
                <div class="chat-message-avatar">${initials}</div>
                <div class="chat-message-content">
                    <span class="chat-message-sender">${escapeHtml(msg.sender_name)}</span>
                    <div class="chat-message-bubble">${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
                    <span class="chat-message-time">${time}</span>
                </div>
            </div>
        `;
    }

    // Send message
    async function sendMessage() {
        const textarea = chatModal.querySelector('.chat-messages-panel textarea');
        const sendBtn = chatModal.querySelector('.chat-send-btn');
        const message = textarea.value.trim();

        if (!message || !currentConversation) return;

        textarea.disabled = true;
        sendBtn.disabled = true;

        try {
            await apiCall('user_send', 'POST', {
                conversation_id: currentConversation.id,
                message
            });

            textarea.value = '';
            textarea.style.height = 'auto';

            // Add message to local state and re-render
            messages.push({
                id: Date.now(),
                conversation_id: currentConversation.id,
                sender_id: currentUser.id,
                sender_role: 'user',
                sender_name: currentUser.name || currentUser.email.split('@')[0],
                message,
                timestamp: new Date().toISOString(),
                read_status: 0
            });

            renderMessagesPanel();
            
            // Update conversation in list
            currentConversation.last_message = message;
            currentConversation.updated_at = new Date().toISOString();
            renderConversations();
        } catch (error) {
            alert('Error al enviar mensaje: ' + error.message);
        } finally {
            textarea.disabled = false;
            sendBtn.disabled = false;
            textarea.focus();
        }
    }

    // Fetch unread count
    async function fetchUnreadCount() {
        try {
            const result = await apiCall('user_unread_count');
            const newCount = result.unread_count || 0;
            
            if (newCount > unreadCount && notificationSoundEnabled) {
                playNotificationSound();
            }
            
            unreadCount = newCount;
            updateFloatingBadge();
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    }

    // Start polling
    function startPolling() {
        stopPolling();
        lastPollTime = new Date().toISOString();
        
        pollTimer = setInterval(async () => {
            if (!currentConversation) return;
            
            try {
                const result = await apiCall('poll', 'GET', null, {
                    last_check: lastPollTime,
                    conversation_id: currentConversation.id
                });

                lastPollTime = result.server_time;

                if (result.new_messages && result.new_messages.length > 0) {
                    // Add new messages
                    result.new_messages.forEach(msg => {
                        if (!messages.find(m => m.id === msg.id)) {
                            messages.push(msg);
                        }
                    });
                    
                    renderMessagesPanel();
                    
                    if (notificationSoundEnabled) {
                        playNotificationSound();
                    }
                }

                // Refresh conversations list
                await fetchConversations();
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
