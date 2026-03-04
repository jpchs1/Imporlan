<?php
/**
 * Reports API - Imporlan
 * 
 * Professional report generation system with AI analysis for expedientes.
 * 
 * Endpoints:
 * - POST ?action=send_report&id=X          - Generate + send report (admin)
 * - POST ?action=preview_report&id=X       - Generate preview only (admin)
 * - GET  ?action=list_reports&order_id=X    - List reports for expediente (admin)
 * - GET  ?action=view_report&report_id=X    - View report HTML (public, token-secured)
 * - GET  ?action=download_pdf&report_id=X   - Download PDF (public, token-secured)
 * - POST ?action=resend_report&report_id=X  - Resend existing report (admin)
 * - GET  ?action=migrate                    - Create/update tables
 * - GET  ?action=user_reports&user_email=X  - List reports for user panel
 */

require_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/auth_helper.php';

if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    // For view/download endpoints, don't set JSON headers
    $action = $_GET['action'] ?? '';
    $isHtmlAction = in_array($action, ['view', 'view_report', 'download', 'download_pdf']);
    
    if (!$isHtmlAction) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Email, X-User-Name');
        header('Content-Type: application/json');
    } else {
        header('Access-Control-Allow-Origin: *');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    switch ($action) {
        case 'migrate':
            requireAdminAuth();
            runReportsMigration();
            break;
        case 'send':
        case 'send_report':
            requireAdminAuth();
            sendReport();
            break;
        case 'preview':
        case 'preview_report':
            requireAdminAuth();
            previewReport();
            break;
        case 'list':
        case 'list_reports':
            requireAdminAuth();
            listReports();
            break;
        case 'resend':
        case 'resend_report':
            requireAdminAuth();
            resendReport();
            break;
        case 'view':
        case 'view_report':
            viewReport();
            break;
        case 'download':
        case 'download_pdf':
            downloadPdf();
            break;
        case 'user_list':
        case 'user_reports':
            userListReports();
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Accion no valida']);
    }
}

function requireAdminAuth() {
    return requireAdminAuthShared();
}

// ============================================================
// DATABASE MIGRATION
// ============================================================

function runReportsMigration() {
    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                created_by_admin VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                report_type VARCHAR(50) DEFAULT 'boat_search',
                plan_type VARCHAR(100),
                version INT DEFAULT 1,
                pdf_url TEXT,
                html_content LONGTEXT,
                analysis_json LONGTEXT,
                access_token VARCHAR(100) UNIQUE,
                token_expires_at TIMESTAMP NULL,
                INDEX idx_order (order_id),
                INDEX idx_token (access_token)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'report',
                title VARCHAR(500),
                message TEXT,
                link TEXT,
                read_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_email),
                INDEX idx_read (user_email, read_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        echo json_encode(['success' => true, 'message' => 'Reports and notifications tables created/updated']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Migration failed: ' . $e->getMessage()]);
    }
}

// ============================================================
// BOAT REPORT ANALYZER - AI Scoring Module
// ============================================================

class BoatReportAnalyzer {
    
    private $brandScores = [
        'cobalt' => 20,
        'sea ray' => 15,
        'searay' => 15,
        'monterrey' => 14,
        'monterey' => 14,
        'chaparral' => 16,
        'regal' => 17,
        'bayliner' => 8,
        'maxum' => 8,
        'glastron' => 9,
        'four winns' => 10,
        'fourwinns' => 10,
        'rinker' => 12,
    ];
    
    private $engineBonus = 15; // 5.0 / Mercruiser
    private $goodPriceBonus = 10;
    private $reasonableHoursBonus = 10;
    private $logisticBonus = 5;
    private $negativeCommentPenalty = -10;
    
