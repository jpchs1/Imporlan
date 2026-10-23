<?php
/** Safe, synthetic preview: php test/preview-inspection-email.php > /tmp/preview.html */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/inspection_upload_template.php';
$thanks = in_array('--thanks', $argv, true);
$render = $thanks ? 'opuInspectionThankYouEmail' : 'opuInspectionEmail';
$data = [
    'boat' => 'Chaparral 21 Sport H2O 2015', 'order_number' => 'IMP-DEMO',
    'operator_name' => 'David', 'location' => 'Lula, Georgia', 'hours' => '163',
    'portal_url' => 'https://www.imporlan.cl/',
    'reminder' => in_array('--reminder', $argv, true),
];
if (!$thanks || in_array('--partial', $argv, true)) {
    $data['received'] = in_array('--partial', $argv, true) ? ['report' => true, 'photos' => true] : [];
}
if (in_array('--counts', $argv, true) || in_array('--exceptions', $argv, true)) {
    $exception = in_array('--exceptions', $argv, true);
    $data['requirements'] = [
        'report' => ['received' => true, 'count' => 1, 'files' => [['original_name' => 'Inspection-report.pdf']], 'exception' => null, 'resolved' => true],
        'photos' => ['received' => true, 'count' => 30, 'files' => [['original_name' => 'Hull-01.HEIC'], ['original_name' => 'Engine-02.HEIC'], ['original_name' => 'Interior-03.HEIC']], 'exception' => null, 'resolved' => true],
        'videos' => [
            'received' => false, 'count' => 0, 'files' => [],
            'exception' => $exception ? ['reason' => 'No video was recorded during the survey. The available photos and written report document the findings.', 'created_at' => '2026-10-23 18:00:00'] : null,
            'resolved' => $exception,
        ],
    ];
    $data['received'] = ['report' => true, 'photos' => true, 'videos' => false];
    $data['completion_mode'] = $exception ? 'with_exceptions' : null;
}
$mail = $render($data);
echo $mail['html'];
