import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  closeChatConversation,
  reopenChatConversation,
  assignChatConversation,
} from '../api';
import { fmtDateTime, decodeHtml, cn } from '../../shared/lib/utils';
import { fmtRelativo, fmtDateLarga } from '../../shared/lib/format';
import { PageHeader, Card, Button, IconButton, SearchInput, SegmentedControl, FilterChips, Avatar, StatusBadge, CountBadge, Skeleton, EmptyState, useConfirm } from '../../shared/components/UI';
import { Send, MessageCircle, ArrowLeft, UserPlus, Archive, RotateCw } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

const LIST_POLL_MS = 10000;
const MESSAGES_POLL_MS = 3000;

const ESTADOS = [
  { id: 'all', label: 'Todas' },
  { id: 'open', label: 'Abiertas' },
  { id: 'closed', label: 'Cerradas' },
];
const ASIGNACION = [
  { id: 'all', label: 'Cualquier agente' },
  { id: 'me', label: 'Mis chats' },
  { id: 'unassigned', label: 'Sin asignar' },
];

function estadoConversacion(c) {
  if (c.status === 'closed') return 'closed';
  if (c.status === 'open' && !c.assigned_to_id) return 'unassigned';
  return c.status || 'open';
}

function fechaDia(ts) {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T'));
  return isNaN(d) ? '' : d.toDateString();
}

