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
    if ($isFacebookMarketplace && !$result['image_url']) {
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
            $result['description'] = trim($metaDesc->item(0)->nodeValue);
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
            '/(?:engine|motor|propulsion|power(?:ed)?\s*by)[:\s]+([A-Z][\w\s\.\-\/]+(?:\d+\s*(?:hp|HP|cv|CV|L|ci|CI))[\w\s\.\-\/]*)/i',
            '/(?:engine|motor|propulsion)[:\s]+([A-Z][\w\s\.\-\/]{3,80})/i',
            '/((?:twin|single|triple|quad|inboard|outboard|sterndrive|I\/O)\s+[A-Z][\w\s\.\-\/]+(?:\d+\s*(?:hp|HP|cv|CV|L)))/i',
            '/((?:Mercury|Mercruiser|Yamaha|Honda|Suzuki|Evinrude|Johnson|Volvo\s*Penta|Caterpillar|Cummins|Yanmar|Tohatsu|Verado|Optimax|EFI|HPDI)\s+[\w\s\.\-\/]{2,60})/i',
        ];
        foreach ($enginePatterns as $pat) {
            if (preg_match($pat, $bodyText, $em)) {
                $engineVal = trim($em[1]);
                $engineVal = preg_replace('/\s{2,}/', ' ', $engineVal);
                $engineVal = rtrim($engineVal, ' .,;:-');
                if (strlen($engineVal) >= 3 && strlen($engineVal) <= 200) {
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

    if (!$result['title']) {
        $ogTitle = $xpath->query('//meta[@property="og:title"]/@content');
        if ($ogTitle->length > 0) {
            $title = trim($ogTitle->item(0)->nodeValue);
            if ($title && stripos($title, 'log in') === false && stripos($title, 'facebook') === false) {
                $result['title'] = $title;
            }
        }
        if (!$result['title']) {
            $titleTag = $xpath->query('//title');
            if ($titleTag->length > 0) {
                $title = trim($titleTag->item(0)->textContent);
                if ($title && stripos($title, 'log in') === false && stripos($title, 'facebook') === false) {
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

    // Helper: clean raw model text into just the core model identifier
    $cleanModel = function($raw, $make) {
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
        $m = trim($m, " .,;:-\t\n\r");
        // Keep only core model code tokens (tokens with digits, or short uppercase prefixes)
        // Stop at purely descriptive words like "Fish", "Ski", "Sport", "Bowrider"
        $words = preg_split('/\s+/', $m);
        $kept = [];
        foreach ($words as $w) {
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
                // Descriptive word (Fish, Ski, Sport, Bowrider) - stop
                break;
            }
        }
        $m = implode(' ', $kept);
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
        if (!$result['make']) $result['make'] = $make;
        if (!$result['model']) $result['model'] = $model;
        if (!$result['year']) $result['year'] = intval($year);
    }

    // Extract make, model, year from title/description for any source (Facebook, etc.)
    extractBoatIdentity($result);

    if (!$result['location'] && $result['title']) {
        $text = $result['title'] . ' ' . ($result['description'] ?? '');
        if (preg_match('/(?:for\s+sale\s+in|located?\s+in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/i', $text, $m)) {
            $result['location'] = trim($m[1]) . ', ' . strtoupper($m[2]);
        }
    }
}