    /**
     * Analyze all boat options and return scored results
     */
    public function analyzeOptions($links, $order) {
        $results = [];
        
        foreach ($links as $index => $link) {
            // Skip empty links
            if (empty($link['url']) && empty($link['title'])) {
                continue;
            }
            
            $analysis = $this->analyzeBoat($link, $index, $order);
            $results[] = $analysis;
        }
        
        // Sort by score descending
        usort($results, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        // Assign recommendation levels
        $maxScore = !empty($results) ? $results[0]['score'] : 0;
        foreach ($results as &$r) {
            if ($maxScore > 0 && $r['score'] >= $maxScore * 0.8) {
                $r['recommendation_level'] = 'Alta Prioridad';
                $r['recommendation_class'] = 'high';
            } elseif ($maxScore > 0 && $r['score'] >= $maxScore * 0.5) {
                $r['recommendation_level'] = 'Prioridad Media';
                $r['recommendation_class'] = 'medium';
            } else {
                $r['recommendation_level'] = 'Baja Prioridad';
                $r['recommendation_class'] = 'low';
            }
        }
        
        return $results;
    }
    
    private function analyzeBoat($link, $index, $order) {
        $score = 50; // Base score
        $pros = [];
        $risks = [];
        $notes = [];
        
        $url = strtolower($link['url'] ?? '');
        $title = strtolower($link['title'] ?? '');
        $comments = strtolower($link['comments'] ?? '');
        $location = $link['location'] ?? '';
        $hours = $link['hours'] ?? '';
        $priceUsd = floatval($link['value_usa_usd'] ?? 0);
        $negotiateUsd = floatval($link['value_to_negotiate_usd'] ?? 0);
        
        // Brand scoring
        $detectedBrand = '';
        foreach ($this->brandScores as $brand => $bonus) {
            if (strpos($url, $brand) !== false || strpos($title, $brand) !== false || strpos($comments, $brand) !== false) {
                $score += $bonus;
                $detectedBrand = ucfirst($brand);
                if ($bonus >= 15) {
                    $pros[] = 'Marca premium reconocida (' . $detectedBrand . ')';
                } elseif ($bonus >= 10) {
                    $pros[] = 'Marca de buena reputacion (' . $detectedBrand . ')';
                } else {
                    $pros[] = 'Marca economica (' . $detectedBrand . ')';
                }
                break;
            }
        }
        
        // Engine scoring
        if (strpos($url, '5.0') !== false || strpos($title, '5.0') !== false || 
            strpos($comments, '5.0') !== false || strpos($url, 'mercruiser') !== false || 
            strpos($title, 'mercruiser') !== false || strpos($comments, 'mercruiser') !== false) {
            $score += $this->engineBonus;
            $pros[] = 'Motor compatible (5.0 / Mercruiser)';
        }
        
        // Engine hours scoring
        $hoursNum = 0;
        if (!empty($hours)) {
            $hoursNum = intval(preg_replace('/[^0-9]/', '', $hours));
            if ($hoursNum > 0 && $hoursNum <= 300) {
                $score += $this->reasonableHoursBonus;
                $pros[] = 'Pocas horas de motor (' . number_format($hoursNum) . ' hrs)';
            } elseif ($hoursNum > 0 && $hoursNum <= 600) {
                $score += intval($this->reasonableHoursBonus / 2);
                $pros[] = 'Horas de motor razonables (' . number_format($hoursNum) . ' hrs)';
            } elseif ($hoursNum > 600) {
                $risks[] = 'Horas de motor elevadas (' . number_format($hoursNum) . ' hrs) - puede requerir servicio mayor';
            }
        }
        
        // Price scoring
        if ($priceUsd > 0 && $negotiateUsd > 0 && $negotiateUsd < $priceUsd) {
            $savings = $priceUsd - $negotiateUsd;
            $savingsPercent = ($savings / $priceUsd) * 100;
            if ($savingsPercent >= 10) {
                $score += $this->goodPriceBonus;
                $pros[] = 'Margen de negociacion favorable (' . number_format($savingsPercent, 0) . '% ahorro potencial)';
            }
        }
        if ($priceUsd > 0 && $priceUsd < 25000) {
            $pros[] = 'Precio accesible en rango economico';
            $score += 3;
        } elseif ($priceUsd > 0 && $priceUsd < 50000) {
            $pros[] = 'Precio en rango medio del mercado';
            $score += 5;
        }
        
        // Freshwater preference
        $locationLower = strtolower($location);
        $freshwaterStates = ['minnesota', 'wisconsin', 'michigan', 'ohio', 'tennessee', 'kentucky', 'indiana', 'lake'];
        foreach ($freshwaterStates as $fw) {
            if (strpos($locationLower, $fw) !== false) {
                $score += $this->logisticBonus;
                $pros[] = 'Ubicacion de agua dulce (' . $location . ')';
                break;
            }
        }
        
        // Logistic convenience scoring
        $convenientStates = ['florida', 'texas', 'california', 'georgia', 'south carolina', 'north carolina'];
        foreach ($convenientStates as $cs) {
            if (strpos($locationLower, $cs) !== false) {
                $score += $this->logisticBonus;
                $pros[] = 'Ubicacion logisticamente conveniente para envio (' . $location . ')';
                break;
            }
        }
        
        // Negative comments reduce score
        $negativeWords = ['problema', 'dano', 'reparar', 'cuidado', 'malo', 'damage', 'repair', 'issue', 'problem', 'broken', 'needs work', 'as-is', 'no motor', 'no engine'];
        foreach ($negativeWords as $neg) {
            if (strpos($comments, $neg) !== false) {
                $score += $this->negativeCommentPenalty;
                $risks[] = 'Comentarios del asesor indican observaciones a considerar';
                break;
            }
        }
        
        // General risks based on missing data
        if (empty($hours) || $hoursNum === 0) {
            $risks[] = 'Horas de motor no informadas - solicitar verificacion en inspeccion';
        }
        if ($priceUsd <= 0) {
            $risks[] = 'Precio no especificado - requiere verificacion';
        }
        if (empty($link['image_url'])) {
            $notes[] = 'Sin imagen disponible - verificar listing original';
        }
        
        // Inspection notes
        $notes[] = 'Se recomienda inspeccion mecanica profesional previa a la compra';
        if ($hoursNum > 400) {
            $notes[] = 'Verificar estado de impellers, bellows y fluidos del motor';
        }
        
        // Clamp score
        $score = max(0, min(100, $score));
        
        // Generate summary
        $summary = $this->generateSummary($link, $score, $pros, $risks, $detectedBrand);
        
        return [
            'link' => $link,
            'link_index' => $index,
            'score' => $score,
            'brand_detected' => $detectedBrand,
            'summary' => $summary,
            'pros' => $pros,
            'risks' => $risks,
            'inspection_notes' => $notes,
            'recommendation_level' => '', // Set after sorting
            'recommendation_class' => '',
        ];
    }
    
    private function generateSummary($link, $score, $pros, $risks, $brand) {
        $parts = [];
        
        if (!empty($brand)) {
            $parts[] = 'Embarcacion ' . $brand;
        } else {
            $parts[] = 'Embarcacion';
        }
        
        if (!empty($link['location'])) {
            $parts[] = 'ubicada en ' . $link['location'];
        }
        
        $priceUsd = floatval($link['value_usa_usd'] ?? 0);
        if ($priceUsd > 0) {
            $parts[] = 'con precio de $' . number_format($priceUsd, 0, '.', ',') . ' USD';
        }
        
        $summary = implode(' ', $parts) . '.';
        
        if ($score >= 75) {
            $summary .= ' Presenta un perfil muy favorable para la compra.';
        } elseif ($score >= 50) {
            $summary .= ' Opcion con buenas caracteristicas generales.';
        } else {
            $summary .= ' Requiere evaluacion adicional antes de proceder.';
        }
        
        if (count($pros) > 0) {
            $summary .= ' Destaca por: ' . $pros[0] . '.';
        }
        
        if (count($risks) > 0) {
            $summary .= ' Considerar: ' . $risks[0] . '.';
        }
        
        return $summary;
    }
}

// ============================================================
// HTML REPORT GENERATOR
// ============================================================

function generateReportHtml($order, $links, $analysisResults, $reportVersion, $accessToken) {
    $clientName = htmlspecialchars($order['customer_name'] ?? 'Cliente');
    $orderNumber = htmlspecialchars($order['order_number'] ?? 'N/A');
    $planName = htmlspecialchars($order['plan_name'] ?? 'Plan de Busqueda');
    $agentName = htmlspecialchars($order['agent_name'] ?? 'Equipo Imporlan');
    $requirement = htmlspecialchars($order['requirement_name'] ?? 'Busqueda de embarcacion segun criterios del cliente');
    $assetName = htmlspecialchars($order['asset_name'] ?? '');
    $typeZone = htmlspecialchars($order['type_zone'] ?? '');
    $date = date('d/m/Y');
    $dateTime = date('d/m/Y H:i');
    
    // Determine plan type label
    $planTypeLabel = 'Plan de Busqueda';
    $planLower = strtolower($planName);
    if (strpos($planLower, 'explorador') !== false || strpos($planLower, 'fragata') !== false) {
        $planTypeLabel = 'Plan Explorador - Busqueda Basica';
    } elseif (strpos($planLower, 'capitan') !== false) {
        $planTypeLabel = 'Plan Capitan - Busqueda Asistida';
    } elseif (strpos($planLower, 'almirante') !== false) {
        $planTypeLabel = 'Plan Almirante - Busqueda Avanzada';
    } elseif (strpos($planLower, 'cotizacion') !== false || strpos($planLower, 'link') !== false) {
        $planTypeLabel = 'Evaluacion de Links del Cliente';
    }
    
    // Count valid options
    $validOptions = array_filter($analysisResults, function($r) {
        return !empty($r['link']['url']);
    });
    $optionCount = count($validOptions);
    
    // Top recommendations (top 3 or those with score >= 65)
    $topRecommendations = array_slice(array_filter($analysisResults, function($r) {
        return $r['score'] >= 60 && !empty($r['link']['url']);
    }), 0, 3);
    
    $html = '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reporte de Busqueda - ' . $clientName . ' - ' . $orderNumber . '</title>
<style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; background: #f8fafc; line-height: 1.6; }
    
    .report-container { max-width: 900px; margin: 0 auto; background: #fff; }
    
    /* Cover Page */
    .cover-page {
        background: linear-gradient(135deg, #0a1628 0%, #1a365d 50%, #0f4c75 100%);
        color: #fff; padding: 60px 50px; min-height: 400px;
        display: flex; flex-direction: column; justify-content: center;
        position: relative; overflow: hidden;
    }
    .cover-page::before {
        content: ""; position: absolute; top: -50px; right: -50px;
        width: 250px; height: 250px; background: rgba(59,130,246,0.1);
        border-radius: 50%;
    }
    .cover-page::after {
        content: ""; position: absolute; bottom: -30px; left: -30px;
        width: 180px; height: 180px; background: rgba(6,182,212,0.08);
        border-radius: 50%;
    }
    .cover-logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
    .cover-logo span { color: #60a5fa; }
    .cover-subtitle { font-size: 13px; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; }
    .cover-title { font-size: 32px; font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
    .cover-plan { display: inline-block; padding: 6px 18px; background: rgba(59,130,246,0.2); border-radius: 8px; font-size: 14px; font-weight: 600; color: #93c5fd; margin-bottom: 30px; }
    .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .cover-meta-item { font-size: 13px; }
    .cover-meta-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .cover-meta-value { color: #e2e8f0; font-weight: 500; margin-top: 2px; }
    
    /* Sections */
    .section { padding: 40px 50px; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    .section-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
    .section-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .section-subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    
    /* Requirements */
    .req-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; }
    .req-box p { font-size: 14px; color: #1e40af; line-height: 1.7; }
    
    /* Methodology */
    .method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .method-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; }
    .method-dot { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; margin-top: 5px; flex-shrink: 0; }
    .method-text { font-size: 13px; color: #475569; }
    
    /* Options Table */
    .options-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .options-table thead th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .options-table tbody td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .options-table tbody tr:hover { background: #fafbfc; }
    .opt-img { width: 70px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    .opt-rank { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #fff; }
    .rank-high { background: linear-gradient(135deg, #10b981, #059669); }
    .rank-medium { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .rank-low { background: linear-gradient(135deg, #94a3b8, #64748b); }
    .score-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .score-high { background: #dcfce7; color: #166534; }
    .score-medium { background: #fef3c7; color: #92400e; }
    .score-low { background: #f1f5f9; color: #64748b; }
    
    /* Recommendation badge */
    .rec-badge { display: inline-block; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .rec-high { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534; border: 1px solid #86efac; }
    .rec-medium { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; border: 1px solid #fbbf24; }
    .rec-low { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    
    /* Top Recommendations */
    .top-rec { background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #bbf7d0; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
    .top-rec-header { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
    .top-rec-rank { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; }
    .top-rec-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .top-rec-score { font-size: 12px; color: #059669; font-weight: 600; }
    .top-rec-summary { font-size: 14px; color: #475569; line-height: 1.7; }
    
    /* Detail Cards */
    .detail-card { border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px; }
    .detail-header { background: linear-gradient(135deg, #0f172a, #1e3a5f); padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
    .detail-num { width: 36px; height: 36px; border-radius: 10px; background: rgba(59,130,246,0.2); color: #93c5fd; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
    .detail-title { color: #fff; font-size: 16px; font-weight: 600; flex: 1; }
    .detail-body { padding: 24px; }
    .detail-grid { display: grid; grid-template-columns: 200px 1fr; gap: 20px; margin-bottom: 20px; }
    .detail-img { width: 200px; height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid #e2e8f0; }
    .detail-img-placeholder { width: 200px; height: 150px; border-radius: 12px; border: 2px dashed #d1d5db; background: #f8fafc; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; }
    .detail-info { font-size: 13px; }
    .detail-info-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .detail-info-label { color: #94a3b8; font-weight: 600; min-width: 100px; font-size: 12px; text-transform: uppercase; }
    .detail-info-value { color: #1e293b; font-weight: 500; }
    .detail-link { color: #3b82f6; text-decoration: none; font-weight: 500; word-break: break-all; }
    .detail-link:hover { text-decoration: underline; }
    
    /* AI Analysis */
    .ai-section { background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 16px; }
    .ai-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .ai-list { list-style: none; padding: 0; }
    .ai-list li { font-size: 13px; padding: 6px 0; display: flex; align-items: flex-start; gap: 8px; }
    .ai-pro::before { content: "+"; display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; align-items: center; justify-content: center; flex-shrink: 0; }
    .ai-risk::before { content: "!"; display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; align-items: center; justify-content: center; flex-shrink: 0; }
    .ai-note::before { content: "i"; display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 800; align-items: center; justify-content: center; flex-shrink: 0; font-style: italic; }
    
    /* Next Steps */
    .steps-list { counter-reset: step; }
    .step-item { display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
    .step-item:last-child { border-bottom: none; }
    .step-num { counter-increment: step; width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .step-content h4 { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .step-content p { font-size: 13px; color: #64748b; }
    
    /* Footer */
    .report-footer { background: #0f172a; color: #94a3b8; padding: 30px 50px; text-align: center; font-size: 12px; }
    .report-footer a { color: #60a5fa; text-decoration: none; }
    
    /* Print styles */
    @media print {
        body { background: #fff; }
        .report-container { box-shadow: none; }
        .section { page-break-inside: avoid; }
        .detail-card { page-break-inside: avoid; }
        .cover-page { page-break-after: always; }
    }
    
    @media (max-width: 640px) {
        .section { padding: 24px 20px; }
        .cover-page { padding: 40px 20px; }
        .cover-meta { grid-template-columns: 1fr; }
        .method-grid { grid-template-columns: 1fr; }
        .detail-grid { grid-template-columns: 1fr; }
        .detail-img, .detail-img-placeholder { width: 100%; }
        .cover-title { font-size: 24px; }
    }
</style>
</head>
<body>
<div class="report-container">';

    // === COVER PAGE ===
    $html .= '
    <div class="cover-page">
        <div class="cover-logo">IMPOR<span>LAN</span></div>
        <div class="cover-subtitle">Especialistas en Importacion de Embarcaciones</div>
        <div class="cover-title">Reporte de Busqueda<br>de Embarcacion</div>
        <div class="cover-plan">' . htmlspecialchars($planTypeLabel) . '</div>
        <div class="cover-meta">
            <div class="cover-meta-item">
                <div class="cover-meta-label">Cliente</div>
                <div class="cover-meta-value">' . $clientName . '</div>
            </div>
            <div class="cover-meta-item">
                <div class="cover-meta-label">Expediente</div>
                <div class="cover-meta-value">' . $orderNumber . '</div>
            </div>
            <div class="cover-meta-item">
                <div class="cover-meta-label">Fecha</div>
                <div class="cover-meta-value">' . $date . '</div>
            </div>
            <div class="cover-meta-item">
                <div class="cover-meta-label">Asesor</div>
                <div class="cover-meta-value">' . $agentName . '</div>
            </div>
            <div class="cover-meta-item">
                <div class="cover-meta-label">Version</div>
                <div class="cover-meta-value">v' . $reportVersion . '</div>
            </div>
            <div class="cover-meta-item">
                <div class="cover-meta-label">Opciones Encontradas</div>
                <div class="cover-meta-value">' . $optionCount . ' embarcaciones</div>
            </div>
        </div>
    </div>';

    // === CLIENT REQUIREMENTS ===
    $html .= '
    <div class="section">
        <div class="section-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="section-title">Requerimientos del Cliente</div>
        <div class="section-subtitle">Criterios de busqueda definidos para este expediente</div>
        <div class="req-box">
            <p><strong>Requerimiento:</strong> ' . (!empty($requirement) ? $requirement : 'Busqueda general de embarcacion') . '</p>';
    if (!empty($assetName)) {
        $html .= '<p style="margin-top:8px"><strong>Embarcacion / Objetivo:</strong> ' . $assetName . '</p>';
    }
    if (!empty($typeZone)) {
        $html .= '<p style="margin-top:8px"><strong>Zona / Tipo:</strong> ' . $typeZone . '</p>';
    }
    $html .= '
            <p style="margin-top:8px"><strong>Plan contratado:</strong> ' . htmlspecialchars($planTypeLabel) . '</p>
        </div>
    </div>';

    // === SEARCH METHODOLOGY ===
    $html .= '
    <div class="section">
        <div class="section-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div class="section-title">Metodologia de Busqueda</div>
        <div class="section-subtitle">Proceso aplicado para identificar las mejores opciones</div>
        <div class="method-grid">
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Busqueda en marketplaces especializados de USA (Boat Trader, Boats.com, Facebook Marketplace, Craigslist)</div></div>
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Analisis de relacion precio vs condicion mecanica y estetica</div></div>
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Evaluacion de reputacion de marca y modelo especifico</div></div>
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Preferencia por embarcaciones de agua dulce (menor desgaste)</div></div>
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Factibilidad logistica de transporte terrestre y maritimo</div></div>
            <div class="method-item"><div class="method-dot"></div><div class="method-text">Scoring IA de cada opcion basado en multiples criterios</div></div>
        </div>
    </div>';

    // === OPTIONS SUMMARY TABLE ===
    $html .= '
    <div class="section">
        <div class="section-icon" style="background: linear-gradient(135deg, #0891b2, #06b6d4);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        </div>
        <div class="section-title">Resumen de Opciones</div>
        <div class="section-subtitle">' . $optionCount . ' embarcaciones evaluadas, ordenadas por puntaje de recomendacion</div>
        <div style="overflow-x:auto;border-radius:12px;border:1px solid #e2e8f0">
        <table class="options-table">
            <thead><tr>
                <th style="width:44px">Rank</th>
                <th style="width:80px">Imagen</th>
                <th>Modelo / Link</th>
                <th>Ubicacion</th>
                <th style="text-align:right">Precio USD</th>
                <th style="text-align:center">Score</th>
                <th style="text-align:center">Recomendacion</th>
            </tr></thead>
            <tbody>';
    
    $rank = 0;
    foreach ($analysisResults as $r) {
        if (empty($r['link']['url'])) continue;
        $rank++;
        $link = $r['link'];
        $rankClass = $r['recommendation_class'] === 'high' ? 'rank-high' : ($r['recommendation_class'] === 'medium' ? 'rank-medium' : 'rank-low');
        $scoreClass = $r['score'] >= 70 ? 'score-high' : ($r['score'] >= 50 ? 'score-medium' : 'score-low');
        $recClass = 'rec-' . $r['recommendation_class'];
        
        $imgHtml = !empty($link['image_url']) 
            ? '<img src="' . htmlspecialchars($link['image_url']) . '" class="opt-img" alt="Boat">'
            : '<div style="width:70px;height:52px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px">Sin imagen</div>';
        
        $titleText = !empty($link['title']) ? htmlspecialchars($link['title']) : 'Opcion ' . $rank;
        $priceHtml = floatval($link['value_usa_usd'] ?? 0) > 0 
            ? '$' . number_format(floatval($link['value_usa_usd']), 0, '.', ',')
            : '-';
        
        $html .= '<tr>
            <td><span class="opt-rank ' . $rankClass . '">' . $rank . '</span></td>
            <td>' . $imgHtml . '</td>
            <td><div style="font-weight:600;font-size:13px;color:#0f172a;margin-bottom:2px">' . $titleText . '</div><a href="' . htmlspecialchars($link['url'] ?? '') . '" target="_blank" style="font-size:11px;color:#3b82f6;text-decoration:none;word-break:break-all">' . htmlspecialchars(substr($link['url'] ?? '', 0, 50)) . '</a></td>
            <td style="font-size:12px;color:#475569">' . htmlspecialchars($link['location'] ?? '-') . '</td>
            <td style="text-align:right;font-weight:700;color:#059669">' . $priceHtml . '</td>
            <td style="text-align:center"><span class="score-badge ' . $scoreClass . '">' . $r['score'] . '/100</span></td>
            <td style="text-align:center"><span class="rec-badge ' . $recClass . '">' . $r['recommendation_level'] . '</span></td>
        </tr>';
    }
    
    $html .= '</tbody></table></div></div>';

    // === TOP RECOMMENDATIONS ===
    if (!empty($topRecommendations)) {
        $html .= '
        <div class="section">
            <div class="section-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div class="section-title">Mejores Recomendaciones</div>
            <div class="section-subtitle">Las opciones con mayor puntaje y perfil de compra mas favorable</div>';
        
        $topRank = 0;
        foreach ($topRecommendations as $r) {
            $topRank++;
            $link = $r['link'];
            $titleText = !empty($link['title']) ? htmlspecialchars($link['title']) : 'Opcion ' . $topRank;
            
            $html .= '
            <div class="top-rec">
                <div class="top-rec-header">
                    <div class="top-rec-rank">' . $topRank . '</div>
                    <div>
                        <div class="top-rec-title">' . $titleText . '</div>
                        <div class="top-rec-score">Score: ' . $r['score'] . '/100 - ' . $r['recommendation_level'] . '</div>
                    </div>
                </div>
                <div class="top-rec-summary">' . htmlspecialchars($r['summary']) . '</div>
            </div>';
        }
        $html .= '</div>';
    }

    // === DETAIL SECTIONS FOR EACH BOAT ===
    $html .= '
    <div class="section">
        <div class="section-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V4h14v16"/><path d="M9 8h6"/><path d="M9 12h6"/></svg>
        </div>
        <div class="section-title">Detalle por Opcion</div>
        <div class="section-subtitle">Analisis individual de cada embarcacion evaluada</div>';
    
    $detailRank = 0;
    foreach ($analysisResults as $r) {
        if (empty($r['link']['url'])) continue;
        $detailRank++;
        $link = $r['link'];
        $recClass = 'rec-' . $r['recommendation_class'];
        $titleText = !empty($link['title']) ? htmlspecialchars($link['title']) : 'Opcion ' . $detailRank;
        
        $imgHtml = !empty($link['image_url'])
            ? '<img src="' . htmlspecialchars($link['image_url']) . '" class="detail-img" alt="Boat">'
            : '<div class="detail-img-placeholder">Sin imagen disponible</div>';
        
        $priceUsd = floatval($link['value_usa_usd'] ?? 0);
        $negotiateUsd = floatval($link['value_to_negotiate_usd'] ?? 0);
        $priceCLP = floatval($link['value_chile_clp'] ?? 0);
        $priceNegCLP = floatval($link['value_chile_negotiated_clp'] ?? 0);
        
        $html .= '
        <div class="detail-card">
            <div class="detail-header">
                <div class="detail-num">' . $detailRank . '</div>
                <div class="detail-title">' . $titleText . '</div>
                <span class="rec-badge ' . $recClass . '">' . $r['recommendation_level'] . '</span>
            </div>
            <div class="detail-body">
                <div class="detail-grid">
                    <div>' . $imgHtml . '</div>
                    <div class="detail-info">
                        <div class="detail-info-row"><div class="detail-info-label">Link</div><div class="detail-info-value"><a href="' . htmlspecialchars($link['url'] ?? '') . '" target="_blank" class="detail-link">' . htmlspecialchars(substr($link['url'] ?? '', 0, 60)) . '</a></div></div>
                        <div class="detail-info-row"><div class="detail-info-label">Ubicacion</div><div class="detail-info-value">' . htmlspecialchars($link['location'] ?? 'No especificada') . '</div></div>
                        <div class="detail-info-row"><div class="detail-info-label">Horas Motor</div><div class="detail-info-value">' . htmlspecialchars($link['hours'] ?? 'No informadas') . '</div></div>
                        <div class="detail-info-row"><div class="detail-info-label">Precio USA</div><div class="detail-info-value" style="font-weight:700;color:#059669">' . ($priceUsd > 0 ? '$' . number_format($priceUsd, 2) . ' USD' : 'No especificado') . '</div></div>';
        if ($negotiateUsd > 0) {
            $html .= '<div class="detail-info-row"><div class="detail-info-label">Negociacion</div><div class="detail-info-value" style="font-weight:600;color:#0891b2">$' . number_format($negotiateUsd, 2) . ' USD</div></div>';
        }
        if ($priceCLP > 0) {
            $html .= '<div class="detail-info-row"><div class="detail-info-label">Est. Chile</div><div class="detail-info-value" style="font-weight:700;color:#2563eb">$' . number_format($priceCLP, 0, ',', '.') . ' CLP</div></div>';
        }
        if ($priceNegCLP > 0) {
            $html .= '<div class="detail-info-row"><div class="detail-info-label">Neg. Chile</div><div class="detail-info-value" style="font-weight:600;color:#2563eb">$' . number_format($priceNegCLP, 0, ',', '.') . ' CLP</div></div>';
        }
        $html .= '<div class="detail-info-row"><div class="detail-info-label">Score IA</div><div class="detail-info-value"><span class="score-badge ' . ($r['score'] >= 70 ? 'score-high' : ($r['score'] >= 50 ? 'score-medium' : 'score-low')) . '">' . $r['score'] . '/100</span></div></div>
                    </div>
                </div>';
        
        // AI Analysis section
        $html .= '<div class="ai-section">
                    <div class="ai-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg> Evaluacion IA</div>';
        
        if (!empty($r['pros'])) {
            $html .= '<div style="margin-bottom:10px"><strong style="font-size:12px;color:#166534">Ventajas:</strong><ul class="ai-list">';
            foreach ($r['pros'] as $pro) {
                $html .= '<li class="ai-pro">' . htmlspecialchars($pro) . '</li>';
            }
            $html .= '</ul></div>';
        }
        
        if (!empty($r['risks'])) {
            $html .= '<div style="margin-bottom:10px"><strong style="font-size:12px;color:#92400e">Riesgos:</strong><ul class="ai-list">';
            foreach ($r['risks'] as $risk) {
                $html .= '<li class="ai-risk">' . htmlspecialchars($risk) . '</li>';
            }
            $html .= '</ul></div>';
        }
        
        if (!empty($r['inspection_notes'])) {
            $html .= '<div><strong style="font-size:12px;color:#0369a1">Notas de Inspeccion:</strong><ul class="ai-list">';
            foreach ($r['inspection_notes'] as $note) {
                $html .= '<li class="ai-note">' . htmlspecialchars($note) . '</li>';
            }
            $html .= '</ul></div>';
        }
        
        $html .= '</div>'; // ai-section
        
        // Comments
        if (!empty($link['comments'])) {
            $html .= '<div style="margin-top:14px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e"><strong>Comentario del asesor:</strong> ' . htmlspecialchars($link['comments']) . '</div>';
        }
        
        $html .= '</div></div>'; // detail-body, detail-card
    }
    
    $html .= '</div>'; // section

    // === NEXT STEPS ===
    $html .= '
    <div class="section">
        <div class="section-icon" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div class="section-title">Proximos Pasos</div>
        <div class="section-subtitle">El proceso Imporlan para completar tu importacion</div>
        <div class="steps-list">
            <div class="step-item">
                <div class="step-num">1</div>
                <div class="step-content">
                    <h4>Inspeccion Pre-compra</h4>
                    <p>Coordinamos una inspeccion profesional de la embarcacion seleccionada con nuestros agentes en USA. Incluye revision mecanica, estructural y documentacion.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-num">2</div>
                <div class="step-content">
                    <h4>Negociacion</h4>
                    <p>Nuestro equipo negocia directamente con el vendedor para obtener el mejor precio posible, incluyendo condiciones de pago y garantias.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-num">3</div>
                <div class="step-content">
                    <h4>Logistica y Transporte</h4>
                    <p>Gestionamos el transporte terrestre hasta el puerto de origen, embalaje profesional y documentacion de exportacion en USA.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-num">4</div>
                <div class="step-content">
                    <h4>Envio Maritimo</h4>
                    <p>Coordinamos el envio maritimo con navieras especializadas, seguimiento GPS en tiempo real y seguro de transporte.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-num">5</div>
                <div class="step-content">
                    <h4>Importacion a Chile</h4>
                    <p>Tramites de internacion ante Aduanas de Chile, pago de impuestos, inscripcion en DIRECTEMAR y entrega de la embarcacion en puerto destino.</p>
                </div>
            </div>
        </div>
    </div>';

    // === FOOTER ===
    $html .= '
    <div class="report-footer">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">IMPOR<span style="color:#60a5fa">LAN</span></div>
        <p style="margin-bottom:8px">Especialistas en Importacion de Embarcaciones desde USA a Chile</p>
        <p><a href="https://www.imporlan.cl">www.imporlan.cl</a> | <a href="mailto:contacto@imporlan.cl">contacto@imporlan.cl</a></p>
        <p style="margin-top:12px;font-size:11px;color:#64748b">Reporte generado el ' . $dateTime . ' | Expediente ' . $orderNumber . ' | Version v' . $reportVersion . '</p>
        <p style="margin-top:4px;font-size:10px;color:#475569">Este documento es confidencial y de uso exclusivo del cliente. Su contenido no debe ser compartido con terceros sin autorizacion.</p>
    </div>';

    $html .= '</div></body></html>';
    
    return $html;
}

// ============================================================
// CORE API FUNCTIONS
// ============================================================

function sendReport() {
    $orderId = intval($_GET['id'] ?? 0);
    if (!$orderId) {
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = intval($input['id'] ?? 0);
    }

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id del expediente']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        // 1. Load expediente
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Expediente no encontrado']);
            return;
        }

        // 2. Load boat options (links) in priority order
        $linkStmt = $pdo->prepare("SELECT * FROM order_links WHERE order_id = ? ORDER BY row_index ASC");
        $linkStmt->execute([$orderId]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        // Filter out empty links
        $validLinks = array_filter($links, function($l) {
            return !empty($l['url']);
        });

        if (empty($validLinks)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay links con opciones en el expediente. Agrega al menos un link antes de generar el reporte.']);
            return;
        }

        // 3. Run AI analysis
        $analysisResults = [];
        try {
            $analyzer = new BoatReportAnalyzer();
            $analysisResults = $analyzer->analyzeOptions($validLinks, $order);
        } catch (Exception $e) {
            // Failsafe: generate without AI
            error_log("AI analysis failed: " . $e->getMessage());
            foreach ($validLinks as $idx => $link) {
                $analysisResults[] = [
                    'link' => $link,
                    'link_index' => $idx,
                    'score' => 50,
                    'brand_detected' => '',
                    'summary' => 'Opcion de embarcacion disponible para evaluacion.',
                    'pros' => [],
                    'risks' => ['Analisis automatico no disponible - evaluar manualmente'],
                    'inspection_notes' => ['Se recomienda inspeccion profesional'],
                    'recommendation_level' => 'Prioridad Media',
                    'recommendation_class' => 'medium',
                ];
            }
        }

        // 4. Determine version
        $versionStmt = $pdo->prepare("SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM reports WHERE order_id = ?");
        $versionStmt->execute([$orderId]);
        $version = intval($versionStmt->fetch(PDO::FETCH_ASSOC)['next_version']);

        // 5. Generate access token
        $accessToken = bin2hex(random_bytes(32));
        $tokenExpires = date('Y-m-d H:i:s', time() + (48 * 3600)); // 48 hours

        // 6. Generate HTML report
        $htmlContent = generateReportHtml($order, $validLinks, $analysisResults, $version, $accessToken);

        // 7. Save report record
        $input = json_decode(file_get_contents('php://input'), true);
        $adminUser = $input['admin_user'] ?? 'admin';
        
        $insertStmt = $pdo->prepare("
            INSERT INTO reports (order_id, created_by_admin, report_type, plan_type, version, html_content, analysis_json, access_token, token_expires_at)
            VALUES (?, ?, 'boat_search', ?, ?, ?, ?, ?, ?)
        ");
        $insertStmt->execute([
            $orderId,
            $adminUser,
            $order['plan_name'] ?? 'Plan de Busqueda',
            $version,
            $htmlContent,
            json_encode(['results' => $analysisResults, 'generated_at' => date('c')]),
            $accessToken,
            $tokenExpires
        ]);
        $reportId = intval($pdo->lastInsertId());

        // 8. Create notification for client
        $notifStmt = $pdo->prepare("
            INSERT INTO notifications (user_email, type, title, message, link)
            VALUES (?, 'report', ?, ?, ?)
        ");
        $reportLink = 'https://www.imporlan.cl/api/reports_api.php?action=view_report&report_id=' . $reportId . '&token=' . $accessToken;
        $notifStmt->execute([
            $order['customer_email'],
            'Nuevo reporte disponible',
            'Tu asesor ha generado un reporte con las opciones de embarcaciones encontradas para tu expediente ' . $order['order_number'] . '.',
            $reportLink
        ]);

        // 9. Send email to client + CC to contacto@imporlan.cl
        $emailResult = sendReportEmail($order, $reportId, $accessToken, $version);

        // 10. Log event
        if (function_exists('logOrderEvent')) {
            logOrderEvent($pdo, $orderId, 'report_sent', [
                'report_id' => $reportId,
                'version' => $version,
                'email_sent' => $emailResult['success'] ?? false
            ], $adminUser);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Reporte enviado correctamente al cliente.',
            'report_id' => $reportId,
            'version' => $version,
            'email_sent' => $emailResult['success'] ?? false,
            'report_url' => $reportLink
        ]);

    } catch (Exception $e) {
        error_log("Error sending report: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al generar reporte: ' . $e->getMessage()]);
    }
}

function previewReport() {
    $orderId = intval($_GET['id'] ?? 0);
    if (!$orderId) {
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = intval($input['id'] ?? 0);
    }

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere id del expediente']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['error' => 'Expediente no encontrado']);
            return;
        }

        $linkStmt = $pdo->prepare("SELECT * FROM order_links WHERE order_id = ? ORDER BY row_index ASC");
        $linkStmt->execute([$orderId]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        $validLinks = array_filter($links, function($l) { return !empty($l['url']); });

        if (empty($validLinks)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay links con opciones en el expediente.']);
            return;
        }

        // Run AI analysis
        $analysisResults = [];
        try {
            $analyzer = new BoatReportAnalyzer();
            $analysisResults = $analyzer->analyzeOptions($validLinks, $order);
        } catch (Exception $e) {
            foreach ($validLinks as $idx => $link) {
                $analysisResults[] = [
                    'link' => $link, 'link_index' => $idx, 'score' => 50,
                    'brand_detected' => '', 'summary' => 'Opcion disponible para evaluacion.',
                    'pros' => [], 'risks' => [], 'inspection_notes' => [],
                    'recommendation_level' => 'Prioridad Media', 'recommendation_class' => 'medium',
                ];
            }
        }

        $versionStmt = $pdo->prepare("SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM reports WHERE order_id = ?");
        $versionStmt->execute([$orderId]);
        $version = intval($versionStmt->fetch(PDO::FETCH_ASSOC)['next_version']);

        $htmlContent = generateReportHtml($order, $validLinks, $analysisResults, $version, 'preview');

        echo json_encode([
            'success' => true,
            'html' => $htmlContent,
            'analysis' => $analysisResults,
            'version' => $version,
            'options_count' => count($validLinks)
        ]);

    } catch (Exception $e) {
        error_log("Error previewing report: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al generar preview: ' . $e->getMessage()]);
    }
}

function listReports() {
    $orderId = intval($_GET['order_id'] ?? 0);

    if (!$orderId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere order_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, order_id, created_by_admin, created_at, report_type, plan_type, version, access_token, token_expires_at
            FROM reports WHERE order_id = ? ORDER BY version DESC
        ");
        $stmt->execute([$orderId]);
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Add view URLs
        foreach ($reports as &$r) {
            $r['view_url'] = 'https://www.imporlan.cl/api/reports_api.php?action=view_report&report_id=' . $r['id'] . '&token=' . $r['access_token'];
            $r['download_url'] = 'https://www.imporlan.cl/api/reports_api.php?action=download_pdf&report_id=' . $r['id'] . '&token=' . $r['access_token'];
        }

        echo json_encode(['success' => true, 'reports' => $reports]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al listar reportes: ' . $e->getMessage()]);
    }
}

function viewReport() {
    $reportId = intval($_GET['report_id'] ?? 0);
    $token = $_GET['token'] ?? '';

    if (!$reportId || empty($token)) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Enlace invalido</h2><p>El enlace del reporte es invalido o ha expirado.</p><a href="https://www.imporlan.cl/panel/">Ir al Panel</a></body></html>';
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Error</h2><p>No se pudo acceder al reporte. Intenta nuevamente.</p></body></html>';
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM reports WHERE id = ? AND access_token = ?");
        $stmt->execute([$reportId, $token]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$report) {
            header('Content-Type: text/html; charset=utf-8');
            echo '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Reporte no encontrado</h2><p>El enlace es invalido o el reporte no existe.</p><a href="https://www.imporlan.cl/panel/">Ir al Panel</a></body></html>';
            return;
        }

        // Check token expiration (allow access but show warning if expired)
        $expired = false;
        if (!empty($report['token_expires_at']) && strtotime($report['token_expires_at']) < time()) {
            $expired = true;
        }

        header('Content-Type: text/html; charset=utf-8');
        
        if ($expired) {
            // Still show report but add expiry notice
            $notice = '<div style="background:#fef3c7;border-bottom:2px solid #f59e0b;padding:12px 20px;text-align:center;font-family:sans-serif;font-size:13px;color:#92400e">Este enlace ha expirado. Para acceder al reporte actualizado, ingresa a tu <a href="https://www.imporlan.cl/panel/" style="color:#1d4ed8;font-weight:600">Panel de Usuario</a>.</div>';
            echo $notice;
        }
        
        echo $report['html_content'];

    } catch (PDOException $e) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Error</h2><p>Error al cargar el reporte.</p></body></html>';
    }
}

function downloadPdf() {
    $reportId = intval($_GET['report_id'] ?? 0);
    $token = $_GET['token'] ?? '';

    if (!$reportId || empty($token)) {
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere report_id y token']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT r.*, o.order_number, o.customer_name FROM reports r JOIN orders o ON r.order_id = o.id WHERE r.id = ? AND r.access_token = ?");
        $stmt->execute([$reportId, $token]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$report) {
            header('Content-Type: application/json');
            http_response_code(404);
            echo json_encode(['error' => 'Reporte no encontrado']);
            return;
        }

        // Generate PDF filename
        $filename = 'Reporte_' . ($report['order_number'] ?? 'N-A') . '_v' . $report['version'] . '.pdf';

        // Check if wkhtmltopdf is available
        $wkhtmltopdf = '/usr/local/bin/wkhtmltopdf';
        if (!file_exists($wkhtmltopdf)) {
            $wkhtmltopdf = trim(shell_exec('which wkhtmltopdf 2>/dev/null'));
        }

        if (!empty($wkhtmltopdf) && file_exists($wkhtmltopdf)) {
            // Use wkhtmltopdf for PDF generation
            $tmpHtml = tempnam(sys_get_temp_dir(), 'report_') . '.html';
            $tmpPdf = tempnam(sys_get_temp_dir(), 'report_') . '.pdf';
            file_put_contents($tmpHtml, $report['html_content']);

            $cmd = escapeshellcmd($wkhtmltopdf) . ' --page-size A4 --margin-top 0 --margin-bottom 0 --margin-left 0 --margin-right 0 --encoding UTF-8 --enable-local-file-access ' . escapeshellarg($tmpHtml) . ' ' . escapeshellarg($tmpPdf) . ' 2>&1';
            exec($cmd, $output, $returnCode);

            if ($returnCode === 0 && file_exists($tmpPdf)) {
                header('Content-Type: application/pdf');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                header('Content-Length: ' . filesize($tmpPdf));
                readfile($tmpPdf);
                unlink($tmpHtml);
                unlink($tmpPdf);
                return;
            }
            @unlink($tmpHtml);
            @unlink($tmpPdf);
        }

        // Fallback: serve HTML as downloadable file with print-to-PDF instructions
        $htmlWithPrintBtn = str_replace('</body>', '<script>if(confirm("Para descargar como PDF, usa Ctrl+P (o Cmd+P) y selecciona Guardar como PDF.\\n\\nPresiona OK para abrir el dialogo de impresion.")){window.print();}</script></body>', $report['html_content']);
        
        header('Content-Type: text/html; charset=utf-8');
        echo $htmlWithPrintBtn;

    } catch (PDOException $e) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Error al generar PDF: ' . $e->getMessage()]);
    }
}

function resendReport() {
    $input = json_decode(file_get_contents('php://input'), true);
    $reportId = intval($input['report_id'] ?? $_GET['report_id'] ?? 0);

    if (!$reportId) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere report_id']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT r.*, o.customer_email, o.customer_name, o.order_number, o.agent_name, o.plan_name FROM reports r JOIN orders o ON r.order_id = o.id WHERE r.id = ?");
        $stmt->execute([$reportId]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$report) {
            http_response_code(404);
            echo json_encode(['error' => 'Reporte no encontrado']);
            return;
        }

        // Refresh token
        $newToken = bin2hex(random_bytes(32));
        $newExpiry = date('Y-m-d H:i:s', time() + (48 * 3600));
        $pdo->prepare("UPDATE reports SET access_token = ?, token_expires_at = ? WHERE id = ?")->execute([$newToken, $newExpiry, $reportId]);

        // Create new notification
        $reportLink = 'https://www.imporlan.cl/api/reports_api.php?action=view_report&report_id=' . $reportId . '&token=' . $newToken;
        $notifStmt = $pdo->prepare("INSERT INTO notifications (user_email, type, title, message, link) VALUES (?, 'report', ?, ?, ?)");
        $notifStmt->execute([
            $report['customer_email'],
            'Reporte reenviado',
            'Se ha reenviado el reporte de embarcaciones para tu expediente ' . $report['order_number'] . '.',
            $reportLink
        ]);

        // Resend email
        $order = [
            'customer_email' => $report['customer_email'],
            'customer_name' => $report['customer_name'],
            'order_number' => $report['order_number'],
            'agent_name' => $report['agent_name'],
            'plan_name' => $report['plan_name'],
        ];
        $emailResult = sendReportEmail($order, $reportId, $newToken, $report['version']);

        echo json_encode([
            'success' => true,
            'message' => 'Reporte reenviado correctamente.',
            'email_sent' => $emailResult['success'] ?? false
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al reenviar: ' . $e->getMessage()]);
    }
}

function userListReports() {
    // Require user authentication
    $userPayload = requireUserAuthShared();
    $authenticatedEmail = $userPayload['email'] ?? '';

    $userEmail = $_GET['user_email'] ?? '';

    if (empty($userEmail)) {
        http_response_code(400);
        echo json_encode(['error' => 'Se requiere user_email']);
        return;
    }

    // Verify the authenticated user can only access their own reports
    if (!empty($authenticatedEmail) && strtolower($authenticatedEmail) !== strtolower($userEmail)) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado para ver reportes de otro usuario']);
        return;
    }

    $pdo = getDbConnection();
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT r.id, r.order_id, r.created_at, r.plan_type, r.version, r.access_token, r.token_expires_at,
                   o.order_number, o.customer_name, o.agent_name
            FROM reports r
            JOIN orders o ON r.order_id = o.id
            WHERE o.customer_email = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$userEmail]);
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($reports as &$r) {
            $r['view_url'] = 'https://www.imporlan.cl/api/reports_api.php?action=view_report&report_id=' . $r['id'] . '&token=' . $r['access_token'];
            $r['download_url'] = 'https://www.imporlan.cl/api/reports_api.php?action=download_pdf&report_id=' . $r['id'] . '&token=' . $r['access_token'];
        }

        echo json_encode(['success' => true, 'reports' => $reports]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al listar reportes: ' . $e->getMessage()]);
    }
}

// ============================================================
// EMAIL DELIVERY
// ============================================================

function sendReportEmail($order, $reportId, $accessToken, $version) {
    try {
        require_once __DIR__ . '/email_service.php';
        $emailService = new EmailService();

        $clientEmail = $order['customer_email'] ?? '';
        $clientName = $order['customer_name'] ?? 'Cliente';
        $firstName = explode(' ', $clientName)[0];
        $orderNumber = $order['order_number'] ?? '';
        
        $reportViewUrl = 'https://www.imporlan.cl/api/reports_api.php?action=view_report&report_id=' . $reportId . '&token=' . $accessToken;
        $reportDownloadUrl = 'https://www.imporlan.cl/api/reports_api.php?action=download_pdf&report_id=' . $reportId . '&token=' . $accessToken;

        // Send to client
        $subject = 'Reporte de Busqueda de Embarcacion - ' . $orderNumber;
        $body = buildReportEmailBody($firstName, $orderNumber, $reportViewUrl, $reportDownloadUrl, $version);
        
        $result = $emailService->sendCustomEmail(
            $clientEmail,
            $subject,
            $body
        );

        // Send copy to contacto@imporlan.cl
        try {
            $adminSubject = '[Copia] Reporte enviado a ' . $clientEmail . ' - ' . $orderNumber;
            $emailService->sendCustomEmail(
                'contacto@imporlan.cl',
                $adminSubject,
                $body
            );
        } catch (Exception $e) {
            error_log("Error sending admin copy: " . $e->getMessage());
        }

        return $result;
    } catch (Exception $e) {
        error_log("Error sending report email: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function buildReportEmailBody($firstName, $orderNumber, $viewUrl, $downloadUrl, $version) {
    return '
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
        <div style="background:linear-gradient(135deg,#0a1628,#1a365d);padding:30px;border-radius:16px 16px 0 0;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#fff;margin-bottom:4px">IMPOR<span style="color:#60a5fa">LAN</span></div>
            <div style="font-size:12px;color:#94a3b8;letter-spacing:1px">ESPECIALISTAS EN IMPORTACION DE EMBARCACIONES</div>
        </div>
        <div style="background:#fff;padding:30px;border:1px solid #e2e8f0;border-top:none">
            <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px">Reporte de Busqueda de Embarcacion</h2>
            <p style="color:#64748b;font-size:14px;margin:0 0 24px">Expediente ' . htmlspecialchars($orderNumber) . ' - Version v' . $version . '</p>
            
            <p style="color:#1e293b;font-size:15px;line-height:1.7;margin-bottom:20px">
                Estimado/a ' . htmlspecialchars($firstName) . ',
            </p>
            <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:20px">
                Hemos preparado un reporte con las opciones de embarcaciones identificadas segun tus criterios de busqueda. 
                El reporte incluye un analisis detallado de cada opcion, evaluacion de riesgos y recomendaciones.
            </p>
            <p style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:24px">
                Puedes revisarlo directamente en tu panel o descargar el documento completo.
            </p>
            
            <div style="text-align:center;margin:24px 0">
                <a href="' . htmlspecialchars($viewUrl) . '" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;margin:0 6px">Ver Reporte</a>
                <a href="' . htmlspecialchars($downloadUrl) . '" style="display:inline-block;padding:14px 32px;background:#f1f5f9;color:#3b82f6;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;margin:0 6px;border:1px solid #e2e8f0">Descargar PDF</a>
            </div>
            
            <p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center">
                Este enlace expira en 48 horas. Tambien puedes acceder al reporte desde tu 
                <a href="https://www.imporlan.cl/panel/" style="color:#3b82f6">Panel de Usuario</a>.
            </p>
        </div>
        <div style="background:#f8fafc;padding:20px 30px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;text-align:center">
            <p style="color:#64748b;font-size:13px;margin:0">Saludos,<br><strong style="color:#0f172a">Equipo Imporlan</strong></p>
            <p style="color:#94a3b8;font-size:11px;margin:12px 0 0"><a href="https://www.imporlan.cl" style="color:#3b82f6;text-decoration:none">www.imporlan.cl</a> | contacto@imporlan.cl</p>
        </div>
    </div>';
}
