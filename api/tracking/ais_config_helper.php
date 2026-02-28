<?php
/**
 * AIS Configuration Helper
 * 
 * Loads AIS API keys from environment variables or ais_config.php file.
 * Environment variables take precedence over file values.
 */

function getAISConfig($key) {
    // Environment variable takes precedence
    $envVal = getenv($key);
    if ($envVal) {
        return $envVal;
    }

    // Try loading from config file
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

    return $fileConfig[$key] ?? '';
}
