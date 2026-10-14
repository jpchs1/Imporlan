import { useState } from 'react';
import { Card, Button, PageHeader, Lightbox } from '../../shared/components/UI';
import { ExternalLink, Mail, MapPin, WhatsAppIcon, Hand, Sun, Ruler, Wrench, ZoomIn } from '../../shared/components/Icons';

// Deckeva es la empresa de pisos del mismo equipo de Imporlan. Las fotos son
// de instalaciones reales y viven en public/partners/deckeva (antes se
// enlazaban desde deckeva.cl y se rompían si allá cambiaban de ruta).
const BASE = `${import.meta.env.BASE_URL}partners/deckeva/`;
const UTM = 'utm_source=imporlan&utm_medium=panel&utm_campaign=partner_deckeva&utm_content=pagina_deckeva';
const COTIZAR_URL = `https://www.deckeva.cl/?${UTM}#cotizar`;
const WHATSAPP_URL = 'https://wa.me/56940211459?text=Hola%20Deckeva%2C%20vengo%20del%20panel%20de%20Imporlan%20y%20quiero%20cotizar%20un%20piso%20para%20mi%20lancha';

const GALERIA = [
  { src: `${BASE}monterey-258ss.webp`, alt: 'Piso de goma EVA color teca instalado en la popa de una Monterey 258SS' },
  { src: `${BASE}varas.webp`, alt: 'Cabina de lancha con piso y peldaños de goma EVA color teca' },
  { src: `${BASE}cubierta-2.webp`, alt: 'Solárium de una Sea Ray con piso de goma EVA a medida' },
  { src: `${BASE}cubierta-3.webp`, alt: 'Cockpit de una Sea Ray con piso de goma EVA y logo grabado' },
  { src: `${BASE}monterey-258ss-2.webp`, alt: 'Vista superior de la plataforma de baño con piso de goma EVA' },
  { src: `${BASE}piso-de-lancha.webp`, alt: 'Lancha deportiva con piso de goma EVA en cubierta y plataforma' },
];

const BENEFICIOS = [
  { icon: Hand, title: 'Antideslizante', desc: 'Agarre firme aunque el piso esté mojado: menos resbalones a bordo.' },
  { icon: Sun, title: 'Resiste sol y sal', desc: 'Goma EVA con protección UV; no se destiñe ni se agrieta con el uso en el agua.' },
  { icon: Ruler, title: 'Cortado a medida', desc: 'Se fabrica en Chile según el plano de tu embarcación, con el adhesivo 3M ya aplicado.' },
  { icon: Wrench, title: 'Instalación fácil', desc: 'Lo puedes instalar tú mismo con el video explicativo, o pedir la toma de medidas y la instalación en terreno.' },
];

export default function Deckeva() {
  const [foto, setFoto] = useState(null);
  const abrir = (url) => window.open(url, '_blank', 'noopener');

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Empresa del grupo Imporlan"
        title="Pisos Deckeva"
        description="Pisos de goma EVA antideslizantes, cortados a medida para tu lancha, velero o moto de agua."
        actions={<Button icon={ExternalLink} onClick={() => abrir(COTIZAR_URL)}>Cotizar en deckeva.cl</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <Card className="lg:col-span-3">
          <Card.Header title="Qué es" />
          <Card.Body className="space-y-3 text-sm text-ink-700">
            <p className="m-0">
              Deckeva fabrica pisos de goma EVA para embarcaciones: una lámina antideslizante que reemplaza la alfombra o la fibra desnuda
              de la cubierta, el cockpit, la plataforma de baño o el solárium. Se corta a la medida de cada modelo y llega lista para pegar.
            </p>
            <p className="m-0">
              Deckeva es del mismo dueño que Imporlan, así que cuando tu lancha llegue a Chile podemos coordinar el piso
              junto con la entrega. La cotización se hace en deckeva.cl con las medidas de tu embarcación.
            </p>
          </Card.Body>
        </Card>
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <img src={GALERIA[0].src} alt={GALERIA[0].alt} className="w-full h-full min-h-[200px] object-cover" loading="lazy" />
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {BENEFICIOS.map((b) => (
          <Card key={b.title} padding="sm">
            <span className="h-9 w-9 rounded-md bg-neutral-bg text-ink-700 flex items-center justify-center mb-3"><b.icon size={18} /></span>
            <h3 className="text-sm font-semibold text-ink-900 m-0">{b.title}</h3>
            <p className="text-13 text-ink-500 mt-1 m-0">{b.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <Card.Header title="Instalaciones" description="Fotos de pisos Deckeva en embarcaciones de clientes" />
        <Card.Body>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 m-0 p-0 list-none">
            {GALERIA.map((f, i) => (
              <li key={f.src}>
                <button type="button" onClick={() => setFoto(i)} aria-label={`Ampliar: ${f.alt}`}
                  className="group relative block w-full aspect-[4/3] rounded-md overflow-hidden bg-neutral-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                  <img src={f.src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-surface/90 text-ink-700 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"><ZoomIn size={14} /></span>
                </button>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header title="Cotiza tu piso" description="El precio depende del modelo y de las zonas que quieras cubrir." />
        <Card.Body className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ul className="m-0 p-0 list-none space-y-1.5 text-sm text-ink-700">
            <li className="flex items-center gap-2"><Mail size={16} className="text-ink-500 shrink-0" /><a href="mailto:contacto@deckeva.cl" className="text-brand-600 hover:underline">contacto@deckeva.cl</a></li>
            <li className="flex items-center gap-2"><MapPin size={16} className="text-ink-500 shrink-0" />Lo Barnechea, Santiago · envíos a todo Chile</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={WhatsAppIcon} onClick={() => abrir(WHATSAPP_URL)}>Escribir por WhatsApp</Button>
            <Button icon={ExternalLink} onClick={() => abrir(COTIZAR_URL)}>Cotizar en deckeva.cl</Button>
          </div>
        </Card.Body>
      </Card>

      <Lightbox open={foto !== null} items={GALERIA} index={foto ?? 0} onIndexChange={setFoto} onClose={() => setFoto(null)} />
    </div>
  );
}
