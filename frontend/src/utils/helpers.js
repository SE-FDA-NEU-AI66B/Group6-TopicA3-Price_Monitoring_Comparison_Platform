export function getProductIdFromPathname(pathname) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'products' || !segments[1] || segments[1] === 'add') {
    return null;
  }

  try {
    return decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
}

export function setTextContent(selector, value, root = document) {
  root.querySelectorAll(selector).forEach((element) => {
    element.textContent = value;
  });
}

export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}
