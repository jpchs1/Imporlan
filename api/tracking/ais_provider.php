<?php
require_once __DIR__ . '/ais_provider_interface.php';
require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/ais_config_helper.php';

class AISProvider implements AISProviderInterface {
    private $cacheMinutes = 10;
    private $apiKey;
    private $aisStreamKey;
    private $pdo;

    public function __construct() {
        $this->pdo = getDbConnection();
        $this->apiKey = getAISConfig('AIS_API_KEY');
        $this->aisStreamKey = getAISConfig('AISSTREAM_API_KEY');
    }

    public function getVesselPosition($imo = null, $mmsi = null) {
        if (!$imo && !$mmsi) {
            return null;
        }

        $vesselId = $this->findVesselId($imo, $mmsi);
        if (!$vesselId) {
            return null;
        }

        // Check for recent cached position (populated by aisstream_cron.php or previous fetches)
        $cached = $this->getCachedPosition($vesselId);
        if ($cached) {
            return $cached;
        }

        // Try VesselFinder REST API (non-blocking, fast HTTP call)
        $position = $this->fetchFromExternalAPI($imo, $mmsi);
        if ($position) {
            $this->persistPosition($vesselId, $position);
            return $position;
        }

        // Try MyShipTracking public page scraping (fast, works for inactive vessels)
        $mstPosition = $this->fetchFromMyShipTracking($mmsi);
        if ($mstPosition) {
            $this->persistPosition($vesselId, $mstPosition);
            return $mstPosition;
        }

        // Try on-demand AISstream WebSocket fetch (15s listen, only for actively transmitting vessels)
        if ($this->aisStreamKey && $mmsi) {
            $aisPosition = $this->fetchFromAISstreamOnDemand($mmsi);
            if ($aisPosition) {
                $this->persistPosition($vesselId, $aisPosition);
                return $aisPosition;
            }
        }

        // Fall back to last known position (any age)
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

    private function fetchFromExternalAPI($imo, $mmsi) {
        if (!$this->apiKey) {
            if (!$this->aisStreamKey) {
                error_log("[AISProvider] No AIS API key configured (neither AIS_API_KEY nor AISSTREAM_API_KEY), using manual/cron data only");
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

    /**
     * Fetch vessel metadata from VesselFinder's public click API.
     * Returns speed, course, destination but NOT coordinates.
     * Used to enrich data from other sources.
     */
    private function fetchFromVesselFinderPublic($mmsi) {
        if (!$mmsi) return null;

        try {
            $url = "https://www.vesselfinder.com/api/pub/click/" . urlencode($mmsi);
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 8,
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nAccept: application/json\r\n"
                ]
            ]);

            $response = @file_get_contents($url, false, $ctx);
            if ($response === false) {
                error_log("[AISProvider] VesselFinder public click API failed for MMSI $mmsi");
                return null;
            }

            $data = json_decode($response, true);
            if (!$data || !isset($data['name'])) {
                return null;
            }

            // The click API returns speed (ss), course (cu), destination (dest) but NOT lat/lon
            $speed = isset($data['ss']) ? floatval($data['ss']) : null;
            $course = isset($data['cu']) ? floatval($data['cu']) : null;
            $destination = isset($data['dest']) ? $data['dest'] : null;

            // Return metadata (no coordinates) - will be used to enrich other position data
            error_log("[AISProvider] VesselFinder public metadata for MMSI $mmsi: speed=$speed, course=$course, dest=$destination");
            return ['speed' => $speed, 'course' => $course, 'destination' => $destination];
        } catch (Exception $e) {
            error_log("[AISProvider] VesselFinder public error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Fetch last known position from MyShipTracking public page.
     * Parses coordinates from the vessel page HTML. Works even for vessels
     * that haven't transmitted AIS recently (shows last known position).
     */
    private function fetchFromMyShipTracking($mmsi) {
        if (!$mmsi) return null;

        try {
            $url = "https://www.myshiptracking.com/vessels/mmsi-" . urlencode($mmsi);
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'method' => 'GET',
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nAccept: text/html\r\n"
                ]
            ]);

            $response = @file_get_contents($url, false, $ctx);
            if ($response === false) {
                error_log("[AISProvider] MyShipTracking request failed for MMSI $mmsi");
                return null;
            }

            // Extract lat/lng from the page HTML (appears in map URL parameters)
            if (preg_match('/lat=([-]?[0-9.]+)&lng=([-]?[0-9.]+)/', $response, $matches)) {
                $lat = floatval($matches[1]);
                $lon = floatval($matches[2]);

                if ($lat == 0 && $lon == 0) {
                    error_log("[AISProvider] MyShipTracking returned 0,0 for MMSI $mmsi (no position)");
                    return null;
                }

                // Also try to get VesselFinder metadata to enrich with speed/course
                $vfMeta = $this->fetchFromVesselFinderPublic($mmsi);

                error_log("[AISProvider] MyShipTracking: got position for MMSI $mmsi: lat=$lat, lon=$lon");
                return [
                    'lat' => $lat,
                    'lon' => $lon,
                    'speed' => $vfMeta ? $vfMeta['speed'] : null,
                    'course' => $vfMeta ? $vfMeta['course'] : null,
                    'destination' => $vfMeta ? $vfMeta['destination'] : null,
                    'eta' => null,
                    'lastUpdate' => date('Y-m-d H:i:s'),
                    'source' => 'myshiptracking'
                ];
            }

            error_log("[AISProvider] MyShipTracking: no coordinates found in page for MMSI $mmsi");
            return null;
        } catch (Exception $e) {
            error_log("[AISProvider] MyShipTracking error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * On-demand AISstream WebSocket fetch for a specific vessel.
     * Opens a short WebSocket connection to AISstream to try to get
     * a position report for the given MMSI. Listens for 15 seconds max.
     */
    private function fetchFromAISstreamOnDemand($mmsi) {
        if (!$this->aisStreamKey || !$mmsi) return null;

        try {
            require_once __DIR__ . '/websocket_client.php';

            $ws = new WebSocketClient();
            if (!$ws->connect('wss://stream.aisstream.io/v0/stream', 5)) {
                error_log("[AISProvider] On-demand AISstream: failed to connect");
                return null;
            }

            $subscription = json_encode([
                'APIKey' => $this->aisStreamKey,
                'BoundingBoxes' => [[[-90, -180], [90, 180]]],
                'FiltersShipMMSI' => [strval($mmsi)],
                'FilterMessageTypes' => ['PositionReport', 'StandardClassBPositionReport']
            ]);
            $ws->send($subscription);

            $listenSeconds = 15;
            $startTime = time();

            while ((time() - $startTime) < $listenSeconds) {
                $remaining = $listenSeconds - (time() - $startTime);
                if ($remaining <= 0) break;

                $data = $ws->read(min($remaining, 5));
                if ($data === null) continue;

                $message = json_decode($data, true);
                if (!$message) continue;

                if (isset($message['error'])) {
                    error_log("[AISProvider] On-demand AISstream error: " . $message['error']);
                    break;
                }

                $msgType = $message['MessageType'] ?? '';
                if ($msgType === 'PositionReport' || $msgType === 'StandardClassBPositionReport') {
                    $report = $message['Message'][$msgType] ?? [];
                    $metadata = $message['MetaData'] ?? [];
                    $lat = $report['Latitude'] ?? $metadata['latitude'] ?? null;
                    $lon = $report['Longitude'] ?? $metadata['longitude'] ?? null;
                    $speed = isset($report['Sog']) ? floatval($report['Sog']) : null;
                    $course = isset($report['Cog']) ? floatval($report['Cog']) : null;

                    if ($lat !== null && $lon !== null) {
                        $ws->close();
                        error_log("[AISProvider] On-demand AISstream: got position for MMSI $mmsi: lat=$lat, lon=$lon");
                        return [
                            'lat' => floatval($lat),
                            'lon' => floatval($lon),
                            'speed' => $speed,
                            'course' => $course,
                            'destination' => null,
                            'eta' => null,
                            'lastUpdate' => date('Y-m-d H:i:s'),
                            'source' => 'aisstream_ondemand'
                        ];
                    }
                }
            }

            $ws->close();
            error_log("[AISProvider] On-demand AISstream: no position received for MMSI $mmsi in {$listenSeconds}s");
            return null;
        } catch (Exception $e) {
            error_log("[AISProvider] On-demand AISstream error: " . $e->getMessage());
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
