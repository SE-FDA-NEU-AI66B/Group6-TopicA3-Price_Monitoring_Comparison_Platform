import { query, withClient } from '../../db/pool.js';

export async function findPendingNotificationIds(
  { limit },
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT notification_id::TEXT AS notification_id
     FROM notifications
     WHERE delivery_status = 'PENDING'
     ORDER BY qualified_at ASC, notification_id ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => row.notification_id);
}

export async function withPendingNotificationClaim(
  notificationId,
  operation,
  database,
) {
  return withClient(async (client) => {
    const lock = await client.query(
      'SELECT pg_try_advisory_lock($1::BIGINT) AS claimed',
      [notificationId],
    );

    if (lock.rows[0].claimed !== true) {
      return { claimed: false, value: null };
    }

    try {
      const notification = await findPendingNotification(
        notificationId,
        (text, parameters) => client.query(text, parameters),
      );

      if (!notification) {
        return { claimed: true, value: null };
      }

      return {
        claimed: true,
        value: await operation(
          notification,
          (text, parameters) => client.query(text, parameters),
        ),
      };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1::BIGINT)', [notificationId]);
    }
  }, database);
}

export async function findPendingNotification(
  notificationId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       n.notification_id::TEXT AS notification_id,
       n.price_alert_id::TEXT AS price_alert_id,
       n.price_observation_id::TEXT AS price_observation_id,
       n.recipient_email,
       n.subject,
       n.qualified_at,
       pa.target_price::TEXT AS target_price,
       po.price_amount::TEXT AS price_amount,
       po.currency_code,
       po.observed_at,
       ro.normalized_url AS source_url,
       p.display_name AS product_name
     FROM notifications AS n
     JOIN price_alerts AS pa
       ON pa.price_alert_id = n.price_alert_id
     JOIN price_observations AS po
       ON po.price_observation_id = n.price_observation_id
     JOIN retailer_offers AS ro
       ON ro.retailer_offer_id = po.retailer_offer_id
     JOIN product_variants AS pv
       ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p
       ON p.product_id = pv.product_id
     WHERE n.notification_id = $1
       AND n.delivery_status = 'PENDING'`,
    [notificationId],
  );

  return result.rows[0] ?? null;
}

export async function markNotificationSent(
  { notificationId, providerMessageId },
  executeQuery = query,
) {
  const result = await executeQuery(
    `UPDATE notifications
     SET
       delivery_status = 'SENT',
       sent_at = CURRENT_TIMESTAMP,
       provider_message_id = $2,
       failure_reason = NULL
     WHERE notification_id = $1
       AND delivery_status = 'PENDING'
     RETURNING
       notification_id::TEXT AS notification_id,
       delivery_status,
       qualified_at,
       sent_at,
       provider_message_id`,
    [notificationId, providerMessageId],
  );

  return result.rows[0] ?? null;
}

export async function markNotificationFailed(
  { notificationId, failureReason },
  executeQuery = query,
) {
  const result = await executeQuery(
    `UPDATE notifications
     SET
       delivery_status = 'FAILED',
       sent_at = NULL,
       provider_message_id = NULL,
       failure_reason = $2
     WHERE notification_id = $1
       AND delivery_status = 'PENDING'
     RETURNING
       notification_id::TEXT AS notification_id,
       delivery_status,
       qualified_at,
       sent_at,
       failure_reason`,
    [notificationId, failureReason],
  );

  return result.rows[0] ?? null;
}
