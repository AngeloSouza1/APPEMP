import AsyncStorage from '@react-native-async-storage/async-storage';

const RELATORIOS_REFRESH_KEY = '@appemp:relatorios_refresh_at';

export const marcarRelatoriosComoDesatualizados = async () => {
  await AsyncStorage.setItem(RELATORIOS_REFRESH_KEY, String(Date.now()));
};

export const lerTimestampRefreshRelatorios = async () => {
  const value = await AsyncStorage.getItem(RELATORIOS_REFRESH_KEY);
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const limparTimestampRefreshRelatorios = async () => {
  await AsyncStorage.removeItem(RELATORIOS_REFRESH_KEY);
};

