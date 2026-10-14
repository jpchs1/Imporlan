import { useState, useEffect, useRef } from 'react';
import { getMessages, sendMessage, pollMessages } from '../../api';
import { cn } from '../../../shared/lib/utils';
import { fmtDateLarga, fmtRelativo } from '../../../shared/lib/format';
import { useAuth } from '../../../shared/context/AuthContext';
import { Avatar, Badge, IconButton, Skeleton, StatusBadge, EmptyState } from '../../../shared/components/UI';
import { ArrowLeft, Send, Check, Loader, MessageCircle } from '../../../shared/components/Icons';
import { useToast } from '../../../shared/components/Toast';
import { fmtHora, fmtSeparador, textoDe, fechaDe, nombreConversacion, agruparMensajes } from './formato';

function Burbuja({ msg, showAvatar }) {
  const texto = textoDe(msg);
  const fecha = fechaDe(msg);
  if (msg.sender_role === 'system') {
    return (
      <div className="flex justify-center my-1">
        <p className="px-3 py-1 rounded-sm bg-neutral-bg text-ink-700 text-xs max-w-[85%] text-center">{texto}</p>
      </div>
    );
  }
  const mio = msg.sender_role === 'user';
  return (
    <div className={cn('flex gap-2', mio ? 'justify-end' : 'justify-start')}>
      {!mio && (
        <span className={cn('shrink-0 self-end', !showAvatar && 'invisible')}>
          <Avatar name={msg.sender_name || 'Imporlan'} size="sm" />
        </span>
      )}
      <div className={cn('max-w-[78%] min-w-0', mio ? 'items-end' : 'items-start')}>
        {!mio && showAvatar && <p className="text-xs font-medium text-ink-500 mb-1 ml-0.5">{msg.sender_name || 'Equipo Imporlan'}</p>}
        <div className={cn(
          'px-3.5 py-2 text-sm leading-relaxed',
          mio ? 'bg-brand-600 text-white rounded-lg rounded-br-sm' : 'bg-surface border border-line text-ink-700 rounded-lg rounded-bl-sm',
        )}>
          <p className="whitespace-pre-wrap break-words">{texto}</p>
          <p className={cn('flex items-center gap-1 mt-1 text-xs tabular', mio ? 'justify-end text-brand-100' : 'text-ink-500')}>
            <time dateTime={fecha || undefined} title={fecha ? fmtDateLarga(fecha, { hora: true }) : undefined}>{fmtHora(fecha)}</time>
            {mio && !msg._optimistic && <Check size={12} aria-label="Enviado" />}
            {msg._optimistic && <Loader size={12} className="spin" aria-label="Enviando" />}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Une lo que manda el servidor con lo que el cliente acaba de escribir y
 * todavía está en vuelo. El servidor (`user_messages`) ya trae los mensajes
 * propios confirmados; los optimistas sin confirmar se conservan al final.
 */
function mezclar(servidor, previos) {
  const ids = new Set(servidor.map(m => String(m.id)));
  const enVuelo = previos.filter(m => m._optimistic && !ids.has(String(m.id)));
  return [...servidor, ...enVuelo];
}

/**
 * Hilo de una conversación: cabecera, mensajes y cuadro de respuesta. Lo usan
 * la bandeja (`Messages`) y el lanzador (`ChatWidget`) con `compact`.
 *
 * Polling (`pollMessages`, cada 5 s): el servidor sólo devuelve mensajes de
 * remitentes distintos de `user` (api/chat_api.php, `action=poll`), así que
 * los mensajes propios nunca llegan por ahí. Por eso el polling no descarta
 * nada de lo que ya hay: sólo agrega lo nuevo. El mensaje propio pasa de
 * optimista («Enviando») a confirmado cuando `user_send` responde con su
 * `message_id`, y después se vuelve a pedir el hilo completo para quedar con
 * la marca de tiempo real del servidor.
 */
export function HiloConversacion({ conversationId, conversations = [], onConversationUpdate, onBack, compact = false, className }) {
  const toast = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const pollRef = useRef(null);
  const lastCheckRef = useRef(null);

  const conv = conversations.find(c => c.id === conversationId);
  const cerrada = conv?.status === 'closed';
  const nombre = nombreConversacion(conv);
  const ultimoMensaje = conv?.last_message_time || conv?.updated_at;

  // Carga inicial del hilo (cancelable: si cambia la conversación antes de
  // que responda, la respuesta vieja no pisa la nueva).
  useEffect(() => {
    let activo = true;
    getMessages(conversationId)
      .then(data => {
        if (!activo) return;
        setMessages(data.messages || data.data || []);
        lastCheckRef.current = new Date().toISOString();
      })
      .catch(() => { if (activo) toast?.({ type: 'error', title: 'No pudimos cargar los mensajes', description: 'Vuelve a intentarlo en un momento.' }); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [conversationId, toast]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const data = await pollMessages(lastCheckRef.current, conversationId);
        if (data.new_messages?.length > 0) {
          setMessages(prev => {
            // Nada se borra: ni los confirmados ni los que siguen en vuelo.
            const existingIds = new Set(prev.map(m => String(m.id)));
            const newMsgs = data.new_messages.filter(m => !existingIds.has(String(m.id)));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
          onConversationUpdate?.();
        }
        if (data.server_time) lastCheckRef.current = data.server_time;
      } catch { /* silencioso */ }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [conversationId, onConversationUpdate]);

  // El cuadro crece con el texto (hasta 6 líneas).
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
    const optimistic = { id: `optimistic-${Date.now()}`, _optimistic: true, sender_role: 'user', sender_name: user?.name || 'Tú', message: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await sendMessage(conversationId, msg);
      // Confirmado: el servidor ya lo guardó (`user_send` → `message_id`).
      // Deja de decir «Enviando» de inmediato, con el id persistido.
      const idReal = res?.message_id ?? res?.id;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...m, id: idReal ?? m.id, _optimistic: false } : m));
      onConversationUpdate?.();
      // Y se vuelve a pedir el hilo para tener la hora real del servidor; si
      // falla, el confirmado local se queda tal cual.
      try {
        const data = await getMessages(conversationId);
        const lista = data.messages || data.data;
        if (Array.isArray(lista)) setMessages(prev => mezclar(lista, prev));
      } catch { /* el confirmado local vale */ }
    } catch {
      toast?.({ type: 'error', title: 'No se envió el mensaje', description: 'Revisa tu conexión y vuelve a intentarlo.' });
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(msg);
    }
    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const grupos = agruparMensajes(messages);

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-canvas', className)}>
      {/* Cabecera */}
      <div className={cn('flex items-center gap-3 bg-surface border-b border-line shrink-0', compact ? 'px-3 py-2' : 'px-4 py-3')}>
        {onBack && <IconButton icon={ArrowLeft} aria-label="Volver a la lista" onClick={onBack} className={cn(!compact && 'md:hidden', '-ml-1.5')} />}
        <Avatar name={nombre} size={compact ? 'md' : 'lg'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900 truncate">{nombre}</p>
          <p className="text-xs text-ink-500 truncate">
            {conv?.subject && <span>{conv.subject} · </span>}
            {cerrada
              ? 'Conversación cerrada'
              : ultimoMensaje
                ? <>Responde en horario hábil · Último mensaje <time dateTime={ultimoMensaje} title={fmtDateLarga(ultimoMensaje, { hora: true })}>{fmtRelativo(ultimoMensaje)}</time></>
                : 'Responde en horario hábil'}
          </p>
        </div>
        {cerrada && <StatusBadge kind="conversacion" status="closed" />}
      </div>

      {/* Mensajes */}
      <div
        className={cn('flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500', compact ? 'px-3 py-3' : 'px-4 py-4')}
        role="region"
        aria-label={`Mensajes con ${nombre}`}
        aria-live="polite"
        tabIndex={0}
      >
        {loading ? (
          <div className="space-y-3 max-w-md" aria-hidden="true">
            <Skeleton className="h-12 w-2/3 rounded-lg" />
            <Skeleton className="h-16 w-3/4 ml-auto rounded-lg" />
            <Skeleton className="h-10 w-1/2 rounded-lg" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState compact icon={MessageCircle} title="Todavía no hay mensajes" description="Escribe el primero; te respondemos en horario hábil." />
        ) : grupos.map(g => g.type === 'date' ? (
          <div key={g.key} className="flex justify-center py-2">
            <Badge tone="neutral" size="sm" className="capitalize">{fmtSeparador(g.date)}</Badge>
          </div>
        ) : (
          <Burbuja key={g.key} msg={g.msg} showAvatar={g.showAvatar} />
        ))}
        <div ref={endRef} />
      </div>

      {/* Respuesta */}
      {cerrada ? (
        <div className="px-4 py-3 bg-surface border-t border-line text-13 text-ink-500 text-center shrink-0">
          Esta conversación está cerrada. Si necesitas algo más, inicia una nueva.
        </div>
      ) : (
        <div className={cn('bg-surface border-t border-line shrink-0', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje…"
              aria-label="Escribe un mensaje"
              rows={1}
              className="flex-1 min-h-9 max-h-40 w-full bg-surface text-ink-900 text-sm border border-line-strong rounded-md px-3 py-2 resize-none leading-5 placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
            <IconButton icon={Send} variant="primary" aria-label="Enviar mensaje" onClick={handleSend} disabled={!text.trim()} loading={sending} />
          </div>
          {!compact && <p className="hidden sm:block mt-1.5 text-xs text-ink-500">Enter envía · Shift + Enter agrega una línea</p>}
        </div>
      )}
    </div>
  );
}
