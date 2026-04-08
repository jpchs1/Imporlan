import { useState, useEffect } from 'react';
import { getMe } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Badge } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

export default function Profile() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe();
        setProfile(data);
      } catch {
        // Fallback to localStorage data
        setProfile(null);
      }
      setLoading(false);
    }
    load();
  }, []);

  const data = profile || user || {};
  const name = data.name || data.email || 'Usuario';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  function handleLogout() {
    if (confirm('Cerrar sesion?')) {
      logout();
      window.location.hash = '#/login';
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-slate-400 mt-1">Informacion de tu cuenta</p>
      </div>

      {/* Avatar + Name header */}
      <Card className="mb-5">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-400 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">{name}</h2>
            <p className="text-sm text-slate-400 truncate">{data.email || ''}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-emerald-100 text-emerald-700">
                {data.status || 'active'}
              </Badge>
              {data.provider && data.provider !== 'email' && (
                <Badge className="bg-indigo-100 text-indigo-700 capitalize">
                  {data.provider}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Account info */}
      <Card className="mb-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          Datos de la Cuenta
        </h3>
        <div className="space-y-4">
          <InfoRow label="Nombre" value={data.name || '-'} />
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-400">Email</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 font-medium">{data.email || '-'}</span>
              {data.email && (
                <button onClick={() => { navigator.clipboard.writeText(data.email); }} className="text-slate-400 hover:text-cyan-600 transition" title="Copiar email">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}
            </div>
          </div>
          <InfoRow label="Rol" value="Cliente" />
          {data.locale && <InfoRow label="Idioma" value={data.locale === 'es' ? 'Espanol' : data.locale} />}
          {data.last_login && <InfoRow label="Ultimo acceso" value={fmtDate(data.last_login)} />}
          {data.created_at && <InfoRow label="Miembro desde" value={fmtDate(data.created_at)} />}
        </div>
      </Card>

      {/* Info notice */}
      <Card className="mb-5 bg-blue-50/50 border-blue-200">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <p className="text-sm text-blue-800 font-medium">Necesitas actualizar tus datos?</p>
            <p className="text-xs text-blue-600 mt-1">
              Para modificar tu nombre, email o contrasena, contacta al equipo Imporlan
              a traves de la seccion de <a href="#/messages" className="underline font-medium">Mensajes</a> o
              escribe a <span className="font-medium">contacto@imporlan.cl</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Session */}
      <Card>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Sesion
        </h3>
        <p className="text-sm text-slate-500 mb-4">Cierra tu sesion en este dispositivo.</p>
        <Button variant="danger" size="sm" onClick={handleLogout} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar Sesion
        </Button>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value}</span>
    </div>
  );
}
