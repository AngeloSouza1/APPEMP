const PROD_API_URL = 'https://appemp.onrender.com';
const DEV_API_URL = 'http://localhost:3000';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_URL =
  envApiUrl && envApiUrl.length > 0 ? envApiUrl : __DEV__ ? DEV_API_URL : PROD_API_URL;
