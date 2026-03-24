<?php
/**
 * Auth helper proxy for test environment.
 * Forwards to the main /api/auth_helper.php so that
 * test and production share the same authentication logic.
 */
require_once dirname(__DIR__, 2) . '/api/auth_helper.php';
