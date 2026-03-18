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
        'description' => null,
        'engine' => null,
        'make' => null,
        'model' => null,
        'year' => null,
    ];

    $html = directFetch($url);

    if ($html) {
        parseHtml($html, $url, $parsedUrl, $result);
    }

    if ($result['image_url'] && !isUsefulImage($result['image_url'])) {
        $result['image_url'] = null;
    }

    $isFacebookMarketplace = preg_match('/facebook\.com\/marketplace\/item\//', $url);
    $hasGenericTitle = !$result['title'] || preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace|Log\s+in)\s*$/i', $result['title'] ?? '');
    if ($isFacebookMarketplace && (!$result['image_url'] || $hasGenericTitle)) {
        fetchFacebookMobile($url, $result);
    }

    // For BoatTrader/boats.com URLs, skip Microlink fallback since Cloudflare
    // redirects Microlink to a search page, returning wrong title/price data.
    // Instead, rely on URL pattern parsing which extracts year/make/model reliably.
    $host = strtolower($parsedUrl['host'] ?? '');
    $isBoatTraderUrl = (strpos($host, 'boattrader.com') !== false || strpos($host, 'boats.com') !== false);

    $hasUsefulData = $result['image_url'] || $result['location'] || $result['hours'] || $result['value_usa_usd'];
    if (!$hasUsefulData && !$isBoatTraderUrl) {
        fetchViaMicrolink($url, $result);
    }

    parseUrlPatterns($url, $parsedUrl, $result);

    if ($result['image_url'] && isVideoUrl($result['image_url'])) {
        $result['image_url'] = null;
    }

    // Plan B: When normal scraping fails to get enough data, try fallback methods
    $missingCount = countMissingFields($result);
    $config = loadScraperConfig();
    $threshold = intval($config['plan_b_threshold'] ?? 3);
    if ($missingCount >= $threshold) {
        executePlanB($url, $result, $config);
        // Re-run identity extraction with any new data from Plan B
        if (!$result['make'] || !$result['model'] || !$result['year']) {
            extractBoatIdentity($result);
        }
    }

    // Cache external images (Facebook CDN URLs expire) to permanent local copies
    if ($result['image_url'] && isExpiringImageUrl($result['image_url'])) {
        $cachedUrl = cacheImageLocally($result['image_url']);
        if ($cachedUrl) {
            $result['image_url'] = $cachedUrl;
        }
    }

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

    if (!$result['description']) {
        $ogDesc = $xpath->query('//meta[@property="og:description"]/@content');
        if ($ogDesc->length > 0) {
            $desc = html_entity_decode($ogDesc->item(0)->nodeValue);
            if ($desc && stripos($desc, 'log in') === false) {
                $result['description'] = $desc;
            }
        }
    }
    if (!$result['description']) {
        $metaDesc = $xpath->query('//meta[@name="description"]/@content');
        if ($metaDesc->length > 0) {
            $desc = trim($metaDesc->item(0)->nodeValue);
            if ($desc && stripos($desc, 'log in') === false) {
                $result['description'] = $desc;
            }
        }
    }

    $bodyText = $doc->textContent;
    extractFieldsFromText($bodyText, $xpath, $result);
    libxml_clear_errors();
}

