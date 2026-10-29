<?php
/**
 * El panel del cliente habla bien — pruebas
 * ========================================
 *
 * Nada de esto rompe el sitio, y por eso vuelve solo. Un estado de la base
 * asomando en ingles, una tilde que falta, un "tenes" argentino en una web
 * chilena: cada uno por separado es una tonteria, y juntos son la diferencia
 * entre un panel que parece de una empresa y uno que parece de un fin de
 * semana. Lo que se escribe sin prueba se desescribe solo.
 *
 * Se corre solo:  php test/panel-cliente-idioma-tests.php
 */

$raiz = __DIR__ . '/../admin-react/src';
$archivos = [];
foreach (['/user', '/shared/components'] as $dir) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($raiz . $dir));
    foreach ($it as $f) {
        if (preg_match('/\.jsx?$/', $f->getFilename())) $archivos[] = $f->getPathname();
    }
}
sort($archivos);

$ok = 0;
$fallos = [];

function prueba($titulo, $malos) {
    global $ok, $fallos;
    if (!$malos) { $ok++; echo "  ok    $titulo\n"; return; }
    $fallos[] = $titulo;
    echo "  FALLA $titulo\n";
    foreach (array_slice($malos, 0, 6) as $m) echo "          $m\n";
    if (count($malos) > 6) echo '          ... y ' . (count($malos) - 6) . " mas\n";
}

/** Busca un patron en todos los archivos y devuelve las lineas que lo cumplen. */
function buscar($archivos, $patron, $excluir = null) {
    $malos = [];
    foreach ($archivos as $ruta) {
        $corto = str_replace(dirname(__DIR__) . '/admin-react/src/', '', $ruta);
        foreach (explode("\n", file_get_contents($ruta)) as $i => $linea) {
            if (!preg_match($patron, $linea)) continue;
            if ($excluir && preg_match($excluir, $linea)) continue;
            $malos[] = $corto . ':' . ($i + 1) . '  ' . trim(substr($linea, 0, 90));
        }
    }
    return $malos;
}

echo "\nEl panel del cliente habla bien\n";
echo str_repeat('-', 54) . "\n";

// 1. La clave cruda de la base nunca se le muestra al cliente. Para eso estan
//    statusLabel() y paymentMethodLabel(); el bug era que la insignia del
//    detalle las usaba y la de la tarjeta no, y el cliente leia "IN PROGRESS".
prueba('ningun estado ni medio de pago se muestra en crudo',
    buscar($archivos, "/\{\s*\(?\s*\w*\.?(status|payment_method)[^}]*replace\(\/_\/g/"));

// 2. Imporlan es chilena: se trata de tu, no de vos.
prueba('no hay voseo argentino',
    buscar($archivos, '/\b(ten[eé]s|pod[eé]s|quer[eé]s|recib[ií]s|eleg[ií]|habl[aá]lo|prob[aá])\b/i'));

// 3. Toda pregunta abre con ¿. Es lo que mas delata a un sitio en español.
prueba('todas las preguntas abren con ¿',
    buscar($archivos, "/'[^']{6,120}\?'/", "/'¿/"));

// 4. Las palabras que mas aparecen en este panel, con su tilde.
$sinTilde = [
    'busqueda', 'cotizacion', 'importacion', 'inspeccion', 'informacion',
    'embarcacion', 'ubicacion', 'descripcion', 'operacion', 'instalacion',
    'aqui', 'habiles', 'proximo', 'ultimo', 'numero', 'metodo', 'credito',
    'telefono', 'tambien', 'despues', 'tecnica', 'facturacion', 'envio',
    'dia', 'dias', 'aun', 'todavia', 'estan', 'pais', 'paises', 'maritimo',
];
$malos = [];
foreach ($sinTilde as $p) {
    // Solo dentro de texto. Una clave de datos (`ubicacion:`, `item.ano`,
    // `cotizacion_link`) y un valor interno de filtro (`'busqueda'` a secas,
    // que se compara contra lo que manda el servidor) tienen que seguir SIN
    // tilde: ahi el acento no es estilo, es una rotura.
    $excluir = '/\b' . $p . '\s*:'          // clave de objeto
             . '|\.\s*' . $p . '\b'          // propiedad leida de la API
             . '|\b' . $p . '\??\.[a-zA-Z_$]' // variable usada como objeto (inspeccion.titulo)
             . '|' . $p . '_'                // parte de una clave compuesta
             . "|'" . $p . "'"               // literal suelto: valor interno
             . '|\/' . $p . "['\"]"          // ruta de import (shared/lib/importacion)
             . '|' . $p . '-|-' . $p . '\b'  // id o clase con guion (cotizacion-elegida)
             . '/i';
    $enTexto = buscar($archivos, "/['\">][^'\"<]*\b" . $p . "\b/i", $excluir);
    $malos = array_merge($malos, $enTexto);
}
prueba('las palabras frecuentes llevan su tilde', $malos);

