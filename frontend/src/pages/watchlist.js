import { ApiError, apiRequest } from '../api/client.js';
import { getSession, logout } from '../auth/session.js';
import { createWatchlistItem } from '../components/watchlist-item.js';

const sessionLoading = document.querySelector('#session-loading');
const protectedContent = document.querySelector('#protected-content');
const userName = document.querySelector('#user-name');
const logoutButton = document.querySelector('#logout-button');
const count = document.querySelector('#watchlist-count');
const pageStatus = document.querySelector('#page-status');
const retryRegion = document.querySelector('#request-failure');
const retryButton = document.querySelector('#retry-button');
const emptyState = document.querySelector('#empty-state');
const itemList = document.querySelector('#watchlist-items');

function redirectToLanding() {
  window.location.replace('/');
}

function showPageState(state, message = '') {
  pageStatus.textContent = message;
  pageStatus.className = `page-status page-status--${state}`;
  retryRegion.hidden = state !== 'error';
  emptyState.hidden = state !== 'empty';
  itemList.hidden = state !== 'available';
}

function validatedWatchlist(response) {
  if (!response || !Array.isArray(response.data)) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      detail: 'PriceLens returned an invalid response.',
    });
  }

  const responseCount = response.meta?.count;

  if (!Number.isInteger(responseCount) || responseCount < 0) {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      detail: 'PriceLens returned an invalid response.',
    });
  }

  return { items: response.data, responseCount };
}

function renderWatchlist(items, responseCount) {
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    fragment.append(createWatchlistItem(item));
  }

  itemList.replaceChildren(fragment);
  count.textContent = `${responseCount} ${responseCount === 1 ? 'item' : 'items'}`;

  if (items.length === 0) {
    showPageState('empty', 'Your watchlist is empty.');
    return;
  }

  showPageState('available', `${responseCount} watchlist items loaded.`);
}

async function loadWatchlist() {
  retryButton.disabled = true;
  showPageState('loading', 'Loading your watchlist…');

  try {
    const response = await apiRequest('/watchlist');
    const { items, responseCount } = validatedWatchlist(response);
    renderWatchlist(items, responseCount);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTHENTICATION_REQUIRED') {
      redirectToLanding();
      return;
    }

    count.textContent = 'Unavailable';
    showPageState(
      'error',
      'We could not load your watchlist. Check your connection and try again.',
    );
  } finally {
    retryButton.disabled = false;
  }
}

retryButton.addEventListener('click', loadWatchlist);

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  pageStatus.textContent = 'Signing out…';

  try {
    await logout();
    window.location.assign('/');
  } catch {
    pageStatus.textContent = 'We could not sign you out. Please try again.';
    pageStatus.className = 'page-status page-status--error';
    logoutButton.disabled = false;
  }
});

async function initialisePage() {
  try {
    const user = await getSession();
    userName.textContent = user?.display_name || 'PriceLens shopper';
    sessionLoading.hidden = true;
    protectedContent.hidden = false;
    await loadWatchlist();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTHENTICATION_REQUIRED') {
      redirectToLanding();
      return;
    }

    sessionLoading.textContent = 'We could not verify your session. Return to the sign-in page and try again.';
    sessionLoading.className = 'session-gate session-gate--error';
  }
}

initialisePage();
