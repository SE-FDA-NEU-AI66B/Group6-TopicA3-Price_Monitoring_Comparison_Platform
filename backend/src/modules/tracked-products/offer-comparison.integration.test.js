import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../../app.js';
import { config } from '../../config.js';
import { closePool, pool } from '../../db/pool.js';
import { assertProblemCode } from '../../test-support/assertions.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import {
  missingTrackedProductId,
  offersByVariant,
  ownedAndUnownedTrackedProducts,
  P0_FIXTURE_KEYS,
  TEST_USERS,
  trackedProductByOwnerAndUrl,
  variantByNaturalKey,
} from '../../test-support/fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../../test-support/request.js';
import { withTestServer } from '../../test-support/server.js';
import { findEligibleComparisonOffers } from './offer-comparison.repository.js';

after(() => closePool());

test('API-06 returns exact-variant comparison states and protects ownership', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  const exactOffers = await offersByVariant(P0_FIXTURE_KEYS.us09.exactVariant, {
    expectedCount: 3,
  });
  const mismatchedOffers = await offersByVariant(
    P0_FIXTURE_KEYS.us09.mismatchedVariant,
    { expectedCount: 1 },
  );
  const availableTracked = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us04.duplicateUrl,
  });
  const singleOffer = await offersByVariant(
    P0_FIXTURE_KEYS.us09.singleOfferVariant,
    { expectedCount: 1 },
  );
  const singleTracked = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: singleOffer[0].normalized_url,
  });
  const zeroAvailableOffers = await offersByVariant(
    P0_FIXTURE_KEYS.us09.zeroAvailableVariant,
    { expectedCount: 1 },
  );
  const zeroTracked = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: zeroAvailableOffers[0].normalized_url,
  });
  const { unowned } = await ownedAndUnownedTrackedProducts();
  const missingId = await missingTrackedProductId();

  await withTestServer(app, async ({ baseUrl }) => {
    const guest = await requestJson(
      baseUrl,
      `/api/tracked-products/${availableTracked.tracked_product_id}/offers`,
    );
    assertProblemCode(guest, 'AUTHENTICATION_REQUIRED', { status: 401 });

    const session = await loginAs(baseUrl, TEST_USERS.demo);
    const available = await authenticatedRequest(
      session,
      `/api/tracked-products/${availableTracked.tracked_product_id}/offers`,
    );

    assert.equal(available.status, 200);
    assert.match(available.headers.get('content-type') ?? '', /^application\/json/);
    assertCompleteComparisonContract(
      available.body.data,
      availableTracked.tracked_product_id,
    );
    assert.equal(available.body.data.status, 'AVAILABLE');
    assert.equal(available.body.data.message, null);

    const eligibleDatabaseOffers = exactOffers
      .filter((offer) => (
        offer.latest_availability_status === 'IN_STOCK'
        && offer.latest_currency_code === 'VND'
      ))
      .sort((left, right) => (
        decimalMinorUnits(left.latest_price_amount)
          - decimalMinorUnits(right.latest_price_amount) < 0n
          ? -1
          : decimalMinorUnits(left.latest_price_amount)
            - decimalMinorUnits(right.latest_price_amount) > 0n
            ? 1
            : left.source_code.localeCompare(right.source_code)
      ));
    const lowestMinorUnits = decimalMinorUnits(
      eligibleDatabaseOffers[0].latest_price_amount,
    );

    assert.deepEqual(
      available.body.data.offers.map((offer) => ({
        retailer_offer_id: offer.retailer_offer_id,
        source_code: offer.retailer.source_code,
        amount: offer.amount,
        availability_status: offer.availability_status,
        difference_from_lowest: offer.difference_from_lowest,
      })),
      eligibleDatabaseOffers.map((offer) => ({
        retailer_offer_id: offer.retailer_offer_id,
        source_code: offer.source_code,
        amount: offer.latest_price_amount,
        availability_status: 'IN_STOCK',
        difference_from_lowest: minorUnitsString(
          decimalMinorUnits(offer.latest_price_amount) - lowestMinorUnits,
        ),
      })),
    );
    assert.deepEqual(
      available.body.data.lowest_offer,
      available.body.data.offers[0],
    );

    const excludedIds = new Set([
      ...exactOffers
        .filter((offer) => offer.latest_availability_status === 'OUT_OF_STOCK')
        .map((offer) => offer.retailer_offer_id),
      ...mismatchedOffers.map((offer) => offer.retailer_offer_id),
    ]);
    assert.ok(available.body.data.offers.every(
      (offer) => !excludedIds.has(offer.retailer_offer_id),
    ));
    assert.ok(available.body.data.offers.every(
      (offer) => offer.availability_status === 'IN_STOCK',
    ));

    const ignoredVariantOverride = await authenticatedRequest(
      session,
      `/api/tracked-products/${availableTracked.tracked_product_id}/offers?variant_id=${mismatchedOffers[0].product_variant_id}`,
    );
    assert.equal(ignoredVariantOverride.status, 200);
    assert.deepEqual(ignoredVariantOverride.body.data, available.body.data);

    const single = await authenticatedRequest(
      session,
      `/api/tracked-products/${singleTracked.tracked_product_id}/offers`,
    );
    assert.equal(single.status, 200);
    assertCompleteComparisonContract(single.body.data, singleTracked.tracked_product_id);
    assert.equal(single.body.data.status, 'SINGLE_OFFER');
    assert.equal(
      single.body.data.message,
      'No multi-source comparison is currently available',
    );
    assert.equal(single.body.data.offers.length, 1);
    assert.equal(single.body.data.offers[0].difference_from_lowest, '0.00');
    assert.deepEqual(single.body.data.lowest_offer, single.body.data.offers[0]);

    const none = await authenticatedRequest(
      session,
      `/api/tracked-products/${zeroTracked.tracked_product_id}/offers`,
    );
    assert.equal(none.status, 200);
    assertCompleteComparisonContract(none.body.data, zeroTracked.tracked_product_id);
    assert.equal(none.body.data.status, 'NO_AVAILABLE_OFFERS');
    assert.equal(none.body.data.message, null);
    assert.deepEqual(none.body.data.offers, []);
    assert.equal(none.body.data.lowest_offer, null);

    for (const id of [unowned.tracked_product_id, missingId]) {
      const hidden = await authenticatedRequest(
        session,
        `/api/tracked-products/${id}/offers`,
      );
      assertProblemCode(hidden, 'TRACKED_PRODUCT_NOT_FOUND', {
        status: 404,
        detail: 'Tracked product not found',
      });
    }

    const malformed = await authenticatedRequest(
      session,
      '/api/tracked-products/not-a-bigint/offers',
    );
    assertProblemCode(malformed, 'INVALID_REQUEST', {
      status: 400,
      detail: 'tracked_product_id must be a positive decimal identifier.',
    });
  });
});

