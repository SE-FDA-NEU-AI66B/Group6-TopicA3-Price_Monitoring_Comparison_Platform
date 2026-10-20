import {
  parseIdentifier,
  requireObject,
  requireString,
} from '../../shared/validation.js';

export function parseCreateTrackedProductBody(value) {
  const body = requireObject(value);
  const retailerOfferId = requireString(body, 'retailer_offer_id');

  return {
    retailerOfferId: parseIdentifier(retailerOfferId, 'retailer_offer_id'),
  };
}
