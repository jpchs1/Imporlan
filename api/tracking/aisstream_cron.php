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
 * Get active vessels that have IMO but no MMSI (need lookup)
 */
function getVesselsWithoutMMSI() {
    $pdo = getDbConnection();
    if (!$pdo) return [];
    
    try {
        $stmt = $pdo->query("
            SELECT id, display_name, imo, mmsi 
            FROM vessels 
            WHERE status IN ('active', 'arrived') 
              AND (mmsi IS NULL OR mmsi = '')
              AND imo IS NOT NULL AND imo != ''
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        logMsg("ERROR getting vessels without MMSI: " . $e->getMessage());
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

/**
 * Update vessel MMSI if found via AISstream ShipStaticData
 */
function updateVesselMMSI($vesselId, $mmsi) {
    $pdo = getDbConnection();
    if (!$pdo) return false;
    
    try {
        $stmt = $pdo->prepare("UPDATE vessels SET mmsi = ? WHERE id = ?");
        $stmt->execute([$mmsi, $vesselId]);
        logMsg("Updated MMSI for vessel $vesselId to $mmsi");
        return true;
    } catch (PDOException $e) {
        logMsg("ERROR updating MMSI: " . $e->getMessage());
        return false;
    }
}

/**
 * Minimal WebSocket client for PHP using streams
 */
function wsConnect($url) {
    $parsed = parse_url($url);
    $host = $parsed['host'];
    $port = ($parsed['scheme'] === 'wss') ? 443 : 80;
    $path = $parsed['path'] ?? '/';
    $useSSL = ($parsed['scheme'] === 'wss');
    
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ]
    ]);
    
    $address = ($useSSL ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $socket = @stream_socket_client($address, $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $context);
    
    if (!$socket) {
        logMsg("WebSocket connection failed: $errstr ($errno)");
        return null;
    }
    
    // WebSocket handshake
    $key = base64_encode(random_bytes(16));
    $headers = "GET $path HTTP/1.1\r\n" .
        "Host: $host\r\n" .
        "Upgrade: websocket\r\n" .
        "Connection: Upgrade\r\n" .
        "Sec-WebSocket-Key: $key\r\n" .
        "Sec-WebSocket-Version: 13\r\n" .
        "\r\n";
    
    fwrite($socket, $headers);
    
    // Read handshake response
    $response = '';
    while (($line = fgets($socket)) !== false) {
        $response .= $line;
        if (trim($line) === '') break;
    }
    
    if (strpos($response, '101') === false) {
        logMsg("WebSocket handshake failed: " . substr($response, 0, 200));
        fclose($socket);
        return null;
    }
    
    return $socket;
}

/**
 * Send a WebSocket text frame
 */
function wsSend($socket, $data) {
    $len = strlen($data);
    $mask = random_bytes(4);
    
    // Frame: FIN + opcode text
    $frame = chr(0x81);
    
    if ($len < 126) {
        $frame .= chr(0x80 | $len);
    } elseif ($len < 65536) {
        $frame .= chr(0x80 | 126) . pack('n', $len);
    } else {
        $frame .= chr(0x80 | 127) . pack('J', $len);
    }
    
    $frame .= $mask;
    
    for ($i = 0; $i < $len; $i++) {
        $frame .= $data[$i] ^ $mask[$i % 4];
    }
    
    return fwrite($socket, $frame);
}

/**
 * Read a WebSocket frame
 */
function wsRead($socket, $timeout = 5) {
    stream_set_timeout($socket, $timeout);
    
    $header = fread($socket, 2);
    if ($header === false || strlen($header) < 2) return null;
    
    $info = stream_get_meta_data($socket);
    if ($info['timed_out']) return null;
    
    $opcode = ord($header[0]) & 0x0F;
    $masked = (ord($header[1]) & 0x80) !== 0;
    $len = ord($header[1]) & 0x7F;
    
    if ($len === 126) {
        $ext = fread($socket, 2);
        if (strlen($ext) < 2) return null;
        $len = unpack('n', $ext)[1];
    } elseif ($len === 127) {
        $ext = fread($socket, 8);
        if (strlen($ext) < 8) return null;
        $len = unpack('J', $ext)[1];
    }
    
    if ($masked) {
        $mask = fread($socket, 4);
    }
    
    $data = '';
    $remaining = $len;
    while ($remaining > 0) {
        $chunk = fread($socket, min($remaining, 8192));
        if ($chunk === false || strlen($chunk) === 0) break;
        $data .= $chunk;
        $remaining -= strlen($chunk);
    }
    
    if ($masked && isset($mask)) {
        for ($i = 0; $i < strlen($data); $i++) {
            $data[$i] = $data[$i] ^ $mask[$i % 4];
        }
    }
    
    // Handle ping - send pong
    if ($opcode === 0x9) {
        wsSendPong($socket, $data);
        return wsRead($socket, $timeout);
    }
    
    // Handle close
    if ($opcode === 0x8) {
        return null;
    }
    
    return $data;
}

/**
 * Send WebSocket pong frame
 */
function wsSendPong($socket, $data = '') {
    $len = strlen($data);
    $mask = random_bytes(4);
    $frame = chr(0x8A); // FIN + pong
    $frame .= chr(0x80 | $len);
    $frame .= $mask;
    for ($i = 0; $i < $len; $i++) {
        $frame .= $data[$i] ^ $mask[$i % 4];
    }
    fwrite($socket, $frame);
}

/**
 * Close WebSocket connection
 */
function wsClose($socket) {
    $mask = random_bytes(4);
    $frame = chr(0x88) . chr(0x80) . $mask;
    @fwrite($socket, $frame);
    @fclose($socket);
}

// ===== MAIN EXECUTION =====

logMsg("Starting AISstream position update cron...");

// Get vessels to track
$vessels = getTrackedVessels();
$vesselsWithoutMMSI = getVesselsWithoutMMSI();

if (empty($vessels) && empty($vesselsWithoutMMSI)) {
    logMsg("No active vessels to track. Exiting.");
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

if (!empty($vesselsWithoutMMSI)) {
    logMsg("Found " . count($vesselsWithoutMMSI) . " vessel(s) without MMSI (IMO only) - cannot track via AISstream directly");
    foreach ($vesselsWithoutMMSI as $v) {
        logMsg("  - {$v['display_name']} (IMO: {$v['imo']}) - needs MMSI to track");
    }
}

if (empty($mmsiList)) {
    logMsg("No vessels with MMSI to track. Exiting.");
    exit(0);
}

// Limit to 50 MMSI per AISstream restriction
$mmsiList = array_slice($mmsiList, 0, 50);

logMsg("Connecting to AISstream WebSocket...");
$socket = wsConnect($WS_URL);

if (!$socket) {
    logMsg("Failed to connect to AISstream. Exiting.");
    exit(1);
}

logMsg("Connected. Sending subscription...");

// Subscribe to position reports for our vessels
$subscription = json_encode([
    'APIKey' => $API_KEY,
    'BoundingBoxes' => [[[-90, -180], [90, 180]]],
    'FiltersShipMMSI' => $mmsiList,
    'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData']
]);

wsSend($socket, $subscription);
logMsg("Subscription sent for " . count($mmsiList) . " vessels. Listening for {$LISTEN_SECONDS}s...");

$startTime = time();
$positionsReceived = 0;
$imoToMMSI = []; // Collect IMO -> MMSI mappings from ShipStaticData

while ((time() - $startTime) < $LISTEN_SECONDS) {
    $remaining = $LISTEN_SECONDS - (time() - $startTime);
    if ($remaining <= 0) break;
    
    $data = wsRead($socket, min($remaining, 5));
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
    } elseif ($msgType === 'ShipStaticData') {
        $staticData = $message['Message']['ShipStaticData'] ?? [];
        $imo = $staticData['ImoNumber'] ?? 0;
        if ($imo > 0 && $mmsi) {
            $imoToMMSI[strval($imo)] = $mmsi;
        }
    }
}

wsClose($socket);
logMsg("Disconnected. Received $positionsReceived position update(s).");

// Try to update MMSI for vessels that only had IMO
if (!empty($vesselsWithoutMMSI) && !empty($imoToMMSI)) {
    foreach ($vesselsWithoutMMSI as $v) {
        if (isset($imoToMMSI[$v['imo']])) {
            updateVesselMMSI($v['id'], $imoToMMSI[$v['imo']]);
        }
    }
}

logMsg("AISstream cron completed.");
