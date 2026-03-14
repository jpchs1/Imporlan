<?php
/**
 * Image Cache Proxy - Imporlan
 * 
 * Caches external images (Facebook CDN, etc.) locally on the server.
 * Facebook CDN URLs expire and return 403 when accessed server-side,
 * so this proxy downloads and stores permanent copies.
 * 
 * Endpoints:
 * - GET  ?action=proxy&url=X      - Serve cached image or proxy from URL
 * - POST ?action=cache_image      - Download and cache an image from URL
 * - POST ?action=cache_base64     - Save a base64-encoded image
 * - POST ?action=update_link_image - Update a link's image_url in DB
 * - GET  ?action=status&order_id=X - Check cache status for an order's images
 */

require_once __DIR__ . '/db_config.php';

// Simple auth check - secret stored in config or env
function getImageCacheSecret() {
    // Check environment variable first
    $secret = getenv('IMPORLAN_IMAGE_SECRET');
    if ($secret) return $secret;
    // Fallback to config file
    $configFile = __DIR__ . '/image_cache_config.php';
    if (file_exists($configFile)) {
        $config = include $configFile;
        return $config['secret'] ?? '';
    }
    return '';
}

function checkSecret() {
    $expected = getImageCacheSecret();
    if (!$expected) {
        http_response_code(500);
        echo json_encode(['error' => 'Image cache secret not configured. Set IMPORLAN_IMAGE_SECRET env var or create api/image_cache_config.php']);
        exit;
    }
    $secret = $_POST['secret'] ?? $_GET['secret'] ?? '';
    if ($secret !== $expected) {
        http_response_code(403);
        echo json_encode(['error' => 'unauthorized']);
        exit;
    }
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'proxy':
        proxyImage();
        break;
    case 'cache_image':
        checkSecret();
        cacheImageFromUrl();
        break;
    case 'cache_base64':
        checkSecret();
        cacheBase64Image();
        break;
    case 'update_link_image':
        checkSecret();
        updateLinkImage();
        break;
    case 'status':
        checkSecret();
        cacheStatus();
        break;
    default:
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use: proxy, cache_image, cache_base64, update_link_image, status']);
}

/**
 * Proxy/serve a cached image. If not cached yet, returns placeholder.
 */
function proxyImage() {
    $url = $_GET['url'] ?? '';
    if (!$url) {
        http_response_code(400);
        echo 'Missing url parameter';
        return;
    }

    $cacheDir = __DIR__ . '/../uploads/order_images';
    $hash = md5($url);
    $cachedFile = $cacheDir . '/cache_' . $hash . '.jpg';

    // Serve from cache if available
    if (file_exists($cachedFile) && filesize($cachedFile) > 100) {
        header('Content-Type: image/jpeg');
        header('Cache-Control: public, max-age=86400');
        readfile($cachedFile);
        return;
    }

    // Try to download if it's not a Facebook CDN URL (those need auth)
    if (strpos($url, 'fbcdn.net') === false && strpos($url, 'facebook.com') === false) {
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'Mozilla/5.0 (compatible; ImporlanBot/1.0)',
            ]
        ]);
        $data = @file_get_contents($url, false, $ctx);
        if ($data && strlen($data) > 100) {
            if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);
            file_put_contents($cachedFile, $data);
            header('Content-Type: image/jpeg');
            header('Cache-Control: public, max-age=86400');
            echo $data;
            return;
        }
    }

    // Return 404 if not cached and can't download
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Image not cached and cannot be downloaded']);
}

/**
 * Download and cache an image from a URL.
 * Works for non-Facebook URLs. For Facebook, use cache_base64 instead.
 */
