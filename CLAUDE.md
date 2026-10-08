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
