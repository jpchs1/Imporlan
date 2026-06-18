<?php
/**
 * Claude API Client - Imporlan
 * Handles communication with Anthropic Claude API with prompt caching support.
 */

require_once __DIR__ . '/whatsapp_config.php';

class ClaudeClient {
    private $apiKey;
    private $model;
    private $maxTokens;
    private $apiUrl = 'https://api.anthropic.com/v1/messages';
    private $apiVersion = '2023-06-01';

    public function __construct() {
        $this->apiKey = CLAUDE_API_KEY;
        $this->model = CLAUDE_MODEL;
        $this->maxTokens = CLAUDE_MAX_TOKENS;
    }

    /**
     * Send a message to Claude API with tool use and prompt caching.
     *
     * @param string $systemPrompt  The system prompt (knowledge base, cached)
     * @param array  $messages      Conversation history [{role, content}]
     * @param array  $tools         Available tools for function calling
     * @return array                API response with usage info
     */
    public function sendMessage(string $systemPrompt, array $messages, array $tools = []): array {
        $body = [
            'model' => $this->model,
            'max_tokens' => $this->maxTokens,
            'system' => [
                [
                    'type' => 'text',
                    'text' => $systemPrompt,
                    'cache_control' => ['type' => 'ephemeral']
                ]
            ],
            'messages' => $messages,
        ];

        if (!empty($tools)) {
            $body['tools'] = $tools;
        }

        $response = $this->httpPost($body);

        if (isset($response['error'])) {
            error_log('[ClaudeClient] API Error: ' . json_encode($response['error']));
            return [
                'success' => false,
                'error' => $response['error']['message'] ?? 'Unknown API error',
                'usage' => null
            ];
        }

        $textContent = '';
        $toolCalls = [];

        foreach ($response['content'] ?? [] as $block) {
            if ($block['type'] === 'text') {
                $textContent .= $block['text'];
            } elseif ($block['type'] === 'tool_use') {
                $toolCalls[] = [
                    'id' => $block['id'],
                    'name' => $block['name'],
                    'input' => $block['input']
                ];
            }
        }

        $usage = $response['usage'] ?? [];

        return [
            'success' => true,
            'text' => $textContent,
            'tool_calls' => $toolCalls,
            'stop_reason' => $response['stop_reason'] ?? null,
            'usage' => [
                'input_tokens' => $usage['input_tokens'] ?? 0,
                'output_tokens' => $usage['output_tokens'] ?? 0,
                'cache_read_tokens' => $usage['cache_read_input_tokens'] ?? 0,
                'cache_creation_tokens' => $usage['cache_creation_input_tokens'] ?? 0,
            ]
        ];
    }

    /**
     * Continue conversation after tool execution (tool_result).
     */
    public function sendToolResult(string $systemPrompt, array $messages, array $tools = []): array {
        return $this->sendMessage($systemPrompt, $messages, $tools);
    }

    /**
     * Calculate estimated cost in USD.
     */
    public function calculateCost(array $usage): float {
        $pricing = $this->getModelPricing();

        $inputCost = ($usage['input_tokens'] / 1_000_000) * $pricing['input'];
        $outputCost = ($usage['output_tokens'] / 1_000_000) * $pricing['output'];
        $cacheReadCost = ($usage['cache_read_tokens'] / 1_000_000) * $pricing['cache_read'];
        $cacheCreateCost = ($usage['cache_creation_tokens'] / 1_000_000) * $pricing['cache_create'];

        return round($inputCost + $outputCost + $cacheReadCost + $cacheCreateCost, 6);
    }

    /**
     * Check if monthly cost limit has been reached.
     */
    public function isOverBudget(): bool {
        try {
            $pdo = getDbConnection();
            $stmt = $pdo->prepare("
                SELECT COALESCE(SUM(cost_usd), 0) as total
                FROM ai_usage_log
                WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            ");
            $stmt->execute();
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            return (float)$result['total'] >= CLAUDE_MONTHLY_COST_LIMIT_USD;
        } catch (\PDOException $e) {
            error_log('[ClaudeClient] Budget check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Log API usage to database.
     */
    public function logUsage(int $conversationId, array $usage, array $toolsUsed, int $responseTimeMs): void {
        try {
            $pdo = getDbConnection();
            $cost = $this->calculateCost($usage);

            $stmt = $pdo->prepare("
                INSERT INTO ai_usage_log
                (conversation_id, model, input_tokens, output_tokens, cache_read_tokens,
                 cache_creation_tokens, tools_used, cost_usd, response_time_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $conversationId,
                $this->model,
                $usage['input_tokens'],
                $usage['output_tokens'],
                $usage['cache_read_tokens'],
                $usage['cache_creation_tokens'],
                !empty($toolsUsed) ? json_encode($toolsUsed) : null,
                $cost,
                $responseTimeMs
            ]);
        } catch (\PDOException $e) {
            error_log('[ClaudeClient] Usage log failed: ' . $e->getMessage());
        }
    }

    private function getModelPricing(): array {
        $prices = [
            'claude-haiku-4-5-20251001' => [
                'input' => 1.00, 'output' => 5.00,
                'cache_read' => 0.10, 'cache_create' => 1.25
            ],
            'claude-sonnet-4-6-20260414' => [
                'input' => 3.00, 'output' => 15.00,
                'cache_read' => 0.30, 'cache_create' => 3.75
            ],
        ];

        return $prices[$this->model] ?? $prices['claude-haiku-4-5-20251001'];
    }

    private function httpPost(array $body): array {
        $ch = curl_init($this->apiUrl);

        $headers = [
            'Content-Type: application/json',
            'x-api-key: ' . $this->apiKey,
            'anthropic-version: ' . $this->apiVersion,
        ];

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("[ClaudeClient] cURL error: $error");
            return ['error' => ['message' => "Connection error: $error"]];
        }

        $decoded = json_decode($response, true);
        if ($decoded === null) {
            error_log("[ClaudeClient] Invalid JSON response (HTTP $httpCode): " . substr($response, 0, 500));
            return ['error' => ['message' => "Invalid response from API (HTTP $httpCode)"]];
        }

        return $decoded;
    }
}
