import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  closeChatConversation,
  reopenChatConversation,
  assignChatConversation,
} from '../api';
import { fmtDateTime } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Input, Spinner, StatCard } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const LIST_POLL_MS = 10000;
const MESSAGES_POLL_MS = 3000;

function fmtRelative(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return Math.floor(diff / 60) + 'min';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd';
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
}

function initials(nameOrEmail) {
  const s = (nameOrEmail || '?').trim();
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

export default function Chat() {
  const showToast = useToast();
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  const loadConversations = useCallback(async () => {
    try {
      const r = await getChatConversations(statusFilter, assignedFilter);
      setConversations(r.conversations || []);
    } catch (e) {
      console.error('chat list:', e);
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, assignedFilter]);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const r = await getChatMessages(id);
      // Avoid clobbering if user switched conversation mid-flight.
      if (selectedIdRef.current !== id) return;
      setConversation(r.conversation || null);
      setMessages(r.messages || []);
    } catch (e) {
      console.error('chat messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    setMessages([]);
    setConversation(null);
    loadMessages(selectedId);
    const t = setInterval(() => loadMessages(selectedId), MESSAGES_POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, selectedId]);

  async function handleSend(e) {
    e?.preventDefault();
    const txt = draft.trim();
    if (!txt || !selectedId || sending) return;
    setSending(true);
    try {
      await sendChatMessage(selectedId, txt);
      setDraft('');
      await loadMessages(selectedId);
      loadConversations();
    } catch (err) {
      showToast(err.message || 'Error al enviar mensaje', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!selectedId) return;
    if (!confirm('Cerrar esta conversacion?')) return;
    try {
      await closeChatConversation(selectedId);
      showToast('Conversacion cerrada', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'Error', 'error');
    }
  }

  async function handleReopen() {
    if (!selectedId) return;
    try {
      await reopenChatConversation(selectedId);
      showToast('Conversacion reabierta', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'Error', 'error');
    }
  }

  async function handleAssignToMe() {
    if (!selectedId) return;
    try {
      await assignChatConversation(selectedId);
      showToast('Conversacion asignada', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'Error', 'error');
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0);
  const openCount = conversations.filter(c => c.status === 'open').length;
  const unassignedCount = conversations.filter(c => c.status === 'open' && !c.assigned_to_id).length;

  const filteredConvs = conversations.filter(c => {
    if (!search) return true;
    const hay = (c.user_email + ' ' + c.user_name + ' ' + (c.last_message || '')).toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const statusTabs = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abiertas' },
    { value: 'closed', label: 'Cerradas' },
  ];
  const assignedTabs = [
    { value: 'all', label: 'Todas' },
    { value: 'me', label: 'Mis chats' },
    { value: 'unassigned', label: 'Sin asignar' },
  ];

  if (loadingList && conversations.length === 0) return <Spinner />;

  return (
    <>
      <PageHeader title="Chat" subtitle="Conversaciones con clientes" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Conversaciones abiertas" value={openCount} color="blue" />
        <StatCard label="Mensajes sin leer" value={totalUnread} color="red" />
        <StatCard label="Sin asignar" value={unassignedCount} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '70vh' }}>
        <Card className="lg:col-span-1 p-0 flex flex-col" style={{ maxHeight: '75vh' }}>
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <Input placeholder="Buscar por email, nombre o mensaje..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {statusTabs.map(t => (
                <button
                  key={t.value}
                  onClick={() => setStatusFilter(t.value)}
                  className={
                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ' +
                    (statusFilter === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }
                >
                  {t.label}
                </button>
              ))}
              <span className="w-px bg-slate-200 mx-1" />
              {assignedTabs.map(t => (
                <button
                  key={t.value}
                  onClick={() => setAssignedFilter(t.value)}
                  className={
                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ' +
                    (assignedFilter === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="py-12 text-center text-slate-300 text-sm">Sin conversaciones</div>
            ) : (
              filteredConvs.map(c => {
                const unread = parseInt(c.unread_count) || 0;
                const isActive = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={
                      'w-full text-left px-5 py-3.5 border-b border-slate-50 transition-colors flex gap-3 ' +
                      (isActive ? 'bg-indigo-50/60' : 'hover:bg-slate-50')
                    }
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(c.user_name || c.user_email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{c.user_name || c.user_email}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{fmtRelative(c.last_message_time || c.updated_at)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message || '(sin mensajes)'}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{unread}</span>
                        )}
                        {!c.assigned_to_id && c.status === 'open' && (
                          <Badge className="bg-amber-50 text-amber-700">Sin asignar</Badge>
                        )}
                        {c.status === 'closed' && (
                          <Badge className="bg-slate-100 text-slate-500">Cerrada</Badge>
                        )}
                        {c.status === 'open' && c.assigned_to_id && (
                          <Badge className="bg-emerald-50 text-emerald-700">Abierta</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-0 flex flex-col" style={{ maxHeight: '75vh' }}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">Selecciona una conversacion</h3>
              <p className="text-sm text-slate-400">Elige una de la lista para ver los mensajes</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">
                    {conversation?.user_name || conversation?.user_email || '...'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{conversation?.user_email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conversation && !conversation.assigned_to_id && (
                    <Button size="sm" variant="secondary" onClick={handleAssignToMe}>Asignarme</Button>
                  )}
                  {conversation?.status === 'open' ? (
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={handleClose}>Cerrar</Button>
                  ) : conversation?.status === 'closed' ? (
                    <Button size="sm" variant="secondary" onClick={handleReopen}>Reabrir</Button>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/40">
                {loadingMessages ? (
                  <Spinner />
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-300 text-sm py-12">Sin mensajes</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(m => {
                      const isAdmin = m.sender_role === 'admin' || m.sender_role === 'support';
                      const isSystem = m.sender_role === 'system';
                      if (isSystem) {
                        return (
                          <div key={m.id} className="text-center">
                            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px]">{m.message}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={m.id} className={'flex ' + (isAdmin ? 'justify-end' : 'justify-start')}>
                          <div className={'max-w-[75%] rounded-2xl px-4 py-2.5 ' + (isAdmin
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-md'
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md')}>
                            {!isAdmin && m.sender_name && (
                              <div className="text-[10px] font-semibold text-slate-400 mb-0.5">{m.sender_name}</div>
                            )}
                            <div className="text-sm whitespace-pre-wrap break-words">{m.message}</div>
                            <div className={'text-[10px] mt-1 ' + (isAdmin ? 'text-indigo-100' : 'text-slate-400')}>
                              {fmtDateTime(m.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-slate-100 p-3 flex items-end gap-2 shrink-0">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={conversation?.status === 'closed' ? 'Conversacion cerrada' : 'Escribe un mensaje... (Enter envia, Shift+Enter salto de linea)'}
                  disabled={conversation?.status === 'closed' || sending}
                  rows={2}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 outline-none transition-all duration-200 bg-white placeholder:text-slate-300 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                />
                <Button type="submit" disabled={!draft.trim() || sending || conversation?.status === 'closed'}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
