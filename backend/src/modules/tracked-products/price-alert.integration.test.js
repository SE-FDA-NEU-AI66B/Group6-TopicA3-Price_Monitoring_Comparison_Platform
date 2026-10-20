import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { app } from '../../app.js';
import { config } from '../../config.js';
import { closePool, query } from '../../db/pool.js';
import { assertProblemCode } from '../../test-support/assertions.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import {
  missingTrackedProductId,
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
import {
  findCurrentPrice,
  findPriceHistoryCurrency,
} from './price-history.repository.js';

after(() => closePool());

test('API-05 creates alerts, enforces BR1/BR2 and serializes the 19-to-20 race', {
  timeout: 90_000,
}, async () => {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  try {
    const validTracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: P0_FIXTURE_KEYS.us03.currentPriceUrl,
    });
    const noCurrentTracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: P0_FIXTURE_KEYS.us02.noObservationUrl,
    });
    const boundaryTracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.alertBoundary.email,
      normalizedUrl: P0_FIXTURE_KEYS.us03.boundaryUrl,
    });
    const { unowned } = await ownedAndUnownedTrackedProducts();
    const missingId = await missingTrackedProductId();
    const currencyCode = await findPriceHistoryCurrency(
      validTracked.retailer_offer_id,
    );
    const supportingPrice = await findCurrentPrice({
      productVariantId: validTracked.product_variant_id,
      currencyCode,
    });

    assert.deepEqual({
      amount: supportingPrice.price_amount,
      currency: supportingPrice.currency_code,
    }, {
      amount: '34990000.00',
      currency: 'VND',
    });

    const notificationBaseline = await notificationCount();

    await withTestServer(app, async ({ baseUrl }) => {
      const endpoint = `/api/tracked-products/${validTracked.tracked_product_id}/alerts`;
      const guest = await assertRejectedWithoutPersistence(
        () => requestJson(baseUrl, endpoint, {
          method: 'POST',
          json: { target_price: '30000000.10' },
        }),
        'AUTHENTICATION_REQUIRED',
        { status: 401, detail: 'Authentication is required' },
      );
      assert.equal(guest.body.code, 'AUTHENTICATION_REQUIRED');

      const demoSession = await loginAs(baseUrl, TEST_USERS.demo);
      const boundarySession = await loginAs(baseUrl, TEST_USERS.alertBoundary);
      const beforeValidTrackedCount = await alertCountForTrackedProduct(
        validTracked.tracked_product_id,
      );
      const valid = await authenticatedRequest(demoSession, endpoint, {
        method: 'POST',
        json: { target_price: '30000000.10' },
      });

      assert.equal(valid.status, 201);
      assert.match(valid.headers.get('content-type') ?? '', /^application\/json/);
      assert.deepEqual(Object.keys(valid.body.data).sort(), [
        'created_at',
        'currency_code',
        'current_price',
        'price_alert_id',
        'status',
        'target_price',
        'tracked_product_id',
      ]);
      assert.deepEqual({
        tracked_product_id: valid.body.data.tracked_product_id,
        target_price: valid.body.data.target_price,
        currency_code: valid.body.data.currency_code,
        status: valid.body.data.status,
        current_price: valid.body.data.current_price,
      }, {
        tracked_product_id: validTracked.tracked_product_id,
        target_price: '30000000.10',
        currency_code: 'VND',
        status: 'ACTIVE',
        current_price: '34990000.00',
      });
      assert.match(valid.body.data.price_alert_id, /^\d+$/);
      assert.equal(
        new Date(valid.body.data.created_at).toISOString(),
        valid.body.data.created_at,
      );
      assert.equal(
        await alertCountForTrackedProduct(validTracked.tracked_product_id),
        beforeValidTrackedCount + 1,
      );

      const stored = await alertById(valid.body.data.price_alert_id);
      assert.deepEqual({
        tracked_product_id: stored.tracked_product_id,
        target_price: stored.target_price,
        currency_code: stored.currency_code,
        status: stored.status,
        last_threshold_state: stored.last_threshold_state,
        price_observation_id: stored.price_observation_id,
      }, {
        tracked_product_id: validTracked.tracked_product_id,
        target_price: '30000000.10',
        currency_code: 'VND',
        status: 'ACTIVE',
        last_threshold_state: 'ABOVE_TARGET',
        price_observation_id: supportingPrice.price_observation_id,
      });
      assert.ok(stored.created_at instanceof Date);
      assert.ok(stored.last_evaluated_at instanceof Date);
      assert.equal(await notificationCount(), notificationBaseline);

      for (const targetPrice of ['0', '-1.25']) {
        await assertRejectedWithoutPersistence(
          () => authenticatedRequest(demoSession, endpoint, {
            method: 'POST',
            json: { target_price: targetPrice },
          }),
          'TARGET_PRICE_NOT_POSITIVE',
          {
            status: 422,
            detail: 'Target price must be greater than 0',
          },
        );
      }

      for (const targetPrice of ['34990000.00', '35000000.00']) {
        await assertRejectedWithoutPersistence(
          () => authenticatedRequest(demoSession, endpoint, {
            method: 'POST',
            json: { target_price: targetPrice },
          }),
          'TARGET_PRICE_NOT_BELOW_CURRENT',
          {
            status: 422,
            detail: 'Target price must be lower than the current price',
          },
        );
      }

      const noCurrentEndpoint = `/api/tracked-products/${noCurrentTracked.tracked_product_id}/alerts`;
      await assertRejectedWithoutPersistence(
        () => authenticatedRequest(demoSession, noCurrentEndpoint, {
          method: 'POST',
          json: { target_price: '1.00' },
        }),
        'CURRENT_PRICE_UNAVAILABLE',
        {
          status: 409,
          detail: 'No valid in-stock current price exists, so BR2 cannot be evaluated.',
        },
      );

      for (const id of [unowned.tracked_product_id, missingId]) {
        await assertRejectedWithoutPersistence(
          () => authenticatedRequest(
            demoSession,
            `/api/tracked-products/${id}/alerts`,
            {
              method: 'POST',
              json: { target_price: '1.00' },
            },
          ),
          'TRACKED_PRODUCT_NOT_FOUND',
          { status: 404, detail: 'Tracked product not found' },
        );
      }

      await assertRejectedWithoutPersistence(
        () => authenticatedRequest(
          demoSession,
          '/api/tracked-products/not-a-bigint/alerts',
          {
            method: 'POST',
            json: { target_price: '1.00' },
          },
        ),
        'INVALID_REQUEST',
        {
          status: 400,
          detail: 'tracked_product_id must be a positive decimal identifier.',
        },
      );

      const malformedBodies = [
        undefined,
        {},
        { target_price: null },
        { target_price: true },
        { target_price: {} },
        { target_price: [] },
        { target_price: 'abc' },
        { target_price: '' },
        { target_price: '1,000' },
        { target_price: '1.234' },
      ];

      for (const body of malformedBodies) {
        await assertRejectedWithoutPersistence(
          () => authenticatedRequest(demoSession, endpoint, {
            method: 'POST',
            ...(body === undefined ? {} : { json: body }),
          }),
          'INVALID_REQUEST',
          { status: 400 },
        );
      }

      const boundaryEndpoint = `/api/tracked-products/${boundaryTracked.tracked_product_id}/alerts`;
      assert.equal(
        await activeAlertCountForOwner(TEST_USERS.alertBoundary.email),
        20,
      );
      await assertRejectedWithoutPersistence(
        () => authenticatedRequest(boundarySession, boundaryEndpoint, {
          method: 'POST',
          json: { target_price: '25000000.00' },
        }),
        'ACTIVE_ALERT_LIMIT_REACHED',
        {
          status: 409,
          detail: 'Maximum 20 active alerts reached',
        },
      );
      assert.equal(
        await activeAlertCountForOwner(TEST_USERS.alertBoundary.email),
        20,
      );

      assert.equal(
        await deleteLatestActiveAlert(TEST_USERS.alertBoundary.email),
        1,
      );
      assert.equal(
        await activeAlertCountForOwner(TEST_USERS.alertBoundary.email),
        19,
      );

      const concurrentResults = await Promise.allSettled([
        authenticatedRequest(boundarySession, boundaryEndpoint, {
          method: 'POST',
          json: { target_price: '25000000.00' },
        }),
        authenticatedRequest(boundarySession, boundaryEndpoint, {
          method: 'POST',
          json: { target_price: '24000000.00' },
        }),
      ]);

      assert.ok(concurrentResults.every((result) => result.status === 'fulfilled'));
      const responses = concurrentResults.map((result) => result.value);
      const successful = responses.filter((result) => result.status === 201);
      const rejected = responses.filter((result) => result.status === 409);

      assert.equal(successful.length, 1);
      assert.equal(rejected.length, 1);
      assertProblemCode(rejected[0], 'ACTIVE_ALERT_LIMIT_REACHED', {
        status: 409,
        detail: 'Maximum 20 active alerts reached',
      });
      assert.equal(successful[0].body.data.status, 'ACTIVE');
      assert.equal(
        await activeAlertCountForOwner(TEST_USERS.alertBoundary.email),
        20,
      );
      assert.equal(await notificationCount(), notificationBaseline);
    });
  } finally {
    await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
  }
});

