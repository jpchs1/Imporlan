import { ProcessStepper } from './ProcessStepper';
import { Card } from './Card';

/**
 * Compatibilidad: `Timeline` era el bloque oscuro con los 5 pasos. Ahora es
 * `ProcessStepper` dentro de una Card clara, con la misma firma
 * (`step`, `onPrev`, `onNext`). Para código nuevo usar ProcessStepper.
 */
export default function Timeline({ step = 1, onPrev, onNext, completedAt, currentNote, className = 'mb-5' }) {
  return (
    <Card className={className}>
      <ProcessStepper current={step} onPrev={onPrev} onNext={onNext} completedAt={completedAt} currentNote={currentNote} />
    </Card>
  );
}
