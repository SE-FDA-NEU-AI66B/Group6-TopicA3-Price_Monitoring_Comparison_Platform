import { query } from '../../db/pool.js';

const OWNED_TRACKED_PRODUCT_QUERY = `
  SELECT
    tp.tracked_product_id,
    tp.user_id,
    tp.product_variant_id,
    tp.retailer_offer_id,
    tp.normalized_source_url,
    tp.tracking_status,
    tp.created_at,
    tp.updated_at
  FROM tracked_products AS tp
  WHERE tp.tracked_product_id = $1
    AND tp.user_id = $2
`;

export async function findOwnedTrackedProduct(
  trackedProductId,
  authenticatedUserId,
  executeQuery = query,
) {
  const result = await executeQuery(
    OWNED_TRACKED_PRODUCT_QUERY,
    [trackedProductId, authenticatedUserId],
  );

  return result.rows[0] ?? null;
}

export async function findSelectableOfferById(
  retailerOfferId,
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
       p.product_id,
       p.brand,
       p.model,
       p.display_name AS product_display_name,
       pv.display_name AS variant_display_name,
       pv.attributes AS variant_attributes
     FROM retailer_offers AS ro
     JOIN retailers AS r ON r.retailer_id = ro.retailer_id
     JOIN product_variants AS pv ON pv.product_variant_id = ro.product_variant_id
     JOIN products AS p ON p.product_id = pv.product_id
     WHERE ro.retailer_offer_id = $1
       AND r.is_active = TRUE`,
    [retailerOfferId],
  );

  return result.rows[0] ?? null;
}

export async function insertTrackedProduct(
  { authenticatedUserId, offer },
  executeQuery = query,
) {
  const result = await executeQuery(
    `INSERT INTO tracked_products (
       user_id,
       product_variant_id,
       retailer_offer_id,
       normalized_source_url,
       tracking_status
     )
     VALUES ($1, $2, $3, $4, 'TRACKING')
     RETURNING
       tracked_product_id,
       user_id,
       product_variant_id,
       retailer_offer_id,
       normalized_source_url,
       tracking_status,
       created_at`,
    [
      authenticatedUserId,
      offer.product_variant_id,
      offer.retailer_offer_id,
      offer.normalized_url,
    ],
  );

  return result.rows[0];
}
