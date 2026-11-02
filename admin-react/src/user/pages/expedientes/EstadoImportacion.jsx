import ImportJourney from '../../../shared/components/ImportJourney';
import { compraConciliada } from '../../../shared/lib/importacion';

/** Hitos registrados, sin estimar tiempos ni dar por hechos los pasos anteriores. */
export default function EstadoImportacion({ eleccion, cerrado = false, pagos }) {
  return <ImportJourney eleccion={eleccion} cerrado={cerrado} purchaseHold={!compraConciliada(pagos)} className="client-import-journey" sectionId="estado-importacion" />;
}
