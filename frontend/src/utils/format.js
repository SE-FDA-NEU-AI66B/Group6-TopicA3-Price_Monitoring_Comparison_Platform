const DECIMAL_AMOUNT = /^\d+(?:\.(\d+))?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const NO_FRACTION_CURRENCIES = new Set(['VND']);

function groupThousands(integerDigits) {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoney(amount, currencyCode) {
  if (
    typeof amount !== 'string'
    || typeof currencyCode !== 'string'
    || !CURRENCY_CODE.test(currencyCode)
  ) {
    return 'Price unavailable';
  }

  const match = amount.match(DECIMAL_AMOUNT);

  if (!match) {
    return 'Price unavailable';
  }

  const [integerDigits, fractionalDigits = ''] = amount.split('.');
  const groupedInteger = groupThousands(integerDigits);

  if (NO_FRACTION_CURRENCIES.has(currencyCode)) {
    return `${groupedInteger} ${currencyCode}`;
  }

  const twoFractionDigits = fractionalDigits.padEnd(2, '0').slice(0, 2);
  return `${groupedInteger}.${twoFractionDigits} ${currencyCode}`;
}

export function formatObservationTime(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Update time unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Update time unavailable';
  }

  try {
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);

    return `Updated ${formatted}`;
  } catch {
    return 'Update time unavailable';
  }
}

export function formatStatusLabel(value, fallback = 'Unknown') {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  return value
    .trim()
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase());
}
