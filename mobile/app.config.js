const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const expo = appJson.expo || {};
const extra = expo.extra || {};

module.exports = () => ({
  ...expo,
  extra: {
    ...extra,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV || extra.appEnv || 'Produção',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || '',
    cloudinaryCloudName:
      process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || extra.cloudinaryCloudName || '',
    cloudinaryUploadPreset:
      process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || extra.cloudinaryUploadPreset || '',
  },
});
