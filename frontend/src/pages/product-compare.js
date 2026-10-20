import { apiClient } from '../api/client.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  signOut,
} from '../auth/session.js';
import { initializePageShell } from '../components/common.js';
import { toErrorState } from '../utils/errors.js';
import { formatCurrency, formatDateTime, formatStatusLabel } from '../utils/format.js';
import { getProductIdFromPathname } from '../utils/helpers.js';

initializePageShell();

const DECIMAL_ID = /^\d+$/;
const DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)\.\d{2}$/;
const SOURCE_CODE = /^[A-Z][A-Z0-9_]*$/;
const COMPARISON_STATUSES = new Set([
  'AVAILABLE',
  'SINGLE_OFFER',
  'NO_AVAILABLE_OFFERS',
]);
const SINGLE_OFFER_MESSAGE = 'No multi-source comparison is currently available';

const trackedProductId = getProductIdFromPathname(window.location.pathname);
const pageStateRegion = document.querySelector('#comparison-page-state');
const loadingPanel = document.querySelector('#comparison-loading');
const errorPanel = document.querySelector('#comparison-error');
const errorMessage = document.querySelector('#comparison-error-message');
const retryButton = document.querySelector('#comparison-retry');
const pageContent = document.querySelector('#comparison-content');
const userContext = document.querySelector('#authenticated-user');
const signOutButton = document.querySelector('#signout-button');
const backLink = document.querySelector('[data-product-link]');
const comparisonMessage = document.querySelector('#comparison-message');
const emptyPanel = document.querySelector('#comparison-empty');
const comparisonData = document.querySelector('#comparison-data');
const offerList = document.querySelector('#retailer-offers');
const offerTemplate = document.querySelector('#retailer-offer-template');
const bestOfferSummary = document.querySelector('#best-offer-summary');
let currentUser = null;
let activeAttempt = 0;
let isLoading = false;
let isSigningOut = false;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIdentifier(value) {
  return typeof value === 'string'
    && DECIMAL_ID.test(value)
    && BigInt(value) > 0n;
}

function isDecimalAmount(value) {
  return typeof value === 'string' && DECIMAL_AMOUNT.test(value);
}

