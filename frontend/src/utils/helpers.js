const DEFAULT_SIGNED_IN_PATH = '/watchlist';
const SAME_SITE_BASE = 'https://pricelens.invalid';
const TARGET_PRICE = /^\d+(?:\.\d{1,2})?$/;

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

export function getSafeNextPath(search) {
  const next = new URLSearchParams(search).get('next');

  if (!next?.startsWith('/')) {
    return DEFAULT_SIGNED_IN_PATH;
  }

  const url = new URL(next, SAME_SITE_BASE);

  return url.origin === SAME_SITE_BASE && url.pathname !== '/'
    ? `${url.pathname}${url.search}`
    : DEFAULT_SIGNED_IN_PATH;
}

export function parseTargetPrice(value) {
  const normalized = String(value ?? '').replace(/[\s,]/g, '');
  return TARGET_PRICE.test(normalized) ? normalized : null;
}
