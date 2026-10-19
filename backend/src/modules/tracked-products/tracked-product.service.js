import { trackedProductNotFound } from '../../shared/problems.js';
import { findOwnedTrackedProduct } from './tracked-product.repository.js';

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
