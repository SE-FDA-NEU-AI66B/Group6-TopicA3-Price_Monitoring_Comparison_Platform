import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../../app.js';
import { config } from '../../config.js';
import { closePool, pool } from '../../db/pool.js';
import { assertProblemCode } from '../../test-support/assertions.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import {
  missingTrackedProductId,
  observationsByVariant,
  ownedAndUnownedTrackedProducts,
  P0_FIXTURE_KEYS,
  TEST_USERS,
  trackedProductByOwnerAndUrl,
} from '../../test-support/fixtures.js';
import {
  authenticatedRequest,
  loginAs,
  requestJson,
} from '../../test-support/request.js';
import { withTestServer } from '../../test-support/server.js';
import { findDailyPriceHistory } from './price-history.repository.js';

after(() => closePool());

test('API-02 returns PostgreSQL-backed 30/1/0 states and protects ownership', {
  timeout: 60_000,
}, async (context) => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  context.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-10-20T12:00:00.000Z'),
  });

  const full = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us02.fullHistory.sourceUrl,
  });
  const single = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us02.singleObservationUrl,
  });
  const none = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us02.noObservationUrl,
  });
  const { unowned } = await ownedAndUnownedTrackedProducts();
  const missingId = await missingTrackedProductId();
  const databaseRows = await observationsByVariant(
    P0_FIXTURE_KEYS.us02.fullHistory,
    { expectedCount: 30 },
  );

  assert.ok(databaseRows.every((row) => row.availability_status === 'IN_STOCK'));

  await withTestServer(app, async ({ baseUrl }) => {
    const guest = await requestJson(
      baseUrl,
      `/api/tracked-products/${full.tracked_product_id}/price-history`,
    );
    assertProblemCode(guest, 'AUTHENTICATION_REQUIRED', { status: 401 });

    const session = await loginAs(baseUrl, TEST_USERS.demo);
    const available = await authenticatedRequest(
      session,
      `/api/tracked-products/${full.tracked_product_id}/price-history`,
    );

    assert.equal(available.status, 200);
    assert.match(available.headers.get('content-type') ?? '', /^application\/json/);
    assertCompletePriceHistoryContract(
      available.body.data,
      full.tracked_product_id,
    );
    assert.equal(available.body.data.tracked_product_id, full.tracked_product_id);
    assert.deepEqual(available.body.data.range, {
      days: 30,
      from_date: '2026-09-20',
      to_date: '2026-10-19',
      timezone: 'UTC',
    });
    assert.equal(available.body.data.status, 'AVAILABLE');
    assert.equal(available.body.data.message, null);
    assert.equal(available.body.data.points.length, 30);
    assert.deepEqual(
      available.body.data.points,
      databaseRows.map((row) => ({
        date: row.observed_at.toISOString().slice(0, 10),
        amount: row.price_amount,
      })),
    );
    assert.ok(available.body.data.points.every(
      (point, index, points) => index === 0 || points[index - 1].date < point.date,
    ));
    const databaseAmounts = databaseRows.map((row) => row.price_amount);
    const databaseMinimum = databaseAmounts.reduce((minimum, amount) => (
      decimalMinorUnits(amount) < decimalMinorUnits(minimum) ? amount : minimum
    ));
    const databaseMaximum = databaseAmounts.reduce((maximum, amount) => (
      decimalMinorUnits(amount) > decimalMinorUnits(maximum) ? amount : maximum
    ));
    const databaseCurrent = databaseRows.at(-1).price_amount;

    assert.deepEqual(available.body.data.summary, {
      minimum: databaseMinimum,
      maximum: databaseMaximum,
      current: databaseCurrent,
      currency_code: 'VND',
    });
    assert.ok(available.body.data.points.every(
      (point) => typeof point.amount === 'string' && /^\d+\.\d{2}$/.test(point.amount),
    ));

    const insufficient = await authenticatedRequest(
      session,
      `/api/tracked-products/${single.tracked_product_id}/price-history`,
    );
    assert.equal(insufficient.status, 200);
    assertCompletePriceHistoryContract(
      insufficient.body.data,
      single.tracked_product_id,
    );
    assert.equal(insufficient.body.data.tracked_product_id, single.tracked_product_id);
    assert.equal(insufficient.body.data.status, 'INSUFFICIENT_DATA');
    assert.equal(
      insufficient.body.data.message,
      'Insufficient data for a 30-day chart',
    );
    assert.equal(insufficient.body.data.points.length, 1);
    assert.deepEqual(insufficient.body.data.summary, {
      minimum: '3990000.00',
      maximum: '3990000.00',
      current: '3990000.00',
      currency_code: 'VND',
    });

    const noHistory = await authenticatedRequest(
      session,
      `/api/tracked-products/${none.tracked_product_id}/price-history`,
    );
    assert.equal(noHistory.status, 200);
    assertCompletePriceHistoryContract(
      noHistory.body.data,
      none.tracked_product_id,
    );
    assert.equal(noHistory.body.data.tracked_product_id, none.tracked_product_id);
    assert.equal(noHistory.body.data.status, 'NO_HISTORY');
    assert.equal(noHistory.body.data.message, 'No price history available');
    assert.deepEqual(noHistory.body.data.points, []);
    assert.equal(noHistory.body.data.summary, null);

    for (const id of [unowned.tracked_product_id, missingId]) {
      const hidden = await authenticatedRequest(
        session,
        `/api/tracked-products/${id}/price-history`,
      );
      assertProblemCode(hidden, 'TRACKED_PRODUCT_NOT_FOUND', {
        status: 404,
        detail: 'Tracked product not found',
      });
    }

    const malformed = await authenticatedRequest(
      session,
      '/api/tracked-products/not-a-bigint/price-history',
    );
    assertProblemCode(malformed, 'INVALID_REQUEST', {
      status: 400,
      detail: 'tracked_product_id must be a positive decimal identifier.',
    });
  });
});

