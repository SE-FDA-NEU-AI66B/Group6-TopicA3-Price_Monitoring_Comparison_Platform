import {
  findCurrentPrice,
  findDailyPriceHistory,
  findPriceHistoryCurrency,
} from './price-history.repository.js';
import { requireOwnedTrackedProduct } from './tracked-product.service.js';

export const PRICE_HISTORY_DAYS = 30;
export const INSUFFICIENT_DATA_MESSAGE = 'Insufficient data for a 30-day chart';
export const NO_HISTORY_MESSAGE = 'No price history available';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function createUtcHistoryRange(referenceTime = new Date()) {
  if (!(referenceTime instanceof Date) || Number.isNaN(referenceTime.getTime())) {
    throw new TypeError('referenceTime must be a valid Date.');
  }

  const toExclusive = new Date(Date.UTC(
    referenceTime.getUTCFullYear(),
    referenceTime.getUTCMonth(),
    referenceTime.getUTCDate(),
  ));
  const fromInclusive = new Date(
    toExclusive.getTime() - PRICE_HISTORY_DAYS * MILLISECONDS_PER_DAY,
  );
  const finalIncludedDay = new Date(
    toExclusive.getTime() - MILLISECONDS_PER_DAY,
  );

  return Object.freeze({
    days: PRICE_HISTORY_DAYS,
    fromDate: isoDate(fromInclusive),
    toDate: isoDate(finalIncludedDay),
    fromInclusive: fromInclusive.toISOString(),
    toExclusive: toExclusive.toISOString(),
  });
}

export function historyStatus(pointCount) {
  if (!Number.isInteger(pointCount) || pointCount < 0) {
    throw new TypeError('pointCount must be a non-negative integer.');
  }

  if (pointCount === 0) {
    return Object.freeze({
      status: 'NO_HISTORY',
      message: NO_HISTORY_MESSAGE,
    });
  }

  if (pointCount === 1) {
    return Object.freeze({
      status: 'INSUFFICIENT_DATA',
      message: INSUFFICIENT_DATA_MESSAGE,
    });
  }

  return Object.freeze({ status: 'AVAILABLE', message: null });
}

export async function getPriceHistoryForUser(
  trackedProductId,
  authenticatedUserId,
  { referenceTime = new Date() } = {},
) {
  const trackedProduct = await requireOwnedTrackedProduct(
    trackedProductId,
    authenticatedUserId,
  );
  const range = createUtcHistoryRange(referenceTime);
  const currencyCode = await findPriceHistoryCurrency(
    trackedProduct.retailer_offer_id,
  );

  let rows = [];
  let currentPrice = null;

  if (currencyCode !== null) {
    [rows, currentPrice] = await Promise.all([
      findDailyPriceHistory({
        productVariantId: trackedProduct.product_variant_id,
        currencyCode,
        fromInclusive: range.fromInclusive,
        toExclusive: range.toExclusive,
      }),
      findCurrentPrice({
        productVariantId: trackedProduct.product_variant_id,
        currencyCode,
      }),
    ]);
  }

  return assemblePriceHistory({
    trackedProductId,
    range,
    currencyCode,
    rows,
    currentPrice,
  });
}

export function assemblePriceHistory({
  trackedProductId,
  range,
  currencyCode,
  rows,
  currentPrice,
}) {
  const points = rows.map((row) => ({
    date: row.observed_date,
    amount: row.price_amount,
  }));
  const { status, message } = historyStatus(points.length);
  const summary = points.length === 0
    ? null
    : {
        minimum: rows[0].minimum_price,
        maximum: rows[0].maximum_price,
        current: currentPrice?.price_amount ?? null,
        currency_code: currencyCode,
      };

  return {
    tracked_product_id: String(trackedProductId),
    range: {
      days: range.days,
      from_date: range.fromDate,
      to_date: range.toDate,
      timezone: 'UTC',
    },
    status,
    message,
    points,
    summary,
  };
}

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}
