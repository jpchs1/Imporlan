<?php
/**
 * «Rehacer con mi indicación» · el contestador de WhatsApp.
 *
 * JP, 8-oct-2026, mirando un borrador sobre una consulta de motorhome:
 *
 *   «Yo sólo debería poner "Sí podemos, pero deben ser casas rodantes,
 *    motorhome usadas ya no se puede" y la misma IA redactar nuevamente el
 *    mensaje con ese input nuevo.»
 *
 * O sea: no reescribir el mensaje entero en el textarea, sino decir QUÉ
 * corregir. Lo que este test fija:
 *
 *  1. La indicación llega al modelo, en el MENSAJE y no en el sistema, y con
 *     la orden de que manda sobre lo que la IA creía saber.
 *  2. Rehacer NO manda: el borrador queda en borrador, para que JP lea el
 *     texto nuevo y recién ahí apruebe.
 *  3. El texto nuevo pasa por `iwa_validar()` igual que cualquier otro — una
 *     indicación no es una puerta para que salga un precio.
 *  4. La indicación se aprende (`iwa_aprender`), con tope, y entra en el
 *     prompt de las respuestas siguientes: «motorhome usado ya no se puede»
 *     es un dato del negocio, no una respuesta para un solo cliente.
 *
 *   php test/whatsapp-rehacer-tests.php
 */

$ok = 0;
$mal = 0;
function t($cond, $que)
{
    global $ok, $mal;
    if ($cond) { $ok++; return; }
    $mal++;
    fwrite(STDERR, "FALLA: {$que}\n");
}

// El archivo define constantes y despacha por `?r=`; sin ruta no hace nada.
$_GET = array();
$_POST = array();
$_SERVER['REQUEST_METHOD'] = 'GET';
require_once __DIR__ . '/../api/whatsapp_puerta.php';

$src = (string) file_get_contents(__DIR__ . '/../api/whatsapp_puerta.php');

/* ── 1 · la indicación llega al modelo, y pesa ───────────────────────── */
t(strpos($src, "'redactar' => function (\$mensajes, \$indicacion = '')") !== false,
    'el redactor recibe la indicación (y sin ella sigue funcionando igual)');
t(strpos($src, '<indicacion_de_juan_pablo>') !== false, 'va en una etiqueta propia, no mezclada con el chat');
t(strpos($src, 'su indicación es el dato correcto, aunque contradiga lo que creías saber') !== false,
    'se le dice que la indicación manda sobre lo que sabía');
t(strpos($src, 'No la copies literal ni la menciones') !== false,
    'y que la escriba con sus palabras: el cliente no tiene que leer una nota interna');
// En el mensaje y no en el sistema: el sistema es lo permanente, esto es de ESTE chat.
$posSistema = strpos($src, "'system' => iwa_sistema()");
$posInd = strpos($src, '<indicacion_de_juan_pablo>');
t($posSistema !== false && $posInd !== false && $posInd > $posSistema,
    'la indicación va en el mensaje del usuario, no en el prompt de sistema');

/* ── 2 · rehacer no manda ────────────────────────────────────────────── */
if (preg_match("/elseif \(\\\$accion === 'rehacer'\) \{(.*?)\n            \} else \{/s", $src, $m)) {
    $rama = $m[1];
    t(strpos($rama, "'aprobado'") === false, 'rehacer NO aprueba el borrador');
    t(strpos($rama, "estado") === false || strpos($rama, "\$p['estado'] =") === false,
        'rehacer no toca el estado: sigue en borrador hasta que JP apruebe');
    t(strpos($rama, 'iwa_aprender(') !== false, 'rehacer aprende la indicación');
    t(strpos($rama, "\$p['regla'] = iwa_validar(") !== false,
        'el texto rehecho se vuelve a validar (una indicación no deja pasar un precio)');
    t(strpos($rama, "texto_original") !== false, 'se guarda el borrador original, para poder comparar');
    t(strpos($rama, 'if ($indicacion === \'\')') !== false, 'sin indicación no se llama al modelo');
} else {
    t(false, 'existe la rama «rehacer» en el panel');
}
t(strpos($src, 'name="indicacion"') !== false, 'el panel tiene el campo para escribirla');
t(strpos($src, 'value="rehacer"') !== false, 'y su botón');

/* ── 3 · lo que se aprende, con tope y en el prompt ──────────────────── */
t(defined('IWA_APRENDIDO_MAX') && IWA_APRENDIDO_MAX > 0, 'hay tope de indicaciones guardadas');
t(strpos($src, 'array_slice($todas, -IWA_APRENDIDO_MAX)') !== false,
    'al pasar el tope se cae la más vieja, no la más nueva');
t(strpos($src, '. iwa_aprendido_prompt();') !== false, 'lo aprendido entra en el prompt de sistema');

// Con el archivo de aprendizaje vacío, el prompt queda como estaba.
$archivo = __DIR__ . '/../api/logs/whatsapp-aprendido.json';
$habia = is_file($archivo) ? (string) file_get_contents($archivo) : null;
@unlink($archivo);
$sinNada = iwa_sistema();
t(strpos($sinNada, 'Lo que Juan Pablo te fue corrigiendo') === false, 'sin indicaciones el prompt no cambia');

// Y con una, el modelo la ve junto a lo que preguntó el cliente.
$chat = array('mensajes' => array(
    array('ts' => time() - 60, 'dir' => 'in', 'texto' => 'Hola, quiero cotizar importación de motorhome desde USA'),
));
iwa_aprender($chat, 'Sí podemos, pero deben ser casas rodantes nuevas; motorhome usadas ya no se puede');
$con = iwa_sistema();
t(strpos($con, 'motorhome usadas ya no se puede') !== false, 'la indicación entra en el prompt');
t(strpos($con, 'quiero cotizar importación de motorhome') !== false, 'y con lo que había preguntado el cliente');
t(strpos($con, 'Es el dato bueno') !== false, 'dicho como el dato que manda');

// Idempotencia del tope: 25 indicaciones dejan IWA_APRENDIDO_MAX.
for ($i = 0; $i < 25; $i++) iwa_aprender($chat, 'indicación de prueba ' . $i);
t(count(iwa_aprendido()) === IWA_APRENDIDO_MAX, 'se guardan ' . IWA_APRENDIDO_MAX . ' y no más · ' . count(iwa_aprendido()));
$ultimas = iwa_aprendido();
t(strpos((string) end($ultimas)['jp'], 'prueba 24') !== false, 'la última es la más nueva');

// Una indicación vacía no guarda nada.
$antes = count(iwa_aprendido());
iwa_aprender($chat, '   ');
t(count(iwa_aprendido()) === $antes, 'una indicación vacía no se guarda');

// Dejar el archivo como estaba: este test no es un seed.
if ($habia === null) { @unlink($archivo); } else { @file_put_contents($archivo, $habia); }

echo "whatsapp-rehacer: {$ok} ok, {$mal} fallas\n";
exit($mal > 0 ? 1 : 0);
