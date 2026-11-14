import { initializePageShell } from '../components/common.js';
import { apiClient } from '../api/client.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  redirectToSignIn,
  signOut,
} from '../auth/session.js';
import { toErrorState } from '../utils/errors.js';
import { SELECT_VARIANT_MESSAGE } from '../utils/helpers.js';

initializePageShell();

const DECIMAL_ID = /^\d+$/;
const EXACT_DUPLICATE_MESSAGE = 'This product URL is already being tracked';
const EXACT_INVALID_URL_MESSAGE = 'Unsupported or invalid product URL';

const sessionRegion = document.querySelector('#add-product-session');
const sessionLoading = document.querySelector('#add-product-session-loading');
const sessionError = document.querySelector('#add-product-session-error');
const sessionErrorMessage = document.querySelector('#add-product-session-error-message');
const sessionRetryButton = document.querySelector('#add-product-session-retry');
const pageContent = document.querySelector('#add-product-content');
const userContext = document.querySelector('#authenticated-user');
const signOutButton = document.querySelector('#signout-button');
const urlForm = document.querySelector('#product-url-form');
const urlInput = document.querySelector('#product-url');
const urlFeedback = document.querySelector('#url-feedback');
const resolveButton = document.querySelector('#resolve-product');
const resolvedSection = document.querySelector('#resolved-product');
const resolvedName = document.querySelector('[data-field="resolved-name"]');
const resolvedDescription = document.querySelector('[data-field="resolved-description"]');
const resolvedUrl = document.querySelector('[data-field="resolved-url"]');
const variantFieldset = document.querySelector('#variant-fieldset');
const variantOptions = document.querySelector('#variant-options');
const variantTemplate = document.querySelector('#variant-option-template');
const confirmButton = document.querySelector('#confirm-product');
const submissionFeedback = document.querySelector('#submission-feedback');
const successSection = document.querySelector('#tracking-success');
const successMessage = document.querySelector('#tracking-success-message');
const detailLink = document.querySelector('#view-tracked-product');