async function assertRejectedWithoutPersistence(
  operation,
  code,
  expected,
) {
  const before = await totalAlertCount();
  const result = await operation();

  assertProblemCode(result, code, expected);
  assert.equal(await totalAlertCount(), before);
  return result;
}

async function alertById(priceAlertId) {
  const result = await query(
    `SELECT
       price_alert_id::TEXT AS price_alert_id,
       tracked_product_id::TEXT AS tracked_product_id,
       target_price::TEXT AS target_price,
       currency_code,
       status,
       last_threshold_state,
       price_observation_id::TEXT AS price_observation_id,
       last_evaluated_at,
       created_at
     FROM price_alerts
     WHERE price_alert_id = $1`,
    [priceAlertId],
  );

  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function alertCountForTrackedProduct(trackedProductId) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM price_alerts
     WHERE tracked_product_id = $1`,
    [trackedProductId],
  );

  return result.rows[0].count;
}

async function activeAlertCountForOwner(email) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM price_alerts AS pa
     JOIN tracked_products AS tp
       ON tp.tracked_product_id = pa.tracked_product_id
     JOIN users AS u ON u.user_id = tp.user_id
     WHERE u.email = $1
       AND pa.status = 'ACTIVE'`,
    [email],
  );

  return result.rows[0].count;
}

async function totalAlertCount() {
  const result = await query('SELECT COUNT(*)::INTEGER AS count FROM price_alerts');
  return result.rows[0].count;
}

async function notificationCount() {
  const result = await query('SELECT COUNT(*)::INTEGER AS count FROM notifications');
  return result.rows[0].count;
}

async function deleteLatestActiveAlert(email) {
  const result = await query(
    `DELETE FROM price_alerts
     WHERE price_alert_id = (
       SELECT pa.price_alert_id
       FROM price_alerts AS pa
       JOIN tracked_products AS tp
         ON tp.tracked_product_id = pa.tracked_product_id
       JOIN users AS u ON u.user_id = tp.user_id
       WHERE u.email = $1
         AND pa.status = 'ACTIVE'
       ORDER BY pa.created_at DESC, pa.price_alert_id DESC
       LIMIT 1
     )`,
    [email],
  );

  return result.rowCount;
}
