import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { getMyConversations } from '../api';
import { cn } from '../../shared/lib/utils';
import { Button, IconButton, CountBadge, EmptyState, Spinner } from '../../shared/components/UI';
import { MessageCircle, Plus, X, Expand } from '../../shared/components/Icons';
import { ListaConversaciones } from '../pages/mensajes/ListaConversaciones';
import { HiloConversacion } from '../pages/mensajes/Hilo';
import { NuevaConversacion } from '../pages/mensajes/NuevaConversacion';

/**
 * Lanzador del chat. Solo en escritorio (≥ lg): en móvil "Mensajes" ya está
 * en la barra inferior y un botón flotante taparía las acciones. En la propia
 * bandeja (/messages) no se muestra. Abre un popover de 380×560 que reutiliza
 * los componentes del hilo; "Abrir en Mensajes" lleva a la bandeja con la
 * misma conversación.
 */
export default function ChatWidget() {
  const { isAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'thread' | 'new'
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastUnreadRef = useRef(0);
  const fabRef = useRef(null);
  const panelRef = useRef(null);

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
        } catch { /* el sonido es opcional */ }
      }
      lastUnreadRef.current = u;
      setUnread(u);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    if (!isAuth) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConvs();
    const t = setInterval(refreshConvs, 30000);
    return () => clearInterval(t);
  }, [isAuth, refreshConvs]);

  // Al abrir, el foco entra al panel; al cerrar vuelve al botón.
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => panelRef.current?.querySelector('button, input, textarea')?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, view]);

  function cerrar() {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }

  async function abrir() {
    setOpen(true);
    setView('list');
    setActiveId(null);
    setLoading(true);
    await refreshConvs();
    setLoading(false);
  }

  function elegir(c) {
    setActiveId(c.id);
    setView('thread');
  }

  async function onCreated(newId) {
    await refreshConvs();
    if (newId) { setActiveId(newId); setView('thread'); } else { setView('list'); }
  }

  function expandir() {
    setOpen(false);
    navigate('/messages', { state: { conversationId: view === 'thread' ? activeId : null } });
  }

  if (!isAuth || location.pathname.startsWith('/messages')) return null;

  return (
    <>
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={abrir}
          aria-label={unread > 0 ? `Abrir chat, ${unread} sin leer` : 'Abrir chat'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          className="hidden lg:inline-flex fixed right-6 z-fab h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop hover:bg-brand-700 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          style={{ bottom: 'calc(var(--tabbar-space, 0px) + 1.5rem)' }}
        >
          <MessageCircle size={22} />
          {unread > 0 && <CountBadge value={unread} tone="danger" className="absolute -top-1 -right-1 ring-2 ring-surface" />}
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label="Mensajes"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } }}
          className="hidden lg:flex flex-col fixed right-6 bottom-6 z-fab w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100dvh-3rem)] bg-surface rounded-xl border border-line shadow-modal overflow-hidden ov-pop"
        >
          <div className="flex items-center gap-2 px-4 h-12 border-b border-line shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 leading-5">Mensajes</p>
              <p className="text-xs text-ink-500 leading-4">Responde en horario hábil</p>
            </div>
            <IconButton icon={Expand} size="sm" aria-label="Abrir en Mensajes" onClick={expandir} />
            <IconButton icon={X} size="sm" aria-label="Cerrar chat" onClick={cerrar} />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {view === 'list' && (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                  {loading ? (
                    <Spinner size="sm" label="Cargando…" className="py-10" />
                  ) : conversations.length === 0 ? (
                    <EmptyState compact icon={MessageCircle} title="Aún no tienes conversaciones" description="Escríbele al equipo; te respondemos en horario hábil." />
                  ) : (
                    <ListaConversaciones conversations={conversations} onSelect={elegir} compact />
                  )}
                </div>
                <div className="p-2.5 border-t border-line shrink-0">
                  <Button variant={conversations.length === 0 ? 'primary' : 'secondary'} size="sm" block icon={Plus} onClick={() => setView('new')}>Nueva conversación</Button>
                </div>
              </>
            )}
            {view === 'new' && (
              <div className={cn('flex-1 min-h-0 overflow-y-auto p-4')}>
                <NuevaConversacion compact onCreated={onCreated} onCancel={() => setView('list')} />
              </div>
            )}
            {view === 'thread' && activeId && (
              <HiloConversacion
                key={activeId}
                conversationId={activeId}
                conversations={conversations}
                onConversationUpdate={refreshConvs}
                onBack={() => setView('list')}
                compact
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
