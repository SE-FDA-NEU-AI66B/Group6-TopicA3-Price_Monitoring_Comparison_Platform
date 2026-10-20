import { query } from '../../db/pool.js';

export async function lockProductVariantForPriceEvaluation(
  productVariantId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT product_variant_id::TEXT AS product_variant_id
     FROM product_variants
     WHERE product_variant_id = $1
     FOR UPDATE`,
    [productVariantId],
  );

  return result.rows[0] ?? null;
}

export async function findPriceHistoryCurrency(
  retailerOfferId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT po.currency_code
     FROM price_observations AS po
     WHERE po.retailer_offer_id = $1
     ORDER BY po.observed_at DESC, po.price_observation_id DESC
     LIMIT 1`,
    [retailerOfferId],
  );

  return result.rows[0]?.currency_code ?? null;
}

export async function findDailyPriceHistory(
  {
    productVariantId,
    currencyCode,
    fromInclusive,
    toExclusive,
  },
  executeQuery = query,
) {
  const result = await executeQuery(
    `WITH daily_prices AS (
       SELECT
         (po.observed_at AT TIME ZONE 'UTC')::DATE AS observed_date,
         MIN(po.price_amount) AS price_amount
       FROM retailer_offers AS ro
       JOIN price_observations AS po
         ON po.retailer_offer_id = ro.retailer_offer_id
       WHERE ro.product_variant_id = $1
         AND po.currency_code = $2
         AND po.availability_status = 'IN_STOCK'
         AND po.observed_at >= $3::TIMESTAMPTZ
         AND po.observed_at < $4::TIMESTAMPTZ
       GROUP BY (po.observed_at AT TIME ZONE 'UTC')::DATE
     )
     SELECT
       observed_date::TEXT AS observed_date,
       price_amount::TEXT AS price_amount,
       (MIN(price_amount) OVER ())::TEXT AS minimum_price,
       (MAX(price_amount) OVER ())::TEXT AS maximum_price
     FROM daily_prices
     ORDER BY observed_date ASC`,
    [productVariantId, currencyCode, fromInclusive, toExclusive],
  );

  return result.rows;
}

export async function findCurrentPrice(
  { productVariantId, currencyCode },
  executeQuery = query,
) {
  const result = await executeQuery(
    `WITH latest_by_offer AS (
       SELECT DISTINCT ON (ro.retailer_offer_id)
         ro.retailer_offer_id,
         po.price_amount,
         po.currency_code,
         po.availability_status,
         po.observed_at,
         po.price_observation_id
       FROM retailer_offers AS ro
       JOIN price_observations AS po
         ON po.retailer_offer_id = ro.retailer_offer_id
       WHERE ro.product_variant_id = $1
       ORDER BY
         ro.retailer_offer_id,
         po.observed_at DESC,
         po.price_observation_id DESC
     )
     SELECT
       price_observation_id::TEXT AS price_observation_id,
       price_amount::TEXT AS price_amount,
       currency_code,
       observed_at
     FROM latest_by_offer
     WHERE availability_status = 'IN_STOCK'
       AND currency_code = $2
     ORDER BY
       price_amount ASC,
       observed_at DESC,
       retailer_offer_id ASC
     LIMIT 1`,
    [productVariantId, currencyCode],
  );

  return result.rows[0] ?? null;
}
