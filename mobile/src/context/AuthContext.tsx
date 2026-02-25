import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { authApi, notificacoesApi } from '../api/services';
import { sessionStorage } from '../api/storage';
import { setUnauthorizedHandler } from '../api/client';
import { UsuarioSession } from '../types/auth';
import {
  clearCachedExpoPushToken,
  getExpoPushToken,
  getExpoPushTokenWithoutPrompt,
} from '../utils/systemNotifications';

type AuthContextValue = {
  user: UsuarioSession | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionExpiredHandledRef = useRef(false);
  const pushTokenRegistradoRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!token || !user?.id) return;
    let cancelado = false;

    if (user.perfil === 'motorista') {
      const desativarPushMotorista = async () => {
        try {
          const expoPushToken = await getExpoPushTokenWithoutPrompt();
          if (!expoPushToken || cancelado) return;
          await notificacoesApi.desativarDispositivo(expoPushToken);
        } catch (error) {
          console.error('Falha ao desativar push para motorista:', error);
        } finally {
          pushTokenRegistradoRef.current = null;
        }
      };
      desativarPushMotorista();
      return () => {
        cancelado = true;
      };
    }

    const registrarDispositivoComRetry = async (expoPushToken: string) => {
      const atrasos = [0, 2000, 5000, 10000];
      for (let i = 0; i < atrasos.length; i++) {
        if (cancelado) return false;
        if (atrasos[i] > 0) await wait(atrasos[i]);
        try {
          await notificacoesApi.registrarDispositivo(expoPushToken, Platform.OS);
          return true;
        } catch (error) {
          console.error(`Falha ao registrar push token (tentativa ${i + 1}/${atrasos.length})`, error);
        }
      }
      return false;
    };

    const registrarDispositivo = async () => {
      try {
        const expoPushToken = await getExpoPushToken();
        if (!expoPushToken || cancelado) return;
        const registrado = await registrarDispositivoComRetry(expoPushToken);
        if (!registrado || cancelado) return;
        if (!cancelado) {
          pushTokenRegistradoRef.current = expoPushToken;
        }
      } catch (error) {
        console.error('Erro no fluxo de registro de notificação push:', error);
      }
    };

    registrarDispositivo();
    return () => {
      cancelado = true;
    };
  }, [token, user?.id, user?.perfil]);

  const login = async (username: string, password: string, rememberMe = true) => {
    const response = await authApi.login(username, password);
    await sessionStorage.setRememberMePreference(rememberMe);
    await sessionStorage.setSession(response.data.token, response.data.user);
    try {
      if (rememberMe) {
        await sessionStorage.setBiometricCredentials(username, password);
      } else {
        await sessionStorage.clearBiometricCredentials();
      }
    } catch {
      // Biometria é opcional: falhas aqui não podem impedir o login por senha.
    }
    sessionExpiredHandledRef.current = false;
    setToken(response.data.token);
    setUser(response.data.user);
  };

  const logout = async () => {
    const tokenPush = pushTokenRegistradoRef.current;
    if (tokenPush) {
      try {
        await notificacoesApi.desativarDispositivo(tokenPush);
      } catch {
        // Não bloquear logout por falha de comunicação.
      }
    }
    pushTokenRegistradoRef.current = null;
    clearCachedExpoPushToken();
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