function cacheImageFromUrl() {
    header('Content-Type: application/json');
    $url = $_POST['url'] ?? '';
    $filename = $_POST['filename'] ?? '';

    if (!$url) {
        echo json_encode(['error' => 'Missing url']);
        return;
    }

    if (!$filename) {
        $filename = 'cache_' . md5($url) . '.jpg';
    }
    $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $filename);

    $cacheDir = __DIR__ . '/../uploads/order_images';
    if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 15,
            'user_agent' => 'Mozilla/5.0 (compatible; ImporlanBot/1.0)',
        ]
    ]);
    $data = @file_get_contents($url, false, $ctx);

    if (!$data || strlen($data) < 100) {
        echo json_encode(['error' => 'Failed to download image', 'url' => $url]);
        return;
    }

    $filepath = $cacheDir . '/' . $filename;
    file_put_contents($filepath, $data);

    $publicUrl = 'https://www.imporlan.cl/uploads/order_images/' . $filename;
    echo json_encode([
        'success' => true,
        'url' => $publicUrl,
        'size' => strlen($data),
        'filename' => $filename
    ]);
}

/**
 * Save a base64-encoded image to the cache.
 * Used for Facebook images that need to be extracted via browser.
 */
function cacheBase64Image() {
    header('Content-Type: application/json');
    $b64 = $_POST['data'] ?? '';
    $filename = $_POST['filename'] ?? '';

    if (!$b64 || !$filename) {
        echo json_encode(['error' => 'Missing data or filename']);
        return;
    }

    $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $filename);

    $cacheDir = __DIR__ . '/../uploads/order_images';
    if (!is_dir($cacheDir)) mkdir($cacheDir, 0755, true);

    // Remove data:image/xxx;base64, prefix if present
    if (strpos($b64, 'base64,') !== false) {
        $b64 = explode('base64,', $b64)[1];
    }
    $imgData = base64_decode($b64);

    if (!$imgData || strlen($imgData) < 100) {
        echo json_encode(['error' => 'Invalid image data', 'size' => strlen($imgData ?? '')]);
        return;
    }

    $filepath = $cacheDir . '/' . $filename;
    file_put_contents($filepath, $imgData);

    $publicUrl = 'https://www.imporlan.cl/uploads/order_images/' . $filename;
    echo json_encode([
        'success' => true,
        'url' => $publicUrl,
        'size' => strlen($imgData),
        'filename' => $filename
    ]);
}

/**
 * Update an order_link's image_url to point to a cached copy.
 */
function updateLinkImage() {
    header('Content-Type: application/json');
    $linkId = intval($_POST['link_id'] ?? $_GET['link_id'] ?? 0);
    $newUrl = $_POST['new_url'] ?? $_GET['new_url'] ?? '';

    if (!$linkId || !$newUrl) {
        echo json_encode(['error' => 'Missing link_id or new_url']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE order_links SET image_url = ? WHERE id = ?");
        $stmt->execute([$newUrl, $linkId]);
        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        echo json_encode(['error' => 'DB error: ' . $e->getMessage()]);
    }
}

/**
 * Check cache status for all images in an order.
 */
function cacheStatus() {
    header('Content-Type: application/json');
    $orderId = intval($_GET['order_id'] ?? 0);

    if (!$orderId) {
        echo json_encode(['error' => 'Missing order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, row_index, url, image_url, title FROM order_links WHERE order_id = ? ORDER BY row_index ASC");
        $stmt->execute([$orderId]);
        $links = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $results = [];
        foreach ($links as $link) {
            $isCached = false;
            $source = 'unknown';
            $imageUrl = $link['image_url'] ?? '';

            if (strpos($imageUrl, 'imporlan.cl/uploads/') !== false) {
                $isCached = true;
            }

            if ($link['url']) {
                if (strpos($link['url'], 'facebook.com') !== false) {
                    $source = 'facebook';
                } elseif (strpos($link['url'], 'boattrader.com') !== false) {
                    $source = 'boattrader';
                }
            }

            $results[] = [
                'link_id' => $link['id'],
                'row_index' => $link['row_index'],
                'source' => $source,
                'cached' => $isCached,
                'image_url' => $imageUrl,
                'title' => $link['title'],
            ];
        }

        echo json_encode([
            'success' => true,
            'order_id' => $orderId,
            'total' => count($results),
            'cached' => count(array_filter($results, function($r) { return $r['cached']; })),
            'links' => $results
        ]);
    } catch (PDOException $e) {
        echo json_encode(['error' => 'DB error: ' . $e->getMessage()]);
    }
}
