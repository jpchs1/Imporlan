import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { login, verify2FA, googleAuth, forgotPassword } from '../api';
import { Button, IconButton, Input, Callout, Skeleton } from '../../shared/components/UI';
import { ImporlanMark, Eye, EyeOff, Mail, WhatsAppIcon } from '../../shared/components/Icons';
import { whatsappUrl, WHATSAPP_IMPORLAN } from './inicio/whatsapp';

const GOOGLE_CLIENT_ID = '143983416032-4tmdrcn2f2j3tdg0ni5k834729f25og6.apps.googleusercontent.com';
const GOOGLE_SDK_SRC = 'https://accounts.google.com/gsi/client';

/**
 * «SDK listo» vive fuera del componente: una sola promesa para toda la
 * sesión de la pestaña. Si el componente se desmonta mientras el script
 * carga (el cliente navega y vuelve), el siguiente montaje se cuelga de la
 * misma promesa en vez de perderse el `onload` que ya pasó. Si el script ya
 * estaba en la página (otro montaje lo puso), se escucha su `load`/`error`
 * con `addEventListener`, sin pisar manejadores.
 */
let sdkGoogle = null;
function cargarSdkGoogle() {
  if (sdkGoogle) return sdkGoogle;
  sdkGoogle = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(window.google.accounts.id); return; }
    let script = document.querySelector(`script[src^="${GOOGLE_SDK_SRC}"]`);
    const listo = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google Identity no disponible')));
    // Un script que falló no vuelve a disparar `load`: se saca para que el
    // próximo intento cree uno nuevo.
    const fallo = () => { script.remove(); reject(new Error('No se pudo cargar Google Identity')); };
    if (!script) {
      script = document.createElement('script');
      script.src = GOOGLE_SDK_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', listo);
    script.addEventListener('error', fallo);
  });
  // Si falló (sin red, bloqueado), el próximo montaje vuelve a intentarlo.
  sdkGoogle.catch(() => { sdkGoogle = null; });
  return sdkGoogle;
}

/** Pinta el botón de Google dentro del contenedor que esté montado ahora. */
function renderGoogleButton(btnContainer) {
  if (!btnContainer || !window.google?.accounts?.id) return false;
  btnContainer.innerHTML = '';
  window.google.accounts.id.renderButton(btnContainer, {
    theme: 'outline',
    size: 'large',
    width: Math.min(400, Math.max(200, btnContainer.offsetWidth || 320)),
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    locale: 'es',
  });
  return true;
}

