import { useState } from 'react';
import { startConversation } from '../../api';
import { Button, Textarea } from '../../../shared/components/UI';
import { WhatsAppIcon } from '../../../shared/components/Icons';
import { WA_AYUDA } from '../inicio/whatsapp';

/**
 * Formulario para abrir una conversación nueva con el equipo. Lo usan el
 * modal de la bandeja y el popover del lanzador. `onCreated(conversationId)`.
 */
export function NuevaConversacion({ onCreated, onCancel, autoFocus = true, compact = false }) {
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e) {
    e?.preventDefault();
    const msg = mensaje.trim();
    if (!msg || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const data = await startConversation('', msg);
      if (data?.success && (data.conversation_id || data.id)) {
        setMensaje('');
        onCreated?.(data.conversation_id || data.id);
      } else {
        setError(data?.error || 'No pudimos crear la conversación. Vuelve a intentarlo.');
      }
    } catch (err) {
      setError(err?.message || 'No pudimos conectar con el servidor. Vuelve a intentarlo.');
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Textarea
        label="Tu mensaje"
        value={mensaje}
        onChange={e => setMensaje(e.target.value)}
        placeholder="Hola, tengo una consulta sobre…"
        rows={compact ? 4 : 5}
        maxLength={2000}
        showCount
        required
        error={error}
        hint="Te respondemos en horario hábil, normalmente dentro de 48 horas."
        data-autofocus={autoFocus ? '' : undefined}
      />
      <p className="text-13 text-ink-500">
        ¿Es urgente? Escríbenos por{' '}
        <a href={WA_AYUDA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
          <WhatsAppIcon size={14} /> WhatsApp
        </a>.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" size={compact ? 'sm' : 'md'} loading={enviando} disabled={!mensaje.trim()}>Enviar mensaje</Button>
      </div>
    </form>
  );
}
