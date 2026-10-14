import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { login, verify2FA, forgotPassword } from '../api';
import { Button, IconButton, Input, Modal, Callout } from '../../shared/components/UI';
import { ImporlanMark, Eye, EyeOff, KeyRound } from '../../shared/components/Icons';

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // ProtectedRoute deja aquí la ruta que el usuario intentaba abrir.
  const from = location.state?.from;
  const destination = from && from !== '/login' ? from : '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code2FA, setCode2FA] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMsg(null);
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotMsg({ type: 'success', text: res.message || 'Te enviamos un enlace de recuperación al correo del administrador.' });
    } catch (err) {
      setForgotMsg({ type: 'error', text: err.message || 'No se pudo enviar el correo de recuperación.' });
    } finally {
      setForgotLoading(false);
    }
  };

  // El correo de recuperación no se prellena: quien lo pide lo escribe (F9).
  const abrirForgot = () => {
    setForgotEmail('');
    setForgotMsg(null);
    setForgotOpen(true);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.requires_2fa) {
        setNeeds2FA(true);
        setTempToken(res.temp_token);
      } else {
        loginUser(res.user, res.access_token);
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verify2FA(code2FA, tempToken);
      loginUser(res.user, res.access_token);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'El código no es válido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-sidebar flex flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
            <ImporlanMark size={30} />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-white tracking-tight">Imporlan</h1>
          <p className="text-sm text-sidebar-ink mt-0.5">Panel de administración · solo para el equipo</p>
        </div>

        <div className="bg-surface rounded-xl border border-line shadow-modal p-6 sm:p-7">
          {!needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <Input
                label="Correo"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@imporlan.cl"
                required
                data-autofocus
              />
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  inputClassName="pr-10"
                />
                <IconButton
                  icon={showPw ? EyeOff : Eye}
                  size="sm"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPw}
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-0.5 bottom-0.5 text-ink-500"
                />
              </div>

              {error && <Callout tone="danger" compact>{error}</Callout>}

              <Button type="submit" block loading={loading}>Ingresar</Button>

              <div className="text-center pt-1">
                <Button type="button" variant="link" size="sm" onClick={abrirForgot}>¿Olvidaste tu contraseña?</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handle2FA} className="space-y-4" noValidate>
              <div className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden="true">
                  <KeyRound size={20} />
                </span>
                <h2 className="mt-3 text-base font-semibold text-ink-900">Verificación en dos pasos</h2>
                <p className="text-sm text-ink-500 mt-1">Ingresa el código de 6 dígitos de tu app de autenticación.</p>
              </div>
              <Input
                label="Código"
                value={code2FA}
                onChange={e => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                data-autofocus
                size="lg"
                inputClassName="text-center font-mono text-xl tracking-[0.4em]"
              />
              {error && <Callout tone="danger" compact>{error}</Callout>}
              <Button type="submit" block loading={loading}>Verificar</Button>
              <Button type="button" variant="ghost" block onClick={() => { setNeeds2FA(false); setCode2FA(''); setError(''); }}>Volver</Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-sidebar-ink mt-6">Imporlan © {new Date().getFullYear()}</p>
      </main>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        size="sm"
        title="Recuperar contraseña"
        description="Te enviamos un enlace al correo del administrador (contacto@imporlan.cl)."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForgotOpen(false)}>Cancelar</Button>
            <Button type="submit" form="form-recuperar" loading={forgotLoading}>Enviar enlace</Button>
          </>
        )}
      >
        <form id="form-recuperar" onSubmit={handleForgot} className="space-y-4" noValidate>
          <Input
            label="Correo de inicio de sesión"
            type="email"
            autoComplete="username"
            value={forgotEmail}
            onChange={e => setForgotEmail(e.target.value)}
            placeholder="nombre@imporlan.cl"
            required
            data-autofocus
          />
          {forgotMsg && (
            <Callout tone={forgotMsg.type === 'success' ? 'success' : 'danger'} compact>{forgotMsg.text}</Callout>
          )}
        </form>
      </Modal>
    </div>
  );
}
