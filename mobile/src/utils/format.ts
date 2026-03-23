const parseDateValue = (value: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    // Preserve the calendar day from ISO strings coming from the API.
    parsed.setFullYear(Number(year), Number(month) - 1, Number(day));
    return parsed;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const formatarData = (value: string) => {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleDateString('pt-BR');
};

export const formatarMoeda = (value: number | string) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
};
