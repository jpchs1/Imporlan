<?php
/**
 * AI Tool: Manage Lead + Escalate to Human - Imporlan
 * Creates/updates leads and handles escalation to human agents.
 */

function tool_create_lead(array $input): array {
    $pdo = getDbConnection();
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $phone = $input['phone'] ?? '';
    $nombre = trim($input['nombre'] ?? '');
    $email = trim($input['email'] ?? '');
    $tipo_interes = $input['tipo_interes'] ?? '';
    $presupuesto = $input['presupuesto'] ?? '';
    $urgencia = $input['urgencia'] ?? 'media';
    $notas = $input['notas'] ?? '';

    if (!$conversationId) {
        return ['error' => 'Se requiere conversation_id'];
    }

    try {
        $stmt = $pdo->prepare("SELECT id, lead_data, lead_stage FROM whatsapp_ai_context WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);
        $ctx = $stmt->fetch(\PDO::FETCH_ASSOC);

        $leadData = $ctx ? json_decode($ctx['lead_data'] ?? '{}', true) : [];

        if ($nombre) $leadData['nombre'] = $nombre;
        if ($email) $leadData['email'] = $email;
        if ($phone) $leadData['phone'] = $phone;
        if ($tipo_interes) $leadData['tipo_interes'] = $tipo_interes;
        if ($presupuesto) $leadData['presupuesto'] = $presupuesto;
        if ($urgencia) $leadData['urgencia'] = $urgencia;
        if ($notas) $leadData['notas'] = ($leadData['notas'] ?? '') . "\n" . $notas;
        $leadData['updated_at'] = date('Y-m-d H:i:s');

        $hasContact = !empty($leadData['nombre']) && (!empty($leadData['email']) || !empty($leadData['phone']));
        $newStage = $hasContact ? 'calificado' : 'explorando';

        if ($ctx) {
            $stmt = $pdo->prepare("
                UPDATE whatsapp_ai_context
                SET lead_data = ?, lead_stage = ?, last_ai_action = 'create_lead'
                WHERE conversation_id = ?
            ");
            $stmt->execute([json_encode($leadData), $newStage, $conversationId]);
        }

        // Also save to marketplace_leads for CRM integration
        if (!empty($leadData['email'])) {
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS marketplace_leads (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    nombre VARCHAR(255),
                    intereses TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $check = $pdo->prepare("SELECT id FROM marketplace_leads WHERE email = ?");
                $check->execute([$leadData['email']]);
                if ($check->fetch()) {
                    $stmt = $pdo->prepare("UPDATE marketplace_leads SET nombre = COALESCE(NULLIF(?, ''), nombre), intereses = ? WHERE email = ?");
                    $stmt->execute([$nombre, json_encode($leadData), $leadData['email']]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO marketplace_leads (email, nombre, intereses) VALUES (?, ?, ?)");
                    $stmt->execute([$leadData['email'], $nombre, json_encode($leadData)]);
                }
            } catch (\PDOException $e) {
                error_log('[ManageLead] marketplace_leads save: ' . $e->getMessage());
            }
        }

        return [
            'success' => true,
            'lead_stage' => $newStage,
            'lead_data' => $leadData,
            'message' => $hasContact
                ? "Lead calificado: {$leadData['nombre']} registrado correctamente."
                : "Datos parciales guardados. Falta nombre o contacto para calificar el lead."
        ];
    } catch (\PDOException $e) {
        error_log('[ManageLead] Error: ' . $e->getMessage());
        return ['error' => 'Error al guardar lead: ' . $e->getMessage()];
    }
}

function tool_escalate_to_human(array $input): array {
    $pdo = getDbConnection();
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $reason = $input['reason'] ?? 'Cliente solicita agente humano';
    $priority = $input['priority'] ?? 'normal';

    if (!$conversationId) {
        return ['error' => 'Se requiere conversation_id'];
    }

    try {
        // Update context
        $stmt = $pdo->prepare("
            UPDATE whatsapp_ai_context
            SET lead_stage = 'caliente', escalated_at = NOW(), last_ai_action = 'escalate_to_human'
            WHERE conversation_id = ?
        ");
        $stmt->execute([$conversationId]);

        // Get conversation details for notification
        $stmt = $pdo->prepare("
            SELECT c.*, ctx.lead_data, ctx.message_count
            FROM chat_conversations c
            LEFT JOIN whatsapp_ai_context ctx ON ctx.conversation_id = c.id
            WHERE c.id = ?
        ");
        $stmt->execute([$conversationId]);
        $conv = $stmt->fetch(\PDO::FETCH_ASSOC);

        $leadData = json_decode($conv['lead_data'] ?? '{}', true);
        $clientName = $leadData['nombre'] ?? $conv['user_name'] ?? 'Cliente WhatsApp';
        $clientPhone = $conv['whatsapp_phone'] ?? '';

        // Insert system message about escalation
        $systemMsg = "🔔 Escalado a agente humano.\nMotivo: $reason\nPrioridad: $priority\nCliente: $clientName ($clientPhone)";
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (conversation_id, sender_id, sender_role, sender_name, message)
            VALUES (?, 0, 'system', 'Sistema Imporlan', ?)
        ");
        $stmt->execute([$conversationId, $systemMsg]);

        // Send email notification to admin
        try {
            require_once __DIR__ . '/../../email_service.php';
            $emailService = new \EmailService();
            $emailService->sendInternalNotification('whatsapp_escalation', [
                'client_name' => $clientName,
                'client_phone' => $clientPhone,
                'reason' => $reason,
                'priority' => $priority,
                'lead_data' => $leadData,
                'conversation_id' => $conversationId,
                'message_count' => $conv['message_count'] ?? 0,
                'date' => date('d/m/Y H:i')
            ]);
        } catch (\Exception $e) {
            error_log('[Escalation] Email notification failed: ' . $e->getMessage());
        }

        return [
            'success' => true,
            'message' => "Conversacion escalada a agente humano. Motivo: $reason",
            'client_name' => $clientName,
            'priority' => $priority
        ];
    } catch (\PDOException $e) {
        error_log('[Escalation] Error: ' . $e->getMessage());
        return ['error' => 'Error al escalar: ' . $e->getMessage()];
    }
}

function tool_schedule_follow_up(array $input): array {
    $pdo = getDbConnection();
    $conversationId = (int)($input['conversation_id'] ?? 0);
    $hoursDelay = (int)($input['hours_delay'] ?? 24);
    $reason = $input['reason'] ?? '';

    if (!$conversationId) {
        return ['error' => 'Se requiere conversation_id'];
    }

    try {
        $scheduledAt = date('Y-m-d H:i:s', strtotime("+{$hoursDelay} hours"));

        $stmt = $pdo->prepare("
            UPDATE whatsapp_ai_context
            SET follow_up_scheduled_at = ?, follow_up_sent = 0, last_ai_action = 'schedule_follow_up'
            WHERE conversation_id = ?
        ");
        $stmt->execute([$scheduledAt, $conversationId]);

        return [
            'success' => true,
            'scheduled_at' => $scheduledAt,
            'message' => "Follow-up programado para $scheduledAt ($hoursDelay horas)"
        ];
    } catch (\PDOException $e) {
        return ['error' => 'Error: ' . $e->getMessage()];
    }
}

function getToolDefinition_create_lead(): array {
    return [
        'name' => 'create_lead',
        'description' => 'Guarda o actualiza datos del lead (cliente potencial). Usa esta herramienta cuando el cliente comparta su nombre, email, telefono, presupuesto, o tipo de embarcacion que le interesa. Acumula datos progresivamente.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'conversation_id' => ['type' => 'integer', 'description' => 'ID de la conversacion'],
                'phone' => ['type' => 'string', 'description' => 'Telefono del cliente'],
                'nombre' => ['type' => 'string', 'description' => 'Nombre del cliente'],
                'email' => ['type' => 'string', 'description' => 'Email del cliente'],
                'tipo_interes' => ['type' => 'string', 'description' => 'Tipo de embarcacion que le interesa'],
                'presupuesto' => ['type' => 'string', 'description' => 'Rango de presupuesto mencionado'],
                'urgencia' => ['type' => 'string', 'enum' => ['baja', 'media', 'alta'], 'description' => 'Nivel de urgencia percibido'],
                'notas' => ['type' => 'string', 'description' => 'Notas adicionales sobre el cliente']
            ],
            'required' => ['conversation_id']
        ]
    ];
}

function getToolDefinition_escalate_to_human(): array {
    return [
        'name' => 'escalate_to_human',
        'description' => 'Escala la conversacion a un agente humano. Usa cuando: el cliente pide hablar con una persona, tiene urgencia alta, el presupuesto es elevado (>30M CLP), la consulta es muy compleja, o el cliente esta frustrado.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'conversation_id' => ['type' => 'integer', 'description' => 'ID de la conversacion'],
                'reason' => ['type' => 'string', 'description' => 'Motivo de la escalacion'],
                'priority' => ['type' => 'string', 'enum' => ['baja', 'normal', 'alta', 'urgente'], 'description' => 'Prioridad']
            ],
            'required' => ['conversation_id', 'reason']
        ]
    ];
}

function getToolDefinition_schedule_follow_up(): array {
    return [
        'name' => 'schedule_follow_up',
        'description' => 'Programa un mensaje de seguimiento para mas tarde. Solo usar cuando detectes interes real de compra pero el cliente no cierra ahora. No abusar - solo cuando huela a cierre potencial.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'conversation_id' => ['type' => 'integer', 'description' => 'ID de la conversacion'],
                'hours_delay' => ['type' => 'integer', 'description' => 'Horas de espera antes del follow-up (default: 24)'],
                'reason' => ['type' => 'string', 'description' => 'Motivo del follow-up para contexto']
            ],
            'required' => ['conversation_id']
        ]
    ];
}
