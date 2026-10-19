const PROBLEM_DEFINITIONS = Object.freeze({
  INVALID_REQUEST: Object.freeze({
    status: 400,
    type: '/problems/invalid-request',
    title: 'Invalid request',
    detail: 'The request is invalid.',
  }),
  INVALID_CREDENTIALS: Object.freeze({
    status: 401,
    type: '/problems/invalid-credentials',
    title: 'Invalid credentials',
    detail: 'Invalid email or password',
  }),
  AUTHENTICATION_REQUIRED: Object.freeze({
    status: 401,
    type: '/problems/authentication-required',
    title: 'Authentication required',
    detail: 'Authentication is required',
  }),
  TRACKED_PRODUCT_NOT_FOUND: Object.freeze({
    status: 404,
    type: '/problems/tracked-product-not-found',
    title: 'Tracked product not found',
    detail: 'Tracked product not found',
  }),
  RETAILER_OFFER_NOT_FOUND: Object.freeze({
    status: 404,
    type: '/problems/retailer-offer-not-found',
    title: 'Retailer offer not found',
    detail: 'The resolved offer is missing, inactive or no longer selectable.',
  }),
  DUPLICATE_TRACKED_URL: Object.freeze({
    status: 409,
    type: '/problems/duplicate-tracked-url',
    title: 'Duplicate tracked product',
    detail: 'This product URL is already being tracked',
  }),
  CURRENT_PRICE_UNAVAILABLE: Object.freeze({
    status: 409,
    type: '/problems/current-price-unavailable',
    title: 'Current price unavailable',
    detail: 'No valid in-stock current price exists, so BR2 cannot be evaluated.',
  }),
  ACTIVE_ALERT_LIMIT_REACHED: Object.freeze({
    status: 409,
    type: '/problems/active-alert-limit-reached',
    title: 'Active alert limit reached',
    detail: 'Maximum 20 active alerts reached',
  }),
  INVALID_PRODUCT_URL: Object.freeze({
    status: 422,
    type: '/problems/invalid-product-url',
    title: 'Invalid product URL',
    detail: 'Unsupported or invalid product URL',
  }),
  TARGET_PRICE_NOT_POSITIVE: Object.freeze({
    status: 422,
    type: '/problems/target-price-not-positive',
    title: 'Invalid target price',
    detail: 'Target price must be greater than 0',
  }),
  TARGET_PRICE_NOT_BELOW_CURRENT: Object.freeze({
    status: 422,
    type: '/problems/target-price-not-below-current',
    title: 'Invalid target price',
    detail: 'Target price must be lower than the current price',
  }),
  INTERNAL_SERVER_ERROR: Object.freeze({
    status: 500,
    type: '/problems/internal-server-error',
    title: 'Internal server error',
    detail: 'An unexpected server failure occurred.',
  }),
  SOURCE_UNAVAILABLE: Object.freeze({
    status: 503,
    type: '/problems/source-unavailable',
    title: 'Product source unavailable',
    detail: 'The supported source could not be resolved at that time; no tracking record is created.',
  }),
});

export class HttpError extends Error {
  constructor({ status, code, type, title, detail, errors, cause }) {
    super(detail, cause === undefined ? undefined : { cause });
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.type = type;
    this.title = title;
    this.detail = detail;
    this.errors = normalizeFieldErrors(errors);
  }
}

export function problem(code, options = {}) {
  const definition = PROBLEM_DEFINITIONS[code];

  if (!definition) {
    throw new TypeError(`Unknown PriceLens problem code: ${code}`);
  }

  return new HttpError({
    ...definition,
    code,
    detail: options.detail ?? definition.detail,
    errors: options.errors,
    cause: options.cause,
  });
}

export function invalidRequest(detail, errors) {
  return problem('INVALID_REQUEST', { detail, errors });
}

export function invalidCredentials() {
  return problem('INVALID_CREDENTIALS');
}

export function authenticationRequired() {
  return problem('AUTHENTICATION_REQUIRED');
}

export function trackedProductNotFound() {
  return problem('TRACKED_PRODUCT_NOT_FOUND');
}

export function retailerOfferNotFound() {
  return problem('RETAILER_OFFER_NOT_FOUND');
}

export function duplicateTrackedUrl(cause) {
  return problem('DUPLICATE_TRACKED_URL', { cause });
}

export function currentPriceUnavailable() {
  return problem('CURRENT_PRICE_UNAVAILABLE');
}

export function activeAlertLimitReached() {
  return problem('ACTIVE_ALERT_LIMIT_REACHED');
}

export function invalidProductUrl(errors) {
  return problem('INVALID_PRODUCT_URL', { errors });
}

export function targetPriceNotPositive(errors) {
  return problem('TARGET_PRICE_NOT_POSITIVE', { errors });
}

export function targetPriceNotBelowCurrent(errors) {
  return problem('TARGET_PRICE_NOT_BELOW_CURRENT', { errors });
}

export function sourceUnavailable(cause) {
  return problem('SOURCE_UNAVAILABLE', { cause });
}

export function internalServerError(cause) {
  return problem('INTERNAL_SERVER_ERROR', { cause });
}

export function translatePersistenceError(error) {
  if (
    error?.code === '23505'
    && error.constraint === 'uq_tracked_products_user_source_url'
  ) {
    return duplicateTrackedUrl(error);
  }

  return internalServerError(error);
}

function normalizeFieldErrors(errors) {
  if (errors === undefined) {
    return undefined;
  }

  if (!Array.isArray(errors)) {
    throw new TypeError('Problem field errors must be an array.');
  }

  return Object.freeze(errors.map((error) => {
    if (
      typeof error?.field !== 'string'
      || error.field === ''
      || typeof error.reason !== 'string'
      || error.reason === ''
    ) {
      throw new TypeError('Each problem field error requires field and reason strings.');
    }

    return Object.freeze({ field: error.field, reason: error.reason });
  }));
}
