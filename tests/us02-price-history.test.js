import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assemblePriceHistory,
  createUtcHistoryRange,
  INSUFFICIENT_DATA_MESSAGE,
  NO_HISTORY_MESSAGE,
} from '../backend/src/modules/tracked-products/price-history.service.js';
import { requireOwnedTrackedProduct } from '../backend/src/modules/tracked-products/tracked-product.service.js';

const REFERENCE_TIME = new Date('2026-10-20T12:00:00Z');
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function dailyRows(count, { minimum, maximum, price = minimum }) {
  const firstDay = Date.UTC(2026, 8, 20);

  return Array.from({ length: count }, (_, index) => ({
    observed_date: new Date(firstDay + index * DAY_IN_MS).toISOString().slice(0, 10),
    price_amount: price,
    minimum_price: minimum,
    maximum_price: maximum,
  }));
}

function assembleHistory(rows, currentPrice = null) {
  return assemblePriceHistory({
    trackedProductId: '7',
    range: createUtcHistoryRange(REFERENCE_TIME),
    currencyCode: rows.length === 0 ? null : 'VND',
    rows,
    currentPrice: currentPrice === null ? null : { price_amount: currentPrice },
  });
}

test('TC-US02-01 [normal] 30 daily prices give a 30-point chart for the previous 30 UTC days', () => {
  const rows = dailyRows(30, { minimum: '18500000.00', maximum: '20000000.00' });

  const history = assembleHistory(rows);

  assert.equal(history.status, 'AVAILABLE');
  assert.equal(history.message, null);
  assert.deepEqual(history.range, {
    days: 30,
    from_date: '2026-09-20',
    to_date: '2026-10-19',
    timezone: 'UTC',
  });
  assert.equal(history.points.length, 30);
  assert.equal(history.points[0].date, '2026-09-20');
  assert.equal(history.points[29].date, '2026-10-19');
});

test('TC-US02-02 [normal] lowest, highest and current prices are returned exactly', () => {
  const rows = [
    {
      observed_date: '2026-10-18',
      price_amount: '18500000.00',
      minimum_price: '18500000.00',
      maximum_price: '20000000.00',
    },
    {
      observed_date: '2026-10-19',
      price_amount: '20000000.00',
      minimum_price: '18500000.00',
      maximum_price: '20000000.00',
    },
  ];

  const history = assembleHistory(rows, '18900000.00');

  assert.deepEqual(history.summary, {
    minimum: '18500000.00',
    maximum: '20000000.00',
    current: '18900000.00',
    currency_code: 'VND',
  });
});

test('TC-US02-03 [error] no valid price records shows no history instead of an empty chart', () => {
  const history = assembleHistory([]);

  assert.equal(history.status, 'NO_HISTORY');
  assert.equal(history.message, NO_HISTORY_MESSAGE);
  assert.equal(history.message, 'No price history available');
  assert.deepEqual(history.points, []);
  assert.equal(history.summary, null);
});

test('TC-US02-04 [error] price history of another user\'s product is refused', async () => {
  const findOwnedByOtherUser = async () => null;

  await assert.rejects(
    requireOwnedTrackedProduct('7', 'user-without-access', findOwnedByOtherUser),
    {
      status: 404,
      code: 'TRACKED_PRODUCT_NOT_FOUND',
      detail: 'Tracked product not found',
    },
  );
});

test('TC-US02-05 [boundary, just below] one valid price record is insufficient for a chart', () => {
  const rows = dailyRows(1, { minimum: '18900000.00', maximum: '18900000.00' });

  const history = assembleHistory(rows);

  assert.equal(history.status, 'INSUFFICIENT_DATA');
  assert.equal(history.message, INSUFFICIENT_DATA_MESSAGE);
  assert.equal(history.message, 'Insufficient data for a 30-day chart');
});

test('TC-US02-06 [boundary, on the limit] two valid price records are enough for a chart', () => {
  const rows = dailyRows(2, { minimum: '18900000.00', maximum: '18900000.00' });

  const history = assembleHistory(rows);

  assert.equal(history.status, 'AVAILABLE');
  assert.equal(history.message, null);
  assert.equal(history.points.length, 2);
});
