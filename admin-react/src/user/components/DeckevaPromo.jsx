import { Link } from 'react-router-dom';
import { cn } from '../../shared/lib/utils';
import { ExternalLink } from '../../shared/components/Icons';

// Tarjeta de partner (una fila, tokens neutros): Deckeva es la empresa de
// pisos del mismo grupo que Imporlan. `context` va en utm_content para
// saber desde qué pantalla del panel llega cada visita a deckeva.cl.
const IMG = `${import.meta.env.BASE_URL}partners/deckeva/piso-de-lancha.webp`;

export default function DeckevaPromo({ context = 'panel', title, className = '' }) {
  const utm = `utm_source=imporlan&utm_medium=panel&utm_campaign=partner_deckeva&utm_content=${encodeURIComponent(context)}`;
  return (
    <aside aria-label="Pisos Deckeva" className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 rounded-lg border border-line bg-surface shadow-card px-4 py-3', className)}>
      <img src={IMG} alt="" loading="lazy" className="h-14 w-14 rounded-md object-cover bg-neutral-bg shrink-0 hidden sm:block" />
      <div className="min-w-0 flex-1">
        <p className="eyebrow m-0">Deckeva · empresa del grupo Imporlan</p>
        <p className="text-sm text-ink-900 mt-0.5 m-0">
          {title || 'Cuando llegue tu lancha, estrénala con un piso de goma EVA antideslizante, cortado a medida.'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link to="/deckeva" className="inline-flex items-center h-8 px-3 rounded-md text-13 font-medium text-ink-700 hover:bg-neutral-bg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          Ver más
        </Link>
        <a href={`https://www.deckeva.cl/?${utm}#cotizar`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-line-strong bg-surface text-13 font-medium text-ink-700 hover:bg-canvas hover:border-ink-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          Cotizar <ExternalLink size={14} />
        </a>
      </div>
    </aside>
  );
}
