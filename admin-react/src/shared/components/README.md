# Kit de componentes · Panel del Cliente y Panel Admin

Un solo sistema para los dos paneles. Referencias: Linear (jerarquía y
densidad), Stripe Dashboard (tablas, montos, estados), Vercel (chrome neutro).
**Regla de oro:** sobrio, chileno, nada inventado. La marca va en acciones
primarias, enlaces, foco, ítem activo del menú y la etapa actual del stepper;
todo lo demás es neutro.

```js
import { Card, Button, DataTable, StatusBadge, Money, PageHeader, … } from '../../shared/components/UI';
import { Search, Ship, WhatsAppIcon } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { useBreadcrumb } from '../../shared/lib/page-meta';
import { fmtUSD, fmtDateLarga, fmtRelativo } from '../../shared/lib/format';
import { statusMeta } from '../../shared/lib/status';
```

## 1. Tokens (`src/index.css`)

Variables en `@theme` de Tailwind 4 → utilidades. **No usar colores fuera de
estos tokens** (nada de `indigo-*`, `cyan-*`, `violet-*`, `from-*`, `via-*`,
hex sueltos). El modo oscuro redefine las mismas variables después.

| Grupo | Utilidades | Uso |
|---|---|---|
| Marca | `brand-50/100/200/500/600/700/800` | primario = `bg-brand-600`, hover `brand-700`, enlaces `text-brand-600`, foco `outline-brand-500` |
| Neutros | `ink-900` títulos · `ink-700` texto · `ink-500` secundario (AA) · `ink-400` **solo** placeholders e íconos decorativos | `line` bordes · `line-strong` bordes de inputs · `surface` cards · `canvas` fondo |
| Semánticos | `success` `warning` `danger` `info` `neutral` + sufijos `-bg` y `-line` | `bg-warning-bg text-warning border-warning-line`; `TONE_CLASSES` en `lib/status.js` |
| Sidebar | `sidebar`, `sidebar-ink`, `sidebar-muted`, `sidebar-active`, `sidebar-line` | solo Layout |
| Radios | `rounded-sm` 6 (chips) · `rounded-md` 8 (inputs, botones) · `rounded-lg` 12 (cards) · `rounded-xl` 16 (modales) | |
| Sombras | `shadow-card` · `shadow-pop` (menús, popovers) · `shadow-modal` | sin otras sombras |
| Capas | `z-nav` 30 · `z-fab` 40 · `z-popover` 50 · `z-modal` 60 · `z-toast` 70 | **nunca** `z-[9999]` |
| Texto | `text-xs` 12 · `text-13` · `text-sm` 14 (cuerpo) · `text-base` 16 · `text-xl` 20 · `text-2xl` 24 (título de página) · `text-3xl` 30 (solo montos) | **nada bajo 12 px** (`text-[10px]`/`text-[11px]` prohibidos) |
| Utilidades | `eyebrow` (12 px, mayúsculas, ink-500) · `tabular` · `scrollbar-thin` | |
| Densidad | `--density-row` (48 / 40 admin) · `--content-max` (1120 / 1280) · `--card-pad` (24 / 16 móvil) · `--page-gutter` | `admin.html` lleva `data-density="compact"` |

Pesos: 400 cuerpo · 500 etiquetas · 600 títulos y montos · 700 solo el total.
Fuente Inter autoalojada (`@fontsource-variable/inter`). Números tabulares
globales. Movimiento: solo 150 ms en color/opacidad/transform; nada de
`animate-pulse` decorativo, fade-in escalonado, blobs, blur ni degradados.

## 2. Componentes

### Button · IconButton · ButtonGroup
```jsx
<Button>Guardar</Button>                                   // primary
<Button variant="secondary" icon={Download}>Exportar</Button>
<Button variant="ghost" size="sm">Cancelar</Button>
<Button variant="danger" loading={saving}>Eliminar</Button>  // mantiene ancho, aria-busy
<IconButton icon={Pencil} aria-label="Editar" />           // aria-label obligatorio
```
`variant`: primary · secondary · ghost · danger · danger-ghost · link. `size`: sm 32 · md 36 · lg 40. `block` ancho completo. Máximo **1 primario por vista**.