function extractFieldsFromText($bodyText, $xpath, &$result) {
    if (!$result['location']) {
        if (preg_match('/(?:for\s+sale\s+in|located?\s*(?:in|at|:)?|location\s*:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})(?:\s+\d{5})?/i', $bodyText, $m)) {
            $result['location'] = trim($m[1]) . ', ' . strtoupper($m[2]);
        }
    }
    if (!$result['location']) {
        if (preg_match('/([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})(?:\s+\d{5})?/', $bodyText, $m)) {
            $result['location'] = $m[1] . ', ' . $m[2];
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
        // Priority 1: "engine hours" pattern (most specific)
        if (preg_match('/(\d[\d,\.]*)\s*(?:engine\s*hours?|engine\s*hrs?)/i', $bodyText, $m)) {
            $val = (int) preg_replace('/[,\.]/', '', $m[1]);
            if ($val >= 10 && $val <= 30000) $result['hours'] = (string) $val;
        }
    }
    if (!$result['hours']) {
        // Priority 2: "with X hours" pattern (common in FB descriptions)
        if (preg_match('/(?:with|has|only|approximately|approx|about)\s+(\d[\d,\.]*)\s*(?:hours?|hrs?|horas?)/i', $bodyText, $m)) {
            $val = (int) preg_replace('/[,\.]/', '', $m[1]);
            if ($val >= 10 && $val <= 30000) $result['hours'] = (string) $val;
        }
    }
    if (!$result['hours']) {
        // Priority 3: general "N hours" but require >= 2 digits to avoid "2 hours ago" timestamps
        if (preg_match('/\b(\d{2,5}[,\.]?\d*)\s*(?:hours?|hrs?|horas?)\b/i', $bodyText, $m)) {
            $val = (int) preg_replace('/[,\.]/', '', $m[1]);
            if ($val >= 10 && $val <= 30000) $result['hours'] = (string) $val;
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

    // Extract engine/motor info
    if (!isset($result['engine']) || !$result['engine']) {
        // Try structured elements first
        if ($xpath) {
            $engineEls = $xpath->query('//*[contains(@class,"engine") or contains(@class,"motor") or contains(@class,"propulsion") or contains(@data-test,"engine")]');
            if ($engineEls->length > 0) {
                $eText = trim($engineEls->item(0)->textContent);
                if (strlen($eText) > 2 && strlen($eText) < 300) {
                    $result['engine'] = $eText;
                }
            }
        }
    }
    if (!isset($result['engine']) || !$result['engine']) {
        // Common engine patterns: "Mercruiser 4.5L", "Yamaha F150", "Twin Mercury 300hp", etc.
        $enginePatterns = [
            // "4.3 MPI 220 hp motor" - specs before the word motor/engine (require 2+ digit hp to avoid false matches)
            '/((?:[\w\.\-]+\s+){0,4}\d{2,}\s*(?:hp|HP|cv|CV|kw|KW))\s+(?:motor|engine|outboard|inboard)\b/i',
            // "engine: Mercruiser 4.5L 220hp" - labeled with hp/L
            '/(?:engine|motor|propulsion|power(?:ed)?\s*by)[:\s]+([A-Z][\w\s\.\-\/]+(?:\d+\s*(?:hp|HP|cv|CV|L|ci|CI)))/i',
            // "Twin Mercury 300hp" - configuration + brand + power
            '/((?:twin|single|triple|quad|inboard|outboard|sterndrive|I\/O)\s+[A-Z][\w\s\.\-\/]+(?:\d+\s*(?:hp|HP|cv|CV|L)))/i',
            // Known brand names
            '/((?:Mercury|Mercruiser|Yamaha|Honda|Suzuki|Evinrude|Johnson|Volvo\s*Penta|Caterpillar|Cummins|Yanmar|Tohatsu|Verado|Optimax|EFI|HPDI)\s+[\w\.\-\/]+(?:\s+[\w\.\-\/]+){0,4})/i',
            // Generic "motor: XYZ" - limited to 6 words
            '/(?:engine|motor|propulsion)[:\s]+([A-Z][\w\.\-\/]+(?:\s+[\w\.\-\/]+){0,5})/i',
        ];
        foreach ($enginePatterns as $pat) {
            if (preg_match($pat, $bodyText, $em)) {
                $engineVal = trim($em[1]);
                $engineVal = preg_replace('/\s{2,}/', ' ', $engineVal);
                // Strip leading articles/prepositions: "with a 4.3 MPI" -> "4.3 MPI"
                $engineVal = preg_replace('/^(?:with\s+(?:an?\s+)?|an?\s+)/i', '', $engineVal);
                // Truncate at sentence boundaries (period+space+uppercase, or ! or ?)
                // Use lookbehind to avoid matching decimal points like "4.3"
                $engineVal = preg_replace('/\.\s+(?=[A-Z])|[!\?].*$/', '', $engineVal);
                // Remove hours references from engine text
                $engineVal = preg_replace('/\s*(?:with\s+)?\d+\s*(?:hours?|hrs?|horas?).*$/i', '', $engineVal);
                // Remove trailing descriptive phrases
                $engineVal = preg_replace('/\s*(?:boat|has been|comes with|garage|kept|trailer|cover|included).*$/i', '', $engineVal);
                $engineVal = rtrim($engineVal, ' .,;:-');
                if (strlen($engineVal) >= 3 && strlen($engineVal) <= 120) {
                    $result['engine'] = $engineVal;
                    break;
                }
            }
        }
    }

    if (!$result['value_usa_usd']) {
        if (preg_match('/(?:price|asking|sale|USD|\$)\s*:?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/', $bodyText, $m)) {
            $val = floatval(str_replace(',', '', $m[1]));
            if ($val >= 500 && $val < 50000000) $result['value_usa_usd'] = $val;
        }
    }
    if (!$result['value_usa_usd']) {
        if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)/', $bodyText, $m)) {
            $val = floatval(str_replace(',', '', $m[1]));
            if ($val >= 500 && $val < 50000000) $result['value_usa_usd'] = $val;
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

function callMicrolink($url, $extraParams = '') {
    $mlUrl = 'https://api.microlink.io/?url=' . urlencode($url) . '&meta=true' . $extraParams;
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
    if ($httpCode !== 200 || !$resp) return null;
    $data = @json_decode($resp, true);
    if (!$data || ($data['status'] ?? '') !== 'success') return null;
    return $data['data'] ?? [];
}

function isVideoUrl($url) {
    if (!$url) return false;
    $lower = strtolower($url);
    $videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'tiktok.com', 'twitch.tv', 'wistia.com'];
    foreach ($videoDomains as $domain) {
        if (strpos($lower, $domain) !== false) return true;
    }
    if (preg_match('/\/watch\?/', $lower)) return true;
    return false;
}

function isUsefulImage($imgUrl) {
    if (!$imgUrl) return false;
    $lower = strtolower($imgUrl);
    if (preg_match('/\.(svg|ico)(\?|$)/', $lower)) return false;
    if (preg_match('/(logo|favicon|icon|sprite|avatar|badge)/i', $lower)) return false;
    if (isVideoUrl($imgUrl)) return false;
    if (preg_match('/static\.xx\.fbcdn\.net\/rsrc/', $lower)) return false;
    if (preg_match('/fbcdn\.net.*\/rsrc\.php/', $lower)) return false;
    return true;
}

/**
 * Check if an image URL is from a CDN that uses expiring tokens (Facebook, etc.)
 */
function isExpiringImageUrl($url) {
    if (!$url) return false;
    $lower = strtolower($url);
    // Facebook CDN URLs contain tokens that expire after hours/days
    if (strpos($lower, 'fbcdn.net') !== false) return true;
    if (strpos($lower, 'facebook.com') !== false && strpos($lower, '/v/') !== false) return true;
    return false;
}

/**
 * Download an external image and save it locally to prevent CDN expiration.
 * Returns the permanent local URL or null on failure.
 */
function cacheImageLocally($imageUrl) {
    $cacheDir = __DIR__ . '/../uploads/order_images';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    if (!is_dir($cacheDir) || !is_writable($cacheDir)) {
        return null;
    }

    // Use URL hash as filename to avoid duplicates
    $hash = md5($imageUrl);
    $filename = 'cache_' . $hash . '.jpg';
    $filepath = $cacheDir . '/' . $filename;

    // If already cached, return the local URL
    if (file_exists($filepath) && filesize($filepath) > 500) {
        return 'https://www.imporlan.cl/uploads/order_images/' . $filename;
    }

    // Download the image via curl (supports redirects, FB CDN tokens)
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => html_entity_decode($imageUrl),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ]);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    // Validate response
    if ($httpCode !== 200 || !$data || strlen($data) < 500) {
        return null;
    }

    // Verify it's actually an image (check content type or magic bytes)
    $isImage = false;
    if ($contentType && preg_match('/^image\//i', $contentType)) {
        $isImage = true;
    }
    if (!$isImage) {
        // Check magic bytes: JPEG (FFD8FF), PNG (89504E47), WEBP (52494646...57454250)
        $header = substr($data, 0, 12);
        if (substr($header, 0, 3) === "\xFF\xD8\xFF" ||
            substr($header, 0, 4) === "\x89PNG" ||
            (substr($header, 0, 4) === "RIFF" && substr($header, 8, 4) === "WEBP")) {
            $isImage = true;
        }
    }
    if (!$isImage) {
        return null;
    }

    // Save to disk
    if (@file_put_contents($filepath, $data) === false) {
        return null;
    }

    return 'https://www.imporlan.cl/uploads/order_images/' . $filename;
}

function fetchFacebookMobile($url, &$result) {
    $mobileUrl = str_replace('www.facebook.com', 'm.facebook.com', $url);
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $mobileUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
        ],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400 || !$html || strlen($html) < 500) return;

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    $ogImage = $xpath->query('//meta[@property="og:image"]/@content');
    if ($ogImage->length > 0) {
        $imgUrl = html_entity_decode($ogImage->item(0)->nodeValue);
        if (isUsefulImage($imgUrl)) {
            $result['image_url'] = $imgUrl;
        }
    }

    // Replace generic titles ("Facebook", "Marketplace") with actual listing title
    $currentTitleIsGeneric = !$result['title'] || preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace|Log\s+in)\s*$/i', $result['title'] ?? '');
    if ($currentTitleIsGeneric) {
        $ogTitle = $xpath->query('//meta[@property="og:title"]/@content');
        if ($ogTitle->length > 0) {
            $title = trim($ogTitle->item(0)->nodeValue);
            if ($title && stripos($title, 'log in') === false && !preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace)\s*$/i', $title)) {
                $result['title'] = $title;
            }
        }
        if (!$result['title'] || preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace)\s*$/i', $result['title'] ?? '')) {
            $titleTag = $xpath->query('//title');
            if ($titleTag->length > 0) {
                $title = trim($titleTag->item(0)->textContent);
                if ($title && stripos($title, 'log in') === false && !preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace)\s*$/i', $title)) {
                    $result['title'] = $title;
                }
            }
        }
    }

    $ogDesc = $xpath->query('//meta[@property="og:description"]/@content');
    if ($ogDesc->length > 0) {
        $desc = html_entity_decode($ogDesc->item(0)->nodeValue);
        if ($desc && stripos($desc, 'log in') === false) {
            if (!$result['description']) {
                $result['description'] = $desc;
            }
            if (!$result['value_usa_usd']) {
                if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)/', $desc, $pm)) {
                    $val = floatval(str_replace(',', '', $pm[1]));
                    if ($val >= 500 && $val < 50000000) {
                        $result['value_usa_usd'] = $val;
                    }
                }
            }
            extractFieldsFromText($desc, null, $result);
        }
    }

    libxml_clear_errors();
}

