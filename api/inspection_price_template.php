<?php
/** Pure transactional renderer. Customer contacts and quotation amounts never enter this email. */
require_once __DIR__ . '/inspection_upload_template.php';

function opuInspectionPriceEmail($data) {
    $e = 'opuInspectionEscape';
    $name = (string) ($data['operator_name'] ?? 'David');
    $file = (string) ($data['order_number'] ?? '');
    $boat = (string) ($data['boat'] ?? 'Selected boat');
    $url = (string) ($data['portal_url'] ?? '');
    $reminder = !empty($data['reminder']);
    $subject = '[Imporlan] ' . ($reminder ? 'Reminder: confirm post-inspection purchase price' : 'Confirm purchase price after the technical inspection') . ' · ' . $file;
    $intro = $reminder
        ? 'We are following up on the purchase price after the technical inspection. Please confirm the current position in your private portal so our team can review it and coordinate the next acquisition steps.'
        : 'Now that the technical inspection has taken place, please confirm whether any specific finding affects the purchase price previously agreed with the seller. We need your explicit update before the acquisition can proceed.';
    $steps = [
        ['Price unchanged', 'Confirm that the seller maintains the previously agreed purchase price and enter the amount in USD.'],
        ['Price adjusted', 'Enter the previous and revised purchase prices in USD. Explain the inspection finding, the reason for the adjustment and what has been agreed with the seller.'],
        ['Still being negotiated', 'Explain what remains unresolved, the inspection finding involved and the next expected update. This keeps the price confirmation pending.'],
    ];
    $rows = ''; $plain = [];
    foreach ($steps as $index => $step) {
        $rows .= '<tr><td valign="top" width="34" style="padding:18px 0;border-bottom:1px solid #e2e8f0;color:#087c91;font-size:13px;font-weight:bold;">0' . ($index + 1) . '</td><td style="padding:18px 0;border-bottom:1px solid #e2e8f0;"><p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#102c3d;">' . $e($step[0]) . '</p><p style="margin:0;font-size:14px;line-height:1.75;color:#526b7b;">' . $e($step[1]) . '</p></td></tr>';
        $plain[] = $step[0] . ': ' . $step[1];
    }
    $note = 'Your update is internal to the Imporlan team. It does not change the buyer’s quotation, approve the inspection, authorize a payment or authorize the purchase. Please wait for our confirmation before proceeding. All buyer communication is handled by Imporlan.';
    $hint = 'Use the portal to record your answer. An email reply or a general upload note does not complete this price confirmation. Pending confirmations receive one morning reminder per day, Chile time; reminders stop when a confirmed price is recorded.';
    $html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $e($subject) . '</title><style>table{border-collapse:collapse}a:focus{outline:3px solid #36bdc8;outline-offset:3px}@media(max-width:600px){.outer{padding:12px 8px!important}.pad{padding-left:22px!important;padding-right:22px!important}.headline{font-size:30px!important}}</style></head>'
        . '<body style="margin:0;background:#edf2f5;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Please confirm whether the inspection changes the agreed purchase price.</div>'
        . '<table role="presentation" width="100%" bgcolor="#edf2f5"><tr><td class="outer" align="center" style="padding:32px 16px;"><!--[if mso]><table role="presentation" width="640"><tr><td><![endif]--><table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #dce5eb;">'
        . '<tr><td class="pad" bgcolor="#102c3d" style="padding:25px 36px;color:#fff;font-size:23px;letter-spacing:3px;font-weight:bold;">IMPORLAN<span style="color:#54c5cf;">.</span><p style="font-size:10px;letter-spacing:2px;color:#bdd0da;margin:8px 0 0;">US OPERATIONS · PURCHASE REVIEW</p></td></tr><tr><td height="4" bgcolor="#36bdc8"></td></tr>'
        . '<tr><td class="pad" style="padding:32px 36px 26px;"><p style="margin:0 0 16px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#087c91;">AFTER THE TECHNICAL INSPECTION</p><h1 class="headline" style="margin:0 0 20px;font-size:38px;line-height:1.15;letter-spacing:-1px;color:#102c3d;">One price confirmation.<br>A clear next step.</h1><p style="margin:0 0 10px;font-size:15px;color:#142c3d;">Hi ' . $e($name) . ',</p><p style="margin:0;font-size:14px;line-height:1.8;color:#526b7b;">' . $e($intro) . '</p></td></tr>'
        . '<tr><td class="pad" bgcolor="#f5f8fa" style="padding:22px 36px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;"><p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;color:#526b7b;">IMPORT FILE · ' . $e($file) . '</p><h2 style="margin:0;font-size:20px;line-height:1.4;color:#142c3d;">' . $e($boat) . '</h2></td></tr>'
        . '<tr><td class="pad" style="padding:26px 36px 8px;"><h2 style="margin:0;font-size:18px;color:#142c3d;">Choose the current situation</h2><table role="presentation" width="100%">' . $rows . '</table></td></tr>'
        . '<tr><td class="pad" style="padding:24px 36px;"><table role="presentation" width="100%"><tr><td align="center" bgcolor="#087c91" style="border-radius:8px;"><a href="' . $e($url) . '" style="display:block;padding:18px 20px;border:1px solid #087c91;border-radius:8px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;">Update purchase price &nbsp; &#8594;</a></td></tr></table><p style="margin:12px 0 0;font-size:11px;line-height:1.7;text-align:center;color:#526b7b;">Your private operation link. No login needed. Do not forward.</p></td></tr>'
        . '<tr><td class="pad" style="padding:0 36px 25px;"><table role="presentation" width="100%" bgcolor="#eef7f8"><tr><td style="padding:17px 18px;border-left:3px solid #36bdc8;"><p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#142c3d;">Before proceeding</p><p style="margin:0;font-size:12px;line-height:1.8;color:#526b7b;">' . $e($note) . '</p></td></tr></table><p style="margin:18px 0 0;font-size:12px;line-height:1.8;color:#526b7b;">' . $e($hint) . '</p></td></tr>'
        . '<tr><td class="pad" style="padding:0 36px 28px;font-size:13px;line-height:1.8;color:#142c3d;">Thank you,<br><strong>Juan Pablo</strong><br>Commercial &amp; Logistics · Imporlan<br><a href="mailto:contacto@imporlan.cl" style="color:#087c91;">contacto@imporlan.cl</a></td></tr>'
        . '<tr><td class="pad" bgcolor="#f5f8fa" style="padding:18px 36px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:#526b7b;">All client communication goes through Imporlan. Please do not contact the client directly.<br><a href="' . $e($url) . '" style="color:#087c91;">Open your private operation page</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
    return ['subject' => $subject, 'html' => $html, 'text' => "Hi $name,\n\n$intro\n\nImport file: $file\nBoat: $boat\n\n" . implode("\n\n", $plain) . "\n\nUpdate purchase price:\n$url\n\n$note\n\n$hint\n\nThank you,\nJuan Pablo\nCommercial & Logistics · Imporlan\ncontacto@imporlan.cl\n\nPlease do not contact the client directly. Do not forward this private link."];
}
