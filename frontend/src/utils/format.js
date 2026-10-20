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

export function formatStatusLabel(value, fallback = 'Unknown') {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return normalizedValue.replace(/^./, (character) => character.toUpperCase());
}
