import ImportJourney from '../../../shared/components/ImportJourney';

/** Hitos registrados, sin estimar tiempos ni dar por hechos los pasos anteriores. */
export default function EstadoImportacion({ eleccion, cerrado = false }) {
  return <ImportJourney eleccion={eleccion} cerrado={cerrado} className="client-import-journey" sectionId="estado-importacion" />;
}
