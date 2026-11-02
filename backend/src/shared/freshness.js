export const STALE_AFTER_MILLISECONDS = 24 * 60 * 60 * 1000;

export function freshnessStatus(observedAt, now = Date.now()) {
  if (observedAt == null) {
    return 'UNAVAILABLE';
  }

  return now - new Date(observedAt).getTime() >= STALE_AFTER_MILLISECONDS
    ? 'STALE'
    : 'CURRENT';
}
