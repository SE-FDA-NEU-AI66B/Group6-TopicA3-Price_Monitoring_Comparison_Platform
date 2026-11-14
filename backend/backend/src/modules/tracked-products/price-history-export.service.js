import { noExportData } from '../../shared/problems.js';
import {
  findDailyPriceHistory,
  findPriceHistoryCurrency,
} from './price-history.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

export const CSV_HEADER = 'date,price_vnd';
export const EXPORT_CURRENCY = 'VND';

function csvPrice(amount) {
  return String(amount).replace(/\.0+$/, '');
}

export function buildPriceHistoryCsv(rows) {
  if (rows.length === 0) {
    throw noExportData();
  }

  const lines = rows.map((row) => `${row.observed_date},${csvPrice(row.price_amount)}`);

  return `${[CSV_HEADER, ...lines].join('\r\n')}\r\n`;
}

export function priceHistoryCsvFilename(trackedProductId) {
  return `pricelens-price-history-${trackedProductId}.csv`;
}

export async function exportPriceHistoryForUser(trackedProductId, authenticatedUserId) {
  const trackedProduct = await requireOwnedTrackedProduct(
    trackedProductId,
    authenticatedUserId,
  );
  const currencyCode = await findPriceHistoryCurrency(trackedProduct.retailer_offer_id);
  const rows = currencyCode === EXPORT_CURRENCY
    ? await findDailyPriceHistory({
        productVariantId: trackedProduct.product_variant_id,
        currencyCode,
        fromInclusive: '-infinity',
        toExclusive: 'infinity',
      })
    : [];

  return {
    filename: priceHistoryCsvFilename(trackedProductId),
    csv: buildPriceHistoryCsv(rows),
  };
}
