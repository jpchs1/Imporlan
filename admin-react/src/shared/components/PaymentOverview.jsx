import { fmtCLP } from '../lib/utils';
import { Badge, Callout } from './UI';
import { Wallet, CircleCheck, Receipt } from './Icons';
import '../styles/import-process.css';

export default function PaymentOverview({ total, cuadre, admin = false }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, Math.round(cuadre.paid / total * 100))) : 0;
  return <div className="payment-overview">
    <dl className="payment-overview__numbers">
      <div><dt><Wallet size={15} />{admin ? 'Cotización vigente' : 'Total acordado'}</dt><dd>{fmtCLP(total)}</dd></div>
      <div className="payment-overview__paid"><dt><CircleCheck size={15} />Pagos confirmados</dt><dd>{fmtCLP(cuadre.paid)}</dd></div>
      <div><dt><Receipt size={15} />Saldo del plan</dt><dd>{fmtCLP(cuadre.balance)}</dd></div>
    </dl>
    <div className="payment-overview__progress"><span>Plan pagado <strong>{percent}%</strong></span><progress aria-label="Porcentaje confirmado del plan de pagos" max="100" value={percent} /></div>
    {admin && <div className="payment-overview__review"><Badge tone={cuadre.pendingReceipts ? 'info' : 'neutral'}>{cuadre.pendingReceipts} comprobantes por revisar</Badge><span>{cuadre.missingReceipts} pagos manuales sin comprobante</span></div>}
    <p className="payment-overview__note">{admin ? 'Los comprobantes se revisan antes de confirmar el ingreso.' : 'El saldo incluye los pagos de las próximas etapas. Cada pago se habilita cuando corresponde.'}</p>
    {(cuadre.mismatch || cuadre.duplicate || cuadre.duplicateReference || cuadre.balance < 0) && <Callout compact tone="warning">{admin ? 'Revisa las diferencias entre cobros y plan, los pagos duplicados o las referencias repetidas antes de confirmar el cuadre.' : 'El equipo está revisando diferencias en el registro de pagos. Consulta el detalle antes de transferir.'}</Callout>}
  </div>;
}
