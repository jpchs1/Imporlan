import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, verify2FA } from '../lib/api';
import { Button, Input } from '../components/UI';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">I</div>
          <h1 className="text-2xl font-bold text-slate-800">Imporlan Admin</h1>
        </div>

        {!needs2FA ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@imporlan.cl" required />
            <div className="relative">
              <Input label="Contrasena" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-8 text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={showPw ? 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
                </svg>
              </button>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</Button>
          </form>
        ) : (
          <form onSubmit={handle2FA} className="space-y-4">
            <p className="text-sm text-slate-600 text-center">Ingresa el codigo de verificacion de tu app de autenticacion</p>
            <Input label="Codigo 2FA" value={code2FA} onChange={e => setCode2FA(e.target.value)} placeholder="123456" maxLength={6} autoFocus required />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Verificando...' : 'Verificar'}</Button>
            <button type="button" onClick={() => { setNeeds2FA(false); setError(''); }} className="w-full text-sm text-slate-500 hover:text-slate-700">Volver</button>
          </form>
        )}
      </div>
    </div>
  );
}
