<?php
/**
 * Chat AI Handler - Imporlan
 * Main orchestrator: receives a user message, processes it through Claude API
 * with tools, and returns the AI response.
 */

require_once __DIR__ . '/../db_config.php';
require_once __DIR__ . '/whatsapp_config.php';
require_once __DIR__ . '/claude_client.php';
require_once __DIR__ . '/system_prompt.php';
require_once __DIR__ . '/conversation_memory.php';
require_once __DIR__ . '/guardrails.php';
require_once __DIR__ . '/tools/search_marketplace.php';
require_once __DIR__ . '/tools/calculate_import_quote.php';
require_once __DIR__ . '/tools/manage_lead.php';
require_once __DIR__ . '/tools/send_whatsapp_media.php';

class ChatAIHandler {
    private $claude;
    private $memory;
    private $maxToolRounds = 3;
    private $business = null;

    public function __construct() {
        $this->claude = new ClaudeClient();
        $this->memory = new ConversationMemory();
    }

    /**
     * Set the business context for this handler.
     */
    public function setBusiness(?array $business): void {
        $this->business = $business;
    }

    /**
     * Process an incoming WhatsApp message and generate AI response.
     *
     * @param int    $conversationId  Conversation ID
     * @param string $userMessage     The user's text message
     * @param string $phone           User's WhatsApp phone number
     * @return array {text: string, tool_actions: array, usage: array}
     */
    public function processMessage(int $conversationId, string $userMessage, string $phone): array {
        $startTime = microtime(true);

        // 1. Guardrails: sanitize input
        $sanitized = AIGuardrails::sanitizeInput($userMessage);
        if ($sanitized === null) {
            return [
                'text' => AIGuardrails::getFallbackResponse('blocked'),
                'tool_actions' => [],
                'usage' => null
            ];
        }

        // 2. Get conversation context
        $context = $this->memory->getContext($conversationId);
        if (!$context) {
            $context = [
                'lead_stage' => 'nuevo',
                'lead_data' => [],
                'message_count' => 0,
                'ai_message_count' => 0,
                'escalated_at' => null,
                'conversation_summary' => null,
                'conversation_id' => $conversationId,
            ];
        }
        $context['conversation_id'] = $conversationId;

        // 3. Check if AI should respond
        $shouldRespond = AIGuardrails::shouldAIRespond(
            ['escalated_at' => $context['escalated_at'] ?? null, 'assigned_to_id' => null],
            $context
        );
        if (!$shouldRespond['respond']) {
            return [
                'text' => AIGuardrails::getFallbackResponse($shouldRespond['reason']),
                'tool_actions' => [],
                'usage' => null
            ];
        }

        // 4. Check budget
        if (!AIGuardrails::checkBudget()) {
            return [
                'text' => AIGuardrails::getFallbackResponse('budget_exceeded'),
                'tool_actions' => [],
                'usage' => null
            ];
        }

        // 5. Build system prompt with business context
        $systemPrompt = getSystemPrompt($context, $this->business);

        // 6. Get conversation history
        $messages = $this->memory->getMessageHistory($conversationId, 20);

        // If last message in history is not the current user message, add it
        $lastMsg = end($messages);
        if (!$lastMsg || $lastMsg['role'] !== 'user' || $lastMsg['content'] !== $sanitized) {
            $messages[] = ['role' => 'user', 'content' => $sanitized];
        }

        // Ensure messages start with a user message
        while (!empty($messages) && $messages[0]['role'] !== 'user') {
            array_shift($messages);
        }

        // 7. Get tool definitions (filtered by business)
        $tools = getToolsForBusiness($this->business);

        // Inject conversation_id and phone into tools that need it
        $toolContext = [
            'conversation_id' => $conversationId,
            'phone' => $phone,
        ];

        // 8. Call Claude API (with tool loop)
        $allToolActions = [];
        $totalUsage = [
            'input_tokens' => 0,
            'output_tokens' => 0,
            'cache_read_tokens' => 0,
            'cache_creation_tokens' => 0,
        ];

        $finalText = '';
        $round = 0;

        while ($round < $this->maxToolRounds) {
            $round++;

            $response = $this->claude->sendMessage($systemPrompt, $messages, $tools);

            if (!$response['success']) {
                error_log("[ChatAIHandler] Claude API error: " . ($response['error'] ?? 'unknown'));
                $finalText = AIGuardrails::getFallbackResponse('api_error');
                break;
            }

            // Accumulate usage
            if ($response['usage']) {
                foreach ($totalUsage as $key => &$val) {
                    $val += $response['usage'][$key] ?? 0;
                }
            }

            // If there are no tool calls, we're done
            if (empty($response['tool_calls'])) {
                $finalText = $response['text'];
                break;
            }

            // We have tool calls — process them
            // First, add assistant's response (with tool_use blocks) to messages
            $assistantContent = [];
            if (!empty($response['text'])) {
                $assistantContent[] = ['type' => 'text', 'text' => $response['text']];
            }
            foreach ($response['tool_calls'] as $toolCall) {
                $assistantContent[] = [
                    'type' => 'tool_use',
                    'id' => $toolCall['id'],
                    'name' => $toolCall['name'],
                    'input' => $toolCall['input'],
                ];
            }
            $messages[] = ['role' => 'assistant', 'content' => $assistantContent];

            // Execute each tool and build tool_result message
            $toolResults = [];
            foreach ($response['tool_calls'] as $toolCall) {
                $toolName = $toolCall['name'];
                $toolInput = $toolCall['input'];

                // Inject context
                $toolInput['conversation_id'] = $conversationId;
                $toolInput['phone'] = $phone;

                $result = $this->executeTool($toolName, $toolInput);
                $allToolActions[] = ['tool' => $toolName, 'input' => $toolCall['input'], 'result' => $result];

                $toolResults[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $toolCall['id'],
                    'content' => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }
            $messages[] = ['role' => 'user', 'content' => $toolResults];
        }

        // 9. Sanitize output
        $finalText = AIGuardrails::sanitizeOutput($finalText);

        // 10. Log usage
        $responseTimeMs = (int)((microtime(true) - $startTime) * 1000);
        $toolNames = array_map(fn($a) => $a['tool'], $allToolActions);
        $this->claude->logUsage($conversationId, $totalUsage, $toolNames, $responseTimeMs);

        return [
            'text' => $finalText,
            'tool_actions' => $allToolActions,
            'usage' => $totalUsage,
        ];
    }

    /**
     * Execute a tool by name.
     */
    private function executeTool(string $name, array $input): array {
        try {
            switch ($name) {
                case 'search_marketplace':
                    return tool_search_marketplace($input);
                case 'calculate_import_quote':
                    return tool_calculate_import_quote($input);
                case 'create_lead':
                    return tool_create_lead($input);
                case 'escalate_to_human':
                    return tool_escalate_to_human($input);
                case 'schedule_follow_up':
                    return tool_schedule_follow_up($input);
                case 'send_boat_gallery':
                    return tool_send_boat_gallery($input);
                case 'send_interactive_menu':
                    return tool_send_interactive_menu($input);
                case 'send_contact_card':
                    return tool_send_contact_card($input);
                default:
                    return ['error' => "Tool no reconocida: $name"];
            }
        } catch (\Exception $e) {
            error_log("[ChatAIHandler] Tool execution error ($name): " . $e->getMessage());
            return ['error' => "Error ejecutando $name: " . $e->getMessage()];
        }
    }
}
