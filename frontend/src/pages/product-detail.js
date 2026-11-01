import { apiClient } from '../api/client.js';
import {
  getCurrentSession,
  isAuthenticationRequiredError,
  redirectToSignIn,
  signOut,
} from '../auth/session.js';
import { initializePageShell } from '../components/common.js';
import { toErrorState } from '../utils/errors.js';
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatStatusLabel,
  getFreshnessBadge,
} from '../utils/format.js';
import { getProductIdFromPathname, parseTargetPrice } from '../utils/helpers.js';

initializePageShell();

const DECIMAL_ID = /^\d+$/;
const DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)\.\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_STATUSES = new Set([
  'AVAILABLE',
  'INSUFFICIENT_DATA',
  'NO_HISTORY',
]);
const FRESHNESS_STATES = new Set(['CURRENT', 'STALE', 'UNAVAILABLE']);
const ALERT_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'EXPIRED']);
const EXACT_INSUFFICIENT_MESSAGE = 'Insufficient data for a 30-day chart';
const EXACT_NO_HISTORY_MESSAGE = 'No price history available';
const TARGET_NOT_BELOW_MESSAGE = 'Target price must be lower than the current price';
const TARGET_NOT_POSITIVE_MESSAGE = 'Target price must be greater than 0';
const ACTIVE_ALERT_LIMIT_MESSAGE = 'Maximum 20 active alerts reached';
const DUPLICATE_ALERT_MESSAGE = 'An active alert with this target price already exists';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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
const alertPriceNote = document.querySelector('#alert-price-note');
const alertForm = document.querySelector('#price-alert-form');
const targetPriceInput = document.querySelector('#target-price');
const alertSubmitButton = document.querySelector('#price-alert-submit');
const alertFeedback = document.querySelector('#alert-feedback');
const alertList = document.querySelector('#alert-list');
const alertListEmpty = document.querySelector('#alert-list-empty');
const alertItemTemplate = document.querySelector('#alert-item-template');
const compareLink = document.querySelector('[data-compare-link]');
let currentUser = null;
let activeAttempt = 0;
let isLoading = false;
let isSigningOut = false;
let isSubmittingAlert = false;
let isAlertCreationBlocked = true;
let priceAlerts = [];

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

function isIsoTimestamp(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
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
    && isIsoTimestamp(value.observed_at)
    && isNonEmptyString(value.retailer_name);
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
    && FRESHNESS_STATES.has(value.freshness_status)
    && (value.current_price === null || isCurrentPrice(value.current_price));
}

function isPriceAlert(value, routeId) {
  return isObject(value)
    && isIdentifier(value.price_alert_id)
    && value.tracked_product_id === routeId
    && isDecimalAmount(value.target_price)
    && /^[A-Z]{3}$/.test(value.currency_code)
    && ALERT_STATUSES.has(value.status)
    && isIsoTimestamp(value.created_at);
}

function getProductContext(response, routeId) {
  const context = response?.data;

  if (!isProductContext(context) || context.tracked_product_id !== routeId) {
    throw new Error('The tracked product response does not match the documented contract.');
  }

  return context;
}

function getPriceAlert(response, routeId) {
  if (!isPriceAlert(response?.data, routeId)) {
    throw new Error('The price-alert response does not match the documented contract.');
  }

  return response.data;
}

function getPriceAlerts(response, routeId) {
  if (
    !Array.isArray(response?.data)
    || !response.data.every((alert) => isPriceAlert(alert, routeId))
  ) {
    throw new Error('The price-alert list does not match the documented contract.');
  }

  return response.data;
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
  const freshness = getFreshnessBadge(context.freshness_status);

  document.querySelector('[data-field="product-brand"]').textContent = context.product.brand;
  document.querySelector('[data-field="product-name"]').textContent = context.product.display_name;
  document.querySelector('[data-field="product-variant"]').textContent = context.product.variant.display_name;
  document.querySelector('[data-product-id]').textContent = context.tracked_product_id;
  badges.replaceChildren(
    createBadge(freshness.label, freshness.modifier),
    createBadge(formatStatusLabel(context.tracking_status)),
    createBadge(context.source.retailer_name, 'badge--retailer'),
  );

  sourceLink.href = context.source.url;
  sourceLink.hidden = false;
  alertRegion.dataset.trackedProductId = context.tracked_product_id;
  compareLink.href = `/products/${encodeURIComponent(context.tracked_product_id)}/compare`;
}

function describeObservation(currentPrice) {
  return `Updated ${formatDateTime(currentPrice.observed_at)} at ${currentPrice.retailer_name}`;
}

