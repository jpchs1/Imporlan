<?php
/**
 * One-time script to create a test inspection for David.
 * DELETE this file after running it once.
 */
require_once __DIR__ . '/db_config.php';

$pdo = getDbConnection();
if (!$pdo) { die("DB connection failed"); }

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
    ':user_email' => 'ddm4me25@gmail.com',
    ':user_name' => 'David',
    ':report_type' => 'estandar',
    ':vessel_type' => 'Lancha',
    ':brand' => 'Quicksilver',
    ':model' => 'Activ 675 Open',
    ':vessel_year' => 2022,
    ':length_ft' => 22.0,
    ':hull_material' => 'Fibra de Vidrio',
    ':engine_brand' => 'Mercury',
    ':engine_model' => 'F150 EFI',
    ':engine_hours' => '185',
    ':num_engines' => 1,
    ':fuel_type' => 'Gasolina',
    ':country' => 'chile',
    ':state_region' => 'Valparaiso',
    ':city' => 'Algarrobo',
    ':marina' => 'Marina de Algarrobo',
    ':section_hull' => json_encode([
        'rating' => '8.0',
        'estado_general' => 'Buen estado',
        'gelcoat' => 'Buen estado',
        'linea_de_agua' => 'Limpio',
        'quilla' => 'Buen estado',
        'proa' => 'Buen estado',
        'popa' => 'Excelente',
        'herrajes_exteriores' => 'Funcionando',
        'notes' => 'Casco en buenas condiciones. Gelcoat con desgaste normal por uso. Sin golpes ni reparaciones previas visibles. Fondo limpio y sin incrustaciones.'
    ]),
    ':section_engine' => json_encode([
        'rating' => '8.5',
        'estado_general' => 'Buen estado',
        'arranque' => 'Excelente',
        'ralenti' => 'Normal',
        'aceleracion' => 'Excelente',
        'temperatura' => 'Normal',
        'presion_aceite' => 'Normal',
        'sistema_enfriamiento' => 'Funcionando',
        'correas_y_mangueras' => 'Buen estado',
        'notes' => 'Motor Mercury F150 con solo 185 horas. Excelente rendimiento. Aceite y filtros cambiados recientemente. Sin fugas. Anodos en buen estado.'
    ]),
    ':section_electrical' => json_encode([
        'rating' => '7.5',
        'baterias' => 'Buen estado',
        'cableado' => 'Buen estado',
        'luces_navegacion' => 'Funcionando',
        'panel_instrumentos' => 'Funcionando',
        'bomba_achique' => 'Funcionando',
        'notes' => 'Sistema electrico operativo. Se recomienda revisar conexion de luz de popa que presenta leve corrosion en terminales.'
    ]),
    ':section_interior' => json_encode([
        'rating' => '8.8',
        'tapiceria' => 'Excelente',
        'alfombra_piso' => 'Buen estado',
        'consola' => 'Excelente',
        'almacenamiento' => 'Excelente',
        'limpieza_general' => 'Limpio',
        'notes' => 'Interior muy bien conservado. Tapiceria Silvertex sin desgaste. Consola con instrumentacion completa y funcional. Buen espacio de almacenamiento.'
    ]),
    ':section_trailer' => json_encode([
        'rating' => '7.5',
        'estructura' => 'Buen estado',
        'rodillos' => 'Buen estado',
        'neumaticos' => 'Buen estado',
        'luces_trailer' => 'Funcionando',
        'winche' => 'Funcionando',
        'notes' => 'Trailer galvanizado en buenas condiciones. Cable de winche con desgaste menor, funcional.'
    ]),
    ':section_navigation' => json_encode([
        'rating' => '9.0',
        'gps_chartplotter' => 'Funcionando',
        'fishfinder' => 'Funcionando',
        'radio_vhf' => 'Funcionando',
        'compas' => 'Funcionando',
        'notes' => 'Equipado con Garmin ECHOMAP UHD 92sv. GPS, sonda y cartas funcionando correctamente. Radio VHF operativo.'
    ]),
    ':section_safety' => json_encode([
        'rating' => '8.5',
        'chalecos_salvavidas' => 'Si',
        'extintor' => 'Si',
        'bengalas' => 'Si',
        'botiquin' => 'Si',
        'aro_salvavidas' => 'Si',
        'notes' => 'Equipamiento de seguridad completo conforme normativa DIRECTEMAR. Todo vigente y en buenas condiciones.'
    ]),
    ':section_test_drive' => json_encode([
        'rating' => '9.0',
        'arranque_en_agua' => 'Excelente',
        'maniobrabilidad' => 'Excelente',
        'velocidad_maxima' => '38 nudos',
        'vibraciones' => 'Normal',
        'ruido_motor' => 'Normal',
        'comportamiento_olas' => 'Excelente',
        'notes' => 'Prueba de mar realizada en Algarrobo con oleaje moderado. Excelente estabilidad y respuesta. Motor acelera suave hasta 38 nudos. Sin vibraciones anormales.'
    ]),
    ':section_documentation' => json_encode([
        'rating' => '8.0',
        'titulo_propiedad' => 'Si',
        'registro' => 'Si',
        'seguro_vigente' => 'Si',
        'historial_mantenimiento' => 'Si',
        'notes' => 'Matricula DIRECTEMAR al dia. Seguro vigente con cobertura completa. Historial de servicio autorizado Mercury disponible.'
    ]),
    ':overall_rating' => 8.4,
    ':overall_summary' => 'Embarcacion Quicksilver Activ 675 Open 2022 en muy buenas condiciones. Motor Mercury F150 con pocas horas (185h) y excelente rendimiento en prueba de mar. Interior impecable y electronica de navegacion completa. Los puntos menores de atencion son terminales de luz de popa y cable de winche del trailer.',
    ':recommendations' => "1. Limpiar y proteger terminales de luz de popa (prioridad baja)\n2. Monitorear cable de winche del trailer, considerar reemplazo preventivo\n3. Aplicar cera protectora en gelcoat para mantener brillo\n4. Mantener servicio Mercury cada 100 horas o anualmente\n5. Renovar anodos de sacrificio en proximo servicio\n\nMuy buena opcion de compra. Embarcacion bien mantenida con bajo horaje y documentacion al dia. Ideal para navegacion costera y pesca deportiva en la zona central de Chile.",
    ':inspector_name' => 'Patricio Soto V.',
    ':price_usd' => 42000.00,
    ':listing_url' => 'https://www.imporlan.cl/marketplace',
    ':created_by' => 'admin'
]);

$id = $pdo->lastInsertId();
echo json_encode(['success' => true, 'id' => $id, 'message' => 'Test inspection created for ddm4me25@gmail.com (David)']);
