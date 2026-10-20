import { query } from '../../db/pool.js';

export async function findOfferComparisonContext(
  productVariantId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       p.product_id,
       p.brand,
       p.model,
       p.display_name AS product_display_name,
       pv.product_variant_id,
       pv.display_name AS variant_display_name,
       pv.attributes AS variant_attributes
     FROM product_variants AS pv
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE pv.product_variant_id = $1`,
    [productVariantId],
  );

  return result.rows[0] ?? null;
}

export async function findEligibleComparisonOffers(
  { productVariantId, currencyCode },
  executeQuery = query,
) {
  const result = await executeQuery(
    `WITH latest_by_offer AS (
       SELECT DISTINCT ON (ro.retailer_offer_id)
         ro.retailer_offer_id,
         ro.normalized_url,
         r.retailer_id,
         r.source_code,
         r.name AS retailer_name,
         po.price_amount,
         po.currency_code,
         po.availability_status,
         po.observed_at,
         po.price_observation_id
       FROM retailer_offers AS ro
       JOIN retailers AS r ON r.retailer_id = ro.retailer_id
       JOIN price_observations AS po
         ON po.retailer_offer_id = ro.retailer_offer_id
       WHERE ro.product_variant_id = $1
       ORDER BY
         ro.retailer_offer_id,
         po.observed_at DESC,
         po.price_observation_id DESC
     ),
     eligible AS (
       SELECT
         latest_by_offer.*,
         MIN(price_amount) OVER () AS lowest_amount
       FROM latest_by_offer
       WHERE currency_code = $2
         AND availability_status = 'IN_STOCK'
     )
     SELECT
       retailer_offer_id,
       normalized_url,
       retailer_id,
       source_code,
       retailer_name,
       price_amount::TEXT AS price_amount,
       currency_code,
       availability_status,
       observed_at,
       (price_amount - lowest_amount)::TEXT AS difference_from_lowest
     FROM eligible
     ORDER BY price_amount ASC, retailer_name ASC`,
    [productVariantId, currencyCode],
  );

  return result.rows;
}
