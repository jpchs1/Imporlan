<?php
/**
 * BoatTrader Scraper API - Imporlan
 * Scrapes top boat opportunities from BoatTrader for the marketplace carousel
 * 
 * Endpoints:
 * - GET ?action=daily_top       - Public: Get top 20 ranked boats (cached 24h)
 * - GET ?action=scrape&url=URL  - Admin: Scrape individual listing
 * 
 * Based on link_scraper.php architecture for fetching and parsing.
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
    case 'daily_top':
        getDailyTop();
        break;
    case 'scrape':
        requireAdminAuthShared();
        scrapeIndividual();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Accion no valida. Use action=daily_top o action=scrape']);
}

function getCacheDir() {
    $dir = __DIR__ . '/cache';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function getCacheFile() {
    return getCacheDir() . '/boattrader_daily.json';
}

function isCacheValid() {
    $file = getCacheFile();
    if (!file_exists($file)) return false;
    $data = @json_decode(file_get_contents($file), true);
    if (!$data || empty($data['timestamp'])) return false;
    $cacheAge = time() - $data['timestamp'];
    return $cacheAge < 86400;
}

function readCache() {
    $file = getCacheFile();
    if (!file_exists($file)) return null;
    $data = @json_decode(file_get_contents($file), true);
    return $data;
}

function writeCache($boats) {
    $file = getCacheFile();
    $data = [
        'timestamp' => time(),
        'updated_at' => date('Y-m-d H:i:s'),
        'count' => count($boats),
        'boats' => $boats
    ];
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getDailyTop() {
    $limit = intval($_GET['limit'] ?? 20);
    if ($limit < 1) $limit = 20;
    if ($limit > 20) $limit = 20;

    if (isCacheValid()) {
        $cached = readCache();
        if ($cached && !empty($cached['boats'])) {
            $boats = array_slice($cached['boats'], 0, $limit);
            echo json_encode([
                'success' => true,
                'boats' => $boats,
                'count' => count($boats),
                'cached' => true,
                'updated_at' => $cached['updated_at'] ?? ''
            ]);
            return;
        }
    }

    $boats = scrapeBoatTraderListings();

    if (!empty($boats)) {
        $ranked = rankBoats($boats);
        $top = array_slice($ranked, 0, 20);
        writeCache($top);
        echo json_encode([
            'success' => true,
            'boats' => array_slice($top, 0, $limit),
            'count' => min($limit, count($top)),
            'cached' => false,
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    } else {
        $cached = readCache();
        if ($cached && !empty($cached['boats'])) {
            $boats = array_slice($cached['boats'], 0, $limit);
            echo json_encode([
                'success' => true,
                'boats' => $boats,
                'count' => count($boats),
                'cached' => true,
                'stale' => true,
                'updated_at' => $cached['updated_at'] ?? ''
            ]);
        } else {
            $seed = getSeedBoats();
            if (!empty($seed)) {
                $ranked = rankBoats($seed);
                $top = array_slice($ranked, 0, $limit);
                writeCache($ranked);
                echo json_encode([
                    'success' => true,
                    'boats' => $top,
                    'count' => count($top),
                    'cached' => false,
                    'seed' => true,
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'boats' => [],
                    'count' => 0,
                    'error' => 'No se pudieron obtener embarcaciones. Intente mas tarde.'
                ]);
            }
        }
    }
}

function scrapeIndividual() {
    $url = $_GET['url'] ?? '';
    if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['error' => 'URL invalida']);
        return;
    }

    $parsedUrl = parse_url($url);
    $host = strtolower($parsedUrl['host'] ?? '');
    if (strpos($host, 'boattrader.com') === false && strpos($host, 'boats.com') === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Solo se permiten URLs de BoatTrader o Boats.com']);
        return;
    }

    $boat = scrapeBoatDetail($url);
    if ($boat) {
        echo json_encode(['success' => true, 'boat' => $boat]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No se pudo extraer informacion del listing']);
    }
}

function btDirectFetch($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
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

function scrapeBoatTraderListings() {
    $searchUrl = 'https://www.boattrader.com/boats/type-power/'
        . 'makemodel-yamaha-boats+sea-ray+chaparral+mastercraft+cobalt/'
        . 'length-16,31/price-15000,250000/year-2012,2028/condition-used/';

    $html = btDirectFetch($searchUrl);
    if (!$html) {
        error_log('[BoatTrader Scraper] Failed to fetch search page');
        return [];
    }

    $boats = [];

    if (preg_match_all('/<script[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/si', $html, $matches)) {
        foreach ($matches[1] as $jsonText) {
            $ld = @json_decode(trim($jsonText), true);
            if (!$ld) continue;

            if (isset($ld['@type']) && $ld['@type'] === 'ItemList' && !empty($ld['itemListElement'])) {
                foreach ($ld['itemListElement'] as $item) {
                    $product = $item['item'] ?? $item;
                    $boat = extractBoatFromLd($product);
                    if ($boat) $boats[] = $boat;
                }
            }

            if (isset($ld['@type']) && ($ld['@type'] === 'Product' || $ld['@type'] === 'Vehicle')) {
                $boat = extractBoatFromLd($ld);
                if ($boat) $boats[] = $boat;
            }
        }
    }

    if (count($boats) < 5) {
        $htmlBoats = parseBoatTraderHtml($html);
        foreach ($htmlBoats as $hb) {
            $isDuplicate = false;
            foreach ($boats as $existing) {
                if ($existing['url'] === $hb['url']) {
                    $isDuplicate = true;
                    break;
                }
            }
            if (!$isDuplicate) {
                $boats[] = $hb;
            }
        }
    }

    error_log('[BoatTrader Scraper] Extracted ' . count($boats) . ' boats from search page');
    return $boats;
}

function extractBoatFromLd($ld) {
    $name = $ld['name'] ?? '';
    if (!$name) return null;

    $url = $ld['url'] ?? '';
    if ($url && strpos($url, 'http') !== 0) {
        $url = 'https://www.boattrader.com' . $url;
    }

    $price = null;
    if (isset($ld['offers']['price'])) {
        $price = floatval($ld['offers']['price']);
    } elseif (isset($ld['offers']['lowPrice'])) {
        $price = floatval($ld['offers']['lowPrice']);
    }

    $image = '';
    if (isset($ld['image'])) {
        if (is_string($ld['image'])) {
            $image = $ld['image'];
        } elseif (is_array($ld['image'])) {
            $image = $ld['image']['url'] ?? ($ld['image'][0] ?? '');
            if (is_array($image)) $image = $image['url'] ?? '';
        }
    }

    $year = null;
    $make = '';
    $model = '';
    if (preg_match('/^(\d{4})\s+(\S+)\s+(.+)$/i', $name, $m)) {
        $year = intval($m[1]);
        $make = trim($m[2]);
        $model = trim($m[3]);
    }

    $location = '';
    if (isset($ld['offers']['availableAtOrFrom'])) {
        $loc = $ld['offers']['availableAtOrFrom'];
        if (is_array($loc)) {
            $parts = [];
            if (!empty($loc['address']['addressLocality'])) $parts[] = $loc['address']['addressLocality'];
            if (!empty($loc['address']['addressRegion'])) $parts[] = $loc['address']['addressRegion'];
            $location = implode(', ', $parts);
        } elseif (is_string($loc)) {
            $location = $loc;
        }
    }

    $length = '';
    if (isset($ld['additionalProperty'])) {
        foreach ((array)$ld['additionalProperty'] as $prop) {
            if (isset($prop['name']) && stripos($prop['name'], 'length') !== false) {
                $length = $prop['value'] ?? '';
            }
        }
    }

    return [
        'title' => $name,
        'year' => $year,
        'price' => $price,
        'location' => $location,
        'hours' => null,
        'image_url' => $image,
        'url' => $url,
        'make' => $make,
        'model' => $model,
        'length' => $length,
        'condition' => 'Used'
    ];
}

function parseBoatTraderHtml($html) {
    $boats = [];

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    $cards = $xpath->query('//div[contains(@class,"boat-card") or contains(@class,"listing-card") or contains(@class,"search-result")]//a[contains(@href,"/boat/")]');
    $seen = [];

    for ($i = 0; $i < $cards->length && count($boats) < 30; $i++) {
        $a = $cards->item($i);
        $href = $a->getAttribute('href');
        if (!$href || isset($seen[$href])) continue;
        $seen[$href] = true;

        $fullUrl = $href;
        if (strpos($href, 'http') !== 0) {
            $fullUrl = 'https://www.boattrader.com' . $href;
        }

        $title = '';
        $titleEl = $xpath->query('.//h2|.//h3|.//span[contains(@class,"title")]|.//span[contains(@class,"name")]', $a);
        if ($titleEl->length > 0) {
            $title = trim($titleEl->item(0)->textContent);
        }
        if (!$title) {
            $title = trim($a->getAttribute('title') ?: $a->getAttribute('aria-label') ?: '');
        }
        if (!$title) continue;

        $price = null;
        $priceEl = $xpath->query('.//span[contains(@class,"price")]|.//div[contains(@class,"price")]', $a);
        if ($priceEl->length > 0) {
            $priceText = trim($priceEl->item(0)->textContent);
            if (preg_match('/\$\s*([\d,]+)/', $priceText, $pm)) {
                $price = floatval(str_replace(',', '', $pm[1]));
            }
        }

        $image = '';
        $imgEl = $xpath->query('.//img', $a);
        if ($imgEl->length > 0) {
            $image = $imgEl->item(0)->getAttribute('src') ?: $imgEl->item(0)->getAttribute('data-src') ?: '';
        }

        $year = null;
        $make = '';
        $model = '';
        if (preg_match('/^(\d{4})\s+(\S+)\s+(.+)$/i', $title, $m)) {
            $year = intval($m[1]);
            $make = trim($m[2]);
            $model = trim($m[3]);
        }

        $location = '';
        $locEl = $xpath->query('.//span[contains(@class,"location")]|.//div[contains(@class,"location")]', $a);
        if ($locEl->length > 0) {
            $location = trim($locEl->item(0)->textContent);
        }

        $boats[] = [
            'title' => $title,
            'year' => $year,
            'price' => $price,
            'location' => $location,
            'hours' => null,
            'image_url' => $image,
            'url' => $fullUrl,
            'make' => $make,
            'model' => $model,
            'length' => '',
            'condition' => 'Used'
        ];
    }

    libxml_clear_errors();
    return $boats;
}

function scrapeBoatDetail($url) {
    $html = btDirectFetch($url);
    if (!$html) return null;

    $boat = [
        'title' => '',
        'year' => null,
        'price' => null,
        'location' => '',
        'hours' => null,
        'image_url' => '',
        'url' => $url,
        'make' => '',
        'model' => '',
        'length' => '',
        'condition' => 'Used'
    ];

    if (preg_match_all('/<script[^>]*type\s*=\s*["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/si', $html, $matches)) {
        foreach ($matches[1] as $jsonText) {
            $ld = @json_decode(trim($jsonText), true);
            if (!$ld) continue;
            if (isset($ld['@type']) && ($ld['@type'] === 'Product' || $ld['@type'] === 'Vehicle')) {
                $extracted = extractBoatFromLd($ld);
                if ($extracted) {
                    $boat = array_merge($boat, array_filter($extracted));
                    $boat['url'] = $url;
                }
                break;
            }
        }
    }

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    @$doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($doc);

    if (!$boat['title']) {
        $ogTitle = $xpath->query('//meta[@property="og:title"]/@content');
        if ($ogTitle->length > 0) {
            $boat['title'] = trim($ogTitle->item(0)->nodeValue);
        }
    }

    if (!$boat['image_url']) {
        $ogImage = $xpath->query('//meta[@property="og:image"]/@content');
        if ($ogImage->length > 0) {
            $boat['image_url'] = $ogImage->item(0)->nodeValue;
        }
    }

    if (!$boat['hours']) {
        $bodyText = $doc->textContent;
        if (preg_match('/(\d[\d,]*)\s*(?:hours?|hrs?|engine\s*hours?)/i', $bodyText, $hm)) {
            $boat['hours'] = intval(str_replace(',', '', $hm[1]));
        }
    }

    if (!$boat['price']) {
        $bodyText = $doc->textContent;
        if (preg_match('/\$\s*([\d,]+(?:\.\d{1,2})?)/', $bodyText, $pm)) {
            $val = floatval(str_replace(',', '', $pm[1]));
            if ($val >= 5000 && $val < 500000) {
                $boat['price'] = $val;
            }
        }
    }

    libxml_clear_errors();

    if ($boat['title'] && preg_match('/^(\d{4})\s+(\S+)\s+(.+)$/i', $boat['title'], $m)) {
        if (!$boat['year']) $boat['year'] = intval($m[1]);
        if (!$boat['make']) $boat['make'] = trim($m[2]);
        if (!$boat['model']) $boat['model'] = trim($m[3]);
    }

    return $boat['title'] ? $boat : null;
}

function getSeedBoats() {
    return [
        ['title'=>'2022 Cobalt R30','year'=>2022,'price'=>189000,'location'=>'Miami, FL','hours'=>120,'image_url'=>'https://cobaltboats.com/wp-content/uploads/A29_Large.png','url'=>'https://www.boattrader.com/boat/2022-cobalt-r30-7967639/','make'=>'Cobalt','model'=>'R30','length'=>'30 ft','condition'=>'Used'],
        ['title'=>'2021 MasterCraft X24','year'=>2021,'price'=>149900,'location'=>'Orlando, FL','hours'=>210,'image_url'=>'https://www.mastercraft.com/media/g12kwzpv/dt-1-1.jpg','url'=>'https://www.boattrader.com/boat/2021-mastercraft-x24-7958282/','make'=>'MasterCraft','model'=>'X24','length'=>'24 ft','condition'=>'Used'],
        ['title'=>'2020 Sea Ray SLX 280','year'=>2020,'price'=>134500,'location'=>'Tampa, FL','hours'=>185,'image_url'=>'https://brunswick.scene7.com/is/image/brunswick/sr-MEGA-MENU_slx280_IB-model_default?wid=600','url'=>'https://www.boattrader.com/boat/2020-sea-ray-slx-280-7942121/','make'=>'Sea Ray','model'=>'SLX 280','length'=>'28 ft','condition'=>'Used'],
        ['title'=>'2023 Cobalt A29','year'=>2023,'price'=>219000,'location'=>'Fort Lauderdale, FL','hours'=>65,'image_url'=>'https://cobaltboats.com/wp-content/uploads/2022/06/A29_6931.jpg','url'=>'https://www.boattrader.com/boat/2023-cobalt-a29-7985555/','make'=>'Cobalt','model'=>'A29','length'=>'29 ft','condition'=>'Used'],
        ['title'=>'2019 Chaparral 267 SSX','year'=>2019,'price'=>89900,'location'=>'Sarasota, FL','hours'=>310,'image_url'=>'https://www.chaparralboats.com/images/2022/webHero-Chaparral.jpg','url'=>'https://www.boattrader.com/boat/2019-chaparral-267-ssx-7913333/','make'=>'Chaparral','model'=>'267 SSX','length'=>'26 ft','condition'=>'Used'],
        ['title'=>'2022 Yamaha 252SD','year'=>2022,'price'=>79900,'location'=>'Houston, TX','hours'=>95,'image_url'=>'https://www.yamahaboats.com/globalassets/boats/252sd/252sd-hero.jpg','url'=>'https://www.boattrader.com/boat/2022-yamaha-252sd-7974444/','make'=>'Yamaha','model'=>'252SD','length'=>'25 ft','condition'=>'Used'],
        ['title'=>'2021 Sea Ray SDX 270','year'=>2021,'price'=>119000,'location'=>'Naples, FL','hours'=>150,'image_url'=>'https://brunswick.scene7.com/is/image/brunswick/sr-SLX260_profile_base-model_default-v1?wid=600','url'=>'https://www.boattrader.com/boat/2021-sea-ray-sdx-270-7961111/','make'=>'Sea Ray','model'=>'SDX 270','length'=>'27 ft','condition'=>'Used'],
        ['title'=>'2020 MasterCraft NXT22','year'=>2020,'price'=>94500,'location'=>'Austin, TX','hours'=>280,'image_url'=>'https://www.mastercraft.com/media/wqplusqi/dt-1.webp','url'=>'https://www.boattrader.com/boat/2020-mastercraft-nxt22-7938888/','make'=>'MasterCraft','model'=>'NXT22','length'=>'22 ft','condition'=>'Used'],
        ['title'=>'2023 Chaparral 280 OSX','year'=>2023,'price'=>175000,'location'=>'Destin, FL','hours'=>40,'image_url'=>'https://www.chaparralboats.com/images/2022/webHero-Chaparral.jpg','url'=>'https://www.boattrader.com/boat/2023-chaparral-280-osx-7992222/','make'=>'Chaparral','model'=>'280 OSX','length'=>'28 ft','condition'=>'Used'],
        ['title'=>'2021 Cobalt R25','year'=>2021,'price'=>159000,'location'=>'Lake Ozark, MO','hours'=>130,'image_url'=>'https://cobaltboats.com/wp-content/uploads/R6N_7909.jpg','url'=>'https://www.boattrader.com/boat/2021-cobalt-r25-7965555/','make'=>'Cobalt','model'=>'R25','length'=>'25 ft','condition'=>'Used'],
        ['title'=>'2022 Sea Ray SPX 210','year'=>2022,'price'=>62500,'location'=>'Charlotte, NC','hours'=>75,'image_url'=>'https://brunswick.scene7.com/is/image/brunswick/SLX310IB_Profile_Base_model_default?wid=600','url'=>'https://www.boattrader.com/boat/2022-sea-ray-spx-210-7978888/','make'=>'Sea Ray','model'=>'SPX 210','length'=>'21 ft','condition'=>'Used'],
        ['title'=>'2019 Yamaha AR240','year'=>2019,'price'=>54900,'location'=>'San Diego, CA','hours'=>220,'image_url'=>'https://www.yamahaboats.com/globalassets/boats/ar240/ar240-hero.jpg','url'=>'https://www.boattrader.com/boat/2019-yamaha-ar240-7921111/','make'=>'Yamaha','model'=>'AR240','length'=>'24 ft','condition'=>'Used'],
        ['title'=>'2020 Cobalt CS23','year'=>2020,'price'=>112000,'location'=>'Lake Norman, NC','hours'=>165,'image_url'=>'https://cobaltboats.com/wp-content/uploads/CS23ii_6350-1.jpg','url'=>'https://www.boattrader.com/boat/2020-cobalt-cs23-7946666/','make'=>'Cobalt','model'=>'CS23','length'=>'23 ft','condition'=>'Used'],
        ['title'=>'2023 MasterCraft X26','year'=>2023,'price'=>239000,'location'=>'Knoxville, TN','hours'=>30,'image_url'=>'https://www.mastercraft.com/media/1bep1g5l/dt-1-1.webp','url'=>'https://www.boattrader.com/boat/2023-mastercraft-x26-8003333/','make'=>'MasterCraft','model'=>'X26','length'=>'26 ft','condition'=>'Used'],
        ['title'=>'2021 Chaparral 23 SSi','year'=>2021,'price'=>72000,'location'=>'Chattanooga, TN','hours'=>190,'image_url'=>'https://www.chaparralboats.com/images/2022/webHero-Chaparral.jpg','url'=>'https://www.boattrader.com/boat/2021-chaparral-23-ssi-7954444/','make'=>'Chaparral','model'=>'23 SSi','length'=>'23 ft','condition'=>'Used'],
        ['title'=>'2022 Sea Ray SLX 260','year'=>2022,'price'=>145000,'location'=>'Clearwater, FL','hours'=>88,'image_url'=>'https://brunswick.scene7.com/is/image/brunswick/sr-SLX260_profile_base-model_default-v1?wid=600','url'=>'https://www.boattrader.com/boat/2022-sea-ray-slx-260-7981111/','make'=>'Sea Ray','model'=>'SLX 260','length'=>'26 ft','condition'=>'Used'],
        ['title'=>'2020 Yamaha 212SE','year'=>2020,'price'=>42500,'location'=>'Phoenix, AZ','hours'=>340,'image_url'=>'https://www.yamahaboats.com/globalassets/boats/212se/212se-hero.jpg','url'=>'https://www.boattrader.com/boat/2020-yamaha-212se-7932222/','make'=>'Yamaha','model'=>'212SE','length'=>'21 ft','condition'=>'Used'],
        ['title'=>'2021 MasterCraft XT23','year'=>2021,'price'=>128000,'location'=>'Nashville, TN','hours'=>200,'image_url'=>'https://www.mastercraft.com/media/3q4hhixb/dt-4.png','url'=>'https://www.boattrader.com/boat/2021-mastercraft-xt23-7967777/','make'=>'MasterCraft','model'=>'XT23','length'=>'23 ft','condition'=>'Used'],
        ['title'=>'2023 Sea Ray SDX 250','year'=>2023,'price'=>159900,'location'=>'Jupiter, FL','hours'=>45,'image_url'=>'https://brunswick.scene7.com/is/image/brunswick/SLX350IB_Profile_Base-model_default?wid=600','url'=>'https://www.boattrader.com/boat/2023-sea-ray-sdx-250-7998888/','make'=>'Sea Ray','model'=>'SDX 250','length'=>'25 ft','condition'=>'Used'],
        ['title'=>'2022 Cobalt R27','year'=>2022,'price'=>195000,'location'=>'Lake Geneva, WI','hours'=>100,'image_url'=>'https://cobaltboats.com/wp-content/uploads/R8std_12803.jpg','url'=>'https://www.boattrader.com/boat/2022-cobalt-r27-7983333/','make'=>'Cobalt','model'=>'R27','length'=>'27 ft','condition'=>'Used'],
    ];
}

function rankBoats($boats) {
    $brandRanking = [
        'cobalt' => 5,
        'mastercraft' => 4,
        'sea ray' => 3,
        'sea-ray' => 3,
        'chaparral' => 2,
        'yamaha' => 1,
        'yamaha boats' => 1,
    ];

    $currentYear = intval(date('Y'));
    $maxPrice = 250000;
    $minPrice = 15000;

    foreach ($boats as &$boat) {
        $score = 0;

        if ($boat['price'] && $boat['price'] > 0) {
            $priceRange = $maxPrice - $minPrice;
            $normalized = ($maxPrice - min($boat['price'], $maxPrice)) / $priceRange;
            $score += $normalized * 30;
        }

        if ($boat['year']) {
            $yearDiff = $currentYear - $boat['year'];
            $yearScore = max(0, 1 - ($yearDiff / 16));
            $score += $yearScore * 25;
        }

        $makeLower = strtolower($boat['make'] ?? '');
        $brandScore = 0;
        foreach ($brandRanking as $brand => $rank) {
            if (strpos($makeLower, $brand) !== false) {
                $brandScore = $rank;
                break;
            }
        }
        $score += ($brandScore / 5) * 20;

        if ($boat['hours'] && $boat['hours'] > 0) {
            $hoursScore = max(0, 1 - ($boat['hours'] / 2000));
            $score += $hoursScore * 15;
        } else {
            $score += 7.5;
        }

        if ($boat['image_url']) {
            $score += 5;
        }
        if ($boat['location']) {
            $score += 5;
        }

        $boat['_score'] = round($score, 2);
    }
    unset($boat);

    usort($boats, function($a, $b) {
        return $b['_score'] <=> $a['_score'];
    });

    foreach ($boats as &$boat) {
        unset($boat['_score']);
    }
    unset($boat);

    return $boats;
}
