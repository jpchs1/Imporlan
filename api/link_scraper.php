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

    $result = [
        'success' => true,
        'image_url' => null,
        'location' => null,
        'hours' => null,
        'value_usa_usd' => null,
        'title' => null,
    ];

    $html = directFetch($url);

    if ($html) {
        parseHtml($html, $url, $parsedUrl, $result);
    }

    $hasUsefulData = $result['image_url'] || $result['location'] || $result['hours'] || $result['value_usa_usd'];
    if (!$hasUsefulData) {
        fetchViaMicrolink($url, $result);
    }

    parseUrlPatterns($url, $parsedUrl, $result);

    echo json_encode($result);
}

function directFetch($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9,es;q=0.8',
            'sec-ch-ua: "Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile: ?0',
            'sec-ch-ua-platform: "Windows"',
            'sec-fetch-dest: document',
            'sec-fetch-mode: navigate',
            'sec-fetch-site: none',
            'sec-fetch-user: ?1',
            'upgrade-insecure-requests: 1',
            'Cache-Control: max-age=0',
        ],
    ]);

    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400 || !$html) {
        return null;
    }
    return $html;
}

function parseHtml($html, $url, $parsedUrl, &$result) {
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
        $ldJson = $xpath->query('//script[@type="application/ld+json"]');
        for ($i = 0; $i < $ldJson->length; $i++) {
            $jsonText = trim($ldJson->item($i)->textContent);
            $ld = @json_decode($jsonText, true);
            if ($ld) {
                $img = $ld['image'] ?? ($ld['@graph'][0]['image'] ?? null);
                if (is_string($img)) {
                    $result['image_url'] = $img;
                    break;
                }
                if (is_array($img)) {
                    $result['image_url'] = $img['url'] ?? ($img[0] ?? null);
                    if (is_array($result['image_url'])) $result['image_url'] = $result['image_url']['url'] ?? null;
                    if ($result['image_url']) break;
                }
            }
        }
    }
    if (!$result['image_url']) {
        $imgs = $xpath->query('//img[not(contains(@src,"logo")) and not(contains(@src,"icon")) and not(contains(@src,"sprite")) and not(contains(@src,"avatar"))]/@src');
        if ($imgs->length > 0) {
            $imgSrc = $imgs->item(0)->nodeValue;
            if (strlen($imgSrc) > 10) {
                $result['image_url'] = $imgSrc;
            }
        }
    }

    if ($result['image_url'] && !preg_match('/^https?:\/\//', $result['image_url'])) {
        $base = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
        $result['image_url'] = (strpos($result['image_url'], '/') === 0)
            ? $base . $result['image_url']
            : $base . '/' . $result['image_url'];
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
    extractFieldsFromText($bodyText, $xpath, $result);
    libxml_clear_errors();
}

function extractFieldsFromText($bodyText, $xpath, &$result) {
    if (!$result['location']) {
        if (preg_match('/(?:for\s+sale\s+in|located?\s*(?:in|at|:)?\s*|location\s*:?\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2}(?:\s+\d{5})?)/i', $bodyText, $m)) {
            $result['location'] = trim(preg_replace('/\s+\d{5}$/', '', $m[1]));
        }
    }
    if (!$result['location'] && $xpath) {
        $locationEls = $xpath->query('//*[contains(@class,"location") or contains(@class,"city") or contains(@class,"address") or contains(@data-test,"location")]');
        if ($locationEls->length > 0) {
            $locText = trim($locationEls->item(0)->textContent);
            if (strlen($locText) < 100 && strlen($locText) > 2) {
                $result['location'] = $locText;
            }
        }
    }

    if (!$result['hours']) {
        if (preg_match('/(\d[\d,\.]*)\s*(?:hours?|hrs?|engine\s*hours?|horas?)/i', $bodyText, $m)) {
            $result['hours'] = preg_replace('/[,\.]/', '', $m[1]);
        }
    }
    if (!$result['hours'] && $xpath) {
        $hoursEls = $xpath->query('//*[contains(@class,"hour") or contains(@data-test,"hour")]');
        if ($hoursEls->length > 0) {
            $hText = trim($hoursEls->item(0)->textContent);
            if (preg_match('/(\d[\d,\.]*)/i', $hText, $m2)) {
                $result['hours'] = preg_replace('/[,\.]/', '', $m2[1]);
            }
        }
    }

    if (!$result['value_usa_usd']) {
        if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)\b/', $bodyText, $m)) {
            $val = floatval(str_replace(',', '', $m[1]));
            if ($val > 100) $result['value_usa_usd'] = $val;
        }
    }
    if (!$result['value_usa_usd'] && $xpath) {
        $priceEls = $xpath->query('//*[contains(@class,"price") or contains(@class,"asking") or contains(@data-test,"price") or contains(@itemprop,"price")]');
        if ($priceEls->length > 0) {
            $pText = trim($priceEls->item(0)->textContent);
            if (preg_match('/\$?\s*([\d,]+(?:\.\d{1,2})?)/i', $pText, $m2)) {
                $val = floatval(str_replace(',', '', $m2[1]));
                if ($val > 100) $result['value_usa_usd'] = $val;
            }
        }
    }
}

function fetchViaMicrolink($url, &$result) {
    $mlUrl = 'https://api.microlink.io/?url=' . urlencode($url) . '&screenshot=true&meta=true';
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $mlUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) return;

    $data = @json_decode($resp, true);
    if (!$data || ($data['status'] ?? '') !== 'success') return;

    $d = $data['data'] ?? [];

    if (!$result['title'] && !empty($d['title'])) {
        $result['title'] = $d['title'];
    }

    if (!$result['image_url']) {
        $img = $d['image'] ?? null;
        if (is_array($img) && !empty($img['url'])) {
            $result['image_url'] = $img['url'];
        } elseif (is_string($img) && $img) {
            $result['image_url'] = $img;
        }
    }

    if (!$result['image_url']) {
        $ss = $d['screenshot'] ?? null;
        if (is_array($ss) && !empty($ss['url'])) {
            $result['image_url'] = $ss['url'];
        } elseif (is_string($ss) && $ss) {
            $result['image_url'] = $ss;
        }
    }

    $desc = $d['description'] ?? '';
    $fullText = ($d['title'] ?? '') . ' ' . $desc;
    if ($fullText) {
        extractFieldsFromText($fullText, null, $result);
    }
}

function parseUrlPatterns($url, $parsedUrl, &$result) {
    $host = strtolower($parsedUrl['host'] ?? '');
    $path = $parsedUrl['path'] ?? '';

    $boatSites = ['boattrader.com', 'boats.com', 'yachtworld.com', 'boat-alert.com', 'smartmarineguide.com', 'popyachts.com', 'boatcrazy.com'];
    $isBoatSite = false;
    foreach ($boatSites as $site) {
        if (strpos($host, $site) !== false) { $isBoatSite = true; break; }
    }

    if ($isBoatSite && preg_match('/(\d{4})-([a-z][\w-]*)-([a-z][\w-]*)/', $path, $m)) {
        $year = $m[1];
        $make = ucfirst(str_replace('-', ' ', $m[2]));
        $model = ucfirst(str_replace('-', ' ', $m[3]));
        if (!$result['title']) {
            $result['title'] = "$year $make $model";
        }
    }

    if (!$result['location'] && $result['title']) {
        $text = $result['title'] . ' ' . ($result['description'] ?? '');
        if (preg_match('/(?:for\s+sale\s+in|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2})/i', $text, $m)) {
            $result['location'] = trim($m[1]);
        }
    }
}
