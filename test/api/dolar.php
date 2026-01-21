<?php
/**
 * Dolar Observado API
 * Fetches the current dollar rate from df.cl and caches it
 * Returns JSON with dolar_observado and dolar_compra (observado + 20)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Cache-Control: public, max-age=300'); // Cache for 5 minutes

// Cache file path
$cacheFile = __DIR__ . '/dolar_cache.json';
$cacheExpiry = 900; // 15 minutes in seconds

// Check if cache exists and is valid
if (file_exists($cacheFile)) {
    $cacheData = json_decode(file_get_contents($cacheFile), true);
    if ($cacheData && isset($cacheData['timestamp'])) {
        $cacheAge = time() - $cacheData['timestamp'];
        if ($cacheAge < $cacheExpiry) {
            // Return cached data
            echo json_encode([
                'success' => true,
                'dolar_observado' => $cacheData['dolar_observado'],
                'dolar_compra' => $cacheData['dolar_compra'],
                'cached' => true,
                'cache_age' => $cacheAge
            ]);
            exit;
        }
    }
}

// Fetch fresh data from df.cl
function fetchDolarObservado() {
    $url = 'https://www.df.cl/';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$html) {
        return null;
    }
    
    // Try to extract dollar value from the page
    // df.cl structure: <p class="indicadores__name">DOLAR</p> followed by <p class="indicadores__number">$885,21</p>
    
    // Pattern 1: Match the specific df.cl structure for DOLAR indicator
    // HTML: <p class="indicadores__name">DOLAR</p>\n        <p class="indicadores__number">$885,21</p>
    if (preg_match('/class="indicadores__name">DOLAR<\/p>\s*<p class="indicadores__number">\$([0-9]+,[0-9]+)/s', $html, $matches)) {
        $value = str_replace(',', '.', $matches[1]);
        $value = floatval($value);
        if ($value > 500 && $value < 2000) {
            return $value;
        }
    }
    
    // Pattern 2: Match "Dólar US" in the marquee section
    if (preg_match('/indicadores__name["\']?>D[oó]lar\s*US<\/p>\s*<p[^>]*indicadores__number[^>]*>\$?([0-9]+[.,][0-9]+)/i', $html, $matches)) {
        $value = str_replace(',', '.', $matches[1]);
        $value = floatval($value);
        if ($value > 500 && $value < 2000) {
            return $value;
        }
    }
    
    // Pattern 3: Generic fallback - look for dollar values in indicadores section
    if (preg_match('/indicadores__number[^>]*>\$?([0-9]{3}[.,][0-9]+)/i', $html, $matches)) {
        $value = str_replace(',', '.', $matches[1]);
        $value = floatval($value);
        if ($value > 500 && $value < 2000) {
            return $value;
        }
    }
    
    return null;
}

// Alternative: Try Banco Central API
function fetchFromBancoCentral() {
    // This is a backup source
    $url = 'https://si3.bcentral.cl/Indicadoressiete/secure/Serie.aspx?gcode=PRE_TCO&param=RABmAFYAWQB3AGYAaQBuAEkALQAzADUAbgBNAGgAaABpADIAQgBOAHAAcgBNAEMAYwBwADAAeQBGAFEAZwBRAGUATQBKAEEAUgBzAEgAdwBtAFUATgBRAD0A';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $html = curl_exec($ch);
    curl_close($ch);
    
    if ($html && preg_match('/([0-9]{3}[.,][0-9]+)/', $html, $matches)) {
        $value = str_replace(',', '.', $matches[1]);
        return floatval($value);
    }
    
    return null;
}

// Try to fetch the dollar rate
$dolarObservado = fetchDolarObservado();

// If df.cl fails, try backup source
if (!$dolarObservado) {
    $dolarObservado = fetchFromBancoCentral();
}

// If all sources fail, use fallback value
if (!$dolarObservado) {
    // Use a reasonable fallback (this should be updated periodically)
    $dolarObservado = 985.0;
    $isFallback = true;
} else {
    $isFallback = false;
}

// Calculate dolar compra (observado + 20)
$dolarCompra = $dolarObservado + 20;

// Save to cache
$cacheData = [
    'timestamp' => time(),
    'dolar_observado' => $dolarObservado,
    'dolar_compra' => $dolarCompra,
    'is_fallback' => $isFallback
];

file_put_contents($cacheFile, json_encode($cacheData));

// Return response
echo json_encode([
    'success' => true,
    'dolar_observado' => $dolarObservado,
    'dolar_compra' => $dolarCompra,
    'cached' => false,
    'is_fallback' => $isFallback
]);

