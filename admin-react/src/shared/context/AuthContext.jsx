import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SESSION_EXPIRED_EVENT } from '../lib/api-client';

const AuthContext = createContext(null);

const DEFAULT_KEYS = { token: 'token', user: 'user' };

export function AuthProvider({ children, storageKeys = DEFAULT_KEYS }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKeys.user)); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem(storageKeys.token));

  const loginUser = useCallback((userData, accessToken) => {
    localStorage.setItem(storageKeys.token, accessToken);
    localStorage.setItem(storageKeys.user, JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  }, [storageKeys]);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKeys.token);
    localStorage.removeItem(storageKeys.user);
    setToken(null);
    setUser(null);
  }, [storageKeys]);

  // Si el token vence, el cliente HTTP borra localStorage y avisa por aqui. Sin
  // esto el estado de React seguia con la sesion vieja: el guard daba por
  // autenticado, /login rebotaba de vuelta al dashboard y la pantalla quedaba
  // colgada en "Error cargando dashboard", sin forma de volver a entrar.
  useEffect(() => {
    const onExpired = (e) => {
      const keys = e?.detail?.storageKeys;
      if (keys && keys.token !== storageKeys.token) return;
      setToken(null);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [storageKeys]);

  const isAuth = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuth, loginUser, logout, storageKeys }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
