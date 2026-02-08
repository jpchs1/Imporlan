<?php
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
        [
            'https://img.youtube.com/vi/7SK7nh-2Ljk/maxresdefault.jpg',
            'https://img.youtube.com/vi/mIhgVPYZyfY/maxresdefault.jpg',
            'https://img.youtube.com/vi/m3WZek0aLEA/maxresdefault.jpg',
            'https://img.youtube.com/vi/p5xLOge0-2E/maxresdefault.jpg',
            'https://img.youtube.com/vi/FBqQPR_Lzpg/maxresdefault.jpg',
            'https://img.youtube.com/vi/D1uLB4J81Ls/maxresdefault.jpg',
            'https://img.youtube.com/vi/_xeT6-VF57I/maxresdefault.jpg',
            'https://img.youtube.com/vi/Cfr6RBCTFRE/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/VnZH02k7TLI/maxresdefault.jpg',
            'https://img.youtube.com/vi/yKuOKC3eBnY/maxresdefault.jpg',
            'https://img.youtube.com/vi/RHk7qWkAuxg/maxresdefault.jpg',
            'https://img.youtube.com/vi/k0YH-59HjdA/maxresdefault.jpg',
            'https://img.youtube.com/vi/-sLL-OHjO8w/maxresdefault.jpg',
            'https://img.youtube.com/vi/Sq_7DCDXHDk/maxresdefault.jpg',
            'https://img.youtube.com/vi/bZJIP9tup-M/maxresdefault.jpg',
            'https://img.youtube.com/vi/tOlnqwrgmII/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/4ceqlrRFlG0/maxresdefault.jpg',
            'https://img.youtube.com/vi/cpUnvxoz0vY/maxresdefault.jpg',
            'https://img.youtube.com/vi/9o_KK8EX_SI/maxresdefault.jpg',
            'https://img.youtube.com/vi/IVvRhPHpLKs/maxresdefault.jpg',
            'https://img.youtube.com/vi/eP3FtSnn71A/maxresdefault.jpg',
            'https://img.youtube.com/vi/KpdPZD8d1UA/maxresdefault.jpg',
            'https://img.youtube.com/vi/QpyGI-xUYUk/maxresdefault.jpg',
            'https://img.youtube.com/vi/Hwzv4bcqcd8/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/yVQiTT5HbuA/maxresdefault.jpg',
            'https://img.youtube.com/vi/02Y-rqknlmA/maxresdefault.jpg',
            'https://img.youtube.com/vi/n4t1ty5Rt2k/maxresdefault.jpg',
            'https://img.youtube.com/vi/mEDkYvAMwi4/maxresdefault.jpg',
            'https://img.youtube.com/vi/dxfcpS5kVW8/maxresdefault.jpg',
            'https://img.youtube.com/vi/hIho51B651s/maxresdefault.jpg',
            'https://img.youtube.com/vi/2U3Vbb5tQvY/maxresdefault.jpg',
            'https://img.youtube.com/vi/nrY91CHjqO8/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/A1yiNBvGjVk/maxresdefault.jpg',
            'https://img.youtube.com/vi/mZvIU2sSnrk/maxresdefault.jpg',
            'https://img.youtube.com/vi/BJxZAoqX9qQ/maxresdefault.jpg',
            'https://img.youtube.com/vi/oST7jOXOXgE/maxresdefault.jpg',
            'https://img.youtube.com/vi/Xl2M5uOcxWE/maxresdefault.jpg',
            'https://img.youtube.com/vi/sI8jnTctN2Q/maxresdefault.jpg',
            'https://img.youtube.com/vi/7vumdhHLmgk/maxresdefault.jpg',
            'https://img.youtube.com/vi/gjsjGkYb9n8/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/8SVSFGeTy8M/maxresdefault.jpg',
            'https://img.youtube.com/vi/aKIk5G_Kwls/maxresdefault.jpg',
            'https://img.youtube.com/vi/gR7DN1ZjtoA/maxresdefault.jpg',
            'https://img.youtube.com/vi/lHoJ1tLLQr0/maxresdefault.jpg',
            'https://img.youtube.com/vi/GH9Xk-_48g4/maxresdefault.jpg',
            'https://img.youtube.com/vi/jl0PticUBkA/maxresdefault.jpg',
            'https://img.youtube.com/vi/NeNWRiz5NlE/maxresdefault.jpg',
            'https://img.youtube.com/vi/ouWausxbCK0/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/s5RN133UYlQ/maxresdefault.jpg',
            'https://img.youtube.com/vi/pY9IcgTrqlY/maxresdefault.jpg',
            'https://img.youtube.com/vi/36r1kqtmu8c/maxresdefault.jpg',
            'https://img.youtube.com/vi/B5ju2uFqz2k/maxresdefault.jpg',
            'https://img.youtube.com/vi/IMSqoL9_Qrk/maxresdefault.jpg',
            'https://img.youtube.com/vi/TVUFG3NeKyc/maxresdefault.jpg',
            'https://img.youtube.com/vi/q3LliTWrSCY/maxresdefault.jpg',
            'https://img.youtube.com/vi/LsAns6tZPq4/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/3L9nP68iz9k/maxresdefault.jpg',
            'https://img.youtube.com/vi/T51uPmJE9BI/maxresdefault.jpg',
            'https://img.youtube.com/vi/Z5u4VZ6vFtY/maxresdefault.jpg',
            'https://img.youtube.com/vi/pGKDa3gCQwA/maxresdefault.jpg',
            'https://img.youtube.com/vi/NKPsdjGLjPM/maxresdefault.jpg',
            'https://img.youtube.com/vi/BJ5g4joi5FE/maxresdefault.jpg',
            'https://img.youtube.com/vi/3L9nP68iz9k/sddefault.jpg',
            'https://img.youtube.com/vi/T51uPmJE9BI/sddefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/BUOLvg-u91Y/maxresdefault.jpg',
            'https://img.youtube.com/vi/p6iX7YJpFTI/maxresdefault.jpg',
            'https://img.youtube.com/vi/1PMZ5tkeoGM/maxresdefault.jpg',
            'https://img.youtube.com/vi/YLoIEHvyYyA/maxresdefault.jpg',
            'https://img.youtube.com/vi/EbV4WYtwOoc/maxresdefault.jpg',
            'https://img.youtube.com/vi/LIwNWTzbst8/maxresdefault.jpg',
            'https://img.youtube.com/vi/_f6XhiWSXuc/maxresdefault.jpg',
            'https://img.youtube.com/vi/pgXxlkH4EzY/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/kyr4MokeKgY/maxresdefault.jpg',
            'https://img.youtube.com/vi/QWDVDEh-8pc/maxresdefault.jpg',
            'https://img.youtube.com/vi/r5svn_ThCLs/maxresdefault.jpg',
            'https://img.youtube.com/vi/Rk9OCGlafOU/maxresdefault.jpg',
            'https://img.youtube.com/vi/MJGBzm7OIgY/maxresdefault.jpg',
            'https://img.youtube.com/vi/bMeQEdfNYws/maxresdefault.jpg',
            'https://img.youtube.com/vi/56KnyXCXmbE/maxresdefault.jpg',
            'https://img.youtube.com/vi/yivr5StmXBQ/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/kRtQTmDX2og/maxresdefault.jpg',
            'https://img.youtube.com/vi/GCSwx3xvEjA/maxresdefault.jpg',
            'https://img.youtube.com/vi/krMZdlQYKR8/maxresdefault.jpg',
            'https://img.youtube.com/vi/xy2FZ3qJYGI/maxresdefault.jpg',
            'https://img.youtube.com/vi/MYncwApJ1Tc/maxresdefault.jpg',
            'https://img.youtube.com/vi/t2HUytBntqk/maxresdefault.jpg',
            'https://img.youtube.com/vi/SYJDgeVK5WY/maxresdefault.jpg',
            'https://img.youtube.com/vi/fJ-T0MOuWY0/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/cQ6eTue_qbg/maxresdefault.jpg',
            'https://img.youtube.com/vi/GpNEFapVFAg/maxresdefault.jpg',
            'https://img.youtube.com/vi/ltSKzm1ZMOg/maxresdefault.jpg',
            'https://img.youtube.com/vi/q_KfhHrLC_Q/maxresdefault.jpg',
            'https://img.youtube.com/vi/ciAdRtlpSgo/maxresdefault.jpg',
            'https://img.youtube.com/vi/r4rYatk2Jic/maxresdefault.jpg',
            'https://img.youtube.com/vi/kYnifkjmFZI/maxresdefault.jpg',
            'https://img.youtube.com/vi/UWKOPhO1p9M/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/IzdR0B2Pvis/maxresdefault.jpg',
            'https://img.youtube.com/vi/VM7fckbunsE/maxresdefault.jpg',
            'https://img.youtube.com/vi/yw8utFibE9c/maxresdefault.jpg',
            'https://img.youtube.com/vi/oXbCNB4g200/maxresdefault.jpg',
            'https://img.youtube.com/vi/v6EdWJ6WH1M/maxresdefault.jpg',
            'https://img.youtube.com/vi/0qtHw5Iyd74/maxresdefault.jpg',
            'https://img.youtube.com/vi/XucZH1i7Djg/maxresdefault.jpg',
            'https://img.youtube.com/vi/cKI_SCk0jXc/maxresdefault.jpg'
        ],
        [
            'https://img.youtube.com/vi/E6P2Wns1Jjc/maxresdefault.jpg',
            'https://img.youtube.com/vi/KFa56cCDUsQ/maxresdefault.jpg',
            'https://img.youtube.com/vi/GWWdtF7jYoE/maxresdefault.jpg',
            'https://img.youtube.com/vi/t0ZdSs5CXrM/maxresdefault.jpg',
            'https://img.youtube.com/vi/vqLpL55vB4M/maxresdefault.jpg',
            'https://img.youtube.com/vi/mJvmaAcCrEI/maxresdefault.jpg',
            'https://img.youtube.com/vi/YlsR1ERlJ6A/maxresdefault.jpg',
            'https://img.youtube.com/vi/GOX_F0IfZXs/maxresdefault.jpg'
        ]
    ];

    $cobaltListings = [
        ['user_email' => 'juan.perez@demo.cl', 'user_name' => 'Juan Perez', 'nombre' => 'Cobalt R30', 'tipo' => 'Bowrider', 'ano' => 2021, 'eslora' => '30 ft', 'precio' => 185000, 'moneda' => 'USD', 'ubicacion' => 'Vina del Mar, Chile', 'descripcion' => 'Cobalt R30 en impecable estado. Motor MerCruiser 6.2L V8 con 320HP. Cabina con bano, nevera y sistema de audio premium Fusion. Plataforma de bano con escalera telescopica. Toldo bimini electrico. Tapiceria en vinilo marino de alta calidad. Trailer incluido. Mantenimiento al dia con registros completos.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 180, 'fotos' => $boatPhotos[0]],
        ['user_email' => 'carlos.mendez@demo.cl', 'user_name' => 'Carlos Mendez', 'nombre' => 'Cobalt CS23', 'tipo' => 'Bowrider', 'ano' => 2022, 'eslora' => '23 ft', 'precio' => 125000, 'moneda' => 'USD', 'ubicacion' => 'Lago Rapel, Chile', 'descripcion' => 'Cobalt CS23 Sport, embarcacion deportiva de alto rendimiento. Motor Yamaha 250HP four stroke. Sistema de wakeboard tower integrado. Asientos deportivos con soporte lumbar. Compartimentos de almacenamiento amplios. GPS Garmin integrado. Perfecta para deportes acuaticos y paseos familiares.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 95, 'fotos' => $boatPhotos[1]],
        ['user_email' => 'maria.lagos@demo.cl', 'user_name' => 'Maria Lagos', 'nombre' => 'Cobalt A29', 'tipo' => 'Bowrider', 'ano' => 2023, 'eslora' => '29 ft', 'precio' => 195000, 'moneda' => 'USD', 'ubicacion' => 'Algarrobo, Chile', 'descripcion' => 'Cobalt A29 ultimo modelo, practicamente nueva. Doble motor Volvo Penta V8 con 600HP combinados. Cabina completa con litera, bano con ducha y cocina compacta. Sistema de navegacion Simrad con pantalla tactil 12 pulgadas. Aire acondicionado marina.', 'estado' => 'Nueva', 'condicion' => 'Excelente', 'horas' => 45, 'fotos' => $boatPhotos[2]],
        ['user_email' => 'pedro.silva@demo.cl', 'user_name' => 'Pedro Silva', 'nombre' => 'Cobalt R25', 'tipo' => 'Bowrider', 'ano' => 2022, 'eslora' => '25 ft', 'precio' => 145000, 'moneda' => 'USD', 'ubicacion' => 'Lago Villarrica, Chile', 'descripcion' => 'Cobalt R25, la combinacion perfecta entre rendimiento y comodidad. Motor MerCruiser 350HP. Asientos para 10 personas con configuracion flexible. Mesa plegable para picnic a bordo. Sistema de audio Bluetooth con parlantes marinos.', 'estado' => 'Usada', 'condicion' => 'Muy Buena', 'horas' => 220, 'fotos' => $boatPhotos[3]]
    ];

    $classicListings = [
        ['user_email' => 'andres.rojas@demo.cl', 'user_name' => 'Andres Rojas', 'nombre' => 'Chaparral 246 SSi', 'tipo' => 'Bowrider', 'ano' => 2019, 'eslora' => '24 ft', 'precio' => 68000, 'moneda' => 'USD', 'ubicacion' => 'Vina del Mar, Chile', 'descripcion' => 'Chaparral 246 SSi, bowrider clasica americana con excelente reputacion. Motor MerCruiser 350 MAG 300HP. Casco Wide-Tech para maxima estabilidad. Asientos Extended V-Plane con respaldo reclinable.', 'estado' => 'Usada', 'condicion' => 'Muy Buena', 'horas' => 380, 'fotos' => $boatPhotos[4]],
        ['user_email' => 'roberto.fuentes@demo.cl', 'user_name' => 'Roberto Fuentes', 'nombre' => 'Sea Ray 240 Sundeck', 'tipo' => 'Bowrider', 'ano' => 2020, 'eslora' => '24 ft', 'precio' => 75000, 'moneda' => 'USD', 'ubicacion' => 'Algarrobo, Chile', 'descripcion' => 'Sea Ray 240 Sundeck, la referencia en bowriders de lujo. Motor MerCruiser 5.7L V8 con 350HP. Diseno de cubierta abierta con espacio para 12 personas. Tapiceria marina premium resistente a UV.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 210, 'fotos' => $boatPhotos[5]],
        ['user_email' => 'felipe.gonzalez@demo.cl', 'user_name' => 'Felipe Gonzalez', 'nombre' => 'Bayliner 185 Bowrider', 'tipo' => 'Bowrider', 'ano' => 2018, 'eslora' => '18 ft', 'precio' => 28500000, 'moneda' => 'CLP', 'ubicacion' => 'Lago Rapel, Chile', 'descripcion' => 'Bayliner 185 Bowrider, ideal para familias que buscan su primera embarcacion. Motor Mercury 135HP de 4 tiempos, economico y confiable. Capacidad para 8 personas.', 'estado' => 'Usada', 'condicion' => 'Buena', 'horas' => 520, 'fotos' => $boatPhotos[6]],
        ['user_email' => 'claudia.herrera@demo.cl', 'user_name' => 'Claudia Herrera', 'nombre' => 'Maxum 2100 SC', 'tipo' => 'Bowrider', 'ano' => 2017, 'eslora' => '21 ft', 'precio' => 42000, 'moneda' => 'USD', 'ubicacion' => 'Concepcion, Chile', 'descripcion' => 'Maxum 2100 SC, bowrider espaciosa y versatil. Motor MerCruiser 4.3L V6 con 220HP. Casco de fibra de vidrio de alta resistencia. Proa amplia con area de descanso.', 'estado' => 'Usada', 'condicion' => 'Buena', 'horas' => 450, 'fotos' => $boatPhotos[7]],
        ['user_email' => 'diego.martinez@demo.cl', 'user_name' => 'Diego Martinez', 'nombre' => 'Monterey 224FS', 'tipo' => 'Bowrider', 'ano' => 2020, 'eslora' => '22 ft', 'precio' => 62000, 'moneda' => 'USD', 'ubicacion' => 'Puerto Montt, Chile', 'descripcion' => 'Monterey 224FS, diseno italiano con ingenieria americana. Motor Volvo Penta 5.0L con 270HP. Casco FasTrac premiado por su rendimiento hidrodinamico.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 160, 'fotos' => $boatPhotos[8]],
        ['user_email' => 'camila.vargas@demo.cl', 'user_name' => 'Camila Vargas', 'nombre' => 'Stingray 225LR', 'tipo' => 'Bowrider', 'ano' => 2019, 'eslora' => '22 ft', 'precio' => 48000, 'moneda' => 'USD', 'ubicacion' => 'Vina del Mar, Chile', 'descripcion' => 'Stingray 225LR, bowrider deportiva con excelente relacion precio-calidad. Motor Volvo Penta 4.3L V6 con 225HP. Casco Z-Plane patentado para navegacion suave y eficiente.', 'estado' => 'Usada', 'condicion' => 'Muy Buena', 'horas' => 310, 'fotos' => $boatPhotos[9]],
        ['user_email' => 'nicolas.castro@demo.cl', 'user_name' => 'Nicolas Castro', 'nombre' => 'Four Winns H260', 'tipo' => 'Bowrider', 'ano' => 2021, 'eslora' => '26 ft', 'precio' => 95000, 'moneda' => 'USD', 'ubicacion' => 'Lago Villarrica, Chile', 'descripcion' => 'Four Winns H260, bowrider premium de gran eslora. Motor MerCruiser 6.2L V8 con 350HP. Cabina con litera para 2 personas y bano portatil. Cocina compacta con nevera de 12V.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 130, 'fotos' => $boatPhotos[10]],
        ['user_email' => 'valentina.munoz@demo.cl', 'user_name' => 'Valentina Munoz', 'nombre' => 'Regal 2300', 'tipo' => 'Bowrider', 'ano' => 2020, 'eslora' => '23 ft', 'precio' => 72000, 'moneda' => 'USD', 'ubicacion' => 'Algarrobo, Chile', 'descripcion' => 'Regal 2300, elegancia y rendimiento en una bowrider clasica. Motor Volvo Penta 5.0L con 270HP. Sistema FasTrac de Regal para navegacion eficiente y estable.', 'estado' => 'Usada', 'condicion' => 'Muy Buena', 'horas' => 240, 'fotos' => $boatPhotos[11]],
        ['user_email' => 'sebastian.diaz@demo.cl', 'user_name' => 'Sebastian Diaz', 'nombre' => 'Chaparral 230 SSi', 'tipo' => 'Bowrider', 'ano' => 2018, 'eslora' => '23 ft', 'precio' => 52000, 'moneda' => 'USD', 'ubicacion' => 'Lago Llanquihue, Chile', 'descripcion' => 'Chaparral 230 SSi, la bowrider familiar por excelencia. Motor MerCruiser 5.0L V8 con 260HP. Casco Wide-Tech de segunda generacion.', 'estado' => 'Usada', 'condicion' => 'Buena', 'horas' => 480, 'fotos' => $boatPhotos[12]],
        ['user_email' => 'francisca.soto@demo.cl', 'user_name' => 'Francisca Soto', 'nombre' => 'Sea Ray 210 SPX', 'tipo' => 'Bowrider', 'ano' => 2021, 'eslora' => '21 ft', 'precio' => 58000, 'moneda' => 'USD', 'ubicacion' => 'Vina del Mar, Chile', 'descripcion' => 'Sea Ray 210 SPX, la mas vendida de su categoria. Motor Mercury 250HP de 4 tiempos. Diseno Sport con lineas aerodinamicas.', 'estado' => 'Usada', 'condicion' => 'Excelente', 'horas' => 150, 'fotos' => $boatPhotos[13]]
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
            $listing['user_email'], $listing['user_name'], $listing['nombre'], $listing['tipo'],
            $listing['ano'], $listing['eslora'], $listing['precio'], $listing['moneda'],
            $listing['ubicacion'], $listing['descripcion'], $listing['estado'], $listing['condicion'],
            $listing['horas'], json_encode($listing['fotos'])
        ]);
        $inserted++;
    }

    echo json_encode(['success' => true, 'message' => "Se insertaron $inserted publicaciones", 'cobalt' => count($cobaltListings), 'classic' => count($classicListings)]);
}
