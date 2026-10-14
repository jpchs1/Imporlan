import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getMyConversations } from '../api';
import { cn } from '../../shared/lib/utils';
import { Card, Button, Modal, PageHeader, EmptyState, ErrorState, SearchInput, FilterChips, Skeleton } from '../../shared/components/UI';
import { MessageCircle, Plus, WhatsAppIcon } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { BotonEnlace } from './inicio/BotonEnlace';
import { WA_AYUDA as WA } from './inicio/whatsapp';
import { ListaConversaciones } from './mensajes/ListaConversaciones';
import { HiloConversacion } from './mensajes/Hilo';
import { NuevaConversacion } from './mensajes/NuevaConversacion';

/**
 * Bandeja de mensajes: lista + hilo, a toda la altura útil bajo la barra
 * superior. Es la única implementación del chat; el lanzador flotante
 * (`ChatWidget`) reutiliza estos mismos componentes.
 */
export default function Messages() {
  const toast = useToast();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(location.state?.conversationId || null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | unread | closed
  const [intento, setIntento] = useState(0);

  const aplicar = useCallback((list) => {
    setConversations(list);
    setError(null);
    // En escritorio se abre la primera de entrada: la bandeja vacía a la
    // derecha no le sirve a nadie. En móvil la lista va primero.
    if (window.matchMedia('(min-width: 768px)').matches && list.length > 0) {
      setSelectedId(prev => (prev && list.some(c => c.id === prev)) ? prev : list[0].id);
    }
  }, []);

  // Carga inicial (y reintento). El refresco posterior lo pide el hilo.
  useEffect(() => {
    let activo = true;
    getMyConversations()
      .then(data => { if (activo) aplicar(data.conversations || []); })
      .catch(e => { if (activo) setError(e); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [aplicar, intento]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getMyConversations();
      aplicar(data.conversations || []);
    } catch { /* el próximo refresco lo reintenta */ }
  }, [aplicar]);

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0);
  const closedCount = conversations.filter(c => c.status === 'closed').length;

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (filter === 'unread' && !(c.unread_count > 0)) return false;
      if (filter === 'closed' && c.status !== 'closed') return false;
      if (t) {
        const hay = `${c.assigned_to_name || ''} ${c.subject || ''} ${c.last_message || c.last_message_text || ''}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [conversations, filter, search]);

  async function onCreated(id) {
    setShowNew(false);
    toast?.({ type: 'success', title: 'Conversación iniciada', description: 'Un agente te responde en horario hábil.' });
    await loadConversations();
    setSelectedId(id);
  }

  const sinConversaciones = !loading && !error && conversations.length === 0;

  return (
    <div className="pb-2">
      <PageHeader
        title="Mensajes"
        description="Habla con tu agente y con el equipo Imporlan. Respondemos en horario hábil."
        actions={(
          <>
            <BotonEnlace href={WA} icon={WhatsAppIcon}>WhatsApp</BotonEnlace>
            {!sinConversaciones && <Button icon={Plus} onClick={() => setShowNew(true)}>Nueva conversación</Button>}
          </>
        )}
      />

      {loading ? (
        <Card padding="none" className="overflow-hidden flex" style={{ height: 'calc(100dvh - var(--topbar-h) - var(--tabbar-space) - 12rem)', minHeight: 520 }}>
          <div className="hidden md:block w-[340px] border-r border-line p-3 space-y-3" aria-hidden="true">
            <Skeleton className="h-8 w-full" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
          <div className="flex-1 p-5 space-y-3" aria-hidden="true">
            <Skeleton className="h-12 w-2/3 rounded-lg" />
            <Skeleton className="h-12 w-1/2 ml-auto rounded-lg" />
            <Skeleton className="h-10 w-1/3 rounded-lg" />
          </div>
        </Card>
      ) : error ? (
        <Card padding="none"><ErrorState message="No pudimos cargar tus conversaciones." detail={error} onRetry={() => { setLoading(true); setIntento(n => n + 1); }} /></Card>
      ) : sinConversaciones ? (
        <Card padding="none">
          <EmptyState
            icon={MessageCircle}
            title="Aún no tienes conversaciones"
            description="Escríbele al equipo Imporlan desde aquí: te respondemos en horario hábil, normalmente dentro de 48 horas."
            primaryAction={<Button icon={Plus} onClick={() => setShowNew(true)}>Escribir al equipo</Button>}
            secondaryAction={<BotonEnlace href={WA} variant="ghost" icon={WhatsAppIcon}>También por WhatsApp</BotonEnlace>}
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden flex" style={{ height: 'calc(100dvh - var(--topbar-h) - var(--tabbar-space) - 12rem)', minHeight: 520 }}>
          {/* Lista */}
          <aside className={cn('w-full md:w-[340px] md:border-r border-line flex flex-col shrink-0 min-h-0', selectedId && 'hidden md:flex')} aria-label="Lista de conversaciones">
            <div className="p-3 border-b border-line space-y-2">
              <SearchInput size="sm" value={search} onChange={setSearch} placeholder="Buscar conversación" />
              <FilterChips
                size="sm"
                aria-label="Filtrar conversaciones"
                options={[
                  { id: 'all', label: 'Todas', count: conversations.length },
                  { id: 'unread', label: 'Sin leer', count: totalUnread },
                  { id: 'closed', label: 'Cerradas', count: closedCount },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
              {filtered.length === 0 ? (
                <EmptyState compact title="Sin coincidencias" description="Prueba con otro filtro o borra la búsqueda."
                  primaryAction={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setFilter('all'); }}>Limpiar</Button>} />
              ) : (
                <ListaConversaciones conversations={filtered} selectedId={selectedId} onSelect={c => setSelectedId(c.id)} />
              )}
            </div>
          </aside>

          {/* Hilo */}
          <section className={cn('flex-1 min-w-0 min-h-0 flex flex-col', !selectedId && 'hidden md:flex')} aria-label="Conversación">
            {selectedId ? (
              <HiloConversacion
                key={selectedId}
                conversationId={selectedId}
                conversations={conversations}
                onConversationUpdate={loadConversations}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <EmptyState icon={MessageCircle} title="Elige una conversación" description="O inicia una nueva con el equipo Imporlan." className="my-auto" />
            )}
          </section>
        </Card>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva conversación" description="Cuéntanos qué necesitas; un agente te responde en horario hábil.">
        <NuevaConversacion onCreated={onCreated} onCancel={() => setShowNew(false)} />
      </Modal>
    </div>
  );
}
