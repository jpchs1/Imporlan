<?php
require_once __DIR__ . '/ais_provider_interface.php';
require_once __DIR__ . '/../db_config.php';

class AISProvider implements AISProviderInterface {
    private $cacheMinutes = 10;
    private $apiKey;
    private $aisStreamKey;
    private $pdo;

    public function __construct() {
        $this->pdo = getDbConnection();
        $this->apiKey = getenv('AIS_API_KEY') ?: '';
        $this->aisStreamKey = getenv('AISSTREAM_API_KEY') ?: '';
    }

    public function getVesselPosition($imo = null, $mmsi = null) {
        if (!$imo && !$mmsi) {
            return null;
        }

        $vesselId = $this->findVesselId($imo, $mmsi);
        if (!$vesselId) {
            return null;
        }

        $cached = $this->getCachedPosition($vesselId);
        if ($cached) {
            return $cached;
        }

        // Try AISstream on-demand (WebSocket quick connect)
        if ($this->aisStreamKey && $mmsi) {
            $position = $this->fetchFromAISstream($mmsi);
            if ($position) {
                $this->persistPosition($vesselId, $position);
                return $position;
            }
        }

        // Try VesselFinder REST API as fallback
        $position = $this->fetchFromExternalAPI($imo, $mmsi);
        if ($position) {
            $this->persistPosition($vesselId, $position);
            return $position;
        }

        return $this->getLastKnownPosition($vesselId);
    }

    private function findVesselId($imo, $mmsi) {
        if (!$this->pdo) return null;
        try {
            if ($imo) {
                $stmt = $this->pdo->prepare("SELECT id FROM vessels WHERE imo = ? LIMIT 1");
                $stmt->execute([$imo]);
            } else {
                $stmt = $this->pdo->prepare("SELECT id FROM vessels WHERE mmsi = ? LIMIT 1");
                $stmt->execute([$mmsi]);
            }
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ? $row['id'] : null;
        } catch (PDOException $e) {
            error_log("[AISProvider] Error finding vessel: " . $e->getMessage());
            return null;
        }
    }

