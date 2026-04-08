import { useState, useEffect, useRef } from 'react';
import { getMe, updateProfile, uploadAvatar } from '../api';
import { fmtDate, cn } from '../../shared/lib/utils';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Badge, Modal, Input } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

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
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
        // Update auth context with new name
        const updatedUser = { ...user, name: editName.trim() };
        const token = localStorage.getItem(user?.storageKeys?.token || 'imporlan_token');
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-slate-400 mt-1">Informacion de tu cuenta</p>
      </div>

      {/* Avatar + Name header */}
      <Card className="mb-5">
        <div className="flex items-center gap-5">
          {/* Avatar with upload */}
          <div className="relative group shrink-0">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt={name} className="w-20 h-20 rounded-2xl object-cover shadow-xl shadow-cyan-500/25" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-400 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-cyan-500/25">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              {uploading ? (
                <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate">{name}</h2>
            <p className="text-sm text-slate-400 truncate">{data.email || ''}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-emerald-100 text-emerald-700">{data.status || 'active'}</Badge>
              {data.provider && data.provider !== 'email' && (
                <Badge className="bg-indigo-100 text-indigo-700 capitalize">{data.provider}</Badge>
              )}
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={startEdit} className="shrink-0 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Editar
          </Button>
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
                <button onClick={() => { navigator.clipboard.writeText(data.email); toast?.('Email copiado', 'success'); }} className="text-slate-400 hover:text-cyan-600 transition" title="Copiar email">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}
            </div>
          </div>
          {data.phone && <InfoRow label="Telefono" value={data.phone} />}
          <InfoRow label="Rol" value="Cliente" />
          {data.locale && <InfoRow label="Idioma" value={data.locale === 'es' ? 'Espanol' : data.locale} />}
          {data.last_login && <InfoRow label="Ultimo acceso" value={fmtDate(data.last_login)} />}
          {data.created_at && <InfoRow label="Miembro desde" value={fmtDate(data.created_at)} />}
        </div>
      </Card>

      {/* Session */}
      <Card>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          Sesion
        </h3>
        <p className="text-sm text-slate-500 mb-4">Cierra tu sesion en este dispositivo.</p>
        <Button variant="danger" size="sm" onClick={() => setShowLogout(true)} className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar Sesion
        </Button>
      </Card>

      {/* Edit Profile Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar Perfil" size="sm">
        <div className="space-y-4">
          <Input label="Nombre *" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Tu nombre completo" />
          <Input label="Telefono" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+56 9 XXXX XXXX" />
          <p className="text-xs text-slate-400">El email no se puede cambiar. Contacta a soporte si necesitas cambiarlo.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button variant="accent" onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Logout Modal */}
      <Modal open={showLogout} onClose={() => setShowLogout(false)} title="Cerrar Sesion" size="sm">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </div>
          <p className="text-slate-700 font-medium mb-1">Estas seguro?</p>
          <p className="text-sm text-slate-400 mb-6">Se cerrara tu sesion en este dispositivo.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" size="sm" onClick={() => setShowLogout(false)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={handleLogout}>Cerrar Sesion</Button>
          </div>
        </div>
      </Modal>
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
