import { invalidProductUrl } from '../../shared/problems.js';
import {
  findSelectableOffersByProductAndRetailer,
  findSupportedOfferByNormalizedUrl,
} from './product-source.repository.js';

export const APPROVED_TRACKING_PARAMETERS = Object.freeze(['utm_source']);

export function normalizeProductUrl(submittedUrl) {
  let url;

  try {
    url = new URL(submittedUrl);
  } catch {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  for (const parameter of APPROVED_TRACKING_PARAMETERS) {
    url.searchParams.delete(parameter);
  }

  return url.toString();
}

export async function resolveProductSource(submittedUrl) {
  const normalizedUrl = normalizeProductUrl(submittedUrl);
  const matches = await findSupportedOfferByNormalizedUrl(normalizedUrl);

  if (matches.length !== 1) {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  const resolved = matches[0];
  const variants = await findSelectableOffersByProductAndRetailer(
    resolved.product_id,
    resolved.retailer_id,
  );

  if (variants.length === 0) {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  return {
    normalized_url: normalizedUrl,
    retailer: {
      retailer_id: String(resolved.retailer_id),
      source_code: resolved.source_code,
      name: resolved.retailer_name,
      domain: resolved.retailer_domain,
    },
    product: {
      product_id: String(resolved.product_id),
      canonical_key: resolved.canonical_key,
      brand: resolved.brand,
      model: resolved.model,
      display_name: resolved.product_display_name,
    },
    variants: variants.map((variant) => ({
      product_variant_id: String(variant.product_variant_id),
      retailer_offer_id: String(variant.retailer_offer_id),
      display_name: variant.display_name,
      attributes: variant.attributes,
    })),
  };
}
