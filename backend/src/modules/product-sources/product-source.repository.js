import { query } from '../../db/pool.js';

export async function findSupportedOfferByNormalizedUrl(
  normalizedUrl,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       ro.retailer_offer_id,
       ro.product_variant_id,
       ro.normalized_url,
       r.retailer_id,
       r.source_code,
       r.name AS retailer_name,
       r.domain AS retailer_domain,
       p.product_id,
       p.canonical_key,
       p.brand,
       p.model,
       p.display_name AS product_display_name
     FROM retailer_offers AS ro
     JOIN retailers AS r ON r.retailer_id = ro.retailer_id
     JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE ro.normalized_url = $1
       AND r.is_active = TRUE`,
    [normalizedUrl],
  );

  return result.rows;
}

export async function findSelectableOffersByProductAndRetailer(
  productId,
  retailerId,
  executeQuery = query,
) {
  const result = await executeQuery(
    `SELECT
       pv.product_variant_id,
       ro.retailer_offer_id,
       pv.display_name,
       pv.attributes
     FROM product_variants AS pv
     JOIN retailer_offers AS ro
       ON ro.product_variant_id = pv.product_variant_id
     JOIN retailers AS r ON r.retailer_id = ro.retailer_id
     WHERE pv.product_id = $1
       AND ro.retailer_id = $2
       AND r.is_active = TRUE
     ORDER BY pv.variant_key, ro.retailer_offer_id`,
    [productId, retailerId],
  );

  return result.rows;
}