function fetchViaMicrolink($url, &$result) {
    $customParams = '&data.price.selector=' . urlencode("[class*=price],[data-e2e=price],.asking-price,.boat-price")
        . '&data.price.type=text'
        . '&data.pageText.selector=body&data.pageText.type=text';

    $d = callMicrolink($url, $customParams);
    if (!$d) return;

    if (!$result['title'] && !empty($d['title'])) {
        $result['title'] = $d['title'];
    }

    $pageText = $d['pageText'] ?? '';

    if (!$result['image_url'] && $pageText) {
        $productImg = extractProductImage($pageText);
        if ($productImg) {
            $result['image_url'] = $productImg;
        }
    }

    if (!$result['image_url']) {
        $img = $d['image'] ?? null;
        $imgUrl = null;
        if (is_array($img) && !empty($img['url'])) {
            $imgUrl = $img['url'];
        } elseif (is_string($img) && $img) {
            $imgUrl = $img;
        }
        if ($imgUrl && isUsefulImage($imgUrl) && !isScreenshotUrl($imgUrl)) {
            $result['image_url'] = $imgUrl;
        }
    }

    if (!$result['value_usa_usd']) {
        $priceText = $d['price'] ?? '';
        if ($priceText && preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)/', $priceText, $pm)) {
            $val = floatval(str_replace(',', '', $pm[1]));
            if ($val >= 500 && $val < 50000000) {
                $result['value_usa_usd'] = $val;
            }
        }
    }

    if ($pageText && (!$result['hours'] || !$result['value_usa_usd'] || !$result['location'])) {
        $cleanText = strip_tags($pageText);
        if (!$result['hours']) {
            if (preg_match('/Engine\s*Hours\s*(\d[\d,]*)/i', $cleanText, $hm)) {
                $result['hours'] = preg_replace('/,/', '', $hm[1]);
            }
        }
        if (!$result['value_usa_usd']) {
            if (preg_match('/available for sale at \$([\d,]+(?:\.\d{1,2})?)/i', $cleanText, $pm)) {
                $val = floatval(str_replace(',', '', $pm[1]));
                if ($val >= 500 && $val < 50000000) $result['value_usa_usd'] = $val;
            }
        }
    }

    $desc = $d['description'] ?? '';
    if ($desc && !$result['description']) {
        $result['description'] = $desc;
    }
    if (!$result['value_usa_usd'] && $desc) {
        if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)/', $desc, $pm)) {
            $val = floatval(str_replace(',', '', $pm[1]));
            if ($val >= 500 && $val < 50000000) $result['value_usa_usd'] = $val;
        }
    }

    $fullText = ($d['title'] ?? '') . ' ' . ($d['description'] ?? '');
    if ($fullText) {
        extractFieldsFromText($fullText, null, $result);
    }
}

