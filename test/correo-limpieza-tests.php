<?php
/** Limpieza de la bandeja de contacto@imporlan.cl (JP, 20-nov-2026). php test/correo-limpieza-tests.php */
require_once __DIR__ . '/../api/correo_limpieza.php';

$ok = 0; $fallas = 0;
function check($c, $msg) { global $ok, $fallas; if ($c) { $ok++; echo "ok  $msg\n"; } else { $fallas++; echo "FALLA  $msg\n"; } }

$r = ccsReglas();
$m = function ($from, $extra = []) use ($r) { return ccsMotivo(array_merge(['from' => $from, 'subject' => 'x'], $extra), $r); };

echo "Reglas\n";
check($r['umbral'] > 0 && $r['umbral'] < 5 && count($r['confiables']) > 5 && count($r['dominios']) > 5, 'el archivo de reglas se lee, con un umbral bajo el de SpamAssassin (5,0)');
check(!array_intersect($r['confiables'], $r['dominios']), 'ningún dominio es confiable y bloqueado a la vez');

echo "\nQué es basura\n";
check($m('Regalos Cobre <comunicacion@smtpserver.cl>') === 'dominio bloqueado', 'publicidad masiva de un dominio bloqueado');
check($m('Correo Masivo <informaciones@publimailing.notify-it.com>') === 'dominio bloqueado', 'también sus subdominios');
check($m('PartsVu <partsvu@partsvu.com>') === 'remitente bloqueado', 'el newsletter de PartsVu');
check($m('Tyler (PartsVu) <support@partsvu.zendesk.com>') === null, 'pero no su soporte, que lleva un envío real');
check($m('Servicioalcliente Antofagastaminerals <otra.direccion.nueva@gmail.com>') === 'suplantación', 'una empresa que escribe desde un Gmail es suplantación, aunque cambie la dirección');
check($m('Juan Pérez <juan.perez@gmail.com>') === null, 'una persona que escribe desde Gmail se queda en la bandeja');
check($m('=?UTF-8?B?Q29kZWxjbyBQcm92ZWVkb3Jlcw==?= <codelco.pagos@hotmail.com>') === 'suplantación', 'el nombre codificado (MIME) también se revisa');
check($m('X <a@nuevo-spam.cl>', ['x-spam-status' => 'No, score=4.7 required=5.0']) === 'puntaje de spam 4.7', 'un puntaje bajo 5 pero sobre el umbral va a spam');
check($m('X <a@nuevo-spam.cl>', ['x-spam-score' => '23']) === 'puntaje de spam 2.3', 'X-Spam-Score de cPanel viene multiplicado por 10');
check($m('X <a@nuevo.cl>', ['x-spam-score' => '6']) === null, 'un puntaje bajo el umbral se queda');
check($m('X <a@nuevo.cl>', ['x-spam-flag' => 'YES']) === 'marcado como spam', 'lo que SpamAssassin ya marcó también');

echo "\nLo confiable nunca se mueve\n";
check($m('Notificación Scotiabank <avisos.info@scotiabank.cl>', ['x-spam-status' => 'Yes, score=9.1', 'authentication-results' => 'mx.imporlan.cl; spf=pass smtp.mailfrom=scotiabank.cl; dkim=pass header.d=scotiabank.cl']) === null, 'un aviso del banco firmado por el banco se queda, aunque tenga puntaje alto');
check($m('Scotiabank <avisos.info@scotiabank.cl>', ['x-spam-status' => 'Yes, score=9.1']) === 'marcado como spam', 'un «banco» sin firma y marcado como spam va a spam: el From se puede falsificar');
check($m('Scotiabank <avisos.info@scotiabank.cl>', ['x-spam-status' => 'Yes, score=9.1', 'authentication-results' => 'mx; dkim=pass header.d=estafa.com']) === 'marcado como spam', 'la firma de otro dominio no vale como la del banco');
check($m('Global66 <empresas@sender.global66.com>', ['x-spam-score' => '30', 'authentication-results' => 'mx; dmarc=pass (p=reject) header.from=global66.com']) === null, 'DMARC del dominio padre también cuenta');
check($m('Zaida <zaida@alltranslog.com>', ['x-spam-score' => '19']) === null, 'un proveedor confiable que no firma, con puntaje bajo 5, se queda');
check($m('Zaida <zaida@alltranslog.com>', ['x-spam-score' => '62']) === 'puntaje de spam 6.2', 'pero sin firma y sobre 5 (el umbral del servidor) se va: puede ser falsificado');
check($m('Scotiabank <avisos.info@scotiabank.cl>', ['x-spam-score' => '-34']) === null, 'un confiable sin firma pero con puntaje bajo se queda (las listas nunca lo bloquean)');
check($m('Global66 Business <empresas@sender.global66.com>') === null, 'Global66 (subdominio de un confiable)');
check($m('Alberto Lathrop E. <alathrop@lontue.com>', ['x-spam-score' => '45']) === null, 'un cliente confiable sin firma, con puntaje alto pero bajo 5, se queda');
check($m('Imporlan <contacto@imporlan.cl>') === null, 'los avisos del propio sistema');
check($m('Ventas <ventas@smtpserver.cl.ejemplo.com>') === null, 'un dominio que sólo contiene el bloqueado no se confunde con él');
check($m('sin direccion') === null, 'un remitente ilegible se deja para revisarlo a mano');

