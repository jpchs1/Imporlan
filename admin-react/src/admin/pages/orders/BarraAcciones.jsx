import { Button, Badge, StatusBadge, Menu } from '../../../shared/components/UI';
import { ArrowLeft, SquarePen, Mail, Bell, RefreshCw, Trash } from '../../../shared/components/Icons';

/**
 * Barra sticky del detalle: Volver · título · estado · "Cambios sin guardar" ·
 * Guardar (único primario) · menú ⋯ con el resto (Eliminar sólo ahí).
 */
export default function BarraAcciones({ detail, unsaved, saving, rescraping, rescrapeProgress, onBack, onSave, onChangeStatus, onSendClient, onNotifyRanking, onRescrape, onDelete, contactoOculto = false }) {
  // Los correos al cliente los manda el equipo en Chile, no el agente de EE. UU.
  const items = [
    { label: 'Cambiar estado', icon: SquarePen, onClick: onChangeStatus },
    ...(contactoOculto ? [] : [
      { label: 'Enviar actualización al cliente', icon: Mail, onClick: onSendClient },
      { label: 'Notificar ranking al cliente', icon: Bell, onClick: onNotifyRanking },
    ]),
    { label: rescraping ? `Rescrapeando ${rescrapeProgress}…` : 'Rescrapear los links', icon: RefreshCw, onClick: onRescrape, disabled: rescraping },
    { separator: true },
    { label: 'Eliminar expediente', icon: Trash, tone: 'danger', onClick: onDelete },
  ];
  return (
    <div className="exp-action-bar sticky top-(--topbar-h) z-10 -mx-(--page-gutter) px-(--page-gutter) -mt-6 lg:-mt-8 pt-3 pb-3 mb-6 bg-surface border-b border-line">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-2 shrink-0" aria-label="Volver a expedientes">
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <p className="text-base font-semibold text-ink-900 truncate">
            <span className="tabular">{detail.order_number}</span>
            {detail.customer_name && <span className="hidden md:inline text-ink-500 font-normal"> · {detail.customer_name}</span>}
          </p>
          <StatusBadge kind="expediente" status={detail.status} className="shrink-0 hidden sm:inline-flex" />
          {unsaved && <Badge tone="warning" dot className="shrink-0 hidden sm:inline-flex">Cambios sin guardar</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onSave} loading={saving} size="sm">Guardar</Button>
          <Menu items={items} label="Acciones del expediente" />
        </div>
      </div>
      {unsaved && <p data-unsaved-mobile className="sm:hidden mt-1.5 text-xs text-warning font-medium">Cambios sin guardar</p>}
    </div>
  );
}
