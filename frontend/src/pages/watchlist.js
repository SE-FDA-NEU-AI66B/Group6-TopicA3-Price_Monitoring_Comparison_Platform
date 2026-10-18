import { initializePageShell } from '../components/common.js';
import { apiClient } from '../api/client.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  signOut,
} from '../auth/session.js';
import {
  formatCurrency,
  formatDateTime,
  formatStatusLabel,
} from '../utils/format.js';
import { toErrorState } from '../utils/errors.js';

initializePageShell();

const DECIMAL_ID = /^[1-9]\d*$/;
const FRESHNESS_STATES = new Set(['CURRENT', 'STALE', 'UNAVAILABLE']);
const watchlistState = document.querySelector('#watchlist-state');
const watchlistSummary = document.querySelector('#watchlist-summary');
const actionStatus = document.querySelector('#watchlist-action-status');
const errorMessage = document.querySelector('#watchlist-error-message');
const retryButton = document.querySelector('#watchlist-retry');
const itemsContainer = document.querySelector('#watchlist-items');
const itemTemplate = document.querySelector('#watchlist-item-template');
const userContext = document.querySelector('#authenticated-user');
const signOutButton = document.querySelector('#signout-button');
const stateElements = {
  placeholder: document.querySelector('#watchlist-placeholder'),
  loading: document.querySelector('#watchlist-loading'),
  empty: document.querySelector('#watchlist-empty'),
  error: document.querySelector('#watchlist-error'),
  data: document.querySelector('#watchlist-data'),
};
let currentUser = null;
let isLoading = false;
let isSigningOut = false;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isAuthenticatedUser(value) {
  return isObject(value)
    && DECIMAL_ID.test(value.user_id)
    && isNonEmptyString(value.email)
    && isNonEmptyString(value.display_name);
}

function isCurrentPrice(value) {
  return isObject(value)
    && isNonEmptyString(value.amount)
    && isNonEmptyString(value.currency_code)
    && isNonEmptyString(value.availability_status)
    && isNonEmptyString(value.observed_at);
}

function isWatchlistItem(value) {
  const hasAvailablePrice = isCurrentPrice(value?.current_price);

  return isObject(value)
    && DECIMAL_ID.test(value.tracked_product_id)
    && isNonEmptyString(value.tracking_status)
    && isObject(value.product)
    && isNonEmptyString(value.product.brand)
    && isNonEmptyString(value.product.display_name)
    && isObject(value.product.variant)
    && isNonEmptyString(value.product.variant.display_name)
    && isObject(value.source)
    && isNonEmptyString(value.source.retailer_name)
    && FRESHNESS_STATES.has(value.freshness_status)
    && (
      (value.current_price === null && value.freshness_status === 'UNAVAILABLE')
      || (hasAvailablePrice && value.freshness_status !== 'UNAVAILABLE')
    );
}

function getWatchlistPayload(response) {
  const count = response?.meta?.count;
  const items = response?.data;

  if (
    !Array.isArray(items)
    || !Number.isInteger(count)
    || count < 0
    || count !== items.length
    || !items.every(isWatchlistItem)
  ) {
    throw new Error('The watchlist response does not match the documented contract.');
  }

  return { count, items };
}

function showWatchlistState(state) {
  Object.entries(stateElements).forEach(([name, element]) => {
    if (element) {
      element.hidden = name !== state;
    }
  });

  watchlistState?.setAttribute('aria-busy', String(state === 'loading'));
}

function setAuthenticatedUser(user) {
  currentUser = user;

  if (userContext) {
    userContext.textContent = `Signed in as ${user.display_name}`;
    userContext.title = user.email;
    userContext.hidden = false;
  }

  if (signOutButton) {
    signOutButton.disabled = false;
  }
}

function setFreshness(element, freshnessStatus) {
  element.classList.remove('badge--warning', 'badge--neutral');

  if (freshnessStatus === 'STALE') {
    element.textContent = 'Stale data';
    element.classList.add('badge--warning');
    return;
  }

  element.textContent = formatStatusLabel(freshnessStatus);

  if (freshnessStatus === 'UNAVAILABLE') {
    element.classList.add('badge--neutral');
  }
}

