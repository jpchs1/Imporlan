import { useState, useEffect, useCallback } from 'react';
import { getMyInspections, getInspectionDetail } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Modal, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

const DEMO_INSPECTION = {
  id: 'demo-1',
  _demo: true,
  vessel_name: 'Bayliner VR5 Bowrider 2021',
  name: 'Bayliner VR5 Bowrider 2021',
  brand: 'Bayliner',
  model: 'VR5',
  vessel_year: 2021,
  vessel_type: 'Bowrider',
  location: 'Miami, Florida',
  length_ft: '19.50',
  hull_material: 'Fibra de Vidrio',
  engine_brand: 'Mercury',
  engine_model: 'MerCruiser 4.5L',
  engine_hours: '120',
  num_engines: '1',
  fuel_type: 'Gasolina',
  marina: 'Miami Beach Marina',
  city: 'Miami',
  country: 'USA',
  inspector_name: 'Carlos Rodriguez M.',
  status: 'completed',
  report_type: 'PREMIUM',
  overall_rating: 8.3,
  overall_summary: 'Embarcacion en muy buen estado general. Motor con bajo horaje y buen mantenimiento. Se recomienda revision de tapiceria por desgaste menor.',
  sent_at: '2026-04-07',
  created_at: '2026-04-07',
  listing_url: 'https://www.boattrader.com/boat/2021-bayliner-vr5/',
  recommendations: 'La embarcacion se encuentra en muy buen estado general para su ano. El motor Mercury MerCruiser presenta un funcionamiento optimo con solo 120 horas de uso. Se sugiere:\n\n1. Revisar tapiceria del asiento del copiloto (desgaste menor)\n2. Aplicar cera protectora al gelcoat del casco\n3. Reemplazar anodos de zinc en la proxima temporada\n4. Verificar tension de la correa del alternador\n\nEn general, es una excelente opcion de compra con muy buena relacion precio-calidad.',
  metrics: { hull: 8.5, engine: 9.0, electrical: 8.0, interior: 7.5, trailer: 8.0, navigation: 8.5, safety: 9.0, test_drive: 8.0 },
  photos_hull: [
    'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop',
  ],
  photos_engine: [
    'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=600&h=400&fit=crop',
  ],
  photos_interior: [
    'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=600&h=400&fit=crop&q=80',
  ],
  photos_general: [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=600&h=400&fit=crop&q=80',
    'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=600&h=400&fit=crop&q=80',
  ],
  photos_test_drive: [
    'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=600&h=400&fit=crop&q=90',
  ],
  videos_test_drive: [],
};

