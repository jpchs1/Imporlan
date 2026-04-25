<?php
/**
 * US Operations API — Imporlan
 *
 * Backend for the /USOperations/ deal desk. Single endpoint with an
 * `action` query parameter, JSON in / JSON out, simple shared-secret
 * auth via the X-Ops-Token header (or ?token=).
 *
 * Endpoints:
 *   GET  ?action=ping                       — health check
 *   GET  ?action=list                       — list deals (light columns)
 *   GET  ?action=get&deal_number=US-2026-001
 *   POST ?action=save        body: { deal_number, payload }
 *   POST ?action=advance     body: { deal_number, to_index, actor?, note? }
 *   POST ?action=audit       body: { deal_number, action, from?, to?, note?, actor? }
 *   GET  ?action=audit_log&deal_number=...
 *
 * The shared secret is read from /home/wwimpo/deploy_config.php
 * (constant US_OPS_TOKEN) or the env var US_OPS_TOKEN, so it never
 * lives in the repo.
 */

require_once __DIR__ . '/cors_helper.php';
setCorsHeadersSecure();
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/db_config.php';

// ----------------------------------------------------------
//  AUTH
// ----------------------------------------------------------
function us_ops_token() {
    $cfg = '/home/wwimpo/deploy_config.php';
    if (file_exists($cfg)) {
        require_once $cfg;
        if (defined('US_OPS_TOKEN'))   return US_OPS_TOKEN;
        if (defined('DEPLOY_TOKEN'))   return DEPLOY_TOKEN; // fallback to deploy token
    }
    $env = getenv('US_OPS_TOKEN');
    return $env ?: null;
}

function require_token() {
    $expected = us_ops_token();
    if (!$expected) {
        // No token configured — block writes, allow GET ping/list/get for
        // safe local development. Production must configure a token.
        if (in_array($_SERVER['REQUEST_METHOD'], ['POST','PUT','DELETE','PATCH'], true)) {
            http_response_code(503);
            die(json_encode(['ok' => false, 'error' => 'US_OPS_TOKEN not configured on server']));
        }
        return;
    }
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $given = $headers['X-Ops-Token']
          ?? $headers['x-ops-token']
          ?? $_GET['token']
          ?? '';
    if (preg_match('/^Bearer\s+(.+)/i', $headers['Authorization'] ?? ($headers['authorization'] ?? ''), $m)) {
        $given = $m[1];
    }
    if (!$given || !hash_equals($expected, $given)) {
        http_response_code(403);
        die(json_encode(['ok' => false, 'error' => 'Invalid token']));
    }
}

// ----------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------
function json_in() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $j = json_decode($raw, true);
    return is_array($j) ? $j : [];
}
function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
function ok($extra = []) {
    echo json_encode(array_merge(['ok' => true], $extra));
    exit;
}
function actor() {
    $h = function_exists('getallheaders') ? getallheaders() : [];
    return $h['X-User-Email'] ?? $h['x-user-email'] ?? null;
}

