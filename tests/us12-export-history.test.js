import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPriceHistoryCsv,
  exportPriceHistoryForUser,
} from '../backend/src/modules/tracked-products/price-history-export.service.js';
import { NO_EXPORT_DATA_MESSAGE } from '../frontend/src/utils/helpers.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const TRACKED_PRODUCT_ID = '21';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function dailyRows(count) {
  const firstDay = Date.UTC(2026, 7, 1);

  return Array.from({ length: count }, (_, index) => ({
    observed_date: new Date(firstDay + index * DAY_IN_MS).toISOString().slice(0, 10),
    price_amount: `${18500000 + index * 10000}.00`,
  }));
}

function csvLines(csv) {
  return csv.split('\r\n').filter((line) => line !== '');
}

// Answers the queries behind the export. The daily-price query returns `rows`
// only for the dates its range parameters cover.
function createExportDatabase(rows) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/FROM tracked_products AS tp/.test(text)) {
      return parameters[0] === TRACKED_PRODUCT_ID && parameters[1] === USER_ID
        ? [{ tracked_product_id: TRACKED_PRODUCT_ID, user_id: USER_ID, product_variant_id: '31', retailer_offer_id: '41' }]
        : [];
    }
    if (/^SELECT po\.currency_code/.test(text)) return [{ currency_code: 'VND' }];
    if (/WITH daily_prices/.test(text)) {
      const [, , fromInclusive, toExclusive] = parameters;
      const from = fromInclusive === '-infinity' ? -Infinity : Date.parse(fromInclusive);
      const to = toExclusive === 'infinity' ? Infinity : Date.parse(toExclusive);
      return rows.filter((row) => {
        const day = Date.parse(row.observed_date);
        return day >= from && day < to;
      });
    }
    return undefined;
  });
}

test('TC-US12-01 [normal] 60 daily prices export as 1 header row and 60 data rows', () => {
  const lines = csvLines(buildPriceHistoryCsv(dailyRows(60)));

  assert.equal(lines.length, 61);
});

test('TC-US12-02 [normal] the header is exactly "date,price_vnd" and every row has one date and one price', () => {
  const [header, ...rows] = csvLines(buildPriceHistoryCsv(dailyRows(60)));

  assert.equal(header, 'date,price_vnd');
  assert.equal(rows[0], '2026-08-01,18500000');
  assert.ok(rows.every((row) => /^\d{4}-\d{2}-\d{2},\d+$/.test(row)));
});

test('TC-US12-03 [normal] 5 prices export as 1 header row and 5 data rows', () => {
  assert.equal(csvLines(buildPriceHistoryCsv(dailyRows(5))).length, 6);
});

test('TC-US12-04 [error] 0 prices produce no file and the message "No data to export"', () => {
  assert.throws(() => buildPriceHistoryCsv([]), {
    status: 404,
    code: 'NO_EXPORT_DATA',
    detail: 'No data to export',
  });
  assert.equal(NO_EXPORT_DATA_MESSAGE, 'No data to export');
});

test('TC-US12-05 [boundary, on the limit] a single price exports as 1 header row and 1 data row', () => {
  assert.equal(csvLines(buildPriceHistoryCsv(dailyRows(1))).length, 2);
});

test('TC-US12-06 [normal] the export is not limited to the 30-day chart window', async (t) => {
  useFakeDatabase(t, createExportDatabase(dailyRows(60)));

  const { filename, csv } = await exportPriceHistoryForUser(TRACKED_PRODUCT_ID, USER_ID);

  assert.equal(filename, 'pricelens-price-history-21.csv');
  assert.equal(csvLines(csv).length, 61);
});

test('TC-US12-07 [error] another user cannot export the price history', async (t) => {
  useFakeDatabase(t, createExportDatabase(dailyRows(60)));

  await assert.rejects(
    exportPriceHistoryForUser(TRACKED_PRODUCT_ID, '12'),
    { status: 404, code: 'TRACKED_PRODUCT_NOT_FOUND' },
  );
});
