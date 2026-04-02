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
    image: "/images/ski-group-three.jpg",
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
    image: "/images/young-skier.jpg",
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
    image: "/images/skier-action.jpg",
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
    image: "/images/heliski.jpg",
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
    image: "/images/snowboards-rack.jpg",
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
    image: "/images/skier-jump.jpg",
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
    image: "/images/ski-group-three.jpg",
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
    image: "/images/ski-mountain-duo.jpg",
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
    image: "/images/skier-jump.jpg",
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
  },
  {
    slug: "centro-de-ski-el-colorado",
    date: "2016-08-08",
    image: "/images/ski-mountain-duo.jpg",
    category: "blog" as const,
    title: { es: "El Colorado Centro de Ski", en: "El Colorado Ski Resort", pt: "El Colorado Centro de Ski" },
    excerpt: {
      es: "A solo 36 km de Santiago, El Colorado cuenta con 112 pistas y 1.100 hectáreas de superficie esquiable. El centro ideal para familias y jóvenes.",
      en: "Just 36 km from Santiago, El Colorado features 112 runs and 1,100 hectares of skiable terrain. The ideal resort for families and youth.",
      pt: "A apenas 36 km de Santiago, El Colorado conta com 112 pistas e 1.100 hectares de superfície esquiável. O centro ideal para famílias."
    },
    content: {
      es: "<p>El Colorado Centro de Esquí, ubicado a 36 kilómetros de Santiago, fue creado por Los Pioneros que buscaban establecer un centro de ski cercano a la capital. En 1935 se construyó el primer refugio en Farellones y en 1948 el primer andarivel de arrastre.</p><p>La altura mínima es de 2.560 metros (pista Los Zorros) y alcanza más de 3.300 metros sobre el nivel del mar, con un desnivel de 1.090 metros. Actualmente cuenta con 112 pistas y 1.100 hectáreas de superficie esquiable, siendo uno de los mejores centros de Sudamérica.</p><p>Junto a La Parva y Valle Nevado, forman la mayor superficie esquiable de Sudamérica. El Colorado es el centro ideal para familias y jóvenes por su cercanía a Santiago, variedad de servicios y pistas para todos los niveles. Posee hoteles, departamentos, gastronomía variada y arriendo de equipo completo.</p>",
      en: "<p>El Colorado Ski Resort, located 36 km from Santiago, was created by Los Pioneros who sought to establish a ski center near the capital. In 1935 the first shelter was built in Farellones, and in 1948 the first drag lift.</p><p>The minimum elevation is 2,560 meters (Los Zorros run) reaching over 3,300 meters above sea level, with 1,090 meters of vertical drop. It currently has 112 runs and 1,100 hectares of skiable terrain, making it one of the best in South America.</p><p>Together with La Parva and Valle Nevado, they form South America's largest skiable area. El Colorado is ideal for families due to its proximity to Santiago, variety of services, and runs for all levels.</p>",
      pt: "<p>El Colorado, localizado a 36 km de Santiago, foi criado por Los Pioneros que buscavam estabelecer um centro de ski perto da capital. Em 1935 foi construído o primeiro refúgio em Farellones.</p><p>A altitude mínima é de 2.560 metros, alcançando mais de 3.300 metros, com 1.090 metros de desnível. Atualmente conta com 112 pistas e 1.100 hectares de superfície esquiável.</p><p>Junto com La Parva e Valle Nevado, formam a maior superfície esquiável da América do Sul. El Colorado é ideal para famílias pela proximidade com Santiago e variedade de serviços.</p>"
    }
  },
  {
    slug: "centro-de-ski-la-parva",
    date: "2016-08-08",
    image: "/images/skier-jump.jpg",
    category: "blog" as const,
    title: { es: "Centro de Ski La Parva", en: "La Parva Ski Resort", pt: "Centro de Ski La Parva" },
    excerpt: {
      es: "A 50 km de Santiago, La Parva ofrece las mejores vistas al valle y 38 km de pistas esquiables conectables con Valle Nevado.",
      en: "50 km from Santiago, La Parva offers the best valley views and 38 km of skiable runs connectable to Valle Nevado.",
      pt: "A 50 km de Santiago, La Parva oferece as melhores vistas ao vale e 38 km de pistas conectáveis com Valle Nevado."
    },
    content: {
      es: "<p>Emplazado en uno de los sectores más hermosos de la Cordillera, a solo 50 km de Santiago, La Parva tiene una hermosa vista al valle de Santiago y es el centro invernal con mayor cantidad de refugios y departamentos privados.</p><p>Se encuentra a 2.750 metros de altura, con arquitectura bella y pistas de excelente nivel reconocidas mundialmente. Cuenta con 30 pistas y 38 km de terreno esquiable que se pueden extender conectándose con Valle Nevado.</p><p>Ofrece todos los servicios: alojamiento, restaurantes, escuela de ski, bares, arriendo de equipos y snowpark. La práctica del snowboard y heliski está implementada. Cuenta con más de 100 niños en entrenamiento en ski alpino y freestyle.</p>",
      en: "<p>Set in one of the most beautiful sectors of the Andes, just 50 km from Santiago, La Parva offers stunning views of the Santiago valley and has the most private lodges and apartments of any winter resort.</p><p>At 2,750 meters altitude, it features beautiful architecture and world-renowned runs. It has 30 runs and 38 km of skiable terrain that can be extended by connecting to Valle Nevado.</p><p>It offers full services: lodging, restaurants, ski school, bars, equipment rental, and snowpark. Snowboard and heliski are available. Over 100 children train in alpine and freestyle skiing.</p>",
      pt: "<p>Situado em um dos setores mais bonitos da Cordilheira, a 50 km de Santiago, La Parva tem uma vista deslumbrante do vale de Santiago e é o centro com mais refugios e apartamentos privados.</p><p>A 2.750 metros de altitude, conta com 30 pistas e 38 km de terreno esquiável que podem se estender conectando-se com Valle Nevado.</p><p>Oferece todos os serviços: hospedagem, restaurantes, escola de ski, bares e aluguel de equipamentos. Snowboard e heliski estão disponíveis.</p>"
    }
  },
  {
    slug: "childrens-snowboard-lessons",
    date: "2016-08-08",
    image: "/images/kids-ski-group.jpg",
    category: "blog" as const,
    title: { es: "Esquí y Snowboard para Niños en Chile", en: "Kids Ski & Snowboard Lessons in Chile", pt: "Aulas de Ski e Snowboard para Crianças no Chile" },
    excerpt: {
      es: "La diversión y seguridad de los niños es prioridad en los centros de ski. Clases grupales desde $50.000 CLP y privadas desde $150.000 CLP para niños desde 7 años.",
      en: "Children's fun and safety are top priority at ski resorts. Group lessons from $50,000 CLP and private from $150,000 CLP for kids 7 and up.",
      pt: "A diversão e segurança das crianças é prioridade nos centros de ski. Aulas em grupo desde $50.000 CLP e particulares desde $150.000 CLP para crianças a partir de 7 anos."
    },
    content: {
      es: "<p>La diversión y seguridad de los niños es prioridad en los centros de ski de Chile. Los resorts cuentan con profesionales dedicados a enseñar los fundamentos del esquí a los más pequeños, desde los 7 años de edad.</p><p>Centros como El Colorado, Valle Nevado, La Parva y Portillo son ideales para que los niños aprendan a esquiar en distintos niveles. Ya sea mediante clases grupales o individuales, los resorts en las cercanías de Santiago ofrecen una gran oportunidad familiar.</p><p>Las clases grupales tienen un precio desde $50.000 CLP, mientras que las lecciones privadas cuestan desde $150.000 CLP. Niños menores de 7 años deben consultar la escuelita de cada centro de ski directamente.</p>",
      en: "<p>Children's fun and safety are top priority at Chile's ski resorts. The resorts have professionals dedicated to teaching skiing fundamentals to children from age 7.</p><p>Centers like El Colorado, Valle Nevado, La Parva, and Portillo are ideal for kids to learn skiing at different levels. Whether through group or private lessons, Santiago's nearby resorts offer a great family opportunity.</p><p>Group lessons start at $50,000 CLP, while private lessons cost from $150,000 CLP. Children under 7 should check the ski school at each resort directly.</p>",
      pt: "<p>A diversão e segurança das crianças é prioridade nos centros de ski do Chile. Os resorts contam com profissionais dedicados a ensinar os fundamentos do esqui para crianças a partir dos 7 anos.</p><p>Centros como El Colorado, Valle Nevado, La Parva e Portillo são ideais para as crianças aprenderem a esquiar. Seja em aulas em grupo ou particulares, os resorts perto de Santiago oferecem uma ótima oportunidade familiar.</p><p>Aulas em grupo começam a partir de $50.000 CLP e particulares desde $150.000 CLP. Crianças menores de 7 anos devem consultar a escolinha de cada centro de ski.</p>"
    }
  },
  {
    slug: "rental",
    date: "2016-08-08",
    image: "/images/snowboards-rack.jpg",
    category: "blog" as const,
    title: { es: "Arriendo de Equipo de Ski y Snowboard", en: "Ski & Snowboard Equipment Rental", pt: "Aluguel de Equipamento de Ski e Snowboard" },
    excerpt: {
      es: "El equipo que usas es clave para aprender. Te recomendamos las mejores opciones de arriendo en los centros de ski de Santiago.",
      en: "The equipment you use is key to learning. We recommend the best rental options at Santiago's ski resorts.",
      pt: "O equipamento que você usa é fundamental para aprender. Recomendamos as melhores opções de aluguel nos centros de ski de Santiago."
    },
    content: {
      es: "<p>El equipo que usas es clave a la hora de aprender o querer mejorar nivel. Un equipo adecuado te permite progresar más rápido y disfrutar más de la experiencia en la montaña.</p><p>En CDSKI ofrecemos arriendo de equipo completo por $65.000 CLP por persona, que incluye ski o snowboard, botas, bastones y casco. El arriendo está sujeto a disponibilidad.</p><p>La ropa de nieve y guantes se arriendan directamente en el centro de ski. Te recomendamos llevar ropa térmica en capas, guantes impermeables, gorro y protector solar factor 50+. Si no tienes stock de equipo con nosotros, también puedes arrendar directamente en el centro de ski.</p>",
      en: "<p>The equipment you use is key to learning and improving your skills. Proper equipment allows you to progress faster and enjoy the mountain experience more.</p><p>At CDSKI we offer full equipment rental for $65,000 CLP per person, including ski or snowboard, boots, poles, and helmet. Rental is subject to availability.</p><p>Snow clothing and gloves are rented directly at the ski resort. We recommend layered thermal clothing, waterproof gloves, hat, and SPF 50+ sunscreen.</p>",
      pt: "<p>O equipamento que você usa é fundamental para aprender e melhorar. Um equipamento adequado permite progredir mais rápido e curtir mais a experiência na montanha.</p><p>Na CDSKI oferecemos aluguel de equipamento completo por $65.000 CLP por pessoa, incluindo ski ou snowboard, botas, bastões e capacete. Sujeito a disponibilidade.</p><p>Roupas de neve e luvas são alugadas diretamente no centro de ski. Recomendamos roupas térmicas em camadas, luvas impermeáveis e protetor solar fator 50+.</p>"
    }
  },
  {
    slug: "experiencias",
    date: "2016-08-08",
    image: "/images/ski-group-three.jpg",
    category: "blog" as const,
    title: { es: "Experiencias CDSKI — Empresas y Colegios", en: "CDSKI Experiences — Corporate & Schools", pt: "Experiências CDSKI — Empresas e Escolas" },
    excerpt: {
      es: "Aventuras de esquí exclusivas para empresas y colegios en Valle Nevado, La Parva y El Colorado. Team building en la montaña.",
      en: "Exclusive ski adventures for companies and schools at Valle Nevado, La Parva, and El Colorado. Mountain team building.",
      pt: "Aventuras de ski exclusivas para empresas e escolas em Valle Nevado, La Parva e El Colorado. Team building na montanha."
    },
    content: {
      es: "<p>CDSKI ofrece experiencias exclusivas para empresas y colegios en los principales centros de ski cerca de Santiago: Valle Nevado, La Parva y El Colorado. Organizamos jornadas completas de team building en la montaña.</p><p>Nuestras experiencias corporativas incluyen clases de ski o snowboard grupales, guía de montaña, coordinación logística completa y actividades personalizadas según los objetivos del grupo.</p><p>Para colegios, ofrecemos programas educativos en la nieve que combinan deporte, naturaleza y aprendizaje. Los estudiantes aprenden a esquiar mientras desarrollan habilidades de trabajo en equipo y superación personal. ¡Contáctanos para diseñar tu experiencia a medida!</p>",
      en: "<p>CDSKI offers exclusive experiences for companies and schools at Santiago's main ski resorts: Valle Nevado, La Parva, and El Colorado. We organize complete mountain team building days.</p><p>Our corporate experiences include group ski or snowboard lessons, mountain guide, complete logistics coordination, and personalized activities according to group objectives.</p><p>For schools, we offer educational snow programs combining sport, nature, and learning. Students learn to ski while developing teamwork and personal growth skills. Contact us to design your custom experience!</p>",
      pt: "<p>A CDSKI oferece experiências exclusivas para empresas e escolas nos principais centros de ski perto de Santiago: Valle Nevado, La Parva e El Colorado. Organizamos dias completos de team building na montanha.</p><p>Nossas experiências corporativas incluem aulas de ski ou snowboard em grupo, guia de montanha, coordenação logística completa e atividades personalizadas.</p><p>Para escolas, oferecemos programas educativos na neve que combinam esporte, natureza e aprendizado. Entre em contato para desenhar sua experiência sob medida!</p>"
    }
  },
  {
    slug: "donde-alojar-en-la-nieve",
    date: "2016-08-08",
    image: "/images/ski-mountain-duo.jpg",
    category: "blog" as const,
    title: { es: "¿Dónde Alojar si Vas a la Nieve?", en: "Where to Stay When Going to the Snow?", pt: "Onde se Hospedar se Vai à Neve?" },
    excerpt: {
      es: "Guía de alojamiento cerca de los centros de ski de Santiago. Hoteles, departamentos y opciones para todos los presupuestos.",
      en: "Accommodation guide near Santiago's ski resorts. Hotels, apartments, and options for every budget.",
      pt: "Guia de hospedagem perto dos centros de ski de Santiago. Hotéis, apartamentos e opções para todos os orçamentos."
    },
    content: {
      es: "<p>Si vas a disfrutar de la nieve en los centros de ski cercanos a Santiago, tienes varias opciones de alojamiento. En Lo Barnechea y La Dehesa encontrarás hoteles modernos a pocos kilómetros de la subida a la montaña.</p><p>Valle Nevado cuenta con tres hoteles propios dentro del resort: Valle Nevado, Puerta del Sol y Tres Puntas, ideales para quienes quieren vivir la experiencia completa en la montaña sin preocuparse del transporte diario.</p><p>Farellones ofrece departamentos y refugios más económicos, perfectos para familias y grupos. También puedes alojarte en Santiago y subir cada día — el trayecto dura aproximadamente 1.5 horas desde Las Condes. CDSKI ofrece servicio de traslado en vehículo particular para grupos de 4 o más personas.</p>",
      en: "<p>If you're going to enjoy the snow at Santiago's nearby ski resorts, you have several accommodation options. In Lo Barnechea and La Dehesa you'll find modern hotels just kilometers from the mountain road.</p><p>Valle Nevado has three hotels within the resort: Valle Nevado, Puerta del Sol, and Tres Puntas, ideal for those wanting the complete mountain experience without daily transport concerns.</p><p>Farellones offers more affordable apartments and lodges, perfect for families and groups. You can also stay in Santiago and go up daily — the drive takes about 1.5 hours from Las Condes. CDSKI offers private vehicle transfer for groups of 4 or more.</p>",
      pt: "<p>Se você vai curtir a neve nos centros de ski perto de Santiago, tem várias opções de hospedagem. Em Lo Barnechea e La Dehesa encontrará hotéis modernos a poucos quilômetros da subida à montanha.</p><p>Valle Nevado conta com três hotéis próprios dentro do resort: Valle Nevado, Puerta del Sol e Tres Puntas, ideais para quem quer viver a experiência completa na montanha.</p><p>Farellones oferece apartamentos e refúgios mais econômicos, perfeitos para famílias. Também pode se hospedar em Santiago e subir diariamente. A CDSKI oferece traslado em veículo particular para grupos de 4 ou mais pessoas.</p>"
    }
  },
  {
    slug: "a-la-nieve-en-helicoptero",
    date: "2016-08-08",
    image: "/images/heliski.jpg",
    category: "blog" as const,
    title: { es: "A la Nieve en Helicóptero", en: "To the Snow by Helicopter", pt: "À Neve de Helicóptero" },
    excerpt: {
      es: "La forma más adrenalínica de llegar a Valle Nevado: 15 minutos de vuelo desde Santiago. Capacidad 5 pasajeros, desde $1.370 USD por tramo.",
      en: "The most thrilling way to reach Valle Nevado: 15-minute flight from Santiago. 5-passenger capacity, from $1,370 USD per leg.",
      pt: "A forma mais adrenalínica de chegar a Valle Nevado: 15 minutos de voo desde Santiago. Capacidade 5 passageiros, desde $1.370 USD por trecho."
    },
    content: {
      es: "<p>Entre todas las posibilidades para subir a Valle Nevado, sin duda subir en helicóptero es la más adrenalínica. Un recuerdo único volando sobre Santiago adentrándose al corazón de la Cordillera de los Andes para disfrutar de la mejor nieve de Sudamérica.</p><p>El viaje dura solo 15 minutos desde el Aeródromo Tobalaba. Los helicópteros tienen capacidad para 5 pasajeros sin equipaje. El precio es de $1.370 USD por tramo (en base a helicóptero con capacidad para 4 pasajeros).</p><p>Las tarifas son por vuelo, independiente del número de pasajeros. Se consideran pasajeros todos los mayores de 2 años. Reservas al +56 9 4021 1459 o info@clasesdeski.cl</p>",
      en: "<p>Among all the ways to get to Valle Nevado, going by helicopter is undoubtedly the most thrilling. A unique experience flying over Santiago into the heart of the Andes to enjoy South America's best snow.</p><p>The trip takes just 15 minutes from Tobalaba Aerodrome. Helicopters have capacity for 5 passengers without luggage. The price is $1,370 USD per leg (based on a 4-passenger helicopter).</p><p>Rates are per flight, regardless of the number of passengers. All passengers over 2 years old count. Book at +56 9 4021 1459 or info@clasesdeski.cl</p>",
      pt: "<p>Entre todas as formas de chegar a Valle Nevado, subir de helicóptero é sem dúvida a mais adrenalínica. Uma experiência única voando sobre Santiago até o coração dos Andes.</p><p>A viagem dura apenas 15 minutos do Aeródromo Tobalaba. Os helicópteros têm capacidade para 5 passageiros sem bagagem. O preço é de $1.370 USD por trecho.</p><p>As tarifas são por voo, independente do número de passageiros. Reservas pelo +56 9 4021 1459 ou info@clasesdeski.cl</p>"
    }
  },
  {
    slug: "aulas-de-ski",
    date: "2023-07-22",
    image: "/images/ski-group-three.jpg",
    category: "blog" as const,
    title: { es: "Aulas de Ski no Chile (Português)", en: "Ski Lessons in Chile (Portuguese)", pt: "Aulas de Ski no Chile | CDSKI" },
    excerpt: {
      es: "Artículo en portugués sobre clases de ski en Chile para turistas brasileños.",
      en: "Portuguese article about ski lessons in Chile for Brazilian tourists.",
      pt: "Aprenda a esquiar nos melhores centros de ski do Chile. El Colorado e Valle Nevado oferecem a experiência perfeita para brasileiros."
    },
    content: {
      es: "<p>Artículo dedicado a nuestros amigos brasileños que visitan Chile para esquiar. Las aulas de ski en El Colorado y Valle Nevado son la opción perfecta para quienes buscan aventura en la Cordillera de los Andes.</p>",
      en: "<p>Article dedicated to our Brazilian friends visiting Chile to ski. Ski lessons at El Colorado and Valle Nevado are the perfect option for those seeking adventure in the Andes.</p>",
      pt: "<p>Se você está buscando aventura e emoção em meio a belas paisagens de inverno, as aulas de ski nos centros de El Colorado e Valle Nevado são a opção perfeita. Deslizar pelas majestosas montanhas cobertas de neve é uma experiência inesquecível.</p><p>El Colorado e Valle Nevado são dois dos centros de ski mais destacados da região, conhecidos por suas excelentes instalações e pistas bem cuidadas. As aulas são ministradas por instrutores privados que conhecem as montanhas perfeitamente.</p><p>Nossos instrutores falam português! Atendemos turistas brasileiros com todo o carinho e dedicação. Reserve suas aulas pelo WhatsApp +56 9 4021 1459.</p>"
    }
  },
  {
    slug: "aulas-de-snowboard-2",
    date: "2023-07-22",
    image: "/images/young-skier.jpg",
    category: "blog" as const,
    title: { es: "Aulas de Snowboard no Chile (Português)", en: "Snowboard Lessons in Chile (Portuguese)", pt: "Aulas de Snowboard no Chile | CDSKI" },
    excerpt: {
      es: "Artículo en portugués sobre clases de snowboard para turistas brasileños.",
      en: "Portuguese article about snowboard lessons for Brazilian tourists.",
      pt: "Domine as montanhas nevadas do Chile com aulas de snowboard personalizadas. Instrutores que falam português para turistas brasileiros."
    },
    content: {
      es: "<p>Artículo dedicado a turistas brasileños interesados en aprender snowboard en Chile.</p>",
      en: "<p>Article for Brazilian tourists interested in learning snowboard in Chile.</p>",
      pt: "<p>As aulas de snowboard com instrutores privados oferecem atenção personalizada e exclusiva. Nossos instrutores conhecem as técnicas mais seguras, permitindo que você aprenda de forma segura e eficaz.</p><p>Com aulas particulares, você progredirá rapidamente, enfrentando diferentes desafios com o apoio de um instrutor dedicado. As aulas são adaptadas completamente ao seu nível de habilidade e objetivos pessoais.</p><p>Oferecemos aulas em Valle Nevado, El Colorado e La Parva. Nossos instrutores falam português fluente! Reserve pelo WhatsApp +56 9 4021 1459.</p>"
    }
  }
];
