<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$isTest = strpos($_SERVER['REQUEST_URI'] ?? '', '/test/') !== false;
$base = $isTest ? '/panel-test/' : '/panel/';
setcookie('mkt_publish', '1', time() + 60, '/');
header('Location: ' . $base . '#marketplace');
http_response_code(302);
exit;
