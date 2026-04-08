import { useState, useEffect, useCallback } from 'react';
import { getMyInspections, getInspectionDetail } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { PageHeader, Card, Badge, Button, Modal, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

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

function InspectionCard({ report, onClick }) {
  return (
    <Card className="card-hover cursor-pointer" onClick={() => onClick(report)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-800">{report.vessel_name || report.name || 'Inspeccion'}</p>
          <p className="text-xs text-slate-400">{report.vessel_type} {report.year && `· ${report.year}`}</p>
        </div>
        <Badge className={STATUS_COLORS[report.status] || STATUS_COLORS.pending}>{report.status || 'pending'}</Badge>
      </div>
      {report.overall_rating && (
        <div className="flex items-center gap-2 mb-2">
          <div className="text-lg font-bold text-cyan-600">{report.overall_rating}/10</div>
          <div className="flex-1 h-2 bg-slate-100 rounded-full"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(report.overall_rating / 10) * 100}%` }} /></div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {report.location && <span>{report.location}</span>}
        {report.size && <span>{report.size}</span>}
        <span>{fmtDate(report.sent_at || report.created_at)}</span>
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
  const allPhotos = [...(d.photos_general || []), ...(d.photos_hull || []), ...(d.photos_engine || []), ...(d.photos_interior || [])];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg> Volver
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{d.vessel_name || d.name}</h1>
          <p className="text-sm text-slate-400">{d.vessel_type} {d.year && `· ${d.year}`} {d.location && `· ${d.location}`}</p>
        </div>
        <Badge className={STATUS_COLORS[d.status] || STATUS_COLORS.pending}>{d.status}</Badge>
      </div>

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

      {allPhotos.length > 0 && (
        <Card className="mb-5">
          <h3 className="font-bold text-slate-800 mb-4">Fotos ({allPhotos.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allPhotos.map((url, i) => (
              <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:shadow-md transition" onClick={() => setLightbox(url)}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </Card>
      )}

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
        setReports(data.reports || data.items || []);
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
  }, []);

  if (selected) return <InspectionDetail report={selected} onBack={() => setSelected(null)} />;
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Inspecciones" subtitle={`${reports.length} inspeccion${reports.length !== 1 ? 'es' : ''}`} />
      {reports.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <p className="text-slate-500 font-medium">No tienes inspecciones</p>
          <p className="text-sm text-slate-400 mt-1">Cuando solicites una inspeccion, aparecera aqui.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => <InspectionCard key={r.id} report={r} onClick={setSelected} />)}
        </div>
      )}
    </div>
  );
}
