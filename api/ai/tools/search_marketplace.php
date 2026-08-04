<?php
/**
 * AI Tool: Search Marketplace - Imporlan
 * Searches available boat listings in real-time from MySQL.
 */

function tool_search_marketplace(array $input): array {
    $pdo = getDbConnection();

    $where = ["ml.status = 'active'"];
    $params = [];

    if (!empty($input['tipo'])) {
        $where[] = "LOWER(ml.tipo) LIKE ?";
        $params[] = '%' . strtolower($input['tipo']) . '%';
    }

    if (!empty($input['nombre'])) {
        $where[] = "(LOWER(ml.nombre) LIKE ? OR LOWER(ml.descripcion) LIKE ?)";
        $params[] = '%' . strtolower($input['nombre']) . '%';
        $params[] = '%' . strtolower($input['nombre']) . '%';
    }

    if (!empty($input['precio_max'])) {
        $where[] = "ml.precio <= ?";
        $params[] = (float)$input['precio_max'];
    }

    if (!empty($input['precio_min'])) {
        $where[] = "ml.precio >= ?";
        $params[] = (float)$input['precio_min'];
    }

    if (!empty($input['estado'])) {
        $where[] = "ml.estado = ?";
        $params[] = $input['estado'];
    }

    if (!empty($input['modo'])) {
        $where[] = "ml.modo = ?";
        $params[] = $input['modo'];
    }

    if (!empty($input['ubicacion'])) {
        $where[] = "LOWER(ml.ubicacion) LIKE ?";
        $params[] = '%' . strtolower($input['ubicacion']) . '%';
    }

    $limit = min((int)($input['limit'] ?? 5), 10);
    $whereStr = implode(' AND ', $where);

    $stmt = $pdo->prepare("
        SELECT ml.id, ml.nombre, ml.tipo, ml.ano, ml.eslora, ml.precio, ml.moneda,
               ml.ubicacion, ml.estado, ml.condicion, ml.horas,
               ml.descripcion, ml.fotos, ml.modo,
               ml.arriendo_precio_dia, ml.arriendo_precio_semana,
               ml.created_at
        FROM marketplace_listings ml
        WHERE $whereStr
        ORDER BY ml.created_at DESC
        LIMIT $limit
    ");
    $stmt->execute($params);
    $listings = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    foreach ($listings as &$l) {
        $fotos = $l['fotos'] ? json_decode($l['fotos'], true) : [];
        $l['foto_principal'] = !empty($fotos) ? str_replace('/test/api/', '/api/', $fotos[0]) : null;
        $l['total_fotos'] = count($fotos);
        unset($l['fotos']);
        $l['url'] = "https://www.imporlan.cl/marketplace.html#/listing/{$l['id']}";
        $l['descripcion'] = $l['descripcion'] ? mb_substr(strip_tags($l['descripcion']), 0, 200) : '';
    }

    $totalStmt = $pdo->prepare("SELECT COUNT(*) as total FROM marketplace_listings ml WHERE $whereStr");
    $totalStmt->execute($params);
    $total = $totalStmt->fetch(\PDO::FETCH_ASSOC)['total'];

    return [
        'total_disponibles' => (int)$total,
        'mostrando' => count($listings),
        'embarcaciones' => $listings
    ];
}

function getToolDefinition_search_marketplace(): array {
    return [
        'name' => 'search_marketplace',
        'description' => 'Busca embarcaciones disponibles en el marketplace de Imporlan. Usa esta herramienta cuando el cliente pregunte por barcos, lanchas, veleros, motos de agua, o cualquier tipo de embarcacion disponible para venta o arriendo.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'tipo' => [
                    'type' => 'string',
                    'description' => 'Tipo de embarcacion: lancha, velero, yate, moto de agua, bote de pesca, catamaran, etc.'
                ],
                'nombre' => [
                    'type' => 'string',
                    'description' => 'Nombre o marca de la embarcacion (ej: Bayliner, Sea Ray, Yamaha)'
                ],
                'precio_max' => [
                    'type' => 'number',
                    'description' => 'Precio maximo en la moneda del listado (USD o CLP)'
                ],
                'precio_min' => [
                    'type' => 'number',
                    'description' => 'Precio minimo'
                ],
                'estado' => [
                    'type' => 'string',
                    'enum' => ['Nueva', 'Usada'],
                    'description' => 'Estado de la embarcacion'
                ],
                'modo' => [
                    'type' => 'string',
                    'enum' => ['venta', 'arriendo'],
                    'description' => 'Modo: venta o arriendo'
                ],
                'ubicacion' => [
                    'type' => 'string',
                    'description' => 'Ubicacion o region (ej: Santiago, Valparaiso, USA)'
                ],
                'limit' => [
                    'type' => 'integer',
                    'description' => 'Cantidad maxima de resultados (default: 5, max: 10)'
                ]
            ],
            'required' => []
        ]
    ];
}
