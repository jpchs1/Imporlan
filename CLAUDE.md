# Imporlan — notas para Claude

## Cómo comunicarse con JP

- Siempre que menciones una ruta o una pantalla (GitHub, admin, panel, cPanel,
  etc.), da el **link completo y clickeable**, listo para copiar y pegar en el
  navegador — no sólo la ruta de menús ("Settings → Secrets → …").
  Ej.: https://github.com/jpchs1/Imporlan/settings/secrets/actions/new
- Responder en español.
- Cambios de código: cuando JP pida algo, **crear el PR y hacer merge a `main`
  directamente**, sin preguntar. Validar antes (sintaxis, checks locales) y
  avisar al final con el link del PR.
- Deploy: al mergear a `main` el sitio se publica solo en ≤5 min (cron de
  cPanel → `cron-deploy.sh` → `deploy-prod.sh`). Verificar que
  https://www.imporlan.cl/.imporlan_docroot muestre el commit del merge antes
  de decirle a JP que está en producción.
- **Autonomía total (JP, 12-oct-2026):** «Haz tú todo, tienes todas mis
  autorizaciones y permisos para operar de manera autónoma e independiente».
  En Imporlan y Deckeva (web, código, deploys, contenido, correcciones que
  aparezcan en el camino) se hace todo de punta a punta sin pedir
  confirmación: PR, merge, deploy real y verificación en vivo, y al final se
  le avisa con los links. Si algo depende de terceros (hosting, cuentas,
  accesos que la sesión no tiene), se le deja a JP el paso exacto y el texto
  listo para usar. Los correos a clientes siguen la regla de abajo.

## WhatsApp · corregir un borrador con una indicación (JP, 8-oct-2026)

> «Yo sólo debería poner "Sí podemos, pero deben ser casas rodantes, motorhome
> usadas ya no se puede" y la misma IA redactar nuevamente el mensaje con ese
> input nuevo.»

En el panel (`/api/whatsapp_puerta.php?r=panel&k=…`) cada borrador tiene, además
del textarea y «Aprobar», un campo **«O dile qué corregir»** y el botón
**«Rehacer con mi indicación»**. JP escribe la corrección en una línea, la IA
reescribe el mensaje al cliente con eso, y el borrador **sigue siendo
borrador**: él lee el texto nuevo y recién ahí aprueba.

Tres cosas que no se negocian, y las cobra `test/whatsapp-rehacer-tests.php`
(en CI, con canario):

| | |
|---|---|
| Rehacer **no manda** | no toca el estado · sólo cambia el texto |
| El texto nuevo se **vuelve a validar** | `iwa_validar()` · una indicación no es una puerta para que salga un precio |
| La indicación **se aprende** | `iwa_aprender()` · entra en el prompt de las respuestas siguientes, con tope de `IWA_APRENDIDO_MAX` |

Lo último es el punto: «motorhome usado ya no se puede importar» no es la
respuesta a un cliente, es un dato del negocio que la IA no tenía. Queda en
`api/logs/whatsapp-aprendido.json` junto con lo que había preguntado el
cliente, y se le dice al modelo que **manda sobre lo que creía saber**. Lo que
se repite conviene escribirlo en `iwa_sistema()`, que es lo permanente; esto
es la vía rápida mientras tanto.

La indicación va en el **mensaje** y no en el prompt de sistema, a propósito:
el sistema es lo que vale para todos los chats, y esto es sobre éste.

## Elegir la lancha, Pago 1 y operación en EE. UU. (JP, 21-oct-2026)

- Al elegir la lancha (cliente en el panel, o el equipo por él en el admin)
  se pide solo el **Pago 1** (el % de la cotización, 7% por defecto). La
  inspección **no se cobra aparte**: va dentro de los 3 pagos de la
  operación. Reglas en `api/eleccion_lancha.php`; pruebas en
  `test/eleccion-lancha-tests.php`.
- **Pago 2** se cobra solo al marcar el hito «Inspección técnica aprobada».
  Si el cliente eligió sin inspección, se cobra al confirmar con el vendedor
  la disponibilidad, el precio y la fecha de compra o retiro. **Pago 3**
  llega con «En camino a Chile» (foto de la lancha en el puerto de EE. UU.).
