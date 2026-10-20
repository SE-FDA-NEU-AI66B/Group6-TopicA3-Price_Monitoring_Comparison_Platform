import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { config } from '../../config.js';
import { closePool, query } from '../../db/pool.js';
import { prepareSeededDatabase } from '../../test-support/database.js';
import { createMemoryEmailAdapter } from './development-email.adapter.js';
import {
  deliverPendingNotification,
  deliverPendingNotifications,
} from './notification-delivery.processor.js';

const US05_URL = 'https://gadget-world.example/nintendo-switch-oled-white';
const SUBJECT = 'Price Drop Alert: Nintendo Switch OLED';
const SNAPSHOT_RECIPIENT = 'notification-snapshot@example.test';

after(() => closePool());

test('BG-03 sends one pending notification using persisted snapshots and records timing evidence', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const pending = await insertPendingFixture({
      observedAt: '2026-10-03T08:00:00.000Z',
      qualifiedAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const before = await notificationState(pending.notificationId);
    const adapter = createMemoryEmailAdapter();
    const delivered = await deliverPendingNotification(pending.notificationId, {
      emailAdapter: adapter,
    });

    assert.equal(before.delivery_status, 'PENDING');
    assert.equal(delivered.status, 'SENT');
    assert.equal(delivered.withinFiveMinutes, true);
    assert.ok(delivered.deliveryLatencyMilliseconds >= 0);
    assert.ok(delivered.deliveryLatencyMilliseconds <= 5 * 60 * 1000);
    assert.equal(adapter.attempts.length, 1);
    assert.equal(adapter.messages.length, 1);
    assert.equal(adapter.messages[0].to, SNAPSHOT_RECIPIENT);
    assert.equal(adapter.messages[0].subject, SUBJECT);
    assert.match(adapter.messages[0].text, /Nintendo Switch OLED/);
    assert.match(adapter.messages[0].text, /VND/);
    assert.match(adapter.messages[0].text, new RegExp(escapeRegExp(US05_URL)));

    const afterDelivery = await notificationState(pending.notificationId);
    assert.equal(afterDelivery.delivery_status, 'SENT');
    assert.equal(afterDelivery.recipient_email, SNAPSHOT_RECIPIENT);
    assert.equal(afterDelivery.subject, SUBJECT);
    assert.equal(afterDelivery.provider_message_id, `memory:${pending.notificationId}`);
    assert.equal(afterDelivery.failure_reason, null);
    assert.ok(afterDelivery.sent_at instanceof Date);
    assert.equal(
      afterDelivery.qualified_at.toISOString(),
      before.qualified_at.toISOString(),
    );
    assert.ok(afterDelivery.sent_at.getTime() - afterDelivery.qualified_at.getTime()
      <= 5 * 60 * 1000);

    const retry = await deliverPendingNotification(pending.notificationId, {
      emailAdapter: adapter,
    });
    assert.equal(retry.status, 'NOT_PENDING');
    assert.equal(adapter.attempts.length, 1);
  } finally {
    await resetTestDatabase();
  }
});

test('BG-03 persists deterministic adapter failure honestly and treats FAILED as terminal', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const pending = await insertPendingFixture({
      observedAt: '2026-10-01T08:00:00.000Z',
      qualifiedAt: new Date().toISOString(),
    });
    const failingAdapter = createMemoryEmailAdapter({
      failNotificationIds: [pending.notificationId],
    });
    const failed = await deliverPendingNotification(pending.notificationId, {
      emailAdapter: failingAdapter,
    });

    assert.equal(failed.status, 'FAILED');
    assert.equal(failingAdapter.attempts.length, 1);
    assert.equal(failingAdapter.messages.length, 0);
    const persisted = await notificationState(pending.notificationId);
    assert.equal(persisted.delivery_status, 'FAILED');
    assert.equal(persisted.sent_at, null);
    assert.equal(persisted.provider_message_id, null);
    assert.equal(
      persisted.failure_reason,
      'Deterministic development adapter failure.',
    );

    const replacementAdapter = createMemoryEmailAdapter();
    const retry = await deliverPendingNotification(pending.notificationId, {
      emailAdapter: replacementAdapter,
    });
    assert.equal(retry.status, 'NOT_PENDING');
    assert.equal(replacementAdapter.attempts.length, 0);
    assert.equal((await notificationState(pending.notificationId)).delivery_status, 'FAILED');
  } finally {
    await resetTestDatabase();
  }
});

