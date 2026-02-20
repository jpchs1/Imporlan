<?php
require_once __DIR__ . '/ais_provider_interface.php';
require_once __DIR__ . '/../db_config.php';

class AISProvider implements AISProviderInterface {
    private $cacheMinutes = 10;
    private $apiKey;
    private $pdo;

    public function __construct() {
        $this->pdo = getDbConnection();
        $this->apiKey = getenv('AIS_API_KEY') ?: '';
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

    private function fetchFromExternalAPI($imo, $mmsi) {
        if (!$this->apiKey) {
            error_log("[AISProvider] No AIS_API_KEY configured, using manual data only");
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