// Extract denormalized columns from the JSON payload so the listing /
// dashboard queries don't have to parse JSON.
function denormalize($payload) {
    $p = is_array($payload) ? $payload : (json_decode($payload, true) ?: []);
    $num = function ($v) { return is_numeric($v) ? (float)$v : null; };

    $buy   = $num($p['agreedPrice'] ?? null) ?? $num($p['targetPrice'] ?? null) ?? $num($p['askingPrice'] ?? null);
    $pickup = ($num($p['transportCost'] ?? null) ?? 0)
            + ($num($p['fuelCost'] ?? null) ?? 0)
            + ($num($p['storageMonthly'] ?? null) ?? 0);
    $refit = 0.0;
    foreach (($p['refit'] ?? []) as $r) {
        $refit += ($num($r['parts'] ?? 0) ?? 0) + ($num($r['labor'] ?? 0) ?? 0);
    }
    $allIn = ($buy ?? 0) + $pickup + $refit;
    $sale  = $num($p['listPrice'] ?? null);
    $fees  = $num($p['sellingFees'] ?? null) ?? 0;
    $netRev = $sale !== null ? ($sale - $fees) : null;
    $profit = $netRev !== null ? ($netRev - $allIn) : null;
    $margin = ($sale !== null && $sale > 0 && $profit !== null) ? ($profit / $sale * 100) : null;

    return [
        'title'         => $p['makeModel'] ?? ($p['title'] ?? ''),
        'status'        => $p['dealStatus'] ?? 'Sourcing',
        'pipeline_index'=> isset($p['pipelineIndex']) ? (int)$p['pipelineIndex'] : 0,
        'source_url'    => $p['sourceUrl'] ?? null,
        'source_id'     => $p['fbItemId']  ?? ($p['sourceId'] ?? null),
        'location_us'   => $p['locationUS'] ?? null,
        'asking_price'  => $num($p['askingPrice'] ?? null),
        'target_price'  => $num($p['targetPrice'] ?? null),
        'agreed_price'  => $num($p['agreedPrice'] ?? null),
        'list_price'    => $sale,
        'sold_price'    => $num($p['soldPrice'] ?? null),
        'all_in_cost'   => $allIn,
        'projected_profit' => $profit,
        'margin_pct'    => $margin
    ];
}

// ----------------------------------------------------------
//  ROUTING
// ----------------------------------------------------------
$action = $_GET['action'] ?? 'ping';

