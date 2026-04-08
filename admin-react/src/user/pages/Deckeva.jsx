import { Card, Button } from '../../shared/components/UI';

export default function Deckeva() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Deckeva</h1>
        <p className="text-sm text-slate-400 mt-1">Plataforma de embarcaciones en Chile</p>
      </div>

      <Card className="text-center py-12">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
          <span className="text-white text-2xl font-bold">D</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Deckeva.cl</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Explora el marketplace de embarcaciones en Chile. Encuentra lanchas, veleros, yates y mas.
        </p>
        <a href="https://www.deckeva.cl" target="_blank" rel="noreferrer">
          <Button variant="accent" size="lg" className="flex items-center gap-2 mx-auto">
            Visitar Deckeva
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </Button>
        </a>
      </Card>
    </div>
  );
}