echo "\nRevisión de la bandeja\n";
class ImapDoble {
    public $movidos = []; public $carpeta = 'INBOX.spam'; public $correos;
    public function __construct($c) { $this->correos = $c; }
    public function buscarDesde($ts) { return array_keys($this->correos); }
    public function encabezados(array $uids) { return array_intersect_key($this->correos, array_flip($uids)); }
    public function carpetaSpam() { return $this->carpeta; }
    public function mover(array $uids, $c) { $this->movidos[$c] = array_merge($this->movidos[$c] ?? [], $uids); }
}
$bandeja = [
    10 => ['from' => 'Banco <avisos.info@scotiabank.cl>'],
    11 => ['from' => 'Regalos <comunicacion@smtpserver.cl>'],
    12 => ['from' => 'Cliente <cliente@empresa.cl>', 'x-spam-score' => '-20'],
    13 => ['from' => 'Eclypse <hola@env1.eclypse-design.net>', 'x-spam-score' => '59'],
];
$d = new ImapDoble($bandeja);
$res = ccsLimpiar($d, $r, 3, true);
check($res['revisados'] === 4 && count($res['movidos']) === 2 && !$d->movidos, 'en simulación informa la basura sin mover nada');
$res = ccsLimpiar($d, $r, 3);
check(($d->movidos['INBOX.spam'] ?? []) === [11, 13], 'mueve a la carpeta de spam sólo la basura, nunca el banco ni el cliente');
check($res['movidos'][0]['de'] === 'comunicacion@smtpserver.cl' && $res['movidos'][0]['motivo'] === 'dominio bloqueado', 'deja registro del remitente y el motivo, sin el asunto ni el cuerpo');
$d2 = new ImapDoble([12 => $bandeja[12]]);
$d2->carpeta = null;
check(ccsLimpiar($d2, $r, 3)['movidos'] === [], 'sin basura no busca carpeta ni mueve nada');
$d3 = new ImapDoble([11 => $bandeja[11]]);
$d3->carpeta = null;
try { ccsLimpiar($d3, $r, 3); check(false, 'sin carpeta de spam falla'); } catch (RuntimeException $e) { check(!$d3->movidos, 'sin carpeta de spam no mueve nada ni borra: falla y queda en el estado'); }

