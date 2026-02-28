<?php
/**
 * AISstream.io Position Update Cron
 * 
 * Connects to AISstream WebSocket, subscribes to PositionReport messages
 * for all tracked vessels (by MMSI), collects positions for a short window,
 * then saves them to the vessel_positions table.
 * 
 * Usage: php aisstream_cron.php
 * Recommended: Run via cron every 5-10 minutes
 * 
 * Requires: AISSTREAM_API_KEY environment variable
 */

require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/websocket_client.php';

// Configuration
$LISTEN_SECONDS = 30; // How long to listen for position updates
$API_KEY = getenv('AISSTREAM_API_KEY') ?: '';
$WS_URL = 'wss://stream.aisstream.io/v0/stream';

if (!$API_KEY) {
    logMsg("ERROR: AISSTREAM_API_KEY environment variable not set");
    exit(1);
}

function logMsg($msg) {
    $ts = date('Y-m-d H:i:s');
    echo "[$ts] $msg\n";
    error_log("[aisstream_cron] $msg");
}

/**
 * Get all active tracked vessels with their MMSI numbers
 */
function getTrackedVessels() {
    $pdo = getDbConnection();
    if (!$pdo) return [];
    
    try {
        $stmt = $pdo->query("
            SELECT id, display_name, imo, mmsi 
            FROM vessels 
            WHERE status IN ('active', 'arrived') 
              AND (mmsi IS NOT NULL AND mmsi != '')
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        logMsg("ERROR getting vessels: " . $e->getMessage());
        return [];
    }
}

/**
 * Save position to vessel_positions table
 */
function savePosition($vesselId, $lat, $lon, $speed, $course, $destination, $eta) {
    $pdo = getDbConnection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'aisstream', NOW())
        ");
        $stmt->execute([$vesselId, $lat, $lon, $speed, $course, $destination, $eta]);
        return true;
    } catch (PDOException $e) {
        logMsg("ERROR saving position for vessel $vesselId: " . $e->getMessage());
        return false;
    }
}

// ===== MAIN EXECUTION =====

logMsg("Starting AISstream position update cron...");

// Get vessels to track
$vessels = getTrackedVessels();

if (empty($vessels)) {
    logMsg("No active vessels with MMSI to track. Exiting.");
    exit(0);
}

// Build MMSI list and lookup map
$mmsiList = [];
$mmsiToVessel = []; // MMSI => vessel ID mapping

foreach ($vessels as $v) {
    $mmsi = trim($v['mmsi']);
    if ($mmsi) {
        $mmsiList[] = $mmsi;
        $mmsiToVessel[$mmsi] = $v['id'];
        logMsg("Tracking vessel {$v['display_name']} (MMSI: $mmsi)");
    }
}

if (empty($mmsiList)) {
    logMsg("No vessels with MMSI to track. Exiting.");
    exit(0);
}

// Limit to 50 MMSI per AISstream restriction
$mmsiList = array_slice($mmsiList, 0, 50);

logMsg("Connecting to AISstream WebSocket...");
$ws = new WebSocketClient();

if (!$ws->connect($WS_URL)) {
    logMsg("Failed to connect to AISstream. Exiting.");
    exit(1);
}

logMsg("Connected. Sending subscription...");

// Subscribe to position reports for our vessels
$subscription = json_encode([
    'APIKey' => $API_KEY,
    'BoundingBoxes' => [[[-90, -180], [90, 180]]],
    'FiltersShipMMSI' => $mmsiList,
    'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport']
]);

$ws->send($subscription);
logMsg("Subscription sent for " . count($mmsiList) . " vessels. Listening for {$LISTEN_SECONDS}s...");

$startTime = time();
$positionsReceived = 0;

while ((time() - $startTime) < $LISTEN_SECONDS) {
    $remaining = $LISTEN_SECONDS - (time() - $startTime);
    if ($remaining <= 0) break;
    
    $data = $ws->read(min($remaining, 5));
    if ($data === null) continue;
    
    $message = json_decode($data, true);
    if (!$message) continue;
    
    // Check for errors
    if (isset($message['error'])) {
        logMsg("AISstream error: " . $message['error']);
        break;
    }
    
    $msgType = $message['MessageType'] ?? '';
    $metadata = $message['MetaData'] ?? [];
    $mmsi = strval($metadata['MMSI'] ?? '');
    $shipName = $metadata['ShipName'] ?? '';
    
    if ($msgType === 'PositionReport' || $msgType === 'StandardClassBPositionReport') {
        $report = $message['Message'][$msgType] ?? [];
        $lat = $report['Latitude'] ?? $metadata['latitude'] ?? null;
        $lon = $report['Longitude'] ?? $metadata['longitude'] ?? null;
        $speed = isset($report['Sog']) ? floatval($report['Sog']) : null;
        $course = isset($report['Cog']) ? floatval($report['Cog']) : null;
        
        if ($lat !== null && $lon !== null && isset($mmsiToVessel[$mmsi])) {
            $vesselId = $mmsiToVessel[$mmsi];
            savePosition($vesselId, $lat, $lon, $speed, $course, null, null);
            $positionsReceived++;
            logMsg("Position update: $shipName (MMSI: $mmsi) -> lat=$lat, lon=$lon, speed=$speed, course=$course");
        }
    }
}

$ws->close();
logMsg("Disconnected. Received $positionsReceived position update(s).");
logMsg("AISstream cron completed.");
