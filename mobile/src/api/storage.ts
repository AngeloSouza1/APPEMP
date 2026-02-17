import AsyncStorage from '@react-native-async-storage/async-storage';
import { UsuarioSession } from '../types/auth';

const TOKEN_KEY = '@appemp/token';
const USER_KEY = '@appemp/user';
const REMEMBER_ME_KEY = '@appemp/remember-me';

export const sessionStorage = {
  async setSession(token: string, user: UsuarioSession) {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ]);
  },

  async setRememberMePreference(value: boolean) {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, value ? '1' : '0');
  },

  async getRememberMePreference() {
    const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    if (value === null) return true;
    return value === '1';
  },

  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async getUser(): Promise<UsuarioSession | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioSession;
    } catch {
      return null;
    }
  },

  async clear() {
    await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]);
  },
};
