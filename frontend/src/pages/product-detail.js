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
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_STATUSES = new Set([
  'AVAILABLE',
  'INSUFFICIENT_DATA',
  'NO_HISTORY',
]);
const EXACT_INSUFFICIENT_MESSAGE = 'Insufficient data for a 30-day chart';
const EXACT_NO_HISTORY_MESSAGE = 'No price history available';
const TARGET_NOT_BELOW_MESSAGE = 'Target price must be lower than the current price';
const TARGET_NOT_POSITIVE_MESSAGE = 'Target price must be greater than 0';
const ACTIVE_ALERT_LIMIT_MESSAGE = 'Maximum 20 active alerts reached';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const trackedProductId = getProductIdFromPathname(window.location.pathname);
const pageStateRegion = document.querySelector('#product-page-state');
const loadingPanel = document.querySelector('#product-loading');
const errorPanel = document.querySelector('#product-error');
const errorMessage = document.querySelector('#product-error-message');
const retryButton = document.querySelector('#product-retry');
const pageContent = document.querySelector('#product-content');
const userContext = document.querySelector('#authenticated-user');
const signOutButton = document.querySelector('#signout-button');
const badges = document.querySelector('#product-badges');
const sourceLink = document.querySelector('#source-retailer-link');
const chartRegion = document.querySelector('#price-history-state');
const summaryRegion = document.querySelector('#history-summary');
const alertRegion = document.querySelector('#price-alert-region');
const alertCurrentPrice = document.querySelector('#alert-current-price');
const alertForm = document.querySelector('#price-alert-form');
const targetPriceInput = document.querySelector('#target-price');
const alertSubmitButton = document.querySelector('#price-alert-submit');
const alertFeedback = document.querySelector('#alert-feedback');
const createdAlert = document.querySelector('#created-alert');
const compareLink = document.querySelector('[data-compare-link]');
let currentUser = null;
let activeAttempt = 0;
let isLoading = false;
let isSigningOut = false;
let isSubmittingAlert = false;
let isAlertCreationBlocked = true;

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