### Field · Input · Select · Textarea · Checkbox · Switch · MoneyInput · NumberInput · FormGrid
Todos generan `id`, `label htmlFor`, `hint`, `error` (role=alert), `required`, `aria-describedby` / `aria-invalid`. Alto 36 (sm 32, lg 40).
```jsx
<Input label="Correo" type="email" hint="Te escribimos aquí" error={errors.email} required />
<Select label="Estado" options={[{ value: 'all', label: 'Todos' }]} placeholder="Elige…" />
<Textarea label="Mensaje" maxLength={2000} showCount />
<Checkbox label="Acepto los términos" checked={ok} onChange={e => setOk(e.target.checked)} />
<Switch label="Avisar por correo" checked={on} onChange={setOn} />
<MoneyInput label="Precio negociado" currency="USD" value={n} onChange={setN} />   // onChange(number|null); USD acepta 2 decimales ("1.250,50"), CLP entero
<NumberInput label="IVA" unit="%" value={iva} onChange={e => …} />
<Field label="Fecha"><input type="date" … /></Field>       // controles propios
<FormGrid cols={2}>…</FormGrid>
```
`Select` sin `label` recibe `aria-label` o `placeholder` como nombre accesible (axe `select-name`).

### Card · SectionTitle · DescriptionList
```jsx
<Card>…</Card>                                  // padding --card-pad
<Card padding="none"><DataTable … /></Card>     // tablas
<Card>
  <Card.Header title="Ranking" description="Ordena tu preferencia" actions={<Button size="sm">…</Button>} />
  <Card.Body>…</Card.Body>
  <Card.Footer><Button variant="secondary">Cancelar</Button><Button>Guardar</Button></Card.Footer>
</Card>
<DescriptionList cols={3} items={[{ label: 'Agente', value: 'Rodrigo' }, { label: 'IMO', value: '9876', mono: true }]} />
```
Si hay `Card.Header/Body/Footer`, la Card no pone padding (lo ponen ellas). Sin `card-hover`.

### PageHeader
Una por ruta. Reemplaza todos los heros.
```jsx
<PageHeader eyebrow="Expedientes" title="IMP-00035 · Cobalt R30"
  description="Estamos coordinando la inspección; te avisamos cuando esté el reporte."
  meta={<StatusBadge kind="expediente" status={o.status} />}
  actions={<><Button variant="secondary" icon={WhatsAppIcon}>Hablar con el agente</Button><Button>Descargar PDF</Button></>}
  backTo="/expedientes" backLabel="Expedientes" />
```
Compatibilidad: `subtitle` ≡ `description`, `action` ≡ `actions`.

### ExpedienteWorkspace · vistas de expedientes

Las listas y los detalles de expedientes usan una variante visual acotada a
`.exp-workspace`, en `shared/styles/expedientes.css`. `ExpedienteHeader` integra
`PageHeader`, los metadatos y una foto de la embarcación cuando existe.
En esta variante el título mide entre 24 y 30 px y los contadores, 22 px.
`ExpedienteMetrics` muestra sólo valores de los datos cargados, sin tendencias
inventadas. `ExpedienteNavigation` enlaza secciones de la misma página y conserva
montados los formularios para no perder ediciones. Sus anclas respetan las barras
fijas y la preferencia de movimiento reducido. El resto del kit y sus tokens se
mantienen compartidos. La galería de archivos ofrece filtros y vista de lista;
reutiliza `FileImage`, `FileOpen`, `FileDownload` y los permisos de la API.

### StatTile · StatGrid (otras vistas)
```jsx
<StatGrid cols={4}>
  <StatTile label="Pagos pendientes" value="$13.663.000" hint="2 solicitudes" tone="warning" />
  <StatTile label="Ingresos del mes" value={fmtCLP(n)} delta={12.5} deltaLabel="vs. mes anterior" />
  <StatTile label="Activos" value={4} onClick={() => setFiltro('activos')} active={filtro === 'activos'} />
</StatGrid>
```
Alto fijo 88. `delta` solo con un número real. Tiles que filtran llevan `aria-pressed`.