function renderWatchlistItem(item) {
  const fragment = itemTemplate.content.cloneNode(true);
  const freshness = fragment.querySelector('[data-field="freshness"]');
  const trackingStatus = fragment.querySelector('[data-field="tracking-status"]');
  const retailer = fragment.querySelector('[data-field="retailer"]');
  const brand = fragment.querySelector('[data-field="brand"]');
  const name = fragment.querySelector('[data-field="name"]');
  const variant = fragment.querySelector('[data-field="variant"]');
  const price = fragment.querySelector('[data-field="price"]');
  const updated = fragment.querySelector('[data-field="updated"]');
  const detailLink = fragment.querySelector('[data-field="detail-link"]');

  setFreshness(freshness, item.freshness_status);
  trackingStatus.textContent = formatStatusLabel(item.tracking_status);
  retailer.textContent = item.source.retailer_name;
  brand.textContent = item.product.brand;
  name.textContent = item.product.display_name;
  variant.textContent = item.product.variant.display_name;

  if (item.current_price) {
    price.textContent = formatCurrency(
      item.current_price.amount,
      item.current_price.currency_code,
    );
    updated.textContent = `Updated ${formatDateTime(item.current_price.observed_at)}`;
  } else {
    price.textContent = 'Price unavailable';
    updated.textContent = 'No in-stock price is currently available.';
  }

  detailLink.href = `/products/${encodeURIComponent(item.tracked_product_id)}`;
  detailLink.textContent = 'View';
  detailLink.setAttribute('aria-label', `View ${item.product.display_name}`);

  return fragment;
}

function renderWatchlist(items) {
  const fragment = document.createDocumentFragment();

  itemsContainer.replaceChildren();
  items.forEach((item) => fragment.append(renderWatchlistItem(item)));
  itemsContainer.append(fragment);
}

function getWatchlistErrorMessage(error) {
  const errorState = toErrorState(error);

  if (errorState.isNetworkError) {
    return 'PriceLens could not reach the watchlist service. Check your connection and try again.';
  }

  return 'Your watchlist could not be loaded. Please try again.';
}

function redirectToLanding() {
  window.location.assign('/');
}

async function loadWatchlist() {
  if (isLoading) {
    return;
  }

  isLoading = true;
  retryButton.disabled = true;
  showWatchlistState('loading');

  if (watchlistSummary) {
    watchlistSummary.textContent = 'Loading your tracked products…';
  }

  try {
    if (!currentUser) {
      const user = await getCurrentSession();

      if (!isAuthenticatedUser(user)) {
        throw new Error('The session response does not match the documented contract.');
      }

      setAuthenticatedUser(user);
    }

    const response = await apiClient.get('/watchlist');
    const { count, items } = getWatchlistPayload(response);

    if (watchlistSummary) {
      watchlistSummary.textContent = `${count} ${count === 1 ? 'item' : 'items'} in your watchlist.`;
    }

    if (count === 0) {
      itemsContainer.replaceChildren();
      showWatchlistState('empty');
      return;
    }

    renderWatchlist(items);
    showWatchlistState('data');
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    if (watchlistSummary) {
      watchlistSummary.textContent = 'Your watchlist is temporarily unavailable.';
    }

    if (errorMessage) {
      errorMessage.textContent = getWatchlistErrorMessage(error);
    }

    showWatchlistState('error');
  } finally {
    isLoading = false;

    if (retryButton) {
      retryButton.disabled = false;
    }
  }
}

async function handleSignOut() {
  if (isSigningOut) {
    return;
  }

  isSigningOut = true;
  signOutButton.disabled = true;

  if (actionStatus) {
    actionStatus.className = 'status';
    actionStatus.textContent = 'Signing out…';
  }

  try {
    await signOut();
    redirectToLanding();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    const errorState = toErrorState(error);

    if (actionStatus) {
      actionStatus.className = 'status status--error';
      actionStatus.textContent = errorState.isNetworkError
        ? 'PriceLens could not reach the sign-out service. Please try again.'
        : 'PriceLens could not sign you out. Please try again.';
    }

    signOutButton.disabled = false;
    isSigningOut = false;
  }
}

retryButton?.addEventListener('click', () => void loadWatchlist());
signOutButton?.addEventListener('click', () => void handleSignOut());

void loadWatchlist();
