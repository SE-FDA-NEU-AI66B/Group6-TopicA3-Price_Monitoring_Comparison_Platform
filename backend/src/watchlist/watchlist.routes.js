import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { findWatchlistByUserId } from './watchlist.repository.js';

const router = Router();
const STALE_AFTER_MILLISECONDS = 24 * 60 * 60 * 1000;

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function moneyString(value) {
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}

function mapWatchlistItem(row) {
  const hasCurrentPrice = row.current_price_amount != null;
  const observedAt = hasCurrentPrice
    ? isoTimestamp(row.current_price_observed_at)
    : null;
  const isStale = hasCurrentPrice
    && Date.now() - new Date(row.current_price_observed_at).getTime()
      >= STALE_AFTER_MILLISECONDS;

  return {
    tracked_product_id: String(row.tracked_product_id),
    tracking_status: row.tracking_status,
    created_at: isoTimestamp(row.created_at),
    product: {
      product_id: String(row.product_id),
      brand: row.brand,
      model: row.model,
      display_name: row.product_display_name,
      variant: {
        product_variant_id: String(row.product_variant_id),
        display_name: row.variant_display_name,
        attributes: row.variant_attributes,
      },
    },
    source: {
      retailer_offer_id: String(row.source_retailer_offer_id),
      retailer_id: String(row.source_retailer_id),
      retailer_name: row.source_retailer_name,
      url: row.source_url,
    },
    current_price: hasCurrentPrice
      ? {
          amount: moneyString(row.current_price_amount),
          currency_code: row.current_price_currency_code,
          availability_status: row.current_price_availability_status,
          observed_at: observedAt,
        }
      : null,
    freshness_status: hasCurrentPrice
      ? (isStale ? 'STALE' : 'CURRENT')
      : 'UNAVAILABLE',
  };
}

router.get('/', authenticate, async (request, response, next) => {
  try {
    const rows = await findWatchlistByUserId(request.user.user_id);
    const data = rows.map(mapWatchlistItem);

    response.status(200).json({ data, meta: { count: data.length } });
  } catch (error) {
    next(error);
  }
});

export { router as watchlistRouter };
