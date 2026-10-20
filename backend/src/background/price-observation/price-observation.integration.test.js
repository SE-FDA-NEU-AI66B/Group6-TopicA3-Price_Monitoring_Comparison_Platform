import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { config } from '../../config.js';
import { closePool, pool, query } from '../../db/pool.js';
import { createPriceAlertForUser } from '../../modules/tracked-products/price-alert.service.js';
import { HttpError } from '../../shared/problems.js';
import {
  assertSafeTestDatabaseTarget,
  prepareSeededDatabase,
} from '../../test-support/database.js';
import {
  missingRetailerOfferId,
  offerByNormalizedUrl,
  P0_FIXTURE_KEYS,
  TEST_USERS,
  trackedProductByOwnerAndUrl,
  userByEmail,
} from '../../test-support/fixtures.js';
import { processPriceObservation } from './price-observation.processor.js';

const DELL_URL = P0_FIXTURE_KEYS.us03.currentPriceUrl;
const IPHONE_TECH_URL = P0_FIXTURE_KEYS.us04.duplicateUrl;
const IPHONE_DIGITAL_URL = P0_FIXTURE_KEYS.us04.creationUrl;

after(() => closePool());

test('BG-01 rejects invalid results and stores explicit failed refresh metadata only', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const offer = await offerByNormalizedUrl(DELL_URL);
    const initialObservationCount = await observationCountForOffer(offer.retailer_offer_id);
    const initialNotificationCount = await totalNotificationCount();
    const failed = await processPriceObservation({
      retailerOfferId: offer.retailer_offer_id,
      acquisitionStatus: 'FAILED',
      observedAt: '2026-10-20T08:30:00.000Z',
      failureReason: 'Deterministic source timeout',
    });

    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.observation, null);
    assert.equal(await observationCountForOffer(offer.retailer_offer_id), initialObservationCount);
    assert.equal(await totalNotificationCount(), initialNotificationCount);
    assert.deepEqual(await refreshMetadata(offer.retailer_offer_id), {
      last_refresh_status: 'FAILED',
      last_refresh_error: 'Deterministic source timeout',
      last_refresh_attempt_at: new Date('2026-10-20T08:30:00.000Z'),
    });

    const malformedResults = [
      successResult(offer.retailer_offer_id, '0', '2026-10-20T01:00:00.000Z'),
      successResult(offer.retailer_offer_id, '-1.00', '2026-10-20T01:00:00.000Z'),
      successResult(offer.retailer_offer_id, '1000000000000.00', '2026-10-20T01:00:00.000Z'),
      { ...successResult(offer.retailer_offer_id, '1.00', '2026-10-20T01:00:00.000Z'), priceAmount: '1.234' },
      { ...successResult(offer.retailer_offer_id, '1.00', '2026-10-20T01:00:00.000Z'), currencyCode: 'vnd' },
      { ...successResult(offer.retailer_offer_id, '1.00', '2026-10-20T01:00:00.000Z'), availabilityStatus: 'AVAILABLE' },
      { ...successResult(offer.retailer_offer_id, '1.00', '2026-10-20T01:00:00.000Z'), observedAt: 'not-a-time' },
    ];

    for (const malformed of malformedResults) {
      await assert.rejects(
        () => processPriceObservation(malformed),
        (error) => error instanceof HttpError
          && error.code === 'INVALID_REQUEST',
      );
    }

    const missingOfferId = await missingRetailerOfferId();
    await assert.rejects(
      () => processPriceObservation(successResult(
        missingOfferId,
        '13900000.00',
        '2026-10-20T01:00:00.000Z',
      )),
      (error) => error instanceof HttpError
        && error.code === 'RETAILER_OFFER_NOT_FOUND',
    );
    assert.equal(await observationCountForOffer(offer.retailer_offer_id), initialObservationCount);
    assert.equal(await totalNotificationCount(), initialNotificationCount);
  } finally {
    await resetTestDatabase();
  }
});

