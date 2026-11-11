const DECIMAL_VALUE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  if (!DECIMAL_VALUE.test(normalizedValue)) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toValidDate(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCurrency(
  amount,
  currencyCode,
  locale,
  fallback = 'Price unavailable',
) {
  const numericAmount = toFiniteNumber(amount);
  const normalizedCurrency = typeof currencyCode === 'string'
    ? currencyCode.trim().toUpperCase()
    : '';

  if (numericAmount === null || !CURRENCY_CODE.test(normalizedCurrency)) {
    return fallback;
  }

  try {
    if (normalizedCurrency === 'VND') {
      return `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numericAmount)} VND`;
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      currencyDisplay: 'code',
    }).format(numericAmount);
  } catch {
    return fallback;
  }
}

export function formatDate(value, locale, fallback = 'Date unavailable') {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
    }).format(date);
  } catch {
    return fallback;
  }
}

export function formatDateTime(value, locale, fallback = 'Time unavailable') {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return fallback;
  }
}

const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

function countOf(value, unit) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

export function formatUpdatedAgo(value, now = Date.now(), fallback = 'Update time unavailable') {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  const elapsed = now - date.getTime();

  if (elapsed < MINUTE_IN_MS) {
    return 'Updated just now';
  }

  if (elapsed < HOUR_IN_MS) {
    return `Updated ${countOf(Math.floor(elapsed / MINUTE_IN_MS), 'minute')} ago`;
  }

  if (elapsed < DAY_IN_MS) {
    return `Updated ${countOf(Math.floor(elapsed / HOUR_IN_MS), 'hour')} ago`;
  }

  return `Updated ${countOf(Math.floor(elapsed / DAY_IN_MS), 'day')} ago`;
}

export function formatCompactNumber(value, locale) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function getFreshnessBadge(freshnessStatus) {
  if (freshnessStatus === 'STALE') {
    return { label: 'Stale data', modifier: 'badge--warning' };
  }

  return {
    label: formatStatusLabel(freshnessStatus),
    modifier: freshnessStatus === 'UNAVAILABLE' ? 'badge--neutral' : '',
  };
}

export function formatStatusLabel(value, fallback = 'Unknown') {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return normalizedValue.replace(/^./, (character) => character.toUpperCase());
}
