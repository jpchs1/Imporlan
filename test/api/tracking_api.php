<?php
/**
 * Tracking API proxy for test environment.
 * Forwards all requests to the main /api/tracking_api.php so that
 * test and production share the same codebase and database.
 */
require_once dirname(__DIR__, 2) . '/api/tracking_api.php';
