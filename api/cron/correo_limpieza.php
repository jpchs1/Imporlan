<?php
/**
 * CLI. Lo corre el cron del hosting (cron-deploy.sh, cada 5 minutos): mueve a
 * la carpeta de spam la basura que llegó a la bandeja de contacto@imporlan.cl.
 * Reglas y motivo en api/correo_limpieza.php y api/cron/correo-spam.json.
 *
 * Revisa los últimos 3 días; una vez al día, los últimos 60 (así se limpió
 * también lo que había llegado antes). Deja:
 *  - /home/wwimpo/correo-limpieza.log: uid, remitente y motivo de cada correo
 *    movido (privado, fuera del sitio).
 *  - https://www.imporlan.cl/.imporlan_mail_status: sólo hora y conteos,
 *    para verificar desde fuera que corre.
 *
 *   php api/cron/correo_limpieza.php [--simular] [--dias=N]
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../correo_limpieza.php';

$home = '/home/wwimpo';
$estadoPublico = $home . '/imporlan.cl/.imporlan_mail_status';
$marcaProfunda = $home . '/.imporlan_correo_limpieza';
$simular = in_array('--simular', $argv, true);
$dias = 3;
foreach ($argv as $a) if (preg_match('/^--dias=(\d{1,3})$/', $a, $m)) $dias = (int) $m[1];
$hoy = gmdate('Y-m-d');
$profunda = !$simular && trim((string) @file_get_contents($marcaProfunda)) !== $hoy;
if ($profunda) $dias = max($dias, 60);

$estado = function ($txt) use ($estadoPublico, $simular) {
    if (!$simular) @file_put_contents($estadoPublico, 'checked: ' . gmdate('Y-m-d H:i') . ' UTC | ' . $txt . "\n");
};

$cfg = $home . '/smtp_config.php';
if (is_file($cfg)) { ob_start(); require_once $cfg; ob_end_clean(); }
$host = defined('IMPORLAN_IMAP_HOST') ? IMPORLAN_IMAP_HOST : (defined('IMPORLAN_SMTP_HOST') ? IMPORLAN_SMTP_HOST : 'mail.imporlan.cl');
$usuario = defined('IMPORLAN_SMTP_USERNAME') ? IMPORLAN_SMTP_USERNAME : 'contacto@imporlan.cl';
$clave = defined('IMPORLAN_SMTP_PASSWORD') ? IMPORLAN_SMTP_PASSWORD : (getenv('IMPORLAN_SMTP_PASSWORD') ?: '');
if ($clave === '') { $estado('ERROR: sin clave del correo'); exit(1); }

try {
    $imap = new CcsImap($host, 993);
    $imap->entrar($usuario, $clave);
    $res = ccsLimpiar($imap, ccsReglas(), $dias, $simular);
    $imap->salir();
} catch (Throwable $e) {
    // El mensaje de error del cliente IMAP no lleva la clave ni datos de correos.
    $estado('ERROR: ' . substr(preg_replace('/\s+/', ' ', $e->getMessage()), 0, 120));
    fwrite(STDERR, '[correo-limpieza] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

if ($profunda) @file_put_contents($marcaProfunda, $hoy);
foreach ($res['movidos'] as $m) {
    $linea = gmdate('Y-m-d H:i') . ($simular ? ' SIMULADO' : '') . ' uid=' . $m['uid'] . ' de=' . $m['de'] . ' motivo=' . $m['motivo'];
    if ($simular) echo $linea . PHP_EOL;
    else @file_put_contents($home . '/correo-limpieza.log', $linea . PHP_EOL, FILE_APPEND);
}
$estado('OK | revisados ' . $res['revisados'] . ' (' . $dias . ' dias) | movidos a spam ' . count($res['movidos']));
if ($simular) echo 'revisados ' . $res['revisados'] . ' · basura ' . count($res['movidos']) . PHP_EOL;
exit(0);