    private function getCachedPosition($vesselId) {
        if (!$this->pdo) return null;
        try {
            $stmt = $this->pdo->prepare("
                SELECT lat, lon, speed, course, destination, eta, source, fetched_at
                FROM vessel_positions
                WHERE vessel_id = ?
                  AND fetched_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
                ORDER BY fetched_at DESC
                LIMIT 1
            ");
            $stmt->execute([$vesselId, $this->cacheMinutes]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return [
                    'lat' => floatval($row['lat']),
                    'lon' => floatval($row['lon']),
                    'speed' => $row['speed'] !== null ? floatval($row['speed']) : null,
                    'course' => $row['course'] !== null ? floatval($row['course']) : null,
                    'destination' => $row['destination'],
                    'eta' => $row['eta'],
                    'lastUpdate' => $row['fetched_at'],
                    'source' => $row['source']
                ];
            }
        } catch (PDOException $e) {
            error_log("[AISProvider] Cache read error: " . $e->getMessage());
        }
        return null;
    }

    /**
     * Fetch position from AISstream via quick WebSocket connection
     */
    private function fetchFromAISstream($mmsi) {
        if (!$this->aisStreamKey || !$mmsi) return null;

        try {
            $wsUrl = 'wss://stream.aisstream.io/v0/stream';
            $parsed = parse_url($wsUrl);
            $host = $parsed['host'];
            $path = $parsed['path'] ?? '/';

            $context = stream_context_create([
                'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]
            ]);

            $socket = @stream_socket_client('ssl://' . $host . ':443', $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $context);
            if (!$socket) {
                error_log("[AISProvider] AISstream connection failed: $errstr ($errno)");
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

            $response = '';
            while (($line = fgets($socket)) !== false) {
                $response .= $line;
                if (trim($line) === '') break;
            }

            if (strpos($response, '101') === false) {
                error_log("[AISProvider] AISstream handshake failed");
                fclose($socket);
                return null;
            }

            // Send subscription
            $subscription = json_encode([
                'APIKey' => $this->aisStreamKey,
                'BoundingBoxes' => [[[-90, -180], [90, 180]]],
                'FiltersShipMMSI' => [strval($mmsi)],
                'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport']
            ]);
            $this->wsSendFrame($socket, $subscription);

            // Listen for up to 15 seconds for a position report
            $startTime = time();
            $result = null;
            while ((time() - $startTime) < 15) {
                $data = $this->wsReadFrame($socket, 5);
                if ($data === null) continue;

                $message = json_decode($data, true);
                if (!$message) continue;

                if (isset($message['error'])) {
                    error_log("[AISProvider] AISstream error: " . $message['error']);
                    break;
                }

                $msgType = $message['MessageType'] ?? '';
                if ($msgType === 'PositionReport' || $msgType === 'StandardClassBPositionReport') {
                    $report = $message['Message'][$msgType] ?? [];
                    $metadata = $message['MetaData'] ?? [];
                    $lat = $report['Latitude'] ?? $metadata['latitude'] ?? null;
                    $lon = $report['Longitude'] ?? $metadata['longitude'] ?? null;

                    if ($lat !== null && $lon !== null) {
                        $result = [
                            'lat' => floatval($lat),
                            'lon' => floatval($lon),
                            'speed' => isset($report['Sog']) ? floatval($report['Sog']) : null,
                            'course' => isset($report['Cog']) ? floatval($report['Cog']) : null,
                            'destination' => null,
                            'eta' => null,
                            'lastUpdate' => date('Y-m-d H:i:s'),
                            'source' => 'aisstream'
                        ];
                        break;
                    }
                }
            }

            // Close WebSocket
            $mask = random_bytes(4);
            @fwrite($socket, chr(0x88) . chr(0x80) . $mask);
            @fclose($socket);

            if ($result) {
                error_log("[AISProvider] Got position from AISstream for MMSI $mmsi");
            } else {
                error_log("[AISProvider] No position received from AISstream for MMSI $mmsi within timeout");
            }
            return $result;
        } catch (Exception $e) {
            error_log("[AISProvider] AISstream error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Send a WebSocket text frame (masked)
     */
    private function wsSendFrame($socket, $data) {
        $len = strlen($data);
        $mask = random_bytes(4);
        $frame = chr(0x81); // FIN + text opcode
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
    private function wsReadFrame($socket, $timeout = 5) {
        stream_set_timeout($socket, $timeout);
        $header = @fread($socket, 2);
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

        $maskKey = null;
        if ($masked) {
            $maskKey = fread($socket, 4);
        }

        $data = '';
        $remaining = $len;
        while ($remaining > 0) {
            $chunk = fread($socket, min($remaining, 8192));
            if ($chunk === false || strlen($chunk) === 0) break;
            $data .= $chunk;
            $remaining -= strlen($chunk);
        }

        if ($masked && $maskKey) {
            for ($i = 0; $i < strlen($data); $i++) {
                $data[$i] = $data[$i] ^ $maskKey[$i % 4];
            }
        }

        // Handle ping
        if ($opcode === 0x9) {
            $pongMask = random_bytes(4);
            $pongFrame = chr(0x8A) . chr(0x80 | strlen($data)) . $pongMask;
            for ($i = 0; $i < strlen($data); $i++) {
                $pongFrame .= $data[$i] ^ $pongMask[$i % 4];
            }
            @fwrite($socket, $pongFrame);
            return $this->wsReadFrame($socket, $timeout);
        }

        // Handle close
        if ($opcode === 0x8) return null;

        return $data;
    }

    private function fetchFromExternalAPI($imo, $mmsi) {
        if (!$this->apiKey) {
            if (!$this->aisStreamKey) {
                error_log("[AISProvider] No AIS API key configured (neither AIS_API_KEY nor AISSTREAM_API_KEY), using manual data only");
            }
            return null;
        }

        try {
            $identifier = $imo ? "imo:$imo" : "mmsi:$mmsi";
            $url = "https://api.vesselfinder.com/vessel?userkey=" . urlencode($this->apiKey) . "&" . ($imo ? "imo=$imo" : "mmsi=$mmsi");

            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'method' => 'GET',
                    'header' => "Accept: application/json\r\n"
                ]
            ]);

            $response = @file_get_contents($url, false, $ctx);
            if ($response === false) {
                error_log("[AISProvider] External API request failed for $identifier");
                return null;
            }

            $data = json_decode($response, true);
            if (!$data || !isset($data['AIS'])) {
                error_log("[AISProvider] Invalid API response for $identifier");
                return null;
            }

            $ais = $data['AIS'];
            return [
                'lat' => floatval($ais['LATITUDE'] ?? 0),
                'lon' => floatval($ais['LONGITUDE'] ?? 0),
                'speed' => isset($ais['SPEED']) ? floatval($ais['SPEED']) : null,
                'course' => isset($ais['COURSE']) ? floatval($ais['COURSE']) : null,
                'destination' => $ais['DESTINATION'] ?? null,
                'eta' => isset($ais['ETA']) ? $ais['ETA'] : null,
                'lastUpdate' => date('Y-m-d H:i:s'),
                'source' => 'vesselfinder'
            ];
        } catch (Exception $e) {
            error_log("[AISProvider] External API error: " . $e->getMessage());
            return null;
        }
    }

    private function persistPosition($vesselId, $position) {
        if (!$this->pdo) return;
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO vessel_positions (vessel_id, lat, lon, speed, course, destination, eta, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $vesselId,
                $position['lat'],
                $position['lon'],
                $position['speed'],
                $position['course'],
                $position['destination'],
                $position['eta'],
                $position['source'] ?? 'manual'
            ]);
        } catch (PDOException $e) {
            error_log("[AISProvider] Error persisting position: " . $e->getMessage());
        }
    }

    private function getLastKnownPosition($vesselId) {
        if (!$this->pdo) return null;
        try {
            $stmt = $this->pdo->prepare("
                SELECT lat, lon, speed, course, destination, eta, source, fetched_at
                FROM vessel_positions
                WHERE vessel_id = ?
                ORDER BY fetched_at DESC
                LIMIT 1
            ");
            $stmt->execute([$vesselId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return [
                    'lat' => floatval($row['lat']),
                    'lon' => floatval($row['lon']),
                    'speed' => $row['speed'] !== null ? floatval($row['speed']) : null,
                    'course' => $row['course'] !== null ? floatval($row['course']) : null,
                    'destination' => $row['destination'],
                    'eta' => $row['eta'],
                    'lastUpdate' => $row['fetched_at'],
                    'source' => $row['source'] . ' (cached)'
                ];
            }
        } catch (PDOException $e) {
            error_log("[AISProvider] Error getting last known position: " . $e->getMessage());
        }
        return null;
    }

    public function addManualPosition($vesselId, $lat, $lon, $speed = null, $course = null, $destination = null, $eta = null) {
        $position = [
            'lat' => $lat,
            'lon' => $lon,
            'speed' => $speed,
            'course' => $course,
            'destination' => $destination,
            'eta' => $eta,
            'source' => 'manual'
        ];
        $this->persistPosition($vesselId, $position);
        return $position;
    }
}

function getAISProvider() {
    static $instance = null;
    if ($instance === null) $instance = new AISProvider();
    return $instance;
}