test('daily SQL uses the lowest valid same-currency value and excludes both UTC boundaries', {
  timeout: 60_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  const tracked = await trackedProductByOwnerAndUrl({
    email: TEST_USERS.demo.email,
    normalizedUrl: P0_FIXTURE_KEYS.us02.fullHistory.sourceUrl,
  });
  const client = await pool.connect();

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
         ($1, '10000000.00', 'VND', 'IN_STOCK', '2026-10-10T12:00:00Z'),
         ($1, '1.00', 'VND', 'IN_STOCK', '2026-09-19T23:59:59.999Z'),
         ($1, '2.00', 'VND', 'IN_STOCK', '2026-10-20T00:00:00Z'),
         ($1, '3.00', 'USD', 'IN_STOCK', '2026-10-10T13:00:00Z'),
         ($1, '4.00', 'VND', 'OUT_OF_STOCK', '2026-10-10T14:00:00Z')`,
      [tracked.retailer_offer_id],
    );

    const rows = await findDailyPriceHistory({
      productVariantId: tracked.product_variant_id,
      currencyCode: 'VND',
      fromInclusive: '2026-09-20T00:00:00.000Z',
      toExclusive: '2026-10-20T00:00:00.000Z',
    }, (text, parameters) => client.query(text, parameters));

    assert.equal(rows.length, 30);
    assert.equal(
      rows.find((row) => row.observed_date === '2026-10-10').price_amount,
      '10000000.00',
    );
    assert.equal(rows[0].observed_date, '2026-09-20');
    assert.equal(rows.at(-1).observed_date, '2026-10-19');
    assert.equal(rows[0].minimum_price, '10000000.00');
    assert.equal(rows[0].maximum_price, '23990000.00');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

function decimalMinorUnits(value) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(2, '0')}`);
}

function assertCompletePriceHistoryContract(data, trackedProductId) {
  assert.deepEqual(Object.keys(data).sort(), [
    'message',
    'points',
    'range',
    'status',
    'summary',
    'tracked_product_id',
  ]);
  assert.equal(data.tracked_product_id, trackedProductId);
  assert.deepEqual(data.range, {
    days: 30,
    from_date: '2026-09-20',
    to_date: '2026-10-19',
    timezone: 'UTC',
  });
  assert.equal(typeof data.status, 'string');
  assert.ok(data.message === null || typeof data.message === 'string');
  assert.ok(Array.isArray(data.points));
  assert.ok(data.summary === null || typeof data.summary === 'object');
}