### Badge · StatusBadge · CountBadge
```jsx
<StatusBadge kind="pago" status={p.status} dot />       // "Pendiente" (warning); nunca la clave cruda
<Badge tone="info">Plan Fragata</Badge>
<CountBadge value={unread} tone="danger" />
```
`kind`: expediente · pago · compra · barco · publicacion · conversacion · evento · plan · inspeccion · cola. La tabla vive en `lib/status.js` (`statusMeta(kind, status) → { label, tone }`); agregar estados ahí, no en la página.

### Money
```jsx
<Money clp={12523000} usd={13182} />          // $12.523.000  ·  ≈ USD 13.182 (debajo)
<Money clp={total} size="xl" />               // totales
<Money usd={850} inline />                    // USD 850
```
Nunca escribir montos a mano: `fmtCLP` (`$12.523.000`) y `fmtUSD` (`USD 13.182`, entero).

### DataTable (sustituye a Table)
```jsx
<DataTable
  columns={[
    { key: 'number', header: 'N°', cell: r => <span className="font-medium text-ink-900">{r.number}</span>, width: 120 },
    { key: 'client', header: 'Cliente', cell: r => … },
    { key: 'status', header: 'Estado', cell: r => <StatusBadge kind="expediente" status={r.status} />, priority: 2 },
    { key: 'amount', header: 'Monto', align: 'right', cell: r => <Money clp={r.amount} />, sortValue: r => r.amount },
    { key: 'updated_at', header: 'Actualizado', priority: 3, cell: r => fmtDate(r.updated_at) },
  ]}
  data={rows} rowKey={r => r.id} onRowClick={abrir}
  rowActions={r => [{ label: 'Editar', icon: Pencil, onClick: () => … }, { separator: true }, { label: 'Eliminar', icon: Trash, tone: 'danger', onClick: … }]}
  loading={loading} emptyState={<EmptyState compact title="Sin expedientes" />}
  mobileCard={r => (<><p className="font-medium text-ink-900">{r.number}</p><p className="text-13 text-ink-500">{r.client}</p></>)}
  pageSize={25}
/>
```
`priority` 2 se oculta < lg, 3 < xl. Fila clickeable accesible (Tab + Enter). Sin `mobileCard`, en móvil hay scroll horizontal con sombra lateral. Orden con `aria-sort`. Va dentro de `<Card padding="none">`.

Servidor: `onPageChange(p)` (0-based) deja de recortar `data` y avisa; con `page` la página es controlada, sin `page` la tabla igual lleva el indicador. `onSortChange({ col, dir, key })` deja de ordenar; con `sort={{ col: 'amount' | índice, dir }}` el orden es controlado y alterna al repetir el clic en la misma columna. `total` = filas totales para calcular páginas.

### Tabs · SegmentedControl · FilterChips · SearchInput
```jsx
<Tabs tabs={[{ id: 'pend', label: 'Pendientes', count: 2 }, { id: 'pag', label: 'Pagados' }]} value={tab} onChange={setTab} />
<SegmentedControl options={[{ id: 'cards', label: 'Tarjetas', icon: LayoutGrid }, { id: 'table', label: 'Tabla', icon: Table }]} value={v} onChange={setV} />
<FilterChips options={[{ id: 'all', label: 'Todos', count: 7 }, { id: 'activos', label: 'Activos', count: 2 }]} value={f} onChange={setF} />
<SearchInput value={q} onChange={setQ} placeholder="Buscar expediente o cliente" />   // onChange(string)
```
Un solo look para pestañas y filtros. Teclado: flechas, Home/End.

### EmptyState · ErrorState · Callout · Skeleton · Spinner
```jsx
<EmptyState icon={Ship} title="Aún no tienes expedientes" description="…" primaryAction={<Button>Cotizar links</Button>} />
<ErrorState message="No pudimos cargar tus pagos" detail={err.message} onRetry={load} />
<Callout tone="warning" title="Tienes 2 pagos pendientes" action={<Button size="sm">Pagar</Button>}>Suman $13.663.000.</Callout>
<Skeleton.Text lines={3} /> · <Skeleton.Card /> · <Skeleton.TableRows rows={5} cols={4} /> · <Skeleton.Stat /> · <Skeleton.Detail />
<Spinner /> · <Spinner inline size="sm" />
```
Skeletons sin anchos fijos (porcentajes). Un `EmptyState` nunca muestra datos de ejemplo como si fueran reales.

