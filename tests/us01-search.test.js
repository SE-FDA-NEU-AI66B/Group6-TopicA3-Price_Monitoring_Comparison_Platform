import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  filterWatchlistItems,
  getNoSearchResultsMessage,
} from '../frontend/src/utils/helpers.js';

const PRODUCTS = [
  ['Apple iPhone 15', 'iPhone 15 128GB Black'],
  ['Apple iPhone 15', 'iPhone 15 256GB Black'],
  ['Samsung Galaxy S24', 'Galaxy S24 256GB Gray'],
  ['Apple MacBook Air M2', 'MacBook Air M2 8GB/256GB Midnight'],
  ['Dell XPS 13 9340', 'XPS 13 16GB/512GB Silver'],
  ['Sony WH-1000XM5', 'WH-1000XM5 Black'],
  ['Nintendo Switch OLED', 'Switch OLED White'],
  ['Canon EOS R50', 'EOS R50 18-45mm Kit Black'],
  ['Kindle Paperwhite', 'Kindle Paperwhite 16GB Black'],
  ['Xiaomi Robot Vacuum S10', 'Robot Vacuum S10 White'],
  ['Logitech MX Master 3S', 'MX Master 3S Graphite'],
  ['Philips Essential Air Fryer XL', 'Air Fryer XL 6.2L Black'],
  ['Dyson V15 Detect', 'V15 Detect Gold'],
  ['LG UltraGear 27GP850', 'UltraGear 27GP850 27 inch'],
  ['JBL Flip 6', 'Flip 6 Blue'],
];

const WATCHLIST = PRODUCTS.map(([productName, variantName], index) => ({
  tracked_product_id: String(index + 1),
  product: {
    display_name: productName,
    variant: { display_name: variantName },
  },
}));

function names(items) {
  return items.map((item) => item.product.display_name);
}

test('TC-US01-01 [normal] "air fryer" shows exactly the 1 product whose name contains "Air Fryer"', () => {
  const items = filterWatchlistItems(WATCHLIST, 'air fryer');

  assert.deepEqual(names(items), ['Philips Essential Air Fryer XL']);
});

test('TC-US01-02 [normal] no match for "xyz123" shows exactly "No products found matching \'xyz123\'"', () => {
  const items = filterWatchlistItems(WATCHLIST, 'xyz123');

  assert.equal(items.length, 0);
  assert.equal(getNoSearchResultsMessage('xyz123'), "No products found matching 'xyz123'");
});

test('TC-US01-03 [normal] clearing the search text shows all 15 products again', () => {
  assert.equal(filterWatchlistItems(WATCHLIST, 'air fryer').length, 1);

  const items = filterWatchlistItems(WATCHLIST, '');

  assert.equal(items.length, 15);
  assert.deepEqual(items, WATCHLIST);
});

test('TC-US01-04 [normal] search text made only of spaces shows all 15 products', () => {
  assert.equal(filterWatchlistItems(WATCHLIST, '   ').length, 15);
});

test('TC-US01-05 [normal] case and extra spaces are ignored', () => {
  const items = filterWatchlistItems(WATCHLIST, '  AIR   FRYER ');

  assert.deepEqual(names(items), ['Philips Essential Air Fryer XL']);
  assert.equal(getNoSearchResultsMessage('  xyz123 '), "No products found matching 'xyz123'");
});

test('TC-US01-06 [normal] a partial name matches every product that contains it', () => {
  const items = filterWatchlistItems(WATCHLIST, 'iphone');

  assert.deepEqual(names(items), ['Apple iPhone 15', 'Apple iPhone 15']);
});
