import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const isPdfAttachment = (url?: string | null) => {
  if (!url) return false;
  const normalized = String(url).toLowerCase();
  const noQuery = normalized.split('?')[0];
  return noQuery.endsWith('.pdf') || normalized.includes('/raw/upload/');
};

export const getAttachmentOpenUrl = (url?: string | null) => {
  if (!url) return '';
  const normalized = String(url).trim();
  if (!isPdfAttachment(normalized)) return normalized;

  if (normalized.includes('res.cloudinary.com') && normalized.includes('/image/upload/')) {
    return normalized.replace('/image/upload/', '/raw/upload/');
  }

  return normalized;
};

export const openPdfAttachment = async (url?: string | null, fileLabel = 'nf') => {
  const resolvedUrl = getAttachmentOpenUrl(url);
  if (!resolvedUrl) {
    throw new Error('Arquivo PDF não informado.');
  }

  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheDir) {
    throw new Error('Não foi possível preparar o armazenamento temporário do PDF.');
  }

  const safeLabel = String(fileLabel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nf';
  const localUri = `${cacheDir}${safeLabel}-${Date.now()}.pdf`;

  const result = await FileSystem.downloadAsync(resolvedUrl, localUri);
  if (!result?.uri) {
    throw new Error('Não foi possível baixar o PDF.');
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Nenhum visualizador compatível com PDF está disponível neste aparelho.');
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Abrir PDF da NF',
    UTI: 'com.adobe.pdf',
  });
};
