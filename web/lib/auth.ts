const TOKEN_KEY = 'appemp_token';
const USER_KEY = 'appemp_user';

export interface AuthUser {
  id: number;
  nome: string;
  username: string;
  perfil: 'admin' | 'backoffice' | 'vendedor' | 'motorista';
  imagem_url?: string | null;
}

export const auth = {
  getToken: () => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setSession: (token: string, user: AuthUser) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setToken: (token: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  getUser: (): AuthUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  clearToken: () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
  isAuthenticated: () => Boolean(auth.getToken()),
};
