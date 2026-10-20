import {
  formatMoney,
  formatObservationTime,
  formatStatusLabel,
} from '../utils/format.js';

function element(tagName, className, text) {
  const node = document.createElement(tagName);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

function safeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sourceElement(source = {}) {
  const container = element('p', 'watchlist-card__source');
  container.append('From ');

  const retailerName = safeText(source.retailer_name, 'Unknown retailer');
  const url = safeExternalUrl(source.url);

  if (!url) {
    container.append(retailerName);
    return container;
  }

  const link = element('a', 'retailer-link', retailerName);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `${retailerName} (opens in a new tab)`);
  container.append(link);
  return container;
}

function priceRegion(item) {
  const container = element('div', 'watchlist-card__price-block');
  const priceUnavailable = item.current_price === null
    || item.freshness_status === 'UNAVAILABLE';

  if (priceUnavailable) {
    container.append(
      element('p', 'watchlist-card__price watchlist-card__price--unavailable', 'Price unavailable'),
      element('p', 'watchlist-card__update', 'No in-stock price is currently available.'),
    );
    return container;
  }

  const price = formatMoney(
    item.current_price?.amount,
    item.current_price?.currency_code,
  );
  const observedAt = item.current_price?.observed_at;
  const update = element(
    'time',
    'watchlist-card__update',
    formatObservationTime(observedAt),
  );

  if (typeof observedAt === 'string') {
    update.dateTime = observedAt;
  }

  container.append(
    element('p', 'watchlist-card__price', price),
    update,
  );
  return container;
}

function freshnessBadge(freshnessStatus) {
  const status = safeText(freshnessStatus, 'UNAVAILABLE');
  let label = formatStatusLabel(status);

  if (status === 'STALE') {
    label = 'Stale data';
  } else if (status === 'UNAVAILABLE') {
    label = 'Price unavailable';
  }

  return element(
    'span',
    `badge badge--freshness badge--${status.toLowerCase()}`,
    label,
  );
}

export function createWatchlistItem(item) {
  const product = item?.product ?? {};
  const variant = product.variant ?? {};
  const card = element('li', 'watchlist-card');
  card.dataset.trackedProductId = safeText(item?.tracked_product_id, 'unknown');

  const header = element('div', 'watchlist-card__header');
  const titleGroup = element('div', 'watchlist-card__title-group');
  titleGroup.append(
    element('h2', 'watchlist-card__title', safeText(product.display_name, 'Unnamed product')),
    element('p', 'watchlist-card__variant', safeText(variant.display_name, 'Variant unavailable')),
  );

  header.append(
    titleGroup,
    element(
      'span',
      'badge badge--tracking',
      formatStatusLabel(item?.tracking_status, 'Unknown status'),
    ),
  );

  const footer = element('div', 'watchlist-card__footer');
  footer.append(
    freshnessBadge(item?.freshness_status),
    sourceElement(item?.source),
  );

  card.append(header, priceRegion(item ?? {}), footer);
  return card;
}
