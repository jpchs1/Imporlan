<?php
/**
 * Inspection Reports API proxy for test environment.
 * Forwards all requests to the main /api/inspection_reports_api.php so that
 * test and production share the same codebase and database.
 */
require_once dirname(__DIR__, 2) . '/api/inspection_reports_api.php';