const METRICS = ['hull', 'engine', 'electrical', 'interior', 'trailer', 'navigation', 'safety', 'test_drive'];
const METRIC_LABELS = { hull: 'Casco', engine: 'Motor', electrical: 'Electrica', interior: 'Interior', trailer: 'Trailer', navigation: 'Navegacion', safety: 'Seguridad', test_drive: 'Prueba' };
const STATUS_COLORS = { completed: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', draft: 'bg-slate-100 text-slate-600' };

function RadarChart({ metrics, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = METRICS.length;
  const points = METRICS.map((k, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = Math.min((metrics[k] || 0) / 10, 1);
    return { x: cx + r * val * Math.cos(angle), y: cy + r * val * Math.sin(angle), lx: cx + (r + 18) * Math.cos(angle), ly: cy + (r + 18) * Math.sin(angle), label: METRIC_LABELS[k], val: metrics[k] || 0 };
  });
  const poly = points.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} points={METRICS.map((_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`; }).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {METRICS.map((_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#e2e8f0" strokeWidth="1" />; })}
      <polygon points={poly} fill="rgba(6,182,212,0.2)" stroke="#0891b2" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#0891b2" />
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-slate-500 font-medium">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function CountryFlag({ country }) {
  const isUSA = /usa|united states|estados unidos|florida|miami|texas|california/i.test(country || '');
  if (isUSA) return <svg className="w-5 h-3.5 rounded-sm shrink-0" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><g fill="#b22234">{[0,2,4,6,8,10,12].map(i=><rect key={i} y={i*37} width="640" height="37"/>)}</g><rect width="256" height="259" fill="#3c3b6e"/></svg>;
  return <svg className="w-5 h-3.5 rounded-sm shrink-0" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><rect width="640" height="240" y="240" fill="#d52b1e"/><rect width="213" height="240" fill="#0039a6"/><circle cx="107" cy="120" r="48" fill="#fff"/></svg>;
}

function InspectionCard({ report, onClick }) {
  const r = report;
  const vesselName = [r.brand, r.model, r.vessel_year || r.year].filter(Boolean).join(' ') || r.vessel_name || r.name || 'Inspeccion';
  const ratingColor = r.overall_rating >= 7 ? '#10b981' : r.overall_rating >= 5 ? '#f59e0b' : r.overall_rating ? '#ef4444' : '#94a3b8';

  return (
    <Card className="card-hover cursor-pointer border-l-4 p-5" style={{ borderLeftColor: ratingColor }} onClick={() => onClick(report)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-bold text-slate-800 text-base">{vesselName}</h3>
          {/* Location with flag */}
          {r.location && (
            <div className="flex items-center gap-1.5 mt-1">
              <CountryFlag country={r.location} />
              <span className="text-sm text-slate-500">{r.location}</span>
            </div>
          )}
          {/* Specs row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
            {(r.length_ft || r.size) && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>{r.length_ft ? `${r.length_ft} ft` : r.size}</span>}
            {r.hull_material && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>{r.hull_material}</span>}
            {r.inspector_name && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>{r.inspector_name}</span>}
          </div>
          {/* Rating */}
          {r.overall_rating && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: ratingColor }}>{r.overall_rating}</div>
              <span className="text-sm text-slate-500">/ 10</span>
            </div>
          )}
        </div>

        {/* Right side: report type + date */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {r.report_type && <Badge className="bg-violet-100 text-violet-700 text-[10px] uppercase">{r.report_type}</Badge>}
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {fmtDate(r.sent_at || r.created_at)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function InspectionDetail({ report, onBack }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    async function load() {
      if (report._demo) { setDetail(report); setLoading(false); return; }
      try {
        const data = await getInspectionDetail(report.id);
        setDetail(data.report || data);
      } catch { setDetail(report); }
      setLoading(false);
    }
    load();
  }, [report]);

  if (loading) return <Spinner />;
  const d = detail || report;
  const metrics = d.metrics || {};
  const photoSections = [
    { key: 'general', label: 'General', photos: d.photos_general || [] },
    { key: 'hull', label: 'Casco', photos: d.photos_hull || [] },
    { key: 'engine', label: 'Motor', photos: d.photos_engine || [] },
    { key: 'electrical', label: 'Electrica', photos: d.photos_electrical || [] },
    { key: 'interior', label: 'Interior', photos: d.photos_interior || [] },
    { key: 'trailer', label: 'Trailer', photos: d.photos_trailer || [] },
    { key: 'navigation', label: 'Navegacion', photos: d.photos_navigation || [] },
    { key: 'safety', label: 'Seguridad', photos: d.photos_safety || [] },
    { key: 'test_drive', label: 'Prueba', photos: d.photos_test_drive || [] },
  ].filter(s => s.photos.length > 0);
  const allPhotos = photoSections.flatMap(s => s.photos);
  const videos = d.videos_test_drive || [];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg> Volver
      </button>

      {d._demo && (
        <div className="mb-4 px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
          <div>
            <p className="text-sm font-semibold text-violet-800">Reporte de ejemplo (informativo)</p>
            <p className="text-xs text-violet-600">Este es un ejemplo de inspeccion para que conozcas el formato. Los datos son ilustrativos.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{d.vessel_name || d.name}</h1>
          <p className="text-sm text-slate-400">{d.vessel_type} {d.year && `· ${d.year}`} {d.size && `· ${d.size}`} {d.location && `· ${d.location}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[d.status] || STATUS_COLORS.pending}>{d.status}</Badge>
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            PDF
          </button>
        </div>
      </div>

      {/* Overall Rating Card */}
      {d.overall_rating && (
        <Card className="mb-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-5">
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold ${d.overall_rating >= 7 ? 'border-emerald-400 text-emerald-400' : d.overall_rating >= 5 ? 'border-amber-400 text-amber-400' : 'border-red-400 text-red-400'}`}>
              {d.overall_rating}
            </div>
            <div>
              <p className="text-sm text-slate-400">Calificacion General</p>
              <p className="text-xl font-bold">{d.overall_rating} / 10</p>
              {d.overall_summary && <p className="text-xs text-slate-400 mt-1">{d.overall_summary}</p>}
              {d.inspector_name && <p className="text-xs text-slate-500 mt-1">Inspector: {d.inspector_name}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* Vessel Data Card */}
      <Card className="mb-5">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Datos de la Embarcacion
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-sm">
          {d.vessel_type && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Tipo</p><p className="text-slate-700">{d.vessel_type}</p></div>}
          {d.brand && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Marca</p><p className="text-slate-700">{d.brand}</p></div>}
          {d.model && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Modelo</p><p className="text-slate-700">{d.model}</p></div>}
          {(d.year || d.vessel_year) && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Ano</p><p className="text-slate-700">{d.year || d.vessel_year}</p></div>}
          {(d.size || d.length_ft) && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Eslora</p><p className="text-slate-700">{d.size || `${d.length_ft} ft`}</p></div>}
          {d.hull_material && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Material</p><p className="text-slate-700">{d.hull_material}</p></div>}
          {(d.engine_brand || d.engine_model) && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Motor</p><p className="text-slate-700">{[d.engine_brand, d.engine_model].filter(Boolean).join(' ')}</p></div>}
          {d.engine_hours && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Horas Motor</p><p className="text-slate-700">{d.engine_hours}</p></div>}
          {d.num_engines && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Motores</p><p className="text-slate-700">{d.num_engines}</p></div>}
          {d.fuel_type && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Combustible</p><p className="text-slate-700">{d.fuel_type}</p></div>}
          {d.location && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Ubicacion</p><p className="text-slate-700">{d.city ? `${d.city}, ` : ''}{d.location}</p></div>}
          {d.marina && <div><p className="text-[11px] font-semibold text-slate-400 uppercase">Marina</p><p className="text-slate-700">{d.marina}</p></div>}
        </div>
        {d.listing_url && <a href={d.listing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-cyan-600 hover:text-cyan-700 font-medium">Ver listing original <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {Object.keys(metrics).length > 0 && (
          <Card><h3 className="font-bold text-slate-800 mb-4 text-center">Evaluacion General</h3><RadarChart metrics={metrics} /></Card>
        )}
        <Card>
          <h3 className="font-bold text-slate-800 mb-4">Metricas</h3>
          <div className="space-y-2">
            {METRICS.map(k => metrics[k] != null && (
              <div key={k} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20">{METRIC_LABELS[k]}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full"><div className="h-full rounded-full" style={{ width: `${(metrics[k] / 10) * 100}%`, background: metrics[k] >= 7 ? '#10b981' : metrics[k] >= 4 ? '#f59e0b' : '#ef4444' }} /></div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">{metrics[k]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {d.recommendations && <Card className="mb-5"><h3 className="font-bold text-slate-800 mb-2">Recomendaciones</h3><p className="text-sm text-slate-600 whitespace-pre-wrap">{d.recommendations}</p></Card>}

      {photoSections.length > 0 && (
        <Card className="mb-5">
          <h3 className="font-bold text-slate-800 mb-4">Fotos ({allPhotos.length})</h3>
          {photoSections.map(section => (
            <div key={section.key} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{section.label} ({section.photos.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {section.photos.map((url, i) => (
                  <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:shadow-md transition" onClick={() => setLightbox(url)}>
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      {videos.length > 0 && (
        <Card className="mb-5">
          <h3 className="font-bold text-slate-800 mb-4">Videos ({videos.length})</h3>
          <div className="space-y-2">
            {videos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition">
                <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-bold">VID</span></div>
                <span className="text-sm text-slate-700 truncate">Video {i + 1}</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 mb-5">
        Reporte generado el {fmtDate(d.sent_at || d.created_at)} {d.report_type && `· Inspeccion ${d.report_type}`} · Imporlan.cl
      </p>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      )}
    </div>
  );
}

export default function Inspections() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyInspections();
        const real = data.reports || data.items || [];
        setReports(real.length > 0 ? real : [DEMO_INSPECTION]);
      } catch { setReports([DEMO_INSPECTION]); }
      setLoading(false);
    }
    load();
  }, []);

  if (selected) return <InspectionDetail report={selected} onBack={() => setSelected(null)} />;
  if (loading) return <Spinner />;

  return (
    <div>
      {/* Header matching production */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mis Inspecciones</h1>
          <p className="text-sm text-slate-400">Tus reportes de inspeccion tecnica de embarcaciones</p>
        </div>
      </div>

      <div className="mb-6" />

      {reports.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <p className="text-slate-500 font-medium">No tienes inspecciones</p>
          <p className="text-sm text-slate-400 mt-1">Cuando solicites una inspeccion, aparecera aqui.</p>
        </Card>
      ) : (
        <>
          {reports.some(r => r._demo) && (
            <div className="mb-4 px-4 py-3 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
              <div>
                <p className="text-sm font-semibold text-violet-800">Inspeccion de ejemplo (informativo)</p>
                <p className="text-xs text-violet-600">Este reporte es una muestra de como se ve una inspeccion completa. Cuando solicites una inspeccion real, aparecera aqui con los datos de tu embarcacion.</p>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {reports.map(r => <InspectionCard key={r.id} report={r} onClick={setSelected} />)}
          </div>
        </>
      )}

      {/* CTA: Request new inspection */}
      <Card className="mt-6 text-center py-8 border-dashed border-2 border-slate-200">
        <p className="font-bold text-slate-800">Necesitas otra inspeccion?</p>
        <p className="text-sm text-slate-400 mt-1">Solicita una nueva inspeccion pre-compra en:</p>
        <div className="flex justify-center gap-3 mt-4">
          <a href="https://wa.me/56940211459?text=Hola%2C%20necesito%20una%20inspeccion%20en%20Chile" target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition flex items-center gap-2">
            <svg className="w-4 h-3 rounded-sm" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><rect width="640" height="240" y="240" fill="#d52b1e"/><rect width="213" height="240" fill="#0039a6"/><circle cx="107" cy="120" r="48" fill="#fff"/></svg>
            Chile
          </a>
          <a href="https://wa.me/56940211459?text=Hola%2C%20necesito%20una%20inspeccion%20en%20Estados%20Unidos" target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition flex items-center gap-2">
            <svg className="w-4 h-3 rounded-sm" viewBox="0 0 640 480"><rect width="640" height="480" fill="#fff"/><g fill="#b22234">{[0,2,4,6,8,10,12].map(i=><rect key={i} y={i*37} width="640" height="37"/>)}</g><rect width="256" height="259" fill="#3c3b6e"/></svg>
            Estados Unidos
          </a>
        </div>
      </Card>
    </div>
  );
}
