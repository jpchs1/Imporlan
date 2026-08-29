<?php
/**
 * AI Guardrails - Imporlan
 * Input validation, output filtering, and safety checks.
 */

class AIGuardrails {

    /**
     * Validate and sanitize incoming user message.
     * Returns sanitized text or null if message should be blocked.
     */
    public static function sanitizeInput(string $text): ?string {
        $text = trim($text);

        if (empty($text)) return null;

        // Block excessively long messages
        if (mb_strlen($text) > 2000) {
            $text = mb_substr($text, 0, 2000);
        }

        // Detect prompt injection attempts
        if (self::isPromptInjection($text)) {
            error_log('[Guardrails] Prompt injection attempt blocked: ' . mb_substr($text, 0, 100));
            return null;
        }

        return $text;
    }

    /**
     * Validate AI response before sending to user.
     */
    public static function sanitizeOutput(string $text): string {
        // Remove any system-level information that might leak
        $text = preg_replace('/api[_\-]?key\s*[:=]\s*\S+/i', '[REDACTED]', $text);
        $text = preg_replace('/password\s*[:=]\s*\S+/i', '[REDACTED]', $text);
        $text = preg_replace('/token\s*[:=]\s*\S+/i', '[REDACTED]', $text);

        // Limit response length for WhatsApp (max 4096 chars)
        if (mb_strlen($text) > 4000) {
            $text = mb_substr($text, 0, 3900) . "\n\n...Para más detalles, escríbenos y un asesor te contactará.";
        }

        return trim($text);
    }

    /**
     * Check if AI should respond or if this should go to human.
     */
    public static function shouldAIRespond(array $conversation, array $context): array {
        // If conversation is escalated to human, don't use AI
        if (!empty($conversation['escalated_at']) || !empty($conversation['assigned_to_id'])) {
            return ['respond' => false, 'reason' => 'escalated_to_human'];
        }

        // If AI is disabled globally
        if (defined('AI_ENABLED') && !AI_ENABLED) {
            return ['respond' => false, 'reason' => 'ai_disabled'];
        }

        // If too many AI messages without human interaction
        $maxBeforeEscalate = defined('AI_MAX_MESSAGES_BEFORE_ESCALATE')
            ? AI_MAX_MESSAGES_BEFORE_ESCALATE : 15;
        if (($context['ai_message_count'] ?? 0) >= $maxBeforeEscalate) {
            return ['respond' => false, 'reason' => 'max_messages_reached'];
        }

        return ['respond' => true, 'reason' => 'ok'];
    }

    /**
     * Check for budget limits.
     */
    public static function checkBudget(): bool {
        try {
            $pdo = getDbConnection();
            $stmt = $pdo->prepare("
                SELECT COALESCE(SUM(cost_usd), 0) as total
                FROM ai_usage_log
                WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            ");
            $stmt->execute();
            $result = $stmt->fetch(\PDO::FETCH_ASSOC);
            $limit = defined('CLAUDE_MONTHLY_COST_LIMIT_USD') ? CLAUDE_MONTHLY_COST_LIMIT_USD : 50.00;
            return (float)$result['total'] < $limit;
        } catch (\PDOException $e) {
            error_log('[Guardrails] Budget check error: ' . $e->getMessage());
            return true;
        }
    }

    /**
     * Basic prompt injection detection.
     */
    private static function isPromptInjection(string $text): bool {
        $lower = mb_strtolower($text);

        $patterns = [
            'ignore all previous instructions',
            'ignore your instructions',
            'ignore above instructions',
            'disregard your previous',
            'forget your instructions',
            'you are now',
            'new instructions:',
            'system prompt:',
            'act as if you',
            'pretend you are',
            'jailbreak',
            'DAN mode',
            '<script>',
            'javascript:',
        ];

        foreach ($patterns as $pattern) {
            if (strpos($lower, strtolower($pattern)) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate a fallback response when AI cannot respond.
     */
    public static function getFallbackResponse(string $reason): string {
        switch ($reason) {
            case 'escalated_to_human':
                return "Tu conversación está siendo atendida por nuestro equipo. En breve te responderán. Si necesitas algo urgente, puedes llamarnos al +56 9 4021 1459.";
            case 'ai_disabled':
                return "Gracias por escribirnos. En este momento un asesor revisará tu mensaje y te responderá a la brevedad. ¡Gracias por tu paciencia!";
            case 'max_messages_reached':
                return "Para brindarte una mejor atención, voy a conectarte con uno de nuestros asesores especializados. En breve te contactarán.";
            case 'budget_exceeded':
                return "Gracias por tu mensaje. Nuestro equipo lo revisará y te responderá pronto. Si es urgente, llámanos al +56 9 4021 1459.";
            case 'api_error':
                return "Disculpa, tuve un problema técnico. Tu mensaje fue recibido y nuestro equipo te responderá pronto. ¿Puedes intentar de nuevo en unos minutos?";
            default:
                return "Gracias por escribirnos. Un asesor de Imporlan te responderá a la brevedad.";
        }
    }
}
