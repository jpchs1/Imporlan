<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
$base = $isTest ? '/panel-test/' : '/panel/';
header('Location: ' . $base . '?publicar=1#marketplace');
http_response_code(302);
exit;