function renderCurrentPrice(context) {
  const currentPrice = document.querySelector('[data-field="current-price"]');
  const observedAt = document.querySelector('[data-field="price-observed-at"]');

  if (context.current_price) {
    currentPrice.textContent = formatCurrency(
      context.current_price.amount,
      context.current_price.currency_code,
    );
    observedAt.textContent = describeObservation(context.current_price);
    return;
  }

  currentPrice.textContent = 'Price unavailable';
  observedAt.textContent = 'No in-stock current price is available.';
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

function renderAlertRegion(context) {
  const currentPrice = context.current_price;

  isAlertCreationBlocked = currentPrice === null;
  isSubmittingAlert = false;
  clearAlertFeedback();
  alertPriceNote.hidden = context.freshness_status !== 'STALE';

  if (currentPrice) {
    alertCurrentPrice.textContent = formatCurrency(
      currentPrice.amount,
      currentPrice.currency_code,
    );
    alertPriceNote.textContent = `Stale data. Last updated ${formatDateTime(currentPrice.observed_at)}; check the retailer before relying on this price.`;
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

function renderAlertItem(alert) {
  const fragment = alertItemTemplate.content.cloneNode(true);
  const status = fragment.querySelector('[data-field="alert-status"]');
  const toggle = fragment.querySelector('[data-field="alert-toggle"]');
  const isActive = alert.status === 'ACTIVE';

  fragment.querySelector('[data-field="alert-target-price"]').textContent = formatCurrency(
    alert.target_price,
    alert.currency_code,
  );
  fragment.querySelector('[data-field="alert-created-at"]').textContent = `Created ${formatDate(alert.created_at)}`;
  status.textContent = formatStatusLabel(alert.status);
  status.classList.toggle('badge--neutral', !isActive);
  toggle.textContent = isActive ? 'Deactivate' : 'Reactivate';
  toggle.dataset.priceAlertId = alert.price_alert_id;
  toggle.dataset.nextStatus = isActive ? 'INACTIVE' : 'ACTIVE';
  toggle.hidden = alert.status === 'EXPIRED';

  return fragment;
}

function renderAlertList() {
  const fragment = document.createDocumentFragment();

  priceAlerts.forEach((alert) => fragment.append(renderAlertItem(alert)));
  alertList.replaceChildren(fragment);
  alertListEmpty.hidden = priceAlerts.length > 0;
}

function renderHistory(history) {
  document.querySelector('#history-range').textContent = [
    `${history.range.from_date} to ${history.range.to_date}`,
    `${history.range.days} UTC calendar days`,
  ].join(' · ');
  chartRegion.replaceChildren();

  if (history.status === 'AVAILABLE') {
    chartRegion.className = 'chart-region chart-region--available';
    chartRegion.append(createHistoryChart(history));
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

function utcDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function createHistoryChart({ points, range, summary }) {
  const wrapper = document.createElement('div');
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  const title = document.createElementNS(SVG_NAMESPACE, 'title');
  const description = document.createElementNS(SVG_NAMESPACE, 'desc');
  const plot = document.createElementNS(SVG_NAMESPACE, 'polyline');
  const width = 800;
  const height = 280;
  const leftPadding = 76;
  const rightPadding = 24;
  const verticalPadding = 34;
  const numericAmounts = points.map((point) => Number(point.amount));
  const firstDay = utcDay(range.from_date);
  const daySpan = utcDay(range.to_date) - firstDay;
  const minimum = Math.min(...numericAmounts);
  const maximum = Math.max(...numericAmounts);
  const priceRange = maximum - minimum;
  const plotWidth = width - leftPadding - rightPadding;
  const plotHeight = height - verticalPadding * 2;
  const coordinates = points.map((point, index) => ({
    x: leftPadding + ((utcDay(point.date) - firstDay) / daySpan) * plotWidth,
    y: priceRange === 0
      ? height / 2
      : verticalPadding + ((maximum - numericAmounts[index]) / priceRange) * plotHeight,
    point,
  }));
  const gridValues = priceRange === 0
    ? [{ y: height / 2, value: minimum }]
    : [0, 1, 2, 3].map((index) => ({
        y: verticalPadding + (index / 3) * plotHeight,
        value: maximum - (index / 3) * priceRange,
      }));

  wrapper.className = 'history-chart';
  svg.classList.add('history-chart__svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'history-chart-title history-chart-description');
  title.id = 'history-chart-title';
  title.textContent = `Price history with ${points.length} daily points`;
  description.id = 'history-chart-description';
  description.textContent = `Daily prices from ${points[0].date} to ${points.at(-1).date} within ${range.from_date} to ${range.to_date}.`;
  svg.append(title, description);

  gridValues.forEach(({ y, value }) => {
    const line = document.createElementNS(SVG_NAMESPACE, 'line');
    const label = document.createElementNS(SVG_NAMESPACE, 'text');

    line.setAttribute('x1', leftPadding);
    line.setAttribute('x2', width - rightPadding);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.classList.add('history-chart__grid-line');
    label.setAttribute('x', leftPadding - 12);
    label.setAttribute('y', y);
    label.classList.add('history-chart__value');
    label.textContent = formatCompactNumber(value);
    svg.append(line, label);
  });

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
    markerTitle.textContent = `${point.date}: ${formatCurrency(point.amount, summary.currency_code)}`;
    marker.append(markerTitle);
    svg.append(marker);
  });

  const axis = document.createElement('div');
  const middleDate = new Date(firstDay + Math.round(daySpan / MILLISECONDS_PER_DAY / 2) * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  axis.className = 'history-chart__axis';
  [range.from_date, middleDate, range.to_date].forEach((date) => {
    const label = document.createElement('span');
    label.textContent = date;
    axis.append(label);
  });

  wrapper.append(svg, axis, createAccessibleHistoryTable(points, summary.currency_code));
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

function handleAlertRequestError(error) {
  const state = toErrorState(error);
  const knownErrors = {
    TARGET_PRICE_NOT_BELOW_CURRENT: {
      message: TARGET_NOT_BELOW_MESSAGE,
      guidance: 'Enter a lower target price and submit again.',
    },
    TARGET_PRICE_NOT_POSITIVE: {
      message: TARGET_NOT_POSITIVE_MESSAGE,
      guidance: 'Enter a target price greater than zero and submit again.',
    },
    ACTIVE_ALERT_LIMIT_REACHED: {
      message: ACTIVE_ALERT_LIMIT_MESSAGE,
      guidance: 'Deactivate an alert on this or another product to free a slot.',
    },
    DUPLICATE_ACTIVE_ALERT: {
      message: DUPLICATE_ALERT_MESSAGE,
      guidance: 'Choose a different target price or keep the existing alert below.',
    },
  };

  if (knownErrors[state.code]) {
    showAlertFeedback(knownErrors[state.code]);
    return;
  }

  if (state.code === 'CURRENT_PRICE_UNAVAILABLE') {
    isAlertCreationBlocked = true;
    alertCurrentPrice.textContent = 'Price unavailable';
    setAlertControlsState();
    showAlertFeedback({
      kind: 'warning',
      message: 'The current price is no longer available.',
      guidance: 'Try again later when a valid in-stock current price is available.',
    });
    return;
  }

  showAlertFeedback(state.isNetworkError
    ? {
        message: 'PriceLens could not reach the alert service.',
        guidance: 'Check your connection, then try again.',
      }
    : {
        message: 'PriceLens could not update your price alerts.',
        guidance: 'Review the target price and try again.',
      });
}

async function handleCreateAlert(event) {
  event.preventDefault();

  if (isSubmittingAlert || isAlertCreationBlocked) {
    return;
  }

  const targetPrice = parseTargetPrice(targetPriceInput.value);

  if (!targetPrice) {
    showAlertFeedback({
      message: targetPriceInput.value.trim()
        ? 'Enter the target price as a number.'
        : 'Enter a target price.',
      guidance: 'Use digits, for example 14000000 or 14,000,000.',
      focus: false,
    });
    targetPriceInput.focus();
    return;
  }

  isSubmittingAlert = true;
  clearAlertFeedback();
  setAlertControlsState();

  try {
    const encodedId = encodeURIComponent(trackedProductId);
    const response = await apiClient.post(
      `/tracked-products/${encodedId}/alerts`,
      { target_price: targetPrice },
    );
    const alert = getPriceAlert(response, trackedProductId);

    priceAlerts = [alert, ...priceAlerts];
    renderAlertList();
    targetPriceInput.value = '';
    showAlertFeedback({
      kind: 'success',
      message: 'Price alert created',
      guidance: `PriceLens will email you when the price reaches ${formatCurrency(alert.target_price, alert.currency_code)}.`,
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    handleAlertRequestError(error);
  } finally {
    isSubmittingAlert = false;
    setAlertControlsState();
  }
}

async function handleToggleAlert(button) {
  button.disabled = true;
  clearAlertFeedback();

  try {
    const response = await apiClient.patch(
      `/tracked-products/${encodeURIComponent(trackedProductId)}/alerts/${encodeURIComponent(button.dataset.priceAlertId)}`,
      { status: button.dataset.nextStatus },
    );
    const updated = getPriceAlert(response, trackedProductId);

    priceAlerts = priceAlerts.map((alert) => (
      alert.price_alert_id === updated.price_alert_id ? updated : alert
    ));
    renderAlertList();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
      return;
    }

    button.disabled = false;
    handleAlertRequestError(error);
  }
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
    const [productResponse, historyResponse, alertsResponse] = await Promise.all([
      apiClient.get(`/tracked-products/${encodedId}`),
      apiClient.get(`/tracked-products/${encodedId}/price-history`),
      apiClient.get(`/tracked-products/${encodedId}/alerts`),
    ]);

    if (attempt !== activeAttempt) {
      return;
    }

    const context = getProductContext(productResponse, trackedProductId);
    const history = getPriceHistory(historyResponse, trackedProductId);
    priceAlerts = getPriceAlerts(alertsResponse, trackedProductId);
    renderProductContext(context);
    renderCurrentPrice(context);
    renderHistory(history);
    renderAlertRegion(context);
    renderAlertList();
    showPageState('ready');
  } catch (error) {
    if (attempt !== activeAttempt) {
      return;
    }

    if (isAuthenticationRequiredError(error)) {
      redirectToSignIn();
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
alertList.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-field="alert-toggle"]');

  if (toggle) {
    void handleToggleAlert(toggle);
  }
});
targetPriceInput.addEventListener('input', () => {
  if (targetPriceInput.getAttribute('aria-invalid') === 'true') {
    clearAlertFeedback();
  }
});

void loadProductDetails();
