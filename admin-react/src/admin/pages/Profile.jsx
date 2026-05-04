import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { getProfile, updateProfileName, changeProfilePassword, uploadProfilePhoto } from '../api';
import { PageHeader, Card, Button, Input, Spinner } from '../../shared/components/UI';
import { useToast } from '../../shared/components/Toast';

function initialOf(s) {
  return ((s || 'A')[0] || 'A').toUpperCase();
}

export default function Profile() {
  const { user, loginUser } = useAuth();
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await getProfile();
      const p = r.profile || r;
      setProfile(p);
      setName(p.name || user?.name || '');
    } catch (e) {
      showToast(e.message || 'No se pudo cargar el perfil', 'error');
    } finally {
      setLoading(false);
    }
  }

  function syncAuthUser(updates) {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    const merged = { ...stored, ...updates };
    const token = localStorage.getItem('token');
    if (token) loginUser(merged, token);
  }

  async function handleSaveName(e) {
    e.preventDefault();
    if (!name.trim() || savingName) return;
    setSavingName(true);
    try {
      const r = await updateProfileName(name.trim());
      if (r.success === false) throw new Error(r.error || 'Error');
      setProfile(p => ({ ...p, name: name.trim() }));
      syncAuthUser({ name: name.trim() });
      showToast('Nombre actualizado', 'success');
    } catch (err) {
      showToast(err.message || 'Error al actualizar el nombre', 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ type: 'error', text: 'Completa todos los campos.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Las contrasenas no coinciden.' });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'La contrasena debe tener al menos 6 caracteres.' });
      return;
    }
    setSavingPw(true);
    try {
      const r = await changeProfilePassword(currentPw, newPw, confirmPw);
      if (r.success === false) throw new Error(r.error || 'Error');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg({ type: 'success', text: r.message || 'Contrasena actualizada.' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Error al cambiar la contrasena.' });
    } finally {
      setSavingPw(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen no debe pesar mas de 5 MB', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const r = await uploadProfilePhoto(file);
      if (r.success === false) throw new Error(r.error || 'Error');
      const newUrl = r.avatar_url || r.profile?.avatar_url;
      if (newUrl) {
        setProfile(p => ({ ...p, avatar_url: newUrl }));
        syncAuthUser({ avatar_url: newUrl });
      }
      showToast('Foto actualizada', 'success');
    } catch (err) {
      showToast(err.message || 'Error al subir la foto', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Actualiza tu foto, nombre y contrasena" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 flex flex-col items-center text-center">
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              initialOf(profile?.name || user?.name)
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-base font-semibold text-slate-800">{profile?.name || user?.name || 'Usuario'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email || user?.email}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{profile?.role || user?.role}</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          <Button className="mt-5" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
            {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}
          </Button>
          <p className="text-[10px] text-slate-400 mt-2">JPG, PNG o GIF. Maximo 5 MB.</p>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Nombre</h3>
            <form onSubmit={handleSaveName} className="flex gap-2 items-end">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="flex-1" />
              <Button type="submit" disabled={savingName || !name.trim() || name === profile?.name}>
                {savingName ? 'Guardando...' : 'Guardar'}
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Cambiar contrasena</h3>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                type="password"
                label="Contrasena actual"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                type="password"
                label="Nueva contrasena"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimo 6 caracteres"
              />
              <Input
                type="password"
                label="Confirmar nueva contrasena"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
              {pwMsg && (
                <div className={
                  'p-3 rounded-xl text-sm ' +
                  (pwMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-600')
                }>
                  {pwMsg.text}
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPw}>
                  {savingPw ? 'Guardando...' : 'Cambiar contrasena'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
