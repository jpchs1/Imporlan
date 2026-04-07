import { useAuth } from '../../shared/context/AuthContext';
import { Card } from '../../shared/components/UI';

export default function Dashboard() {
  const { user } = useAuth();
  const name = user?.name || user?.email || 'Usuario';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Bienvenido, {name}
        </h1>
        <p className="text-sm text-slate-400 mt-1">Tu panel de importaciones</p>
      </div>

      {/* Placeholder */}
      <Card className="text-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.657-5.657a8 8 0 1111.314 0l-5.657 5.657z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Panel de Usuario en construccion</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Estamos construyendo tu nuevo panel con una mejor experiencia.
              Pronto tendras acceso a tus expedientes, marketplace, seguimiento y mas.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