### Modal · Drawer · ConfirmDialog / useConfirm · Lightbox
```jsx
<Modal open={open} onClose={cerrar} title="Cambiar estado" description="…" size="md"
       footer={<><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button onClick={guardar}>Guardar</Button></>}>…</Modal>
<Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name} width="md">…</Drawer>

const confirm = useConfirm();                       // el Layout ya monta el ConfirmProvider
if (await confirm({ title: '¿Eliminar el expediente?', description: 'No se puede deshacer.', detail: ['Se borran 5 links'], tone: 'danger', confirmLabel: 'Eliminar' })) { … }
await confirm({ title: 'Listo', description: 'Se envió el correo.', cancelLabel: null, confirmLabel: 'Entendido' });   // aviso (ex alert)

<Lightbox open={i !== null} items={[{ src, alt, caption }]} index={i} onIndexChange={setI} onClose={() => setI(null)} />
```
Todos: `role="dialog"`, foco atrapado y devuelto, Escape, scroll interno con cabecera/pie fijos. Modal en móvil = hoja a pantalla completa. Tamaños sm 448 · md 512 · lg 672 · xl 896 · full. **Prohibidos `confirm()`/`alert()` nativos.**

Capas anidadas (`lib/focus.js`): las trampas de foco y los `Menu` abiertos forman una **pila**; solo la capa superior recibe Escape y Tab (un ConfirmDialog sobre un Modal cierra solo el de arriba). El bloqueo de scroll del body lleva contador: se restaura el estilo original al soltar el último, en cualquier orden. `confirm()` encola: dos llamadas seguidas se muestran una por una y ambas promesas se resuelven.

### Menu · Accordion · Dropzone · Avatar
```jsx
<Menu items={[{ label: 'Editar', icon: Pencil, onClick }, { separator: true }, { label: 'Eliminar', icon: Trash, tone: 'danger', onClick }]} />   // "⋯"
<Menu trigger={<Button variant="secondary" iconRight={ChevronDown}>Más</Button>} items={…} />
<Accordion><Accordion.Item title="Motor" meta={<Badge tone="success">9/10</Badge>}>…</Accordion.Item></Accordion>
<Dropzone onFiles={subir} accept=".pdf,image/*" multiple hint="PDF o imágenes, hasta 20 MB" />
<Avatar name={user.name} src={user.avatar_url} size="lg" />
```
`Menu` vive en un portal pero se pinta por encima de la capa activa (drawer, modal) y devuelve el foco al disparador al cerrar; con el scroll se reposiciona (solo se cierra si el disparador sale de la vista). `Dropzone`: la zona de arrastre no es interactiva, el control es el botón «Elegir archivo(s)» (`buttonLabel`); `accept` se aplica también a lo arrastrado, lo rechazado va a `onReject(files)` y se muestra un aviso (`showRejected={false}` lo apaga).

### ProcessStepper (reemplaza Timeline)
```jsx
<ProcessStepper current={3} completedAt={{ 1: o.plan_at, 2: o.search_at }} currentNote="Estamos coordinando la inspección…" />
<ProcessStepper current={3} compact />                       // barra + "Etapa 3 de 5 · Inspección" (tarjetas)
<ProcessStepper current={3} onPrev={…} onNext={…} />        // solo admin; con solo uno de los dos, solo ese botón
```
Horizontal ≥ md, vertical con descripción en móvil. Etapas en `ETAPAS_EXPEDIENTE` (`lib/status.js`). `Timeline` sigue exportado (`step/onPrev/onNext`) como alias dentro de una Card.

### Toast
```jsx
const toast = useToast();
toast('Guardado', 'success');                                                   // forma corta
toast({ type: 'error', title: 'No se pudo enviar', description: 'Revisa tu conexión.' });
toast({ title: 'Reporte listo', action: { label: 'Ver', onClick: () => navigate('/documents') } });
```
4 s (8 s en error). Se posiciona sobre la barra inferior móvil.

