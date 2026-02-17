import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { authApi } from '../api/services';
import { sessionStorage } from '../api/storage';
import { setUnauthorizedHandler } from '../api/client';
import { UsuarioSession } from '../types/auth';

type AuthContextValue = {
  user: UsuarioSession | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionExpiredHandledRef = useRef(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const rememberMe = await sessionStorage.getRememberMePreference();
        if (!rememberMe) {
          await sessionStorage.clear();
          setToken(null);
          setUser(null);
          return;
        }

        const [storedToken, storedUser] = await Promise.all([
          sessionStorage.getToken(),
          sessionStorage.getUser(),
        ]);
        setToken(storedToken);
        setUser(storedUser);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionExpiredHandledRef.current) return;
      sessionExpiredHandledRef.current = true;
      Alert.alert('Sessão expirada', 'Faça login novamente.');
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (username: string, password: string, rememberMe = true) => {
    const response = await authApi.login(username, password);
    await sessionStorage.setRememberMePreference(rememberMe);
    await sessionStorage.setSession(response.data.token, response.data.user);
    sessionExpiredHandledRef.current = false;
    setToken(response.data.token);
    setUser(response.data.user);
  };

  const logout = async () => {
    await sessionStorage.clear();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
