export function duration(seconds) {
  if (!seconds) return null;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : null);

export const SESSION_LABELS = { NORMALE: 'Session normale', COMPLEMENTAIRE: 'Session complémentaire' };