export default function Chat() {
  const showToast = useToast();
  const confirm = useConfirm();
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

  const selectedIdRef = useRef(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

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
      // Si el admin cambió de conversación mientras cargaba, esta respuesta no vale.
      if (selectedIdRef.current !== id) return;
      setConversation(r.conversation || null);
      setMessages(r.messages || []);
    } catch (e) {
      console.error('chat messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Con la pestaña oculta no se consulta: cada lectura marca los mensajes como
  // leídos y el admin los perdería sin haberlos visto.
  useEffect(() => {
    loadConversations();
    const t = setInterval(() => { if (!document.hidden) loadConversations(); }, LIST_POLL_MS);
    const onVis = () => { if (!document.hidden) loadConversations(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    setMessages([]);
    setConversation(null);
    loadMessages(selectedId);
    const t = setInterval(() => { if (!document.hidden) loadMessages(selectedId); }, MESSAGES_POLL_MS);
    const onVis = () => { if (!document.hidden) loadMessages(selectedId); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [selectedId, loadMessages]);

  // Baja al último mensaje solo si el admin ya estaba abajo (o al cambiar de
  // conversación), y moviendo solo el panel de mensajes, no toda la página.
  const scrollBoxRef = useRef(null);
  const stickToBottom = useRef(true);
  useEffect(() => { stickToBottom.current = true; }, [selectedId]);
  useEffect(() => {
    const box = scrollBoxRef.current;
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight;
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
      showToast(err.message || 'No se pudo enviar el mensaje', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!selectedId) return;
    const ok = await confirm({
      title: '¿Cerrar esta conversación?',
      description: 'El cliente recibe un correo avisando el cierre. Se puede reabrir después.',
      confirmLabel: 'Cerrar conversación',
    });
    if (!ok) return;
    try {
      await closeChatConversation(selectedId);
      showToast('Conversación cerrada', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'No se pudo cerrar la conversación', 'error');
    }
  }

  async function handleReopen() {
    if (!selectedId) return;
    try {
      await reopenChatConversation(selectedId);
      showToast('Conversación reabierta', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'No se pudo reabrir la conversación', 'error');
    }
  }

  async function handleAssignToMe() {
    if (!selectedId) return;
    try {
      await assignChatConversation(selectedId);
      showToast('Conversación asignada', 'success');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      showToast(err.message || 'No se pudo asignar la conversación', 'error');
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

  const cerrada = conversation?.status === 'closed';
  const descripcion = loadingList && conversations.length === 0
    ? 'Cargando conversaciones…'
    : `${openCount} ${openCount === 1 ? 'abierta' : 'abiertas'} · ${totalUnread} sin leer${unassignedCount ? ` · ${unassignedCount} sin asignar` : ''}`;

  return (
    <>
      <PageHeader title="Chat" description={descripcion} className="mb-4" />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 h-[calc(100dvh-var(--topbar-h)-9.5rem)] min-h-[560px]">
        {/* Lista */}
        <Card padding="none" className={cn('flex flex-col min-h-0 overflow-hidden', selectedId && 'hidden lg:flex')}>
          <div className="px-4 pt-4 pb-3 border-b border-line space-y-3 shrink-0">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, correo o mensaje" size="sm" />
            <div className="flex flex-col gap-2">
              <SegmentedControl aria-label="Estado de la conversación" size="sm" options={ESTADOS} value={statusFilter} onChange={setStatusFilter} className="self-start" />
              <FilterChips aria-label="Asignación" size="sm" options={ASIGNACION} value={assignedFilter} onChange={setAssignedFilter} className="flex-wrap" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain" role="list" aria-label="Conversaciones">
            {loadingList && conversations.length === 0 ? (
              <div className="p-4 space-y-4">{[0, 1, 2].map(i => <Skeleton.Text key={i} lines={2} />)}</div>
            ) : filteredConvs.length === 0 ? (
              <EmptyState compact icon={MessageCircle} title="Sin conversaciones" description={search ? 'Nadie coincide con la búsqueda.' : 'Cuando un cliente escriba, aparecerá aquí.'} />
            ) : (
              filteredConvs.map(c => {
                const unread = parseInt(c.unread_count) || 0;
                const isActive = selectedId === c.id;
                return (
                  <div key={c.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-line flex gap-3 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
                        isActive ? 'bg-brand-50' : 'hover:bg-canvas',
                      )}
                    >
                      <Avatar name={c.user_name || c.user_email} size="lg" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-sm truncate', unread > 0 ? 'font-semibold text-ink-900' : 'font-medium text-ink-900')}>{c.user_name || c.user_email}</span>
                          <span className="text-xs text-ink-500 shrink-0" title={fmtDateLarga(c.last_message_time || c.updated_at, { hora: true })}>{fmtRelativo(c.last_message_time || c.updated_at)}</span>
                        </div>
                        <p className={cn('text-13 truncate mt-0.5', unread > 0 ? 'text-ink-900' : 'text-ink-500')}>{c.last_message ? decodeHtml(c.last_message) : 'Sin mensajes'}</p>
                        <div className="flex items-center gap-2 mt-1.5 min-w-0">
                          <CountBadge value={unread} tone="danger" />
                          <StatusBadge kind="conversacion" status={estadoConversacion(c)} size="sm" />
                          {c.assigned_to_name && c.status === 'open' && <span className="text-xs text-ink-500 truncate">{c.assigned_to_name}</span>}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Hilo */}
        <Card padding="none" className={cn('flex flex-col min-h-0 overflow-hidden', !selectedId && 'hidden lg:flex')}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageCircle} title="Elige una conversación" description="Selecciona un chat de la lista para leer los mensajes y responder." />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0">
                <IconButton icon={ArrowLeft} aria-label="Volver a la lista" variant="ghost" size="sm" className="lg:hidden -ml-1" onClick={() => setSelectedId(null)} />
                <Avatar name={conversation?.user_name || conversation?.user_email || '?'} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{conversation?.user_name || conversation?.user_email || 'Cargando…'}</p>
                    {conversation && <StatusBadge kind="conversacion" status={estadoConversacion(conversation)} size="sm" className="hidden sm:inline-flex" />}
                  </div>
                  <p className="text-xs text-ink-500 truncate">
                    {conversation?.user_email}
                    {conversation?.assigned_to_name && <span> · Atiende {conversation.assigned_to_name}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full justify-end sm:w-auto">
                  {conversation && !conversation.assigned_to_id && conversation.status !== 'closed' && (
                    <Button size="sm" variant="secondary" icon={UserPlus} onClick={handleAssignToMe}>Asignarme</Button>
                  )}
                  {conversation?.status === 'open' ? (
                    <Button size="sm" variant="ghost" icon={Archive} onClick={handleClose}>Cerrar</Button>
                  ) : conversation?.status === 'closed' ? (
                    <Button size="sm" variant="secondary" icon={RotateCw} onClick={handleReopen}>Reabrir</Button>
                  ) : null}
                </div>
              </div>

              <div
                ref={scrollBoxRef}
                onScroll={e => { const b = e.currentTarget; stickToBottom.current = b.scrollHeight - b.scrollTop - b.clientHeight < 80; }}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 bg-canvas"
                role="log"
                aria-live="polite"
                aria-label="Mensajes"
              >
                {loadingMessages ? (
                  <div className="space-y-4 max-w-md"><Skeleton.Text lines={2} /><Skeleton.Text lines={1} className="ml-auto w-2/3" /><Skeleton.Text lines={2} /></div>
                ) : messages.length === 0 ? (
                  <EmptyState compact icon={MessageCircle} title="Sin mensajes" />
                ) : (
                  <div className="space-y-2">
                    {messages.map((m, i) => {
                      const isTeam = ['admin', 'support', 'agent'].includes(m.sender_role);
                      const isSystem = m.sender_role === 'system';
                      const nuevoDia = i === 0 || fechaDia(m.timestamp) !== fechaDia(messages[i - 1].timestamp);
                      const mismoAutor = i > 0 && !nuevoDia && messages[i - 1].sender_role === m.sender_role && messages[i - 1].sender_name === m.sender_name;
                      return (
                        <div key={m.id}>
                          {nuevoDia && m.timestamp && (
                            <div className="flex items-center gap-3 my-3" aria-hidden="true">
                              <span className="flex-1 border-t border-line" />
                              <span className="text-xs text-ink-500">{fmtDateLarga(m.timestamp)}</span>
                              <span className="flex-1 border-t border-line" />
                            </div>
                          )}
                          {isSystem ? (
                            <p className="text-center my-2"><span className="inline-block px-3 py-1 rounded-sm bg-neutral-bg text-ink-500 text-xs">{decodeHtml(m.message)}</span></p>
                          ) : (
                            <div className={cn('flex', isTeam ? 'justify-end' : 'justify-start', !mismoAutor && 'mt-3')}>
                              <div className={cn(
                                'max-w-[78%] rounded-lg px-3.5 py-2',
                                isTeam ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-surface border border-line text-ink-700 rounded-bl-sm',
                              )}>
                                {!mismoAutor && m.sender_name && (
                                  <p className={cn('text-xs font-semibold mb-0.5', isTeam ? 'text-brand-100' : 'text-ink-500')}>{m.sender_name}</p>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">{decodeHtml(m.message)}</p>
                                <p className={cn('text-xs mt-1 tabular', isTeam ? 'text-brand-100' : 'text-ink-500')} title={fmtDateTime(m.timestamp)}>
                                  {fmtDateLarga(m.timestamp, { hora: true }).split(', ')[1] || fmtDateTime(m.timestamp)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-line p-3 flex items-end gap-2 shrink-0 bg-surface">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  aria-label="Mensaje"
                  placeholder={cerrada ? 'La conversación está cerrada' : 'Escribe un mensaje… Enter envía, Shift+Enter salta de línea'}
                  disabled={cerrada || sending}
                  rows={2}
                  className="flex-1 min-w-0 px-3 py-2 bg-surface text-ink-900 border border-line-strong rounded-md text-sm placeholder:text-ink-400 resize-none transition-colors duration-150 hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:bg-canvas disabled:text-ink-500"
                />
                <Button type="submit" icon={Send} loading={sending} disabled={!draft.trim() || cerrada}>Enviar</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
