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

Cotizaciones de Deckeva: PDF con el formato de `build_international_pdf_html`
(repo deckeva, `wp-content/mu-plugins/deckeva-cotizador.php`), en español.
