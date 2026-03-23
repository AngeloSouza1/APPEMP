import Constants from 'expo-constants';

const PROD_API_URL = 'https://appemp.onrender.com';
const DEV_API_URL = 'http://localhost:3000';

const getExpoExtraValue = (key: 'apiUrl' | 'appEnv' | 'cloudinaryCloudName' | 'cloudinaryUploadPreset') => {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || getExpoExtraValue('apiUrl');

export const API_URL =
  envApiUrl && envApiUrl.length > 0 ? envApiUrl : __DEV__ ? DEV_API_URL : PROD_API_URL;

export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV?.trim() || getExpoExtraValue('appEnv') || 'Produção';

export const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || getExpoExtraValue('cloudinaryCloudName');

export const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || getExpoExtraValue('cloudinaryUploadPreset');
