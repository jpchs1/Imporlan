<?php
/**
 * AIS Configuration Helper
 * 
 * Loads AIS API keys from (in order of precedence):
 * 1. Environment variables
 * 2. ais_config.php file (gitignored)
 * 3. tracking_config database table (admin-configurable)
 */

require_once __DIR__ . '/../db_config.php';

function getAISConfig($key) {
    // 1. Environment variable takes precedence
    $envVal = getenv($key);
    if ($envVal) {
        return $envVal;
    }

    // 2. Try loading from config file
    static $fileConfig = null;
    if ($fileConfig === null) {
        $configFile = __DIR__ . '/ais_config.php';
        if (file_exists($configFile)) {
            $fileConfig = include $configFile;
            if (!is_array($fileConfig)) {
                $fileConfig = [];
            }
        } else {
            $fileConfig = [];
        }
    }

    $fileVal = $fileConfig[$key] ?? '';
    if ($fileVal) {
        return $fileVal;
    }

    // 3. Try loading from database (tracking_config table)
    static $dbConfig = null;
    static $dbLoaded = false;
    if (!$dbLoaded) {
        $dbLoaded = true;
        try {
            $pdo = getDbConnection();
            if ($pdo) {
                // Check if table exists first
                $check = $pdo->query("SHOW TABLES LIKE 'tracking_config'");
                if ($check && $check->rowCount() > 0) {
                    $stmt = $pdo->query("SELECT config_key, config_value FROM tracking_config");
                    $dbConfig = [];
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $dbConfig[$row['config_key']] = $row['config_value'];
                    }
                }
            }
        } catch (Exception $e) {
            error_log("[AISConfigHelper] DB config load error: " . $e->getMessage());
            $dbConfig = [];
        }
    }

    return ($dbConfig[$key] ?? '') ?: '';
}