// 5. "Si" sin tilde es la conjuncion condicional. Una respuesta que empieza
//    "Si." esta diciendo otra cosa.
prueba('el "si" afirmativo lleva tilde',
    buscar($archivos, "/:\s*'Si[.,]/"));

// 6. Y el ano que no es un año.
prueba('no se escribe "ano" por "año"',
    buscar($archivos, "/['\"][^'\"]*\b[0-9]+\s+anos?\b/i"));

// 7. Y AL REVES: ningun acento donde va CODIGO.
//
// Esta es la que mas importa, y la que falto la primera vez. Acentuar a ciegas
// rompio cosas que no dan error, solo dejan de funcionar:
//   - 'via-slate-800' -> 'vía-slate-800': Tailwind ya no la reconoce y los
//     degradados de TODO el panel perdieron su tono intermedio.
//   - item.condicion -> item.condición: la API manda 'condicion'. Las
//     publicaciones perdian su condicion y se creaban siempre como "Buena".
//   - set('descripcion') -> set('descripción'): el campo de descripcion del
//     marketplace quedo imposible de editar.
//   - r.version -> r.versión: todos los reportes salian como v1.
// Ninguna de las cuatro se ve en una captura de pantalla.
$T = 'áéíóúñÁÉÍÓÚÑ';
$enCodigo = [];
foreach ($archivos as $ruta) {
    $corto = str_replace(dirname(__DIR__) . '/admin-react/src/', '', $ruta);
    foreach (explode("\n", file_get_contents($ruta)) as $i => $linea) {
        $donde = $corto . ':' . ($i + 1);
        // Clases de Tailwind: siempre con guion y nunca con tilde.
        if (preg_match('/\b(?:via|from|to|bg|text|border|ring|shadow)-[a-z]*[' . $T . ']/u', $linea, $m)
            || preg_match('/\b[a-z]*[' . $T . '][a-z]*-(?:slate|cyan|gray|blue|indigo|violet|emerald|amber|rose|red|teal|sky)\b/u', $linea, $m)) {
            $enCodigo[] = "$donde  clase de Tailwind: {$m[0]}";
        }
        // Clave de un setter: set('campo', ...).
        if (preg_match("/\bset[A-Z]?\w*\(\s*'[a-zA-Z_]*[" . $T . "][a-zA-Z_]*'/u", $linea, $m)) {
            $enCodigo[] = "$donde  clave de setter: {$m[0]}";
        }
        // Lo que sigue es fuera de las comillas: ahi el acento es texto y esta bien.
        $codigo = preg_replace("/'(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`/u", "''", $linea);
        // Propiedad leida de un objeto: item.condicion, r.version.
        if (preg_match('/\.[a-zA-Z_]*[' . $T . '][a-zA-Z_0-9]*\b/u', $codigo, $m)) {
            $enCodigo[] = "$donde  propiedad: {$m[0]}";
        }
        // Nombre de variable o funcion.
        if (preg_match('/\b(?:const|let|var|function)\s+[a-zA-Z_]*[' . $T . ']/u', $codigo, $m)) {
            $enCodigo[] = "$donde  identificador: {$m[0]}";
        }
    }
}
prueba('ningun acento donde va codigo (clases, claves, propiedades)', $enCodigo);

echo str_repeat('-', 54) . "\n";
if ($fallos) {
    echo count($fallos) . " prueba(s) fallaron.\n\n";
    exit(1);
}
echo "$ok prueba(s), todo en orden.\n\n";
