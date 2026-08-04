<?php
/**
 * System Prompt - Multi-tenant WhatsApp AI
 * Loads base personality + business-specific knowledge base.
 * Cached by Claude API to reduce costs by ~90%.
 */

require_once __DIR__ . '/prompts/base_prompt.php';
require_once __DIR__ . '/prompts/imporlan.php';
require_once __DIR__ . '/prompts/clasesdeski.php';
require_once __DIR__ . '/prompts/deckeva.php';
require_once __DIR__ . '/prompts/tourevo.php';

/**
 * Build the full system prompt for a specific business.
 *
 * @param array $business  Business record from DB
 * @param array $context   Conversation context (lead_data, lead_stage, etc.)
 * @return string          Complete system prompt
 */
function getSystemPrompt(array $context = [], ?array $business = null): string {
    // Default to Imporlan if no business specified (backwards compatible)
    if (!$business) {
        $business = [
            'slug' => 'imporlan',
            'name' => 'Imporlan',
            'ai_assistant_name' => 'Mariana',
            'admin_phone' => '+56940211459',
        ];
    }

    $base = getBasePrompt($business, $context);
    $specific = getBusinessSpecificPrompt($business['slug']);

    return $base . "\n" . $specific;
}

/**
 * Load business-specific knowledge base by slug.
 */
function getBusinessSpecificPrompt(string $slug): string {
    switch ($slug) {
        case 'imporlan':
            return getBusinessPrompt_imporlan();
        case 'clasesdeski':
            return getBusinessPrompt_clasesdeski();
        case 'deckeva':
            return getBusinessPrompt_deckeva();
        case 'tourevo':
            return getBusinessPrompt_tourevo();
        default:
            return "\n# NOTA: Knowledge base no configurado para este negocio. Escala todas las consultas a Juan Pablo.";
    }
}

/**
 * Get tools enabled for a specific business.
 */
function getToolsForBusiness(?array $business): array {
    require_once __DIR__ . '/tools/search_marketplace.php';
    require_once __DIR__ . '/tools/calculate_import_quote.php';
    require_once __DIR__ . '/tools/manage_lead.php';
    require_once __DIR__ . '/tools/send_whatsapp_media.php';

    $allTools = [
        'search_marketplace' => getToolDefinition_search_marketplace(),
        'calculate_import_quote' => getToolDefinition_calculate_import_quote(),
        'create_lead' => getToolDefinition_create_lead(),
        'escalate_to_human' => getToolDefinition_escalate_to_human(),
        'schedule_follow_up' => getToolDefinition_schedule_follow_up(),
        'send_boat_gallery' => getToolDefinition_send_boat_gallery(),
        'send_interactive_menu' => getToolDefinition_send_interactive_menu(),
        'send_contact_card' => getToolDefinition_send_contact_card(),
    ];

    if (!$business) {
        return array_values($allTools);
    }

    $enabledNames = json_decode($business['tools_enabled'] ?? '[]', true) ?: [];
    if (empty($enabledNames)) {
        return array_values($allTools);
    }

    $enabled = [];
    foreach ($enabledNames as $name) {
        if (isset($allTools[$name])) {
            $enabled[] = $allTools[$name];
        }
    }
    return $enabled;
}
