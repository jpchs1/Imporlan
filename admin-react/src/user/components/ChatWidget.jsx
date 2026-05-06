import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { getMyConversations, getMessages, sendMessage, startConversation } from '../api';
import { cn } from '../../shared/lib/utils';

function fmtTime(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function avatarInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function ConvItem({ conv, onClick }) {
  const unread = Number(conv.unread_count || 0);
  const isClosed = conv.status === 'closed';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition flex items-start gap-2.5"
    >
      <div className={cn(
        'w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-semibold',
        isClosed ? 'bg-slate-400' : 'bg-gradient-to-br from-cyan-500 to-blue-600'
      )}>
        {avatarInitials(conv.subject || 'Soporte')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-800 truncate">{conv.subject || 'Conversacion'}</p>
          <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(conv.last_message_time || conv.updated_at)}</span>
        </div>
        <p className={cn('text-xs truncate mt-0.5', unread > 0 ? 'text-slate-700 font-medium' : 'text-slate-400')}>
          {conv.last_message_text || (isClosed ? 'Cerrada' : 'Sin mensajes')}
        </p>
      </div>
      {unread > 0 && (
        <span className="shrink-0 mt-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ msg, mine }) {
  const isSystem = msg.sender_role === 'system';
  if (isSystem) {
    return <div className="text-center text-[11px] text-slate-400 py-1">{msg.message_text || msg.message}</div>;
  }
  return (
    <div className={cn('flex gap-2 mb-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine && (
        <div className="w-7 h-7 rounded-lg shrink-0 bg-slate-200 text-slate-600 flex items-center justify-center text-[11px] font-semibold">
          {avatarInitials(msg.sender_name || 'A')}
        </div>
      )}
      <div className={cn(
        'max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words',
        mine ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
      )}>
        {msg.message_text || msg.message}
        <div className={cn('text-[10px] mt-0.5', mine ? 'text-white/70' : 'text-slate-400')}>{fmtTime(msg.created_at)}</div>
      </div>
    </div>
  );
}

function NewConversationForm({ onCreate, onCancel }) {
  const [subject, setSubject] = useState('Consulta general');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const data = await startConversation(subject.trim() || 'Consulta', message.trim());
      onCreate(data?.conversation_id || data?.id || null);
    } catch { /* silent */ }
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Asunto</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Mensaje</label>
        <textarea
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none resize-none"
          placeholder="Cuentanos como podemos ayudarte..."
          required
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button type="submit" disabled={sending || !message.trim()} className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold disabled:opacity-50">
          {sending ? 'Enviando...' : 'Iniciar'}
        </button>
      </div>
    </form>
  );
}

function ChatThread({ conv, onBack, onUpdated }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const lastMsgIdRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await getMessages(conv.id);
      const list = data?.messages || [];
      setMessages(list);
      lastMsgIdRef.current = list.length ? list[list.length - 1].id : 0;
    } catch { /* silent */ }
  }, [conv.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await getMessages(conv.id);
        const list = data?.messages || [];
        const lastId = list.length ? list[list.length - 1].id : 0;
        if (lastId !== lastMsgIdRef.current) {
          setMessages(list);
          lastMsgIdRef.current = lastId;
          onUpdated?.();
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [conv.id, onUpdated]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_role: 'user',
      sender_name: 'Tu',
      message_text: msg,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await sendMessage(conv.id, msg);
      await load();
      onUpdated?.();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(msg);
    }
    setSending(false);
  }

  const isClosed = conv.status === 'closed';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 bg-white">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Volver">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{conv.subject || 'Conversacion'}</p>
          <p className="text-[11px] text-slate-400">{isClosed ? 'Cerrada' : 'Activa'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">Aun no hay mensajes</p>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} msg={m} mine={m.sender_role === 'user'} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {isClosed ? (
        <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
          Esta conversacion esta cerrada
        </div>
      ) : (
        <form onSubmit={send} className="px-3 py-2.5 border-t border-slate-200 bg-white flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={sending}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none disabled:opacity-50"
          />
          <button type="submit" disabled={sending || !text.trim()} className="px-3 py-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

export default function ChatWidget() {
  const { isAuth } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'thread' | 'new'
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastUnreadRef = useRef(0);

  const refreshConvs = useCallback(async () => {
    try {
      const data = await getMyConversations();
      const list = data?.conversations || [];
      setConversations(list);
      const u = list.reduce((s, c) => s + Number(c.unread_count || 0), 0);
      if (u > lastUnreadRef.current && lastUnreadRef.current > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 660;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
          o.start(); o.stop(ctx.currentTime + 0.3);
        } catch { /* sound optional */ }
      }
      lastUnreadRef.current = u;
      setUnread(u);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConvs();
    const id = setInterval(refreshConvs, 30000);
    return () => clearInterval(id);
  }, [isAuth, refreshConvs]);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setView('list');
    setActiveConv(null);
    setLoading(true);
    await refreshConvs();
    setLoading(false);
  }

  function pickConv(c) {
    setActiveConv(c);
    setView('thread');
  }

  function onCreated(newId) {
    refreshConvs();
    setView('list');
    if (newId) {
      setTimeout(() => {
        const found = conversations.find(c => c.id === newId);
        if (found) pickConv(found);
        else refreshConvs();
      }, 200);
    }
  }

  if (!isAuth) return null;

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Abrir chat"
          className="fixed bottom-5 right-5 z-[9998] w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-2.5rem)] rounded-2xl bg-white shadow-2xl border border-slate-200/70 overflow-hidden flex flex-col animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-br from-slate-900 to-blue-950 text-white">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Soporte Imporlan</p>
              <p className="text-[11px] text-slate-400">Tiempo de respuesta: 48-72 hrs</p>
            </div>
            <button
              onClick={() => { setOpen(false); navigate('/messages'); }}
              className="text-[11px] text-cyan-300 hover:text-cyan-200 font-medium px-2 py-1"
              title="Abrir pagina completa"
            >
              Expandir
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white p-1"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {view === 'list' && (
              <>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <p className="text-center text-xs text-slate-400 py-10">Cargando...</p>
                  ) : conversations.length === 0 ? (
                    <div className="text-center px-4 py-10">
                      <svg className="w-10 h-10 mx-auto mb-2 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                      <p className="text-sm text-slate-500">Aun no tienes conversaciones</p>
                    </div>
                  ) : (
                    conversations.map(c => <ConvItem key={c.id} conv={c} onClick={() => pickConv(c)} />)
                  )}
                </div>
                <div className="p-2.5 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setView('new')}
                    className="w-full px-3 py-2.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition"
                  >
                    + Nueva conversacion
                  </button>
                </div>
              </>
            )}
            {view === 'new' && (
              <NewConversationForm onCreate={onCreated} onCancel={() => setView('list')} />
            )}
            {view === 'thread' && activeConv && (
              <ChatThread conv={activeConv} onBack={() => setView('list')} onUpdated={refreshConvs} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
