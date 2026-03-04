<?php
/**
 * Notifications API - Imporlan
 * 
 * User notification system for the panel.
 * 
 * Endpoints:
 * - GET  ?action=list&user_email=X       - List notifications for user
 * - GET  ?action=unread_count&user_email=X - Count unread notifications
 * - POST ?action=mark_read&id=X          - Mark notification as read
 * - POST ?action=mark_all_read&user_email=X - Mark all as read
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email, X-User-Name');
    header('Content-Type: application/json');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    $action = $_GET['action'] ?? '';

    // All notification endpoints require user authentication
    $userPayload = requireUserAuthShared();
    $authenticatedEmail = $userPayload['email'] ?? '';

    switch ($action) {
        case 'list':
            listNotifications($authenticatedEmail);
            break;
        case 'unread_count':
            unreadCount($authenticatedEmail);
            break;
        case 'mark_read':
            markRead($authenticatedEmail);
            break;
        case 'mark_all_read':
            markAllRead($authenticatedEmail);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Accion no valida']);
    }
}

function listNotifications($authenticatedEmail = '') {
    $userEmail = $_GET['user_email'] ?? '';
    if (empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere user_email']);
        return;
    }

    // Verify the authenticated user can only access their own notifications
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($userEmail)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado para ver notificaciones de otro usuario']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $limit = intval($_GET['limit'] ?? 20);
        $stmt = $pdo->prepare("
            SELECT id, user_email, type, title, message, link, read_at, created_at
            FROM notifications
            WHERE user_email = ?
            ORDER BY created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$userEmail, $limit]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'notifications' => $notifications]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener notificaciones: ' . $e->getMessage()]);
    }
}

function unreadCount($authenticatedEmail = '') {
    $userEmail = $_GET['user_email'] ?? '';
    if (empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere user_email']);
        return;
    }

    // Verify the authenticated user can only access their own notifications
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($userEmail)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM notifications WHERE user_email = ? AND read_at IS NULL");
        $stmt->execute([$userEmail]);
        $count = intval($stmt->fetch(PDO::FETCH_ASSOC)['count']);

        echo json_encode(['success' => true, 'count' => $count]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}

function markRead($authenticatedEmail = '') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? $_GET['id'] ?? 0);

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
        // Only allow marking own notifications as read
        $stmt = $pdo->prepare("UPDATE notifications SET read_at = NOW() WHERE id = ? AND read_at IS NULL AND user_email = ?");
        $stmt->execute([$id, $authenticatedEmail]);

        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}

function markAllRead($authenticatedEmail = '') {
    $input = json_decode(file_get_contents('php://input'), true);
    $userEmail = $input['user_email'] ?? $_GET['user_email'] ?? '';

    if (empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere user_email']);
        return;
    }

    // Verify the authenticated user can only modify their own notifications
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($userEmail)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE notifications SET read_at = NOW() WHERE user_email = ? AND read_at IS NULL");
        $stmt->execute([$userEmail]);

        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
    }
}
