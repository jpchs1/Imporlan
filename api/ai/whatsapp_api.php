<?php
/**
 * WhatsApp Cloud API Helper - Imporlan
 * Functions to send messages, media, and interactive elements via Meta Cloud API.
 */

require_once __DIR__ . '/whatsapp_config.php';

class WhatsAppAPI {
    private $phoneNumberId;
    private $accessToken;
    private $apiUrl;

    public function __construct() {
        $this->phoneNumberId = WHATSAPP_PHONE_NUMBER_ID;
        $this->accessToken = WHATSAPP_ACCESS_TOKEN;
        $this->apiUrl = "https://graph.facebook.com/v21.0/{$this->phoneNumberId}/messages";
    }

    /**
     * Send a text message.
     */
    public function sendText(string $to, string $text, bool $previewUrl = false): array {
        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'text',
            'text' => [
                'preview_url' => $previewUrl,
                'body' => $text
            ]
        ]);
    }

    /**
     * Send interactive buttons (max 3 buttons).
     */
    public function sendButtons(string $to, string $body, array $buttons, string $header = '', string $footer = ''): array {
        $buttonPayload = [];
        foreach (array_slice($buttons, 0, 3) as $i => $btn) {
            $buttonPayload[] = [
                'type' => 'reply',
                'reply' => [
                    'id' => $btn['id'] ?? "btn_$i",
                    'title' => mb_substr($btn['title'], 0, 20)
                ]
            ];
        }

        $interactive = [
            'type' => 'button',
            'body' => ['text' => $body],
            'action' => ['buttons' => $buttonPayload]
        ];

        if ($header) {
            $interactive['header'] = ['type' => 'text', 'text' => mb_substr($header, 0, 60)];
        }
        if ($footer) {
            $interactive['footer'] = ['text' => mb_substr($footer, 0, 60)];
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'interactive',
            'interactive' => $interactive
        ]);
    }

    /**
     * Send a list menu (up to 10 rows per section, max 10 sections).
     */
    public function sendList(string $to, string $body, string $buttonText, array $sections, string $header = '', string $footer = ''): array {
        $interactive = [
            'type' => 'list',
            'body' => ['text' => $body],
            'action' => [
                'button' => mb_substr($buttonText, 0, 20),
                'sections' => $sections
            ]
        ];

        if ($header) {
            $interactive['header'] = ['type' => 'text', 'text' => mb_substr($header, 0, 60)];
        }
        if ($footer) {
            $interactive['footer'] = ['text' => mb_substr($footer, 0, 60)];
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'interactive',
            'interactive' => $interactive
        ]);
    }

    /**
     * Send an image by URL.
     */
    public function sendImage(string $to, string $imageUrl, string $caption = ''): array {
        $image = ['link' => $imageUrl];
        if ($caption) {
            $image['caption'] = $caption;
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'image',
            'image' => $image
        ]);
    }

    /**
     * Send a document (PDF, etc.) by URL.
     */
    public function sendDocument(string $to, string $docUrl, string $filename, string $caption = ''): array {
        $doc = ['link' => $docUrl, 'filename' => $filename];
        if ($caption) {
            $doc['caption'] = $caption;
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'document',
            'document' => $doc
        ]);
    }

    /**
     * Send a location pin.
     */
    public function sendLocation(string $to, float $lat, float $lng, string $name = '', string $address = ''): array {
        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'location',
            'location' => [
                'latitude' => $lat,
                'longitude' => $lng,
                'name' => $name,
                'address' => $address
            ]
        ]);
    }

    /**
     * Send a contact card.
     */
    public function sendContact(string $to, string $name, string $phone, string $email = ''): array {
        $contact = [
            'name' => ['formatted_name' => $name, 'first_name' => explode(' ', $name)[0]],
            'phones' => [['phone' => $phone, 'type' => 'WORK']]
        ];
        if ($email) {
            $contact['emails'] = [['email' => $email, 'type' => 'WORK']];
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'contacts',
            'contacts' => [$contact]
        ]);
    }

    /**
     * Mark a message as read (shows blue checkmarks).
     */
    public function markAsRead(string $messageId): array {
        return $this->send([
            'messaging_product' => 'whatsapp',
            'status' => 'read',
            'message_id' => $messageId
        ]);
    }

    /**
     * Send a template message (for outbound/follow-up, requires pre-approved template).
     */
    public function sendTemplate(string $to, string $templateName, string $languageCode = 'es', array $components = []): array {
        $template = [
            'name' => $templateName,
            'language' => ['code' => $languageCode]
        ];
        if (!empty($components)) {
            $template['components'] = $components;
        }

        return $this->send([
            'messaging_product' => 'whatsapp',
            'to' => $this->normalizePhone($to),
            'type' => 'template',
            'template' => $template
        ]);
    }

    /**
     * Parse incoming webhook payload to extract message data.
     */
    public static function parseIncomingMessage(array $payload): ?array {
        $entry = $payload['entry'][0] ?? null;
        if (!$entry) return null;

        $changes = $entry['changes'][0] ?? null;
        if (!$changes || ($changes['field'] ?? '') !== 'messages') return null;

        $value = $changes['value'] ?? [];
        $messages = $value['messages'] ?? [];
        $contacts = $value['contacts'] ?? [];
        $statuses = $value['statuses'] ?? [];

        if (!empty($statuses)) {
            return [
                'type' => 'status',
                'status' => $statuses[0]['status'] ?? 'unknown',
                'recipient_id' => $statuses[0]['recipient_id'] ?? '',
                'message_id' => $statuses[0]['id'] ?? '',
                'timestamp' => $statuses[0]['timestamp'] ?? ''
            ];
        }

        if (empty($messages)) return null;

        $msg = $messages[0];
        $contact = $contacts[0] ?? [];

        $parsed = [
            'type' => 'message',
            'message_id' => $msg['id'] ?? '',
            'from' => $msg['from'] ?? '',
            'timestamp' => $msg['timestamp'] ?? '',
            'contact_name' => $contact['profile']['name'] ?? '',
            'wa_id' => $contact['wa_id'] ?? $msg['from'] ?? '',
            'message_type' => $msg['type'] ?? 'text',
        ];

        switch ($msg['type'] ?? 'text') {
            case 'text':
                $parsed['text'] = $msg['text']['body'] ?? '';
                break;
            case 'interactive':
                $interactive = $msg['interactive'] ?? [];
                if (($interactive['type'] ?? '') === 'button_reply') {
                    $parsed['text'] = $interactive['button_reply']['title'] ?? '';
                    $parsed['button_id'] = $interactive['button_reply']['id'] ?? '';
                } elseif (($interactive['type'] ?? '') === 'list_reply') {
                    $parsed['text'] = $interactive['list_reply']['title'] ?? '';
                    $parsed['list_id'] = $interactive['list_reply']['id'] ?? '';
                }
                break;
            case 'image':
                $parsed['text'] = $msg['image']['caption'] ?? '[Imagen]';
                $parsed['media_id'] = $msg['image']['id'] ?? '';
                break;
            case 'document':
                $parsed['text'] = $msg['document']['caption'] ?? $msg['document']['filename'] ?? '[Documento]';
                $parsed['media_id'] = $msg['document']['id'] ?? '';
                break;
            case 'audio':
                $parsed['text'] = '[Audio]';
                $parsed['media_id'] = $msg['audio']['id'] ?? '';
                break;
            case 'location':
                $loc = $msg['location'] ?? [];
                $parsed['text'] = sprintf('[Ubicacion: %s, %s]', $loc['latitude'] ?? '', $loc['longitude'] ?? '');
                $parsed['location'] = $loc;
                break;
            default:
                $parsed['text'] = '[Mensaje no soportado]';
        }

        return $parsed;
    }

    /**
     * Normalize phone number to WhatsApp format (no + prefix, just digits).
     */
    private function normalizePhone(string $phone): string {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($phone) === 9 && $phone[0] === '9') {
            $phone = '56' . $phone;
        }
        return $phone;
    }

    /**
     * Send request to WhatsApp Cloud API.
     */
    private function send(array $body): array {
        $ch = curl_init($this->apiUrl);

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->accessToken,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("[WhatsAppAPI] cURL error: $error");
            return ['success' => false, 'error' => $error];
        }

        $decoded = json_decode($response, true);

        if ($httpCode >= 400) {
            $errMsg = $decoded['error']['message'] ?? "HTTP $httpCode";
            error_log("[WhatsAppAPI] API error ($httpCode): $errMsg");
            return ['success' => false, 'error' => $errMsg, 'http_code' => $httpCode];
        }

        return array_merge(['success' => true], $decoded ?? []);
    }

    /**
     * Log webhook payload for debugging.
     */
    public static function logWebhook(string $direction, ?string $phone, array $payload, string $waMessageId = ''): void {
        try {
            $pdo = getDbConnection();
            $stmt = $pdo->prepare("
                INSERT INTO whatsapp_webhook_log (direction, wa_message_id, phone, payload)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$direction, $waMessageId ?: null, $phone, json_encode($payload)]);
        } catch (\PDOException $e) {
            error_log('[WhatsAppAPI] Log failed: ' . $e->getMessage());
        }
    }
}
