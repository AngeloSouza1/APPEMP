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
