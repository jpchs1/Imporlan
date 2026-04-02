export type BlogPost = {
  slug: string;
  date: string;
  image: string;
  category: "blog" | "explora";
  title: { es: string; en: string; pt: string };
  excerpt: { es: string; en: string; pt: string };
  content: { es: string; en: string; pt: string };
};

export const blogPosts: BlogPost[] = [
  {
    slug: "clases-de-ski",
    date: "2023-07-21",
    image: "/test/images/ski-group-three.jpg",
    category: "blog",
    title: { es: "Clases de Ski en Chile | CDSKI", en: "Ski Lessons in Chile | CDSKI", pt: "Aulas de Ski no Chile | CDSKI" },
    excerpt: {
      es: "Aprende a esquiar en los mejores centros de ski de Chile con instructores expertos. Descubre por qué El Colorado y Valle Nevado son ideales para tu primera experiencia en la nieve.",
      en: "Learn to ski at Chile's best ski resorts with expert instructors. Discover why El Colorado and Valle Nevado are ideal for your first snow experience.",
      pt: "Aprenda a esquiar nos melhores centros de ski do Chile com instrutores expertos. Descubra por que El Colorado e Valle Nevado são ideais para sua primeira experiência na neve."
    },
    content: {
      es: "<p>Si estás buscando aventura y emoción en medio de hermosos paisajes invernales, las clases de ski en El Colorado y Valle Nevado son la opción perfecta. Deslizarte por las majestuosas montañas cubiertas de nieve en estos reconocidos centros de ski, mientras aprendes las técnicas adecuadas, es una experiencia que nunca olvidarás.</p><p>El Colorado y Valle Nevado son dos de los centros de ski más destacados de la región, conocidos por sus excelentes instalaciones y pistas bien cuidadas. Las clases son impartidas por instructores PRIVADOS altamente capacitados que conocen las montañas a la perfección.</p><p>Nuestros paquetes incluyen opciones Half Day y Full Day, con equipo disponible y transporte para grupos. ¡Reserva tu clase hoy y vive la montaña!</p>",
      en: "<p>If you're looking for adventure and excitement amid beautiful winter landscapes, ski lessons at El Colorado and Valle Nevado are the perfect choice. Gliding down the majestic snow-covered mountains at these renowned ski resorts while learning proper techniques is an experience you'll never forget.</p><p>El Colorado and Valle Nevado are two of the most outstanding ski resorts in the region, known for their excellent facilities and well-maintained slopes. Lessons are taught by highly skilled PRIVATE instructors who know the mountains perfectly.</p><p>Our packages include Half Day and Full Day options, with equipment available and group transport. Book your lesson today and live the mountain!</p>",
      pt: "<p>Se você busca aventura e emoção em meio a belas paisagens de inverno, as aulas de ski em El Colorado e Valle Nevado são a opção perfeita. Deslizar pelas majestosas montanhas cobertas de neve nestes renomados centros de ski é uma experiência inesquecível.</p><p>El Colorado e Valle Nevado são dois dos centros de ski mais destacados da região, conhecidos por suas excelentes instalações. As aulas são ministradas por instrutores PRIVADOS altamente capacitados que conhecem as montanhas perfeitamente.</p><p>Nossos pacotes incluem opções Half Day e Full Day, com equipamento disponível e transporte para grupos. Reserve sua aula hoje!</p>"
    }
  },
  {
    slug: "clases-de-snowboard",
    date: "2023-07-22",
    image: "/test/images/young-skier.jpg",
    category: "blog",
    title: { es: "Clases de Snowboard en Chile | CDSKI", en: "Snowboard Lessons in Chile | CDSKI", pt: "Aulas de Snowboard no Chile | CDSKI" },
    excerpt: {
      es: "Domina las montañas nevadas con estilo y seguridad. Clases privadas de snowboard con instructores dedicados para todos los niveles.",
      en: "Master the snowy mountains with style and safety. Private snowboard lessons with dedicated instructors for all levels.",
      pt: "Domine as montanhas nevadas com estilo e segurança. Aulas particulares de snowboard com instrutores dedicados para todos os níveis."
    },
    content: {
      es: "<p>Las clases de snowboard con instructores privados te ofrecen una atención personalizada y exclusiva. Estos instructores conocen las técnicas y prácticas más seguras, permitiéndote aprender de manera segura y efectiva.</p><p>Al recibir clases privadas, podrás progresar rápidamente enfrentando diferentes desafíos con el apoyo de un instructor dedicado. Las clases se adaptan completamente a tu nivel de habilidad y objetivos personales.</p><p>Ofrecemos clases en Valle Nevado, El Colorado y La Parva. ¡Anímate a probar el snowboard con CDSKI!</p>",
      en: "<p>Private snowboard lessons offer you personalized and exclusive attention. Our instructors know the safest techniques, allowing you to learn safely and effectively.</p><p>With private lessons, you'll progress quickly, facing different challenges with the support of a dedicated instructor. Lessons are fully adapted to your skill level and personal goals.</p><p>We offer lessons at Valle Nevado, El Colorado, and La Parva. Try snowboarding with CDSKI!</p>",
      pt: "<p>As aulas particulares de snowboard oferecem atenção personalizada e exclusiva. Nossos instrutores conhecem as técnicas mais seguras, permitindo que você aprenda de forma segura e eficaz.</p><p>Com aulas particulares, você progredirá rapidamente, enfrentando diferentes desafios com o apoio de um instrutor dedicado. As aulas são adaptadas ao seu nível e objetivos.</p><p>Oferecemos aulas em Valle Nevado, El Colorado e La Parva. Experimente o snowboard com CDSKI!</p>"
    }
  },
  {
    slug: "valle-nevado-centro-de-ski",
    date: "2016-08-08",
    image: "/test/images/skier-action.jpg",
    category: "blog",
    title: { es: "Valle Nevado — El Centro de Ski Más Grande de Sudamérica", en: "Valle Nevado — South America's Largest Ski Resort", pt: "Valle Nevado — O Maior Centro de Ski da América do Sul" },
    excerpt: {
      es: "A solo 46 km de Santiago, Valle Nevado es el centro de ski más grande de Sudamérica con un 80% de días despejados en temporada.",
      en: "Just 46 km from Santiago, Valle Nevado is South America's largest ski resort with 80% sunny days during the season.",
      pt: "A apenas 46 km de Santiago, Valle Nevado é o maior centro de ski da América do Sul com 80% de dias ensolarados na temporada."
    },
    content: {
      es: "<p>Valle Nevado, el centro de ski más grande de Sudamérica, se ubica a 46 kilómetros al oriente de Santiago de Chile. Posee una excelente calidad de nieve, por su altura y orientación, y un clima privilegiado con un 80% de días despejados en la temporada.</p><p>La historia de Valle Nevado comienza en 1987, inspirado en el complejo invernal Les Arcs de Francia. Desde 1998 se desarrolló como centro integral, inaugurando en 2001 la telesilla Andes Express, el primer andarivel desembragable de Sudamérica.</p><p>Hoy Valle Nevado cuenta con hoteles de primer nivel, alfombras de embarque, el Mirador del Plomo y una oferta gastronómica de clase mundial. Es el destino favorito de esquiadores de todo el mundo.</p>",
      en: "<p>Valle Nevado, South America's largest ski resort, is located 46 kilometers east of Santiago, Chile. It boasts excellent snow quality due to its altitude and orientation, and a privileged climate with 80% sunny days during the season.</p><p>Valle Nevado's history began in 1987, inspired by France's Les Arcs winter complex. Since 1998, it developed as an integrated resort, inaugurating the Andes Express chairlift in 2001 — South America's first detachable lift.</p><p>Today Valle Nevado features world-class hotels, boarding carpets, the Mirador del Plomo viewpoint, and fine dining. It's the favorite destination for skiers worldwide.</p>",
      pt: "<p>Valle Nevado, o maior centro de ski da América do Sul, fica a 46 quilômetros de Santiago do Chile. Possui excelente qualidade de neve e um clima privilegiado com 80% de dias ensolarados na temporada.</p><p>A história de Valle Nevado começou em 1987, inspirada no complexo francês Les Arcs. Desde 1998 se desenvolveu como centro integral, inaugurando em 2001 a telecadeira Andes Express.</p><p>Hoje Valle Nevado conta com hotéis de primeiro nível e gastronomia de classe mundial. É o destino favorito de esquiadores de todo o mundo.</p>"
    }
  },
  {
    slug: "heliski-chile",
    date: "2016-08-08",
    image: "/test/images/heliski.jpg",
    category: "blog",
    title: { es: "Heliski Chile — Lo Mejor de lo Mejor en los Andes", en: "Heliski Chile — The Best of the Best in the Andes", pt: "Heliski Chile — O Melhor dos Melhores nos Andes" },
    excerpt: {
      es: "El sueño de cada esquiador: descender por nieve virgen en la Cordillera de los Andes con helicópteros Eurocopter B3 y 2.000 metros de desnivel.",
      en: "Every skier's dream: descend through untouched powder in the Andes with Eurocopter B3 helicopters and 2,000 meters of vertical drop.",
      pt: "O sonho de todo esquiador: descer por neve virgem nos Andes com helicópteros Eurocopter B3 e 2.000 metros de desnível."
    },
    content: {
      es: "<p>Hablar de Heliski en Sudamérica es hablar de Valle Nevado. Con más de 25 años de experiencia, revelando el mejor terreno y la mejor nieve de la Cordillera de los Andes a través de guías con gran experiencia y profesionalismo.</p><p>Fundado en 1988, Valle Nevado Heliski es la primera operación del sur especializada en servicios personalizados, con énfasis en seguridad y calidad. Accede a lugares inexplorados en helicópteros Eurocopter B3 y baja hasta 2.000 metros de desnivel en el mejor terreno disponible.</p><p>Todo bajo la supervisión de expertos guías de montaña y equipos de seguridad de última generación, como Air Bag. ¡Prepárate para el mejor invierno de tu vida!</p>",
      en: "<p>To speak of Heliski in South America is to speak of Valle Nevado. With over 25 years of experience, revealing the best terrain and snow in the Andes through experienced and professional guides.</p><p>Founded in 1988, Valle Nevado Heliski is the first southern operation specialized in personalized services, emphasizing safety and quality. Access unexplored locations in Eurocopter B3 helicopters and descend up to 2,000 meters of vertical drop.</p><p>Everything under the supervision of expert mountain guides and cutting-edge safety equipment. Get ready for the best winter of your life!</p>",
      pt: "<p>Falar de Heliski na América do Sul é falar de Valle Nevado. Com mais de 25 anos de experiência, revelando o melhor terreno e neve dos Andes através de guias experientes e profissionais.</p><p>Fundado em 1988, Valle Nevado Heliski é a primeira operação do sul especializada em serviços personalizados, com ênfase em segurança e qualidade. Acesse lugares inexplorados em helicópteros Eurocopter B3.</p><p>Tudo sob a supervisão de guias expertos de montanha e equipamentos de segurança de última geração. Prepare-se para o melhor inverno da sua vida!</p>"
    }
  },
  {
    slug: "consejos-primer-dia-nieve",
    date: "2016-08-08",
    image: "/test/images/snowboards-rack.jpg",
    category: "blog",
    title: { es: "12 Consejos para tu Primer Día en la Nieve", en: "12 Tips for Your First Day in the Snow", pt: "12 Dicas para seu Primeiro Dia na Neve" },
    excerpt: {
      es: "¿Primera vez en la nieve? Estos 12 consejos te ayudarán a disfrutar al máximo tu día de ski o snowboard sin sorpresas.",
      en: "First time in the snow? These 12 tips will help you make the most of your ski or snowboard day without surprises.",
      pt: "Primeira vez na neve? Estas 12 dicas vão te ajudar a aproveitar ao máximo seu dia de ski ou snowboard."
    },
    content: {
      es: "<p>Llega el invierno y muchos se preparan para su primer día en la nieve. Aquí van 12 consejos esenciales: llega bien equipado con ropa térmica en capas, guantes impermeables y protector solar. No es necesario comprar todo, arrienda el equipo en tu primera vez.</p><p>Toma una clase con instructor — aprenderás mucho más rápido y de forma segura. Hidrátate constantemente, la altura deshidrata. Llega temprano para aprovechar la nieve fresca de la mañana y evitar las filas.</p><p>Usa protector solar factor 50+ (la nieve refleja los rayos UV), lleva snacks energéticos y no olvides disfrutar del paisaje. ¡La montaña te espera!</p>",
      en: "<p>Winter arrives and many prepare for their first day in the snow. Here are 12 essential tips: arrive well-equipped with layered thermal clothing, waterproof gloves, and sunscreen. No need to buy everything — rent equipment your first time.</p><p>Take a lesson with an instructor — you'll learn much faster and safer. Stay hydrated, altitude dehydrates. Arrive early for fresh morning snow and to avoid lines.</p><p>Use SPF 50+ sunscreen (snow reflects UV rays), bring energy snacks, and don't forget to enjoy the scenery. The mountain awaits!</p>",
      pt: "<p>O inverno chega e muitos se preparam para o primeiro dia na neve. Aqui vão 12 dicas essenciais: chegue bem equipado com roupas térmicas em camadas, luvas impermeáveis e protetor solar.</p><p>Faça uma aula com instrutor — você aprenderá muito mais rápido e com segurança. Mantenha-se hidratado, a altitude desidrata. Chegue cedo para aproveitar a neve fresca da manhã.</p><p>Use protetor solar fator 50+ (a neve reflete os raios UV), leve lanches energéticos e não esqueça de curtir a paisagem!</p>"
    }
  },
  {
    slug: "10-centros-de-ski-en-chile",
    date: "2016-08-08",
    image: "/test/images/skier-jump.jpg",
    category: "blog",
    title: { es: "10 Centros de Ski en Chile que Debes Conocer", en: "10 Ski Resorts in Chile You Must Visit", pt: "10 Centros de Ski no Chile que Você Precisa Conhecer" },
    excerpt: {
      es: "Chile tiene algunos de los mejores centros de ski de Sudamérica. Descubre los 10 mejores destinos para esquiar desde el norte hasta el sur del país.",
      en: "Chile has some of the best ski resorts in South America. Discover the top 10 skiing destinations from north to south.",
      pt: "O Chile tem alguns dos melhores centros de ski da América do Sul. Descubra os 10 melhores destinos para esquiar."
    },
    content: {
      es: "<p>Los centros de ski de Chile son reconocidos por sus excelentes pistas, considerados entre los mejores de Sudamérica. Desde El Colorado y Valle Nevado cerca de Santiago, hasta Corralco y Pucón en el sur, hay opciones para todos.</p><p>Destacan Valle Nevado (el más grande), El Colorado (el más cercano a Santiago), La Parva (las mejores vistas), Portillo (el más histórico), Nevados de Chillán (con aguas termales), y Corralco (en el volcán Lonquimay).</p><p>La temporada va de junio a octubre y cada centro ofrece experiencias únicas. ¡Planifica tu viaje y conoce la nieve chilena!</p>",
      en: "<p>Chile's ski resorts are renowned for their excellent slopes, considered among the best in South America. From El Colorado and Valle Nevado near Santiago to Corralco and Pucón in the south, there are options for everyone.</p><p>Highlights include Valle Nevado (the largest), El Colorado (closest to Santiago), La Parva (best views), Portillo (most historic), Nevados de Chillán (with hot springs), and Corralco (on Lonquimay volcano).</p><p>The season runs from June to October and each resort offers unique experiences. Plan your trip and discover Chilean snow!</p>",
      pt: "<p>Os centros de ski do Chile são reconhecidos por suas excelentes pistas, considerados entre os melhores da América do Sul. Desde El Colorado e Valle Nevado perto de Santiago até Corralco no sul.</p><p>Destaques: Valle Nevado (o maior), El Colorado (mais próximo de Santiago), La Parva (melhores vistas), Portillo (mais histórico), Nevados de Chillán (com águas termais) e Corralco (no vulcão Lonquimay).</p><p>A temporada vai de junho a outubro. Planeje sua viagem e conheça a neve chilena!</p>"
    }
  },
  {
    slug: "about-cdski",
    date: "2026-03-12",
    image: "/test/images/ski-group-three.jpg",
    category: "explora",
    title: { es: "Sobre CDSKI Chile", en: "About CDSKI Chile", pt: "Sobre a CDSKI Chile" },
    excerpt: {
      es: "Conoce al equipo detrás de CDSKI: más de 10 años llevando turistas internacionales a las mejores pistas de los Andes chilenos.",
      en: "Meet the team behind CDSKI: over 10 years taking international tourists to the best slopes in the Chilean Andes.",
      pt: "Conheça a equipe por trás da CDSKI: mais de 10 anos levando turistas internacionais às melhores pistas dos Andes chilenos."
    },
    content: {
      es: "<p>CDSKI nació de la pasión por la montaña y el deseo de compartir la experiencia de esquiar en los Andes chilenos con el mundo. Nuestro equipo está integrado por instructores expertos que conocen cada rincón de Valle Nevado, El Colorado y La Parva.</p><p>Nos especializamos en recibir turistas internacionales de Argentina, Brasil, Estados Unidos, Europa y Asia. Hablamos español, inglés y portugués para que te sientas como en casa mientras disfrutas de la mejor nieve de Sudamérica.</p><p>Con más de 10 años de experiencia, hemos guiado a miles de personas en su primera experiencia en la nieve y ayudado a esquiadores avanzados a perfeccionar su técnica. ¡Tu aventura comienza con nosotros!</p>",
      en: "<p>CDSKI was born from a passion for the mountains and a desire to share the experience of skiing in the Chilean Andes with the world. Our team is made up of expert instructors who know every corner of Valle Nevado, El Colorado, and La Parva.</p><p>We specialize in welcoming international tourists from Argentina, Brazil, the USA, Europe, and Asia. We speak Spanish, English, and Portuguese so you feel at home while enjoying South America's best snow.</p><p>With over 10 years of experience, we've guided thousands in their first snow experience and helped advanced skiers perfect their technique. Your adventure starts with us!</p>",
      pt: "<p>A CDSKI nasceu da paixão pela montanha e do desejo de compartilhar a experiência de esquiar nos Andes chilenos com o mundo. Nossa equipe é formada por instrutores expertos que conhecem cada canto de Valle Nevado, El Colorado e La Parva.</p><p>Somos especialistas em receber turistas internacionais da Argentina, Brasil, EUA, Europa e Ásia. Falamos espanhol, inglês e português para que você se sinta em casa.</p><p>Com mais de 10 anos de experiência, já guiamos milhares de pessoas na neve. Sua aventura começa conosco!</p>"
    }
  },
  {
    slug: "nuestro-metodo",
    date: "2026-03-12",
    image: "/test/images/ski-mountain-duo.jpg",
    category: "explora",
    title: { es: "Nuestro Método de Enseñanza", en: "Our Teaching Method", pt: "Nosso Método de Ensino" },
    excerpt: {
      es: "Seguridad primero, aprendizaje progresivo y atención personalizada. Así es como enseñamos ski y snowboard en CDSKI.",
      en: "Safety first, progressive learning, and personalized attention. That's how we teach ski and snowboard at CDSKI.",
      pt: "Segurança em primeiro lugar, aprendizado progressivo e atenção personalizada. É assim que ensinamos ski e snowboard na CDSKI."
    },
    content: {
      es: "<p>En CDSKI creemos que cada alumno es único. Nuestro método se basa en tres pilares: seguridad, progresión y diversión. Antes de pisar la nieve, nos aseguramos de que tengas el equipo adecuado y entiendas las reglas básicas de la montaña.</p><p>Comenzamos en terreno plano para dominar el equilibrio y los movimientos básicos. Progresivamente avanzamos a pendientes suaves y luego a pistas intermedias, siempre al ritmo del alumno.</p><p>Nuestros instructores son pacientes, motivadores y se adaptan a cada persona. Ya sea tu primera vez o quieras perfeccionar tu técnica, nuestro método garantiza resultados.</p>",
      en: "<p>At CDSKI, we believe every student is unique. Our method is based on three pillars: safety, progression, and fun. Before hitting the snow, we make sure you have proper equipment and understand basic mountain rules.</p><p>We start on flat terrain to master balance and basic movements. We progressively move to gentle slopes and then intermediate runs, always at the student's pace.</p><p>Our instructors are patient, motivating, and adapt to each person. Whether it's your first time or you want to perfect your technique, our method guarantees results.</p>",
      pt: "<p>Na CDSKI acreditamos que cada aluno é único. Nosso método se baseia em três pilares: segurança, progressão e diversão. Antes de pisar na neve, garantimos que você tenha o equipamento adequado.</p><p>Começamos em terreno plano para dominar o equilíbrio. Progressivamente avançamos para pendentes suaves e depois pistas intermediárias, sempre no ritmo do aluno.</p><p>Nossos instrutores são pacientes, motivadores e se adaptam a cada pessoa. Nosso método garante resultados.</p>"
    }
  },
  {
    slug: "seguridad-montana",
    date: "2026-03-12",
    image: "/test/images/skier-jump.jpg",
    category: "explora",
    title: { es: "Seguridad y Cultura de Montaña", en: "Mountain Safety & Culture", pt: "Segurança e Cultura de Montanha" },
    excerpt: {
      es: "Protocolos de seguridad, equipamiento de calidad y respeto por la montaña. Conoce nuestros estándares de seguridad.",
      en: "Safety protocols, quality equipment, and mountain respect. Learn about our safety standards.",
      pt: "Protocolos de segurança, equipamento de qualidade e respeito pela montanha. Conheça nossos padrões."
    },
    content: {
      es: "<p>La seguridad es nuestra prioridad número uno. Todos nuestros instructores están capacitados en primeros auxilios de montaña y conocen los protocolos de emergencia de cada centro de ski.</p><p>Antes de cada clase verificamos las condiciones climáticas, el estado de las pistas y el equipo de cada alumno. Usamos casco obligatorio para todos los niveles y nos aseguramos de que botas y fijaciones estén correctamente ajustadas.</p><p>Respetamos la montaña y enseñamos a nuestros alumnos las reglas de convivencia en pista: prioridad de paso, velocidad controlada y respeto por otros esquiadores. La montaña es de todos.</p>",
      en: "<p>Safety is our number one priority. All our instructors are trained in mountain first aid and know the emergency protocols at each ski resort.</p><p>Before each lesson, we check weather conditions, slope status, and each student's equipment. Helmets are mandatory for all levels and we ensure boots and bindings are properly adjusted.</p><p>We respect the mountain and teach our students slope etiquette: right of way, controlled speed, and respect for other skiers.</p>",
      pt: "<p>A segurança é nossa prioridade número um. Todos os nossos instrutores são capacitados em primeiros socorros de montanha e conhecem os protocolos de emergência.</p><p>Antes de cada aula verificamos as condições climáticas, o estado das pistas e o equipamento de cada aluno. Capacete é obrigatório para todos os níveis.</p><p>Respeitamos a montanha e ensinamos as regras de convivência na pista: prioridade de passagem, velocidade controlada e respeito pelos outros esquiadores.</p>"
    }
  }
];
