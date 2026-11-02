import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOfferComparisonForUser } from '../backend/src/modules/tracked-products/offer-comparison.service.js';
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

const USER_ID = '11';
const IPHONE_128GB_VARIANT_ID = '31';
const IPHONE_256GB_VARIANT_ID = '32';
const DELL_VARIANT_ID = '33';
const OBSERVED_AT = new Date('2026-10-10T08:00:00Z');

const RETAILERS = Object.freeze({
  TECHMART: Object.freeze({ retailer_id: '1', source_code: 'TECHMART', retailer_name: 'TechMart', domain: 'techmart.example' }),
  DIGITAL_HUB: Object.freeze({ retailer_id: '2', source_code: 'DIGITAL_HUB', retailer_name: 'Digital Hub', domain: 'digital-hub.example' }),
  GADGET_WORLD: Object.freeze({ retailer_id: '3', source_code: 'GADGET_WORLD', retailer_name: 'Gadget World', domain: 'gadget-world.example' }),
});

const VARIANT_CONTEXTS = Object.freeze({
  [IPHONE_128GB_VARIANT_ID]: Object.freeze({
    product_id: '21',
    brand: 'Apple',
    model: 'iPhone 15',
    product_display_name: 'Apple iPhone 15',
    product_variant_id: IPHONE_128GB_VARIANT_ID,
    variant_display_name: 'iPhone 15 128GB Black',
    variant_attributes: { storage: '128GB', color: 'Black' },
  }),
  [DELL_VARIANT_ID]: Object.freeze({
    product_id: '22',
    brand: 'Dell',
    model: 'XPS 13 9340',
    product_display_name: 'Dell XPS 13 9340',
    product_variant_id: DELL_VARIANT_ID,
    variant_display_name: 'XPS 13 16GB/512GB Silver',
    variant_attributes: { memory: '16GB', storage: '512GB', color: 'Silver' },
  }),
});

// Builds the row the comparison query returns for one retailer offer.
// `difference` is what PostgreSQL computes for in-stock rows (null otherwise).
function offer(id, retailer, variantId, slug, amount, availability, difference = null) {
  const { domain, ...retailerColumns } = RETAILERS[retailer];
  return Object.freeze({
    retailer_offer_id: id,
    product_variant_id: variantId,
    normalized_url: `https://${domain}/${slug}`,
    ...retailerColumns,
    price_amount: amount,
    currency_code: 'VND',
    availability_status: availability,
    observed_at: OBSERVED_AT,
    difference_from_lowest: difference,
  });
}

// Latest prices of the iPhone 15 fixture, listed in the order the comparison
// query sorts them (in stock first, then by price).
const IPHONE_SEED_OFFERS = Object.freeze([
  offer('41', 'TECHMART', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '19900000.00', 'IN_STOCK', '0.00'),
  offer('42', 'DIGITAL_HUB', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '20200000.00', 'IN_STOCK', '300000.00'),
  offer('44', 'GADGET_WORLD', IPHONE_256GB_VARIANT_ID, 'apple-iphone-15-256gb-black', '18500000.00', 'IN_STOCK', '0.00'),
  offer('43', 'GADGET_WORLD', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '18200000.00', 'OUT_OF_STOCK'),
]);

const IPHONE_TRACKED = Object.freeze({ tracked_product_id: '51', product_variant_id: IPHONE_128GB_VARIANT_ID, retailer_offer_id: '41' });
const DELL_TRACKED = Object.freeze({ tracked_product_id: '52', product_variant_id: DELL_VARIANT_ID, retailer_offer_id: '45' });

// Answers the queries behind the comparison page. The comparison query only
// returns offers whose variant and currency match its parameters, as the SQL
// WHERE clause does; `offers` must already be in the query's sort order.
function createComparisonDatabase({ tracked, offers }) {
  return createFakeDatabaseClient((text, parameters) => {
    if (/FROM tracked_products AS tp/.test(text)) {
      return parameters[0] === tracked.tracked_product_id && parameters[1] === USER_ID
        ? [{ ...tracked, user_id: USER_ID, tracking_status: 'TRACKING' }]
        : [];
    }
    if (/FROM product_variants AS pv/.test(text)) {
      const context = VARIANT_CONTEXTS[parameters[0]];
      return context ? [context] : [];
    }
    if (/^SELECT po\.currency_code/.test(text)) {
      return parameters[0] === tracked.retailer_offer_id ? [{ currency_code: 'VND' }] : [];
    }
    if (/latest_by_offer/.test(text)) {
      const [variantId, currencyCode] = parameters;
      return offers
        .filter((row) => row.product_variant_id === variantId && row.currency_code === currencyCode)
        .map(({ product_variant_id, ...row }) => row);
    }
    return undefined;
  });
}

function useComparisonDatabase(t, { tracked = IPHONE_TRACKED, offers = IPHONE_SEED_OFFERS } = {}) {
  return useFakeDatabase(t, createComparisonDatabase({ tracked, offers }));
}