test('BG-02 runs the full BR4 sequence with exact-variant, user, activity and retry isolation', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const offer = await offerByNormalizedUrl(DELL_URL);
    const demoUser = await userByEmail(TEST_USERS.demo.email);
    const tracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: DELL_URL,
    });
    const baseline = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '15000000.00',
      '2026-10-20T01:00:00.000Z',
    ));

    assert.equal(baseline.status, 'PROCESSED');
    assert.equal(baseline.previousCurrentPrice.priceAmount, '34990000.00');
    assert.equal(baseline.newCurrentPrice.priceAmount, '15000000.00');

    const target14 = await createPriceAlertForUser(
      tracked.tracked_product_id,
      demoUser.user_id,
      '14000000.00',
    );
    const target13 = await createPriceAlertForUser(
      tracked.tracked_product_id,
      demoUser.user_id,
      '13000000.00',
    );
    const inactive = await createPriceAlertForUser(
      tracked.tracked_product_id,
      demoUser.user_id,
      '14500000.00',
    );
    await query(
      `UPDATE price_alerts SET status = 'INACTIVE' WHERE price_alert_id = $1`,
      [inactive.price_alert_id],
    );

    const secondOwner = await createSecondOwnerForTrackedProduct({
      productVariantId: tracked.product_variant_id,
      retailerOfferId: tracked.retailer_offer_id,
      normalizedUrl: DELL_URL,
    });
    const secondOwnerAlert = await createPriceAlertForUser(
      secondOwner.trackedProductId,
      secondOwner.userId,
      '14500000.00',
    );
    const samsungTracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: 'https://digital-hub.example/samsung-galaxy-s24-256gb-gray',
    });
    const otherVariantAlert = await createPriceAlertForUser(
      samsungTracked.tracked_product_id,
      demoUser.user_id,
      '18000000.00',
    );

    const firstCrossing = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '13900000.00',
      '2026-10-20T02:00:00.000Z',
    ));
    assert.deepEqual({
      previous: firstCrossing.previousCurrentPrice.priceAmount,
      current: firstCrossing.newCurrentPrice.priceAmount,
      evaluated: firstCrossing.evaluatedAlertCount,
      notifications: firstCrossing.notificationCount,
    }, {
      previous: '15000000.00',
      current: '13900000.00',
      evaluated: 3,
      notifications: 2,
    });
    assert.equal(await notificationCountForAlert(target14.price_alert_id), 1);
    assert.equal(await notificationCountForAlert(target13.price_alert_id), 0);
    assert.equal(await notificationCountForAlert(inactive.price_alert_id), 0);
    assert.equal(await notificationCountForAlert(secondOwnerAlert.price_alert_id), 1);
    assert.equal(await notificationCountForAlert(otherVariantAlert.price_alert_id), 0);
    assert.equal((await alertState(target14.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');
    assert.equal((await alertState(target13.price_alert_id)).last_threshold_state, 'ABOVE_TARGET');
    assert.equal((await alertState(inactive.price_alert_id)).last_threshold_state, 'ABOVE_TARGET');

    const belowAgain = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '13800000.00',
      '2026-10-20T03:00:00.000Z',
    ));
    assert.equal(belowAgain.notificationCount, 0);
    assert.equal(await notificationCountForAlert(target14.price_alert_id), 1);
    assert.equal((await alertState(target14.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');

    const reset = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '14200000.00',
      '2026-10-20T04:00:00.000Z',
    ));
    assert.equal(reset.notificationCount, 0);
    assert.equal((await alertState(target14.price_alert_id)).last_threshold_state, 'ABOVE_TARGET');

    const equalityResult = await Promise.all([
      processPriceObservation(successResult(
        offer.retailer_offer_id,
        '14000000.00',
        '2026-10-20T05:00:00.000Z',
      )),
      processPriceObservation(successResult(
        offer.retailer_offer_id,
        '14000000.00',
        '2026-10-20T05:00:00.000Z',
      )),
    ]);
    assert.deepEqual(
      equalityResult.map(({ status }) => status).sort(),
      ['DUPLICATE', 'PROCESSED'],
    );
    assert.equal(equalityResult.reduce((sum, item) => sum + item.notificationCount, 0), 1);
    assert.equal(await observationCountAt(offer.retailer_offer_id, '2026-10-20T05:00:00.000Z'), 1);
    assert.equal(await notificationCountForAlert(target14.price_alert_id), 2);
    assert.equal((await alertState(target14.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');

    const target13Crossing = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '12900000.00',
      '2026-10-20T06:00:00.000Z',
    ));
    assert.equal(target13Crossing.notificationCount, 1);
    assert.equal(await notificationCountForAlert(target13.price_alert_id), 1);
    assert.equal(await notificationCountForAlert(target14.price_alert_id), 2);

    const retry = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '12900000.00',
      '2026-10-20T06:00:00.000Z',
    ));
    assert.equal(retry.status, 'DUPLICATE');
    assert.equal(retry.notificationCount, 0);

    await assert.rejects(
      () => processPriceObservation(successResult(
        offer.retailer_offer_id,
        '12800000.00',
        '2026-10-20T06:00:00.000Z',
      )),
      (error) => error instanceof HttpError
        && error.code === 'INVALID_REQUEST',
    );
    assert.equal(await observationCountAt(offer.retailer_offer_id, '2026-10-20T06:00:00.000Z'), 1);

    const stateBeforeOldEvent = await alertState(target14.price_alert_id);
    const outOfOrder = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '16000000.00',
      '2026-10-20T00:45:00.000Z',
    ));
    assert.equal(outOfOrder.status, 'OUT_OF_ORDER');
    assert.deepEqual(await alertState(target14.price_alert_id), stateBeforeOldEvent);

    const vndStateBeforeUsd = await alertState(target14.price_alert_id);
    const usd = await processPriceObservation({
      ...successResult(
        offer.retailer_offer_id,
        '10.00',
        '2026-10-20T07:00:00.000Z',
      ),
      currencyCode: 'USD',
    });
    assert.equal(usd.evaluatedAlertCount, 0);
    assert.deepEqual(await alertState(target14.price_alert_id), vndStateBeforeUsd);
    assert.equal(await notificationCountForAlert(otherVariantAlert.price_alert_id), 0);

    const firstNotification = (await notificationsForAlert(target14.price_alert_id))[0];
    assert.deepEqual({
      recipient_email: firstNotification.recipient_email,
      subject: firstNotification.subject,
      delivery_status: firstNotification.delivery_status,
      sent_at: firstNotification.sent_at,
      failure_reason: firstNotification.failure_reason,
    }, {
      recipient_email: TEST_USERS.demo.email,
      subject: 'Price Drop Alert: Dell XPS 13 9340',
      delivery_status: 'PENDING',
      sent_at: null,
      failure_reason: null,
    });
    const crossingObservation = await observationAt(
      offer.retailer_offer_id,
      '2026-10-20T02:00:00.000Z',
    );
    assert.equal(firstNotification.price_observation_id, crossingObservation.price_observation_id);

    await assert.rejects(
      () => pool.query(
        `INSERT INTO notifications (
           price_alert_id,
           price_observation_id,
           recipient_email,
           subject,
           delivery_status,
           qualified_at
         ) VALUES ($1, $2, $3, $4, 'PENDING', $5::TIMESTAMPTZ)`,
        [
          target14.price_alert_id,
          crossingObservation.price_observation_id,
          TEST_USERS.demo.email,
          'Price Drop Alert: Dell XPS 13 9340',
          '2026-10-20T02:00:00.000Z',
        ],
      ),
      (error) => error?.code === '23505'
        && error.constraint === 'uq_notifications_alert_observation',
    );
  } finally {
    await resetTestDatabase();
  }
});

