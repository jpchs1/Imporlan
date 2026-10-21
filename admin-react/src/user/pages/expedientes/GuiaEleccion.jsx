import { Card } from '../../../shared/components/UI';

function pasos(pct) {
  return [
    { n: 1, titulo: 'Eliges la lancha', texto: 'Desde el ranking, con «Elegir esta lancha». Ahí te pedimos tus datos y tu cédula, para importar a tu nombre.' },
    { n: 2, titulo: pct ? `Pagas el Pago 1 · ${pct}%` : 'Pagas el Pago 1', texto: 'Te llega al confirmar y pone en marcha la operación. Lo pagas en Pagos, con tarjeta o transferencia.' },
    { n: 3, titulo: 'Inspección, compra y traslado', texto: 'Inspección si la pediste, compra a tu nombre y viaje a Chile. Lo sigues aquí mismo, paso a paso.' },
  ];
}

/**
 * El bloque que va justo arriba del ranking cuando todavía no hay elección:
 * le dice al cliente que el siguiente paso es suyo y qué pasa después, en
 * tres pasos y sin ruido. Al confirmar le llega el Pago 1 (`pct` es el % del
 * plan de las cotizaciones publicadas, o null si aún no hay ninguna: entonces
 * no se dice un número).
 */
export default function GuiaEleccion({ agente, pct }) {
  return (
    <Card as="section" aria-labelledby="guia-eleccion" className="border-brand-200 bg-brand-50">
      <h2 id="guia-eleccion" className="text-base font-semibold leading-6 text-ink-900">Siguiente paso: elige tu lancha</h2>
      <p className="mt-1 text-sm text-ink-700">
        Cuando tengas claro con cuál quieres avanzar, elígela en el ranking. Al confirmar te llega el Pago 1{pct ? ` (${pct}% de la operación)` : ''}, el que pone en marcha la importación; con él {agente || 'tu agente'} coordina la inspección, si la pides, y confirma la compra con el vendedor.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Cómo sigue la importación">
        {pasos(pct).map(p => (
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
