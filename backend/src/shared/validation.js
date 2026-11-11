import { invalidRequest } from './problems.js';

const DECIMAL_IDENTIFIER = /^\d+$/;
const DECIMAL_VALUE = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export function requireObject(value, options = {}) {
  const field = options.field ?? 'body';
  const detail = options.detail ?? 'The request body must be a JSON object.';

  if (value === null || value === undefined) {
    throw invalidRequest(detail, [{ field, reason: 'required' }]);
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalidRequest(detail, [{ field, reason: 'expected_object' }]);
  }

  return value;
}

export function requireString(object, field, options = {}) {
  const value = object?.[field];
  const detail = options.detail ?? `${field} must be a non-empty string.`;

  if (value === null || value === undefined) {
    throw invalidRequest(detail, [{ field, reason: 'required' }]);
  }

  if (typeof value !== 'string') {
    throw invalidRequest(detail, [{ field, reason: 'expected_string' }]);
  }

  const parsed = options.trim === false ? value : value.trim();

  if (parsed === '') {
    throw invalidRequest(detail, [{ field, reason: 'blank' }]);
  }

  return parsed;
}

export function optionalString(object, field, options = {}) {
  if (object?.[field] === undefined) {
    return undefined;
  }

  return requireString(object, field, options);
}

export function requireEnum(object, field, allowedValues, options = {}) {
  const value = requireString(object, field, options);

  if (!allowedValues.includes(value)) {
    const detail = options.detail ?? `${field} contains an unsupported value.`;
    throw invalidRequest(detail, [{ field, reason: 'unsupported_value' }]);
  }

  return value;
}

export function requireDecimalString(object, field, options = {}) {
  const value = requireString(object, field, { ...options, trim: true });

  if (!DECIMAL_VALUE.test(value)) {
    const detail = options.detail ?? `${field} must be a decimal string with at most two fractional digits.`;
    throw invalidRequest(detail, [{ field, reason: 'invalid_decimal' }]);
  }

  return value;
}

export function requireUrl(object, field, options = {}) {
  const value = requireString(object, field, options);

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol');
    }

    return value;
  } catch {
    const detail = options.detail ?? `${field} must be a valid HTTP or HTTPS URL.`;
    throw invalidRequest(detail, [{ field, reason: 'invalid_url' }]);
  }
}

export function parseIdentifier(value, field = 'id') {
  const detail = `${field} must be a positive decimal identifier.`;

  if (
    typeof value !== 'string'
    || !DECIMAL_IDENTIFIER.test(value)
    || BigInt(value) === 0n
    || BigInt(value) > POSTGRES_BIGINT_MAX
  ) {
    throw invalidRequest(detail, [{ field, reason: 'invalid_identifier' }]);
  }

  return value;
}
