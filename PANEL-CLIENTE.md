# El panel de clientes: por qué hay dos y cómo se migra

Este documento existe porque la situación no es obvia y cuesta media hora
redescubrirla cada vez.

## Qué hay hoy

En producción conviven **dos paneles de cliente**:

| URL | Qué es | Quién lo usa |
|---|---|---|
| `/panel/` | Bundle de React antiguo **+ 22 scripts** que le agregan funciones encima | Los clientes reales |
| `/panel/user/` | Compilado de `admin-react/src/user/` | Nadie |

El panel vivo **no** se puede reproducir compilando este repositorio. Su
`index.html` referencia `/panel/assets/index-CnCPfROY.js` con ruta absoluta, o
sea que fue compilado con `base: '/panel/'`, y esa configuración ya no existe:
el commit `a9a47b6` introdujo `vite.config.js` con un target `user` que compila
a `panel/user/` con rutas relativas. El código fuente nunca se conectó a la URL
real.

## Los 22 scripts no son decoración

El bundle vivo por sí solo no tiene "Mis Expedientes", ni el marketplace, ni el
seguimiento, ni las inspecciones. Todo eso lo agregan scripts que corren después
y manipulan el DOM:

```
links-contratados.js      1556 líneas   Mis Expedientes y el ranking
marketplace-enhancer.js   1785 líneas
inspection-user.js         951 líneas
chat-widget-user.js        869 líneas
dashboard-enhancer.js      778 líneas
tracking-enhancer.js       757 líneas
support-form.js            731 líneas
payment-requests-user.js   709 líneas
messages-enhancer.js       649 líneas
payment-cards-enhancer.js  602 líneas
payment-override.js        556 líneas
demo-data-cleaner.js       514 líneas
support-page-enhancer.js   377 líneas
documents-enhancer.js      293 líneas
fetch-interceptor.js       254 líneas
notifications-enhancer.js  251 líneas
post-payment-popup.js      212 líneas
cotizador-bridge.js        166 líneas
report-viewer.js           153 líneas
login-forgot-fix.js        118 líneas
importaciones-enhancer.js   47 líneas
registration-sync.js        34 líneas
                          ─────────
                         12 362 líneas
```

Cambiar `/panel/` al código fuente significa **botar los 22 de una sola vez**.
Por eso no es un arreglo, es una migración.

## El reescrito cubre el alcance

`admin-react/src/user/` son **10 054 líneas** y trae 15 secciones: Dashboard,
Seguimiento, Mis Productos Contratados, Mis Importaciones, Documentos,
Inspecciones, Cotizador Online, Marketplace, Planes de Búsqueda, Deckeva, Pagos,
Mensajes, Alertas, Soporte y Mi Perfil. Cada enhancer tiene su equivalente, y
además hay dos secciones que el panel vivo no tiene.

La diferencia de tamaño (12 362 contra 10 054) no indica que falte nada: los
enhancers son JS a mano armando HTML con concatenación de strings, que es mucho
más verboso que React.

**Pero eso es cobertura de alcance, no equivalencia probada.** Nadie ha usado
nunca el reescrito con una cuenta real y datos reales.

## Cómo validarlo antes de cambiar nada

`/panel/user/` está vivo y apunta a la misma API que el panel real
(`API_BASE = '/api'`), así que se puede probar con una cuenta de cliente de
verdad sin tocar lo que usan los clientes:

1. Entrar a `https://www.imporlan.cl/panel/user/` con una cuenta real.
2. Recorrer las 15 secciones y comparar contra `/panel/` en otra pestaña.
3. Anotar lo que falte o se comporte distinto.

Ese recorrido es la única forma de saber si el reescrito sirve. No hay atajo:
son dos implementaciones independientes de lo mismo.

## Lo que el build se comía en cada corrida

Al preparar esta migración aparecieron dos archivos que se agregaban a mano
después de compilar y que el build siguiente borraba sin avisar:

- **`assets/tracking-bridge.js`** — parchea `window.fetch` para corregir la
  posición de los barcos que el AIS reporta fuera de la ruta USA → Chile. Su
  `<script>` se pegaba a mano en el HTML compilado. En `/panel/admin/` nunca
  llegó a pegarse: el puente del admin existía desde el commit `f9f75c4` y
  **nunca se cargó**.
- **`panel/admin/index.html`** — el admin se compila desde `admin.html`, pero se
  entra por `/panel/admin/`, así que hace falta un `index.html`. Era una copia
  manual, y cada build con `emptyOutDir` la borraba y dejaba la URL en 404.

Los dos los emite ahora el propio build, desde dos plugins en `vite.config.js`.
El puente vive en `admin-react/bridges/` (uno para admin, otro para cliente) y
la versión en la query sale del hash del contenido, así que la caché del
navegador se invalida sola cuando el archivo cambia.

## Cómo se hace el cambio, cuando se decida

```bash
cd admin-react && BUILD_TARGET=user-prod npx vite build
```

Ese target compila a `panel/` con `base: '/panel/'`, que es lo que el panel vivo
necesita.

**`emptyOutDir` está forzado a `false` en ese target y tiene que quedar así.**
`panel/` contiene `admin/`, `user/` y los 22 scripts; un build que vacíe el
directorio borra el panel completo, el de administración incluido. Está
verificado: después de correr ese target sobreviven `admin/`, `user/` y los 45
archivos de `panel/assets/`.

Después del build hay que **sacar de `panel/index.html` los 22 `<script>` de los
enhancers**: con el reescrito sobran, y varios manipulan un DOM que ya no existe.

## Cómo volver atrás

`deploy-prod.sh` respalda `panel/` completo antes de cada deploy:

```bash
ls -dt /home/wwimpo/backups/panel_backup_* | head -3
cp -a /home/wwimpo/backups/panel_backup_FECHA/. /home/wwimpo/imporlan.cl/panel/
```

Conviene hacer el cambio un día de poco tráfico y con ese comando a mano.
