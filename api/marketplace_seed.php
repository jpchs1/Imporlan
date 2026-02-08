<?php
/**
 * Marketplace Seed Script - Populate with Cobalt + Classic Bowrider listings
 * Run once: /api/marketplace_seed.php?action=seed&key=imporlan2026
 */

header('Content-Type: application/json');

require_once __DIR__ . '/db_config.php';

$action = $_GET['action'] ?? '';
$key = $_GET['key'] ?? '';

if ($key !== 'imporlan2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Clave invalida']);
    exit();
}

if ($action === 'seed') {
    seedListings();
} elseif ($action === 'clear') {
    clearListings();
} else {
    echo json_encode(['error' => 'Use ?action=seed or ?action=clear']);
}

function clearListings() {
    $pdo = getDbConnection();
    $pdo->exec("DELETE FROM marketplace_listings WHERE user_email LIKE '%@imporlan.cl' OR user_email LIKE '%@demo.cl'");
    echo json_encode(['success' => true, 'message' => 'Listings limpiados']);
}

function seedListings() {
    $pdo = getDbConnection();

    $pdo->exec("DELETE FROM marketplace_listings WHERE user_email LIKE '%@demo.cl'");

    $boatPhotos = [
        'cobalt' => [
            ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop']
        ],
        'classic' => [
            ['https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop'],
            ['https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1559599189-fe84dea4eb79?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1596464716127-f2a6b0a12768?w=800&h=600&fit=crop',
             'https://images.unsplash.com/photo-1504465039710-0f49c0a47eb7?w=800&h=600&fit=crop']
        ]
    ];

    $cobaltListings = [
        [
            'user_email' => 'juan.perez@demo.cl',
            'user_name' => 'Juan Perez',
            'nombre' => 'Cobalt R30',
            'tipo' => 'Bowrider',
            'ano' => 2021,
            'eslora' => '30 ft',
            'precio' => 185000,
            'moneda' => 'USD',
            'ubicacion' => 'Vina del Mar, Chile',
            'descripcion' => 'Cobalt R30 en impecable estado. Motor MerCruiser 6.2L V8 con 320HP. Cabina con bano, nevera y sistema de audio premium Fusion. Plataforma de bano con escalera telescopica. Toldo bimini electrico. Tapiceria en vinilo marino de alta calidad. Trailer incluido. Mantenimiento al dia con registros completos.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 180,
            'fotos' => $boatPhotos['cobalt'][0]
        ],
        [
            'user_email' => 'carlos.mendez@demo.cl',
            'user_name' => 'Carlos Mendez',
            'nombre' => 'Cobalt CS23',
            'tipo' => 'Bowrider',
            'ano' => 2022,
            'eslora' => '23 ft',
            'precio' => 125000,
            'moneda' => 'USD',
            'ubicacion' => 'Lago Rapel, Chile',
            'descripcion' => 'Cobalt CS23 Sport, embarcacion deportiva de alto rendimiento. Motor Yamaha 250HP four stroke. Sistema de wakeboard tower integrado. Asientos deportivos con soporte lumbar. Compartimentos de almacenamiento amplios. GPS Garmin integrado. Perfecta para deportes acuaticos y paseos familiares. Se entrega con cobertor y accesorios.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 95,
            'fotos' => $boatPhotos['cobalt'][1]
        ],
        [
            'user_email' => 'maria.lagos@demo.cl',
            'user_name' => 'Maria Lagos',
            'nombre' => 'Cobalt A29',
            'tipo' => 'Bowrider',
            'ano' => 2023,
            'eslora' => '29 ft',
            'precio' => 195000,
            'moneda' => 'USD',
            'ubicacion' => 'Algarrobo, Chile',
            'descripcion' => 'Cobalt A29 ultimo modelo, practicamente nueva. Doble motor Volvo Penta V8 con 600HP combinados. Cabina completa con litera, bano con ducha y cocina compacta. Sistema de navegacion Simrad con pantalla tactil 12 pulgadas. Aire acondicionado marina. Equipo de sonido JL Audio con subwoofer. Iluminacion LED submarina. Primera mano, todos los servicios en concesionario autorizado.',
            'estado' => 'Nueva',
            'condicion' => 'Excelente',
            'horas' => 45,
            'fotos' => $boatPhotos['cobalt'][2]
        ],
        [
            'user_email' => 'pedro.silva@demo.cl',
            'user_name' => 'Pedro Silva',
            'nombre' => 'Cobalt R25',
            'tipo' => 'Bowrider',
            'ano' => 2022,
            'eslora' => '25 ft',
            'precio' => 145000,
            'moneda' => 'USD',
            'ubicacion' => 'Lago Villarrica, Chile',
            'descripcion' => 'Cobalt R25, la combinacion perfecta entre rendimiento y comodidad. Motor MerCruiser 350HP. Asientos para 10 personas con configuracion flexible. Mesa plegable para picnic a bordo. Sistema de audio Bluetooth con parlantes marinos. Toldo retractil manual. Casco profundo en V para navegacion suave. Incluye trailer galvanizado de aluminio.',
            'estado' => 'Usada',
            'condicion' => 'Muy Buena',
            'horas' => 220,
            'fotos' => $boatPhotos['cobalt'][3]
        ]
    ];

    $classicListings = [
        [
            'user_email' => 'andres.rojas@demo.cl',
            'user_name' => 'Andres Rojas',
            'nombre' => 'Chaparral 246 SSi',
            'tipo' => 'Bowrider',
            'ano' => 2019,
            'eslora' => '24 ft',
            'precio' => 68000,
            'moneda' => 'USD',
            'ubicacion' => 'Vina del Mar, Chile',
            'descripcion' => 'Chaparral 246 SSi, bowrider clasica americana con excelente reputacion. Motor MerCruiser 350 MAG 300HP. Casco Wide-Tech para maxima estabilidad. Asientos Extended V-Plane con respaldo reclinable. Compartimento de proa amplio con cojines convertibles. Sistema de audio con radio AM/FM y entrada auxiliar. Plataforma de bano con escalera plegable. Mantenimiento regular, listas para navegar.',
            'estado' => 'Usada',
            'condicion' => 'Muy Buena',
            'horas' => 380,
            'fotos' => $boatPhotos['classic'][0]
        ],
        [
            'user_email' => 'roberto.fuentes@demo.cl',
            'user_name' => 'Roberto Fuentes',
            'nombre' => 'Sea Ray 240 Sundeck',
            'tipo' => 'Bowrider',
            'ano' => 2020,
            'eslora' => '24 ft',
            'precio' => 75000,
            'moneda' => 'USD',
            'ubicacion' => 'Algarrobo, Chile',
            'descripcion' => 'Sea Ray 240 Sundeck, la referencia en bowriders de lujo. Motor MerCruiser 5.7L V8 con 350HP. Diseno de cubierta abierta con espacio para 12 personas. Tapiceria marina premium resistente a UV. Toldo bimini con marco de acero inoxidable. Compartimento de anclaje dedicado. Luces de cortesia LED. Bomba de achique automatica. Incluye cobertor de invierno y trailer.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 210,
            'fotos' => $boatPhotos['classic'][1]
        ],
        [
            'user_email' => 'felipe.gonzalez@demo.cl',
            'user_name' => 'Felipe Gonzalez',
            'nombre' => 'Bayliner 185 Bowrider',
            'tipo' => 'Bowrider',
            'ano' => 2018,
            'eslora' => '18 ft',
            'precio' => 28500000,
            'moneda' => 'CLP',
            'ubicacion' => 'Lago Rapel, Chile',
            'descripcion' => 'Bayliner 185 Bowrider, ideal para familias que buscan su primera embarcacion. Motor Mercury 135HP de 4 tiempos, economico y confiable. Capacidad para 8 personas. Compartimento de proa con cojines. Consola central con instrumentacion completa. Porta canas integrado. Ideal para lagos y bahias protegidas. Motor recien revisado con cambio de aceite y filtros.',
            'estado' => 'Usada',
            'condicion' => 'Buena',
            'horas' => 520,
            'fotos' => $boatPhotos['classic'][2]
        ],
        [
            'user_email' => 'claudia.herrera@demo.cl',
            'user_name' => 'Claudia Herrera',
            'nombre' => 'Maxum 2100 SC',
            'tipo' => 'Bowrider',
            'ano' => 2017,
            'eslora' => '21 ft',
            'precio' => 42000,
            'moneda' => 'USD',
            'ubicacion' => 'Concepcion, Chile',
            'descripcion' => 'Maxum 2100 SC, bowrider espaciosa y versatil. Motor MerCruiser 4.3L V6 con 220HP. Casco de fibra de vidrio de alta resistencia. Proa amplia con area de descanso. Consola con parabrisas curvo. Porta vasos y compartimentos de almacenamiento multiples. Sistema electrico 12V con bateria doble. Excelente opcion para navegacion costera y lacustre.',
            'estado' => 'Usada',
            'condicion' => 'Buena',
            'horas' => 450,
            'fotos' => $boatPhotos['classic'][3]
        ],
        [
            'user_email' => 'diego.martinez@demo.cl',
            'user_name' => 'Diego Martinez',
            'nombre' => 'Monterey 224FS',
            'tipo' => 'Bowrider',
            'ano' => 2020,
            'eslora' => '22 ft',
            'precio' => 62000,
            'moneda' => 'USD',
            'ubicacion' => 'Puerto Montt, Chile',
            'descripcion' => 'Monterey 224FS, diseno italiano con ingenieria americana. Motor Volvo Penta 5.0L con 270HP. Casco FasTrac premiado por su rendimiento hidrodinamico. Interior en tapiceria SoftTouch resistente al agua. Mesa de cockpit con soporte de acero inoxidable. Ducha de proa y popa. Sistema de audio con Bluetooth y 6 parlantes. Trim tabs para navegacion optima en cualquier condicion.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 160,
            'fotos' => $boatPhotos['classic'][4]
        ],
        [
            'user_email' => 'camila.vargas@demo.cl',
            'user_name' => 'Camila Vargas',
            'nombre' => 'Stingray 225LR',
            'tipo' => 'Bowrider',
            'ano' => 2019,
            'eslora' => '22 ft',
            'precio' => 48000,
            'moneda' => 'USD',
            'ubicacion' => 'Vina del Mar, Chile',
            'descripcion' => 'Stingray 225LR, bowrider deportiva con excelente relacion precio-calidad. Motor Volvo Penta 4.3L V6 con 225HP. Casco Z-Plane patentado para navegacion suave y eficiente. Asientos tipo bucket con apoyo lumbar. Compartimento de esqui bajo el piso. Radio marina con entrada USB. Luces de navegacion LED. Bateria con cargador automatico. Lista para temporada.',
            'estado' => 'Usada',
            'condicion' => 'Muy Buena',
            'horas' => 310,
            'fotos' => $boatPhotos['classic'][5]
        ],
        [
            'user_email' => 'nicolas.castro@demo.cl',
            'user_name' => 'Nicolas Castro',
            'nombre' => 'Four Winns H260',
            'tipo' => 'Bowrider',
            'ano' => 2021,
            'eslora' => '26 ft',
            'precio' => 95000,
            'moneda' => 'USD',
            'ubicacion' => 'Lago Villarrica, Chile',
            'descripcion' => 'Four Winns H260, bowrider premium de gran eslora. Motor MerCruiser 6.2L V8 con 350HP. Cabina con litera para 2 personas y bano portatil. Cocina compacta con nevera de 12V. Toldo bimini electrico con cubierta de lona. Sistema Garmin con GPS, ecosonda y carta nautica. Tapiceria Sunbrella premium. Plataforma de bano de teca sintetica. Torre de wakeboard abatible.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 130,
            'fotos' => $boatPhotos['classic'][6]
        ],
        [
            'user_email' => 'valentina.munoz@demo.cl',
            'user_name' => 'Valentina Munoz',
            'nombre' => 'Regal 2300',
            'tipo' => 'Bowrider',
            'ano' => 2020,
            'eslora' => '23 ft',
            'precio' => 72000,
            'moneda' => 'USD',
            'ubicacion' => 'Algarrobo, Chile',
            'descripcion' => 'Regal 2300, elegancia y rendimiento en una bowrider clasica. Motor Volvo Penta 5.0L con 270HP. Sistema FasTrac de Regal para navegacion eficiente y estable. Interior espacioso con configuracion de salon. Mesa de cockpit abatible. Ducha en la plataforma de bano. Radio Fusion con Bluetooth y 4 parlantes JBL. Compartimento de anclaje con winche electrico.',
            'estado' => 'Usada',
            'condicion' => 'Muy Buena',
            'horas' => 240,
            'fotos' => $boatPhotos['classic'][7]
        ],
        [
            'user_email' => 'sebastian.diaz@demo.cl',
            'user_name' => 'Sebastian Diaz',
            'nombre' => 'Chaparral 230 SSi',
            'tipo' => 'Bowrider',
            'ano' => 2018,
            'eslora' => '23 ft',
            'precio' => 52000,
            'moneda' => 'USD',
            'ubicacion' => 'Lago Llanquihue, Chile',
            'descripcion' => 'Chaparral 230 SSi, la bowrider familiar por excelencia. Motor MerCruiser 5.0L V8 con 260HP. Casco Wide-Tech de segunda generacion. Proa con area de descanso convertible tipo cama. Consola con instrumentacion digital. Sistema de achique automatico. Luces subacuaticas opcionales instaladas. Trailer galvanizado incluido con frenos hidraulicos. Ideal para lagos del sur de Chile.',
            'estado' => 'Usada',
            'condicion' => 'Buena',
            'horas' => 480,
            'fotos' => $boatPhotos['classic'][8]
        ],
        [
            'user_email' => 'francisca.soto@demo.cl',
            'user_name' => 'Francisca Soto',
            'nombre' => 'Sea Ray 210 SPX',
            'tipo' => 'Bowrider',
            'ano' => 2021,
            'eslora' => '21 ft',
            'precio' => 58000,
            'moneda' => 'USD',
            'ubicacion' => 'Vina del Mar, Chile',
            'descripcion' => 'Sea Ray 210 SPX, la mas vendida de su categoria. Motor Mercury 250HP de 4 tiempos. Diseno Sport con lineas aerodinamicas. Tapizados SEA RAY exclusivos resistentes al sol y agua salada. Consola deportiva con volante de cuero. Compartimento de esqui con puerta dedicada. Sistema de audio con control remoto y Bluetooth. Toldo bimini de apertura rapida. Primera duena, uso exclusivo en lagos.',
            'estado' => 'Usada',
            'condicion' => 'Excelente',
            'horas' => 150,
            'fotos' => $boatPhotos['classic'][9]
        ]
    ];

    $allListings = array_merge($cobaltListings, $classicListings);
    $inserted = 0;

    $stmt = $pdo->prepare("
        INSERT INTO marketplace_listings
        (user_email, user_name, nombre, tipo, ano, eslora, precio, moneda, ubicacion, descripcion, estado, condicion, horas, fotos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($allListings as $listing) {
        $stmt->execute([
            $listing['user_email'],
            $listing['user_name'],
            $listing['nombre'],
            $listing['tipo'],
            $listing['ano'],
            $listing['eslora'],
            $listing['precio'],
            $listing['moneda'],
            $listing['ubicacion'],
            $listing['descripcion'],
            $listing['estado'],
            $listing['condicion'],
            $listing['horas'],
            json_encode($listing['fotos'])
        ]);
        $inserted++;
    }

    echo json_encode([
        'success' => true,
        'message' => "Se insertaron $inserted publicaciones",
        'cobalt' => count($cobaltListings),
        'classic' => count($classicListings)
    ]);
}
