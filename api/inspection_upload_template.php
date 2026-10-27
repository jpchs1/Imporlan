<?php
/** Transactional survey-upload email. Pure renderer; no DB, mail or credentials. */
function opuInspectionEscape($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function opuInspectionItems() {
    return [
        'report' => ['Inspection report', 'The complete technical survey, as a PDF.'],
        'photos' => ['Inspection photos', 'Hull, engine, interior and any findings.'],
        'videos' => ['Inspection videos', 'Walk-around, engine running and any tests recorded.'],
    ];
}

/** Normalize the three requirements without treating an exception as a file. */
function opuInspectionEmailRequirements($data) {
    $out = [];
    foreach (opuInspectionItems() as $key => $item) {
        $details = $data['requirements'][$key] ?? null;
        $received = is_array($details) ? !empty($details['received']) : !empty($data['received'][$key]);
        $reason = is_array($details['exception'] ?? null) ? trim((string) ($details['exception']['reason'] ?? '')) : '';
        $out[$key] = [
            'received' => $received,
            'count' => $received && is_array($details) && array_key_exists('count', $details) ? max(1, intval($details['count'])) : null,
            'files' => $received && is_array($details['files'] ?? null) ? $details['files'] : [],
            'reason' => $received ? '' : $reason,
            'resolved' => $received || $reason !== '',
        ];
    }
    return $out;
}

/** $data deliberately excludes all customer contact details and prices. */
function opuInspectionEmail($data) {
    $e = 'opuInspectionEscape';
    $requirements = opuInspectionEmailRequirements($data);
    $missing = [];
    $names = ['report' => 'inspection report (PDF)', 'photos' => 'inspection photos', 'videos' => 'inspection videos'];
    $complete = 0;
    $resolved = 0;
    $exceptions = 0;
    foreach ($requirements as $key => $requirement) {
        if ($requirement['received']) $complete++;
        if ($requirement['resolved']) $resolved++;
        if ($requirement['reason'] !== '') $exceptions++;
        if (!$requirement['resolved']) $missing[] = $names[$key];
    }
    $pendingList = count($missing) > 1 ? implode(', ', array_slice($missing, 0, -1)) . ' and ' . end($missing) : implode('', $missing);
    $reminder = !empty($data['reminder']);
    $title = (string) ($data['boat'] ?? 'Boat inspection');
    $file = (string) ($data['order_number'] ?? '');
    $url = (string) ($data['portal_url'] ?? '');
    $name = (string) ($data['operator_name'] ?? 'David');
    $receipt = ($data['mode'] ?? '') === 'received' && $resolved === 3;
    $subject = '[Imporlan] ' . ($reminder ? 'Reminder: please provide ' . $pendingList : 'Upload inspection report, photos and videos') . ' · ' . $file;
    if (!$reminder && count($missing) < 3) $subject = '[Imporlan] Please provide ' . $pendingList . ' · ' . $file;
    $preheader = 'The inspection is complete. Please provide the ' . $pendingList . ' in your private portal.';
    $intro = $reminder
        ? 'A quick follow-up: we only need the ' . $pendingList . '. The checklist below confirms what is already recorded; there is no need to upload those items again.'
        : 'Now that the inspection is complete, please upload the remaining material: ' . $pendingList . '. This gives our team the information needed to review the findings and update the import file.';
    $headline = $reminder ? 'Only what is missing.<br>One clear checklist.' : 'Inspection done.<br>Let’s get the full picture.';
    $buttonText = 'Upload ' . $pendingList;
    $buttonHint = 'Your private upload link. No login needed. Up to 100 MB per file.';
    $noteTitle = 'Missing something? Record the reason.';
    $noteText = 'Upload each pending item in the portal. If you do not have it or it was not recorded, mark that item as not available and explain why. A recorded reason resolves that requirement without marking the file as received. Reminders stop when all three requirements are resolved. Photos and videos are added to the import file; reports and notes stay with the Imporlan team until reviewed.';
    $closing = 'Please use the portal to upload the pending items or record a reason for each unavailable item. Email replies and links in a note do not update this checklist.';
    if (!$missing && !$receipt) {
        $subject = '[Imporlan] Inspection checklist resolved · ' . $file;
        $preheader = 'All three requirements are resolved. Our team can continue reviewing the import file.';
        $intro = 'Your available files and any reasons for unavailable items are recorded in the system. No additional upload is required for this checklist.';
        $headline = 'Checklist resolved.<br>Ready for our review.';
        $buttonText = 'View inspection checklist';
    }
    if ($receipt) {
        $subject = '[Imporlan] Thank you: ' . ($exceptions ? 'inspection checklist resolved' : 'inspection files received') . ' · ' . $file;
        $preheader = $exceptions
            ? ($complete ? 'Thank you. The available files and reasons for unavailable items are recorded. Our team can continue the review.' : 'Thank you. The reasons for unavailable items are recorded. Our team can continue the review.')
            : 'Thank you. The inspection report, photos and videos have been received. Our team will review the package with the buyer.';
        $intro = $exceptions
            ? ($complete ? 'Thank you for uploading the available inspection material and explaining why the remaining items are not available.' : 'Thank you for explaining why the inspection material is not available.') . ' All three requirements are now resolved and recorded separately. Our team can continue reviewing the information with the buyer and coordinate the next steps in the acquisition process. An unavailable item is recorded as an exception, not as a received file.'
            : 'Thank you for uploading the inspection report, photos and videos for this boat. The complete package is now recorded in the system, so our team can review the findings with the buyer and coordinate the next steps in the acquisition process.';
        $headline = ($exceptions ? 'Checklist resolved.' : 'Files received.') . '<br>Thank you, ' . $e($name) . '.';
        $buttonText = 'View inspection file';
        $buttonHint = 'Your private file. No login needed. Please keep this link private.';
        $noteTitle = 'What happens next';
        $noteText = 'The Imporlan team will review the inspection findings and any recorded exceptions, then guide the buyer through the next acquisition steps. Please wait for our confirmation before proceeding with the purchase. Upload reminders for this package have stopped.';
        $closing = 'Thank you for keeping the import file up to date. We will contact you if any clarification or additional material is needed.';
    }
    $rows = '';
    $plainItems = [];
    $index = 0;
    foreach (opuInspectionItems() as $key => $item) {
        $index++;
        $requirement = $requirements[$key];
        $done = $requirement['received'];
        $exception = $requirement['reason'] !== '';
        $status = $done ? 'Received' : ($exception ? 'Not available · reason recorded' : 'To upload');
        $detail = $item[1];
        if ($done && $requirement['count'] !== null) $detail .= ' ' . $requirement['count'] . ' file' . ($requirement['count'] === 1 ? '' : 's') . ' recorded.';
        $filenames = [];
        foreach (array_slice($requirement['files'], 0, 3) as $savedFile) {
            if (is_array($savedFile) && !empty($savedFile['original_name'])) $filenames[] = (string) $savedFile['original_name'];
        }
        $extra = '';
        if ($filenames) {
            $list = implode(' · ', $filenames);
            if ($requirement['count'] > count($filenames)) $list .= ' · +' . ($requirement['count'] - count($filenames)) . ' more';
            $extra .= '<p style="margin:6px 0 0;font-size:11px;line-height:1.6;color:#526b7b;word-break:break-word;overflow-wrap:anywhere;">' . $e($list) . '</p>';
        }
        if ($exception) $extra .= '<p style="margin:7px 0 0;font-size:12px;line-height:1.6;color:#526b7b;word-break:break-word;overflow-wrap:anywhere;"><strong>Reason:</strong> ' . nl2br($e($requirement['reason'])) . '</p>';
        $plainItems[] = $item[0] . ': ' . $status . '. ' . $detail
            . ($filenames ? "\nFiles: " . implode(', ', $filenames) : '')
            . ($exception ? "\nReason: " . $requirement['reason'] : '');
        $color = $done ? '#08745b' : ($exception ? '#365c7a' : '#805719');
        $background = $done ? '#e7f5ef' : ($exception ? '#edf3f8' : '#fff4df');
        $rows .= '<tr><td width="34" valign="top" style="padding:18px 0;border-bottom:1px solid #e6edf2;"><span style="display:inline-block;font-size:12px;font-weight:bold;color:#087c91;background:#e8f6f8;border-radius:8px;padding:8px;">0' . $index . '</span></td>'
            . '<td valign="top" style="padding:18px 10px 18px 8px;border-bottom:1px solid #e6edf2;"><p style="margin:0 0 5px;font-size:15px;font-weight:bold;color:#142c3d;">' . $e($item[0]) . '</p><p style="margin:0;font-size:13px;line-height:1.6;color:#526b7b;">' . $e($detail) . '</p>' . $extra . '</td>'
            . '<td width="94" align="right" valign="top" style="padding:20px 0;border-bottom:1px solid #e6edf2;"><span style="display:inline-block;font-size:11px;line-height:1.5;font-weight:bold;color:' . $color . ';background:' . $background . ';border-radius:5px;padding:6px 8px;">' . $e($status) . '</span></td></tr>';
    }
    $progress = $complete . ' OF 3 RECEIVED';
    if ($exceptions) $progress .= '<br><span style="display:inline-block;margin-top:4px;">' . $resolved . ' OF 3 RESOLVED</span>';
    $details = array_filter([$data['location'] ?? '', !empty($data['hours']) ? $data['hours'] . ' engine hours' : '']);
    $photo = (string) ($data['image_url'] ?? '');
    // Only real HTTPS listing images. The email remains complete with images blocked.
    $image = preg_match('#^https://#i', $photo)
        ? '<tr><td><img src="' . $e($photo) . '" width="640" alt="' . $e($title) . '" style="display:block;width:100%;max-width:640px;height:auto;max-height:300px;object-fit:cover;border:0;"></td></tr>' : '';
    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' . $e($subject) . '</title>'
        . '<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}a:focus{outline:3px solid #22d3ee;outline-offset:3px}@media only screen and (max-width:600px){.outer{padding:12px 8px!important}.pad{padding-left:22px!important;padding-right:22px!important}.headline{font-size:30px!important;line-height:1.15!important}.cta{display:block!important;text-align:center!important}.brand-sub{display:none!important}}</style></head>'
        . '<body style="margin:0;padding:0;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;color:#142c3d;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' . $e($preheader) . '</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#edf2f5"><tr><td class="outer" align="center" style="padding:32px 16px;">'
        . '<!--[if mso]><table role="presentation" width="640"><tr><td><![endif]-->'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dce5eb;">'
        . '<tr><td class="pad" bgcolor="#102c3d" style="padding:25px 36px;"><table role="presentation" width="100%"><tr><td style="font-size:23px;letter-spacing:3px;font-weight:bold;color:#ffffff;">IMPORLAN<span style="color:#54c5cf;">.</span></td><td class="brand-sub" align="right" style="font-size:10px;letter-spacing:2px;color:#bdd0da;">US OPERATIONS</td></tr></table></td></tr>'
        . '<tr><td height="4" bgcolor="#36bdc8" style="font-size:0;line-height:0;">&nbsp;</td></tr>'
        . '<tr><td class="pad" style="padding:34px 36px 26px;"><p style="margin:0 0 17px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#087c91;">INSPECTION COMPLETED &nbsp; / &nbsp; ' . ($complete === 3 ? 'FILES RECEIVED' : ($resolved === 3 ? 'CHECKLIST RESOLVED WITH EXCEPTIONS' : 'FILES PENDING')) . '</p>'
        . '<h1 class="headline" style="margin:0 0 16px;font-size:38px;line-height:1.12;letter-spacing:-1.2px;font-weight:bold;color:#102c3d;">' . $headline . '</h1>'
        . '<p style="margin:0 0 9px;font-size:15px;line-height:1.7;color:#142c3d;">Hi ' . $e($name) . ',</p><p style="margin:0;font-size:14px;line-height:1.8;color:#526b7b;">' . $e($intro) . '</p></td></tr>'
        . $image
        . '<tr><td class="pad" style="padding:22px 36px;background:#f5f8fa;border-top:1px solid #e6edf2;border-bottom:1px solid #e6edf2;"><p style="margin:0 0 7px;font-size:10px;letter-spacing:1.6px;color:#526b7b;">IMPORT FILE &nbsp; ' . $e($file) . '</p><h2 style="margin:0 0 7px;font-size:20px;line-height:1.35;color:#142c3d;">' . $e($title) . '</h2>'
        . ($details ? '<p style="margin:0;font-size:12px;line-height:1.6;color:#526b7b;">' . $e(implode(' · ', $details)) . '</p>' : '') . '</td></tr>'
        . '<tr><td class="pad" style="padding:27px 36px 10px;"><table role="presentation" width="100%"><tr><td><h2 style="margin:0;font-size:18px;color:#142c3d;">Your upload checklist</h2></td><td align="right" style="font-size:11px;color:#526b7b;">' . $progress . '</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr>'
        . '<tr><td class="pad" style="padding:22px 36px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="#087c91" align="center" style="border-radius:8px;mso-padding-alt:17px 26px;"><a class="cta" href="' . $e($url) . '" style="display:block;padding:17px 26px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border:1px solid #087c91;border-radius:8px;">' . $e($buttonText) . ' &nbsp; &#8594;</a></td></tr></table><p style="margin:12px 0 0;text-align:center;font-size:11px;line-height:1.7;color:#526b7b;">' . $e($buttonHint) . '</p></td></tr>'
        . '<tr><td class="pad" style="padding:0 36px 27px;"><table role="presentation" width="100%" bgcolor="#eef7f8"><tr><td style="padding:17px 18px;border-left:3px solid #36bdc8;"><p style="margin:0 0 5px;font-size:12px;font-weight:bold;color:#142c3d;">' . $e($noteTitle) . '</p><p style="margin:0;font-size:12px;line-height:1.8;color:#526b7b;">' . $e($noteText) . '</p></td></tr></table></td></tr>'
        . '<tr><td class="pad" style="padding:0 36px 28px;"><p style="margin:0 0 17px;font-size:13px;line-height:1.8;color:#526b7b;">' . $e($closing) . '</p>'
        . '<p style="margin:0 0 12px;font-size:13px;color:#142c3d;">Warm regards,</p><p style="margin:0;font-size:13px;line-height:1.7;color:#142c3d;"><strong>Juan Pablo</strong><br>Commercial &amp; Logistics<br>Imporlan · Tu lancha, puerta a puerta<br><a href="mailto:contacto@imporlan.cl" style="color:#087c91;text-decoration:none;">contacto@imporlan.cl</a> · +56 9 4021 1459 · www.imporlan.cl</p></td></tr>'
        . '<tr><td class="pad" bgcolor="#f5f8fa" style="padding:20px 36px;border-top:1px solid #e6edf2;"><p style="margin:0 0 7px;font-size:11px;line-height:1.8;color:#526b7b;">All client communication goes through Imporlan. Please do not contact the client directly.</p><p style="margin:0;font-size:10px;line-height:1.8;color:#526b7b;">Button not working? <a href="' . $e($url) . '" style="color:#087c91;text-decoration:underline;">Open your private upload page</a>. Do not forward this link.</p></td></tr></table>'
        . '<!--[if mso]></td></tr></table><![endif]--><p style="margin:18px 0 0;font-size:10px;letter-spacing:1px;color:#526b7b;">IMPORLAN &nbsp; · &nbsp; TU LANCHA, PUERTA A PUERTA</p></td></tr></table></body></html>';
    $text = "Hi $name,\n\n$intro\n\nImport file: $file\nBoat: $title\n\n$complete OF 3 RECEIVED\n$resolved OF 3 RESOLVED\n\n" . implode("\n", $plainItems)
        . "\n\n$buttonText:\n$url\n\n$buttonHint\n\n$noteTitle\n$noteText\n\n$closing\n\nWarm regards,\n\nJuan Pablo\nCommercial & Logistics\nImporlan · Tu lancha, puerta a puerta\ncontacto@imporlan.cl · +56 9 4021 1459 · www.imporlan.cl\n\nAll client communication goes through Imporlan. Please do not contact the client directly. Do not forward this private link.";
    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

function opuInspectionThankYouEmail($data) {
    $data['mode'] = 'received';
    if (!array_key_exists('received', $data) && empty($data['requirements'])) {
        $data['received'] = ['report' => true, 'photos' => true, 'videos' => true];
    }
    return opuInspectionEmail($data);
}
