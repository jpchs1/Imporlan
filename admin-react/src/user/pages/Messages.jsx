import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getMyConversations, getMessages, sendMessage, startConversation, pollMessages } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Modal, Textarea } from '../../shared/components/UI';
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

function relativeTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < 60_000) return 'recien';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return fmtDate(ts);
}

const AVATAR_GRADIENTS = {
  user: 'from-cyan-500 to-blue-500',
  admin: 'from-indigo-500 to-violet-500',
  support: 'from-emerald-500 to-teal-500',
  system: 'from-slate-400 to-slate-500',
};

function ConversationItem({ conv, selected, onClick }) {
  const hasUnread = conv.unread_count > 0;
  const isClosed = conv.status === 'closed';
  return (
    <button
      type="button"
      onClick={() => onClick(conv.id)}
      className={cn(
        'w-full text-left px-4 py-3.5 cursor-pointer transition-all duration-200 border-b border-slate-100 last:border-0',
        selected
          ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-l-[3px] border-l-cyan-500'
          : 'hover:bg-slate-50/80 border-l-[3px] border-l-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={cn('w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-sm', isClosed ? AVATAR_GRADIENTS.system : AVATAR_GRADIENTS.admin)}>
            {conv.assigned_to_name ? conv.assigned_to_name[0].toUpperCase() : 'I'}
          </div>
          {!isClosed && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" title="En linea" />
          )}
          {isClosed && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-slate-300 border-2 border-white" title="Cerrada" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-sm truncate', hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700')}>
              {conv.assigned_to_name || 'Equipo Imporlan'}
            </p>
            <span className={cn('text-[10px] shrink-0 tabular-nums', hasUnread ? 'text-cyan-600 font-semibold' : 'text-slate-400')}>
              {fmtDateShort(conv.last_message_time || conv.updated_at)}
            </span>
          </div>
          {conv.subject && (
            <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate mt-0.5">{conv.subject}</p>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className={cn('text-xs truncate', hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400')}>
              {conv.last_message || (isClosed ? 'Conversacion cerrada' : 'Inicia la conversacion')}
            </p>
            {hasUnread ? (
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            ) : isClosed ? (
              <span className="text-[10px] font-semibold text-slate-400 shrink-0">Cerrada</span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

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
      {!isUser && (
        <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-auto', showAvatar ? gradient : 'opacity-0')}>
          {(msg.sender_name || 'I')[0].toUpperCase()}
        </div>
      )}
      <div className={cn('max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && showAvatar && (
          <p className="text-[10px] font-semibold text-slate-400 mb-0.5 ml-1">
            {msg.sender_name || msg.sender_role}
          </p>
        )}
        <div className={cn(
          'px-4 py-2.5 text-sm shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-2xl rounded-br-md'
            : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-bl-md',
        )}>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
          <div className={cn('flex items-center gap-1 mt-1', isUser ? 'justify-end' : 'justify-start')}>
            <p className={cn('text-[10px]', isUser ? 'text-white/60' : 'text-slate-400')} title={fmtDate(msg.timestamp)}>
              {fmtTime(msg.timestamp)}
            </p>
            {isUser && !msg._optimistic && (
              <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
            )}
            {msg._optimistic && (
              <svg className="w-3 h-3 text-white/50 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ conversationId, conversations, onConversationUpdate, onBack }) {
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
  const startedAgo = conv?.created_at ? relativeTime(conv.created_at) : null;

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(conversationId);
      setMessages(data.messages || data.data || []);
      lastCheckRef.current = new Date().toISOString();
    } catch { toast?.('Error al cargar mensajes', 'error'); }
    setLoading(false);
  }, [conversationId, toast]);

  useEffect(() => { setLoading(true); setMessages([]); loadMessages(); }, [loadMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

  // auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [text]);

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
    } catch {
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

  function getMessageGroups() {
    const groups = [];
    let lastDate = '';
    let lastSender = '';
    messages.forEach((msg) => {
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

  const groups = getMessageGroups();

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="sm:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Volver">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <div className="relative shrink-0">
            <div className={cn('w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-md', isClosed ? AVATAR_GRADIENTS.system : AVATAR_GRADIENTS.admin)}>
              {conv?.assigned_to_name ? conv.assigned_to_name[0].toUpperCase() : 'I'}
            </div>
            {!isClosed && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{conv?.assigned_to_name || 'Equipo Imporlan'}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {isClosed ? (
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"/>Conversacion cerrada</span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>En linea</span>
              )}
              {startedAgo && <span>· iniciada {startedAgo}</span>}
            </div>
          </div>
          {conv?.id && <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full font-mono shrink-0 hidden sm:inline">#{conv.id}</span>}
        </div>
        {conv?.subject && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[11px] font-semibold ring-1 ring-cyan-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
            {conv.subject}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-1.5" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 50%)' }}>
        {loading ? (
          <div className="space-y-3 max-w-md mx-auto">
            <div className="h-12 w-2/3 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-16 w-3/4 ml-auto bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-10 w-1/2 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Inicia la conversacion</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Escribi tu primer mensaje. Te respondemos en horario habil.</p>
          </div>
        ) : groups.map((g, i) => {
          if (g.type === 'date') return (
            <div key={`date-${i}`} className="flex items-center justify-center py-3">
              <span className="px-3 py-1 rounded-full bg-white shadow-sm border border-slate-100 text-[10px] text-slate-500 font-medium capitalize">{fmtDateSeparator(g.date)}</span>
            </div>
          );
          return <MessageBubble key={g.msg.id} msg={g.msg} showAvatar={g.showAvatar} />;
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or closed banner */}
      {!isClosed ? (
        <div className="px-3 sm:px-4 py-3 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                rows={1}
                className="w-full px-4 py-3 pr-14 border border-slate-200 rounded-2xl text-sm resize-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 focus:shadow-sm outline-none transition-all bg-slate-50 placeholder:text-slate-400 leading-relaxed"
                style={{ minHeight: '46px', maxHeight: '160px' }}
              />
              <span className="absolute right-3 bottom-2 text-[9px] text-slate-300 select-none">Enter para enviar</span>
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 shrink-0 shadow-md',
                text.trim()
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              )}
              aria-label="Enviar"
            >
              {sending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-5 h-5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Conexion segura
            </span>
            <span className="text-[10px] text-slate-400">Te respondemos en horario habil (48 hrs)</span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-500 text-center">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              Esta conversacion esta cerrada
            </div>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span>Iniciá una nueva si necesitas ayuda</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Messages() {
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | unread | active | closed

  const loadConversations = useCallback(async () => {
    try {
      const data = await getMyConversations();
      setConversations(data.conversations || []);
    } catch { toast?.('Error al cargar conversaciones', 'error'); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0);
  const activeCount = conversations.filter(c => c.status !== 'closed').length;
  const closedCount = conversations.filter(c => c.status === 'closed').length;

  const filteredConvs = useMemo(() => {
    const t = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (filter === 'unread' && !(c.unread_count > 0)) return false;
      if (filter === 'active' && c.status === 'closed') return false;
      if (filter === 'closed' && c.status !== 'closed') return false;
      if (t) {
        const hay = `${c.assigned_to_name || ''} ${c.subject || ''} ${c.last_message || ''}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [conversations, filter, search]);

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
    } catch { toast?.('Error de conexion', 'error'); }
    setCreating(false);
  }

  return (
    <div className="max-w-6xl mx-auto pb-6">
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-5 sm:p-7 overflow-hidden mb-5 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold ring-1 ring-cyan-400/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {totalUnread > 0 ? `${totalUnread} mensaje${totalUnread > 1 ? 's' : ''} sin leer` : 'Estas al dia'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mensajes</h1>
            <p className="text-sm text-slate-300 mt-1.5">Comunicate con el equipo Imporlan en tiempo real</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowNew(true)} className="bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 font-semibold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path d="M12 4v16m8-8H4"/></svg>
              Nueva conversacion
            </Button>
            <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition ring-1 ring-emerald-400/20">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-0">
          <div className="flex h-[420px]">
            <div className="w-[320px] border-r border-slate-100 p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse"/>)}
            </div>
            <div className="flex-1 p-6 space-y-3">
              <div className="h-12 w-2/3 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-12 w-1/2 ml-auto bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          </div>
        </Card>
      ) : conversations.length === 0 && !selectedId ? (
        <Card className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <p className="text-lg font-bold text-slate-800">Aun no tenes conversaciones</p>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Inicia una conversacion con el equipo Imporlan. Te respondemos en horario habil dentro de 48 horas.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <Button variant="accent" size="md" onClick={() => setShowNew(true)} className="shadow-md shadow-cyan-500/20 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4"/></svg>
              Iniciar conversacion
            </Button>
            <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Tambien por WhatsApp
            </a>
          </div>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '480px' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={cn('w-full sm:w-[340px] border-r border-slate-100 flex flex-col shrink-0 bg-white', selectedId && 'hidden sm:flex')}>
              {/* Sidebar header */}
              <div className="px-3 py-3 border-b border-slate-100 bg-slate-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">Conversaciones</p>
                  <span className="text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100 tabular-nums">{conversations.length}</span>
                </div>
                <div className="relative">
                  <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700" aria-label="Limpiar">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { v: 'all', label: 'Todas', count: conversations.length },
                    { v: 'unread', label: 'Sin leer', count: totalUnread },
                    { v: 'active', label: 'Activas', count: activeCount },
                    { v: 'closed', label: 'Cerradas', count: closedCount },
                  ].map(t => (
                    <button
                      key={t.v}
                      onClick={() => setFilter(t.v)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition',
                        filter === t.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {t.label}
                      <span className={cn('tabular-nums', filter === t.v ? 'text-white/80' : 'text-slate-400')}>{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversation list */}
              <div className="overflow-y-auto flex-1">
                {filteredConvs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No hay coincidencias
                    {(search || filter !== 'all') && (
                      <button onClick={() => { setSearch(''); setFilter('all'); }} className="block mx-auto mt-2 text-cyan-600 font-semibold hover:text-cyan-700">Limpiar filtros</button>
                    )}
                  </div>
                ) : (
                  filteredConvs.map(c => (
                    <ConversationItem key={c.id} conv={c} selected={c.id === selectedId} onClick={setSelectedId} />
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40 text-center">
                <button onClick={() => setShowNew(true)} className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
                  Nueva conversacion
                </button>
              </div>
            </div>

            {/* Chat panel */}
            <div className={cn('flex-1 flex flex-col bg-white', !selectedId && 'hidden sm:flex')}>
              {selectedId ? (
                <ChatPanel
                  key={selectedId}
                  conversationId={selectedId}
                  conversations={conversations}
                  onConversationUpdate={loadConversations}
                  onBack={() => setSelectedId(null)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.04) 0%, transparent 50%)' }}>
                  <div className="relative w-24 h-24 mb-5">
                    <div className="absolute inset-0 rounded-full bg-cyan-100 animate-ping opacity-30"/>
                    <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
                      <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    </div>
                  </div>
                  <p className="text-base font-bold text-slate-700">Selecciona una conversacion</p>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">Eligi una conversacion del panel izquierdo o inicia una nueva con el equipo Imporlan.</p>
                  <Button variant="accent" size="sm" onClick={() => setShowNew(true)} className="mt-5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4"/></svg>
                    Nueva conversacion
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New conversation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva conversacion">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-100">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-cyan-900">Equipo Imporlan</p>
              <p className="text-xs text-cyan-700">Te respondemos en horario habil dentro de 48 horas</p>
            </div>
          </div>
          <Textarea
            label="Tu mensaje"
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder="Hola, tengo una consulta sobre..."
            rows={5}
          />
          <p className="text-[11px] text-slate-400 -mt-2">Para algo urgente, escribinos por <a href="https://wa.me/56940211459" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold hover:text-emerald-700">WhatsApp</a>.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleNewConversation} disabled={!newMsg.trim() || creating} className="flex items-center gap-2">
              {creating && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {creating ? 'Enviando...' : 'Enviar mensaje'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
