import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { config } from '../config.js';
import { closePool, query } from '../db/pool.js';
import { createPriceAlertForUser } from '../modules/tracked-products/price-alert.service.js';
import { prepareSeededDatabase } from '../test-support/database.js';
import {
  offerByNormalizedUrl,
  TEST_USERS,
  trackedProductByOwnerAndUrl,
  userByEmail,
} from '../test-support/fixtures.js';
import { createJsonlEmailAdapter } from './notification-delivery/development-email.adapter.js';
import { deliverPendingNotifications } from './notification-delivery/notification-delivery.processor.js';
import { processPriceObservation } from './price-observation/price-observation.processor.js';

const DEMO_URL = 'https://techmart.example/dell-xps-13-9340-16-512-silver';
const TARGET_PRICE = '14000000.00';
const SUBJECT = 'Price Drop Alert: Dell XPS 13 9340';

after(() => closePool());

test('US05 full demo runs two real crossings and deliveries with no repeated-below or reset email', {
  timeout: 90_000,
}, async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pricelens-us05-demo-'));
  const outboxPath = join(temporaryDirectory, 'outbox.jsonl');
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });

  try {
    const offer = await offerByNormalizedUrl(DEMO_URL);
    const user = await userByEmail(TEST_USERS.demo.email);
    const tracked = await trackedProductByOwnerAndUrl({
      email: TEST_USERS.demo.email,
      normalizedUrl: DEMO_URL,
    });
    const alert = await createPriceAlertForUser(
      tracked.tracked_product_id,
      user.user_id,
      TARGET_PRICE,
    );
    const baseTime = Date.now() - 5_000;
    const adapter = createJsonlEmailAdapter({ outboxPath });

    assert.equal(alert.status, 'ACTIVE');
    assert.equal(alert.current_price, '34990000.00');
    assert.equal((await alertEvidence(alert.price_alert_id)).last_threshold_state, 'ABOVE_TARGET');

    const firstCrossing = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '13900000.00',
      new Date(baseTime + 1_000).toISOString(),
    ));
    let notifications = await notificationEvidence(alert.price_alert_id);
    assert.equal(firstCrossing.status, 'PROCESSED');
    assert.equal(firstCrossing.notificationCount, 1);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].delivery_status, 'PENDING');
    assert.equal(notifications[0].subject, SUBJECT);
    assert.equal(
      notifications[0].price_observation_id,
      firstCrossing.observation.priceObservationId,
    );
    assert.equal((await alertEvidence(alert.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');

    const firstDelivery = await deliverPendingNotifications({
      emailAdapter: adapter,
      limit: 10,
    });
    assert.equal(firstDelivery.selectedCount, 1);
    assert.equal(firstDelivery.results[0].status, 'SENT');
    assert.equal(firstDelivery.results[0].withinFiveMinutes, true);

    const repeatedBelow = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '13800000.00',
      new Date(baseTime + 2_000).toISOString(),
    ));
    assert.equal(repeatedBelow.notificationCount, 0);
    assert.equal((await notificationEvidence(alert.price_alert_id)).length, 1);
    assert.equal((await deliverPendingNotifications({
      emailAdapter: adapter,
      limit: 10,
    })).selectedCount, 0);

    const reset = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '14200000.00',
      new Date(baseTime + 3_000).toISOString(),
    ));
    assert.equal(reset.notificationCount, 0);
    assert.equal((await alertEvidence(alert.price_alert_id)).last_threshold_state, 'ABOVE_TARGET');
    assert.equal((await notificationEvidence(alert.price_alert_id)).length, 1);

    const secondCrossing = await processPriceObservation(successResult(
      offer.retailer_offer_id,
      '14000000.00',
      new Date(baseTime + 4_000).toISOString(),
    ));
    notifications = await notificationEvidence(alert.price_alert_id);
    assert.equal(secondCrossing.notificationCount, 1);
    assert.equal(notifications.length, 2);
    assert.equal(notifications[1].delivery_status, 'PENDING');
    assert.notEqual(notifications[0].notification_id, notifications[1].notification_id);
    assert.equal(
      notifications[1].price_observation_id,
      secondCrossing.observation.priceObservationId,
    );

    const secondDelivery = await deliverPendingNotifications({
      emailAdapter: adapter,
      limit: 10,
    });
    assert.equal(secondDelivery.selectedCount, 1);
    assert.equal(secondDelivery.results[0].status, 'SENT');
    assert.equal(secondDelivery.results[0].withinFiveMinutes, true);

    notifications = await notificationEvidence(alert.price_alert_id);
    const outbox = parseJsonl(await readFile(outboxPath, 'utf8'));
    assert.equal((await alertEvidence(alert.price_alert_id)).status, 'ACTIVE');
    assert.equal((await alertEvidence(alert.price_alert_id)).last_threshold_state, 'AT_OR_BELOW_TARGET');
    assert.equal(notifications.length, 2);
    assert.ok(notifications.every((notification) => notification.delivery_status === 'SENT'));
    assert.ok(notifications.every((notification) => notification.sent_at instanceof Date));
    assert.ok(notifications.every((notification) => (
      notification.sent_at.getTime() - notification.qualified_at.getTime()
      <= 5 * 60 * 1000
    )));
    assert.equal(outbox.length, 2);
    assert.ok(outbox.every((entry) => entry.status === 'ACCEPTED'));
    assert.ok(outbox.every((entry) => entry.subject === SUBJECT));
    assert.deepEqual(
      outbox.map((entry) => entry.notification_id),
      notifications.map((notification) => notification.notification_id),
    );
  } finally {
    await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
    await rm(temporaryDirectory, { recursive: true, force: true });
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

async function alertEvidence(priceAlertId) {
  const result = await query(
    `SELECT status, last_threshold_state
     FROM price_alerts
     WHERE price_alert_id = $1`,
    [priceAlertId],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function notificationEvidence(priceAlertId) {
  const result = await query(
    `SELECT
       notification_id::TEXT AS notification_id,
       price_observation_id::TEXT AS price_observation_id,
       recipient_email,
       subject,
       delivery_status,
       qualified_at,
       sent_at,
       provider_message_id
     FROM notifications
     WHERE price_alert_id = $1
     ORDER BY qualified_at, notification_id`,
    [priceAlertId],
  );
  return result.rows;
}

function parseJsonl(content) {
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
