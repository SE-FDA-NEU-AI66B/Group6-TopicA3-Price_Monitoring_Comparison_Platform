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

export const SELECT_VARIANT_MESSAGE = 'Select 1 product variant to continue';
export const PRODUCT_REMOVED_MESSAGE = 'Product removed from your watchlist';
export const NO_EXPORT_DATA_MESSAGE = 'No data to export';

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function getRemoveConfirmationMessage(item) {
  return item.alert_count > 0
    ? `Deleting this product will also delete ${pluralize(item.alert_count, 'price alert')}`
    : `Remove ${item.product.display_name} — ${item.product.variant.display_name} from your watchlist?`;
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function filterWatchlistItems(items, searchText) {
  const searchTerm = normalizeSearchText(searchText);

  if (searchTerm === '') {
    return items;
  }

  return items.filter((item) => normalizeSearchText(
    `${item.product.display_name} ${item.product.variant.display_name}`,
  ).includes(searchTerm));
}

export function getNoSearchResultsMessage(searchText) {
  return `No products found matching '${String(searchText ?? '').trim()}'`;
}

function niceStep(rawStep) {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const nice = [1, 2, 5].find((candidate) => fraction <= candidate) ?? 10;

  return nice * magnitude;
}

// Round axis values (for example 20M, 22M, 24M) that cover minimum..maximum.
export function getPriceAxisTicks(minimum, maximum, targetCount = 4) {
  if (!(maximum > minimum)) {
    return [minimum];
  }

  const step = niceStep((maximum - minimum) / (targetCount - 1));
  const lowest = Math.floor(minimum / step) * step;
  const highest = Math.ceil(maximum / step) * step;
  const ticks = [];

  for (let value = lowest; value <= highest + step / 2; value += step) {
    ticks.push(Math.round(value));
  }

  return ticks;
}

// An example target about 10% below the current price, rounded to a whole 100,000.
export function getTargetPriceExample(currentAmount) {
  const amount = Number(currentAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const rounded = Math.floor((amount * 0.9) / 100000) * 100000;
  return String(rounded > 0 ? rounded : Math.floor(amount * 0.9));
}

export function parseTargetPrice(value) {
  const normalized = String(value ?? '').replace(/[\s,]/g, '');
  return TARGET_PRICE.test(normalized) ? normalized : null;
}
