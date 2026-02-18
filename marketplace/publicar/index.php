<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Location: /panel/?publicar=1#marketplace');
http_response_code(302);
exit;
