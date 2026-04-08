import { createContext, useContext, useState, useCallback } from 'react';

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

  const isAuth = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, isAuth, loginUser, logout, storageKeys }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
