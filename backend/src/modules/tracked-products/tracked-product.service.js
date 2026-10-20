import { withTransaction } from '../../db/pool.js';
import {
  retailerOfferNotFound,
  trackedProductNotFound,
} from '../../shared/problems.js';
import {
  findOwnedTrackedProduct,
  findSelectableOfferById,
  insertTrackedProduct,
} from './tracked-product.repository.js';

export async function requireOwnedTrackedProduct(
  trackedProductId,
  authenticatedUserId,
  findOwned = findOwnedTrackedProduct,
) {
  const trackedProduct = await findOwned(trackedProductId, authenticatedUserId);

  if (!trackedProduct) {
    throw trackedProductNotFound();
  }

  return trackedProduct;
}

export async function createTrackedProductForUser(
  retailerOfferId,
  authenticatedUserId,
) {
  return withTransaction(async (client) => {
    const executeQuery = (text, parameters) => client.query(text, parameters);
    const offer = await findSelectableOfferById(retailerOfferId, executeQuery);

    if (!offer) {
      throw retailerOfferNotFound();
    }

    const trackedProduct = await insertTrackedProduct({
      authenticatedUserId,
      offer,
    }, executeQuery);

    return {
      tracked_product_id: String(trackedProduct.tracked_product_id),
      product: {
        product_id: String(offer.product_id),
        brand: offer.brand,
        model: offer.model,
        display_name: offer.product_display_name,
        variant: {
          product_variant_id: String(offer.product_variant_id),
          display_name: offer.variant_display_name,
          attributes: offer.variant_attributes,
        },
      },
      source: {
        retailer_offer_id: String(offer.retailer_offer_id),
        retailer_id: String(offer.retailer_id),
        retailer_name: offer.retailer_name,
        url: offer.normalized_url,
      },
      tracking_status: trackedProduct.tracking_status,
      created_at: isoTimestamp(trackedProduct.created_at),
    };
  });
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
