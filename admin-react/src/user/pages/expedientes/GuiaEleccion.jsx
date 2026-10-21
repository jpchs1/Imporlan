import { Card } from '../../../shared/components/UI';

const PASOS = [
  { n: 1, titulo: 'Eliges la lancha', texto: 'Desde el ranking, con el botón «Elegir esta lancha».' },
  { n: 2, titulo: 'Tu agente confirma', texto: 'Que sigue disponible y el precio final con el vendedor.' },
  { n: 3, titulo: 'Compra y traslado', texto: 'Inspección si la pediste, compra a tu nombre y viaje a Chile.' },
];

/**
 * El bloque que va justo arriba del ranking cuando todavía no hay elección:
 * le dice al cliente que el siguiente paso es suyo y qué pasa después, en
 * tres pasos y sin ruido. Elegir no es pagar, y eso se dice aquí también.
 */
export default function GuiaEleccion({ agente }) {
  return (
    <Card as="section" aria-labelledby="guia-eleccion" className="border-brand-200 bg-brand-50">
      <h2 id="guia-eleccion" className="text-base font-semibold leading-6 text-ink-900">Siguiente paso: elige tu lancha</h2>
      <p className="mt-1 text-sm text-ink-700">
        Cuando tengas claro con cuál quieres avanzar, elígela en el ranking. Elegir no es un pago: {agente ? agente : 'tu agente'} confirma primero que sigue disponible y el precio final.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Cómo sigue la importación">
        {PASOS.map(p => (
          <li key={p.n} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-13 font-semibold text-white tabular" aria-hidden="true">{p.n}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">{p.titulo}</p>
              <p className="text-13 text-ink-700">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