echo "\nCliente IMAP (servidor simulado)\n";
function imapSimulado(array $respuestas) {
    $par = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
    fwrite($par[1], implode('', $respuestas));
    return $par;
}
$hdr1 = "From: Regalos <comunicacion@smtpserver.cl>\r\nX-Spam-Score: 30\r\n\r\n";
$hdr2 = "From: \"Banco\"\r\n <avisos.info@scotiabank.cl>\r\nSubject: UID 999 Aviso\r\n\r\n";
$par = imapSimulado([
    "* OK Dovecot ready.\r\n",
    "C1 OK Logged in\r\n",
    "* CAPABILITY IMAP4rev1 UIDPLUS MOVE IDLE\r\nC2 OK done\r\n",
    "* 6321 EXISTS\r\nC3 OK [READ-WRITE] Select completed\r\n",
    "* SEARCH 19406 19410\r\nC4 OK Search completed\r\n",
    "* 1 FETCH (UID 19406 BODY[HEADER.FIELDS (FROM SUBJECT X-SPAM-STATUS X-SPAM-SCORE X-SPAM-FLAG)] {" . strlen($hdr1) . "}\r\n" . $hdr1 . ")\r\n",
    "* 2 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT X-SPAM-STATUS X-SPAM-SCORE X-SPAM-FLAG)] {" . strlen($hdr2) . "}\r\n" . $hdr2 . " UID 19410)\r\nC5 OK Fetch completed\r\n",
    "* LIST (\\HasNoChildren) \".\" INBOX\r\n* LIST (\\HasNoChildren \\Junk) \".\" \"INBOX.spam\"\r\nC6 OK List completed\r\n",
    "* OK [COPYUID 1 19406 4580] Moved\r\n* 1 EXPUNGE\r\nC7 OK Move completed\r\n",
    "* BYE Logging out\r\nC8 OK Logout completed\r\n",
]);
$imap = new CcsImap('mail.ejemplo', 993, $par[0]);
$imap->entrar('contacto@imporlan.cl', 'cla"ve\\x');
$res = ccsLimpiar($imap, $r, 60);
$imap->salir();
$enviado = stream_get_contents($par[1]);
check($res['revisados'] === 2 && count($res['movidos']) === 1 && $res['movidos'][0]['uid'] === 19406, 'lee los encabezados (con literales y UID antes o después) y elige la basura');
check($res['carpeta'] === 'INBOX.spam', 'encuentra la carpeta marcada \\Junk');
check(strpos($enviado, 'C1 LOGIN "contacto@imporlan.cl" "cla\\"ve\\\\x"') !== false, 'la clave va entre comillas, escapada');
check(strpos($enviado, 'C7 UID MOVE 19406 "INBOX.spam"') !== false && strpos($enviado, 'STORE') === false && strpos($enviado, 'EXPUNGE') === false, 'mueve con UID MOVE; nunca marca como borrado ni expurga');
check(strpos($enviado, 'BODY.PEEK[') !== false && strpos($enviado, 'BODY[') === false, 'pide sólo encabezados y con PEEK: no marca nada como leído');
check(preg_match('/C4 UID SEARCH SINCE \d{1,2}-[A-Z][a-z]{2}-\d{4}\r\n/', $enviado) === 1, 'busca por fecha en el formato IMAP');

$par = imapSimulado(["* OK ready\r\n", "* CAPABILITY IMAP4rev1\r\nC1 OK\r\n"]);
$sinMove = new CcsImap('x', 993, $par[0]);
$sinMove->cmd('CAPABILITY');
try { $sinMove->mover([1], 'INBOX.spam'); check(false, 'sin MOVE no hace nada'); } catch (RuntimeException $e) { stream_set_blocking($par[1], false); check(strpos((string) stream_get_contents($par[1]), 'COPY') === false, 'si el servidor no permite MOVE, no intenta copiar y borrar'); }

$par = imapSimulado(["* OK ready\r\n", "C1 NO [AUTHENTICATIONFAILED] Authentication failed.\r\n"]);
try { (new CcsImap('x', 993, $par[0]))->entrar('a@b.cl', 'secreta'); check(false, 'login fallido'); }
catch (RuntimeException $e) { check(strpos($e->getMessage(), 'AUTHENTICATIONFAILED') !== false && strpos($e->getMessage(), 'secreta') === false, 'un login fallido avisa el motivo sin repetir la clave'); }

echo "\nEl cron\n";
$cron = file_get_contents(__DIR__ . '/../cron-deploy.sh');
check(substr_count($cron, 'run_correo_limpieza') >= 3 && strpos($cron, "trap 'procesar_cola_al_salir; run_inspection_followups; run_correo_limpieza' EXIT") !== false, 'el cron del hosting corre la limpieza en cada vuelta, haya o no deploy');
$cli = file_get_contents(__DIR__ . '/../api/cron/correo_limpieza.php');
check(strpos($cli, "PHP_SAPI !== 'cli'") !== false, 'el script no se puede ejecutar desde la web');

// Canario: si la regla de confiables dejara de mandar, el banco se movería.
$sinConfiables = $r; $sinConfiables['confiables'] = [];
check(ccsMotivo(['from' => 'B <avisos.info@scotiabank.cl>', 'x-spam-status' => 'Yes, score=9.1', 'authentication-results' => 'mx; dkim=pass header.d=scotiabank.cl'], $sinConfiables) !== null, 'canario: la protección de los confiables es la que salva al banco');

echo "\n$ok checks de limpieza de correo, $fallas fallas\n";
exit($fallas ? 1 : 0);
