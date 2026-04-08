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

function fmtDateSeparator(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

const AVATAR_GRADIENTS = {
  user: 'from-cyan-500 to-blue-500',
  admin: 'from-indigo-500 to-violet-500',
  support: 'from-emerald-500 to-teal-500',
  system: 'from-slate-400 to-slate-500',
};

// --- Conversation Item ---
function ConversationItem({ conv, selected, onClick }) {
  const hasUnread = conv.unread_count > 0;
  return (
    <div
      onClick={() => onClick(conv.id)}
      className={cn(
        'px-4 py-3.5 cursor-pointer transition-all duration-200',
        selected
          ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-l-[3px] border-l-cyan-500'
          : 'hover:bg-slate-50/80 border-l-[3px] border-l-transparent',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn('w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-sm', AVATAR_GRADIENTS.admin)}>
            {conv.assigned_to_name ? conv.assigned_to_name[0].toUpperCase() : 'I'}
          </div>
          {conv.status !== 'closed' && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-sm truncate', hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700')}>
              {conv.assigned_to_name || 'Equipo Imporlan'}
            </p>
            <span className={cn('text-[10px] shrink-0', hasUnread ? 'text-cyan-600 font-semibold' : 'text-slate-400')}>
              {fmtDateShort(conv.last_message_time || conv.updated_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={cn('text-xs truncate', hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400')}>
              {conv.last_message || 'Sin mensajes'}
            </p>
            {hasUnread && (
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Message Bubble ---
function MessageBubble({ msg, showAvatar }) {
  const isSystem = msg.sender_role === 'system';
  const isUser = msg.sender_role === 'user';
  const gradient = AVATAR_GRADIENTS[msg.sender_role] || AVATAR_GRADIENTS.admin;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] max-w-[80%] text-center">
          {msg.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {/* Avatar (non-user only) */}
      {!isUser && (
        <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-auto', showAvatar ? gradient : 'opacity-0')}>
          {(msg.sender_name || 'I')[0].toUpperCase()}
        </div>
      )}

      <div className={cn('max-w-[70%]', isUser ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {!isUser && showAvatar && (
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5 ml-1">
            {msg.sender_name || msg.sender_role}
          </p>
        )}
        {/* Bubble */}
        <div className={cn(
          'px-4 py-2.5 text-sm shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-2xl rounded-br-md'
            : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-bl-md',
        )}>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
          <div className={cn('flex items-center gap-1 mt-1', isUser ? 'justify-end' : 'justify-start')}>
            <p className={cn('text-[10px]', isUser ? 'text-white/50' : 'text-slate-400')}>
              {fmtTime(msg.timestamp)}
            </p>
            {isUser && !msg._optimistic && (
              <svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
            )}
            {msg._optimistic && (
              <svg className="w-3 h-3 text-white/40 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            )}
          </div>
        </div>
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
  const textareaRef = useRef(null);
  const pollRef = useRef(null);
  const lastCheckRef = useRef(null);

  const conv = conversations.find(c => c.id === conversationId);
  const isClosed = conv?.status === 'closed';

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(conversationId);
      setMessages(data.messages || data.data || []);
      lastCheckRef.current = new Date().toISOString();
    } catch (e) { toast?.('Error al cargar mensajes', 'error'); }
    setLoading(false);
  }, [conversationId, toast]);

  useEffect(() => { setLoading(true); setMessages([]); loadMessages(); }, [loadMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Polling (5s)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await pollMessages(lastCheckRef.current, conversationId);
        if (data.new_messages?.length > 0) {
          setMessages(prev => {
            const withoutOptimistic = prev.filter(m => !m._optimistic);
            const existingIds = new Set(withoutOptimistic.map(m => m.id));
            const newMsgs = data.new_messages.filter(m => !existingIds.has(m.id));
            return newMsgs.length > 0 ? [...withoutOptimistic, ...newMsgs] : prev;
          });
          onConversationUpdate?.();
        }
        if (data.server_time) lastCheckRef.current = data.server_time;
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [conversationId, onConversationUpdate]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    const optimistic = { id: `optimistic-${Date.now()}`, _optimistic: true, sender_role: 'user', sender_name: user?.name || 'Tu', message: msg, timestamp: new Date().toISOString() };
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
    textareaRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Group messages with date separators and avatar visibility
  function getMessageGroups() {
    const groups = [];
    let lastDate = '';
    let lastSender = '';
    messages.forEach((msg, i) => {
      const msgDate = msg.timestamp ? new Date(msg.timestamp).toDateString() : '';
      if (msgDate !== lastDate) {
        groups.push({ type: 'date', date: msg.timestamp });
        lastDate = msgDate;
        lastSender = '';
      }
      const showAvatar = msg.sender_role !== lastSender;
      groups.push({ type: 'msg', msg, showAvatar });
      lastSender = msg.sender_role;
    });
    return groups;
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-slate-100 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Cargando mensajes...</p>
      </div>
    </div>
  );

  const groups = getMessageGroups();

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white">
      {/* Header */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-md', AVATAR_GRADIENTS.admin)}>
              {conv?.assigned_to_name ? conv.assigned_to_name[0].toUpperCase() : 'I'}
            </div>
            {!isClosed && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">{conv?.assigned_to_name || 'Equipo Imporlan'}</p>
            <p className="text-[11px] text-slate-400">
              {isClosed ? (
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Conversacion cerrada</span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>En linea</span>
              )}
            </p>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">#{conv?.id}</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 50%)' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <p className="text-sm font-medium text-slate-600">Inicia la conversacion</p>
            <p className="text-xs text-slate-400 mt-1">Escribe tu primer mensaje abajo</p>
          </div>
        ) : (
          groups.map((g, i) => {
            if (g.type === 'date') return (
              <div key={`date-${i}`} className="flex items-center justify-center py-3">
                <span className="px-3 py-1 rounded-full bg-white shadow-sm border border-slate-100 text-[10px] text-slate-500 font-medium capitalize">{fmtDateSeparator(g.date)}</span>
              </div>
            );
            return <MessageBubble key={g.msg.id} msg={g.msg} showAvatar={g.showAvatar} />;
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!isClosed ? (
        <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-2xl text-sm resize-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:shadow-sm outline-none transition-all max-h-32 bg-slate-50 placeholder:text-slate-400"
                style={{ minHeight: '46px' }}
              />
              <span className="absolute right-3 bottom-2 text-[9px] text-slate-300">Enter para enviar</span>
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 shadow-md',
                text.trim()
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              )}
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-5 h-5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Esta conversacion esta cerrada
          </div>
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
    } catch (e) { toast?.('Error al cargar conversaciones', 'error'); }
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
      } else { toast?.(data.error || 'Error al crear conversacion', 'error'); }
    } catch (e) { toast?.('Error de conexion', 'error'); }
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
        <Button variant="accent" size="sm" onClick={() => setShowNew(true)} className="flex items-center gap-1.5 shadow-md shadow-cyan-500/20">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
          Nueva Conversacion
        </Button>
      </div>

      {conversations.length === 0 && !selectedId ? (
        <Card className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <p className="text-lg font-bold text-slate-800">No tienes conversaciones</p>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">Inicia una conversacion con el equipo Imporlan para resolver tus dudas.</p>
          <Button variant="accent" size="md" className="mt-6 shadow-md shadow-cyan-500/20" onClick={() => setShowNew(true)}>
            Iniciar conversacion
          </Button>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden" style={{ height: 'calc(100vh - 210px)', minHeight: '500px' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={cn('w-full sm:w-[340px] border-r border-slate-100 flex flex-col shrink-0 bg-white', selectedId && 'hidden sm:flex')}>
              {/* Sidebar header */}
              <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">Conversaciones</p>
                  <span className="text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">{conversations.length}</span>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {conversations.map(c => (
                  <ConversationItem key={c.id} conv={c} selected={c.id === selectedId} onClick={setSelectedId} />
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div className={cn('flex-1 flex flex-col bg-white', !selectedId && 'hidden sm:flex')}>
              {selectedId ? (
                <>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="sm:hidden flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-800 border-b border-slate-100 bg-white"
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
                <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 50%)' }}>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mb-4">
                    <svg className="w-9 h-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  </div>
                  <p className="text-base font-semibold text-slate-600">Selecciona una conversacion</p>
                  <p className="text-sm text-slate-400 mt-1">Elige una conversacion del panel izquierdo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New conversation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva Conversacion">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-cyan-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-cyan-800">Equipo Imporlan</p>
              <p className="text-xs text-cyan-600">Te responderemos lo antes posible</p>
            </div>
          </div>
          <Textarea
            label="Tu mensaje"
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder="Hola, tengo una consulta sobre..."
            rows={4}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleNewConversation} disabled={!newMsg.trim() || creating} className="flex items-center gap-2">
              {creating && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {creating ? 'Enviando...' : 'Enviar Mensaje'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