### Layout · migas · NotificationBell · MobileTabBar
`Layout` (mismas props: `navItems, navGroups, branding, profilePath, headerExtra, badges` + `search`, `mobileTabs`, `actions`) pinta sidebar 240 px sticky, topbar 56 px con migas reales, contenido centrado a `--content-max` y, en el cliente, la barra inferior de 5 pestañas en móvil (los `navItems` con `mobileTab`). **El body hace scroll** (no `<main>`): nada de `h-screen`/`calc(100vh - …)` en páginas; para alturas usar `min-h-[560px]` o `calc(100dvh - var(--topbar-h) - …)`.
```jsx
useBreadcrumb(order ? [`IMP-${order.number}`] : null);   // topbar: "Expedientes › IMP-00035"; también el <title>
```

### Icons
`lucide-react` envuelto (stroke 1.75, `aria-hidden`). Tamaños: 16 en línea con texto 14 · 20 en botones · 24 en vacíos. Marca: `WhatsAppIcon`, `WebPayIcon`, `MercadoPagoIcon`, `ImporlanMark`. Si falta un ícono, agregarlo a `Icons.jsx` (es de WS0; avisar en el PR), **no pegar SVG inline**.

## 3. Compatibilidad (alias que siguen existiendo)
`Table` (= DataTable sangrado), `StatCard` (= StatTile), `SkeletonCard` (= Skeleton.Card), `Badge` con `className` de `statusColor()`, `Input/Select/Textarea` con `label`, `Modal` (`open/onClose/title/size`), `PageHeader` (`subtitle/action`), `Spinner`, `ErrorState` (`message/onRetry`), `Timeline` (`step/onPrev/onNext`), `useToast()(msg, type)`, `statusLabel()`/`statusColor()` en `utils.js`. Las clases `animate-fade-in`, `card-hover`, `glass`, `shimmer` existen pero no hacen nada vistoso; no usarlas en código nuevo.

## 4. Microcopy (regla de la casa)
- Español de Chile, tuteo, serio y cercano: "Escríbenos por WhatsApp", "Elige una embarcación", "Pega el link del anuncio", "Vuelve a intentarlo". Tildes siempre; preguntas con "¿…?". Sin voseo ("Pegá", "Podés"), sin "Dashboard", "Live", "Online", "listing", "wallet", "score", "Click para…".
- Secciones (sentence case): Inicio · Expedientes · Pagos · Mensajes · Documentos · Inspecciones · Seguimiento · Cotizar links · Planes · Marketplace · Alertas · Ayuda · Mi cuenta · Pisos Deckeva (cliente); Inicio · Usuarios · Compras · … (admin).
- Estados: solo vía `StatusBadge`/`statusMeta` (Nuevo · En revisión · En proceso · Completado · Vencido · Cancelado; Pendiente · Pagado · Cancelado; En tránsito · Arribado · Programado · Inactivo; Activa · Vendida · Vencida · Eliminada).
- Montos: `$12.523.000` y `USD 13.182` (nunca `$13,182` ni `USD $67.6`). Fechas: `12 oct 2026` en texto (`fmtDateLarga`), `12-10-2026` en tablas (`fmtDate`), `hace 2 h` solo en actividad (`fmtRelativo`, con `title` con la fecha completa).
- Nada inventado en pantalla: ni tarjetas de crédito ficticias, ni "online", ni stats de partners, ni reportes de ejemplo sin marcar.
- `test/panel-cliente-idioma-tests.php` cobra tildes, voseo y "¿" en `user/` y `shared/components`. Los acentos van **solo en texto**, nunca en claves, clases ni propiedades.

## 5. Checklist antes del PR de un workstream
1. Cero `indigo-|cyan-|violet-|from-|via-|to-|text-[10px]|text-[11px]|z-[9` en los archivos del WS (grep).
2. Una sola `PageHeader` por ruta; montos con `Money`/`fmtCLP`/`fmtUSD`; estados con `StatusBadge`.
3. Cada botón de ícono con `aria-label`; cada input con `label` (o `aria-label`); cada modal con foco y Escape (ya lo hace el kit).
4. Móvil: acciones primarias visibles sin que la barra inferior ni el chat las tapen; tablas con `mobileCard` o scroll con indicador.
5. `node capturar.mjs --src <worktree>/admin-react --out capturas/<ws>`: desborde `no`, consola `no`, axe serio/crítico 0 en las pantallas del WS.