function extractProductImage($html) {
    $boatImageDomains = [
        'images.boattrader.com',
        'images.boatsgroup.com',
        'images.yachtworld.com',
        'images.boats.com',
    ];
    foreach ($boatImageDomains as $domain) {
        if (preg_match('/https?:\/\/' . preg_quote($domain, '/') . '\/resize\/[^\s"<>\']+_LARGE\.[a-z]+/i', $html, $m)) {
            return html_entity_decode($m[0]);
        }
    }
    foreach ($boatImageDomains as $domain) {
        if (preg_match('/https?:\/\/' . preg_quote($domain, '/') . '\/resize\/[^\s"<>\'&]+/i', $html, $m)) {
            return html_entity_decode($m[0]);
        }
    }
    if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
        if (isUsefulImage($m[1])) return $m[1];
    }
    if (preg_match('/<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
        if (isUsefulImage($m[1])) return $m[1];
    }
    if (preg_match_all('/<script[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/si', $html, $matches)) {
        foreach ($matches[1] as $jsonText) {
            $ld = @json_decode(trim($jsonText), true);
            if (!$ld || !isset($ld['@type'])) continue;
            if ($ld['@type'] === 'Product') {
                $img = $ld['image'] ?? null;
                if (is_string($img) && strlen($img) > 10) return $img;
                if (is_array($img) && !empty($img['url'])) return $img['url'];
                if (is_array($img) && isset($img[0])) {
                    return is_string($img[0]) ? $img[0] : ($img[0]['url'] ?? null);
                }
            }
        }
    }
    return null;
}

function isScreenshotUrl($url) {
    if (!$url) return false;
    return (bool)preg_match('/microlink\.io\//i', $url);
}

/**
 * Extract make, model, year from title and description text.
 * Works for any source: Facebook Marketplace, Craigslist, generic listings, etc.
 * Uses known boat brand names to identify make, then extracts model and year.
 */
