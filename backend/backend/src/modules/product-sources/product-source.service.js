import { invalidProductUrl } from '../../shared/problems.js';
import {
  findSelectableOffersByProductAndRetailer,
  findSupportedOfferByNormalizedUrl,
} from './product-source.repository.js';

export const TRACKING_PARAMETER_PATTERN = /^(?:utm_.+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref)$/i;

export function normalizeProductUrl(submittedUrl) {
  let url;

  try {
    url = new URL(submittedUrl);
  } catch {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/(.)\/+$/, '$1');

  for (const parameter of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETER_PATTERN.test(parameter)) {
      url.searchParams.delete(parameter);
    }
  }

  url.searchParams.sort();

  return url.toString();
}

export async function resolveProductSource(submittedUrl, authenticatedUserId) {
  const normalizedUrl = normalizeProductUrl(submittedUrl);
  const matches = await findSupportedOfferByNormalizedUrl(normalizedUrl);

  if (matches.length !== 1) {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  const resolved = matches[0];
  const variants = await findSelectableOffersByProductAndRetailer({
    productId: resolved.product_id,
    retailerId: resolved.retailer_id,
    authenticatedUserId,
  });

  if (variants.length === 0) {
    throw invalidProductUrl([
      { field: 'url', reason: 'unsupported_or_invalid' },
    ]);
  }

  return {
    normalized_url: normalizedUrl,
    resolved_retailer_offer_id: String(resolved.retailer_offer_id),
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
      url: variant.normalized_url,
      is_tracked: variant.is_tracked,
      also_tracked_at: variant.also_tracked_at,
    })),
  };
}
