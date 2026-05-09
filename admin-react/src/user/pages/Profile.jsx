import { useState, useEffect, useRef, useMemo } from 'react';
import { getMe, updateProfile, uploadAvatar } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Modal, Input } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function relativeTime(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < 60_000) return 'hace unos segundos';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} hr${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} dia${d > 1 ? 's' : ''}`;
  if (d < 30) return `hace ${Math.floor(d / 7)} semana${Math.floor(d / 7) > 1 ? 's' : ''}`;
  if (d < 365) return `hace ${Math.floor(d / 30)} mes${Math.floor(d / 30) > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(d / 365)} ano${Math.floor(d / 365) > 1 ? 's' : ''}`;
}

function fmtFullDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return fmtDate(ts); }
}

function localeLabel(loc) {
  const map = { es: 'Espanol', en: 'English', pt: 'Portugues', fr: 'Francais' };
  return map[loc] || loc || 'Espanol';
}

function localeFlag(loc) {
  if (loc === 'en') return '🇺🇸';
  if (loc === 'pt') return '🇧🇷';
  if (loc === 'fr') return '🇫🇷';
  return '🇨🇱';
}

function StatusBadge({ status }) {
  const isActive = !status || status === 'active';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
      isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
      {isActive ? 'Cuenta activa' : (status || 'inactiva')}
    </span>
  );
}

function ProviderBadge({ provider }) {
  if (!provider || provider === 'email') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        Email y contrasena
      </span>
    );
  }
  if (provider === 'google') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-slate-700 text-[11px] font-medium ring-1 ring-slate-200">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/>
        </svg>
        Cuenta de Google
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium capitalize">
      {provider}
    </span>
  );
}

function StatTile({ label, value, sub, icon, color = 'cyan' }) {
  const colors = {
    cyan: 'from-cyan-500/10 to-blue-500/10 text-cyan-600',
    emerald: 'from-emerald-500/10 to-teal-500/10 text-emerald-600',
    violet: 'from-violet-500/10 to-purple-500/10 text-violet-600',
    amber: 'from-amber-500/10 to-orange-500/10 text-amber-600',
  };
  return (
    <div className="bg-white border border-slate-200/70 rounded-2xl p-4 flex items-center gap-3 hover:shadow-sm transition">
      <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0', colors[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function InfoField({ icon, label, value, action, valueClass }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={cn('text-sm text-slate-800 font-medium truncate', valueClass)}>{value || <span className="text-slate-300 italic">No disponible</span>}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, accent = 'cyan' }) {
  const ring = {
    cyan: 'bg-cyan-50 text-cyan-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', ring[accent])}>{icon}</div>
      <div className="min-w-0">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Profile() {
  const toast = useToast();
  const { user, logout, loginUser } = useAuth();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe();
        setProfile(data);
      } catch { setProfile(null); }
      setLoading(false);
    }
    load();
  }, []);

  const data = profile || user || {};
  const name = data.name || data.email || 'Usuario';
  const initials = useMemo(() => name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(), [name]);

  const memberSinceLabel = data.created_at ? fmtFullDate(data.created_at) : null;
  const memberSinceRel = data.created_at ? relativeTime(data.created_at) : null;
  const lastLoginLabel = data.last_login ? fmtFullDate(data.last_login) : null;
  const lastLoginRel = data.last_login ? relativeTime(data.last_login) : null;
  const hasPasswordAuth = !data.provider || data.provider === 'email';

  function handleLogout() {
    logout();
    window.location.hash = '#/login';
  }

  function startEdit() {
    setEditName(data.name || '');
    setEditPhone(data.phone || '');
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) { toast?.('El nombre es requerido', 'error'); return; }
    setSaving(true);
    try {
      const res = await updateProfile({ name: editName.trim(), phone: editPhone.trim() });
      if (res.success) {
        toast?.('Perfil actualizado', 'success');
        setProfile(prev => ({ ...prev, name: editName.trim(), phone: editPhone.trim() }));
        const updatedUser = { ...user, name: editName.trim() };
        const token = localStorage.getItem('imporlan_token');
        if (token) loginUser(updatedUser, token);
        setEditing(false);
      } else {
        toast?.(res.error || 'Error al actualizar', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error de conexion', 'error'); }
    setSaving(false);
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast?.('Imagen demasiado grande (max 5MB)', 'error'); return; }
    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      if (res.success && res.avatar_url) {
        toast?.('Foto actualizada', 'success');
        setProfile(prev => ({ ...prev, avatar_url: res.avatar_url }));
      } else {
        toast?.(res.error || 'Error al subir foto', 'error');
      }
    } catch (e) { toast?.(e.message || 'Error al subir foto', 'error'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function copy(text, label = 'Copiado') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast?.(label, 'success')).catch(() => {});
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Hero card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white p-6 sm:p-8 overflow-hidden mb-6 shadow-xl">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-br from-cyan-400 via-teal-400 to-indigo-400 rounded-3xl blur opacity-60 group-hover:opacity-90 transition" />
            <div className="relative">
              {data.avatar_url ? (
                <img src={data.avatar_url} alt={name} className="w-24 h-24 rounded-3xl object-cover border-2 border-white/20" />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold border-2 border-white/20">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-3xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                aria-label="Cambiar foto"
              >
                {uploading ? (
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <span className="text-[11px] font-semibold text-white flex flex-col items-center gap-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                    Cambiar
                  </span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{name}</h2>
            <button onClick={() => copy(data.email, 'Email copiado')} className="mt-1 text-sm text-slate-300 hover:text-white inline-flex items-center gap-1.5 group/email">
              {data.email}
              <svg className="w-3.5 h-3.5 opacity-0 group-hover/email:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={data.status} />
              <ProviderBadge provider={data.provider} />
              {data.role && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-medium capitalize">
                  {data.role === 'user' ? 'Cliente' : data.role}
                </span>
              )}
            </div>
          </div>

          <Button onClick={startEdit} className="shrink-0 bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 self-start sm:self-auto">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Editar Perfil
          </Button>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatTile
          label="Miembro desde"
          value={memberSinceRel || '-'}
          sub={memberSinceLabel || ''}
          color="cyan"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
        />
        <StatTile
          label="Ultimo acceso"
          value={lastLoginRel || 'Hoy'}
          sub={lastLoginLabel || ''}
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
        />
        <StatTile
          label="Idioma"
          value={`${localeFlag(data.locale)} ${localeLabel(data.locale)}`}
          sub="Comunicaciones y soporte"
          color="violet"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal info */}
        <Card>
          <SectionHeader
            accent="cyan"
            title="Informacion personal"
            subtitle="Datos basicos de tu cuenta"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
          />
          <div>
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
              label="Nombre"
              value={data.name}
              action={
                <button onClick={startEdit} className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700">Editar</button>
              }
            />
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
              label="Email"
              value={data.email}
              valueClass="font-mono text-[13px]"
              action={
                data.email ? (
                  <button onClick={() => copy(data.email, 'Email copiado')} className="text-slate-400 hover:text-cyan-600 transition p-1" title="Copiar">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                ) : null
              }
            />
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 5a2 2 0 012-2h3l2 5-2.5 1.5a11 11 0 005 5L17 12l5 2v3a2 2 0 01-2 2A17 17 0 013 5z"/></svg>}
              label="Telefono"
              value={data.phone}
              action={
                data.phone ? (
                  <a href={`https://wa.me/${data.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 transition p-1" title="WhatsApp">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                  </a>
                ) : (
                  <button onClick={startEdit} className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700">Agregar</button>
                )
              }
            />
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
              label="Tipo de cuenta"
              value={data.role === 'user' || !data.role ? 'Cliente' : data.role}
            />
          </div>
        </Card>

        {/* Activity / metadata */}
        <Card>
          <SectionHeader
            accent="violet"
            title="Actividad y preferencias"
            subtitle="Historial y configuracion"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
          />
          <div>
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
              label="Miembro desde"
              value={memberSinceLabel || '-'}
              action={memberSinceRel ? <span className="text-[11px] text-slate-400">{memberSinceRel}</span> : null}
            />
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
              label="Ultimo acceso"
              value={lastLoginLabel || '-'}
              action={lastLoginRel ? <span className="text-[11px] text-slate-400">{lastLoginRel}</span> : null}
            />
            <InfoField
              icon={<span className="text-base leading-none">{localeFlag(data.locale)}</span>}
              label="Idioma"
              value={localeLabel(data.locale)}
            />
            <InfoField
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>}
              label="Notificaciones"
              value="Activadas (email)"
              action={<span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>ON</span>}
            />
          </div>
        </Card>

        {/* Security */}
        <Card>
          <SectionHeader
            accent="amber"
            title="Seguridad"
            subtitle="Protege tu cuenta"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Metodo de acceso</p>
                  <p className="text-[11px] text-slate-400 truncate">{hasPasswordAuth ? 'Email y contrasena' : `Inicias con ${data.provider}`}</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 shrink-0">Activo</span>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Contrasena</p>
                  <p className="text-[11px] text-slate-400">{hasPasswordAuth ? 'Cambia tu contrasena cuando quieras' : 'No aplica con login social'}</p>
                </div>
              </div>
              {hasPasswordAuth ? (
                <a
                  href="https://wa.me/56940211459?text=Hola%2C%20quiero%20cambiar%20mi%20contrasena"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 shrink-0"
                >
                  Cambiar
                </a>
              ) : (
                <span className="text-[11px] text-slate-300 shrink-0">N/A</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Verificacion en 2 pasos</p>
                  <p className="text-[11px] text-slate-400">Capa extra de seguridad</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Proximamente</span>
            </div>
          </div>
        </Card>

        {/* Danger zone / Session */}
        <Card>
          <SectionHeader
            accent="rose"
            title="Sesion"
            subtitle="Administra el acceso"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>}
          />
          <p className="text-sm text-slate-500 mb-3">Cierra tu sesion en este dispositivo. Tendras que volver a ingresar tus credenciales.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => setShowLogout(true)} className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              Cerrar sesion
            </Button>
            <a
              href="https://wa.me/56940211459?text=Hola%2C%20necesito%20ayuda%20con%20mi%20cuenta"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Hablar con soporte
            </a>
          </div>
        </Card>
      </div>

      {loading && (
        <p className="text-center text-xs text-slate-400 mt-4">Sincronizando datos...</p>
      )}

      {/* Edit Profile Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar perfil" size="sm">
        <div className="space-y-4">
          <Input label="Nombre *" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Tu nombre completo" />
          <Input label="Telefono" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+56 9 XXXX XXXX" />
          <p className="text-xs text-slate-400">El email no se puede cambiar desde aqui. Si lo necesitas, contacta a soporte.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Logout Modal */}
      <Modal open={showLogout} onClose={() => setShowLogout(false)} title="Cerrar sesion" size="sm">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </div>
          <p className="text-slate-700 font-medium mb-1">Estas seguro?</p>
          <p className="text-sm text-slate-400 mb-6">Se cerrara tu sesion en este dispositivo.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" size="sm" onClick={() => setShowLogout(false)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={handleLogout}>Cerrar sesion</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