test('BG-03 advisory claim prevents two concurrent workers from sending twice', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const pending = await insertPendingFixture({
      observedAt: '2026-10-03T08:00:00.000Z',
      qualifiedAt: new Date().toISOString(),
    });
    const adapter = createMemoryEmailAdapter({ delayMilliseconds: 75 });
    const results = await Promise.all([
      deliverPendingNotification(pending.notificationId, { emailAdapter: adapter }),
      deliverPendingNotification(pending.notificationId, { emailAdapter: adapter }),
    ]);

    const statuses = results.map((result) => result.status);
    assert.equal(statuses.filter((status) => status === 'SENT').length, 1);
    assert.equal(
      statuses.filter((status) => (
        status === 'CLAIMED_BY_OTHER' || status === 'NOT_PENDING'
      )).length,
      1,
    );
    assert.equal(adapter.attempts.length, 1);
    assert.equal(adapter.messages.length, 1);
    assert.equal((await notificationState(pending.notificationId)).delivery_status, 'SENT');
  } finally {
    await resetTestDatabase();
  }
});

test('BG-03 batch continues after one failure and processes independent notifications oldest first', {
  timeout: 90_000,
}, async () => {
  await resetTestDatabase();

  try {
    const older = await insertPendingFixture({
      observedAt: '2026-10-01T08:00:00.000Z',
      qualifiedAt: new Date(Date.now() - 2_000).toISOString(),
    });
    const newer = await insertPendingFixture({
      observedAt: '2026-10-03T08:00:00.000Z',
      qualifiedAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const adapter = createMemoryEmailAdapter({
      failNotificationIds: [older.notificationId],
    });
    const batch = await deliverPendingNotifications({
      emailAdapter: adapter,
      limit: 10,
    });

    assert.equal(batch.selectedCount, 2);
    assert.deepEqual(
      batch.results.map((result) => ({
        id: result.notificationId,
        status: result.status,
      })),
      [
        { id: older.notificationId, status: 'FAILED' },
        { id: newer.notificationId, status: 'SENT' },
      ],
    );
    assert.deepEqual(
      adapter.attempts.map((attempt) => attempt.notificationId),
      [older.notificationId, newer.notificationId],
    );
    assert.equal((await notificationState(older.notificationId)).delivery_status, 'FAILED');
    assert.equal((await notificationState(newer.notificationId)).delivery_status, 'SENT');
  } finally {
    await resetTestDatabase();
  }
});

async function resetTestDatabase() {
  await prepareSeededDatabase({ confirmedDatabaseName: config.database.name });
}

async function insertPendingFixture({ observedAt, qualifiedAt }) {
  const result = await query(
    `WITH fixture AS (
       SELECT pa.price_alert_id, po.price_observation_id
       FROM price_alerts AS pa
       JOIN tracked_products AS tp
         ON tp.tracked_product_id = pa.tracked_product_id
       JOIN users AS u
         ON u.user_id = tp.user_id
       JOIN retailer_offers AS ro
         ON ro.normalized_url = tp.normalized_source_url
       JOIN price_observations AS po
         ON po.retailer_offer_id = ro.retailer_offer_id
        AND po.observed_at = $1::TIMESTAMPTZ
       WHERE u.email = 'demo@pricelens.local'
         AND tp.normalized_source_url = $2
         AND pa.target_price = 8000000.00
     )
     INSERT INTO notifications (
       price_alert_id,
       price_observation_id,
       recipient_email,
       subject,
       delivery_status,
       qualified_at
     )
     SELECT
       price_alert_id,
       price_observation_id,
       $3,
       $4,
       'PENDING',
       $5::TIMESTAMPTZ
     FROM fixture
     RETURNING notification_id::TEXT AS notification_id`,
    [observedAt, US05_URL, SNAPSHOT_RECIPIENT, SUBJECT, qualifiedAt],
  );

  assert.equal(result.rows.length, 1);
  return { notificationId: result.rows[0].notification_id };
}

async function notificationState(notificationId) {
  const result = await query(
    `SELECT
       delivery_status,
       recipient_email,
       subject,
       qualified_at,
       sent_at,
       provider_message_id,
       failure_reason
     FROM notifications
     WHERE notification_id = $1`,
    [notificationId],
  );

  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
