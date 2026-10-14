import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { getProfile, updateProfileName, changeProfilePassword, uploadProfilePhoto } from '../api';
import { PageHeader, Card, Button, Input, Avatar, Badge, Spinner } from '../../shared/components/UI';
import { Camera } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';

const ROLE_LABEL = { admin: 'Administrador', support: 'Soporte', agent: 'Agente' };
// Misma regla que el alta de cuentas del equipo (Usuarios › Equipo).
const PW_MIN = 8;

export default function Profile() {
  const { user, loginUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getProfile();
        if (!alive) return;
        const p = r.profile || r;
        setProfile(p);
        setName(p.name || user?.name || '');
      } catch (e) {
        if (alive) toast?.(e.message || 'No se pudo cargar tu cuenta', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  // Solo al montar: el nombre del contexto es el respaldo inicial.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!r || r.success === false || r.error) throw new Error(r?.error || 'Error');
      setProfile(p => ({ ...p, name: name.trim() }));
      syncAuthUser({ name: name.trim() });
      toast?.('Nombre actualizado', 'success');
    } catch (err) {
      toast?.(err.message || 'No se pudo actualizar el nombre', 'error');
    } finally {
      setSavingName(false);
    }
  }

  function validarContrasena() {
    const errs = {};
    if (!currentPw) errs.current = 'Escribe tu contraseña actual.';
    if (!newPw) errs.next = 'Escribe la contraseña nueva.';
    else if (newPw.length < PW_MIN) errs.next = `Debe tener al menos ${PW_MIN} caracteres.`;
    if (!confirmPw) errs.confirm = 'Repite la contraseña nueva.';
    else if (newPw && newPw !== confirmPw) errs.confirm = 'Las contraseñas no coinciden.';
    return errs;
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    const errs = validarContrasena();
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPw(true);
    try {
      const r = await changeProfilePassword(currentPw, newPw, confirmPw);
      if (!r || r.success === false || r.error) throw new Error(r?.error || 'Error');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast?.({ type: 'success', title: 'Contraseña actualizada', description: r.message });
    } catch (err) {
      toast?.({ type: 'error', title: 'No se pudo cambiar la contraseña', description: err.message });
    } finally {
      setSavingPw(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast?.('La imagen no debe pesar más de 5 MB', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const r = await uploadProfilePhoto(file);
      if (!r || r.success === false || r.error) throw new Error(r?.error || 'Error');
      const newUrl = r.avatar_url || r.profile?.avatar_url;
      if (newUrl) {
        setProfile(p => ({ ...p, avatar_url: newUrl }));
        syncAuthUser({ avatar_url: newUrl });
      }
      toast?.('Foto actualizada', 'success');
    } catch (err) {
      toast?.(err.message || 'No se pudo subir la foto', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) return <Spinner />;

  const displayName = profile?.name || user?.name || 'Usuario';
  const role = profile?.role || user?.role;

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu foto, tu nombre y tu contraseña de acceso al panel." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="flex flex-col items-center text-center">
          <Avatar name={displayName} src={profile?.avatar_url} size="xl" className="h-24! w-24! text-2xl!" />
          <p className="mt-4 text-base font-semibold text-ink-900">{displayName}</p>
          <p className="text-13 text-ink-500 mt-0.5 break-all">{profile?.email || user?.email}</p>
          {role && <Badge tone="info" className="mt-2">{ROLE_LABEL[role] || role}</Badge>}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" tabIndex={-1} aria-hidden="true" />
          <Button className="mt-5" variant="secondary" icon={Camera} onClick={() => fileInputRef.current?.click()} loading={uploadingPhoto}>
            Cambiar foto
          </Button>
          <p className="text-xs text-ink-500 mt-2">JPG, PNG o GIF · hasta 5 MB</p>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Card.Header title="Nombre" description="Así te ven el equipo y los clientes en el panel y en el chat." />
            <Card.Body>
              <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row sm:items-end gap-3">
                <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="flex-1" autoComplete="name" />
                <Button type="submit" loading={savingName} disabled={!name.trim() || name.trim() === (profile?.name || '')}>Guardar</Button>
              </form>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header title="Cambiar contraseña" description={`Mínimo ${PW_MIN} caracteres. Al cambiarla se cierran tus otras sesiones.`} />
            <form onSubmit={handleChangePassword} noValidate>
              <Card.Body className="space-y-4">
                <Input
                  type="password"
                  label="Contraseña actual"
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwErrors(p => ({ ...p, current: undefined })); }}
                  autoComplete="current-password"
                  error={pwErrors.current}
                  required
                />
                <Input
                  type="password"
                  label="Contraseña nueva"
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setPwErrors(p => ({ ...p, next: undefined })); }}
                  autoComplete="new-password"
                  hint={`Al menos ${PW_MIN} caracteres`}
                  error={pwErrors.next}
                  required
                />
                <Input
                  type="password"
                  label="Repite la contraseña nueva"
                  value={confirmPw}
                  onChange={e => { setConfirmPw(e.target.value); setPwErrors(p => ({ ...p, confirm: undefined })); }}
                  autoComplete="new-password"
                  error={pwErrors.confirm}
                  required
                />
              </Card.Body>
              <Card.Footer>
                <Button type="submit" loading={savingPw}>Cambiar contraseña</Button>
              </Card.Footer>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
