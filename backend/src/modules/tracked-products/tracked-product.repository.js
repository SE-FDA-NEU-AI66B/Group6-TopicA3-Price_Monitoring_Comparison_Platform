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
