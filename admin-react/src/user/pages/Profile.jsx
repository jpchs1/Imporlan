import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, updateProfile, uploadAvatar, forgotPassword } from '../api';
import { fmtDateLarga, fmtRelativo } from '../../shared/lib/format';
import { useAuth } from '../../shared/context/AuthContext';
import { Card, Button, Modal, Input, PageHeader, Avatar, Badge, DescriptionList, Callout, Skeleton, useConfirm } from '../../shared/components/UI';
import { Pencil, Camera, KeyRound, LogOut, WhatsAppIcon, Mail } from '../../shared/components/Icons';
import { useToast } from '../../shared/components/Toast';
import { BotonEnlace } from './inicio/BotonEnlace';
import { whatsappUrl, WA_AYUDA } from './inicio/whatsapp';

const IDIOMAS = { es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés' };

export default function Profile() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user, logout, loginUser } = useAuth();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clave, setClave] = useState({ enviando: false, enviado: '' });

  useEffect(() => {
    let activo = true;
    getMe()
      .then(d => { if (activo) setProfile(d); })
      .catch(() => { if (activo) setProfile(null); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, []);

  const data = profile || user || {};
  const name = data.name || data.email || 'Usuario';
  const conClave = !data.provider || data.provider === 'email';

  function startEdit() {
    setEditName(data.name || '');
    setEditPhone(data.phone || '');
    setErrorNombre('');
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) { setErrorNombre('Escribe tu nombre.'); return; }
    setSaving(true);
    try {
      const res = await updateProfile({ name: editName.trim(), phone: editPhone.trim() });
      if (res.success) {
        toast?.('Datos guardados', 'success');
        setProfile(prev => ({ ...prev, name: editName.trim(), phone: editPhone.trim() }));
        const updatedUser = { ...user, name: editName.trim() };
        const token = localStorage.getItem('imporlan_token');
        if (token) loginUser(updatedUser, token);
        setEditing(false);
      } else {
        toast?.({ type: 'error', title: 'No pudimos guardar', description: res.error || 'Vuelve a intentarlo.' });
      }
    } catch (e) { toast?.({ type: 'error', title: 'No pudimos guardar', description: e.message || 'Revisa tu conexión.' }); }
    setSaving(false);
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast?.({ type: 'error', title: 'Imagen demasiado grande', description: 'El máximo es 5 MB.' }); return; }
    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      if (res.success && res.avatar_url) {
        toast?.('Foto actualizada', 'success');
        setProfile(prev => ({ ...prev, avatar_url: res.avatar_url }));
      } else {
        toast?.({ type: 'error', title: 'No pudimos subir la foto', description: res.error || 'Vuelve a intentarlo.' });
      }
    } catch (err) { toast?.({ type: 'error', title: 'No pudimos subir la foto', description: err.message || 'Vuelve a intentarlo.' }); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Mismo flujo que "¿Olvidaste tu contraseña?" del login: el enlace llega al
  // correo de la cuenta. No hay cambio de contraseña dentro del panel.
  async function enviarEnlaceClave() {
    if (!data.email || clave.enviando) return;
    setClave({ enviando: true, enviado: '' });
    try {
      const res = await forgotPassword(data.email);
      setClave({ enviando: false, enviado: res?.message || `Te enviamos un enlace a ${data.email} para cambiarla.` });
    } catch (e) {
      setClave({ enviando: false, enviado: '' });
      toast?.({ type: 'error', title: 'No pudimos enviar el enlace', description: e.message || 'Vuelve a intentarlo en unos minutos.' });
    }
  }

  async function cerrarSesion() {
    const ok = await confirm({ title: '¿Cerrar sesión?', description: 'Tendrás que volver a ingresar tu correo y contraseña en este dispositivo.', confirmLabel: 'Cerrar sesión' });
    if (!ok) return;
    logout();
    navigate('/login');
  }

  return (
    <div className="pb-4">
      <PageHeader
        title="Mi cuenta"
        description="Tus datos, cómo ingresas y tu sesión."
        actions={<Button variant="secondary" icon={Pencil} onClick={startEdit}>Editar perfil</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Header title="Datos personales" />
            <Card.Body>
              {loading && !profile ? (
                <Skeleton.Text lines={4} />
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar name={name} src={data.avatar_url} size="xl" />
                    <div>
                      <Button variant="secondary" size="sm" icon={Camera} loading={uploading} onClick={() => fileRef.current?.click()}>Cambiar foto</Button>
                      <p className="text-xs text-ink-500 mt-1.5">JPG, PNG o WebP de hasta 5 MB.</p>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir foto de perfil" onChange={handleAvatarUpload} tabIndex={-1} />
                    </div>
                  </div>
                  <DescriptionList cols={2} items={[
                    { label: 'Nombre', value: data.name || '—' },
                    { label: 'Correo', value: data.email || '—' },
                    { label: 'Teléfono', value: data.phone || <Button variant="link" size="sm" onClick={startEdit}>Agregar teléfono</Button> },
                    { label: 'Tipo de cuenta', value: data.role === 'user' || !data.role ? 'Cliente' : data.role },
                  ]} />
                  <p className="text-13 text-ink-500 mt-5">
                    El correo no se puede cambiar desde aquí. Si lo necesitas,{' '}
                    <a href={whatsappUrl('Hola, quiero cambiar el correo de mi cuenta de Imporlan')} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:text-brand-700">escríbenos</a>.
                  </p>
                </>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header title="Acceso y seguridad" />
            <Card.Body className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-md bg-neutral-bg text-ink-700 flex items-center justify-center shrink-0" aria-hidden="true"><Mail size={18} /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">Cómo ingresas</p>
                  <p className="text-13 text-ink-500">{conClave ? 'Con tu correo y contraseña.' : data.provider === 'google' ? 'Con tu cuenta de Google.' : `Con tu cuenta de ${data.provider}.`}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <span className="h-9 w-9 rounded-md bg-neutral-bg text-ink-700 flex items-center justify-center shrink-0" aria-hidden="true"><KeyRound size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">Contraseña</p>
                  {conClave ? (
                    <>
                      <p className="text-13 text-ink-500">Te enviamos un enlace a tu correo para crear una nueva; vale por un tiempo limitado.</p>
                      {clave.enviado ? (
                        <Callout tone="success" compact className="mt-3">{clave.enviado}</Callout>
                      ) : (
                        <Button variant="secondary" size="sm" className="mt-3" loading={clave.enviando} onClick={enviarEnlaceClave}>Cambiar contraseña</Button>
                      )}
                    </>
                  ) : (
                    <p className="text-13 text-ink-500">La administra {data.provider === 'google' ? 'Google' : data.provider}; cámbiala desde esa cuenta.</p>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <Card.Header title="Tu cuenta" />
            <Card.Body>
              <DescriptionList cols={1} dense items={[
                { label: 'Estado', value: <Badge tone={!data.status || data.status === 'active' ? 'success' : 'warning'} dot>{!data.status || data.status === 'active' ? 'Activa' : 'Inactiva'}</Badge> },
                { label: 'Miembro desde', value: data.created_at ? fmtDateLarga(data.created_at) : '—' },
                { label: 'Último acceso', value: data.last_login ? <time dateTime={data.last_login} title={fmtDateLarga(data.last_login, { hora: true })}>{fmtRelativo(data.last_login)}</time> : '—' },
                { label: 'Idioma', value: IDIOMAS[data.locale] || 'Español' },
              ]} />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header title="Sesión" />
            <Card.Body>
              <p className="text-13 text-ink-500 mb-4">Cierra tu sesión en este dispositivo. Tus expedientes y datos quedan guardados.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={LogOut} onClick={cerrarSesion}>Cerrar sesión</Button>
                <BotonEnlace href={WA_AYUDA} variant="ghost" icon={WhatsAppIcon}>Ayuda con mi cuenta</BotonEnlace>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar perfil"
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Guardar</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Input label="Nombre" value={editName} onChange={e => { setEditName(e.target.value); setErrorNombre(''); }} placeholder="Tu nombre completo" autoComplete="name" required error={errorNombre} data-autofocus="" />
          <Input label="Teléfono" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+56 9 1234 5678" autoComplete="tel" hint="Con código de país. Lo usamos para WhatsApp." />
        </div>
      </Modal>
    </div>
  );
}