- **Inspección: el equipo carga el reporte, el cliente decide** (JP: «nosotros
  cumplimos con cargarlo, pero el cliente es el que toma la decisión»).
  - El equipo carga el reporte con `admin_inspeccion_reporte`. El PDF del
    inspector viene en inglés y se traduce completo al español con Claude
    (`impTraducirReporte`, llave `IMPORLAN_WA_ANTHROPIC`).
  - El cliente lo lee y lo descarga en español, y decide con
    `user_inspeccion_decision`:
    - **Aprueba:** se cobra el Pago 2.
    - **Declina:** elige otra lancha (el Pago 1 se abona) o pide la
      devolución.
  - La lancha declinada no se vuelve a elegir. Nunca se le obliga nada al
    cliente.
- **David Morris** (ddm4me25@gmail.com) lleva la operación en EE. UU. Le
  llegan correos en inglés pidiendo la actualización que toca. Contesta en
  un link privado por expediente (`api/operador_usa.php?r=portal`), con nota
  y fotos/videos.
  - Fotos y videos → el cliente los ve.
  - Nota y PDF → sólo el equipo, que comparte con el cliente lo que quiera,
    con su texto.
- **No debe existir comunicación alguna entre David y el cliente.** Su rol
  (`agent`) no tiene chat ni ve correo/teléfono de clientes
  (`ocultarContactoParaAgente()` en `api/auth_helper.php`). Nada que se le
  mande a David lleva datos de contacto del cliente ni precios.

## Correo contacto@imporlan.cl

El agente en la nube no llega a mail.imporlan.cl. Para leer o enviar se
dispara `.github/workflows/correo.yml` (GitHub Actions) y se lee el log del
job. Requiere el secret `IMPORLAN_MAIL_PASS`. Nunca usar `accion: enviar` sin
que JP haya aprobado el texto exacto. Todo correo enviado a un cliente va
**siempre con copia oculta (CCO) a jpchs1@gmail.com** — el workflow la agrega
solo (`MAIL_BCC`); no quitarla. Y va **firmado por Juan Pablo**, con su
firma gráfica (`.github/correo/firma-jp.jpg`, remitente «Juan Pablo · Imporlan»);
el workflow la pone sola. Escribir el texto en su nombre, en primera persona.

## Correo contacto@deckeva.cl

Se envía con el mismo workflow, `cuenta: deckeva` (secret `DECKEVA_MAIL_PASS`
en ESTE repo). No desde el repo de Deckeva: es público y sus logs de Actions
también. Remitente «Juan Pablo · Deckeva», con su firma gráfica pegada al final
(`.github/correo/firma-deckeva.jpg`, la pone el workflow solo), CCO a
jpchs1@gmail.com igual que Imporlan.

## Adjuntos (PDF de cotización, etc.)

`DATOS.adjuntos` = nombres de archivo en `.github/correo/adjuntos/`. Como traen
datos de clientes, NUNCA van a `main`: se crea una rama temporal
`correo/adjuntos-<algo>` desde main con el archivo, se dispara `correo.yml` con
`ref` en esa rama y al terminar se borra la rama.

## Cotizaciones de Deckeva (regla de JP)

Siempre con el **formato de la autocotización de la web** (el PDF nuevo de
`deckeva/wp-content/mu-plugins/deckeva-assets/pdf-cotizacion.php`), no un
diseño propio. Herramienta: `.github/correo/cotizacion-deckeva/`
(`render.php` + `pdf.mjs`, ver `ejemplo.json`). Clonar jpchs1/deckeva para
tener la plantilla y las fuentes.

- **Forma de pago, siempre:** 50% para iniciar · 50% para el envío o para
  coordinar la instalación, una vez que el piso está listo (`forma_pago`).
- **Toma de medidas e instalación son OPCIONALES: $155.000 + IVA cada una**
  (JP, 29-sep-2026), mismo valor en todas las regiones y para motos de agua.
  **No se suman al total** ni van en `servicios`: la plantilla las pinta sola en
  la sección «Opcionales» (neto, IVA 19% y total con IVA = $184.450) y explica
  que el cliente también las puede hacer él mismo con el video explicativo. El
  valor vive en `deckeva/wp-content/mu-plugins/deckeva-00-opcionales.php`, no se
  escribe en el JSON. Nada de «contrátalo con un técnico» ni de los $145.000
  viejos. `servicios_incluidos` (aviso verde, incluidas en el total) solo si JP
  lo pide expresamente para un cliente.
- No mencionar pies/tamaño si JP no lo pide (`embarcacion.tamano` vacío).
- El correo: mensaje breve en el cuerpo + firma de Deckeva; el PDF adjunto
  (rama temporal, ver «Adjuntos»).
