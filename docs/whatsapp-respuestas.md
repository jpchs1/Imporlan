# Respuestas por WhatsApp de Imporlan

El +56 9 4021 1459 atiende a Tourevo, Deckeva e Imporlan. Meta entrega todo a
tourevo.cl, que reconoce los chats de Imporlan y los deriva a
`api/whatsapp_puerta.php`, firmados. Acá se redactan con Claude, se espera 1 a
40 minutos (8:00–20:00), JP aprueba y lo aprobado vuelve firmado a la puerta de
tourevo.cl, que lo manda por el mismo número. Tourevo no redacta ni cotiza nada
de Imporlan (JP, 28-sep-2026).

## Para encenderlo

En `/home/wwimpo/credentials_config.php` (cPanel → Administrador de archivos):

```php
define('IMPORLAN_WA_SECRETO', '…');    // el mismo que PUERTA_IMPORLAN_SECRETO en tourevo-cl
define('IMPORLAN_WA_ANTHROPIC', '…');  // llave de Claude
// define('IMPORLAN_WA_MODO', 'automatico');  // por defecto: borrador
```

Sin esas dos no hace nada.

## Aprobar

A JP le llega un correo por borrador, desde contacto@imporlan.cl, con el link
al panel (`api/whatsapp_puerta.php?r=panel&k=…`). Ahí se aprueba tal cual, se
corrige o se descarta.

## Reglas

- Modo borrador por defecto: nada sale sin aprobación.
- Nunca un precio por WhatsApp; un texto con importe, guion largo o voseo no
  sale nunca, ni en automático.
- No sale si alguien contestó después del cliente, ni pasadas 23 h.
- El estado vive en `api/logs/whatsapp.json` (no se sirve por URL).
