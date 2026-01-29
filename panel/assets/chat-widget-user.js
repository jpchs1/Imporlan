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
    const isTestEnv = window.location.pathname.startsWith('/test/');
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
        // Get user from localStorage (set by the panel app)
        const userStr = localStorage.getItem('imporlan_user');
        const token = localStorage.getItem('imporlan_token');
        
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
        } catch (e) {
            console.error('Chat: Failed to parse user data');
            return;
        }

        // Prevent double initialization
        if (floatingBtn) {
            console.log('Chat: Already initialized');
            return;
        }

        // Load CSS
        loadCSS();
        
        // Create floating button
        createFloatingButton();
        
        // Create modal
        createChatModal();
        
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
        link.href = isTestEnv ? '/test/panel/assets/chat-widget.css' : '/panel/assets/chat-widget.css';
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
        chatModal.className = 'chat-modal-overlay';
        chatModal.innerHTML = `
            <div class="chat-modal">
                <div class="chat-modal-header">
                    <h2>Chat con Soporte</h2>
                    <button class="chat-modal-close">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="chat-modal-body">
                    <div class="chat-conversations-panel">
                        <div class="chat-conversations-header">
                            <h2>Mis Conversaciones</h2>
                            <p class="subtitle">Historial de mensajes</p>
                            <button class="chat-new-conversation-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Nueva Conversacion
                            </button>
                            <div class="chat-sound-toggle">
                                <input type="checkbox" id="chat-sound-toggle" ${notificationSoundEnabled ? 'checked' : ''}>
                                <label for="chat-sound-toggle">Sonido de notificacion</label>
                            </div>
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
                            <p>O inicia una nueva para contactar con soporte</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        chatModal.querySelector('.chat-modal-close').addEventListener('click', closeChat);
        chatModal.querySelector('.chat-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === chatModal) closeChat();
        });
        chatModal.querySelector('.chat-new-conversation-btn').addEventListener('click', showNewConversationModal);
        chatModal.querySelector('#chat-sound-toggle').addEventListener('change', (e) => {
            notificationSoundEnabled = e.target.checked;
            localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, notificationSoundEnabled);
        });

        document.body.appendChild(chatModal);

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
        chatModal.classList.add('active');
        await fetchConversations();
        startPolling();
    }

    // Close chat modal
    function closeChat() {
        chatModal.classList.remove('active');
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
