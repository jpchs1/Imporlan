import { Button } from '../../../shared/components/UI';
import { ArrowRight, ClipboardCheck, FileSearch, Wallet, Ship } from '../../../shared/components/Icons';
import { cn } from '../../../shared/lib/utils';
import { queSigue, pagoEnConciliacion } from '../../../shared/lib/importacion';
import { irASeccionExpediente } from '../../../shared/lib/expediente-navigation';

/** Orienta al equipo sin ejecutar transiciones ni dar un cobro por confirmado. */
export default function ImportProcessTask({ eleccion, pagos, error, loading, cerrado }) {
  const sigue = queSigue(eleccion, pagos);
  const anterior = pagos.pagos.find(p => pagoEnConciliacion(p, eleccion));
  let task = { actor: 'Equipo Imporlan', icon: Ship, title: 'Revisar el avance de la operación', text: 'Registra los hitos completados y comparte las novedades con el cliente.', target: 'importacion-hitos', action: 'Ver hitos' };
  if (cerrado) task = { ...task, title: 'Expediente cerrado', text: 'Consulta el historial de la operación y sus comprobantes.', target: 'importacion-cobros', action: 'Consultar pagos' };
  else if (loading || error) task = { ...task, icon: Wallet, title: loading ? 'Actualizando el registro de pagos' : 'Revisar el estado de los pagos', text: error || 'Espera la actualización antes de confirmar ingresos o solicitar un nuevo pago.', target: 'importacion-cobros', action: loading ? null : 'Revisar cobros' };
  else if (anterior) task = { ...task, icon: Wallet, title: 'Conciliar el Pago 1 antes de continuar', text: 'La inspección ya avanzó, pero el Pago 1 sigue pendiente en el registro. Comprueba el pago anterior sin solicitar otra transferencia.', target: 'importacion-cobros', action: 'Revisar Pago 1' };
  else if (sigue.tipo === 'comprobante') task = { ...task, icon: FileSearch, title: `Revisar comprobante${sigue.pago.n ? ` del Pago ${sigue.pago.n}` : ''}`, text: 'Comprueba el monto, la referencia y el ingreso bancario. Después registra la confirmación del pago.', target: 'importacion-cobros', action: 'Revisar comprobantes' };
  else if (sigue.tipo === 'declinada' || sigue.tipo === 'devolucion') task = { ...task, title: sigue.tipo === 'devolucion' ? 'Coordinar la devolución solicitada' : 'Esperando una nueva elección del cliente', text: 'La compra de esta lancha está en pausa. Revisa la decisión del cliente y los pagos registrados.', target: 'importacion-hitos', action: 'Ver decisión' };
  else if (eleccion.inspection_waiting_price) task = { ...task, icon: ClipboardCheck, title: 'La inspección está aprobada: revisar el precio', text: 'Juan Pablo debe aprobar el precio o conservar el acuerdo vigente para habilitar el siguiente paso.', target: 'inspection-price-title', action: 'Revisar precio' };
  else if (sigue.tipo === 'reemplazo_comprobante') task = { ...task, actor: 'Cliente', icon: FileSearch, title: 'Esperando el comprobante corregido', text: 'Se solicitó un reemplazo. El cliente debe revisar la observación y adjuntar el respaldo en el mismo pago.', target: 'importacion-cobros', action: 'Ver observación y pago' };
  else if (sigue.tipo === 'reporte_listo') task = { ...task, actor: 'Cliente', icon: ClipboardCheck, title: 'Esperando la decisión sobre la inspección', text: 'El cliente debe leer el reporte y aprobar o declinar la lancha desde su panel.', target: 'importacion-hitos', action: 'Ver reporte y decisión' };
  else if (sigue.tipo === 'pago') task = { ...task, actor: 'Cliente', icon: Wallet, title: sigue.pago.n ? `El siguiente paso es el Pago ${sigue.pago.n}` : 'Hay un cobro pendiente', text: 'El cliente realiza el pago y adjunta el comprobante. El equipo verifica el ingreso antes de confirmarlo.', target: 'importacion-cobros', action: 'Ver solicitud de pago' };
  else if (sigue.tipo === 'preparando_pago') task = { ...task, icon: Wallet, title: `Preparar la solicitud del Pago ${sigue.pago.n}`, text: 'Verifica el monto y el paso anterior antes de crear el cobro del plan acordado.', target: 'importacion-cobros', action: 'Revisar plan de pagos' };
  else if (sigue.tipo === 'hito') task = { ...task, title: sigue.hito.enCursoCorto, text: sigue.hito.id === 'inspeccion' ? 'Coordina la inspección y carga el reporte. La decisión corresponde al cliente.' : 'Actualiza la operación cuando este paso se haya completado; el cliente verá el avance en su panel.' };
  else if (sigue.tipo === 'listo') task = { ...task, title: 'Importación completada', text: 'La entrega está registrada. Puedes consultar los pagos y documentos de esta operación.', target: 'importacion-cobros', action: 'Ver cierre de pagos' };
  const Icon = task.icon;
  return <section className={cn('import-action admin-process-task', error && 'import-action--warning')} aria-label="Próxima acción de la operación">
    <span className="import-action__icon"><Icon size={20} /></span><div className="import-action__body"><p className="import-kicker">Próxima acción · {task.actor}</p><h3>{task.title}</h3><p>{task.text}</p></div>
    {task.action && <div className="import-action__cta"><Button variant="secondary" size="sm" iconRight={ArrowRight} onClick={() => irASeccionExpediente(task.target)}>{task.action}</Button></div>}
  </section>;
}
