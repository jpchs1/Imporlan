import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../../shared/components/UI';
import { Waves, ArrowRight } from '../../../shared/components/Icons';

/**
 * Tarjeta discreta del partner Deckeva (pisos de goma EVA). Solo aparece en
 * el detalle desde la etapa Compra: es cuando tiene sentido pensar en el
 * piso. Sin cifras inventadas; el detalle vive en la ruta /deckeva.
 */
export default function TarjetaPartner() {
  const navigate = useNavigate();
  return (
    <Card as="aside" aria-label="Pisos Deckeva">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-bg text-ink-700"><Waves size={18} /></span>
        <div className="min-w-0">
          <p className="eyebrow">Partner · Deckeva</p>
          <p className="mt-1 text-sm font-semibold text-ink-900">Estrena tu lancha con piso de goma EVA a medida</p>
          <p className="mt-1 text-13 text-ink-500">Antideslizante, cómodo y fabricado en Chile. Puedes cotizarlo mientras tu lancha viene en camino.</p>
          <Button variant="secondary" size="sm" iconRight={ArrowRight} className="mt-3" onClick={() => navigate('/deckeva')}>Ver pisos Deckeva</Button>
        </div>
      </div>
    </Card>
  );
}