function extractBoatIdentity(&$result) {
    // Skip if all three are already set
    if ($result['make'] && $result['model'] && $result['year']) return;

    // Prepare text sources: title alone (clean, structured) and combined (for fallback)
    $titleText = trim($result['title'] ?? '');
    $descText = trim($result['description'] ?? '');
    if (!$titleText && !$descText) return;

    // Decode HTML entities (Facebook returns &#039; etc.) and normalize whitespace
    $titleText = preg_replace('/\s+/', ' ', html_entity_decode($titleText, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $descText = preg_replace('/\s+/', ' ', html_entity_decode($descText, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $text = trim($titleText . ' ' . $descText);
    if (strlen($text) < 5) return;

    // Known boat brands for matching
    $brands = [
        'Sea Ray', 'Chaparral', 'Cobalt', 'Monterey', 'Yamaha', 'MasterCraft',
        'Malibu', 'Bayliner', 'Boston Whaler', 'Grady-White', 'Grady White',
        'Robalo', 'Wellcraft', 'Four Winns', 'Regal', 'Stingray', 'Tracker',
        'Ranger', 'Bennington', 'Pontoon', 'Crestliner', 'Lund', 'Skeeter',
        'Nitro', 'Triton', 'Scout', 'Sailfish', 'Sportsman', 'Key West',
        'Carolina Skiff', 'Tidewater', 'Nautic Star', 'NauticStar', 'Cobia',
        'Everglades', 'Pursuit', 'Regulator', 'Yellowfin', 'Hydra-Sports',
        'Hurricane', 'Starcraft', 'Glastron', 'Larson', 'Rinker', 'Crownline',
        'Tahoe', 'Sun Tracker', 'Bass Tracker', 'Centurion', 'Tige', 'Axis',
        'Scarab', 'Heyday', 'Supra', 'Moomba', 'Nautique', 'Correct Craft',
        'Chris-Craft', 'Chris Craft', 'Lowe', 'Alumacraft', 'G3', 'Vexus',
        'Phoenix', 'Xpress', 'War Eagle', 'Blazer', 'Excel', 'Pathfinder',
        'Maverick', 'Hewes', 'Blue Wave', 'Sea Fox', 'Sea Hunt', 'Sea Pro',
        'Sweetwater', 'Godfrey', 'Sylvan', 'Berkshire', 'South Bay',
        'Manitou', 'Harris', 'Princecraft', 'Sun Catcher',
        'Misty Harbor', 'Avalon', 'Lexington', 'Crest', 'Veranda',
        'Caymas', 'Seavee', 'Contender', 'Blackfin', 'Century',
        'Parker', 'Bertram', 'Viking', 'Hatteras', 'Cabo', 'Riviera',
        'Prestige', 'Jeanneau', 'Beneteau', 'Catalina', 'Hunter',
        'Leopard', 'Lagoon', 'Fountaine Pajot', 'Bavaria', 'Dufour',
    ];

    $brandsPattern = implode('|', array_map(function($b) {
        return preg_quote($b, '/');
    }, $brands));

    // Boat type words that are NOT model names
    $boatTypes = ['bowrider', 'pontoon', 'cruiser', 'runabout', 'skiff', 'cabin',
        'cuddy', 'trawler', 'sailboat', 'catamaran', 'kayak', 'dinghy', 'yacht',
        'houseboat', 'airboat', 'jon', 'bass', 'flats', 'bay', 'offshore',
        'walkaround', 'convertible', 'express', 'sedan', 'flybridge', 'sportfish',
        'center', 'console', 'dual', 'fish', 'ski', 'wakeboard', 'surf', 'sport'];

    // Helper: clean raw model text into just the core model identifier
    $cleanModel = function($raw, $make) use ($boatTypes, $text) {
        $m = trim($raw);
        // Remove parenthetical specs like (260 HP - 21 FT)
        $m = preg_replace('/\s*\(.*\)\s*/', ' ', $m);
        // Remove foot/inch marks (21' → 21)
        $m = preg_replace("/[\x{2019}'\x{2032}\x{2018}]/u", '', $m);
        // Remove leading bare boat-length numbers (e.g. "21 " at start)
        $m = preg_replace('/^\d{1,2}\s+/', '', $m);
        // Remove duplicate brand name AFTER length removal (brand may appear after length)
        if ($make) {
            $m = preg_replace('/^' . preg_quote($make, '/') . '\s*/i', '', $m);
        }
        // Remove dollar amounts and everything after
        $m = preg_replace('/\s*\$[\d,]+.*$/', '', $m);
        // Remove common trailing descriptive phrases
        $m = preg_replace('/\s+(?:for\s+sale|located?\s+in|in\s+[A-Z]{2}\b).*$/i', '', $m);
        // Remove tokens that are actually hours (number followed by "hours/hrs" in original text)
        $m = preg_replace_callback('/\b(\d+)\b/', function($match) use ($text) {
            $num = $match[1];
            // If this number is followed by "hours/hrs" in the full text, it's hours not model
            if (preg_match('/\b' . preg_quote($num, '/') . '\s*(?:hours?|hrs?|horas?)\b/i', $text)) {
                return '';
            }
            return $num;
        }, $m);
        $m = preg_replace('/\s+/', ' ', trim($m, " .,;:-\t\n\r"));
        // Keep only core model code tokens (tokens with digits, or short uppercase prefixes)
        // Stop at purely descriptive words
        $words = preg_split('/\s+/', $m);
        $kept = [];
        foreach ($words as $w) {
            if ($w === '') continue;
            // Skip boat type words
            if (in_array(strtolower($w), $boatTypes)) {
                if (empty($kept)) continue; // skip if at start
                else break; // stop if after model code
            }
            if (preg_match('/\d/', $w)) {
                // Contains a digit - likely model code (H20, GX215, 250, SPX210)
                $kept[] = $w;
            } elseif (empty($kept)) {
                // First word can be alpha prefix (e.g. "SPX", "SLX")
                $kept[] = $w;
            } elseif (strlen($w) <= 3 && ctype_upper($w)) {
                // Short uppercase codes like "SS", "LS"
                $kept[] = $w;
            } else {
                // Descriptive word - stop
                break;
            }
        }
        $m = implode(' ', $kept);
        // Validate: a real model code should contain at least one digit (H20, GX215, SPX 210)
        // Pure-alpha words like "that", "beautiful" are not models
        if (!preg_match('/\d/', $m)) return '';
        return (strlen($m) >= 1 && strlen($m) <= 50) ? $m : '';
    };

    // Try patterns on title first (structured, clean), then combined text as fallback
    $sources = [$titleText];
    if ($descText) $sources[] = $text;

    // Pattern 1: "YEAR MAKE MODEL" (e.g. "2019 Chaparral 23 H2O Sport", "2018 Sea Ray SPX 210")
    if (!$result['year'] || !$result['make']) {
        foreach ($sources as $src) {
            if (preg_match('/\b((?:19|20)\d{2})\s+(' . $brandsPattern . ')\s+(.+)/i', $src, $m)) {
                if (!$result['year']) $result['year'] = intval($m[1]);
                if (!$result['make']) $result['make'] = trim($m[2]);
                if (!$result['model']) {
                    $model = $cleanModel($m[3], $result['make']);
                    if ($model) $result['model'] = $model;
                }
                break;
            }
        }
    }

    // Pattern 2: "MAKE MODEL YEAR" (e.g. "Chaparral 23 H2O 2019")
    if (!$result['year'] || !$result['make']) {
        foreach ($sources as $src) {
            if (preg_match('/\b(' . $brandsPattern . ')\s+(.+?)\s+((?:19|20)\d{2})\b/i', $src, $m)) {
                if (!$result['make']) $result['make'] = trim($m[1]);
                if (!$result['model']) {
                    $model = $cleanModel($m[2], $result['make']);
                    if ($model) $result['model'] = $model;
                }
                if (!$result['year']) $result['year'] = intval($m[3]);
                break;
            }
        }
    }

    // Pattern 3: Just "YEAR MAKE" without model (e.g. "2015 Cobalt")
    if (!$result['year'] || !$result['make']) {
        if (preg_match('/\b((?:19|20)\d{2})\s+(' . $brandsPattern . ')\b/i', $text, $m)) {
            if (!$result['year']) $result['year'] = intval($m[1]);
            if (!$result['make']) $result['make'] = trim($m[2]);
        }
    }

    // Pattern 4: Just "MAKE" + model-like text (e.g. "Glastron GX215" without year nearby)
    if (!$result['make']) {
        foreach ($sources as $src) {
            if (preg_match('/\b(' . $brandsPattern . ')\s+([A-Z0-9][\w\s\-\/\.]{0,30})/i', $src, $m)) {
                $result['make'] = trim($m[1]);
                if (!$result['model']) {
                    $model = $cleanModel($m[2], $result['make']);
                    if ($model) $result['model'] = $model;
                }
                break;
            }
        }
    }

    // Pattern 5: Extract year from text if still missing (standalone 4-digit year near boat context)
    if (!$result['year']) {
        if (preg_match('/\b((?:19|20)\d{2})\s+(?:boat|lancha|embarcacion|bowrider|cruiser|pontoon|deck\s*boat|center\s*console|ski\s*boat|wake\s*boat|fishing\s*boat)/i', $text, $m)) {
            $result['year'] = intval($m[1]);
        }
    }

    // Pattern 6: Any standalone year (1990-2029) if we found a make but still no year
    if (!$result['year'] && $result['make']) {
        if (preg_match('/\b((?:19|20)\d{2})\b/', $text, $m)) {
            $yr = intval($m[1]);
            if ($yr >= 1990 && $yr <= intval(date('Y')) + 2) {
                $result['year'] = $yr;
            }
        }
    }

    // Also try to extract hours from description if not already found
    // This helps with Facebook Marketplace listings where hours are in the description
    if (!$result['hours']) {
        $hoursPatterns = [
            '/(\d[\d,]*)\s*(?:(?:engine|motor)\s+)?hours?\b/i',
            '/hours?\s*:?\s*(\d[\d,]*)/i',
            '/(\d[\d,]*)\s*hrs?\b/i',
            '/(\d[\d,]*)\s*horas?\b/i',
            '/(?:engine|motor)\s*hours?\s*:?\s*(\d[\d,]*)/i',
            '/(?:hours?|hrs?)\s*(?:on\s+(?:engine|motor))?\s*:?\s*(\d[\d,]*)/i',
            '/(\d[\d,]*)\s*(?:original\s+)?hours?\s+(?:on|of\s+use)/i',
        ];
        foreach ($hoursPatterns as $pat) {
            if (preg_match($pat, $text, $hm)) {
                $hours = preg_replace('/,/', '', $hm[1]);
                $hoursInt = intval($hours);
                // Sanity check: hours should be between 1 and 30000
                if ($hoursInt >= 1 && $hoursInt <= 30000) {
                    $result['hours'] = $hours;
                    break;
                }
            }
        }
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
        $urlTitle = "$year $make $model";
        // Always prefer URL-extracted title for boat sites: Microlink may return
        // wrong titles from redirected search pages when Cloudflare blocks access.
        if (!$result['title'] || preg_match('/boats?\s+for\s+sale/i', $result['title'])) {
            $result['title'] = $urlTitle;
        }
    }

    // Extract make, model, year from title/description for any source (Facebook, etc.)
    // Run brand-list-aware extraction BEFORE URL fallback for better accuracy
    extractBoatIdentity($result);

    // URL-based extraction as fallback only if extractBoatIdentity didn't fill the fields
    if ($isBoatSite && isset($make, $model, $year)) {
        if (!$result['make']) $result['make'] = $make;
        if (!$result['model']) $result['model'] = $model;
        if (!$result['year']) $result['year'] = intval($year);
    }

    if (!$result['location'] && $result['title']) {
        $text = $result['title'] . ' ' . ($result['description'] ?? '');
        if (preg_match('/(?:for\s+sale\s+in|located?\s+in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/i', $text, $m)) {
            $result['location'] = trim($m[1]) . ', ' . strtoupper($m[2]);
        }
    }
}

// ============================================================================
// PLAN B: Fallback scraping when normal methods fail
// ============================================================================

/**
 * Load scraper configuration (API keys for Plan B services).
 * Returns cached config array or empty array if no config file exists.
 */
function loadScraperConfig() {
    static $config = null;
    if ($config !== null) return $config;
    $configFile = __DIR__ . '/scraper_config.php';
    if (file_exists($configFile)) {
        $config = require $configFile;
        if (!is_array($config)) $config = [];
    } else {
        $config = [];
    }
    return $config;
}

/**
 * Count how many key fields are missing from the result.
 * Used to decide whether to trigger Plan B.
 */
function countMissingFields($result) {
    $count = 0;
    if (!$result['image_url']) $count++;
    if (!$result['title'] || preg_match('/^\s*(Facebook|Marketplace|Facebook\s+Marketplace|Log\s+in)\s*$/i', $result['title'] ?? '')) $count++;
    if (!$result['make']) $count++;
    if (!$result['model']) $count++;
    if (!$result['year']) $count++;
    if (!$result['hours']) $count++;
    if (!isset($result['engine']) || !$result['engine']) $count++;
    if (!$result['value_usa_usd']) $count++;
    if (!$result['location']) $count++;
    return $count;
}

/**
 * Execute Plan B fallback chain.
 * Level 1: ScrapingBee headless browser rendering
 * Level 2: Screenshot + OpenAI Vision AI extraction
 */
function executePlanB($url, &$result, $config) {
    $result['plan_b'] = [];

    // Level 1: ScrapingBee - render the page with a real headless browser
    $scrapingBeeKey = trim($config['scrapingbee_api_key'] ?? '');
    if ($scrapingBeeKey) {
        $beforeMissing = countMissingFields($result);
        planBScrapingBee($url, $result, $scrapingBeeKey, $config);
        $afterMissing = countMissingFields($result);
        $result['plan_b'][] = [
            'level' => 1,
            'method' => 'scrapingbee',
            'fields_recovered' => $beforeMissing - $afterMissing,
        ];
        // If we recovered enough data, skip Level 2
        if ($afterMissing < intval($config['plan_b_threshold'] ?? 3)) {
            return;
        }
    }

    // Level 2: Screenshot + AI Vision
    $openaiKey = trim($config['openai_api_key'] ?? '');
    if ($openaiKey) {
        $beforeMissing = countMissingFields($result);
        planBScreenshotAI($url, $result, $config);
        $afterMissing = countMissingFields($result);
        $result['plan_b'][] = [
            'level' => 2,
            'method' => 'screenshot_ai',
            'fields_recovered' => $beforeMissing - $afterMissing,
        ];
    }
}

/**
 * Build a cookie string for Facebook session authentication.
 * ScrapingBee accepts cookies as a semicolon-separated string: "name1=value1;name2=value2"
 * Returns null if no Facebook cookies are configured.
 */
function buildFacebookCookieString($config) {
    $fbCookies = $config['facebook_cookies'] ?? [];
    if (!is_array($fbCookies) || empty($fbCookies)) return null;

    $cUser = trim($fbCookies['c_user'] ?? '');
    $xs = trim($fbCookies['xs'] ?? '');
    $datr = trim($fbCookies['datr'] ?? '');

    // At minimum we need c_user and xs for a valid session
    if (!$cUser || !$xs) return null;

    $parts = [];
    $parts[] = 'c_user=' . $cUser;
    $parts[] = 'xs=' . $xs;
    if ($datr) {
        $parts[] = 'datr=' . $datr;
    }

    return implode(';', $parts);
}

/**
 * Plan B Level 1: Use ScrapingBee to render the page with a real headless browser.
 * ScrapingBee handles JavaScript rendering, cookies, and can use premium proxies
 * to bypass blocks from sites like Facebook.
 */
function planBScrapingBee($url, &$result, $apiKey, $config = []) {
    // Only use premium proxies for domains that block basic requests (Facebook, etc.)
    $isFacebook = (bool) preg_match('/facebook\.com/i', $url);
    $usePremium = $isFacebook || (bool) preg_match('/instagram\.com|craigslist\.org/i', $url);

    $params = [
        'api_key' => $apiKey,
        'url' => $url,
        'render_js' => 'true',
        'premium_proxy' => $usePremium ? 'true' : 'false',
        'block_ads' => 'true',
        'block_resources' => 'false',
        'wait' => '3000',
    ];

    // Pass Facebook session cookies for authenticated access to Marketplace
    if ($isFacebook) {
        $fbCookies = buildFacebookCookieString($config);
        if ($fbCookies) {
            $params['cookies'] = $fbCookies;
        }
    }

    $sbUrl = 'https://app.scrapingbee.com/api/v1/?' . http_build_query($params);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $sbUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$html || strlen($html) < 500) return;

    // Parse the rendered HTML with existing extraction functions
    $parsedUrl = parse_url($url);
    parseHtml($html, $url, $parsedUrl, $result);

    // Also try to extract from og:description if available
    if ($result['description']) {
        extractFieldsFromText($result['description'], null, $result);
    }
}

/**
 * Plan B Level 2: Take a screenshot of the page and use OpenAI Vision to extract data.
 * Uses ScrapingBee screenshot (if key available) or Microlink screenshot (free).
 * Then sends the screenshot to GPT-4o Vision for structured data extraction.
 */
function planBScreenshotAI($url, &$result, $config) {
    $openaiKey = trim($config['openai_api_key'] ?? '');
    if (!$openaiKey) return;

    // Step 1: Get a screenshot of the page
    $screenshotUrl = null;

    // Try ScrapingBee screenshot first (better for JS-heavy pages)
    $sbKey = trim($config['scrapingbee_api_key'] ?? '');
    if ($sbKey) {
        $screenshotUrl = getScrapingBeeScreenshot($url, $sbKey, $config);
    }

    // Fallback to Microlink screenshot (free, no API key needed)
    if (!$screenshotUrl) {
        $screenshotUrl = getMicrolinkScreenshot($url);
    }

    if (!$screenshotUrl) return;

    // Step 2: Send screenshot to OpenAI Vision API for analysis
    $aiData = analyzeScreenshotWithAI($screenshotUrl, $openaiKey);
    if (!$aiData || !is_array($aiData)) return;

    // Step 3: Merge AI-extracted data into result (only fill empty fields)
    mergeAIResults($aiData, $result);
}

/**
 * Get a screenshot URL using ScrapingBee's screenshot feature.
 */
function getScrapingBeeScreenshot($url, $apiKey, $config = []) {
    $isFacebook = (bool) preg_match('/facebook\.com/i', $url);
    $usePremium = $isFacebook || (bool) preg_match('/instagram\.com|craigslist\.org/i', $url);

    $params = [
        'api_key' => $apiKey,
        'url' => $url,
        'screenshot' => 'true',
        'screenshot_full_page' => 'false',
        'render_js' => 'true',
        'premium_proxy' => $usePremium ? 'true' : 'false',
        'wait' => '3000',
        'window_width' => '1280',
        'window_height' => '900',
    ];

    // Pass Facebook session cookies for authenticated screenshots
    if ($isFacebook) {
        $fbCookies = buildFacebookCookieString($config);
        if ($fbCookies) {
            $params['cookies'] = $fbCookies;
        }
    }

    $sbUrl = 'https://app.scrapingbee.com/api/v1/?' . http_build_query($params);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $sbUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $imageData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpCode !== 200 || !$imageData || strlen($imageData) < 1000) return null;

    // Validate that the response is actually an image (not an error page)
    $isImage = false;
    if ($contentType && preg_match('/^image\//i', $contentType)) {
        $isImage = true;
    }
    if (!$isImage) {
        $header = substr($imageData, 0, 12);
        if (substr($header, 0, 3) === "\xFF\xD8\xFF" ||
            substr($header, 0, 4) === "\x89PNG" ||
            (substr($header, 0, 4) === "RIFF" && substr($header, 8, 4) === "WEBP")) {
            $isImage = true;
        }
    }
    if (!$isImage) return null;

    // Save image locally and return URL
    $cacheDir = __DIR__ . '/../uploads/order_images';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    if (!is_dir($cacheDir) || !is_writable($cacheDir)) return null;

    $hash = md5($url . '_planb_screenshot');
    $filename = 'screenshot_' . $hash . '.png';
    $filepath = $cacheDir . '/' . $filename;

    if (@file_put_contents($filepath, $imageData) === false) return null;

    // Build URL from server context (works in both test and production)
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'www.imporlan.cl';
    return $protocol . '://' . $host . '/uploads/order_images/' . $filename;
}

/**
 * Get a screenshot URL using Microlink API (free, no API key needed).
 */
function getMicrolinkScreenshot($url) {
    $mlUrl = 'https://api.microlink.io/?url=' . urlencode($url)
        . '&screenshot=true&meta=false&embed=screenshot.url'
        . '&viewport.width=1280&viewport.height=900&waitForTimeout=3000';

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $mlUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) return null;
    $data = @json_decode($resp, true);
    if (!$data || ($data['status'] ?? '') !== 'success') return null;

    return $data['data']['screenshot']['url'] ?? null;
}

/**
 * Send a screenshot to OpenAI GPT-4o Vision API and extract structured boat listing data.
 * Returns an associative array with extracted fields or null on failure.
 */
function analyzeScreenshotWithAI($screenshotUrl, $apiKey) {
    $systemPrompt = <<<'PROMPT'
You are a data extraction assistant specialized in boat/marine vessel listings.
Extract all available information from the screenshot of a boat listing page.
Return ONLY a valid JSON object with these fields (use null for fields you cannot determine):
{
  "title": "Full listing title",
  "make": "Boat manufacturer/brand name",
  "model": "Model name/number (alphanumeric code like H2O, GX215, SPX 210)",
  "year": 2020,
  "hours": 290,
  "engine": "Engine/motor specs (e.g. 4.3 MPI 220 hp, Yamaha F150)",
  "price": 25000,
  "currency": "USD",
  "location": "City, State",
  "description": "Listing description text"
}
Rules:
- For price, return only the numeric value without currency symbols
- For hours, return only the numeric value
- For year, return a 4-digit integer
- For model, extract just the model code (e.g. "H2O" not "Chaparral H2O 21 foot")
- For engine, include power rating if visible (e.g. "4.3 MPI 220 hp")
- Do NOT guess or fabricate data; use null if not visible in the screenshot
PROMPT;

    $payload = [
        'model' => 'gpt-4o',
        'messages' => [
            [
                'role' => 'system',
                'content' => $systemPrompt,
            ],
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => 'Extract all boat listing data from this screenshot:'],
                    ['type' => 'image_url', 'image_url' => ['url' => $screenshotUrl, 'detail' => 'high']],
                ],
            ],
        ],
        'max_tokens' => 600,
        'temperature' => 0.1,
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://api.openai.com/v1/chat/completions',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) return null;
    $data = @json_decode($resp, true);
    $content = $data['choices'][0]['message']['content'] ?? '';
    if (!$content) return null;

    // Extract JSON from response (may be wrapped in markdown code blocks)
    if (preg_match('/```(?:json)?\s*(\{[\s\S]*?\})\s*```/', $content, $m)) {
        return @json_decode($m[1], true);
    }
    if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
        return @json_decode($m[0], true);
    }
    return @json_decode($content, true);
}

