import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpError } from '../../shared/problems.js';
import {
  insertOrFindPriceObservation,
  insertPendingNotification,
  isValidPositiveObservationAmount,
  lockActiveAlertsForEvaluation,
  lockOfferVariantContext,
  updateAlertEvaluation,
  updateOfferRefreshMetadata,
} from './price-observation.repository.js';
import { parsePriceObservationResult } from './price-observation.validation.js';

test('processor validation accepts documented success and failure acquisition shapes', () => {
  assert.deepEqual(parsePriceObservationResult({
    retailerOfferId: '9007199254740993',
    acquisitionStatus: 'SUCCEEDED',
    priceAmount: '13900000.25',
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: '2026-10-20T08:00:00Z',
  }), {
    retailerOfferId: '9007199254740993',
    acquisitionStatus: 'SUCCEEDED',
    priceAmount: '13900000.25',
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: '2026-10-20T08:00:00.000Z',
  });

  assert.deepEqual(parsePriceObservationResult({
    retailerOfferId: '41',
    acquisitionStatus: 'FAILED',
    observedAt: '2026-10-20T08:01:00.000Z',
    failureReason: 'Source timeout',
  }), {
    retailerOfferId: '41',
    acquisitionStatus: 'FAILED',
    observedAt: '2026-10-20T08:01:00.000Z',
    failureReason: 'Source timeout',
  });

  assert.equal(parsePriceObservationResult({
    retailerOfferId: '42',
    acquisitionStatus: 'SUCCEEDED',
    priceAmount: '14000000.00',
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: '2026-10-20T08:02:00.123Z',
  }).observedAt, '2026-10-20T08:02:00.123Z');
});

test('processor validation rejects malformed acquisition results before persistence', () => {
  for (const value of [
    undefined,
    null,
    [],
    {},
    { retailerOfferId: '0', acquisitionStatus: 'FAILED', observedAt: '2026-10-20T08:00:00Z', failureReason: 'x' },
    { retailerOfferId: '1', acquisitionStatus: 'UNKNOWN', observedAt: '2026-10-20T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'FAILED', observedAt: '2026-10-20T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'FAILED', observedAt: 'not-a-time', failureReason: 'x' },
    { retailerOfferId: '1', acquisitionStatus: 'SUCCEEDED', priceAmount: '1.234', currencyCode: 'VND', availabilityStatus: 'IN_STOCK', observedAt: '2026-10-20T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'SUCCEEDED', priceAmount: '1.00', currencyCode: 'vnd', availabilityStatus: 'IN_STOCK', observedAt: '2026-10-20T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'SUCCEEDED', priceAmount: '1.00', currencyCode: 'VND', availabilityStatus: 'AVAILABLE', observedAt: '2026-10-20T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'SUCCEEDED', priceAmount: '1.00', currencyCode: 'VND', availabilityStatus: 'IN_STOCK', observedAt: '2026-02-30T08:00:00Z' },
    { retailerOfferId: '1', acquisitionStatus: 'SUCCEEDED', priceAmount: '1.00', currencyCode: 'VND', availabilityStatus: 'IN_STOCK', observedAt: '2026-10-20T08:00:00Z', failureReason: 'not allowed' },
  ]) {
    assert.throws(
      () => parsePriceObservationResult(value),
      (error) => error instanceof HttpError
        && error.code === 'INVALID_REQUEST',
    );
  }
});

test('processor repository keeps identifiers, money and state mutations parameterized', async () => {
  const calls = [];
  const executeQuery = async (text, parameters) => {
    calls.push({ text, parameters });

    if (/FROM retailer_offers AS ro/.test(text)) {
      return { rows: [{ retailer_offer_id: '41', product_variant_id: '31', product_name: 'Laptop ABC' }] };
    }

    if (/is_valid_amount/.test(text)) {
      return { rows: [{ is_valid_amount: true }] };
    }

    if (/INSERT INTO price_observations/.test(text)) {
      return { rows: [{
        price_observation_id: '81',
        retailer_offer_id: '41',
        price_amount: '13900000.00',
        currency_code: 'VND',
        availability_status: 'IN_STOCK',
        observed_at: new Date('2026-10-20T08:00:00.000Z'),
      }] };
    }

    if (/UPDATE retailer_offers/.test(text)) {
      return { rows: [{ retailer_offer_id: '41' }] };
    }

    if (/FROM price_alerts AS pa/.test(text)) {
      return { rows: [{ price_alert_id: '71', previous_is_above: true, new_is_at_or_below: true }] };
    }

    if (/UPDATE price_alerts/.test(text)) {
      return { rows: [{ price_alert_id: '71' }] };
    }

    return { rows: [{ notification_id: '91' }] };
  };

  await lockOfferVariantContext('41', executeQuery);
  assert.equal(await isValidPositiveObservationAmount('13900000.00', executeQuery), true);
  await insertOrFindPriceObservation({
    retailerOfferId: '41',
    priceAmount: '13900000.00',
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt: '2026-10-20T08:00:00.000Z',
  }, executeQuery);
  await updateOfferRefreshMetadata({
    retailerOfferId: '41',
    observedAt: '2026-10-20T08:00:00.000Z',
    acquisitionStatus: 'SUCCEEDED',
  }, executeQuery);
  await lockActiveAlertsForEvaluation({
    productVariantId: '31',
    currencyCode: 'VND',
    previousCurrentPrice: '15000000.00',
    newCurrentPrice: '13900000.00',
  }, executeQuery);
  await updateAlertEvaluation({
    priceAlertId: '71',
    thresholdState: 'AT_OR_BELOW_TARGET',
    priceObservationId: '81',
    evaluatedAt: '2026-10-20T08:00:00.000Z',
  }, executeQuery);
  await insertPendingNotification({
    priceAlertId: '71',
    priceObservationId: '81',
    recipientEmail: 'shopper@example.test',
    subject: 'Price Drop Alert: Laptop ABC',
    qualifiedAt: '2026-10-20T08:00:00.000Z',
  }, executeQuery);

  assert.match(calls[0].text, /FOR UPDATE OF pv/);
  assert.deepEqual(calls[0].parameters, ['41']);
  assert.deepEqual(calls[2].parameters, [
    '41',
    '13900000.00',
    'VND',
    'IN_STOCK',
    '2026-10-20T08:00:00.000Z',
  ]);
  assert.match(calls[4].text, /pa\.status = 'ACTIVE'[\s\S]*FOR UPDATE OF pa/);
  assert.deepEqual(calls[4].parameters, [
    '31',
    'VND',
    '15000000.00',
    '13900000.00',
  ]);
  assert.deepEqual(calls[5].parameters, [
    '71',
    'AT_OR_BELOW_TARGET',
    '81',
    '2026-10-20T08:00:00.000Z',
  ]);
  assert.match(calls[6].text, /'PENDING'/);
  assert.match(calls[6].text, /ON CONFLICT \(price_alert_id, price_observation_id\) DO NOTHING/);
});
