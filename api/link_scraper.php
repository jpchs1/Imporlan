<?php
/**
 * Link Scraper API - Imporlan
 * Proxy endpoint to fetch metadata from boat listing URLs
 * Avoids CORS issues by fetching server-side
 * 
 * Endpoints:
 * - GET ?action=fetch&url=ENCODED_URL - Fetch metadata from a URL
 */

require_once __DIR__ . '/auth_helper.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'fetch':
        requireAdminAuthShared();
        fetchLinkMetadata();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida']);
}

function fetchLinkMetadata() {
    $url = $_GET['url'] ?? '';
    
    if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['error' => 'URL invalida']);
        return;
    }

    $allowedSchemes = ['http', 'https'];
    $parsedUrl = parse_url($url);
    if (!isset($parsedUrl['scheme']) || !in_array($parsedUrl['scheme'], $allowedSchemes)) {
        http_response_code(400);
        echo json_encode(['error' => 'Solo se permiten URLs HTTP/HTTPS']);
        return;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.5',
        ],
    ]);

    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error || $httpCode >= 400 || !$html) {
        http_response_code(502);
        echo json_encode(['error' => 'No se pudo acceder al link', 'details' => $error ?: "HTTP $httpCode"]);
        return;
    }

    $result = [
        'success' => true,
        'image_url' => null,
        'location' => null,
        'hours' => null,
        'value_usa_usd' => null,
        'title' => null,
    ];

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    $ogImage = $xpath->query('//meta[@property="og:image"]/@content');
    if ($ogImage->length > 0) {
        $result['image_url'] = $ogImage->item(0)->nodeValue;
    }
    if (!$result['image_url']) {
        $metaImage = $xpath->query('//meta[@name="twitter:image"]/@content');
        if ($metaImage->length > 0) {
            $result['image_url'] = $metaImage->item(0)->nodeValue;
        }
    }
    if (!$result['image_url']) {
        $imgs = $xpath->query('//img[contains(@class,"main") or contains(@class,"primary") or contains(@class,"hero") or contains(@class,"listing") or contains(@class,"boat") or contains(@id,"main")]/@src');
        if ($imgs->length > 0) {
            $result['image_url'] = $imgs->item(0)->nodeValue;
        }
    }
    if (!$result['image_url']) {
        $imgs = $xpath->query('//img[not(contains(@src,"logo")) and not(contains(@src,"icon")) and not(contains(@src,"sprite"))]/@src');
        if ($imgs->length > 0) {
            $imgSrc = $imgs->item(0)->nodeValue;
            if (strlen($imgSrc) > 10) {
                $result['image_url'] = $imgSrc;
            }
        }
    }

    if ($result['image_url'] && !preg_match('/^https?:\/\//', $result['image_url'])) {
        $base = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
        if (strpos($result['image_url'], '/') === 0) {
            $result['image_url'] = $base . $result['image_url'];
        } else {
            $result['image_url'] = $base . '/' . $result['image_url'];
        }
    }

    $ogTitle = $xpath->query('//meta[@property="og:title"]/@content');
    if ($ogTitle->length > 0) {
        $result['title'] = $ogTitle->item(0)->nodeValue;
    }
    if (!$result['title']) {
        $titleTag = $xpath->query('//title');
        if ($titleTag->length > 0) {
            $result['title'] = trim($titleTag->item(0)->textContent);
        }
    }

    $bodyText = $doc->textContent;

    if (preg_match('/(?:located?\s*(?:in|at|:)?\s*|location\s*:?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2})/i', $bodyText, $m)) {
        $result['location'] = trim($m[1]);
    }
    if (!$result['location']) {
        $locationEls = $xpath->query('//*[contains(@class,"location") or contains(@class,"city") or contains(@class,"address") or contains(@data-test,"location")]');
        if ($locationEls->length > 0) {
            $locText = trim($locationEls->item(0)->textContent);
            if (strlen($locText) < 100 && strlen($locText) > 2) {
                $result['location'] = $locText;
            }
        }
    }

    if (preg_match('/(\d[\d,\.]*)\s*(?:hours?|hrs?|engine\s*hours?|horas?)/i', $bodyText, $m)) {
        $result['hours'] = preg_replace('/[,\.]/', '', $m[1]);
    }
    $hoursEls = $xpath->query('//*[contains(@class,"hour") or contains(@data-test,"hour")]');
    if (!$result['hours'] && $hoursEls->length > 0) {
        $hText = trim($hoursEls->item(0)->textContent);
        if (preg_match('/(\d[\d,\.]*)/i', $hText, $m2)) {
            $result['hours'] = preg_replace('/[,\.]/', '', $m2[1]);
        }
    }

    if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)\b/', $bodyText, $m)) {
        $val = str_replace(',', '', $m[1]);
        if (floatval($val) > 100) {
            $result['value_usa_usd'] = floatval($val);
        }
    }
    $priceEls = $xpath->query('//*[contains(@class,"price") or contains(@class,"asking") or contains(@data-test,"price") or contains(@itemprop,"price")]');
    if (!$result['value_usa_usd'] && $priceEls->length > 0) {
        $pText = trim($priceEls->item(0)->textContent);
        if (preg_match('/\$?\s*([\d,]+(?:\.\d{1,2})?)/i', $pText, $m2)) {
            $val = str_replace(',', '', $m2[1]);
            if (floatval($val) > 100) {
                $result['value_usa_usd'] = floatval($val);
            }
        }
    }

    libxml_clear_errors();
    echo json_encode($result);
}
