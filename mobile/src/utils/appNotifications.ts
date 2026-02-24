import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_NOTIFICATIONS_KEY = '@appemp/app-notifications';

export type AppNotification = {
  id: string;
  type: 'pedido_criado' | 'pedido_editado';
  message: string;
  createdAt: string;
};

export const pushAppNotification = async (notification: Omit<AppNotification, 'id' | 'createdAt'>) => {
  const current = await AsyncStorage.getItem(APP_NOTIFICATIONS_KEY);
  const parsed = current ? ((JSON.parse(current) as AppNotification[]) || []) : [];
  const next: AppNotification[] = [
    ...parsed,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...notification,
    },
  ].slice(-30);
  await AsyncStorage.setItem(APP_NOTIFICATIONS_KEY, JSON.stringify(next));
};

export const consumeLatestAppNotification = async (): Promise<AppNotification | null> => {
  const current = await AsyncStorage.getItem(APP_NOTIFICATIONS_KEY);
  if (!current) return null;
  const parsed = ((JSON.parse(current) as AppNotification[]) || []).filter(Boolean);
  if (parsed.length === 0) return null;
  const latest = parsed[parsed.length - 1] || null;
  await AsyncStorage.removeItem(APP_NOTIFICATIONS_KEY);
  return latest;
};
