import { Card, Button } from '../../shared/components/UI';

const GALLERY = [
  '/panel/user/assets/gallery/1.jpg',
  '/panel/user/assets/gallery/2.jpg',
  '/panel/user/assets/gallery/3.jpg',
  '/panel/user/assets/gallery/4.jpg',
  '/panel/user/assets/gallery/5.jpg',
  '/panel/user/assets/gallery/6.jpg',
  '/panel/user/assets/gallery/8.jpg',
  '/panel/user/assets/gallery/9.jpg',
  '/panel/user/assets/gallery/10.jpg',
  '/panel/user/assets/gallery/2.jpeg',
  '/panel/user/assets/gallery/11.png',
  '/panel/user/assets/gallery/12.png',
  '/panel/user/assets/gallery/13.png',
  '/panel/user/assets/gallery/14.png',
];

export default function Deckeva() {
  return (
    <div>
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ minHeight: '280px' }}>
        <img src="https://deckeva.cl/wp-content/uploads/2024/08/dock-bann-1.jpg" alt="Deckeva" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-8" style={{ minHeight: '280px' }}>
          <img src="/panel/assets/logoevadeck.jpg" alt="Deckeva Logo" className="h-16 rounded-xl mb-4 shadow-lg" onError={e => { e.target.style.display = 'none'; }} />
          <h1 className="text-3xl font-bold text-white tracking-wide">DECKEVA</h1>
          <p className="text-sm font-semibold text-cyan-300 uppercase tracking-widest mt-2">Pisos EVA para Embarcaciones</p>
          <p className="text-white/80 text-sm mt-3 max-w-lg">Renueva tu lancha con pisos antideslizantes de goma EVA cortados a medida. Seguridad, estilo y confort en cada navegacion.</p>
          <div className="flex gap-3 mt-6">
            <a href="https://www.deckeva.cl" target="_blank" rel="noreferrer">
              <Button variant="secondary" className="!bg-white !text-slate-800 hover:!bg-slate-100 font-semibold">
                Cotizar en Deckeva.cl
              </Button>
            </a>
            <a href="mailto:contacto@deckeva.cl">
              <Button variant="ghost" className="!text-white !border-white/30 hover:!bg-white/10 font-semibold border">
                Contactar
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <h2 className="text-lg font-bold text-slate-800 mb-4">Galeria de Instalaciones</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {GALLERY.map((url, i) => (
          <div key={i} className={`rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:shadow-lg transition group ${i < 2 ? 'md:col-span-2 aspect-video' : 'aspect-[4/3]'}`}>
            <img
              src={url}
              alt={`Instalacion ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onClick={() => window.open(url, '_blank')}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Features */}
        <Card className="lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-4">Caracteristicas del Producto</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🛡️', title: 'Antideslizante', desc: 'Agarre excepcional incluso mojado' },
              { icon: '☀️', title: 'Proteccion UV', desc: 'Resistente a los rayos solares' },
              { icon: '🔧', title: 'Facil Instalacion', desc: 'Adhesivo 3M de alta resistencia' },
              { icon: '📏', title: 'Corte a Medida', desc: 'Personalizado para tu embarcacion' },
              { icon: '🧹', title: 'Facil Limpieza', desc: 'Resistente a manchas y sal' },
              { icon: '🚢', title: 'Envio Nacional', desc: 'Despacho a todo Chile y Latinoamerica' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{f.title}</p>
                  <p className="text-xs text-slate-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact + CTA */}
        <div className="space-y-5">
          <Card>
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
              Contacto Deckeva
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372" /></svg>
                <span className="text-amber-700 text-sm">Telefono disponible para clientes con plan de busqueda</span>
              </div>
              <a href="mailto:contacto@deckeva.cl" className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                <svg className="w-4 h-4 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093L2.25 6.75" /></svg>
                <span className="text-slate-700 text-sm">contacto@deckeva.cl</span>
              </a>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <svg className="w-4 h-4 text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                <span className="text-slate-700 text-sm">Lo Barnechea, Santiago, Chile</span>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold">Consulta el Precio</h3>
                <p className="text-cyan-200 text-xs mt-0.5">Visita la web de Deckeva para conocer el precio exacto segun el tamano de tu lancha</p>
              </div>
            </div>
            <a href="https://www.deckeva.cl" target="_blank" rel="noreferrer">
              <Button variant="secondary" className="w-full !bg-white !text-cyan-700 hover:!bg-cyan-50 font-semibold">
                Ir a Deckeva.cl
              </Button>
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
