import { freshnessStatus } from '../../shared/freshness.js';
import { trackedProductNotFound } from '../../shared/problems.js';
import {
  findWatchlistByUserId,
  findWatchlistItem,
} from './watchlist.repository.js';

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function moneyString(value) {
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}

function mapWatchlistItem(row) {
  const hasCurrentPrice = row.current_price_amount != null;

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
          observed_at: isoTimestamp(row.current_price_observed_at),
          retailer_name: row.current_price_retailer_name,
        }
      : null,
    freshness_status: freshnessStatus(
      hasCurrentPrice ? row.current_price_observed_at : null,
    ),
    alert_count: row.alert_count,
    active_alert_count: row.active_alert_count,
  };
}

export async function getWatchlistForUser(userId) {
  const rows = await findWatchlistByUserId(userId);
  return rows.map(mapWatchlistItem);
}

export async function getWatchlistItemForUser(trackedProductId, userId) {
  const row = await findWatchlistItem(userId, trackedProductId);

  if (!row) {
    throw trackedProductNotFound();
  }

  return mapWatchlistItem(row);
}
