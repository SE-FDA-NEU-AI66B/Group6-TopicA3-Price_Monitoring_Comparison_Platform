import { query } from '../../db/pool.js';

export async function isPositiveTargetPrice(
  targetPrice,
  executeQuery = query,
) {
  const result = await executeQuery(
    'SELECT $1::NUMERIC > 0 AS is_positive',
    [targetPrice],
  );

  return result.rows[0].is_positive;
}

export async function isTargetPriceBelowCurrent(
  { targetPrice, currentPrice },
  executeQuery = query,
) {
  const result = await executeQuery(
    'SELECT $1::NUMERIC < $2::NUMERIC AS is_below_current',
    [targetPrice, currentPrice],
  );

  return result.rows[0].is_below_current;
}

export async function lockUserForAlertCreation(
  authenticatedUserId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT user_id::TEXT AS user_id
     FROM users
     WHERE user_id = $1
     FOR UPDATE`,
    [authenticatedUserId],
  );

  return result.rows[0] ?? null;
}

export async function countActiveAlertsForUser(
  authenticatedUserId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT COUNT(*)::INTEGER AS active_alert_count
     FROM price_alerts AS pa
     JOIN tracked_products AS tp
       ON tp.tracked_product_id = pa.tracked_product_id
     WHERE tp.user_id = $1
       AND pa.status = 'ACTIVE'`,
    [authenticatedUserId],
  );

  return result.rows[0].active_alert_count;
}

export async function insertPriceAlert(
  {
    trackedProductId,
    targetPrice,
    currencyCode,
    priceObservationId,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `INSERT INTO price_alerts (
       tracked_product_id,
       target_price,
       currency_code,
       status,
       last_threshold_state,
       price_observation_id,
       last_evaluated_at
     )
     VALUES ($1, $2, $3, 'ACTIVE', 'ABOVE_TARGET', $4, CURRENT_TIMESTAMP)
     RETURNING
       price_alert_id::TEXT AS price_alert_id,
       tracked_product_id::TEXT AS tracked_product_id,
       target_price::TEXT AS target_price,
       currency_code,
       status,
       last_threshold_state,
       price_observation_id::TEXT AS price_observation_id,
       last_evaluated_at,
       created_at`,
    [
      trackedProductId,
      targetPrice,
      currencyCode,
      priceObservationId,
    ],
  );

  return result.rows[0];
}
