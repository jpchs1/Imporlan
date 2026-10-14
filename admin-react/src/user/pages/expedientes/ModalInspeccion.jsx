import { Modal, Button } from '../../../shared/components/UI';
import { Check, WhatsAppIcon } from '../../../shared/components/Icons';
import BotonEnlace from './BotonEnlace';
import { WA_SOPORTE } from './lib';

const PRECIOS = [
  { rango: 'Hasta 25 pies', precio: 'USD 850' },
  { rango: '26 a 30 pies', precio: 'USD 1.200' },
  { rango: '31 pies o más', precio: 'USD 1.800' },
];

const INCLUYE = [
  'Inspección visual de casco, cubierta y estructura',
  'Pruebas de motor (compresión, presión, fugas)',
  'Sistema eléctrico, baterías e instrumentación',
  'Equipamiento de seguridad y navegación',
  'Galería fotográfica completa con fechas y notas',
  'Reporte detallado en PDF entregado en 48 a 72 horas',
];

/**
 * Solicitar una inspección técnica de una embarcación del ranking. Manda a
 * WhatsApp con el mismo texto de siempre (no cambia qué se envía).
 */
export default function ModalInspeccion({ link, orderNumber, open, onClose }) {
  if (!open || !link) return null;
  const title = [link.make, link.model, link.year].filter(Boolean).join(' ') || 'la embarcación';
  const wapText = encodeURIComponent(
    `Hola, quiero solicitar una inspección técnica para ${title}` +
    (orderNumber ? ` del expediente #${orderNumber}` : '') +
    (link.url ? `.\nLink: ${link.url}` : '') + '\nGracias.'
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Solicitar inspección técnica"
      description={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <BotonEnlace variant="primary" icon={WhatsAppIcon} href={`https://wa.me/${WA_SOPORTE}?text=${wapText}`}>
            Enviar solicitud por WhatsApp
          </BotonEnlace>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="eyebrow mb-2">Qué incluye</h3>
          <ul className="space-y-1.5">
            {INCLUYE.map(it => (
              <li key={it} className="flex items-start gap-2 text-sm text-ink-700">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="eyebrow mb-2">Costo referencial según eslora</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {PRECIOS.map(p => (
                <tr key={p.rango}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-700">{p.rango}</th>
                  <td className="py-2 text-right font-semibold text-ink-900 tabular">{p.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-13 text-ink-500">El costo final puede variar según la ubicación del barco y la eslora exacta. Te lo confirmamos por WhatsApp antes de coordinar.</p>
        </section>
      </div>
    </Modal>
  );
}
