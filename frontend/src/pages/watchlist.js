import { initializePageShell } from '../components/common.js';
import { apiClient } from '../api/client.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  redirectToSignIn,
  signOut,
} from '../auth/session.js';
import {
  formatCurrency,
  formatDateTime,
  formatStatusLabel,
  formatUpdatedAgo,
  getFreshnessBadge,
} from '../utils/format.js';
import { toErrorState } from '../utils/errors.js';
import {
  filterWatchlistItems,
  getNoSearchResultsMessage,
  getRemoveConfirmationMessage,
  PRODUCT_REMOVED_MESSAGE,
} from '../utils/helpers.js';

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
const searchInput = document.querySelector('#watchlist-search');
const noResults = document.querySelector('#watchlist-no-results');
const removeDialog = document.querySelector('#remove-dialog');
const removeTitle = document.querySelector('#remove-title');
const removeMessage = document.querySelector('#remove-message');
const removeStatus = document.querySelector('#remove-status');
const removeConfirmButton = document.querySelector('#remove-confirm');
const stateElements = {
  loading: document.querySelector('#watchlist-loading'),
  empty: document.querySelector('#watchlist-empty'),
  error: document.querySelector('#watchlist-error'),
  data: document.querySelector('#watchlist-data'),
};
let currentUser = null;
let watchlistItems = [];
let pendingRemoval = null;
let isLoading = false;
let isSigningOut = false;
let isRemoving = false;

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
    && Number.isInteger(value.alert_count)
    && Number.isInteger(value.active_alert_count)
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
  const { label, modifier } = getFreshnessBadge(freshnessStatus);

  element.textContent = label;
  element.hidden = freshnessStatus === 'UNAVAILABLE';

  if (modifier) {
    element.classList.add(modifier);
  }
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
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
  const alerts = fragment.querySelector('[data-field="alerts"]');
  const removeButton = fragment.querySelector('[data-field="remove"]');

  setFreshness(freshness, item.freshness_status);
  trackingStatus.textContent = formatStatusLabel(item.tracking_status);
  trackingStatus.hidden = item.tracking_status === 'TRACKING';
  retailer.textContent = item.source.retailer_name;
  brand.textContent = item.product.brand;
  name.textContent = item.product.display_name;
  variant.textContent = item.product.variant.display_name;

  price.classList.toggle('money--unavailable', !item.current_price);

  if (item.current_price) {
    price.textContent = formatCurrency(
      item.current_price.amount,
      item.current_price.currency_code,
    );
    updated.textContent = formatUpdatedAgo(item.current_price.observed_at);
    updated.title = formatDateTime(item.current_price.observed_at);
  } else {
    price.textContent = 'Price unavailable';
    updated.textContent = 'No in-stock price is currently available.';
  }

  alerts.textContent = item.active_alert_count > 0
    ? pluralize(item.active_alert_count, 'active alert')
    : '';
  detailLink.href = `/products/${encodeURIComponent(item.tracked_product_id)}`;
  detailLink.textContent = 'View';
  detailLink.setAttribute('aria-label', `View ${item.product.display_name}`);
  removeButton.dataset.trackedProductId = item.tracked_product_id;
  removeButton.setAttribute('aria-label', `Remove ${item.product.display_name}`);

  return fragment;
}

function getWatchlistSummary(shownCount, totalCount) {
  const total = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;

  return shownCount === totalCount
    ? `${total} in your watchlist.`
    : `Showing ${shownCount} of ${total} in your watchlist.`;
}

function renderWatchlist() {
  const items = filterWatchlistItems(watchlistItems, searchInput.value);
  const fragment = document.createDocumentFragment();

  items.forEach((item) => fragment.append(renderWatchlistItem(item)));
  itemsContainer.replaceChildren(fragment);
  noResults.textContent = getNoSearchResultsMessage(searchInput.value);
  noResults.hidden = items.length > 0;

  if (watchlistSummary) {
    watchlistSummary.textContent = getWatchlistSummary(items.length, watchlistItems.length);
  }
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
      watchlistSummary.textContent = getWatchlistSummary(count, count);
    }

    watchlistItems = items;

    if (count === 0) {
      itemsContainer.replaceChildren();
      showWatchlistState('empty');
      return;
    }

    renderWatchlist();
    showWatchlistState('data');
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
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

function setActionStatus(message, kind = '') {
  actionStatus.className = `status${kind ? ` status--${kind}` : ''}`;
  actionStatus.textContent = message;
}

async function handleSignOut() {
  if (isSigningOut) {
    return;
  }

  isSigningOut = true;
  signOutButton.disabled = true;
  setActionStatus('Signing out…');

  try {
    await signOut();
    redirectToLanding();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    setActionStatus(
      toErrorState(error).isNetworkError
        ? 'PriceLens could not reach the sign-out service. Please try again.'
        : 'PriceLens could not sign you out. Please try again.',
      'error',
    );
    signOutButton.disabled = false;
    isSigningOut = false;
  }
}

function openRemoveDialog(trackedProductId) {
  pendingRemoval = watchlistItems.find(
    (item) => item.tracked_product_id === trackedProductId,
  );

  if (!pendingRemoval) {
    return;
  }

  removeTitle.textContent = `Remove ${pendingRemoval.product.display_name}?`;
  removeMessage.textContent = getRemoveConfirmationMessage(pendingRemoval);
  removeStatus.className = 'status';
  removeStatus.textContent = '';
  removeDialog.showModal();
}

async function handleRemove() {
  if (isRemoving || !pendingRemoval) {
    return;
  }

  isRemoving = true;
  removeConfirmButton.disabled = true;

  try {
    await apiClient.delete(`/tracked-products/${encodeURIComponent(pendingRemoval.tracked_product_id)}`);
    removeDialog.close();
    await loadWatchlist();
    setActionStatus(PRODUCT_REMOVED_MESSAGE, 'success');
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    removeStatus.className = 'status status--error';
    removeStatus.textContent = 'PriceLens could not remove this product. Please try again.';
  } finally {
    isRemoving = false;
    removeConfirmButton.disabled = false;
  }
}

itemsContainer.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-field="remove"]');

  if (removeButton) {
    openRemoveDialog(removeButton.dataset.trackedProductId);
  }
});

removeDialog.addEventListener('close', () => {
  pendingRemoval = null;
});

searchInput.addEventListener('input', () => renderWatchlist());
removeConfirmButton.addEventListener('click', () => void handleRemove());
document.querySelector('#remove-cancel').addEventListener('click', () => removeDialog.close());
retryButton?.addEventListener('click', () => void loadWatchlist());
signOutButton?.addEventListener('click', () => void handleSignOut());

void loadWatchlist();
