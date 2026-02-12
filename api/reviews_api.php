<?php
/**
 * Reviews API - Imporlan
 *
 * Endpoints para gestionar resenas del panel admin
 *
 * Admin endpoints (require auth):
 * - GET  ?action=list              - Listar todas las resenas
 * - POST ?action=create            - Crear resena
 * - POST ?action=update            - Actualizar resena
 * - POST ?action=delete            - Eliminar resena
 * - GET  ?action=migrate           - Crear tabla reviews
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'migrate':
        requireAdminAuthShared();
        reviewsMigrate();
        break;
    case 'list':
        requireAdminAuthShared();
        reviewsList();
        break;
    case 'create':
        requireAdminAuthShared();
        reviewsCreate();
        break;
    case 'update':
        requireAdminAuthShared();
        reviewsUpdate();
        break;
    case 'delete':
        requireAdminAuthShared();
        reviewsDelete();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use: migrate, list, create, update, delete']);
}

function reviewsMigrate() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_name VARCHAR(255) NOT NULL,
                author_role VARCHAR(255),
                review_text TEXT NOT NULL,
                rating INT DEFAULT 5,
                is_active TINYINT(1) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_active (is_active),
                INDEX idx_sort (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $count = $pdo->query("SELECT COUNT(*) FROM reviews")->fetchColumn();
        if ($count == 0) {
            $defaults = [
                ["Carlos Rodriguez", "Empresario, Santiago", "Excelente servicio. Importaron mi Cobalt R30 sin ningun problema. Todo el proceso fue transparente y profesional.", 5],
                ["Maria Gonzalez", "Medico, Vina del Mar", "Muy recomendable. El equipo de Imporlan me ayudo a encontrar la lancha perfecta para mi familia.", 5],
                ["Pedro Martinez", "Ingeniero, Concepcion", "Proceso impecable de principio a fin. La comunicacion fue excelente y cumplieron con todos los plazos.", 5],
                ["Roberto Silva", "Abogado, Valparaiso", "Increible experiencia. Desde la busqueda hasta la entrega, todo fue perfecto. Mi Sea Ray llego en excelentes condiciones.", 5],
                ["Ana Fernandez", "Arquitecta, La Serena", "Profesionalismo de primer nivel. Me asesoraron en cada paso y el precio final fue exactamente el cotizado. Sin sorpresas.", 5],
                ["Diego Morales", "Empresario, Temuco", "Segunda lancha que importo con Imporlan. La confianza que generan es invaluable. Totalmente recomendados.", 5],
                ["Claudia Vargas", "Dentista, Puerto Montt", "El seguimiento en tiempo real me dio mucha tranquilidad. Siempre supe donde estaba mi embarcacion.", 5],
                ["Francisco Rojas", "Contador, Antofagasta", "Ahorre mas de 3 millones comparado con comprar en Chile. El servicio de Imporlan vale cada peso.", 5],
                ["Valentina Soto", "Ingeniera Civil, Rancagua", "La inspeccion previa fue muy detallada. Me enviaron fotos y videos de todo. Compre con total seguridad.", 5],
                ["Andres Munoz", "Medico, Iquique", "Atencion personalizada de principio a fin. Resolvieron todas mis dudas rapidamente. Excelente equipo.", 5]
            ];
            $stmt = $pdo->prepare("INSERT INTO reviews (author_name, author_role, review_text, rating, sort_order) VALUES (?, ?, ?, ?, ?)");
            foreach ($defaults as $idx => $r) {
                $stmt->execute([$r[0], $r[1], $r[2], $r[3], $idx + 1]);
            }
        }

        echo json_encode(['success' => true, 'message' => 'reviews table created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

function reviewsList() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->query("SELECT * FROM reviews ORDER BY sort_order ASC, id ASC");
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'reviews' => $reviews, 'total' => count($reviews)]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al listar: ' . $e->getMessage()]);
    }
}

function reviewsCreate() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['author_name']) || empty($input['review_text'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere author_name y review_text']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $maxOrder = $pdo->query("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM reviews")->fetchColumn();
        $stmt = $pdo->prepare("INSERT INTO reviews (author_name, author_role, review_text, rating, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['author_name'],
            $input['author_role'] ?? '',
            $input['review_text'],
            intval($input['rating'] ?? 5),
            intval($input['is_active'] ?? 1),
            intval($input['sort_order'] ?? $maxOrder)
        ]);
        $id = intval($pdo->lastInsertId());
        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Resena creada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear: ' . $e->getMessage()]);
    }
}

function reviewsUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $allowed = ['author_name', 'author_role', 'review_text', 'rating', 'is_active', 'sort_order'];
        $sets = [];
        $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $input)) {
                $sets[] = "$field = ?";
                $params[] = $input[$field];
            }
        }
        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay campos para actualizar']);
            return;
        }
        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE reviews SET " . implode(', ', $sets) . " WHERE id = ?");
        $stmt->execute($params);
        echo json_encode(['success' => true, 'message' => 'Resena actualizada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar: ' . $e->getMessage()]);
    }
}

function reviewsDelete() {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id']);
        return;
    }
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Resena eliminada']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar: ' . $e->getMessage()]);
    }
}