try {
    $pdo = getDbConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    switch ($action) {

        // -----------------------------------------------------------
        case 'ping':
            ok(['service' => 'us_operations_api', 'time' => date('c')]);
            break;

        // -----------------------------------------------------------
        case 'list':
            require_token();
            $rows = $pdo->query("
                SELECT id, deal_number, title, status, pipeline_index, source_url,
                       asking_price, agreed_price, list_price, all_in_cost,
                       projected_profit, margin_pct, updated_at
                FROM us_ops_deals
                ORDER BY updated_at DESC
                LIMIT 200
            ")->fetchAll(PDO::FETCH_ASSOC);
            ok(['deals' => $rows]);
            break;

        // -----------------------------------------------------------
        case 'get':
            require_token();
            $dn = trim($_GET['deal_number'] ?? '');
            if ($dn === '') fail('deal_number required');
            $stmt = $pdo->prepare("SELECT * FROM us_ops_deals WHERE deal_number = ?");
            $stmt->execute([$dn]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) fail('Deal not found', 404);
            $row['payload'] = json_decode($row['payload'], true);
            ok(['deal' => $row]);
            break;

        // -----------------------------------------------------------
        case 'save':
            require_token();
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
            $body = json_in();
            $dn      = trim($body['deal_number'] ?? '');
            $payload = $body['payload'] ?? null;
            if ($dn === '' || !is_array($payload)) fail('deal_number and payload required');

            $denorm = denormalize($payload);
            $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($payloadJson === false) fail('Invalid payload JSON');

            $stmt = $pdo->prepare("
                INSERT INTO us_ops_deals
                    (deal_number, title, status, pipeline_index, source_url, source_id,
                     location_us, asking_price, target_price, agreed_price, list_price,
                     sold_price, all_in_cost, projected_profit, margin_pct, payload, owner_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    title          = VALUES(title),
                    status         = VALUES(status),
                    pipeline_index = VALUES(pipeline_index),
                    source_url     = VALUES(source_url),
                    source_id      = VALUES(source_id),
                    location_us    = VALUES(location_us),
                    asking_price   = VALUES(asking_price),
                    target_price   = VALUES(target_price),
                    agreed_price   = VALUES(agreed_price),
                    list_price     = VALUES(list_price),
                    sold_price     = VALUES(sold_price),
                    all_in_cost    = VALUES(all_in_cost),
                    projected_profit = VALUES(projected_profit),
                    margin_pct     = VALUES(margin_pct),
                    payload        = VALUES(payload),
                    owner_email    = COALESCE(VALUES(owner_email), owner_email)
            ");
            $stmt->execute([
                $dn,
                $denorm['title'],
                $denorm['status'],
                $denorm['pipeline_index'],
                $denorm['source_url'],
                $denorm['source_id'],
                $denorm['location_us'],
                $denorm['asking_price'],
                $denorm['target_price'],
                $denorm['agreed_price'],
                $denorm['list_price'],
                $denorm['sold_price'],
                $denorm['all_in_cost'],
                $denorm['projected_profit'],
                $denorm['margin_pct'],
                $payloadJson,
                actor()
            ]);
            ok([
                'deal_number' => $dn,
                'updated_at'  => date('c'),
                'kpis'        => [
                    'all_in_cost'      => $denorm['all_in_cost'],
                    'projected_profit' => $denorm['projected_profit'],
                    'margin_pct'       => $denorm['margin_pct']
                ]
            ]);
            break;

        // -----------------------------------------------------------
        case 'advance':
            require_token();
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
            $body = json_in();
            $dn   = trim($body['deal_number'] ?? '');
            $to   = isset($body['to_index']) ? (int)$body['to_index'] : null;
            if ($dn === '' || $to === null) fail('deal_number and to_index required');

            $cur = $pdo->prepare("SELECT id, pipeline_index, status FROM us_ops_deals WHERE deal_number = ?");
            $cur->execute([$dn]);
            $row = $cur->fetch(PDO::FETCH_ASSOC);
            if (!$row) fail('Deal not found', 404);

            $stages = ['Sourcing','Negotiation','Purchase','Pickup','Refit','Sale'];
            $newStatus = $stages[min($to, count($stages) - 1)] ?? 'Sourcing';

            $upd = $pdo->prepare("UPDATE us_ops_deals SET pipeline_index = ?, status = ? WHERE id = ?");
            $upd->execute([max(0, $to), $newStatus, $row['id']]);

            $audit = $pdo->prepare("
                INSERT INTO us_ops_audit (deal_id, actor, action, from_val, to_val, note)
                VALUES (?, ?, 'stage_change', ?, ?, ?)
            ");
            $audit->execute([
                $row['id'],
                $body['actor'] ?? actor(),
                (string)$row['pipeline_index'],
                (string)$to,
                $body['note'] ?? null
            ]);
            ok(['deal_number' => $dn, 'pipeline_index' => $to, 'status' => $newStatus]);
            break;

        // -----------------------------------------------------------
        case 'audit':
            require_token();
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
            $body = json_in();
            $dn = trim($body['deal_number'] ?? '');
            $act = trim($body['action'] ?? '');
            if ($dn === '' || $act === '') fail('deal_number and action required');

            $cur = $pdo->prepare("SELECT id FROM us_ops_deals WHERE deal_number = ?");
            $cur->execute([$dn]);
            $id = $cur->fetchColumn();
            if (!$id) fail('Deal not found', 404);

            $ins = $pdo->prepare("
                INSERT INTO us_ops_audit (deal_id, actor, action, from_val, to_val, note)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $ins->execute([
                $id,
                $body['actor'] ?? actor(),
                $act,
                $body['from'] ?? null,
                $body['to']   ?? null,
                $body['note'] ?? null
            ]);
            ok(['deal_number' => $dn, 'action' => $act]);
            break;

        // -----------------------------------------------------------
        case 'audit_log':
            require_token();
            $dn = trim($_GET['deal_number'] ?? '');
            if ($dn === '') fail('deal_number required');
            $stmt = $pdo->prepare("
                SELECT a.id, a.actor, a.action, a.from_val, a.to_val, a.note, a.created_at
                FROM us_ops_audit a
                JOIN us_ops_deals d ON d.id = a.deal_id
                WHERE d.deal_number = ?
                ORDER BY a.created_at DESC
                LIMIT 200
            ");
            $stmt->execute([$dn]);
            ok(['events' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        // -----------------------------------------------------------
        default:
            fail('Unknown action: ' . $action, 400);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
