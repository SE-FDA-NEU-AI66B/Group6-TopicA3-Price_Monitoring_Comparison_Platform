import { query } from '../../db/pool.js';

const WATCHLIST_QUERY = `
  SELECT
    tp.tracked_product_id,
    tp.tracking_status,
    tp.created_at,
    p.product_id,
    p.brand,
    p.model,
    p.display_name AS product_display_name,
    pv.product_variant_id,
    pv.display_name AS variant_display_name,
    pv.attributes AS variant_attributes,
    source_offer.retailer_offer_id AS source_retailer_offer_id,
    source_retailer.retailer_id AS source_retailer_id,
    source_retailer.name AS source_retailer_name,
    source_offer.normalized_url AS source_url,
    current_price.price_amount AS current_price_amount,
    current_price.currency_code AS current_price_currency_code,
    current_price.availability_status AS current_price_availability_status,
    current_price.observed_at AS current_price_observed_at,
    current_price.retailer_name AS current_price_retailer_name,
    alert_counts.alert_count,
    alert_counts.active_alert_count
  FROM tracked_products AS tp
  JOIN product_variants AS pv
    ON pv.product_variant_id = tp.product_variant_id
  JOIN products AS p
    ON p.product_id = pv.product_id
  JOIN retailer_offers AS source_offer
    ON source_offer.retailer_offer_id = tp.retailer_offer_id
   AND source_offer.product_variant_id = tp.product_variant_id
  JOIN retailers AS source_retailer
    ON source_retailer.retailer_id = source_offer.retailer_id
  LEFT JOIN LATERAL (
    SELECT po.currency_code
    FROM price_observations AS po
    WHERE po.retailer_offer_id = source_offer.retailer_offer_id
    ORDER BY po.observed_at DESC, po.price_observation_id DESC
    LIMIT 1
  ) AS source_observation ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      latest.price_amount,
      latest.currency_code,
      latest.availability_status,
      latest.observed_at,
      matching_retailer.name AS retailer_name
    FROM retailer_offers AS matching_offer
    JOIN retailers AS matching_retailer
      ON matching_retailer.retailer_id = matching_offer.retailer_id
    JOIN LATERAL (
      SELECT
        po.price_amount,
        po.currency_code,
        po.availability_status,
        po.observed_at
      FROM price_observations AS po
      WHERE po.retailer_offer_id = matching_offer.retailer_offer_id
      ORDER BY po.observed_at DESC, po.price_observation_id DESC
      LIMIT 1
    ) AS latest ON TRUE
    WHERE matching_offer.product_variant_id = tp.product_variant_id
      AND latest.availability_status = 'IN_STOCK'
      AND latest.currency_code = source_observation.currency_code
    ORDER BY
      latest.price_amount ASC,
      latest.observed_at DESC,
      matching_offer.retailer_offer_id ASC
    LIMIT 1
  ) AS current_price ON TRUE
  CROSS JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS alert_count,
      (COUNT(*) FILTER (WHERE pa.status = 'ACTIVE'))::INTEGER AS active_alert_count
    FROM price_alerts AS pa
    WHERE pa.tracked_product_id = tp.tracked_product_id
  ) AS alert_counts
  WHERE tp.user_id = $1
    AND ($2::BIGINT IS NULL OR tp.tracked_product_id = $2::BIGINT)
  ORDER BY tp.created_at DESC, tp.tracked_product_id DESC
`;

export async function findWatchlistByUserId(userId) {
  const result = await query(WATCHLIST_QUERY, [userId, null]);
  return result.rows;
}

export async function findWatchlistItem(userId, trackedProductId) {
  const result = await query(WATCHLIST_QUERY, [userId, trackedProductId]);
  return result.rows[0] ?? null;
}