test('BG-02 uses derived multi-offer current price and preserves OOS/unavailable semantics', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const user = await userByEmail(TEST_USERS.demo.email);
    const tracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: IPHONE_TECH_URL,
    });
    const techOffer = await offerByNormalizedUrl(IPHONE_TECH_URL);
    const digitalOffer = await offerByNormalizedUrl(IPHONE_DIGITAL_URL);
    const active = await createPriceAlertForUser(
      tracked.tracked_product_id,
      user.user_id,
      '19000000.00',
    );
    const inactive = await createPriceAlertForUser(
      tracked.tracked_product_id,
      user.user_id,
      '19500000.00',
    );
    await query(
      `UPDATE price_alerts SET status = 'INACTIVE' WHERE price_alert_id = $1`,
      [inactive.price_alert_id],
    );

    const cheapestBecomesOos = await processPriceObservation({
      ...successResult(
        techOffer.retailer_offer_id,
        '19900000.00',
        '2026-10-20T10:00:00.000Z',
      ),
      availabilityStatus: 'OUT_OF_STOCK',
    });
    assert.deepEqual({
      previous: cheapestBecomesOos.previousCurrentPrice.priceAmount,
      current: cheapestBecomesOos.newCurrentPrice.priceAmount,
      notifications: cheapestBecomesOos.notificationCount,
    }, {
      previous: '19900000.00',
      current: '20200000.00',
      notifications: 0,
    });

    const derivedCrossing = await processPriceObservation(successResult(
      digitalOffer.retailer_offer_id,
      '18900000.00',
      '2026-10-20T11:00:00.000Z',
    ));
    assert.equal(derivedCrossing.previousCurrentPrice.priceAmount, '20200000.00');
    assert.equal(derivedCrossing.newCurrentPrice.priceAmount, '18900000.00');
    assert.equal(derivedCrossing.notificationCount, 1);
    assert.equal(await notificationCountForAlert(active.price_alert_id), 1);
    assert.equal(await notificationCountForAlert(inactive.price_alert_id), 0);

    const rawBelowButCurrentUnchanged = await processPriceObservation(successResult(
      techOffer.retailer_offer_id,
      '18950000.00',
      '2026-10-20T12:00:00.000Z',
    ));
    assert.equal(rawBelowButCurrentUnchanged.previousCurrentPrice.priceAmount, '18900000.00');
    assert.equal(rawBelowButCurrentUnchanged.newCurrentPrice.priceAmount, '18900000.00');
    assert.equal(rawBelowButCurrentUnchanged.notificationCount, 0);
    assert.equal(await notificationCountForAlert(active.price_alert_id), 1);
    const supportingDigitalObservation = await observationAt(
      digitalOffer.retailer_offer_id,
      '2026-10-20T11:00:00.000Z',
    );
    assert.equal(
      (await alertState(active.price_alert_id)).price_observation_id,
      supportingDigitalObservation.price_observation_id,
    );

    await processPriceObservation({
      ...successResult(
        techOffer.retailer_offer_id,
        '18950000.00',
        '2026-10-20T13:00:00.000Z',
      ),
      availabilityStatus: 'OUT_OF_STOCK',
    });
    const allOos = await processPriceObservation({
      ...successResult(
        digitalOffer.retailer_offer_id,
        '18900000.00',
        '2026-10-20T14:00:00.000Z',
      ),
      availabilityStatus: 'OUT_OF_STOCK',
    });
    assert.equal(allOos.newCurrentPrice, null);
    assert.equal(allOos.notificationCount, 0);
    assert.equal((await alertState(active.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');
    assert.equal(await notificationCountForAlert(active.price_alert_id), 1);
  } finally {
    await resetTestDatabase();
  }
});

