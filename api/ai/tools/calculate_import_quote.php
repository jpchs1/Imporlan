<?php
/**
 * AI Tool: Calculate Import Quote - Imporlan
 * Calculates estimated import cost for a boat from USA to Chile.
 */

function tool_calculate_import_quote(array $input): array {
    $boatPriceUsd = (float)($input['precio_usd'] ?? 0);
    $boatType = $input['tipo'] ?? 'lancha';
    $boatLength = (float)($input['eslora_pies'] ?? 20);
    $originState = $input['estado_origen'] ?? 'Florida';

    if ($boatPriceUsd <= 0) {
        return ['error' => 'Se requiere el precio de la embarcacion en USD'];
    }

    // Freight estimate based on boat length
    $freightUsd = calculateFreight($boatLength, $originState);

    // Chilean customs: 6% import duty + 19% IVA on (price + freight + insurance)
    $insuranceUsd = round($boatPriceUsd * 0.015, 2); // ~1.5% marine insurance
    $cifValue = $boatPriceUsd + $freightUsd + $insuranceUsd;

    $importDuty = round($cifValue * 0.06, 2); // 6% arancel
    $iva = round(($cifValue + $importDuty) * 0.19, 2); // 19% IVA

    // Imporlan service fee
    $serviceFee = calculateServiceFee($boatPriceUsd);

    // Inspection fee
    $inspectionFee = 350;

    // Port and customs handling
    $portHandling = calculatePortHandling($boatLength);

    // Matriculation (DIRECTEMAR)
    $matriculation = 200;

    $totalUsd = $boatPriceUsd + $freightUsd + $insuranceUsd + $importDuty + $iva + $serviceFee + $inspectionFee + $portHandling + $matriculation;

    // USD to CLP conversion (approximate)
    $usdClp = getUsdClpRate();
    $totalClp = round($totalUsd * $usdClp);

    // Timeline estimate
    $timeline = getImportTimeline($originState);

    return [
        'desglose' => [
            'precio_embarcacion_usd' => $boatPriceUsd,
            'flete_maritimo_usd' => $freightUsd,
            'seguro_maritimo_usd' => $insuranceUsd,
            'valor_cif_usd' => $cifValue,
            'arancel_6_pct_usd' => $importDuty,
            'iva_19_pct_usd' => $iva,
            'servicio_imporlan_usd' => $serviceFee,
            'inspeccion_pre_compra_usd' => $inspectionFee,
            'manejo_portuario_usd' => $portHandling,
            'matriculacion_directemar_usd' => $matriculation,
        ],
        'total_estimado_usd' => round($totalUsd, 2),
        'total_estimado_clp' => $totalClp,
        'tipo_cambio_usd_clp' => $usdClp,
        'plazo_estimado' => $timeline,
        'nota' => 'Cotizacion estimada. Los valores finales pueden variar segun el tipo de cambio al momento de la operacion, el estado de la embarcacion, y costos portuarios vigentes. Imporlan se encarga de todo el proceso.',
        'incluye' => [
            'Inspeccion pre-compra en USA',
            'Gestion de compra y documentacion',
            'Flete maritimo puerta a puerta',
            'Seguro maritimo de carga',
            'Desaduanamiento en Chile',
            'Matriculacion DIRECTEMAR',
            'Acompanamiento durante todo el proceso'
        ]
    ];
}

function calculateFreight(float $lengthFeet, string $originState): float {
    $baseRates = [
        'Florida' => 80,
        'Texas' => 90,
        'California' => 100,
        'New York' => 95,
    ];
    $ratePerFoot = $baseRates[$originState] ?? 90;

    $freight = $lengthFeet * $ratePerFoot;
    return max(round($freight, 2), 1500);
}

function calculateServiceFee(float $boatPrice): float {
    if ($boatPrice <= 15000) return 1500;
    if ($boatPrice <= 30000) return 2000;
    if ($boatPrice <= 50000) return 2500;
    if ($boatPrice <= 100000) return 3500;
    return round($boatPrice * 0.04, 2);
}

function calculatePortHandling(float $lengthFeet): float {
    if ($lengthFeet <= 20) return 400;
    if ($lengthFeet <= 30) return 600;
    if ($lengthFeet <= 40) return 900;
    return 1200;
}

function getUsdClpRate(): float {
    try {
        $dolarFile = __DIR__ . '/../../dolar.php';
        if (file_exists($dolarFile)) {
            $ch = curl_init('https://mindicador.cl/api/dolar');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            $data = json_decode($response, true);
            if (!empty($data['serie'][0]['valor'])) {
                return (float)$data['serie'][0]['valor'];
            }
        }
    } catch (\Exception $e) {
        // fallback
    }
    return 950.0;
}

function getImportTimeline(string $originState): array {
    $transitDays = [
        'Florida' => ['min' => 25, 'max' => 35],
        'Texas' => ['min' => 30, 'max' => 40],
        'California' => ['min' => 20, 'max' => 30],
        'New York' => ['min' => 30, 'max' => 40],
    ];
    $transit = $transitDays[$originState] ?? ['min' => 30, 'max' => 40];

    return [
        'inspeccion' => '5-7 dias',
        'compra_y_documentacion' => '10-15 dias',
        'flete_maritimo' => "{$transit['min']}-{$transit['max']} dias",
        'aduana_y_matriculacion' => '15-20 dias',
        'total_estimado' => ($transit['min'] + 30) . '-' . ($transit['max'] + 42) . ' dias'
    ];
}

function getToolDefinition_calculate_import_quote(): array {
    return [
        'name' => 'calculate_import_quote',
        'description' => 'Calcula una cotizacion estimada para importar una embarcacion desde USA a Chile. Incluye flete, seguros, arancel, IVA, servicio Imporlan, y tiempos estimados. Usa esta herramienta cuando el cliente pregunte por costos, precios, o cuanto cuesta importar un barco.',
        'input_schema' => [
            'type' => 'object',
            'properties' => [
                'precio_usd' => [
                    'type' => 'number',
                    'description' => 'Precio de la embarcacion en dolares USD'
                ],
                'tipo' => [
                    'type' => 'string',
                    'description' => 'Tipo de embarcacion (lancha, velero, yate, moto de agua, etc.)'
                ],
                'eslora_pies' => [
                    'type' => 'number',
                    'description' => 'Eslora (largo) de la embarcacion en pies'
                ],
                'estado_origen' => [
                    'type' => 'string',
                    'enum' => ['Florida', 'Texas', 'California', 'New York'],
                    'description' => 'Estado de origen en USA (default: Florida)'
                ]
            ],
            'required' => ['precio_usd']
        ]
    ];
}