function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isAuthenticatedUser(value) {
  return isObject(value)
    && isIdentifier(value.user_id)
    && isNonEmptyString(value.email)
    && isNonEmptyString(value.display_name);
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

function isCurrentPrice(value) {
  return isObject(value)
    && isDecimalAmount(value.amount)
    && /^[A-Z]{3}$/.test(value.currency_code)
    && isNonEmptyString(value.observed_at);
}

function isProductContext(value) {
  return isObject(value)
    && isIdentifier(value.tracked_product_id)
    && isNonEmptyString(value.tracking_status)
    && isObject(value.product)
    && isNonEmptyString(value.product.brand)
    && isNonEmptyString(value.product.display_name)
    && isObject(value.product.variant)
    && isNonEmptyString(value.product.variant.display_name)
    && isObject(value.source)
    && isNonEmptyString(value.source.retailer_name)
    && isHttpUrl(value.source.url)
    && (value.current_price === null || isCurrentPrice(value.current_price));
}

function getProductContext(response, routeId) {
  if (!Array.isArray(response?.data)) {
    throw new Error('The watchlist response does not match the documented contract.');
  }

  const context = response.data.find(
    (item) => item?.tracked_product_id === routeId,
  );

  if (!isProductContext(context)) {
    throw new Error('The tracked product context is unavailable.');
  }

  return context;
}

function isHistoryPoint(value) {
  return isObject(value)
    && isCalendarDate(value.date)
    && isDecimalAmount(value.amount);
}

function isHistorySummary(value) {
  return isObject(value)
    && isDecimalAmount(value.minimum)
    && isDecimalAmount(value.maximum)
    && (value.current === null || isDecimalAmount(value.current))
    && /^[A-Z]{3}$/.test(value.currency_code);
}

function getPriceHistory(response, routeId) {
  const data = response?.data;

  if (
    !isObject(data)
    || !isIdentifier(data.tracked_product_id)
    || data.tracked_product_id !== routeId
    || !isObject(data.range)
    || data.range.days !== 30
    || !isCalendarDate(data.range.from_date)
    || !isCalendarDate(data.range.to_date)
    || data.range.from_date > data.range.to_date
    || data.range.timezone !== 'UTC'
    || !HISTORY_STATUSES.has(data.status)
    || !(data.message === null || typeof data.message === 'string')
    || !Array.isArray(data.points)
    || data.points.length > 30
    || !data.points.every(isHistoryPoint)
    || data.points.some((point) => (
      point.date < data.range.from_date || point.date > data.range.to_date
    ))
    || data.points.some((point, index, points) => (
      index > 0 && points[index - 1].date >= point.date
    ))
  ) {
    throw new Error('The price-history response does not match the documented contract.');
  }

  const available = data.status === 'AVAILABLE'
    && data.points.length >= 2
    && data.message === null
    && isHistorySummary(data.summary);
  const insufficient = data.status === 'INSUFFICIENT_DATA'
    && data.points.length === 1
    && data.message === EXACT_INSUFFICIENT_MESSAGE
    && isHistorySummary(data.summary);
  const noHistory = data.status === 'NO_HISTORY'
    && data.points.length === 0
    && data.message === EXACT_NO_HISTORY_MESSAGE
    && data.summary === null;

  if (!available && !insufficient && !noHistory) {
    throw new Error('The price-history state is internally inconsistent.');
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

function createBadge(label, modifier = '') {
  const badge = document.createElement('span');
  badge.className = `badge${modifier ? ` ${modifier}` : ''}`;
  badge.textContent = label;
  return badge;
}

function renderProductContext(context) {
  document.querySelector('[data-field="product-brand"]').textContent = context.product.brand;
  document.querySelector('[data-field="product-name"]').textContent = context.product.display_name;
  document.querySelector('[data-field="product-variant"]').textContent = context.product.variant.display_name;
  document.querySelector('[data-product-id]').textContent = context.tracked_product_id;
  badges.replaceChildren(
    createBadge(formatStatusLabel(context.tracking_status)),
    createBadge(context.source.retailer_name, 'badge--retailer'),
  );

  sourceLink.href = context.source.url;
  sourceLink.hidden = false;
  alertRegion.dataset.trackedProductId = context.tracked_product_id;
  compareLink.href = `/products/${encodeURIComponent(context.tracked_product_id)}/compare`;
}

function renderCurrentPrice(history, context) {
  const currentPrice = document.querySelector('[data-field="current-price"]');
  const observedAt = document.querySelector('[data-field="price-observed-at"]');

  if (history.summary && history.summary.current !== null) {
    currentPrice.textContent = formatCurrency(
      history.summary.current,
      history.summary.currency_code,
    );
    observedAt.textContent = context.current_price
      ? `Updated ${formatDateTime(context.current_price.observed_at)}`
      : 'Current price derived from matching in-stock offers.';
    return;
  }

  if (history.summary === null && context.current_price) {
    currentPrice.textContent = formatCurrency(
      context.current_price.amount,
      context.current_price.currency_code,
    );
    observedAt.textContent = `Updated ${formatDateTime(context.current_price.observed_at)}`;
    return;
  }

  currentPrice.textContent = 'Price unavailable';
  observedAt.textContent = 'No in-stock current price is available.';
}

function getAlertPriceContext(history, context) {
  if (history.summary && history.summary.current !== null) {
    return {
      amount: history.summary.current,
      currencyCode: history.summary.currency_code,
    };
  }

  if (history.summary === null && context.current_price) {
    return {
      amount: context.current_price.amount,
      currencyCode: context.current_price.currency_code,
    };
  }

  return null;
}

function setAlertControlsState() {
  const disabled = isAlertCreationBlocked || isSubmittingAlert;
  targetPriceInput.disabled = disabled;
  alertSubmitButton.disabled = disabled;
  alertForm.setAttribute('aria-busy', String(isSubmittingAlert));
  alertSubmitButton.textContent = isSubmittingAlert
    ? 'Creating alert…'
    : 'Create price alert';
}

function clearAlertFeedback() {
  alertFeedback.replaceChildren();
  alertFeedback.className = 'alert-feedback';
  alertFeedback.removeAttribute('role');
  targetPriceInput.removeAttribute('aria-invalid');
}

function showAlertFeedback({ kind = 'error', message, guidance, focus = true }) {
  const messageElement = document.createElement('p');
  const guidanceElement = document.createElement('p');

  messageElement.className = 'alert-feedback__message';
  messageElement.textContent = message;
  guidanceElement.className = 'alert-feedback__guidance';
  guidanceElement.textContent = guidance;
  alertFeedback.className = `alert-feedback alert-feedback--${kind}`;
  alertFeedback.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  alertFeedback.replaceChildren(messageElement, guidanceElement);

  if (kind === 'error') {
    targetPriceInput.setAttribute('aria-invalid', 'true');
  } else {
    targetPriceInput.removeAttribute('aria-invalid');
  }

  if (focus) {
    alertFeedback.focus();
  }
}

function renderAlertRegion(history, context) {
  const currentPrice = getAlertPriceContext(history, context);

  isAlertCreationBlocked = currentPrice === null;
  isSubmittingAlert = false;
  createdAlert.hidden = true;
  clearAlertFeedback();

  if (currentPrice) {
    alertCurrentPrice.textContent = formatCurrency(
      currentPrice.amount,
      currentPrice.currencyCode,
    );
  } else {
    alertCurrentPrice.textContent = 'Price unavailable';
    showAlertFeedback({
      kind: 'warning',
      message: 'A current price is unavailable.',
      guidance: 'Try again later when a valid in-stock current price is available.',
      focus: false,
    });
  }

  setAlertControlsState();
}

function isIsoTimestamp(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function getCreatedAlert(response, routeId) {
  const alert = response?.data;

  if (
    !isObject(alert)
    || !isIdentifier(alert.price_alert_id)
    || alert.tracked_product_id !== routeId
    || !isDecimalAmount(alert.target_price)
    || !/^[A-Z]{3}$/.test(alert.currency_code)
    || alert.status !== 'ACTIVE'
    || !isDecimalAmount(alert.current_price)
    || !isIsoTimestamp(alert.created_at)
  ) {
    throw new Error('The create-alert response does not match the documented contract.');
  }

  return alert;
}

function renderCreatedAlert(alert) {
  document.querySelector('[data-field="alert-status"]').textContent = formatStatusLabel(alert.status);
  document.querySelector('[data-field="alert-target-price"]').textContent = formatCurrency(
    alert.target_price,
    alert.currency_code,
  );
  document.querySelector('[data-field="alert-created-at"]').textContent = formatDateTime(
    alert.created_at,
  );
  createdAlert.hidden = false;
  createdAlert.focus();
}

function blockAlertCreationForCurrentPrice() {
  isAlertCreationBlocked = true;
  alertCurrentPrice.textContent = 'Price unavailable';
  setAlertControlsState();
}

function handleAlertRequestError(error) {
  const state = toErrorState(error);

  if (state.code === 'TARGET_PRICE_NOT_BELOW_CURRENT') {
    showAlertFeedback({
      message: TARGET_NOT_BELOW_MESSAGE,
      guidance: 'Enter a lower target price and submit again.',
    });
    return;
  }

  if (state.code === 'TARGET_PRICE_NOT_POSITIVE') {
    showAlertFeedback({
      message: TARGET_NOT_POSITIVE_MESSAGE,
      guidance: 'Enter a target price greater than zero and submit again.',
    });
    return;
  }

  if (state.code === 'ACTIVE_ALERT_LIMIT_REACHED') {
    isAlertCreationBlocked = true;
    showAlertFeedback({
      message: ACTIVE_ALERT_LIMIT_MESSAGE,
      guidance: 'You cannot create another alert until an active alert is no longer active.',
    });
    return;
  }

  if (state.code === 'CURRENT_PRICE_UNAVAILABLE') {
    blockAlertCreationForCurrentPrice();
    showAlertFeedback({
      kind: 'warning',
      message: 'The current price is no longer available.',
      guidance: 'Try again later when a valid in-stock current price is available.',
    });
    return;
  }

  if (state.isNetworkError) {
    showAlertFeedback({
      message: 'PriceLens could not reach the alert service.',
      guidance: 'Check your connection, then submit the same target price again.',
    });
    return;
  }

  showAlertFeedback({
    message: 'PriceLens could not create the price alert.',
    guidance: 'Review the target price and try again.',
  });
}

async function handleCreateAlert(event) {
  event.preventDefault();

  if (isSubmittingAlert || isAlertCreationBlocked) {
    return;
  }

  const targetPrice = targetPriceInput.value.trim();

  if (!targetPrice) {
    showAlertFeedback({
      message: 'Enter a target price.',
      guidance: 'Use the target-price field before submitting the form.',
      focus: false,
    });
    targetPriceInput.focus();
    return;
  }

  isSubmittingAlert = true;
  createdAlert.hidden = true;
  clearAlertFeedback();
  setAlertControlsState();

  try {
    const encodedId = encodeURIComponent(trackedProductId);
    const response = await apiClient.post(
      `/tracked-products/${encodedId}/alerts`,
      { target_price: targetPrice },
    );
    renderCreatedAlert(getCreatedAlert(response, trackedProductId));
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToLanding();
      return;
    }

    handleAlertRequestError(error);
  } finally {
    isSubmittingAlert = false;
    setAlertControlsState();
  }
}

function renderHistory(history) {
  document.querySelector('#history-range').textContent = [
    `${history.range.from_date} to ${history.range.to_date}`,
    `${history.range.days} UTC calendar days`,
  ].join(' · ');
  chartRegion.replaceChildren();

  if (history.status === 'AVAILABLE') {
    chartRegion.className = 'chart-region chart-region--available';
    chartRegion.append(createHistoryChart(history.points, history.summary.currency_code));
  } else {
    const message = document.createElement('p');
    chartRegion.className = 'chart-region state-panel history-message';
    message.textContent = history.message;
    chartRegion.append(message);
  }

  summaryRegion.hidden = history.summary === null;

  if (history.summary) {
    const { currency_code: currencyCode } = history.summary;
    document.querySelector('[data-field="history-low"]').textContent = formatCurrency(
      history.summary.minimum,
      currencyCode,
    );
    document.querySelector('[data-field="history-high"]').textContent = formatCurrency(
      history.summary.maximum,
      currencyCode,
    );
    document.querySelector('[data-field="history-current"]').textContent = formatCurrency(
      history.summary.current,
      currencyCode,
    );
  }
}

function createHistoryChart(points, currencyCode) {
  const wrapper = document.createElement('div');
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  const title = document.createElementNS(SVG_NAMESPACE, 'title');
  const description = document.createElementNS(SVG_NAMESPACE, 'desc');
  const plot = document.createElementNS(SVG_NAMESPACE, 'polyline');
  const width = 800;
  const height = 280;
  const horizontalPadding = 54;
  const verticalPadding = 34;
  const numericAmounts = points.map((point) => Number(point.amount));
  const datePositions = points.map(({ date }) => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  });
  const minimum = Math.min(...numericAmounts);
  const maximum = Math.max(...numericAmounts);
  const range = maximum - minimum;
  const coordinates = points.map((point, index) => ({
    x: horizontalPadding
      + ((datePositions[index] - datePositions[0])
        / (datePositions.at(-1) - datePositions[0])) * (width - horizontalPadding * 2),
    y: range === 0
      ? height / 2
      : verticalPadding
        + ((maximum - numericAmounts[index]) / range) * (height - verticalPadding * 2),
    point,
  }));

  wrapper.className = 'history-chart';
  svg.classList.add('history-chart__svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'history-chart-title history-chart-description');
  title.id = 'history-chart-title';
  title.textContent = `Price history with ${points.length} daily points`;
  description.id = 'history-chart-description';
  description.textContent = `Daily prices from ${points[0].date} to ${points.at(-1).date}.`;
  svg.append(title, description);

  for (let index = 0; index < 4; index += 1) {
    const line = document.createElementNS(SVG_NAMESPACE, 'line');
    const y = verticalPadding + (index / 3) * (height - verticalPadding * 2);
    line.setAttribute('x1', horizontalPadding);
    line.setAttribute('x2', width - horizontalPadding);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.classList.add('history-chart__grid-line');
    svg.append(line);
  }

  plot.classList.add('history-chart__line');
  plot.setAttribute(
    'points',
    coordinates.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
  );
  svg.append(plot);

  coordinates.forEach(({ x, y, point }) => {
    const marker = document.createElementNS(SVG_NAMESPACE, 'circle');
    const markerTitle = document.createElementNS(SVG_NAMESPACE, 'title');
    marker.classList.add('history-chart__point');
    marker.dataset.historyPoint = '';
    marker.dataset.date = point.date;
    marker.dataset.amount = point.amount;
    marker.setAttribute('cx', x.toFixed(2));
    marker.setAttribute('cy', y.toFixed(2));
    marker.setAttribute('r', '4.5');
    markerTitle.textContent = `${point.date}: ${formatCurrency(point.amount, currencyCode)}`;
    marker.append(markerTitle);
    svg.append(marker);
  });

  const axis = document.createElement('div');
  axis.className = 'history-chart__axis';
  (points.length === 2
    ? [points[0], points[1]]
    : [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)])
    .forEach((point) => {
      const label = document.createElement('span');
      label.textContent = point.date;
      axis.append(label);
    });

  wrapper.append(svg, axis, createAccessibleHistoryTable(points, currencyCode));
  return wrapper;
}

function createAccessibleHistoryTable(points, currencyCode) {
  const details = document.createElement('details');
  const toggle = document.createElement('summary');
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const body = document.createElement('tbody');

  details.className = 'history-data';
  toggle.textContent = `View all ${points.length} daily price values`;
  caption.className = 'visually-hidden';
  caption.textContent = 'Price history values';

  ['UTC date', 'Price'].forEach((label) => {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = label;
    headRow.append(heading);
  });

  points.forEach((point) => {
    const row = document.createElement('tr');
    const date = document.createElement('td');
    const amount = document.createElement('td');
    date.textContent = point.date;
    amount.textContent = formatCurrency(point.amount, currencyCode);
    row.append(date, amount);
    body.append(row);
  });

  head.append(headRow);
  table.append(caption, head, body);
  details.append(toggle, table);
  return details;
}

function getRequestErrorMessage(error) {
  const state = toErrorState(error);

  if (state.code === 'TRACKED_PRODUCT_NOT_FOUND') {
    return 'The tracked product could not be found.';
  }

  if (state.isNetworkError) {
    return 'PriceLens could not reach the product service. Check your connection and try again.';
  }

  return 'The tracked product could not be loaded. Please try again.';
}

function redirectToLanding() {
  window.location.assign('/');
}

async function loadProductDetails() {
  if (isLoading) {
    return;
  }

  if (!isIdentifier(trackedProductId)) {
    errorMessage.textContent = 'This product route does not contain a valid tracked-product ID.';
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
    const [watchlistResponse, historyResponse] = await Promise.all([
      apiClient.get('/watchlist'),
      apiClient.get(`/tracked-products/${encodedId}/price-history`),
    ]);

    if (attempt !== activeAttempt) {
      return;
    }

    const context = getProductContext(watchlistResponse, trackedProductId);
    const history = getPriceHistory(historyResponse, trackedProductId);
    renderProductContext(context);
    renderCurrentPrice(history, context);
    renderHistory(history);
    renderAlertRegion(history, context);
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

retryButton.addEventListener('click', () => void loadProductDetails());
signOutButton.addEventListener('click', () => void handleSignOut());
alertForm.addEventListener('submit', (event) => void handleCreateAlert(event));
targetPriceInput.addEventListener('input', () => {
  if (targetPriceInput.getAttribute('aria-invalid') === 'true') {
    clearAlertFeedback();
  }
});

void loadProductDetails();