function summarize(offers) {
  return offers.map(({ retailer, amount, availability_status, difference_from_lowest }) => ({
    retailer: retailer.name,
    amount,
    availability_status,
    difference_from_lowest,
  }));
}

test('TC-US09-01 [normal] matching in-stock offers are listed from lowest with their difference', async (t) => {
  useComparisonDatabase(t);

  const comparison = await getOfferComparisonForUser(IPHONE_TRACKED.tracked_product_id, USER_ID);

  assert.equal(comparison.status, 'AVAILABLE');
  assert.equal(comparison.message, null);
  assert.equal(comparison.product.variant.display_name, 'iPhone 15 128GB Black');
  assert.deepEqual(summarize(comparison.offers).slice(0, 2), [
    { retailer: 'TechMart', amount: '19900000.00', availability_status: 'IN_STOCK', difference_from_lowest: '0.00' },
    { retailer: 'Digital Hub', amount: '20200000.00', availability_status: 'IN_STOCK', difference_from_lowest: '300000.00' },
  ]);
  assert.equal(comparison.lowest_offer.retailer.name, 'TechMart');
});

test('TC-US09-02 [error] an offer for a different variant is excluded from the comparison', async (t) => {
  const client = useComparisonDatabase(t);

  const comparison = await getOfferComparisonForUser(IPHONE_TRACKED.tracked_product_id, USER_ID);

  const comparisonQuery = client.statements.find(({ sql }) => /latest_by_offer/.test(sql));
  assert.deepEqual(comparisonQuery.parameters, [IPHONE_128GB_VARIANT_ID, 'VND']);
  assert.deepEqual(comparison.offers.map((entry) => entry.retailer_offer_id), ['41', '42', '43']);
  assert.ok(comparison.offers.every((entry) => entry.amount !== '18500000.00'));
});

test('TC-US09-03 [error] a cheaper out-of-stock offer is not the lowest available offer', async (t) => {
  useComparisonDatabase(t, {
    offers: [
      offer('42', 'DIGITAL_HUB', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '18500000.00', 'IN_STOCK', '0.00'),
      offer('43', 'GADGET_WORLD', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '18200000.00', 'OUT_OF_STOCK'),
    ],
  });

  const comparison = await getOfferComparisonForUser(IPHONE_TRACKED.tracked_product_id, USER_ID);

  assert.equal(comparison.lowest_offer.retailer.name, 'Digital Hub');
  assert.equal(comparison.lowest_offer.amount, '18500000.00');
  assert.deepEqual(summarize(comparison.offers)[1], {
    retailer: 'Gadget World', amount: '18200000.00', availability_status: 'OUT_OF_STOCK', difference_from_lowest: null,
  });
  assert.equal(comparison.status, 'SINGLE_OFFER');
});

test('TC-US09-04 [error] when every matching offer is out of stock no lowest offer is chosen', async (t) => {
  useComparisonDatabase(t, {
    offers: [
      offer('43', 'GADGET_WORLD', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '18200000.00', 'OUT_OF_STOCK'),
      offer('42', 'DIGITAL_HUB', IPHONE_128GB_VARIANT_ID, 'apple-iphone-15-128gb-black', '18500000.00', 'OUT_OF_STOCK'),
    ],
  });

  const comparison = await getOfferComparisonForUser(IPHONE_TRACKED.tracked_product_id, USER_ID);

  assert.equal(comparison.status, 'ALL_OUT_OF_STOCK');
  assert.equal(comparison.message, 'Currently out of stock across all tracked sources');
  assert.equal(comparison.lowest_offer, null);
  assert.equal(comparison.offers.length, 2);
});

test('TC-US09-05 [boundary, just below] one in-stock offer is not a multi-source comparison', async (t) => {
  useComparisonDatabase(t, {
    tracked: DELL_TRACKED,
    offers: [
      offer('45', 'TECHMART', DELL_VARIANT_ID, 'dell-xps-13-9340-16-512-silver', '34990000.00', 'IN_STOCK', '0.00'),
    ],
  });

  const comparison = await getOfferComparisonForUser(DELL_TRACKED.tracked_product_id, USER_ID);

  assert.equal(comparison.status, 'SINGLE_OFFER');
  assert.equal(comparison.message, 'No multi-source comparison is currently available');
  assert.equal(comparison.offers.length, 1);
  assert.equal(comparison.lowest_offer.retailer.name, 'TechMart');
});

test('TC-US09-06 [boundary, on the limit] exactly two in-stock offers form a multi-source comparison', async (t) => {
  useComparisonDatabase(t);

  const comparison = await getOfferComparisonForUser(IPHONE_TRACKED.tracked_product_id, USER_ID);

  assert.equal(comparison.status, 'AVAILABLE');
  assert.equal(comparison.message, null);
  assert.deepEqual(
    comparison.offers.map((entry) => entry.availability_status),
    ['IN_STOCK', 'IN_STOCK', 'OUT_OF_STOCK'],
  );
});
