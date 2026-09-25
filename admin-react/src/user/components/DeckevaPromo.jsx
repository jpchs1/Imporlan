import { Link } from 'react-router-dom';

// Promoción del partner DECKEVA (pisos de goma EVA antideslizante) dentro del
// panel de clientes. `context` va en utm_content para medir desde dónde llega
// cada visita a deckeva.cl.
const IMG = 'https://deckeva.cl/wp-content/uploads/2024/08/piso-de-lancha.jpg';

export default function DeckevaPromo({ context = 'panel', title, className = '' }) {
  const utm = `utm_source=imporlan&utm_medium=panel&utm_campaign=partner_deckeva&utm_content=${encodeURIComponent(context)}`;
  return (
    <div className={'relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a1628] via-[#0c2d52] to-[#0e6ba8] text-white shadow-lg ' + className}>
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
        <img src={IMG} alt="Piso de goma EVA antideslizante DECKEVA instalado en una lancha"
          className="w-full h-36 sm:h-full object-cover" loading="lazy" />
        <div className="p-4 sm:p-5">
          <span className="inline-block text-[10px] font-extrabold tracking-widest uppercase text-[#0a1628] bg-gradient-to-r from-amber-400 to-amber-300 px-2.5 py-1 rounded-full">
            Partner oficial · DECKEVA
          </span>
          <p className="mt-2 text-base sm:text-lg font-bold leading-snug">
            {title || 'Estrena tu lancha con piso de goma EVA antideslizante'}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-white/75 leading-relaxed">
            Pisos a medida fabricados en Chile: agarre firme aunque estén mojados, cómodos y resistentes al sol y la sal.
            Toma de medidas e instalación en terreno · +500 embarcaciones · 4.9★
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://deckeva.cl/cotizador/?${utm}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0a1628] text-sm font-extrabold transition">
              Calcula el precio de tu piso →
            </a>
            <Link to="/deckeva"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-sm font-bold transition">
              Ver más
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
