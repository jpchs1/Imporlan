<?php
/**
 * One-time script to create a test inspection for demo purposes.
 * DELETE this file after running it once.
 */
require_once __DIR__ . '/db_config.php';

$pdo = getDbConnection();
if (!$pdo) { die("DB connection failed"); }

// Create table if needed
$pdo->exec("
    CREATE TABLE IF NOT EXISTS wp_inspection_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        report_type ENUM('basica','estandar','premium') NOT NULL DEFAULT 'basica',
        status ENUM('draft','in_progress','completed','sent') NOT NULL DEFAULT 'draft',
        vessel_type VARCHAR(100) DEFAULT NULL,
        brand VARCHAR(255) DEFAULT NULL,
        model VARCHAR(255) DEFAULT NULL,
        vessel_year INT DEFAULT NULL,
        length_ft DECIMAL(10,2) DEFAULT NULL,
        hull_material VARCHAR(100) DEFAULT NULL,
        engine_brand VARCHAR(255) DEFAULT NULL,
        engine_model VARCHAR(255) DEFAULT NULL,
        engine_hours VARCHAR(50) DEFAULT NULL,
        num_engines INT DEFAULT 1,
        fuel_type VARCHAR(50) DEFAULT NULL,
        country VARCHAR(10) DEFAULT 'usa',
        state_region VARCHAR(255) DEFAULT NULL,
        city VARCHAR(255) DEFAULT NULL,
        marina VARCHAR(255) DEFAULT NULL,
        section_hull JSON DEFAULT NULL,
        section_engine JSON DEFAULT NULL,
        section_electrical JSON DEFAULT NULL,
        section_interior JSON DEFAULT NULL,
        section_trailer JSON DEFAULT NULL,
        section_navigation JSON DEFAULT NULL,
        section_safety JSON DEFAULT NULL,
        section_test_drive JSON DEFAULT NULL,
        section_documentation JSON DEFAULT NULL,
        photos_hull JSON DEFAULT NULL,
        photos_engine JSON DEFAULT NULL,
        photos_electrical JSON DEFAULT NULL,
        photos_interior JSON DEFAULT NULL,
        photos_trailer JSON DEFAULT NULL,
        photos_general JSON DEFAULT NULL,
        photos_test_drive JSON DEFAULT NULL,
        videos_test_drive JSON DEFAULT NULL,
        overall_rating DECIMAL(3,1) DEFAULT NULL,
        overall_summary TEXT DEFAULT NULL,
        recommendations TEXT DEFAULT NULL,
        inspector_name VARCHAR(255) DEFAULT NULL,
        inspector_notes TEXT DEFAULT NULL,
        price_usd DECIMAL(10,2) DEFAULT NULL,
        listing_url TEXT DEFAULT NULL,
        created_by VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_user_email (user_email),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$stmt = $pdo->prepare("INSERT INTO wp_inspection_reports (
    user_email, user_name, report_type, status,
    vessel_type, brand, model, vessel_year, length_ft, hull_material,
    engine_brand, engine_model, engine_hours, num_engines, fuel_type,
    country, state_region, city, marina,
    section_hull, section_engine, section_electrical, section_interior,
    section_trailer, section_navigation, section_safety, section_test_drive, section_documentation,
    overall_rating, overall_summary, recommendations, inspector_name,
    price_usd, listing_url, created_by, sent_at
) VALUES (
    :user_email, :user_name, :report_type, 'sent',
    :vessel_type, :brand, :model, :vessel_year, :length_ft, :hull_material,
    :engine_brand, :engine_model, :engine_hours, :num_engines, :fuel_type,
    :country, :state_region, :city, :marina,
    :section_hull, :section_engine, :section_electrical, :section_interior,
    :section_trailer, :section_navigation, :section_safety, :section_test_drive, :section_documentation,
    :overall_rating, :overall_summary, :recommendations, :inspector_name,
    :price_usd, :listing_url, :created_by, NOW()
)");

$stmt->execute([
    ':user_email' => 'jpchs1@gmail.com',
    ':user_name' => 'Juan Pablo',
    ':report_type' => 'premium',
    ':vessel_type' => 'Lancha',
    ':brand' => 'Bayliner',
    ':model' => 'VR5 Bowrider',
    ':vessel_year' => 2021,
    ':length_ft' => 19.5,
    ':hull_material' => 'Fibra de Vidrio',
    ':engine_brand' => 'Mercury',
    ':engine_model' => 'MerCruiser 4.5L',
    ':engine_hours' => '320',
    ':num_engines' => 1,
    ':fuel_type' => 'Gasolina',
    ':country' => 'usa',
    ':state_region' => 'Florida',
    ':city' => 'Miami',
    ':marina' => 'Biscayne Bay Marina',
    ':section_hull' => json_encode([
        'rating' => '8.5',
        'estado_general' => 'Buen estado',
        'gelcoat' => 'Normal - Desgaste minimo',
        'linea_de_agua' => 'Limpio',
        'quilla' => 'Buen estado',
        'proa' => 'Excelente',
        'popa' => 'Buen estado',
        'herrajes_exteriores' => 'Funcionando',
        'notes' => 'Casco en muy buenas condiciones generales. Pequenos rayones superficiales en gelcoat del lado estribor, no afectan integridad. Sin osmosis ni delaminacion.'
    ]),
    ':section_engine' => json_encode([
        'rating' => '7.8',
        'estado_general' => 'Buen estado',
        'arranque' => 'Funcionando',
        'ralenti' => 'Normal',
        'aceleracion' => 'Buen estado',
        'temperatura' => 'Normal',
        'presion_aceite' => 'Normal',
        'sistema_enfriamiento' => 'Funcionando',
        'correas_y_mangueras' => 'Buen estado',
        'notes' => 'Motor con 320 horas. Aceite limpio, sin fugas visibles. Se recomienda cambio de impeller de bomba de agua en proximo servicio.'
    ]),
    ':section_electrical' => json_encode([
        'rating' => '8.0',
        'baterias' => 'Buen estado',
        'cableado' => 'Buen estado',
        'luces_navegacion' => 'Funcionando',
        'panel_instrumentos' => 'Funcionando',
        'bomba_achique' => 'Funcionando',
        'notes' => 'Sistema electrico en buen estado. Baterias con carga optima. Todas las luces de navegacion operativas.'
    ]),
    ':section_interior' => json_encode([
        'rating' => '9.0',
        'tapiceria' => 'Excelente',
        'alfombra_piso' => 'Buen estado',
        'consola' => 'Excelente',
        'almacenamiento' => 'Buen estado',
        'limpieza_general' => 'Limpio',
        'notes' => 'Interior muy bien mantenido. Tapiceria sin desgarros ni manchas. Consola en excelente estado.'
    ]),
    ':section_trailer' => json_encode([
        'rating' => '7.0',
        'estructura' => 'Buen estado',
        'rodillos' => 'Regular',
        'neumaticos' => 'Desgaste moderado',
        'luces_trailer' => 'Funcionando',
        'winche' => 'Funcionando',
        'notes' => 'Trailer funcional pero rodillos muestran desgaste. Se recomienda reemplazo de rodillos y neumaticos en los proximos 6 meses.'
    ]),
    ':section_navigation' => json_encode([
        'rating' => '8.5',
        'gps_chartplotter' => 'Funcionando',
        'fishfinder' => 'Funcionando',
        'radio_vhf' => 'Funcionando',
        'compas' => 'Funcionando',
        'notes' => 'Electronica de navegacion completa y operativa. GPS Garmin con cartas actualizadas.'
    ]),
    ':section_safety' => json_encode([
        'rating' => '9.2',
        'chalecos_salvavidas' => 'Si',
        'extintor' => 'Si',
        'bengalas' => 'Si',
        'botiquin' => 'Si',
        'aro_salvavidas' => 'Si',
        'notes' => 'Equipamiento de seguridad completo y vigente. Extintor con certificacion al dia.'
    ]),
    ':section_test_drive' => json_encode([
        'rating' => '8.8',
        'arranque_en_agua' => 'Excelente',
        'maniobrabilidad' => 'Excelente',
        'velocidad_maxima' => '42 nudos',
        'vibraciones' => 'Normal',
        'ruido_motor' => 'Normal',
        'comportamiento_olas' => 'Buen estado',
        'notes' => 'Excelente comportamiento en prueba de mar. Buena respuesta en aceleracion y virajes. Alcanza 42 nudos a WOT.'
    ]),
    ':section_documentation' => json_encode([
        'rating' => '8.0',
        'titulo_propiedad' => 'Si',
        'registro' => 'Si',
        'seguro_vigente' => 'Si',
        'historial_mantenimiento' => 'Parcial',
        'notes' => 'Documentacion en orden. Historial de mantenimiento parcial - se cuenta con registros de los ultimos 2 anos.'
    ]),
    ':overall_rating' => 8.3,
    ':overall_summary' => 'Embarcacion en muy buenas condiciones generales. Motor Mercury MerCruiser 4.5L con 320 horas bien mantenido. Interior impecable y electronica completa. Los principales puntos de atencion son los rodillos del trailer y el impeller de la bomba de agua que requieren reemplazo proximo.',
    ':recommendations' => "1. Reemplazar rodillos del trailer (prioridad media)\n2. Cambiar impeller de bomba de agua en proximo servicio\n3. Reemplazar neumaticos del trailer en los proximos 6 meses\n4. Considerar pulido de gelcoat para restaurar brillo original\n5. Mantener programa de servicio regular cada 100 horas\n\nEn general, es una buena compra a un precio justo. La embarcacion ha sido bien cuidada y no presenta problemas estructurales ni mecanicos significativos.",
    ':inspector_name' => 'Carlos Rodriguez M.',
    ':price_usd' => 38500.00,
    ':listing_url' => 'https://www.boattrader.com/boat/2021-bayliner-vr5-bowrider',
    ':created_by' => 'admin'
]);

$id = $pdo->lastInsertId();
echo json_encode(['success' => true, 'id' => $id, 'message' => 'Test inspection created for jpchs1@gmail.com']);
