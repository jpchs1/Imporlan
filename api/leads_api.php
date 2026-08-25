<?php
/**
 * Leads del simulador de costos — Imporlan
 * ========================================
 *
 * El simulador de /simulacion-cotizacion/ guarda cada solicitud en
 * api/simulaciones.json. Antes de este endpoint el único modo de leerlos era
 * entrar por SSH al servidor, así que en la práctica nadie los miraba: un lead
 * que nadie ve vale lo mismo que un lead perdido.
 *
 * Acciones:
 *   GET ?action=list            listado, más reciente primero
 *   GET ?action=export          el mismo listado en CSV, para la planilla
 *
 * Ambas exigen sesión de admin, igual que el resto del panel.
 */

require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

/** Devuelve los leads del más nuevo al más viejo. */
function leadsSimulador() {
    $archivo = __DIR__ . '/simulaciones.json';
    if (!is_readable($archivo)) return [];

    $datos = json_decode((string) @file_get_contents($archivo), true);
    if (!is_array($datos)) return [];

    // Se guardan en orden cronológico; para revisarlos interesa lo último.
    $datos = array_reverse($datos);

    // Índice estable para que el frontend pueda usarlo como key aunque dos
    // leads compartan fecha y correo.
    foreach ($datos as $i => &$lead) {
        $lead['id'] = count($datos) - $i;
    }
    unset($lead);

    return $datos;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        requireAdminAuthShared();
        header('Content-Type: application/json');

        $leads = leadsSimulador();
        $enviados = 0;
        foreach ($leads as $l) {
            if (!empty($l['correo_enviado'])) $enviados++;
        }

        echo json_encode([
            'success'   => true,
            'total'     => count($leads),
            'enviados'  => $enviados,
            'fallidos'  => count($leads) - $enviados,
            'leads'     => $leads,
        ]);
        break;

    case 'export':
        requireAdminAuthShared();
        $leads = leadsSimulador();

        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="leads-simulador-' . date('Y-m-d') . '.csv"');

        $salida = fopen('php://output', 'w');
        // BOM para que Excel en Windows respete los acentos.
        fwrite($salida, "\xEF\xBB\xBF");
        fputcsv($salida, ['Fecha', 'Nombre', 'Email', 'Correo enviado', 'IP', 'Origen']);
        foreach ($leads as $l) {
            fputcsv($salida, [
                $l['fecha'] ?? '',
                $l['nombre'] ?? '',
                $l['email'] ?? '',
                !empty($l['correo_enviado']) ? 'si' : 'no',
                $l['ip'] ?? '',
                $l['origen'] ?? '',
            ]);
        }
        fclose($salida);
        break;

    default:
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida', 'acciones' => ['list', 'export']]);
}
