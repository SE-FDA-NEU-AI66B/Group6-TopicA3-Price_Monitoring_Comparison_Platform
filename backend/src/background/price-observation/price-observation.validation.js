import { invalidRequest } from '../../shared/problems.js';
import {
  parseIdentifier,
  requireDecimalString,
  requireEnum,
  requireObject,
  requireString,
} from '../../shared/validation.js';

const ACQUISITION_STATUSES = Object.freeze(['SUCCEEDED', 'FAILED']);
const AVAILABILITY_STATUSES = Object.freeze(['IN_STOCK', 'OUT_OF_STOCK']);
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function parsePriceObservationResult(value) {
  const result = requireObject(value, {
    field: 'acquisitionResult',
    detail: 'The acquisition result must be an object.',
  });
  const retailerOfferId = parseIdentifier(
    result.retailerOfferId,
    'retailerOfferId',
  );
  const acquisitionStatus = requireEnum(
    result,
    'acquisitionStatus',
    ACQUISITION_STATUSES,
  );
  const observedAt = parseObservedAt(result);

  if (acquisitionStatus === 'FAILED') {
    return Object.freeze({
      retailerOfferId,
      acquisitionStatus,
      observedAt,
      failureReason: requireString(result, 'failureReason'),
    });
  }

  if (result.failureReason !== undefined) {
    throw invalidRequest(
      'A successful acquisition result cannot contain failureReason.',
      [{ field: 'failureReason', reason: 'not_allowed' }],
    );
  }

  const currencyCode = requireString(result, 'currencyCode');

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw invalidRequest(
      'currencyCode must be an uppercase three-letter code.',
      [{ field: 'currencyCode', reason: 'invalid_currency_code' }],
    );
  }

  return Object.freeze({
    retailerOfferId,
    acquisitionStatus,
    priceAmount: requireDecimalString(result, 'priceAmount'),
    currencyCode,
    availabilityStatus: requireEnum(
      result,
      'availabilityStatus',
      AVAILABILITY_STATUSES,
    ),
    observedAt,
  });
}

function parseObservedAt(result) {
  const value = requireString(result, 'observedAt');

  if (!UTC_TIMESTAMP.test(value)) {
    throw invalidObservedAt();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw invalidObservedAt();
  }

  const normalized = date.toISOString();
  const equivalentInput = /\.\d{3}Z$/.test(value)
    ? value
    : value.replace(/Z$/, '.000Z');

  if (normalized !== equivalentInput) {
    throw invalidObservedAt();
  }

  return normalized;
}

function invalidObservedAt() {
  return invalidRequest(
    'observedAt must be a valid ISO 8601 UTC timestamp.',
    [{ field: 'observedAt', reason: 'invalid_timestamp' }],
  );
}
