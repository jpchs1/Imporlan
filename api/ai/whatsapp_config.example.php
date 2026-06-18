<?php
/**
 * WhatsApp + Claude AI Configuration Example - Imporlan
 *
 * Copy this file to whatsapp_config.php and fill in your credentials.
 * NEVER commit whatsapp_config.php to version control.
 */

// WhatsApp Business API (Meta Cloud API)
define('WHATSAPP_PHONE_NUMBER_ID', 'YOUR_PHONE_NUMBER_ID');   // From Meta Business Manager
define('WHATSAPP_ACCESS_TOKEN', 'YOUR_PERMANENT_ACCESS_TOKEN'); // System User Token
define('WHATSAPP_VERIFY_TOKEN', 'YOUR_CUSTOM_VERIFY_TOKEN');    // You choose this (for webhook verification)
define('WHATSAPP_BUSINESS_ACCOUNT_ID', 'YOUR_WABA_ID');         // WhatsApp Business Account ID
define('WHATSAPP_DISPLAY_PHONE', '+56940211459');               // Display phone number

// Claude API (Anthropic)
define('CLAUDE_API_KEY', 'YOUR_ANTHROPIC_API_KEY');
define('CLAUDE_MODEL', 'claude-haiku-4-5-20251001');  // Cost-effective for chat
define('CLAUDE_MAX_TOKENS', 1024);
define('CLAUDE_MONTHLY_COST_LIMIT_USD', 50.00);

// AI Behavior
define('AI_ENABLED', true);
define('AI_RESPONSE_DELAY_SECONDS', 2);   // Simulates typing, feels natural
define('AI_MAX_MESSAGES_BEFORE_ESCALATE', 15);
define('AI_BUSINESS_HOURS_START', 9);     // 9 AM Chile
define('AI_BUSINESS_HOURS_END', 20);      // 8 PM Chile

// Admin notification
define('ADMIN_WHATSAPP_PHONE', '+56940211459');  // Receives escalation alerts
define('ADMIN_NOTIFICATION_EMAIL', 'contacto@imporlan.cl');
