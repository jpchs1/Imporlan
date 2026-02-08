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
            'https://images.unsplash.com/photo-1542571686655-3bb91ed49080?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1544716668-9eb883258f05?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1544962829-e313c26cf3ea?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1546275021-c1d154a4a66c?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1551437631-ce07c78c95aa?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1553474157-5f29a57c167f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1559724288-2f8b8e4fc983?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1562603813-fb781dee22fe?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1565645359224-80b0fb519fbb?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1569841194745-1a51d7a9b05c?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1571863817716-41ec71c5d1de?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1573663585908-4af903053743?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1579810207085-86e5e4367de4?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1580290362803-7d9915611871?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1584281722160-4e3321029d8c?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1584283442088-e3cb1be2a287?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1592229208469-c4cb1177af4a?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1593440703400-a9da7b21da86?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1595081221331-fbb85e9f3622?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1595511209056-abff4584080d?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1597651984927-d2c56eca1d61?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1597676654229-326b7c23bc06?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1604915666686-93382bae0c16?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1607949759289-9b9215fee43a?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1608673397343-d9fb5c9cf1ec?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1610052918784-66a7efd129c1?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1612899359429-5b1f7039074a?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1618589166766-93188eeea911?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1622472457451-22439e3309f5?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1623000435964-d6be14403668?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1628084473300-af7616691b07?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1630307510909-520d4a60142b?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1630840754024-8e3817c5e623?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1631547965489-210b68cf39df?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1635841583278-0d91157d218c?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1637801946687-273dcd5d2713?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1637964034722-789e606e225f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1644107047419-49875975cd03?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1646520834938-976564f8b4e9?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1647279307683-088e22064f0e?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1648484983838-b47185140bee?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1648967043324-43d3e85c6002?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1652011696213-0dfad99676cf?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1655095116326-25039ef7be47?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1655103947120-a43556b73643?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1656347827016-684a14bcb6b1?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1658495758991-e81e7073813d?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1660073335762-bcddd921babe?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1661054094612-2a3848be037e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1661442976608-423aaf1170a4?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1666048497039-63f6df65082b?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1667656321728-e4168280c92e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1670771158115-0b8e5cd24520?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1682331086317-7e7229050e36?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1682444944126-9fb22591061e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1684414291188-5e11aaf8eb4d?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1685720543623-027f0735daed?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1686383549908-13884f86158b?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1689233410479-bfdaabb83ef3?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1697826416330-0241d6ff333f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1705133658770-a4f1ad75ff40?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1705839288225-2eea7d0534ee?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1708463949141-11272eadc563?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1708547546738-eda737297afe?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1711728640507-59559aff7556?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1713992852714-5cc95db66f78?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1717314958087-24d3b8d02121?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1717356760359-cba9ee02bdd3?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1717940730787-23de9e6c1034?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1720044332118-3c4741abb0de?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1724117271157-1c67ce5596b7?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1725101844265-6fc73025de28?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1727379899259-81ec81876551?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1731847990437-586ecbfbc921?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1732267994253-4b9e4fd70a41?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1734305529432-4e81d8fd5cc6?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1739012588735-697c1585da01?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1742293523152-7ac0e0131bd9?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1750880077542-efc2e2a22e3f?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1750880112394-3284dd73caa7?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1753295687822-b7785d55c24e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1753295687824-22b36f3daa33?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1753792349400-ad793222216b?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1754962846057-54e6f2dafdfc?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1756758822288-0c92645edc11?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1758551538619-1cbc2125c69f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1758626217959-2e1441e098b9?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1758961340009-0b6a97577aff?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1758991016394-203a91a74d3c?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1759054715075-26e9f7d83f38?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1759065455283-9d89e5b56a9f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1759788618167-8c2b55e3863f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1759860237987-ed12b8103e20?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1760124057265-494a3e86a841?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1760697445086-552645dcd236?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1760888330756-9f7a05cfc57f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1761013243196-7190dfb77a2b?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1762420986400-cb1c2901e5ab?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1762967251160-624e33010acf?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1763062082619-af0eae594209?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1763310330461-e2fc6f4c32cd?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1764258492954-11cbe275c01e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1764385136489-237c1e16a294?w=800&h=600&fit=crop'
        ],
        [
            'https://images.unsplash.com/photo-1764671121096-ae18e8ae79a7?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1764776709782-9a88771f1a0f?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1765475467677-579353b25ce0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1767385717988-6897d51252b0?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1767452011288-7770f84eb9ab?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1767556802264-1805305cc5a6?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1768862210935-e65367b19a0e?w=800&h=600&fit=crop',
            'https://images.unsplash.com/photo-1769411596330-d5ea68f07a8f?w=800&h=600&fit=crop'
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
