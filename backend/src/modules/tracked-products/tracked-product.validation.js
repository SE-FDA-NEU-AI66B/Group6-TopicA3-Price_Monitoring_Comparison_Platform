import {
  parseIdentifier,
  requireObject,
  requireString,
} from '../../shared/validation.js';

export const SELECT_VARIANT_MESSAGE = 'Select 1 product variant to continue';

export function parseCreateTrackedProductBody(value) {
  const body = requireObject(value);
  const retailerOfferId = requireString(body, 'retailer_offer_id', {
    detail: SELECT_VARIANT_MESSAGE,
  });

  return {
    retailerOfferId: parseIdentifier(retailerOfferId, 'retailer_offer_id'),
  };
}

export function parseTrackedProductId(value) {
  return parseIdentifier(value, 'tracked_product_id');
}