/**
 * Merge AI-extracted data into the scraper result.
 * Only fills fields that are currently empty (never overwrites existing data).
 */
function mergeAIResults($aiData, &$result) {
    if (!is_array($aiData)) return;

    // Map AI field names to result field names
    $fieldMap = [
        'title' => 'title',
        'make' => 'make',
        'model' => 'model',
        'year' => 'year',
        'hours' => 'hours',
        'engine' => 'engine',
        'price' => 'value_usa_usd',
        'location' => 'location',
        'description' => 'description',
    ];

    foreach ($fieldMap as $aiField => $resultField) {
        // Only fill empty fields
        if (!empty($result[$resultField])) continue;
        if (empty($aiData[$aiField]) || $aiData[$aiField] === null) continue;

        $val = $aiData[$aiField];

        // Type-specific processing
        switch ($resultField) {
            case 'year':
                $val = intval($val);
                if ($val < 1950 || $val > intval(date('Y')) + 2) continue 2;
                break;
            case 'value_usa_usd':
                $val = floatval(str_replace(',', '', (string)$val));
                if ($val < 500 || $val >= 50000000) continue 2;
                break;
            case 'hours':
                $val = (string) intval(str_replace(',', '', (string)$val));
                if (intval($val) < 1 || intval($val) > 30000) continue 2;
                break;
            case 'title':
                $val = trim((string)$val);
                // Don't set generic titles
                if (preg_match('/^\s*(Facebook|Marketplace|Log\s+in)\s*$/i', $val)) continue 2;
                break;
            default:
                $val = trim((string)$val);
                if (strlen($val) < 2 || strlen($val) > 300) continue 2;
                break;
        }

        $result[$resultField] = $val;
    }

    // If AI found an image URL and we don't have one
    if (!$result['image_url'] && !empty($aiData['image_url'])) {
        $imgUrl = trim($aiData['image_url']);
        if (filter_var($imgUrl, FILTER_VALIDATE_URL) && isUsefulImage($imgUrl)) {
            $result['image_url'] = $imgUrl;
        }
    }
}
