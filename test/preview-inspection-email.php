<?php
/** Safe, synthetic preview: php test/preview-inspection-email.php > /tmp/preview.html */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/inspection_upload_template.php';
$mail = opuInspectionEmail([
    'boat' => 'Chaparral 21 Sport H2O 2015', 'order_number' => 'IMP-DEMO',
    'operator_name' => 'David', 'location' => 'Lula, Georgia', 'hours' => '163',
    'portal_url' => 'https://www.imporlan.cl/',
    'reminder' => in_array('--reminder', $argv, true),
    'received' => in_array('--partial', $argv, true) ? ['report'=>true, 'photos'=>true] : [],
]);
echo $mail['html'];