function isIsoUtcTimestamp(value) {
  if (!isNonEmptyString(value) || !value.endsWith('Z')) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isHttpUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAuthenticatedUser(value) {
  return isObject(value)
    && isIdentifier(value.user_id)
    && isNonEmptyString(value.email)
    && isNonEmptyString(value.display_name);
}

function isProductContext(value) {
  return isObject(value)
    && isIdentifier(value.product_id)
    && isNonEmptyString(value.brand)
    && isNonEmptyString(value.model)
    && isNonEmptyString(value.display_name)
    && isObject(value.variant)
    && isIdentifier(value.variant.product_variant_id)
    && isNonEmptyString(value.variant.display_name)
    && isObject(value.variant.attributes);
}

function isRetailer(value) {
  return isObject(value)
    && isIdentifier(value.retailer_id)
    && typeof value.source_code === 'string'
    && SOURCE_CODE.test(value.source_code)
    && isNonEmptyString(value.name);
}

function isOffer(value) {
  return isObject(value)
    && isIdentifier(value.retailer_offer_id)
    && isRetailer(value.retailer)
    && isDecimalAmount(value.amount)
    && /^[A-Z]{3}$/.test(value.currency_code)
    && value.availability_status === 'IN_STOCK'
    && isIsoUtcTimestamp(value.observed_at)
    && isHttpUrl(value.url)
    && isDecimalAmount(value.difference_from_lowest);
}

function sameOffer(left, right) {
  return left.retailer_offer_id === right.retailer_offer_id
    && left.retailer.retailer_id === right.retailer.retailer_id
    && left.retailer.source_code === right.retailer.source_code
    && left.retailer.name === right.retailer.name
    && left.amount === right.amount
    && left.currency_code === right.currency_code
    && left.availability_status === right.availability_status
    && left.observed_at === right.observed_at
    && left.url === right.url
    && left.difference_from_lowest === right.difference_from_lowest;
}

function getComparison(response, routeId) {
  const data = response?.data;

  if (
    !isObject(data)
    || !isIdentifier(data.tracked_product_id)
    || data.tracked_product_id !== routeId
    || !isProductContext(data.product)
    || !COMPARISON_STATUSES.has(data.status)
    || !(data.message === null || typeof data.message === 'string')
    || !Array.isArray(data.offers)
    || !data.offers.every(isOffer)
    || new Set(data.offers.map((offer) => offer.retailer_offer_id)).size
      !== data.offers.length
  ) {
    throw new Error('The retailer-comparison response does not match the documented contract.');
  }

  const currencyCode = data.offers[0]?.currency_code;

  if (currencyCode && data.offers.some((offer) => offer.currency_code !== currencyCode)) {
    throw new Error('The retailer-comparison response mixes currencies.');
  }

  const hasLowestOffer = isOffer(data.lowest_offer);
  const matchingLowest = hasLowestOffer
    ? data.offers.find((offer) => (
        offer.retailer_offer_id === data.lowest_offer.retailer_offer_id
      ))
    : null;
  const lowestIsConsistent = hasLowestOffer
    && matchingLowest
    && sameOffer(matchingLowest, data.lowest_offer)
    && data.lowest_offer.difference_from_lowest === '0.00';
  const available = data.status === 'AVAILABLE'
    && data.message === null
    && data.offers.length >= 2
    && lowestIsConsistent;
  const singleOffer = data.status === 'SINGLE_OFFER'
    && data.message === SINGLE_OFFER_MESSAGE
    && data.offers.length === 1
    && lowestIsConsistent;
  const noAvailableOffers = data.status === 'NO_AVAILABLE_OFFERS'
    && data.message === null
    && data.offers.length === 0
    && data.lowest_offer === null;

  if (!available && !singleOffer && !noAvailableOffers) {
    throw new Error('The retailer-comparison state is internally inconsistent.');
  }

  return data;
}

function showPageState(phase) {
  const isReady = phase === 'ready';

  loadingPanel.hidden = phase !== 'loading';
  errorPanel.hidden = phase !== 'error';
  pageContent.hidden = !isReady;
  pageStateRegion.hidden = isReady;
  pageStateRegion.setAttribute('aria-busy', String(phase === 'loading'));
  retryButton.disabled = phase !== 'error';
}

function setAuthenticatedUser(user) {
  currentUser = user;
  userContext.textContent = `Signed in as ${user.display_name}`;
  userContext.title = user.email;
  userContext.hidden = false;
  signOutButton.disabled = false;
}

function renderProductContext(comparison) {
  document.querySelector('[data-field="product-brand"]').textContent = comparison.product.brand;
  document.querySelector('[data-field="product-name"]').textContent = comparison.product.display_name;
  document.querySelector('[data-field="product-variant"]').textContent = comparison.product.variant.display_name;
  document.querySelector('[data-product-id]').textContent = comparison.tracked_product_id;
  backLink.href = `/products/${encodeURIComponent(comparison.tracked_product_id)}`;
}

function renderOffer(offer, lowestOfferId) {
  const fragment = offerTemplate.content.cloneNode(true);
  const item = fragment.querySelector('.offer');
  const isLowest = offer.retailer_offer_id === lowestOfferId;

  item.dataset.retailerOfferId = offer.retailer_offer_id;
  item.classList.toggle('offer--lowest', isLowest);
  item.setAttribute(
    'aria-label',
    `${offer.retailer.name}${isLowest ? ', lowest price' : ''}`,
  );
  fragment.querySelector('[data-field="retailer-initial"]').textContent = offer.retailer.name.charAt(0);
  fragment.querySelector('[data-field="retailer-name"]').textContent = offer.retailer.name;
  fragment.querySelector('[data-field="offer-label"]').textContent = isLowest
    ? 'Lowest price'
    : 'Eligible offer';
  fragment.querySelector('[data-field="offer-price"]').textContent = formatCurrency(
    offer.amount,
    offer.currency_code,
  );
  fragment.querySelector('[data-field="difference"]').textContent = `Difference from lowest: ${formatCurrency(
    offer.difference_from_lowest,
    offer.currency_code,
  )}`;
  fragment.querySelector('[data-field="availability"]').textContent = formatStatusLabel(
    offer.availability_status,
  );
  fragment.querySelector('[data-field="observed-at"]').textContent = `Observed ${formatDateTime(
    offer.observed_at,
  )}`;
  fragment.querySelector('[data-field="retailer-link"]').href = offer.url;

  return fragment;
}

function renderLowestOffer(lowestOffer) {
  document.querySelector('[data-field="best-offer"]').textContent = [
    lowestOffer.retailer.name,
    formatCurrency(lowestOffer.amount, lowestOffer.currency_code),
  ].join(' · ');
  document.querySelector('[data-field="best-offer-link"]').href = lowestOffer.url;
}

function renderComparison(comparison) {
  renderProductContext(comparison);
  comparisonMessage.hidden = true;
  emptyPanel.hidden = true;
  comparisonData.hidden = true;
  offerList.replaceChildren();

  if (comparison.status === 'NO_AVAILABLE_OFFERS') {
    emptyPanel.hidden = false;
    return;
  }

  if (comparison.status === 'SINGLE_OFFER') {
    comparisonMessage.textContent = comparison.message;
    comparisonMessage.hidden = false;
  }

  const fragment = document.createDocumentFragment();

  comparison.offers.forEach((offer) => {
    fragment.append(renderOffer(
      offer,
      comparison.lowest_offer.retailer_offer_id,
    ));
  });
  offerList.append(fragment);
  renderLowestOffer(comparison.lowest_offer);
  bestOfferSummary.hidden = false;
  comparisonData.hidden = false;
}

function getRequestErrorMessage(error) {
  const state = toErrorState(error);

  if (state.code === 'TRACKED_PRODUCT_NOT_FOUND') {
    return 'The tracked product could not be found.';
  }

  if (state.isNetworkError) {
    return 'PriceLens could not reach the comparison service. Check your connection and try again.';
  }

  return 'The retailer comparison could not be loaded. Please try again.';
}

function redirectToLanding() {
  window.location.assign('/');
}

async function loadComparison() {
  if (isLoading) {
    return;
  }

  if (!isIdentifier(trackedProductId)) {
    errorMessage.textContent = 'This comparison route does not contain a valid tracked-product ID.';
    showPageState('error');
    retryButton.hidden = true;
    return;
  }

  isLoading = true;
  const attempt = ++activeAttempt;
  retryButton.hidden = false;
  showPageState('loading');

  try {
    if (!currentUser) {
      const user = await getCurrentSession();

      if (!isAuthenticatedUser(user)) {
        throw new Error('The session response does not match the documented contract.');
      }

      setAuthenticatedUser(user);
    }

    const encodedId = encodeURIComponent(trackedProductId);
    const response = await apiClient.get(
      `/tracked-products/${encodedId}/offers`,
    );

    if (attempt !== activeAttempt) {
      return;
    }

    const comparison = getComparison(response, trackedProductId);
    renderComparison(comparison);
    showPageState('ready');
  } catch (error) {
    if (attempt !== activeAttempt) {
      return;
    }

    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    errorMessage.textContent = getRequestErrorMessage(error);
    showPageState('error');
  } finally {
    if (attempt === activeAttempt) {
      isLoading = false;
    }
  }
}

async function handleSignOut() {
  if (isSigningOut) {
    return;
  }

  isSigningOut = true;
  signOutButton.disabled = true;

  try {
    await signOut();
    redirectToLanding();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    errorMessage.textContent = 'PriceLens could not sign you out. Please try again.';
    showPageState('error');
    signOutButton.disabled = false;
    isSigningOut = false;
  }
}

retryButton.addEventListener('click', () => void loadComparison());
signOutButton.addEventListener('click', () => void handleSignOut());

void loadComparison();
