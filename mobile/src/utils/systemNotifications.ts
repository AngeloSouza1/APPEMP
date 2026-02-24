import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

let initialized = false;
let permissionGranted: boolean | null = null;
let cachedExpoPushToken: string | null = null;

const CHANNEL_ID = 'appemp-pedidos';

export const initSystemNotifications = async () => {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: '#1d4ed8',
    });
  }

  await ensureNotificationPermission();
};

export const ensureNotificationPermission = async () => {
  if (permissionGranted !== null) return permissionGranted;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    permissionGranted = true;
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  permissionGranted = requested.granted;
  return permissionGranted;
};

export const notifyPedidoChange = async (title: string, body: string) => {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: false,
    },
    trigger: null,
  });

  try {
    const current = await Notifications.getBadgeCountAsync();
    await Notifications.setBadgeCountAsync((current || 0) + 1);
  } catch {
    // Alguns launchers Android não suportam badge.
  }
};

export const clearSystemBadge = async () => {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Sem suporte a badge no dispositivo/launcher.
  }
};

export const getExpoPushToken = async (): Promise<string | null> => {
  if (cachedExpoPushToken) return cachedExpoPushToken;

  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResult?.data ? String(tokenResult.data) : null;
    cachedExpoPushToken = token;
    return token;
  } catch {
    return null;
  }
};

export const clearCachedExpoPushToken = () => {
  cachedExpoPushToken = null;
};