function successResult(retailerOfferId, priceAmount, observedAt) {
  return {
    retailerOfferId,
    acquisitionStatus: 'SUCCEEDED',
    priceAmount,
    currencyCode: 'VND',
    availabilityStatus: 'IN_STOCK',
    observedAt,
  };
}

async function resetTestDatabase() {
  assertSafeTestDatabaseTarget({
    confirmedDatabaseName: config.database.name,
  });
  await query(
    `DELETE FROM tracked_products AS tp
     USING users AS u
     WHERE tp.user_id = u.user_id
       AND u.email = $1`,
    ['processor-owner@pricelens.local'],
  );
  await query('DELETE FROM users WHERE email = $1', [
    'processor-owner@pricelens.local',
  ]);
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
}

async function createSecondOwnerForTrackedProduct({
  productVariantId,
  retailerOfferId,
  normalizedUrl,
}) {
  const user = await query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING user_id::TEXT AS user_id`,
    ['processor-owner@pricelens.local', 'test-only-not-used', 'Processor Owner'],
  );
  const tracked = await query(
    `INSERT INTO tracked_products (
       user_id,
       product_variant_id,
       retailer_offer_id,
       normalized_source_url
     ) VALUES ($1, $2, $3, $4)
     RETURNING tracked_product_id::TEXT AS tracked_product_id`,
    [user.rows[0].user_id, productVariantId, retailerOfferId, normalizedUrl],
  );

  return {
    userId: user.rows[0].user_id,
    trackedProductId: tracked.rows[0].tracked_product_id,
  };
}

async function observationCountForOffer(retailerOfferId) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM price_observations
     WHERE retailer_offer_id = $1`,
    [retailerOfferId],
  );
  return result.rows[0].count;
}

async function observationCountAt(retailerOfferId, observedAt) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM price_observations
     WHERE retailer_offer_id = $1
       AND observed_at = $2::TIMESTAMPTZ`,
    [retailerOfferId, observedAt],
  );
  return result.rows[0].count;
}

async function observationAt(retailerOfferId, observedAt) {
  const result = await query(
    `SELECT price_observation_id::TEXT AS price_observation_id
     FROM price_observations
     WHERE retailer_offer_id = $1
       AND observed_at = $2::TIMESTAMPTZ`,
    [retailerOfferId, observedAt],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function refreshMetadata(retailerOfferId) {
  const result = await query(
    `SELECT last_refresh_status, last_refresh_error, last_refresh_attempt_at
     FROM retailer_offers
     WHERE retailer_offer_id = $1`,
    [retailerOfferId],
  );
  return result.rows[0];
}

async function totalNotificationCount() {
  const result = await query('SELECT COUNT(*)::INTEGER AS count FROM notifications');
  return result.rows[0].count;
}

async function notificationCountForAlert(priceAlertId) {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM notifications
     WHERE price_alert_id = $1`,
    [priceAlertId],
  );
  return result.rows[0].count;
}

async function notificationsForAlert(priceAlertId) {
  const result = await query(
    `SELECT
       price_observation_id::TEXT AS price_observation_id,
       recipient_email,
       subject,
       delivery_status,
       sent_at,
       failure_reason
     FROM notifications
     WHERE price_alert_id = $1
     ORDER BY qualified_at, notification_id`,
    [priceAlertId],
  );
  return result.rows;
}

async function alertState(priceAlertId) {
  const result = await query(
    `SELECT
       last_threshold_state,
       price_observation_id::TEXT AS price_observation_id,
       last_evaluated_at
     FROM price_alerts
     WHERE price_alert_id = $1`,
    [priceAlertId],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}
