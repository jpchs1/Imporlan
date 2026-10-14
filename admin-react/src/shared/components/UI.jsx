/**
 * Barril del kit. Las páginas importan de aquí:
 *   import { Card, Button, DataTable, StatusBadge, Money, … } from '../../shared/components/UI';
 * Ver README.md en esta carpeta.
 *
 * Al final van los alias de compatibilidad (Table, StatCard, SkeletonCard):
 * siguen aceptando las props de antes para que las páginas aún no migradas
 * compilen y se vean coherentes.
 */
import { DataTable } from './DataTable';
import { StatTile } from './StatTile';
import { Skeleton } from './Skeleton';

export { Button, IconButton, ButtonGroup } from './Button';
export { Field, Input, Select, Textarea, Checkbox, Switch, MoneyInput, NumberInput, FormGrid } from './Field';
export { Card, SectionTitle, DescriptionList } from './Card';
export { PageHeader } from './PageHeader';
export { StatTile, StatGrid } from './StatTile';
export { Badge, StatusBadge, CountBadge } from './StatusBadge';
export { Money } from './Money';
export { DataTable } from './DataTable';
export { Tabs, SegmentedControl } from './Tabs';
export { FilterChips } from './FilterChips';
export { SearchInput } from './SearchInput';
export { EmptyState } from './EmptyState';
export { ErrorState } from './ErrorState';
export { Skeleton, Spinner } from './Skeleton';
export { Modal } from './Modal';
export { Drawer } from './Drawer';
// eslint-disable-next-line react-refresh/only-export-components
export { ConfirmDialog, ConfirmProvider, useConfirm } from './ConfirmDialog';
export { Menu } from './Menu';
export { Callout } from './Callout';
export { Accordion } from './Accordion';
export { Dropzone } from './Dropzone';
export { ProcessStepper } from './ProcessStepper';
export { Avatar } from './Avatar';
export { Lightbox } from './Lightbox';
export { MobileTabBar } from './MobileTabBar';
export { default as Timeline } from './Timeline';

/* ---------------------------------------------------------------------------
   Compatibilidad hacia atrás
   --------------------------------------------------------------------------- */

/**
 * `Table` (viejo): columns {header, key, cell, sortValue}, data, onRowClick,
 * emptyMsg, pageSize. Es DataTable sangrando hasta el borde de la Card.
 */
export function Table(props) {
  return <DataTable bleed {...props} />;
}

/** `StatCard` (viejo): label, value, icon, color (se ignora), trend → StatTile. */
export function StatCard({ label, value, icon, trend, hint, onClick, active, className }) {
  const delta = trend === undefined || trend === null || trend === '' ? undefined : Number(trend);
  return <StatTile label={label} value={value} icon={icon} delta={isFinite(delta) ? delta : undefined} hint={hint} onClick={onClick} active={active} className={className} />;
}

/** `SkeletonCard` (viejo) → Skeleton.Card. */
export function SkeletonCard(props) {
  return <Skeleton.Card {...props} />;
}
