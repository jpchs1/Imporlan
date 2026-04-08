import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { login, verify2FA, googleAuth } from '../api';

const GOOGLE_CLIENT_ID = '143983416032-4tmdrcn2f2j3tdg0ni5k834729f25og6.apps.googleusercontent.com';

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code2FA, setCode2FA] = useState('');
  const [showForgot, setShowForgot] = useState(false);

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
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Credenciales invalidas');
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
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Codigo invalido');
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
        navigate('/dashboard');
      } else {
        setError('Error al autenticar con Google');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesion con Google');
    } finally {
      setLoading(false);
    }
  }, [loginUser, navigate]);

  useEffect(() => {
    // Load Google Identity Services
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      const btnContainer = document.getElementById('google-btn');
      if (btnContainer) {
        window.google?.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'pill',
          locale: 'es',
        });
      }
    };
    document.head.appendChild(script);
  }, [handleGoogleResponse]);

  // Re-render Google button when switching views
  useEffect(() => {
    if (needs2FA || showForgot) return;
    const timer = setTimeout(() => {
      const btnContainer = document.getElementById('google-btn');
      if (btnContainer && window.google?.accounts?.id) {
        btnContainer.innerHTML = '';
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'pill',
          locale: 'es',
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [needs2FA, showForgot]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-400 flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-cyan-500/30 mb-4">
            I
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Imporlan</h1>
          <p className="text-sm text-slate-400 mt-1">Accede a tu panel</p>
        </div>

        {/* Form card */}
        <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/[0.1] p-8 shadow-2xl">
          {showForgot ? (
            /* Forgot password view */
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093L2.25 6.75" /></svg>
                </div>
                <h3 className="text-white font-semibold text-lg">Recuperar Contrasena</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Para restablecer tu contrasena, contacta al equipo Imporlan:
                </p>
              </div>
              <div className="bg-white/[0.06] border border-white/[0.1] rounded-xl p-4 space-y-2">
                <a href="mailto:contacto@imporlan.cl" className="flex items-center gap-3 text-sm text-cyan-300 hover:text-cyan-200 transition">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.093L2.25 6.75" /></svg>
                  contacto@imporlan.cl
                </a>
                <a href="https://wa.me/56940211459?text=Hola%2C%20necesito%20recuperar%20mi%20contrase%C3%B1a" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-emerald-300 hover:text-emerald-200 transition">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.462-1.494A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.818-6.296-2.187a.75.75 0 00-.653-.132l-3.2 1.07 1.07-3.196a.75.75 0 00-.131-.654A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  +56 9 4021 1459
                </a>
              </div>
              <p className="text-[11px] text-slate-500 text-center">Te enviaremos una contrasena temporal por email.</p>
              <button type="button" onClick={() => setShowForgot(false)} className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2">
                Volver al login
              </button>
            </div>
          ) : !needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/50 outline-none transition-all duration-200"
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Contrasena</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/50 outline-none transition-all duration-200 pr-12"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-[34px] text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={showPw ? 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
                  </svg>
                </button>
              </div>

              {/* Forgot password link */}
              <div className="text-right -mt-2">
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  Olvidaste tu contrasena?
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm animate-fade-in">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-600/30 hover:from-cyan-700 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 active:scale-[0.98] text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Ingresando...
                  </span>
                ) : 'Ingresar'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.1]" />
                <span className="text-[11px] text-slate-500 uppercase">o</span>
                <div className="flex-1 h-px bg-white/[0.1]" />
              </div>

              {/* Google Sign-In button */}
              <div id="google-btn" className="flex justify-center" />
            </form>
          ) : (
            <form onSubmit={handle2FA} className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto bg-cyan-500/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-sm text-slate-400">Ingresa el codigo de tu app de autenticacion</p>
              </div>
              <div>
                <input
                  value={code2FA}
                  onChange={e => setCode2FA(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                  className="w-full px-4 py-4 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white text-center text-2xl font-mono tracking-[0.5em] placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400/50 outline-none transition-all duration-200"
                />
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm text-center">{error}</div>}
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-600/30 hover:from-cyan-700 hover:to-cyan-600 transition-all duration-200 disabled:opacity-50 text-sm">
                {loading ? 'Verificando...' : 'Verificar'}
              </button>
              <button type="button" onClick={() => { setNeeds2FA(false); setError(''); }} className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2">
                Volver al login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">Imporlan &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
