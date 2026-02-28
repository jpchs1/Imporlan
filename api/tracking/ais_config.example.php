<?php
/**
 * AIS Configuration File
 * 
 * Copy this file to ais_config.php and fill in your API keys.
 * ais_config.php is gitignored and will not be committed.
 * 
 * Environment variables take precedence over values in this file.
 */

return [
    // AISstream.io API key (free, WebSocket-based, used by cron)
    // Get one at: https://aisstream.io
    'AISSTREAM_API_KEY' => '',

    // VesselFinder API key (paid, REST-based, used for on-demand lookups)
    // Get one at: https://api.vesselfinder.com
    'AIS_API_KEY' => '',

    // Secret token to trigger position updates via HTTP (instead of cron)
    // Set any random string here, then call:
    //   GET /api/tracking_api.php?action=run_position_update&token=YOUR_TOKEN
    'CRON_SECRET_TOKEN' => '',
];