/**
 * Ingreso al panel del cliente. Fondo plano, logo real, tarjeta blanca y los
 * campos del kit. Es el patrón que copia el login del admin (WS-A3).
 * `googleAuth` y el 2FA no cambian.
 */
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
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  // 'cargando' | 'listo' | 'no-disponible' (sin red o bloqueado: no se deja un hueco)
  const [google, setGoogle] = useState(() => (window.google?.accounts?.id ? 'listo' : 'cargando'));
  // El contenedor del botón de Google: existe sólo en la vista de ingreso
  // (no en «Recuperar contraseña» ni en el 2FA), así que el ref cambia.
  const googleBtnRef = useRef(null);

  // Antes esta pantalla solo mostraba el correo y el WhatsApp de Imporlan:
  // quien olvidaba la clave quedaba fuera hasta que una persona lo atendiera.
  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSent('');
    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotSent(res.message || 'Si ese correo tiene una cuenta, te enviamos el enlace.');
    } catch (err) {
      setForgotError(err.message || 'No pudimos procesar la solicitud.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Al abrir el formulario se arrastra el correo que ya venía escrito arriba,
  // para no hacerlo teclear dos veces.
  const abrirForgot = () => {
    setForgotEmail(email);
    setForgotSent('');
    setForgotError('');
    setShowForgot(true);
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

  // Google Sign-In
  const handleGoogleResponse = useCallback(async (response) => {
    setError('');
    setLoading(true);
    try {
      const res = await googleAuth(response.credential);
      if (res.user && res.access_token) {
        loginUser(res.user, res.access_token);
        navigate(destination, { replace: true });
      } else {
        setError('No pudimos autenticar con Google.');
      }
    } catch (err) {
      setError(err.message || 'No pudimos iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  }, [loginUser, navigate, destination]);

  // 1. SDK listo. Se inicializa con el callback de ESTE montaje (si cambia el
  //    destino, `initialize` se vuelve a llamar con el nuevo). `activo` evita
  //    tocar el estado de un componente ya desmontado.
  useEffect(() => {
    let activo = true;
    cargarSdkGoogle()
      .then(id => {
        if (!activo) return;
        id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
        setGoogle('listo');
      })
      .catch(() => { if (activo) setGoogle('no-disponible'); });
    return () => { activo = false; };
  }, [handleGoogleResponse]);

  // 2. Botón renderizado: cada vez que el contenedor está montado y el SDK
  //    listo (volver de «Recuperar contraseña» o del 2FA incluido). Va
  //    aparte del paso 1 a propósito: si el SDK llega mientras el
  //    contenedor no existe, no hay nada que pintar todavía y se pinta aquí
  //    cuando vuelve.
  const contenedorVisible = !needs2FA && !showForgot;
  useEffect(() => {
    if (!contenedorVisible || google !== 'listo') return;
    renderGoogleButton(googleBtnRef.current);
  }, [contenedorVisible, google]);

  const year = new Date().getFullYear();

  return (
    <div className="min-h-dvh bg-sidebar flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-white mb-3" aria-hidden="true">
            <ImporlanMark size={30} />
          </span>
          <h1 className="text-xl font-semibold text-white tracking-tight leading-7">Imporlan</h1>
          <p className="text-sm text-sidebar-muted">Panel del cliente</p>
        </div>

        <div className="bg-surface rounded-xl shadow-modal p-6 sm:p-8">
          {showForgot ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Recuperar contraseña</h2>
                <p className="text-13 text-ink-500 mt-1">Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</p>
              </div>

              {forgotSent ? (
                <Callout tone="success" title="Revisa tu correo">{forgotSent}</Callout>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4" noValidate>
                  <Input
                    label="Correo"
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="tu@correo.cl"
                    autoComplete="email"
                    required
                    data-autofocus=""
                    autoFocus
                  />
                  {forgotError && <Callout tone="danger" compact>{forgotError}</Callout>}
                  <Button type="submit" block loading={forgotLoading}>Enviarme el enlace</Button>
                </form>
              )}

              {/* El contacto humano se queda abajo: el enlace resuelve el caso
                  normal, pero si la cuenta no existe o está desactivada no hay
                  correo que lo arregle y hay que hablar con alguien. */}
              <div className="rounded-md border border-line bg-canvas px-4 py-3 text-13 space-y-2">
                <p className="text-ink-500">Si no te llega nada, escríbenos:</p>
                <a href="mailto:contacto@imporlan.cl" className="flex items-center gap-2 text-ink-900 font-medium hover:text-brand-700">
                  <Mail size={16} className="text-ink-500" /> contacto@imporlan.cl
                </a>
                <a href={whatsappUrl('Hola, necesito recuperar mi contraseña del panel de Imporlan')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-ink-900 font-medium hover:text-brand-700">
                  <WhatsAppIcon size={16} className="text-ink-500" /> {WHATSAPP_IMPORLAN}
                </a>
              </div>

              <div className="text-center">
                <Button variant="link" size="sm" onClick={() => setShowForgot(false)}>Volver a iniciar sesión</Button>
              </div>
            </div>
          ) : !needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <h2 className="text-base font-semibold text-ink-900">Ingresa a tu panel</h2>
                <p className="text-13 text-ink-500 mt-1">Revisa tus expedientes, pagos y mensajes con tu agente.</p>
              </div>

              <Input
                label="Correo"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.cl"
                autoComplete="email"
                required
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  inputClassName="pr-11"
                  required
                />
                <IconButton
                  icon={showPw ? EyeOff : Eye}
                  size="sm"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPw}
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-0.5 bottom-0.5 text-ink-500"
                />
              </div>

              <div className="flex justify-end -mt-1">
                <Button variant="link" size="sm" onClick={abrirForgot}>¿Olvidaste tu contraseña?</Button>
              </div>

              {error && <Callout tone="danger" compact>{error}</Callout>}

              <Button type="submit" block loading={loading}>Ingresar</Button>

              {google !== 'no-disponible' && (
                <>
                  <div className="flex items-center gap-3 text-xs text-ink-500" aria-hidden="true">
                    <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
                  </div>
                  {/* Alto fijo: el botón de Google llega después y la tarjeta no salta. */}
                  <div className="relative h-10">
                    {google === 'cargando' && <Skeleton className="absolute inset-0 h-10 w-full rounded-md" />}
                    <div ref={googleBtnRef} id="google-btn" className="absolute inset-0 flex items-center justify-center" />
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handle2FA} className="space-y-4" noValidate>
              <div>
                <h2 className="text-base font-semibold text-ink-900">Verificación en dos pasos</h2>
                <p className="text-13 text-ink-500 mt-1">Ingresa el código de 6 dígitos de tu app de autenticación.</p>
              </div>
              <Input
                label="Código"
                value={code2FA}
                onChange={e => setCode2FA(e.target.value)}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                inputClassName="text-center text-xl font-semibold tracking-[0.4em] h-12"
                autoFocus
                required
              />
              {error && <Callout tone="danger" compact>{error}</Callout>}
              <Button type="submit" block loading={loading}>Verificar</Button>
              <div className="text-center">
                <Button variant="link" size="sm" onClick={() => { setNeeds2FA(false); setError(''); }}>Volver a iniciar sesión</Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-sidebar-muted mt-6">
          © {year} Imporlan · <a href="https://www.imporlan.cl" className="hover:text-white">imporlan.cl</a>
        </p>
      </div>
    </div>
  );
}
