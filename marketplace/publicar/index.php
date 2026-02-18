<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
setcookie('mkt_publish', '1', time() + 60, '/');
header('Location: /panel/#marketplace');
http_response_code(302);
exit;
