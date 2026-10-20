import { findPriceHistoryCurrency } from './price-history.repository.js';
import {
  findEligibleComparisonOffers,
  findOfferComparisonContext,
} from './offer-comparison.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

export const NO_MULTI_SOURCE_MESSAGE = 'No multi-source comparison is currently available';

export function comparisonState(offerCount) {
  if (!Number.isInteger(offerCount) || offerCount < 0) {
    throw new TypeError('offerCount must be a non-negative integer.');
  }

  if (offerCount === 0) {
    return Object.freeze({ status: 'NO_AVAILABLE_OFFERS', message: null });
  }

  if (offerCount === 1) {
    return Object.freeze({
      status: 'SINGLE_OFFER',
      message: NO_MULTI_SOURCE_MESSAGE,
    });
  }

  return Object.freeze({ status: 'AVAILABLE', message: null });
}

export async function getOfferComparisonForUser(
  trackedProductId,
  authenticatedUserId,
) {
  const trackedProduct = await requireOwnedTrackedProduct(
    trackedProductId,
    authenticatedUserId,
  );
  const [context, currencyCode] = await Promise.all([
    findOfferComparisonContext(trackedProduct.product_variant_id),
    findPriceHistoryCurrency(trackedProduct.retailer_offer_id),
  ]);
  const rows = currencyCode === null
    ? []
    : await findEligibleComparisonOffers({
        productVariantId: trackedProduct.product_variant_id,
        currencyCode,
      });

  return assembleOfferComparison({
    trackedProductId,
    context,
    rows,
  });
}

export function assembleOfferComparison({ trackedProductId, context, rows }) {
  if (!context) {
    throw new Error('The tracked product variant context is unavailable.');
  }

  const offers = rows.map(mapOffer);
  const { status, message } = comparisonState(offers.length);

  return {
    tracked_product_id: String(trackedProductId),
    product: {
      product_id: String(context.product_id),
      brand: context.brand,
      model: context.model,
      display_name: context.product_display_name,
      variant: {
        product_variant_id: String(context.product_variant_id),
        display_name: context.variant_display_name,
        attributes: context.variant_attributes,
      },
    },
    status,
    message,
    offers,
    lowest_offer: offers[0] ?? null,
  };
}

function mapOffer(row) {
  return {
    retailer_offer_id: String(row.retailer_offer_id),
    retailer: {
      retailer_id: String(row.retailer_id),
      source_code: row.source_code,
      name: row.retailer_name,
    },
    amount: moneyString(row.price_amount),
    currency_code: row.currency_code,
    availability_status: row.availability_status,
    observed_at: isoTimestamp(row.observed_at),
    url: row.normalized_url,
    difference_from_lowest: moneyString(row.difference_from_lowest),
  };
}

function moneyString(value) {
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
