import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyConversations, getMessages, sendMessage, startConversation, pollMessages } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Modal, Textarea, Spinner, Badge } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(ts);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
}

const ROLE_COLORS = {
  user: { bg: 'bg-cyan-500', text: 'text-cyan-600', bubble: 'bg-cyan-500 text-white', align: 'justify-end' },
  admin: { bg: 'bg-indigo-500', text: 'text-indigo-600', bubble: 'bg-white border border-slate-200 text-slate-700', align: 'justify-start' },
  support: { bg: 'bg-emerald-500', text: 'text-emerald-600', bubble: 'bg-white border border-slate-200 text-slate-700', align: 'justify-start' },
  system: { bg: 'bg-slate-400', text: 'text-slate-500', bubble: 'bg-blue-50 text-slate-600 border border-blue-100', align: 'justify-center' },
};

// --- Conversation Item ---
function ConversationItem({ conv, selected, onClick }) {
  const hasUnread = conv.unread_count > 0;
  return (
    <div
      onClick={() => onClick(conv.id)}
      className={cn(
        'px-4 py-3 cursor-pointer transition-all border-b border-slate-100',
        selected ? 'bg-cyan-50/50' : 'hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm truncate', hasUnread ? 'font-bold text-slate-800' : 'font-medium text-slate-600')}>
              Conversacion #{conv.id}
            </p>
            {conv.status === 'closed' && (
              <Badge className="bg-slate-100 text-slate-500 text-[9px]">Cerrada</Badge>
            )}
          </div>
          {conv.assigned_to_name && (
            <p className="text-[11px] text-slate-400 mt-0.5">{conv.assigned_to_name}</p>
          )}
          {conv.last_message && (
            <p className={cn('text-xs mt-1 truncate', hasUnread ? 'text-slate-600' : 'text-slate-400')}>
              {conv.last_message}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-slate-400">{fmtDateShort(conv.last_message_time || conv.updated_at)}</span>
          {hasUnread && (
            <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center">
              {conv.unread_count > 9 ? '9+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Message Bubble ---
function MessageBubble({ msg }) {
  const role = ROLE_COLORS[msg.sender_role] || ROLE_COLORS.admin;
  const isSystem = msg.sender_role === 'system';
  const isUser = msg.sender_role === 'user';

  return (
    <div className={cn('flex', role.align)}>
      <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', role.bubble, isUser && 'rounded-br-sm', !isUser && !isSystem && 'rounded-bl-sm')}>
        {!isUser && !isSystem && (
          <p className={cn('text-[11px] font-semibold mb-0.5', role.text)}>
            {msg.sender_name || msg.sender_role}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
        <p className={cn('text-[10px] mt-1', isUser ? 'text-white/60' : 'text-slate-400')}>
          {fmtTime(msg.timestamp)}
        </p>
      </div>
    </div>
  );
}

// --- Chat Panel ---
function ChatPanel({ conversationId, conversations, onConversationUpdate }) {
  const toast = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const lastCheckRef = useRef(null);

  const conv = conversations.find(c => c.id === conversationId);
  const isClosed = conv?.status === 'closed';

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(conversationId);
      const msgs = data.messages || data.data || [];
      setMessages(msgs);
      lastCheckRef.current = new Date().toISOString();
    } catch (e) {
      toast?.('Error al cargar mensajes', 'error');
    }
    setLoading(false);
  }, [conversationId, toast]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling (5s)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await pollMessages(lastCheckRef.current, conversationId);
        if (data.new_messages?.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.new_messages.filter(m => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
          onConversationUpdate?.();
        }
        if (data.server_time) lastCheckRef.current = data.server_time;
      } catch (e) { /* silent */ }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [conversationId, onConversationUpdate]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    // Optimistic append
    const optimistic = {
      id: Date.now(),
      sender_role: 'user',
      sender_name: user?.name || 'Tu',
      message: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await sendMessage(conversationId, msg);
      onConversationUpdate?.();
    } catch (e) {
      toast?.('Error al enviar mensaje', 'error');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(msg);
    }
    setSending(false);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner /></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
            {conv?.assigned_to_name ? conv.assigned_to_name[0].toUpperCase() : 'I'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {conv?.assigned_to_name || 'Equipo Imporlan'}
            </p>
            <p className="text-[11px] text-slate-400">
              {isClosed ? 'Conversacion cerrada' : 'En linea'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-slate-300 text-sm">No hay mensajes</div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isClosed ? (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... (Ctrl+Enter para enviar)"
              rows={1}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition-all max-h-28"
            />
            <Button
              variant="accent"
              size="md"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100 text-center text-xs text-slate-400 shrink-0">
          Esta conversacion esta cerrada.
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function Messages() {
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [creating, setCreating] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getMyConversations();
      setConversations(data.conversations || []);
    } catch (e) {
      toast?.('Error al cargar conversaciones', 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  async function handleNewConversation() {
    const msg = newMsg.trim();
    if (!msg || creating) return;
    setCreating(true);
    try {
      const data = await startConversation('', msg);
      if (data.success && data.conversation_id) {
        toast?.('Conversacion iniciada', 'success');
        setShowNew(false);
        setNewMsg('');
        await loadConversations();
        setSelectedId(data.conversation_id);
      } else {
        toast?.(data.error || 'Error al crear conversacion', 'error');
      }
    } catch (e) {
      toast?.('Error de conexion', 'error');
    }
    setCreating(false);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mensajes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Comunicate con el equipo Imporlan</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setShowNew(true)} className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
          Nueva Conversacion
        </Button>
      </div>

      {conversations.length === 0 && !selectedId ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <p className="text-slate-500 font-medium">No tienes conversaciones</p>
          <p className="text-sm text-slate-400 mt-1">Inicia una conversacion con el equipo Imporlan.</p>
          <Button variant="accent" size="sm" className="mt-4" onClick={() => setShowNew(true)}>
            Iniciar conversacion
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden" style={{ height: 'calc(100vh - 210px)', minHeight: '450px' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={cn('w-full sm:w-80 border-r border-slate-100 flex flex-col shrink-0', selectedId && 'hidden sm:flex')}>
              <div className="overflow-y-auto flex-1">
                {conversations.map(c => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    selected={c.id === selectedId}
                    onClick={setSelectedId}
                  />
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div className={cn('flex-1 flex flex-col', !selectedId && 'hidden sm:flex')}>
              {selectedId ? (
                <>
                  {/* Mobile back */}
                  <button
                    onClick={() => setSelectedId(null)}
                    className="sm:hidden flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 hover:text-slate-800 border-b border-slate-100"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
                    Volver
                  </button>
                  <ChatPanel
                    key={selectedId}
                    conversationId={selectedId}
                    conversations={conversations}
                    onConversationUpdate={loadConversations}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  <p className="text-sm text-slate-400">Selecciona una conversacion</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* New conversation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva Conversacion">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Escribe tu mensaje y el equipo Imporlan te respondera lo antes posible.</p>
          <Textarea
            label="Mensaje"
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder="Hola, tengo una consulta sobre..."
            rows={4}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleNewConversation} disabled={!newMsg.trim() || creating}>
              {creating ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
