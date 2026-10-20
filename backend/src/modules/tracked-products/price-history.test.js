import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assemblePriceHistory,
  createUtcHistoryRange,
  historyStatus,
  INSUFFICIENT_DATA_MESSAGE,
  NO_HISTORY_MESSAGE,
} from './price-history.service.js';

test('UTC history range contains the previous 30 complete calendar days', () => {
  const range = createUtcHistoryRange(new Date('2026-10-20T23:59:59.999Z'));

  assert.deepEqual(range, {
    days: 30,
    fromDate: '2026-09-20',
    toDate: '2026-10-19',
    fromInclusive: '2026-09-20T00:00:00.000Z',
    toExclusive: '2026-10-20T00:00:00.000Z',
  });
});

test('history state maps zero, one and at least two daily points exactly', () => {
  assert.deepEqual(historyStatus(0), {
    status: 'NO_HISTORY',
    message: NO_HISTORY_MESSAGE,
  });
  assert.deepEqual(historyStatus(1), {
    status: 'INSUFFICIENT_DATA',
    message: INSUFFICIENT_DATA_MESSAGE,
  });
  assert.deepEqual(historyStatus(2), {
    status: 'AVAILABLE',
    message: null,
  });
  assert.deepEqual(historyStatus(30), {
    status: 'AVAILABLE',
    message: null,
  });
});

test('price-history assembly keeps identifiers and monetary values as strings', () => {
  const data = assemblePriceHistory({
    trackedProductId: '9007199254740993',
    range: createUtcHistoryRange(new Date('2026-10-20T12:00:00Z')),
    currencyCode: 'VND',
    rows: [
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
    ],
    currentPrice: { price_amount: '18900000.00' },
  });

  assert.equal(data.tracked_product_id, '9007199254740993');
  assert.equal(data.status, 'AVAILABLE');
  assert.deepEqual(data.points, [
    { date: '2026-10-18', amount: '18500000.00' },
    { date: '2026-10-19', amount: '20000000.00' },
  ]);
  assert.deepEqual(data.summary, {
    minimum: '18500000.00',
    maximum: '20000000.00',
    current: '18900000.00',
    currency_code: 'VND',
  });
});

test('no-history response contains no fabricated points or summary', () => {
  const data = assemblePriceHistory({
    trackedProductId: '7',
    range: createUtcHistoryRange(new Date('2026-10-20T12:00:00Z')),
    currencyCode: null,
    rows: [],
    currentPrice: null,
  });

  assert.equal(data.status, 'NO_HISTORY');
  assert.equal(data.message, NO_HISTORY_MESSAGE);
  assert.deepEqual(data.points, []);
  assert.equal(data.summary, null);
});
