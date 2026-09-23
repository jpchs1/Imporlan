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
que JP haya aprobado el texto exacto.
