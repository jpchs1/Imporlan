import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { PageHeader, Card, Button, Input, Textarea } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';
import { submitSupportRequest } from '../api';

export default function Quotation() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState(['']);
  const [comments, setComments] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function addLink() { if (links.length < 10) setLinks([...links, '']); }
  function removeLink(i) { setLinks(links.filter((_, idx) => idx !== i)); }
  function updateLink(i, val) { setLinks(links.map((l, idx) => idx === i ? val : l)); }

  async function handleSubmit(e) {
    e.preventDefault();
    const validLinks = links.filter(l => l.trim());
    if (validLinks.length === 0) { toast?.('Agrega al menos un link', 'error'); return; }
    setSending(true);
    try {
      const message = `COTIZACION POR LINKS\n\nLinks:\n${validLinks.map((l, i) => `${i + 1}. ${l}`).join('\n')}${comments ? `\n\nComentarios:\n${comments}` : ''}`;
      await submitSupportRequest({
        name: user?.name || '',
        email: user?.email || user?.user_email || '',
        subject: 'Solicitud de cotizacion',
        message,
      });
      setSent(true);
      toast?.('Cotizacion enviada correctamente', 'success');
    } catch (e) {
      toast?.(e.message || 'Error al enviar', 'error');
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div>
        <PageHeader title="Cotizador Online" subtitle="Cotizacion por links" />
        <Card className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Cotizacion Enviada</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">Tu solicitud fue recibida. El equipo Imporlan te contactara con la cotizacion en las proximas 24-48 horas.</p>
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="secondary" onClick={() => { setSent(false); setLinks(['']); setComments(''); }}>Nueva Cotizacion</Button>
            <Button variant="accent" onClick={() => navigate('/dashboard')}>Ir al Inicio</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cotizador Online" subtitle="Envia links de embarcaciones para recibir una cotizacion" />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex gap-3">
            <svg className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="text-sm text-cyan-800 font-medium">Como funciona?</p>
              <p className="text-xs text-cyan-600 mt-1">Pega los links de las embarcaciones que te interesan (de BoatTrader, YachtWorld u otros sitios) y te enviaremos una cotizacion con el precio puesto en Chile.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Links de Embarcaciones</label>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={e => updateLink(i, e.target.value)}
                    placeholder={`https://www.boattrader.com/...`}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition-all bg-white"
                  />
                  {links.length > 1 && (
                    <button type="button" onClick={() => removeLink(i)} className="px-2 text-red-400 hover:text-red-600 transition"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}
                </div>
              ))}
            </div>
            {links.length < 10 && (
              <button type="button" onClick={addLink} className="mt-2 text-xs text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg> Agregar otro link
              </button>
            )}
          </div>

          <Textarea label="Comentarios (opcional)" value={comments} onChange={e => setComments(e.target.value)} placeholder="Detalles adicionales, presupuesto maximo, etc..." />

          <Button variant="accent" type="submit" disabled={sending} className="w-full">
            {sending ? 'Enviando...' : 'Enviar Cotizacion'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
