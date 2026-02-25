export const isPdfAttachment = (url?: string | null) => {
  if (!url) return false;
  const normalized = String(url).toLowerCase();
  const noQuery = normalized.split('?')[0];
  return noQuery.endsWith('.pdf') || normalized.includes('/raw/upload/');
};
