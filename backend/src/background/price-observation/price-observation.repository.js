import { query } from '../../db/pool.js';

export async function findOfferByNormalizedUrl(
  normalizedUrl,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       retailer_offer_id::TEXT AS retailer_offer_id,
       normalized_url
     FROM retailer_offers
     WHERE normalized_url = $1
     ORDER BY retailer_offer_id`,
    [normalizedUrl],
  );

  if (result.rows.length !== 1) {
    return null;
  }

  return result.rows[0];
}

export async function lockOfferVariantContext(
  retailerOfferId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       ro.retailer_offer_id::TEXT AS retailer_offer_id,
       ro.product_variant_id::TEXT AS product_variant_id,
       p.display_name AS product_name
     FROM retailer_offers AS ro
     JOIN product_variants AS pv
       ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p
       ON p.product_id = pv.product_id
     WHERE ro.retailer_offer_id = $1
     FOR UPDATE OF pv`,
    [retailerOfferId],
  );

  return result.rows[0] ?? null;
}

export async function isValidPositiveObservationAmount(
  priceAmount,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       $1::NUMERIC > 0
       AND $1::NUMERIC <= 999999999999.99::NUMERIC
         AS is_valid_amount`,
    [priceAmount],
  );

  return result.rows[0].is_valid_amount;
}

export async function insertOrFindPriceObservation(
  {
    retailerOfferId,
    priceAmount,
    currencyCode,
    availabilityStatus,
    observedAt,
  },
  executeQuery = query,
) {
  const inserted = await executeQuery(
    `INSERT INTO price_observations (
       retailer_offer_id,
       price_amount,
       currency_code,
       availability_status,
       observed_at
     )
     VALUES ($1, $2, $3, $4, $5::TIMESTAMPTZ)
     ON CONFLICT (retailer_offer_id, observed_at) DO NOTHING
     RETURNING
       price_observation_id::TEXT AS price_observation_id,
       retailer_offer_id::TEXT AS retailer_offer_id,
       price_amount::TEXT AS price_amount,
       currency_code,
       availability_status,
       observed_at`,
    [
      retailerOfferId,
      priceAmount,
      currencyCode,
      availabilityStatus,
      observedAt,
    ],
  );

  if (inserted.rows[0]) {
    return {
      observation: inserted.rows[0],
      inserted: true,
      matchesInput: true,
    };
  }

  const existing = await executeQuery(
    `SELECT
       price_observation_id::TEXT AS price_observation_id,
       retailer_offer_id::TEXT AS retailer_offer_id,
       price_amount::TEXT AS price_amount,
       currency_code,
       availability_status,
       observed_at,
       (
         price_amount = $3::NUMERIC
         AND currency_code = $4
         AND availability_status = $5
       ) AS matches_input
     FROM price_observations
     WHERE retailer_offer_id = $1
       AND observed_at = $2::TIMESTAMPTZ`,
    [
      retailerOfferId,
      observedAt,
      priceAmount,
      currencyCode,
      availabilityStatus,
    ],
  );

  const row = existing.rows[0];

  return {
    observation: row,
    inserted: false,
    matchesInput: row?.matches_input === true,
  };
}

export async function updateOfferRefreshMetadata(
  {
    retailerOfferId,
    observedAt,
    acquisitionStatus,
    failureReason = null,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `UPDATE retailer_offers
     SET
       last_refresh_attempt_at = $2::TIMESTAMPTZ,
       last_refresh_status = $3,
       last_refresh_error = $4
     WHERE retailer_offer_id = $1
       AND (
         last_refresh_attempt_at IS NULL
         OR last_refresh_attempt_at <= $2::TIMESTAMPTZ
       )
     RETURNING retailer_offer_id::TEXT AS retailer_offer_id`,
    [retailerOfferId, observedAt, acquisitionStatus, failureReason],
  );

  return result.rows[0] ?? null;
}

export async function isLatestObservationForOffer(
  { retailerOfferId, priceObservationId },
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT price_observation_id = $2 AS is_latest
     FROM price_observations
     WHERE retailer_offer_id = $1
     ORDER BY observed_at DESC, price_observation_id DESC
     LIMIT 1`,
    [retailerOfferId, priceObservationId],
  );

  return result.rows[0]?.is_latest === true;
}

export async function lockActiveAlertsForEvaluation(
  {
    productVariantId,
    currencyCode,
    previousCurrentPrice,
    newCurrentPrice,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       pa.price_alert_id::TEXT AS price_alert_id,
       pa.target_price::TEXT AS target_price,
       pa.last_threshold_state,
       u.email AS recipient_email,
       p.display_name AS product_name,
       CASE
         WHEN $3::NUMERIC IS NULL THEN NULL
         ELSE $3::NUMERIC > pa.target_price
       END AS previous_is_above,
       CASE
         WHEN $4::NUMERIC IS NULL THEN NULL
         ELSE $4::NUMERIC <= pa.target_price
       END AS new_is_at_or_below
     FROM price_alerts AS pa
     JOIN tracked_products AS tp
       ON tp.tracked_product_id = pa.tracked_product_id
     JOIN users AS u
       ON u.user_id = tp.user_id
     JOIN product_variants AS pv
       ON pv.product_variant_id = tp.product_variant_id
     JOIN products AS p
       ON p.product_id = pv.product_id
     WHERE tp.product_variant_id = $1
       AND pa.currency_code = $2
       AND pa.status = 'ACTIVE'
     ORDER BY pa.price_alert_id
     FOR UPDATE OF pa`,
    [
      productVariantId,
      currencyCode,
      previousCurrentPrice,
      newCurrentPrice,
    ],
  );

  return result.rows;
}

export async function updateAlertEvaluation(
  {
    priceAlertId,
    thresholdState,
    priceObservationId,
    evaluatedAt,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `UPDATE price_alerts
     SET
       last_threshold_state = $2,
       price_observation_id = $3,
       last_evaluated_at = GREATEST(last_evaluated_at, $4::TIMESTAMPTZ)
     WHERE price_alert_id = $1
     RETURNING price_alert_id::TEXT AS price_alert_id`,
    [priceAlertId, thresholdState, priceObservationId, evaluatedAt],
  );

  return result.rows[0] ?? null;
}

export async function insertPendingNotification(
  {
    priceAlertId,
    priceObservationId,
    recipientEmail,
    subject,
    qualifiedAt,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `INSERT INTO notifications (
       price_alert_id,
       price_observation_id,
       recipient_email,
       subject,
       delivery_status,
       qualified_at
     )
     VALUES ($1, $2, $3, $4, 'PENDING', $5::TIMESTAMPTZ)
     ON CONFLICT (price_alert_id, price_observation_id) DO NOTHING
     RETURNING notification_id::TEXT AS notification_id`,
    [
      priceAlertId,
      priceObservationId,
      recipientEmail,
      subject,
      qualifiedAt,
    ],
  );

  return result.rows[0] ?? null;
}