const pageState = {
  phase: 'session-loading',
  resolvedProduct: null,
  resolvedInputUrl: null,
  selectedOfferId: null,
  resolveAttempt: 0,
  isSigningOut: false,
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isIdentifier(value) {
  return typeof value === 'string' && DECIMAL_ID.test(value) && BigInt(value) > 0n;
}

function isAuthenticatedUser(value) {
  return isObject(value)
    && isIdentifier(value.user_id)
    && isNonEmptyString(value.email)
    && isNonEmptyString(value.display_name);
}

function isResolvedVariant(value) {
  return isObject(value)
    && isIdentifier(value.product_variant_id)
    && isIdentifier(value.retailer_offer_id)
    && isNonEmptyString(value.display_name)
    && isObject(value.attributes)
    && isNonEmptyString(value.url)
    && typeof value.is_tracked === 'boolean'
    && Array.isArray(value.also_tracked_at)
    && value.also_tracked_at.every(isNonEmptyString);
}

function getResolvedProduct(response) {
  const data = response?.data;

  if (
    !isObject(data)
    || !isNonEmptyString(data.normalized_url)
    || !isIdentifier(data.resolved_retailer_offer_id)
    || !isObject(data.retailer)
    || !isIdentifier(data.retailer.retailer_id)
    || !isNonEmptyString(data.retailer.name)
    || !isObject(data.product)
    || !isIdentifier(data.product.product_id)
    || !isNonEmptyString(data.product.brand)
    || !isNonEmptyString(data.product.display_name)
    || !Array.isArray(data.variants)
    || data.variants.length === 0
    || !data.variants.every(isResolvedVariant)
  ) {
    throw new Error('The product-resolution response does not match the documented contract.');
  }

  return data;
}

function getCreatedTrackedProduct(response) {
  const data = response?.data;

  if (
    !isObject(data)
    || !isIdentifier(data.tracked_product_id)
    || data.tracking_status !== 'TRACKING'
    || !isObject(data.product)
    || !isNonEmptyString(data.product.display_name)
    || !isObject(data.product.variant)
    || !isIdentifier(data.product.variant.product_variant_id)
    || !isNonEmptyString(data.product.variant.display_name)
    || !isObject(data.source)
    || !isIdentifier(data.source.retailer_offer_id)
  ) {
    throw new Error('The tracked-product response does not match the documented contract.');
  }

  return data;
}

function setStatus(element, message = '', kind = '') {
  if (!element) {
    return;
  }

  element.className = `status${kind ? ` status--${kind}` : ''}`;
  element.textContent = message;
}

function setSessionState(state, message = '') {
  pageState.phase = state;
  sessionRegion.hidden = state === 'ready';
  sessionLoading.hidden = state !== 'session-loading';
  sessionError.hidden = state !== 'session-error';
  pageContent.hidden = state !== 'ready';

  if (sessionErrorMessage) {
    sessionErrorMessage.textContent = message;
  }

  if (sessionRetryButton) {
    sessionRetryButton.disabled = state !== 'session-error';
  }
}

function setAuthenticatedUser(user) {
  if (userContext) {
    userContext.textContent = `Signed in as ${user.display_name}`;
    userContext.title = user.email;
    userContext.hidden = false;
  }

  if (signOutButton) {
    signOutButton.disabled = false;
  }
}

const ATTRIBUTE_ORDER = ['storage', 'capacity', 'memory', 'size', 'lens', 'color'];

function attributeRank(key) {
  const rank = ATTRIBUTE_ORDER.indexOf(key);
  return rank === -1 ? ATTRIBUTE_ORDER.length - 1 : rank;
}

function formatAttributes(attributes) {
  return Object.entries(attributes)
    .sort(([left], [right]) => attributeRank(left) - attributeRank(right))
    .map(([, value]) => value)
    .filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(String)
    .filter(Boolean)
    .join(' · ');
}

function setResolvePending(isPending) {
  pageState.phase = isPending ? 'resolving' : 'idle';
  urlForm?.setAttribute('aria-busy', String(isPending));

  if (urlInput) {
    urlInput.disabled = isPending;
  }

  if (resolveButton) {
    resolveButton.disabled = isPending;
    resolveButton.textContent = isPending ? 'Resolving product…' : 'Resolve product';
  }
}

function setTrackingPending(isPending) {
  pageState.phase = isPending
    ? 'tracking'
    : pageState.resolvedProduct ? 'resolved' : 'idle';
  resolvedSection?.setAttribute('aria-busy', String(isPending));

  if (variantFieldset) {
    variantFieldset.disabled = isPending;
  }

  if (confirmButton) {
    confirmButton.disabled = isPending;
    confirmButton.textContent = isPending ? 'Adding to watchlist…' : 'Add to watchlist';
  }

  if (urlInput) {
    urlInput.disabled = isPending;
  }

  if (resolveButton) {
    resolveButton.disabled = isPending;
  }
}

function resetResolvedProduct() {
  pageState.resolvedProduct = null;
  pageState.resolvedInputUrl = null;
  pageState.selectedOfferId = null;
  resolvedSection.hidden = true;
  variantOptions?.replaceChildren();
  setStatus(submissionFeedback);

  if (confirmButton) {
    confirmButton.disabled = true;
  }
}

function getVariantNote(variant) {
  if (variant.is_tracked) {
    return 'Already in your watchlist';
  }

  return variant.also_tracked_at.length
    ? `Also tracked at ${variant.also_tracked_at.join(', ')}`
    : '';
}

function renderVariant(variant) {
  const fragment = variantTemplate.content.cloneNode(true);
  const input = fragment.querySelector('input');
  const label = fragment.querySelector('[data-field="variant-label"]');
  const attributes = fragment.querySelector('[data-field="variant-attributes"]');

  input.value = variant.retailer_offer_id;
  input.dataset.productVariantId = variant.product_variant_id;
  input.disabled = variant.is_tracked;
  label.textContent = variant.display_name;
  attributes.textContent = formatAttributes(variant.attributes);
  fragment.querySelector('[data-field="variant-note"]').textContent = getVariantNote(variant);

  return fragment;
}

function selectVariant(offerId) {
  const variant = pageState.resolvedProduct.variants.find(
    (candidate) => candidate.retailer_offer_id === offerId,
  );

  pageState.selectedOfferId = offerId;
  resolvedUrl.textContent = variant.url;
  confirmButton.disabled = false;
  setStatus(submissionFeedback, `${variant.display_name} selected.`);
}

function renderResolvedProduct(product, submittedUrl) {
  const fragment = document.createDocumentFragment();
  const resolvedVariant = product.variants.find((variant) => (
    variant.retailer_offer_id === product.resolved_retailer_offer_id
  ));

  resolvedName.textContent = product.product.display_name;
  resolvedDescription.textContent = `${product.product.brand} · ${product.retailer.name}`;
  resolvedUrl.textContent = product.normalized_url;
  variantOptions.replaceChildren();

  product.variants.forEach((variant) => fragment.append(renderVariant(variant)));
  variantOptions.append(fragment);

  pageState.resolvedProduct = product;
  pageState.resolvedInputUrl = submittedUrl;
  pageState.selectedOfferId = null;
  confirmButton.disabled = false;

  if (resolvedVariant && !resolvedVariant.is_tracked) {
    variantOptions.querySelector(`input[value="${resolvedVariant.retailer_offer_id}"]`).checked = true;
    selectVariant(resolvedVariant.retailer_offer_id);
  }

  successSection.hidden = true;
  resolvedSection.hidden = false;
  resolvedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getResolveErrorMessage(error) {
  const errorState = toErrorState(error);

  if (errorState.code === 'INVALID_PRODUCT_URL') {
    return EXACT_INVALID_URL_MESSAGE;
  }

  if (errorState.code === 'SOURCE_UNAVAILABLE') {
    return 'The product source is temporarily unavailable. Please try again.';
  }

  if (errorState.isNetworkError) {
    return 'PriceLens could not reach the product service. Check your connection and try again.';
  }

  return 'PriceLens could not resolve this product. Please try again.';
}

function getTrackingError(error) {
  const errorState = toErrorState(error);

  if (errorState.code === 'DUPLICATE_TRACKED_URL') {
    return { message: EXACT_DUPLICATE_MESSAGE, shouldResolveAgain: false };
  }

  if (errorState.code === 'RETAILER_OFFER_NOT_FOUND') {
    return {
      message: 'This offer is no longer available. Resolve the product again and choose an available variant.',
      shouldResolveAgain: true,
    };
  }

  if (errorState.isNetworkError) {
    return {
      message: 'PriceLens could not reach the tracking service. Check your connection and try again.',
      shouldResolveAgain: false,
    };
  }

  return {
    message: 'PriceLens could not add this product. Please try again.',
    shouldResolveAgain: false,
  };
}

function redirectToLanding() {
  window.location.assign('/');
}

async function restoreSession() {
  setSessionState('session-loading');

  try {
    const user = await getCurrentSession();

    if (!isAuthenticatedUser(user)) {
      throw new Error('The session response does not match the documented contract.');
    }

    setAuthenticatedUser(user);
    setSessionState('ready');
    setResolvePending(false);
    urlInput?.focus();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    setSessionState(
      'session-error',
      'PriceLens could not verify your session. Check your connection and try again.',
    );
  }
}

async function handleResolve(event) {
  event.preventDefault();

  if (pageState.phase === 'resolving' || pageState.phase === 'tracking') {
    return;
  }

  const submittedUrl = urlInput?.value.trim() ?? '';

  setStatus(urlFeedback);
  setStatus(submissionFeedback);

  if (!submittedUrl) {
    urlInput?.setAttribute('aria-invalid', 'true');
    setStatus(urlFeedback, 'Enter a product URL.', 'error');
    urlInput?.focus();
    return;
  }

  urlInput?.setAttribute('aria-invalid', 'false');
  resetResolvedProduct();
  const attempt = ++pageState.resolveAttempt;
  setResolvePending(true);
  setStatus(urlFeedback, 'Resolving product…');

  try {
    const response = await apiClient.post('/product-sources/resolve', { url: submittedUrl });

    if (attempt !== pageState.resolveAttempt) {
      return;
    }

    const product = getResolvedProduct(response);
    renderResolvedProduct(product, submittedUrl);
    setStatus(urlFeedback, 'Product resolved. Confirm the exact variant to continue.', 'success');
  } catch (error) {
    if (attempt !== pageState.resolveAttempt) {
      return;
    }

    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    resetResolvedProduct();
    urlInput?.setAttribute('aria-invalid', 'true');
    setStatus(urlFeedback, getResolveErrorMessage(error), 'error');
    urlInput?.focus();
  } finally {
    if (attempt === pageState.resolveAttempt && pageState.phase !== 'session-loading') {
      setResolvePending(false);
    }
  }
}

async function handleTrack() {
  if (pageState.phase === 'tracking' || !pageState.resolvedProduct) {
    return;
  }

  if (!pageState.selectedOfferId) {
    setStatus(submissionFeedback, SELECT_VARIANT_MESSAGE, 'error');
    variantOptions.querySelector('input:not(:disabled)')?.focus();
    return;
  }

  const selectedOfferId = pageState.selectedOfferId;
  setTrackingPending(true);
  setStatus(submissionFeedback, 'Adding the selected variant to your watchlist…');

  try {
    const response = await apiClient.post('/tracked-products', {
      retailer_offer_id: selectedOfferId,
    });
    const trackedProduct = getCreatedTrackedProduct(response);

    if (trackedProduct.source.retailer_offer_id !== selectedOfferId) {
      throw new Error('The tracked product does not match the selected retailer offer.');
    }

    pageState.phase = 'success';
    resolvedSection.hidden = true;
    urlForm.hidden = true;
    successMessage.textContent = `${trackedProduct.product.display_name} — ${trackedProduct.product.variant.display_name} is now in your watchlist.`;
    detailLink.href = `/products/${encodeURIComponent(trackedProduct.tracked_product_id)}`;
    successSection.hidden = false;
    successSection.focus();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    const trackingError = getTrackingError(error);

    if (trackingError.shouldResolveAgain) {
      resetResolvedProduct();
      setStatus(urlFeedback, trackingError.message, 'error');
      urlInput?.focus();
    } else {
      setStatus(submissionFeedback, trackingError.message, 'error');
      submissionFeedback?.focus();
    }
  } finally {
    if (pageState.phase !== 'success') {
      setTrackingPending(false);
    }
  }
}

async function handleSignOut() {
  if (pageState.isSigningOut) {
    return;
  }

  pageState.isSigningOut = true;
  signOutButton.disabled = true;

  try {
    await signOut();
    redirectToLanding();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    setStatus(
      urlFeedback,
      'PriceLens could not sign you out. Please try again.',
      'error',
    );
    signOutButton.disabled = false;
    pageState.isSigningOut = false;
  }
}

urlForm?.addEventListener('submit', (event) => void handleResolve(event));

urlInput?.addEventListener('input', () => {
  urlInput.setAttribute('aria-invalid', 'false');

  if (
    pageState.resolvedInputUrl !== null
    && urlInput.value.trim() !== pageState.resolvedInputUrl
  ) {
    resetResolvedProduct();
    setStatus(urlFeedback, 'Resolve the updated URL to choose its exact variant.');
  } else if (urlFeedback?.classList.contains('status--error')) {
    setStatus(urlFeedback);
  }
});

variantOptions?.addEventListener('change', (event) => {
  const input = event.target.closest('input[name="variant"]');

  if (!input || pageState.phase === 'tracking') {
    return;
  }

  selectVariant(input.value);
});

confirmButton?.addEventListener('click', () => void handleTrack());
sessionRetryButton?.addEventListener('click', () => void restoreSession());
signOutButton?.addEventListener('click', () => void handleSignOut());

void restoreSession();