test('comparison SQL uses latest-per-offer state, exact decimals and retailer-name tie-break', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  const variant = await variantByNaturalKey(P0_FIXTURE_KEYS.us09.exactVariant);
  const offers = await offersByVariant(P0_FIXTURE_KEYS.us09.exactVariant, {
    expectedCount: 3,
  });
  const bySource = Object.fromEntries(
    offers.map((offer) => [offer.source_code, offer]),
  );
  const client = await pool.connect();
  const executeQuery = (text, parameters) => client.query(text, parameters);

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO price_observations (
         retailer_offer_id,
         price_amount,
         currency_code,
         availability_status,
         observed_at
       )
       VALUES
         ($1, '18000000.00', 'VND', 'IN_STOCK', '2026-10-11T08:00:00Z'),
         ($1, '18900000.00', 'VND', 'IN_STOCK', '2026-10-12T08:00:00Z'),
         ($2, '18500000.00', 'VND', 'IN_STOCK', '2026-10-12T08:00:00Z'),
         ($3, '17000000.00', 'VND', 'IN_STOCK', '2026-10-11T08:00:00Z'),
         ($3, '16000000.00', 'VND', 'OUT_OF_STOCK', '2026-10-12T08:00:00Z')`,
      [
        bySource.TECHMART.retailer_offer_id,
        bySource.DIGITAL_HUB.retailer_offer_id,
        bySource.GADGET_WORLD.retailer_offer_id,
      ],
    );

    const currentRows = await findEligibleComparisonOffers({
      productVariantId: variant.product_variant_id,
      currencyCode: 'VND',
    }, executeQuery);

    assert.deepEqual(
      currentRows.map((row) => ({
        source_code: row.source_code,
        amount: row.price_amount,
        difference: row.difference_from_lowest,
      })),
      [
        { source_code: 'DIGITAL_HUB', amount: '18500000.00', difference: '0.00' },
        { source_code: 'TECHMART', amount: '18900000.00', difference: '400000.00' },
      ],
    );
    assert.ok(currentRows.every((row) => row.source_code !== 'GADGET_WORLD'));

    await client.query(
      `INSERT INTO price_observations (
         retailer_offer_id,
         price_amount,
         currency_code,
         availability_status,
         observed_at
       )
       VALUES
         ($1, '18500000.00', 'VND', 'IN_STOCK', '2026-10-13T08:00:00Z'),
         ($2, '18500000.00', 'VND', 'IN_STOCK', '2026-10-13T08:00:00Z')`,
      [
        bySource.TECHMART.retailer_offer_id,
        bySource.DIGITAL_HUB.retailer_offer_id,
      ],
    );
    const tiedRows = await findEligibleComparisonOffers({
      productVariantId: variant.product_variant_id,
      currencyCode: 'VND',
    }, executeQuery);
    assert.deepEqual(
      tiedRows.map((row) => row.retailer_name),
      ['Digital Hub', 'TechMart'],
    );
    assert.ok(tiedRows.every((row) => row.difference_from_lowest === '0.00'));

    await client.query(
      `INSERT INTO price_observations (
         retailer_offer_id,
         price_amount,
         currency_code,
         availability_status,
         observed_at
       )
       VALUES ($1, '1.00', 'USD', 'IN_STOCK', '2026-10-14T08:00:00Z')`,
      [bySource.DIGITAL_HUB.retailer_offer_id],
    );
    const sameCurrencyRows = await findEligibleComparisonOffers({
      productVariantId: variant.product_variant_id,
      currencyCode: 'VND',
    }, executeQuery);
    assert.deepEqual(
      sameCurrencyRows.map((row) => row.source_code),
      ['TECHMART'],
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

function assertCompleteComparisonContract(data, trackedProductId) {
  assert.deepEqual(Object.keys(data).sort(), [
    'lowest_offer',
    'message',
    'offers',
    'product',
    'status',
    'tracked_product_id',
  ]);
  assert.equal(data.tracked_product_id, trackedProductId);
  assert.equal(typeof data.product.product_id, 'string');
  assert.equal(typeof data.product.variant.product_variant_id, 'string');
  assert.ok(Array.isArray(data.offers));
  for (const offer of data.offers) {
    assert.deepEqual(Object.keys(offer).sort(), [
      'amount',
      'availability_status',
      'currency_code',
      'difference_from_lowest',
      'observed_at',
      'retailer',
      'retailer_offer_id',
      'url',
    ]);
    assert.equal(typeof offer.retailer_offer_id, 'string');
    assert.match(offer.amount, /^\d+\.\d{2}$/);
    assert.match(offer.difference_from_lowest, /^\d+\.\d{2}$/);
    assert.equal(offer.currency_code, 'VND');
    assert.equal(offer.availability_status, 'IN_STOCK');
    assert.match(offer.observed_at, /Z$/);
    assert.match(offer.url, /^https:\/\//);
  }
}

function decimalMinorUnits(value) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`);
}

function minorUnitsString(value) {
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value).toString().padStart(3, '0');
  return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
