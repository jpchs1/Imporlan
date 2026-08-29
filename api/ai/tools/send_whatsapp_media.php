<?php
/**
 * AI Tool: Send WhatsApp Media - Imporlan
 * Sends rich content (images, buttons, lists, contacts) via WhatsApp.
 * These tools are executed AFTER Claude generates the text response.
 */

require_once __DIR__ . '/../whatsapp_api.php';

function tool_send_boat_gallery(array $input): array {
    $wa = new WhatsAppAPI();
    $phone = $input['phone'] ?? '';
    $listings = $input['listings'] ?? [];

    if (!$phone || empty($listings)) {
        return ['error' => 'Se requiere phone y listings'];
    }

    $sent = 0;
    foreach (array_slice($listings, 0, 3) as $listing) {
        $imageUrl = $listing['foto_principal'] ?? '';
        if (!$imageUrl) continue;

        if (strpos($imageUrl, 'http') !== 0) {
            $imageUrl = 'https://www.imporlan.cl' . $imageUrl;
        }

        $precio = number_format($listing['precio'] ?? 0, 0, ',', '.');
        $moneda = $listing['moneda'] ?? 'USD';
        $caption = "{$listing['nombre']}\n"
            . "Precio: {$moneda} \${$precio}\n"
            . "Año: " . ($listing['ano'] ?? 'N/D') . " | Eslora: " . ($listing['eslora'] ?? 'N/D') . "\n"
            . "Ver más: {$listing['url']}";

        $result = $wa->sendImage($phone, $imageUrl, $caption);
        if ($result['success'] ?? false) $sent++;
    }

    return ['success' => true, 'images_sent' => $sent];
}

function tool_send_interactive_menu(array $input): array {
    $wa = new WhatsAppAPI();
    $phone = $input['phone'] ?? '';
    $menuType = $input['menu_type'] ?? 'services';

    if (!$phone) return ['error' => 'Se requiere phone'];

    if ($menuType === 'services') {
        return $wa->sendButtons($phone,
            "¿En qué te puedo ayudar hoy?",
            [
                ['id' => 'svc_import', 'title' => 'Importar un barco'],
                ['id' => 'svc_marketplace', 'title' => 'Ver barcos disponibles'],
                ['id' => 'svc_human', 'title' => 'Hablar con asesor'],
            ],
            'Imporlan',
            'Elige una opcion'
        );
    }

    if ($menuType === 'boat_types') {
        return $wa->sendList($phone,
            "Tenemos distintos tipos de embarcaciones. ¿Cuál te interesa?",
            'Ver tipos',
            [[
                'title' => 'Tipos de embarcación',
                'rows' => [
                    ['id' => 'type_lancha', 'title' => 'Lanchas', 'description' => 'Paseo, pesca deportiva, recreacion'],
                    ['id' => 'type_velero', 'title' => 'Veleros', 'description' => 'Navegacion a vela, crucero'],
                    ['id' => 'type_jetski', 'title' => 'Motos de agua', 'description' => 'Jet ski, deportes acuaticos'],
                    ['id' => 'type_yate', 'title' => 'Yates', 'description' => 'Cruceros, embarcaciones premium'],
                    ['id' => 'type_pesca', 'title' => 'Botes de pesca', 'description' => 'Pesca artesanal y deportiva'],
                    ['id' => 'type_catamaran', 'title' => 'Catamaranes', 'description' => 'Estabilidad, turismo'],
                ]
            ]],
            'Imporlan Marketplace'
        );
    }

    if ($menuType === 'quote_confirm') {
        return $wa->sendButtons($phone,
            "¿Te gustaría recibir una cotización formal detallada?",
            [
                ['id' => 'quote_yes', 'title' => 'Si, cotizar'],
                ['id' => 'quote_later', 'title' => 'Mas tarde'],
                ['id' => 'quote_human', 'title' => 'Hablar con asesor'],
            ],
            'Cotización Imporlan'
        );
    }

    return ['error' => "Tipo de menu no reconocido: $menuType"];
}

function tool_send_contact_card(array $input): array {
    $wa = new WhatsAppAPI();
    $phone = $input['phone'] ?? '';

    if (!$phone) return ['error' => 'Se requiere phone'];

    return $wa->sendContact(
        $phone,
        'Imporlan - Asesor Comercial',
        WHATSAPP_DISPLAY_PHONE ?? '+56940211459',
        ADMIN_NOTIFICATION_EMAIL ?? 'contacto@imporlan.cl'
    );
}

function getToolDefinition_send_boat_gallery(): array {
    return [
        'name' => 'send_boat_gallery',
        'description' => 'Envia fotos de embarcaciones por WhatsApp al cliente. Usa despues de buscar en el marketplace cuando hay resultados con fotos. Maximo 3 imagenes por vez.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'phone' => ['type' => 'string', 'description' => 'Telefono del cliente'],
                'listings' => [
                    'type' => 'array',
                    'description' => 'Array de listings del marketplace con foto_principal, nombre, precio, moneda, ano, eslora, url',
                    'items' => ['type' => 'object']
                ]
            ],
            'required' => ['phone', 'listings']
        ]
    ];
}

function getToolDefinition_send_interactive_menu(): array {
    return [
        'name' => 'send_interactive_menu',
        'description' => 'Envia un menu interactivo de WhatsApp. Tipos: "services" (menu principal de servicios), "boat_types" (lista de tipos de embarcacion), "quote_confirm" (confirmar si quiere cotizacion).',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'phone' => ['type' => 'string', 'description' => 'Telefono del cliente'],
                'menu_type' => [
                    'type' => 'string',
                    'enum' => ['services', 'boat_types', 'quote_confirm'],
                    'description' => 'Tipo de menu a enviar'
                ]
            ],
            'required' => ['phone', 'menu_type']
        ]
    ];
}

function getToolDefinition_send_contact_card(): array {
    return [
        'name' => 'send_contact_card',
        'description' => 'Envia la tarjeta de contacto de Imporlan al cliente. Usar al escalar a agente humano o cuando el cliente pide los datos de contacto.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'phone' => ['type' => 'string', 'description' => 'Telefono del cliente']
            ],
            'required' => ['phone']
        ]
    ];
}
